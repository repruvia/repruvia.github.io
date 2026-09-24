import {
  exportReportToMarkdown,
  mapWithConcurrency,
  severityToLinearPriority,
  TicketProviderError,
  type ProviderContainer,
  type SubmissionContext,
  type SubmissionResult,
  type TicketProvider,
} from "@repruvia/shared";
import { screenshotAttachmentName } from "@/lib/reportAttachments";
import {
  browserTransport,
  extensionTransport,
  parseJson,
  ticketTransport,
  type HttpResult,
  type HttpTransport,
} from "./transport";

const LINEAR_API = "https://api.linear.app/graphql";
/** Linear rejects issue titles longer than this. */
const TITLE_MAX = 255;
const UPLOAD_CONCURRENCY = 3;

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

/**
 * Linear integration via the GraphQL API using a personal API key. OAuth can be
 * layered in later behind this same interface without touching the UI — the key
 * just becomes the resulting access token (Open/Closed).
 */
export class LinearProvider implements TicketProvider {
  readonly id = "linear";
  readonly displayName = "Linear";

  /**
   * Both routes go through the extension (CORS-free). `api` carries GraphQL
   * calls, falling back to a direct browser fetch when the extension isn't
   * reachable — Linear allows browser CORS there. `uploads` carries the PUT to
   * Linear's signed storage URL, which is CORS-blocked from pages and so has
   * no browser fallback.
   */
  constructor(
    private token: string,
    private readonly api: HttpTransport = ticketTransport(browserTransport),
    private readonly uploads: HttpTransport = extensionTransport,
  ) {}

  isAuthenticated(): boolean {
    return this.token.trim().length > 0;
  }

  async authenticate(): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new TicketProviderError(this.id, "Add a Linear API key in Settings first.");
    }
  }

  async listContainers(): Promise<ProviderContainer[]> {
    const data = await this.query<{ teams: { nodes: ProviderContainer[] } }>(
      `query { teams(first: 250) { nodes { id name } } }`,
    );
    return data.teams.nodes;
  }

  async submit(context: SubmissionContext): Promise<SubmissionResult> {
    const { report, markdownBody, reportedBy, target, attachments, onProgress } = context;

    // Upload screenshots first so they can be embedded inline in the description
    // (Linear renders uploaded asset URLs as images; a bare attachment does not).
    // Best-effort: a failed upload just drops that one image, not the issue.
    const assetByName = new Map<string, string>();
    let uploaded = 0;
    await mapWithConcurrency(attachments, UPLOAD_CONCURRENCY, async (attachment) => {
      try {
        assetByName.set(attachment.filename, await this.uploadFile(attachment));
      } catch (err) {
        // Surface why so a systematic failure (CORS, bad signed URL) is diagnosable, not silent.
        console.error(`[repruvia] Linear screenshot upload failed for ${attachment.filename}:`, err);
      }
      uploaded += 1;
      onProgress?.(uploaded / (attachments.length + 1));
    });
    if (attachments.length > 0 && assetByName.size === 0) {
      console.warn(
        "[repruvia] No screenshots uploaded to Linear — the issue will have no inline images. See the error(s) above.",
      );
    }

    // Re-render with uploaded URLs inline; fall back to the image-less body if nothing uploaded.
    const description = assetByName.size
      ? exportReportToMarkdown(report, {
          screenshots: "link",
          screenshotPath: (step) => assetByName.get(screenshotAttachmentName(step.index)) ?? "",
          reportedBy,
        })
      : markdownBody;

    const created = await this.query<{
      issueCreate: { success: boolean; issue: { id: string; url: string; identifier: string } };
    }>(
      `mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) { success issue { id url identifier } }
      }`,
      {
        input: {
          teamId: target.containerId,
          title: toTitle(report.meta.title),
          description,
          priority: severityToLinearPriority(report.meta.severity),
        },
      },
    );

    if (!created.issueCreate?.success || !created.issueCreate.issue) {
      throw new TicketProviderError(this.id, "Linear rejected the issue.");
    }
    const issue = created.issueCreate.issue;
    onProgress?.(1);

    return { identifier: issue.identifier, url: issue.url };
  }

  /** Upload a file to Linear's storage and return its inline-renderable asset URL. */
  private async uploadFile(
    attachment: SubmissionContext["attachments"][number],
  ): Promise<string> {
    const upload = await this.query<{
      fileUpload: {
        success: boolean;
        uploadFile: { uploadUrl: string; assetUrl: string; headers: { key: string; value: string }[] };
      };
    }>(
      `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
        fileUpload(contentType: $contentType, filename: $filename, size: $size) {
          success
          uploadFile { uploadUrl assetUrl headers { key value } }
        }
      }`,
      {
        contentType: attachment.mimeType,
        filename: attachment.filename,
        size: attachment.data.size,
      },
    );

    if (!upload.fileUpload?.success || !upload.fileUpload.uploadFile) {
      throw new TicketProviderError(this.id, "Linear wouldn't accept the screenshot upload.");
    }
    const { uploadUrl, assetUrl, headers } = upload.fileUpload.uploadFile;
    let res: HttpResult;
    try {
      res = await this.uploads({
        url: uploadUrl,
        method: "PUT",
        headers: {
          "Content-Type": attachment.mimeType,
          ...Object.fromEntries(headers.map((h) => [h.key, h.value])),
        },
        body: attachment.data,
      });
    } catch (cause) {
      throw new TicketProviderError(this.id, "Couldn't upload a screenshot to Linear.", cause);
    }
    if (res.status < 200 || res.status >= 300) {
      throw new TicketProviderError(
        this.id,
        "Couldn't upload a screenshot to Linear.",
        `${res.status} ${res.bodyText.slice(0, 200)}`,
      );
    }
    return assetUrl;
  }

  private async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    let res: HttpResult;
    try {
      res = await this.api({
        url: LINEAR_API,
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: this.token },
        body: new Blob([JSON.stringify({ query, variables })], { type: "application/json" }),
      });
    } catch (cause) {
      throw new TicketProviderError(
        this.id,
        "Couldn't reach Linear. Check your connection and try again.",
        cause,
      );
    }

    if (res.status === 401) {
      throw new TicketProviderError(this.id, "Linear rejected your API key. Check it in Settings.");
    }
    // Gateway/rate-limit pages come back as HTML, not GraphQL JSON.
    const body = parseJson<GraphQLResponse<T>>(res);
    if (!body) {
      throw new TicketProviderError(
        this.id,
        "Linear sent back an unexpected reply. Try again.",
        `${res.status} ${res.bodyText.slice(0, 200)}`,
      );
    }
    if (body.errors?.length) {
      throw new TicketProviderError(
        this.id,
        "Linear turned that request down. Check your API key and team, then try again.",
        body.errors.map((e) => e.message).join("; "),
      );
    }
    if (!body.data) {
      throw new TicketProviderError(this.id, "Linear sent back an empty reply. Try again.");
    }
    return body.data;
  }
}

/** Single-line, length-capped issue title. */
function toTitle(title: string): string {
  const line = title.replace(/\s+/g, " ").trim() || "Bug report";
  return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1)}…` : line;
}
