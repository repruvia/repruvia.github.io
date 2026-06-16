import type { ControlMessage, RecordingStatePayload } from "@repruvia/shared";

/**
 * Popup controller. Thin view layer: it renders recording state and forwards
 * start/stop intents to the service worker, which owns all recording logic.
 */

const toggleButton = document.getElementById("toggle") as HTMLButtonElement;
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

// Live updates while the popup stays open.
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: RecordingStatePayload }) => {
    if (message?.type === "STATE_CHANGED" && message.payload) render(message.payload);
  },
);

void send({ type: "GET_RECORDING_STATE" }).then(render);
