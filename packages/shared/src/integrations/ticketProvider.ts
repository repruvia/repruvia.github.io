import type { Report } from "../types/domain.js";

/** A screenshot or video to attach to a created ticket. */
export interface ReportAttachment {
  filename: string;
  mimeType: string;
  /** Raw bytes (video) or decoded image bytes (screenshots). */
  data: Blob;
}

export interface SubmissionTarget {
  /** Linear team id / Jira project key, etc. */
  containerId: string;
}

export interface SubmissionResult {
  /** Provider-native identifier, e.g. "ENG-123". */
  identifier: string;
  /** Web URL of the created issue. */
  url: string;
}

export interface SubmissionContext {
  report: Report;
  /** Pre-rendered Markdown body (providers may transform it further). */
  markdownBody: string;
  /** Reporter display name, for providers that re-render the body themselves. */
  reportedBy?: string;
  attachments: ReportAttachment[];
  target: SubmissionTarget;
  /** Progress callback (0–1) for long uploads. */
  onProgress?: (fraction: number) => void;
}

/** A selectable container the user submits into (team/project). */
export interface ProviderContainer {
  id: string;
  name: string;
}

/**
 * Contract every ticket integration implements. The submission UI depends only
 * on this interface (Dependency Inversion); adding a provider means adding a
 * class, never editing the consumer (Open/Closed).
 */
export interface TicketProvider {
  readonly id: string;
  readonly displayName: string;

  /** True once the provider has a usable credential. */
  isAuthenticated(): boolean;

  /** Begin/refresh auth. Resolves when a usable credential is available. */
  authenticate(): Promise<void>;

  /** List the teams/projects the authenticated user can create issues in. */
  listContainers(): Promise<ProviderContainer[]>;

  /** Create the issue and attach files. */
  submit(context: SubmissionContext): Promise<SubmissionResult>;
}

/** Thrown for provider-level failures so the UI can show actionable messages. */
export class TicketProviderError extends Error {
  constructor(
    public readonly providerId: string,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TicketProviderError";
  }
}
