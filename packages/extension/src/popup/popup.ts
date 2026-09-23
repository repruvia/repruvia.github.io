import {
  isNeverRecordablePage,
  resolvePopupView,
  type ControlMessage,
  type RecordingStatePayload,
  type SnapshotStartResult,
  type TabCommand,
  type TabCommandAck,
} from "@repruvia/shared";

/**
 * Popup controller. Thin view layer: it renders recording state and forwards
 * start/stop/snip intents to the service worker, which owns all the logic.
 *
 * It also probes the active tab for a reachable content script before
 * showing the recording controls — see `resolveAvailability`. Pages loaded
 * before the extension was installed/reloaded (or pages Chrome never injects
 * scripts into at all) get a notice instead of buttons that would silently
 * do nothing.
 */

const toggleButton = document.getElementById("toggle") as HTMLButtonElement;
const snipButton = document.getElementById("snip") as HTMLButtonElement;
const actionsEl = document.getElementById("actions") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const statsEl = document.getElementById("stats") as HTMLDivElement;
const stepCountEl = document.getElementById("step-count") as HTMLSpanElement;
const noticeEl = document.getElementById("page-notice") as HTMLDivElement;
const noticeTextEl = document.getElementById("page-notice-text") as HTMLParagraphElement;
const noticeReloadButton = document.getElementById("page-notice-reload") as HTMLButtonElement;

function send<T = RecordingStatePayload>(message: ControlMessage): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Whether the active tab's page can ever be recorded, and if not, why. Same
 * `kind` values as the shared `PopupAvailability` (which drives what to
 * render — see `resolvePopupView`), plus the one extra field the popup
 * itself needs: which tab to reload.
 */
type Availability =
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "reload"; tabId: number }
  | { kind: "restricted" };

let availability: Availability = { kind: "checking" };

/** Send a `TabCommand` straight to a tab, the same channel the service worker uses. */
function sendTabCommand(tabId: number, command: TabCommand): Promise<TabCommandAck> {
  return chrome.tabs.sendMessage(tabId, command);
}

/** True when a content script answers a no-op ping in this tab. */
async function probeContentScript(tabId: number): Promise<boolean> {
  try {
    await sendTabCommand(tabId, { type: "PING" });
    return true;
  } catch {
    return false;
  }
}

/** Classify the active tab: never-recordable, reachable, or needs a reload. */
async function resolveAvailability(): Promise<Availability> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return { kind: "restricted" };

  const fileAccessAllowed = await chrome.extension.isAllowedFileSchemeAccess().catch(() => false);
  if (isNeverRecordablePage(tab.url, { fileAccessAllowed })) return { kind: "restricted" };

  const reachable = await probeContentScript(tab.id);
  return reachable ? { kind: "ready" } : { kind: "reload", tabId: tab.id };
}

/**
 * Sets the notice's message. Its visibility is derived from whether there is
 * one — never set independently — so no code path can leave a visible,
 * empty notice box on screen.
 */
function setNotice(text: string | null): void {
  noticeTextEl.textContent = text ?? "";
  noticeEl.hidden = text === null;
}

function render(state: RecordingStatePayload): void {
  const recording = state.state === "recording";
  const view = resolvePopupView(recording, availability);

  statusEl.hidden = view.statusText === null;
  if (view.statusText !== null) {
    statusEl.textContent = view.statusText;
    statusEl.dataset.state = view.statusState;
  }

  setNotice(view.noticeText);
  noticeReloadButton.hidden = !view.noticeReloadVisible;

  // Every control inside #actions is gated behind actionsVisible: a control
  // whose action can't succeed right now is never left on screen, and the
  // wrapper itself collapses (no stray border/padding) when nothing in it can run.
  actionsEl.hidden = !view.actionsVisible;
  if (view.actionsVisible) {
    toggleButton.textContent = recording ? "Stop Recording" : "Start Recording";
    toggleButton.classList.toggle("popup__button--start", !recording);
    toggleButton.classList.toggle("popup__button--stop", recording);
    // Snipping mid-recording would capture the wrong intent; hide it while recording.
    snipButton.hidden = !view.snipVisible;
  }

  statsEl.hidden = !recording;
  stepCountEl.textContent = String(state.stepCount);

  if (state.error) showError(state.error);
}

function showError(message: string): void {
  statusEl.textContent = message;
  statusEl.dataset.state = "recording"; // reuse the attention color for errors
}

toggleButton.addEventListener("click", async () => {
  toggleButton.disabled = true;
  try {
    const current = await send({ type: "GET_RECORDING_STATE" });
    const stopping = current.state === "recording";
    const next = await send(stopping ? { type: "STOP_RECORDING" } : { type: "START_RECORDING" });
    render(next);
    // Closing on a clean stop lets the freshly opened report tab take focus.
    if (stopping && !next.error) window.close();
  } catch {
    showError("Couldn't reach Repruvia. Try reopening this popup.");
  } finally {
    toggleButton.disabled = false;
  }
});

snipButton.addEventListener("click", async () => {
  snipButton.disabled = true;
  try {
    const result = await send<SnapshotStartResult>({ type: "START_SNAPSHOT" });
    if (result?.ok) {
      // Close the popup so the in-page selection overlay is unobstructed.
      window.close();
      return;
    }
    showError(result?.error ?? "Couldn't start snip.");
  } catch {
    showError("Couldn't start snip.");
  }
  snipButton.disabled = false;
});

noticeReloadButton.addEventListener("click", () => {
  if (availability.kind !== "reload") return;
  noticeReloadButton.disabled = true;
  void chrome.tabs.reload(availability.tabId).finally(() => window.close());
});

// Live updates while the popup stays open.
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: RecordingStatePayload }) => {
    if (message?.type === "STATE_CHANGED" && message.payload) render(message.payload);
  },
);

// Don't flash buttons and yank them away: render the "checking" view (status
// line only, no actions, no notice) until the reachability probe and the
// recording state both land. Derived from the same view model as `render()`
// so this can't drift from it.
const initialView = resolvePopupView(false, availability);
statusEl.hidden = initialView.statusText === null;
if (initialView.statusText !== null) {
  statusEl.textContent = initialView.statusText;
  statusEl.dataset.state = initialView.statusState;
}
setNotice(initialView.noticeText);
noticeReloadButton.hidden = !initialView.noticeReloadVisible;
actionsEl.hidden = !initialView.actionsVisible;

void (async () => {
  const [state] = await Promise.all([
    send({ type: "GET_RECORDING_STATE" }).catch(() => null),
    resolveAvailability().then((result) => {
      availability = result;
    }),
  ]);

  if (!state) {
    showError("Couldn't reach Repruvia. Try reopening this popup.");
    return;
  }
  render(state);
})();
