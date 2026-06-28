/**
 * Core domain model: the single source of truth shared by the extension
 * (producer) and web app (consumer/editor). No DOM/`chrome.*` concerns.
 */

export type DomEventType = "click" | "input" | "change" | "navigate";

export type ConsoleLevel = "error" | "warn";

export type Severity = "low" | "medium" | "high" | "critical";

/** A normalized, privacy-safe representation of a single DOM interaction. */
export interface DomEvent {
  type: DomEventType;
  tagName: string;
  id: string | null;
  className: string | null;
  /** Trimmed, max 80 chars. */
  textContent: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  /** Resolved from `<label for>` or `aria-labelledby`. */
  fieldLabel: string | null;
  /** For anchors. */
  href: string | null;
  /** For inputs/buttons. */
  inputType: string | null;
  xpath: string;
  /** URL path at the time of the event. */
  pathname: string;

  // --- Richer context (optional; improves generated + AI descriptions) ---
  /** ARIA role (explicit `role` attribute). */
  role?: string | null;
  /** `name` attribute (forms). */
  name?: string | null;
  /** `title` attribute / tooltip text. */
  title?: string | null;
  /** `alt` text (images / image buttons). */
  alt?: string | null;
  /** First test id found: data-testid / data-test / data-cy / data-qa. */
  testId?: string | null;
  /** Human-readable CSS selector (tag + id / testid / classes). */
  selector?: string | null;
  /** For checkbox/radio: whether it became checked. */
  checked?: boolean | null;
}

/** React component context resolved at interaction time. */
export interface ReactInfo {
  name: string;
  props: Record<string, string | number | boolean>;
}

/** A single captured step: an event + its screenshot + derived context. */
export interface Step {
  id: string;
  /** 1-based position; maintained as the source of ordering truth. */
  index: number;
  timestamp: number;
  event: DomEvent;
  /** base64 PNG data URL. */
  screenshot: string | null;
  reactComponent: ReactInfo | null;
  /** Generated deterministically from event metadata. */
  autoDescription: string;
  /** Tester override; `null` means "use autoDescription". */
  editedDescription: string | null;
}

export interface ConsoleEntry {
  id: string;
  level: ConsoleLevel;
  message: string;
  timestamp: number;
  /** Assigned during report assembly. */
  nearestStepId: string | null;
}

export interface NetworkFailure {
  id: string;
  url: string;
  method: string;
  status: number;
  timestamp: number;
  nearestStepId: string | null;
}

export interface Environment {
  url: string;
  browserName: string;
  browserVersion: string;
  os: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  userAgent: string;
  /** ISO 8601. */
  recordingStartTime: string;
}

/** The full captured session — JSON-serializable for the messaging channels. */
export interface RepruviaSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  tabUrl: string;
  environment: Environment;
  steps: Step[];
  consoleErrors: ConsoleEntry[];
  networkFailures: NetworkFailure[];
}

/**
 * Lightweight session descriptor for list views. Excludes steps/screenshots so
 * the recordings library doesn't transfer megabytes of base64 over the
 * extension messaging channel — the full session is fetched on open.
 */
export interface SessionSummary {
  id: string;
  startedAt: number;
  endedAt: number | null;
  tabUrl: string;
  stepCount: number;
  consoleErrorCount: number;
  networkFailureCount: number;
}

/**
 * A region screenshot captured with the "snip" tool. Like a session, this is the
 * immutable artifact the extension produces; the tester's annotations + title /
 * description live in the web app's own storage, keyed by this `id`.
 */
export interface Snapshot {
  id: string;
  createdAt: number;
  /** URL of the page the region was captured on. */
  tabUrl: string;
  /** base64 PNG data URL of the cropped region. */
  image: string;
  /** Cropped image dimensions in device pixels. */
  width: number;
  height: number;
}

/**
 * Lightweight snapshot descriptor for list views. Excludes the (potentially
 * large) base64 image so the library doesn't transfer it over the extension
 * messaging channel — the full snapshot is fetched on open.
 */
export interface SnapshotSummary {
  id: string;
  createdAt: number;
  tabUrl: string;
  width: number;
  height: number;
}

/** Tester-authored, presentation-level report metadata layered over a session. */
export interface ReportMeta {
  title: string;
  description: string;
  severity: Severity;
}

/** A session combined with tester edits, ready to render or export. */
export interface Report {
  session: RepruviaSession;
  meta: ReportMeta;
}
