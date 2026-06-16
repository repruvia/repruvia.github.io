import {
  ALLOWED_WEB_APP_ORIGINS,
  SESSION_TTL_MS,
  toSessionSummary,
  type CaptureMessage,
  type ControlMessage,
  type ExternalRequest,
  type ExternalResponse,
} from "@repruvia/shared";
import { IndexedDbSessionRepository } from "../storage/indexedDb.js";
import { RecordingController } from "./recordingController.js";

const sessions = new IndexedDbSessionRepository();
const controller = new RecordingController(sessions);

// ---- Internal messages: popup control + content capture ----

type InternalMessage = ControlMessage | CaptureMessage;

chrome.runtime.onMessage.addListener((message: InternalMessage, _sender, sendResponse) => {
  switch (message.type) {
    case "START_RECORDING":
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab) controller.start(tab).then(sendResponse);
        else sendResponse(controller.getState());
      });
      return true;

    case "STOP_RECORDING":
      controller.stop().then(sendResponse);
      return true;

    case "GET_RECORDING_STATE":
      sendResponse(controller.getState());
      return false;

    case "CAPTURE_EVENT":
    case "CAPTURE_CONSOLE":
    case "CAPTURE_NETWORK":
    case "CAPTURE_REACT":
      controller.handleCapture(message);
      return false;

    default:
      return false;
  }
});

// ---- External messages: the Repruvia web app requests session data ----

function isAllowedOrigin(origin: string | undefined): boolean {
  return !!origin && (ALLOWED_WEB_APP_ORIGINS as readonly string[]).includes(origin);
}

chrome.runtime.onMessageExternal.addListener(
  (request: ExternalRequest, sender, sendResponse: (r: ExternalResponse) => void) => {
    if (!isAllowedOrigin(sender.origin)) {
      sendResponse({ ok: false, error: "Origin not allowed" });
      return false;
    }

    switch (request.type) {
      case "GET_SESSION":
        sessions
          .get(request.sessionId)
          .then((session) => sendResponse({ ok: true, type: "GET_SESSION", session }))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;

      case "LIST_SESSIONS":
        sessions
          .list()
          .then((list) =>
            sendResponse({ ok: true, type: "LIST_SESSIONS", sessions: list.map(toSessionSummary) }),
          )
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;

      case "DELETE_SESSION":
        sessions
          .delete(request.sessionId)
          .then(() => sendResponse({ ok: true, type: "DELETE_SESSION" }))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;

      default:
        sendResponse({ ok: false, error: "Unknown request" });
        return false;
    }
  },
);

// ---- Maintenance: prune stale sessions on startup/install ----

function prune(): void {
  void sessions.pruneOlderThan(SESSION_TTL_MS);
}

chrome.runtime.onInstalled.addListener(prune);
chrome.runtime.onStartup.addListener(prune);
