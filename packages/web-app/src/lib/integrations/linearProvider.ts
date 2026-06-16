import {
  severityToLinearPriority,
  TicketProviderError,
  type ProviderContainer,
  type SubmissionContext,
  type SubmissionResult,
  type TicketProvider,
} from "@repruvia/shared";

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
    const { report, markdownBody, target, attachments, onProgress } = context;

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
          description: markdownBody,
          priority: severityToLinearPriority(report.meta.severity),
        },
      },
    );

    if (!created.issueCreate.success) {
      throw new TicketProviderError(this.id, "Linear rejected the issue.");
    }
    const issue = created.issueCreate.issue;

    // Attach files best-effort; a failed upload should not lose the issue.
    let done = 0;
    for (const attachment of attachments) {
      try {
        await this.uploadAndAttach(issue.id, attachment);
      } catch {
        // swallow — issue already exists
      }
      done += 1;
      onProgress?.(done / Math.max(1, attachments.length));
    }

    return { identifier: issue.identifier, url: issue.url };
  }

  private async uploadAndAttach(
    issueId: string,
    attachment: SubmissionContext["attachments"][number],
  ): Promise<void> {
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

    const { uploadUrl, assetUrl, headers } = upload.fileUpload.uploadFile;
    await fetch(uploadUrl, {
      method: "PUT",
      headers: Object.fromEntries(headers.map((h) => [h.key, h.value])),
      body: attachment.data,
    });

    await this.query(
      `mutation Attach($input: AttachmentCreateInput!) { attachmentCreate(input: $input) { success } }`,
      { input: { issueId, title: attachment.filename, url: assetUrl } },
    );
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
