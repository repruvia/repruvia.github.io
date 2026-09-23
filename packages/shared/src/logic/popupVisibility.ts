/**
 * Pure view-model logic for the extension popup's recording/availability
 * guard. Centralizes which controls (status line, notice, action buttons)
 * can show for a given (recording, page availability) pair, so the popup's
 * DOM layer never decides visibility itself — it just renders whatever this
 * returns. That keeps every future availability state from being able to
 * produce a visible-but-empty notice or a dead action button: the notice is
 * only ever shown together with its message, and actions are only ever
 * shown together with something that can actually run.
 */

/** Whether the active tab's page can currently be recorded, and if not, why. */
export type PopupAvailability =
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "reload" }
  | { kind: "restricted" };

export interface PopupViewModel {
  /** Status line text, or null when the status line should stay hidden (the notice covers it instead). */
  statusText: string | null;
  /** `data-state` for the status line's color; only meaningful while `statusText` is set. */
  statusState: "idle" | "recording";
  /** Notice message, or null — callers must hide the notice element whenever this is null, never independently. */
  noticeText: string | null;
  /** Whether the notice's own "Reload Page" button can show; only meaningful while `noticeText` is set. */
  noticeReloadVisible: boolean;
  /** Whether the actions row (Start/Stop + Snip) can show at all. */
  actionsVisible: boolean;
  /** Whether "Snip Screenshot" specifically can show; only meaningful while `actionsVisible` is true. */
  snipVisible: boolean;
}

const RELOAD_MESSAGE = "Reload this page to record it.";
const RESTRICTED_MESSAGE = "Repruvia can't record this page. Open a normal page and try again.";

/**
 * Derives what the popup should show for a given recording state + page
 * availability.
 *
 * A recording already in progress always keeps its working Stop control —
 * stopping is handled by the service worker and always succeeds, regardless
 * of whether this tab's content-script probe came back negative. Everything
 * else (Start, Snip, the notice) is gated on the page actually being
 * recordable right now.
 */
export function resolvePopupView(
  recording: boolean,
  availability: PopupAvailability,
): PopupViewModel {
  if (recording || availability.kind === "ready") {
    return {
      statusText: recording ? "Recording…" : "Ready to record",
      statusState: recording ? "recording" : "idle",
      noticeText: null,
      noticeReloadVisible: false,
      actionsVisible: true,
      snipVisible: !recording,
    };
  }

  if (availability.kind === "checking") {
    return {
      statusText: "Checking this page…",
      statusState: "idle",
      noticeText: null,
      noticeReloadVisible: false,
      actionsVisible: false,
      snipVisible: false,
    };
  }

  return {
    statusText: null,
    statusState: "idle",
    noticeText: availability.kind === "reload" ? RELOAD_MESSAGE : RESTRICTED_MESSAGE,
    noticeReloadVisible: availability.kind === "reload",
    actionsVisible: false,
    snipVisible: false,
  };
}
