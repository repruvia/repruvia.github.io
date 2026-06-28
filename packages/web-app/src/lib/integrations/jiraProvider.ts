import {
  exportReportToMarkdown,
  severityToJiraPriority,
  TicketProviderError,
  type ProviderContainer,
  type SubmissionContext,
  type SubmissionResult,
  type TicketProvider,
} from "@repruvia/shared";
import { screenshotAttachmentName } from "@/lib/reportAttachments";
import { markdownToAdf } from "./markdownToAdf.js";

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
export class JiraProvider implements TicketProvider {
  readonly id = "jira";
  readonly displayName = "Jira";

  constructor(private readonly creds: JiraCredentials) {}

  isAuthenticated(): boolean {
    return Boolean(this.creds.site && this.creds.email && this.creds.apiToken);
  }

  async authenticate(): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new TicketProviderError(this.id, "Add Jira site, email, and API token in Settings.");
    }
  }

  async listContainers(): Promise<ProviderContainer[]> {
    const data = await this.api<{ values: { id: string; key: string; name: string }[] }>(
      "GET",
      "/rest/api/3/project/search",
    );
    // containerId carries the project key, which issue creation requires.
    return data.values.map((p) => ({ id: p.key, name: `${p.name} (${p.key})` }));
  }

  async submit(context: SubmissionContext): Promise<SubmissionResult> {
    const { report, markdownBody, reportedBy, target, attachments, onProgress } = context;

    // Jira attachments need an existing issue, so create it text-only first.
    const created = await this.api<{ id: string; key: string }>("POST", "/rest/api/3/issue", {
      fields: {
        project: { key: target.containerId },
        summary: report.meta.title || "Bug report",
        description: markdownToAdf(markdownBody),
        issuetype: { name: "Bug" },
        priority: { name: severityToJiraPriority(report.meta.severity) },
      },
    });

    // Upload screenshots, capturing each attachment id for inline embedding.
    // Best-effort: a failed upload just won't appear inline.
    const idByName = new Map<string, string>();
    let done = 0;
    for (const attachment of attachments) {
      try {
        const id = await this.attach(created.id, attachment);
        if (id) idByName.set(attachment.filename, id);
      } catch {
        // best-effort
      }
      done += 1;
      onProgress?.(done / (attachments.length + 1));
    }

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
      url: `https://${this.creds.site}.atlassian.net/browse/${created.key}`,
    };
  }

  private authHeader(): string {
    return `Basic ${btoa(`${this.creds.email}:${this.creds.apiToken}`)}`;
  }

  /** Upload a file to the issue and return its attachment id (for inline embedding). */
  private async attach(
    issueId: string,
    attachment: SubmissionContext["attachments"][number],
  ): Promise<string | null> {
    const form = new FormData();
    form.append("file", attachment.data, attachment.filename);
    const res = await fetch(
      `https://${this.creds.site}.atlassian.net/rest/api/3/issue/${issueId}/attachments`,
      {
        method: "POST",
        headers: { Authorization: this.authHeader(), "X-Atlassian-Token": "no-check" },
        body: form,
      },
    );
    if (!res.ok) throw new TicketProviderError(this.id, `Attachment upload failed (${res.status}).`);
    const created = (await res.json()) as { id: string }[];
    return created[0]?.id ?? null;
  }

  private async api<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`https://${this.creds.site}.atlassian.net${path}`, {
        method,
        headers: {
          Authorization: this.authHeader(),
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      throw new TicketProviderError(this.id, "Network error talking to Jira.", cause);
    }

    if (!res.ok) {
      throw new TicketProviderError(this.id, `Jira responded ${res.status}.`);
    }
    // Some endpoints (e.g. issue update) return 204 No Content.
    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return undefined as T;
    }
    return (await res.json()) as T;
  }
}
