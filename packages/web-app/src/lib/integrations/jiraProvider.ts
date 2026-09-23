import {
  exportReportToMarkdown,
  mapWithConcurrency,
  severityToJiraPriority,
  TicketProviderError,
  type ProviderContainer,
  type SubmissionContext,
  type SubmissionResult,
  type TicketProvider,
} from "@repruvia/shared";
import { screenshotAttachmentName } from "@/lib/reportAttachments";
import { markdownToAdf } from "./markdownToAdf.js";
import {
  browserTransport,
  parseJson,
  ticketTransport,
  type HttpResult,
  type HttpTransport,
} from "./transport";

export interface JiraCredentials {
  /** Site subdomain, e.g. "acme" for acme.atlassian.net. */
  site: string;
  email: string;
  apiToken: string;
}

/**
 * Jira Cloud integration via REST API v3 using email + API token (Basic auth).
 * NOTE: Jira Cloud restricts cross-origin browser calls; for production use
 * front this with an OAuth 2.0 (3LO) flow through api.atlassian.com. The
 * `TicketProvider` interface stays identical either way.
 */
/** Jira caps `summary` at 255 characters and rejects line breaks in it. */
const SUMMARY_MAX = 255;
const UPLOAD_CONCURRENCY = 3;

/**
 * Accept what people actually paste into the "site" field — `acme`,
 * `acme.atlassian.net`, or `https://acme.atlassian.net/jira/…` — and reduce it
 * to the subdomain the API URLs are built from.
 */
export function normalizeJiraSite(site: string): string {
  return site
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.atlassian\.net$/i, "")
    .toLowerCase();
}

/** Jira error bodies: `{ errorMessages: string[], errors: { field: message } }`. */
interface JiraErrorBody {
  errorMessages?: string[];
  errors?: Record<string, string>;
}

class JiraApiError extends TicketProviderError {
  constructor(
    readonly status: number,
    readonly body: JiraErrorBody | null,
  ) {
    // The raw Jira error body rides along as `cause` for the console only.
    super("jira", describeJiraError(status), body);
  }
}

/**
 * One plain sentence per failure. Jira's own status codes and error body stay
 * on the thrown error for the console, never in the copy.
 */
function describeJiraError(status: number): string {
  if (status === 401) return "Jira rejected your email or API token. Check them in Settings.";
  if (status === 403) return "Your Jira account isn't allowed to do that.";
  if (status === 404) return "Jira couldn't find that — check the site name in Settings.";
  return "Jira couldn't finish that request. Try again.";
}

export class JiraProvider implements TicketProvider {
  readonly id = "jira";
  readonly displayName = "Jira";
  private readonly site: string;

  /**
   * `http` routes through the extension service worker, which is CORS-free —
   * Jira Cloud blocks most direct browser (CORS) calls.
   */
  constructor(
    private readonly creds: JiraCredentials,
    private readonly http: HttpTransport = ticketTransport(browserTransport),
  ) {
    this.site = normalizeJiraSite(creds.site);
  }

  isAuthenticated(): boolean {
    return Boolean(this.site && this.creds.email.trim() && this.creds.apiToken.trim());
  }

  async authenticate(): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new TicketProviderError(this.id, "Add Jira site, email, and API token in Settings.");
    }
  }

  async listContainers(): Promise<ProviderContainer[]> {
    const data = await this.api<{ values: { id: string; key: string; name: string }[] }>(
      "GET",
      "/rest/api/3/project/search?maxResults=100&orderBy=name",
    );
    // containerId carries the project key, which issue creation requires.
    return data.values.map((p) => ({ id: p.key, name: `${p.name} (${p.key})` }));
  }

  async submit(context: SubmissionContext): Promise<SubmissionResult> {
    const { report, markdownBody, reportedBy, target, attachments, onProgress } = context;

    // Jira attachments need an existing issue, so create it text-only first.
    const created = await this.createIssue({
      project: { key: target.containerId },
      summary: toSummary(report.meta.title),
      description: markdownToAdf(markdownBody),
      issuetype: { name: "Bug" },
      priority: { name: severityToJiraPriority(report.meta.severity) },
    });

    // Upload screenshots (a few at a time), capturing each attachment id for
    // inline embedding. Best-effort: a failed upload just won't appear inline.
    const idByName = new Map<string, string>();
    let done = 0;
    await mapWithConcurrency(attachments, UPLOAD_CONCURRENCY, async (attachment) => {
      try {
        const id = await this.attach(created.id, attachment);
        if (id) idByName.set(attachment.filename, id);
      } catch (err) {
        console.error(`[repruvia] Jira attachment upload failed for ${attachment.filename}:`, err);
      }
      done += 1;
      onProgress?.(done / (attachments.length + 1));
    });

    // Re-render the description with the uploaded images inline as ADF media
    // nodes. If this fails, the attachments still show in the panel.
    if (idByName.size > 0) {
      try {
        const body = exportReportToMarkdown(report, {
          screenshots: "link",
          screenshotPath: (step) =>
            idByName.has(screenshotAttachmentName(step.index))
              ? screenshotAttachmentName(step.index)
              : "",
          reportedBy,
        });
        const description = markdownToAdf(body, (path) => {
          const id = idByName.get(path);
          // Jira ADF media for an issue attachment needs `collection` present
          // (empty string for issue-attached files); without it the image won't render inline.
          return id ? { id, collection: "" } : null;
        });
        await this.api("PUT", `/rest/api/3/issue/${created.id}`, { fields: { description } });
      } catch {
        // inline embed failed — attachments remain on the issue
      }
    }
    onProgress?.(1);

    return {
      identifier: created.key,
      url: `${this.baseUrl()}/browse/${created.key}`,
    };
  }

  /**
   * Create the issue, retrying without optional fields the project doesn't
   * support: many projects hide `priority` from the create screen, and
   * team-managed ones may have no "Bug" type. Either used to fail the whole submit.
   */
  private async createIssue(fields: Record<string, unknown>): Promise<{ id: string; key: string }> {
    let attempt = fields;
    // Each retry drops `priority` or swaps Bug → Task, so this ends after at most two retries.
    for (;;) {
      try {
        return await this.api<{ id: string; key: string }>("POST", "/rest/api/3/issue", {
          fields: attempt,
        });
      } catch (error) {
        if (!(error instanceof JiraApiError) || error.status !== 400) throw error;
        const rejected = error.body?.errors ?? {};
        const next = { ...attempt };
        if ("priority" in rejected && "priority" in next) {
          delete next.priority;
        } else if ("issuetype" in rejected && (next.issuetype as { name?: string }).name === "Bug") {
          next.issuetype = { name: "Task" };
        } else {
          throw error;
        }
        attempt = next;
      }
    }
  }

  private baseUrl(): string {
    return `https://${this.site}.atlassian.net`;
  }

  private authHeader(): string {
    // btoa only takes Latin-1; encode as UTF-8 first so non-ASCII emails work.
    const bytes = new TextEncoder().encode(`${this.creds.email.trim()}:${this.creds.apiToken.trim()}`);
    return `Basic ${btoa(String.fromCharCode(...bytes))}`;
  }

  /** Upload a file to the issue and return its attachment id (for inline embedding). */
  private async attach(
    issueId: string,
    attachment: SubmissionContext["attachments"][number],
  ): Promise<string | null> {
    const form = new FormData();
    form.append("file", attachment.data, attachment.filename);
    // Serialize the multipart body so it can travel through any transport; the
    // boundary lives in the generated Content-Type.
    const encoded = new Response(form);
    const res = await this.send({
      url: `${this.baseUrl()}/rest/api/3/issue/${issueId}/attachments`,
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "X-Atlassian-Token": "no-check",
        "Content-Type": encoded.headers.get("content-type") ?? "multipart/form-data",
      },
      body: await encoded.blob(),
    });
    return parseJson<{ id: string }[]>(res)?.[0]?.id ?? null;
  }

  private async api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.send({
      url: `${this.baseUrl()}${path}`,
      method,
      headers: {
        Authorization: this.authHeader(),
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? new Blob([JSON.stringify(body)], { type: "application/json" }) : undefined,
    });
    // Some endpoints (e.g. issue update) return 204 No Content.
    if (!res.bodyText) return undefined as T;
    const parsed = parseJson<T>(res);
    if (parsed === undefined) {
      throw new TicketProviderError(this.id, "Jira sent back an unexpected reply. Try again.");
    }
    return parsed;
  }

  /** Make the call; throw a descriptive error for transport failures and non-2xx replies. */
  private async send(request: Parameters<HttpTransport>[0]): Promise<HttpResult> {
    let res: HttpResult;
    try {
      res = await this.http(request);
    } catch (cause) {
      // Without the extension this is a direct browser call, which Jira Cloud
      // usually blocks (a bare network error).
      throw new TicketProviderError(
        this.id,
        "Couldn't reach Jira — check the site name in Settings, and that the Repruvia extension is installed and enabled.",
        cause,
      );
    }
    if (res.status < 200 || res.status >= 300) {
      throw new JiraApiError(res.status, parseJson<JiraErrorBody>(res) ?? null);
    }
    return res;
  }
}

/** Single-line, length-capped issue summary. */
function toSummary(title: string): string {
  const line = title.replace(/\s+/g, " ").trim() || "Bug report";
  return line.length > SUMMARY_MAX ? `${line.slice(0, SUMMARY_MAX - 1)}…` : line;
}
