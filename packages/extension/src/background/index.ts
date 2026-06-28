import {
  ALLOWED_WEB_APP_ORIGINS,
  isProxyFetchAllowed,
  SESSION_TTL_MS,
  SNAPSHOT_TTL_MS,
  toSessionSummary,
  toSnapshotSummary,
  type CaptureMessage,
  type ControlMessage,
  type ExternalRequest,
  type ExternalResponse,
  type SnapshotMessage,
} from "@repruvia/shared";
import { IndexedDbSessionRepository, IndexedDbSnapshotRepository } from "../storage/indexedDb.js";
import { RecordingController } from "./recordingController.js";
import { SnapshotController } from "./snapshotController.js";

const sessions = new IndexedDbSessionRepository();
const controller = new RecordingController(sessions);
const snapshots = new IndexedDbSnapshotRepository();
const snapshotController = new SnapshotController(snapshots);

// Internal messages: popup control + content capture + snip.
type InternalMessage = ControlMessage | CaptureMessage | SnapshotMessage;

chrome.runtime.onMessage.addListener((message: InternalMessage, sender, sendResponse) => {
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

    case "START_SNAPSHOT":
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab) snapshotController.begin(tab).then(sendResponse);
        else sendResponse({ ok: false, error: "No active tab." });
      });
      return true;

    case "CAPTURE_REGION":
    case "CANCEL_SNAPSHOT":
      void snapshotController.handle(message, sender);
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

// External messages: the web app requests session/snapshot data.
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

      case "GET_SNAPSHOT":
        snapshots
          .get(request.snapshotId)
          .then((snapshot) => sendResponse({ ok: true, type: "GET_SNAPSHOT", snapshot }))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;

      case "LIST_SNAPSHOTS":
        snapshots
          .list()
          .then((list) =>
            sendResponse({ ok: true, type: "LIST_SNAPSHOTS", snapshots: list.map(toSnapshotSummary) }),
          )
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;

      case "DELETE_SNAPSHOT":
        snapshots
          .delete(request.snapshotId)
          .then(() => sendResponse({ ok: true, type: "DELETE_SNAPSHOT" }))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;

      case "PROXY_FETCH":
        proxyFetch(request)
          .then(sendResponse)
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;

      default:
        sendResponse({ ok: false, error: "Unknown request" });
        return false;
    }
  },
);

/**
 * Perform a cross-origin request from the service worker (CORS-free thanks to
 * `host_permissions`) on the web app's behalf. Restricted to ticket-provider
 * hosts so the page can't use the extension as an open proxy.
 */
async function proxyFetch(
  request: Extract<ExternalRequest, { type: "PROXY_FETCH" }>,
): Promise<ExternalResponse> {
  if (!isProxyFetchAllowed(request.url)) {
    let host = request.url;
    try {
      host = new URL(request.url).hostname;
    } catch {
      // keep the raw url in the message
    }
    return {
      ok: false,
      error: `Host not allowed by the extension proxy: ${host}. Reload the Repruvia extension if you just updated it.`,
    };
  }
  const body = request.bodyBase64 ? new Blob([base64ToBytes(request.bodyBase64)]) : undefined;
  const res = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });
  return {
    ok: true,
    type: "PROXY_FETCH",
    status: res.status,
    statusText: res.statusText,
    bodyText: await res.text().catch(() => ""),
  };
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Prune stale sessions/snapshots on startup/install.
function prune(): void {
  void sessions.pruneOlderThan(SESSION_TTL_MS);
  void snapshots.pruneOlderThan(SNAPSHOT_TTL_MS);
}

chrome.runtime.onInstalled.addListener(prune);
chrome.runtime.onStartup.addListener(prune);
