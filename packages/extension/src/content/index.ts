import type { CaptureMessage, PageMessage } from "@repruvia/shared";
import { DomEventObserver } from "./dom/domEventObserver.js";

/**
 * ISOLATED-world content script. Responsibilities:
 *  1. Capture DOM interactions (only while a recording is active) and forward
 *     them to the service worker.
 *  2. Relay page-context signals (console/network) posted by the MAIN-world
 *     in-page script, which cannot talk to `chrome.runtime` directly.
 *
 * The service worker tells us when to start/stop via `TOGGLE_CAPTURE`.
 */

type ToggleMessage = { type: "TOGGLE_CAPTURE"; active: boolean };

function send(message: CaptureMessage): void {
  // Fire-and-forget; ignore "no receiver" errors when the SW is asleep.
  chrome.runtime.sendMessage(message).catch(() => {});
}

const observer = new DomEventObserver((event) => send({ type: "CAPTURE_EVENT", event }));

chrome.runtime.onMessage.addListener((message: ToggleMessage) => {
  if (message?.type !== "TOGGLE_CAPTURE") return;
  if (message.active) observer.start();
  else observer.stop();
});

// Relay MAIN-world page signals to the service worker.
window.addEventListener("message", (event: MessageEvent<PageMessage>) => {
  const data = event.data;
  if (event.source !== window || data?.source !== "repruvia") return;

  if (data.kind === "console") {
    send({
      type: "CAPTURE_CONSOLE",
      entry: { level: data.level, message: data.message, timestamp: data.timestamp },
    });
  } else if (data.kind === "network") {
    send({
      type: "CAPTURE_NETWORK",
      failure: {
        url: data.url,
        method: data.method,
        status: data.status,
        timestamp: data.timestamp,
      },
    });
  } else if (data.kind === "react" && data.info) {
    send({ type: "CAPTURE_REACT", xpath: data.xpath, info: data.info, timestamp: Date.now() });
  }
});

// Ask the SW whether a recording is already in progress (e.g. after SPA nav).
chrome.runtime.sendMessage({ type: "GET_RECORDING_STATE" }).then(
  (state?: { state: string }) => {
    if (state?.state === "recording") observer.start();
  },
  () => {},
);
