import type {
  ControlMessage,
  RecordingStatePayload,
  SnapshotStartResult,
} from "@repruvia/shared";

/**
 * Popup controller. Thin view layer: it renders recording state and forwards
 * start/stop/snip intents to the service worker, which owns all the logic.
 */

const toggleButton = document.getElementById("toggle") as HTMLButtonElement;
const snipButton = document.getElementById("snip") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const statsEl = document.getElementById("stats") as HTMLDivElement;
const stepCountEl = document.getElementById("step-count") as HTMLSpanElement;

function send<T = RecordingStatePayload>(message: ControlMessage): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

function render(state: RecordingStatePayload): void {
  const recording = state.state === "recording";
  statusEl.dataset.state = state.state;
  statusEl.textContent = recording ? "Recording…" : "Ready to record";

  toggleButton.textContent = recording ? "Stop Recording" : "Start Recording";
  toggleButton.classList.toggle("popup__button--start", !recording);
  toggleButton.classList.toggle("popup__button--stop", recording);

  // Snipping mid-recording would capture the wrong intent; hide it while recording.
  snipButton.hidden = recording;

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

// Live updates while the popup stays open.
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: RecordingStatePayload }) => {
    if (message?.type === "STATE_CHANGED" && message.payload) render(message.payload);
  },
);

send({ type: "GET_RECORDING_STATE" }).then(render, () => {
  showError("Couldn't reach Repruvia. Try reopening this popup.");
});
