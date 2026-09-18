import type {
  CaptureMessage,
  PageMessage,
  RecordingStatePayload,
  TabCommand,
  TabCommandAck,
} from "@repruvia/shared";
import { DomEventObserver } from "./dom/domEventObserver.js";
import { beginSnapshotSelection, showSnapshotError } from "./snapshot/selectionOverlay.js";

/**
 * ISOLATED-world content script. Responsibilities:
 *  1. Capture DOM interactions (only while a recording is active) and forward
 *     them to the service worker.
 *  2. Relay page-context signals (console/network) posted by the MAIN-world
 *     in-page script, which cannot talk to `chrome.runtime` directly — again
 *     only while recording, so errors on every other open tab don't keep waking
 *     the service worker.
 *
 * The service worker tells us when to start/stop via `TOGGLE_CAPTURE`.
 */

function send(message: CaptureMessage): void {
  // Fire-and-forget; ignore "no receiver" errors when the SW is asleep.
  chrome.runtime.sendMessage(message).catch(() => {});
}

const observer = new DomEventObserver((event) => send({ type: "CAPTURE_EVENT", event }));

chrome.runtime.onMessage.addListener(
  (message: TabCommand, _sender, sendResponse: (ack: TabCommandAck) => void) => {
    // Always acknowledge: the service worker treats a rejected send as "no
    // content script here", and an unanswered message can reject too.
    switch (message?.type) {
      case "TOGGLE_CAPTURE":
        if (message.active) {
          observer.start();
          sendResponse({ ok: true });
        } else {
          // Hand back the debounced typing step so it's recorded before the
          // session is finalized (a separate message could arrive too late).
          sendResponse({ ok: true, pendingEvent: observer.stop() ?? undefined });
        }
        return false;
      case "BEGIN_SNAPSHOT":
        beginSnapshotSelection();
        sendResponse({ ok: true });
        return false;
      case "SNAPSHOT_FAILED":
        showSnapshotError(message.error);
        sendResponse({ ok: true });
        return false;
      default:
        return false;
    }
  },
);

// Relay MAIN-world page signals to the service worker.
window.addEventListener("message", (event: MessageEvent<PageMessage>) => {
  const data = event.data;
  if (event.source !== window || data?.source !== "repruvia") return;
  if (!observer.isActive) return;

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

// A full page load inside a recorded tab (link click, reload, form post) gets
// a fresh content script: ask whether this tab is being recorded and, if so,
// resume capture and log the landing page as a navigation step.
chrome.runtime.sendMessage({ type: "GET_RECORDING_STATE" }).then(
  (state?: RecordingStatePayload) => {
    if (state?.state === "recording") observer.start({ announcePage: true });
  },
  () => {},
);
