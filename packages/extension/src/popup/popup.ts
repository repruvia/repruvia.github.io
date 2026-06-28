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
}

toggleButton.addEventListener("click", async () => {
  toggleButton.disabled = true;
  const current = await send({ type: "GET_RECORDING_STATE" });
  const next = await send(
    current.state === "recording" ? { type: "STOP_RECORDING" } : { type: "START_RECORDING" },
  );
  render(next);
  toggleButton.disabled = false;
  // Closing on stop lets the freshly opened report tab take focus.
  if (current.state === "recording") window.close();
});

snipButton.addEventListener("click", async () => {
  snipButton.disabled = true;
  const result = await send<SnapshotStartResult>({ type: "START_SNAPSHOT" });
  if (result?.ok) {
    // Close the popup so the in-page selection overlay is unobstructed.
    window.close();
  } else {
    statusEl.textContent = result?.error ?? "Couldn't start snip.";
    statusEl.dataset.state = "recording"; // reuse the attention color for errors
    snipButton.disabled = false;
  }
});

// Live updates while the popup stays open.
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: RecordingStatePayload }) => {
    if (message?.type === "STATE_CHANGED" && message.payload) render(message.payload);
  },
);

void send({ type: "GET_RECORDING_STATE" }).then(render);
