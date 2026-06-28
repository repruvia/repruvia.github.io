import {
  exportReportToMarkdown,
  severityToLinearPriority,
  TicketProviderError,
  type ProviderContainer,
  type SubmissionContext,
  type SubmissionResult,
  type TicketProvider,
} from "@repruvia/shared";
import { screenshotAttachmentName } from "@/lib/reportAttachments";
import { extensionBridge } from "@/lib/extensionBridge";

const LINEAR_API = "https://api.linear.app/graphql";

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

  constructor(private token: string) {}

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
      `query { teams { nodes { id name } } }`,
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
    for (const attachment of attachments) {
      try {
        assetByName.set(attachment.filename, await this.uploadFile(attachment));
      } catch (err) {
        // Surface why so a systematic failure (CORS, bad signed URL) is diagnosable, not silent.
        console.error(`[repruvia] Linear screenshot upload failed for ${attachment.filename}:`, err);
      }
      uploaded += 1;
      onProgress?.(uploaded / (attachments.length + 1));
    }
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
          title: report.meta.title || "Bug report",
          description,
          priority: severityToLinearPriority(report.meta.severity),
        },
      },
    );

    if (!created.issueCreate.success) {
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
      throw new TicketProviderError(this.id, "Linear fileUpload mutation was rejected.");
    }
    const { uploadUrl, assetUrl, headers } = upload.fileUpload.uploadFile;
    // PUT to Linear storage is CORS-blocked from a web-app origin, so route it
    // through the extension service worker (CORS-free via host_permissions).
    let res: { status: number; bodyText: string };
    try {
      res = await extensionBridge.proxyFetch({
        url: uploadUrl,
        method: "PUT",
        headers: Object.fromEntries(headers.map((h) => [h.key, h.value])),
        body: attachment.data,
      });
    } catch (cause) {
      throw new TicketProviderError(this.id, "Screenshot upload failed (extension proxy).", cause);
    }
    if (res.status < 200 || res.status >= 300) {
      throw new TicketProviderError(
        this.id,
        `Screenshot upload failed (${res.status}). ${res.bodyText.slice(0, 200)}`,
      );
    }
    return assetUrl;
  }

  private async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(LINEAR_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: this.token },
        body: JSON.stringify({ query, variables }),
      });
    } catch (cause) {
      throw new TicketProviderError(this.id, "Network error talking to Linear.", cause);
    }

    const body = (await res.json()) as GraphQLResponse<T>;
    if (body.errors?.length) {
      throw new TicketProviderError(this.id, body.errors.map((e) => e.message).join("; "));
    }
    if (!body.data) throw new TicketProviderError(this.id, "Empty response from Linear.");
    return body.data;
  }
}
