import {
  ALLOWED_WEB_APP_ORIGINS,
  isProxyFetchAllowed,
  SESSION_TTL_MS,
  SNAPSHOT_TTL_MS,
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
      void activeTab()
        .then((tab) =>
          tab ? controller.start(tab) : { ...controller.getState(), error: "No active tab to record." },
        )
        .then(sendResponse);
      return true;

    case "STOP_RECORDING":
      void controller.stop().then(sendResponse);
      return true;

    case "GET_RECORDING_STATE":
      // The popup gets the full state. A content script asking on page load only
      // hears "recording" if it's in the recorded tab — other tabs stay idle.
      void controller.whenReady().then(() => {
        const state = controller.getState();
        sendResponse(
          sender.tab && !controller.isRecordingTab(sender.tab.id)
            ? { state: "idle", sessionId: null, stepCount: 0 }
            : state,
        );
      });
      return true;

    case "START_SNAPSHOT":
      void activeTab()
        .then((tab) =>
          tab ? snapshotController.begin(tab) : { ok: false, error: "No active tab." },
        )
        .then(sendResponse);
      return true;

    case "CAPTURE_REGION":
    case "CANCEL_SNAPSHOT":
      void snapshotController.handle(message, sender);
      return false;

    case "CAPTURE_EVENT":
    case "CAPTURE_CONSOLE":
    case "CAPTURE_NETWORK":
    case "CAPTURE_REACT": {
      // Content scripts are identified by their tab; the DevTools page (no tab)
      // names the inspected tab itself.
      const tabId =
        sender.tab?.id ?? (message.type === "CAPTURE_NETWORK" ? message.tabId : undefined);
      void controller.handleCapture(message, tabId);
      return false;
    }

    default:
      return false;
  }
});

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Recording lifecycle tied to the recorded tab.
chrome.tabs.onRemoved.addListener((tabId) => void controller.onTabRemoved(tabId));
chrome.tabs.onAttached.addListener(
  (tabId, info) => void controller.onTabAttached(tabId, info.newWindowId),
);

/**
 * Log the real failure for developers and hand the web app one plain sentence —
 * a raw error object must never reach the tester's screen.
 */
function failed(error: unknown, message: string): ExternalResponse {
  console.error("[repruvia]", message, error);
  return { ok: false, error: message };
}

// External messages: the web app requests session/snapshot data.
function isAllowedOrigin(origin: string | undefined): boolean {
  return !!origin && (ALLOWED_WEB_APP_ORIGINS as readonly string[]).includes(origin);
}

chrome.runtime.onMessageExternal.addListener(
  (request: ExternalRequest, sender, sendResponse: (r: ExternalResponse) => void) => {
    if (!isAllowedOrigin(sender.origin)) {
      sendResponse({ ok: false, error: "This site isn't allowed to use Repruvia." });
      return false;
    }

    switch (request.type) {
      case "GET_SESSION":
        sessions
          .get(request.sessionId)
          .then((session) => sendResponse({ ok: true, type: "GET_SESSION", session }))
          .catch((e) => sendResponse(failed(e, "Couldn't open that recording.")));
        return true;

      case "LIST_SESSIONS":
        sessions
          .listSummaries()
          .then((list) => sendResponse({ ok: true, type: "LIST_SESSIONS", sessions: list }))
          .catch((e) => sendResponse(failed(e, "Couldn't load your recordings.")));
        return true;

      case "DELETE_SESSION":
        sessions
          .delete(request.sessionId)
          .then(() => sendResponse({ ok: true, type: "DELETE_SESSION" }))
          .catch((e) => sendResponse(failed(e, "Couldn't delete that recording.")));
        return true;

      case "GET_SNAPSHOT":
        snapshots
          .get(request.snapshotId)
          .then((snapshot) => sendResponse({ ok: true, type: "GET_SNAPSHOT", snapshot }))
          .catch((e) => sendResponse(failed(e, "Couldn't open that snapshot.")));
        return true;

      case "LIST_SNAPSHOTS":
        snapshots
          .listSummaries()
          .then((list) => sendResponse({ ok: true, type: "LIST_SNAPSHOTS", snapshots: list }))
          .catch((e) => sendResponse(failed(e, "Couldn't load your snapshots.")));
        return true;

      case "DELETE_SNAPSHOT":
        snapshots
          .delete(request.snapshotId)
          .then(() => sendResponse({ ok: true, type: "DELETE_SNAPSHOT" }))
          .catch((e) => sendResponse(failed(e, "Couldn't delete that snapshot.")));
        return true;

      case "PROXY_FETCH":
        proxyFetch(request)
          .then(sendResponse)
          .catch((e) => sendResponse(failed(e, "Couldn't finish that request.")));
        return true;

      default:
        sendResponse({ ok: false, error: "Repruvia didn't understand that request." });
        return false;
    }
  },
);

const PROXY_FETCH_TIMEOUT_MS = 120_000;

/**
 * Perform a cross-origin request from the service worker (CORS-free thanks to
 * `host_permissions`) on the web app's behalf. Restricted to ticket-provider
 * hosts so the page can't use the extension as an open proxy.
 */
async function proxyFetch(
  request: Extract<ExternalRequest, { type: "PROXY_FETCH" }>,
): Promise<ExternalResponse> {
  if (!isProxyFetchAllowed(request.url)) {
    console.warn("[repruvia] Blocked a request to a host Repruvia doesn't allow:", request.url);
    return {
      ok: false,
      error:
        "Repruvia isn't allowed to contact that service. Reload the extension if you just updated it.",
    };
  }
  const body = request.bodyBase64 ? new Blob([base64ToBytes(request.bodyBase64)]) : undefined;
  let res: Response;
  try {
    res = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body,
      // A hung upstream would otherwise hold the web app's request open forever.
      signal: AbortSignal.timeout(PROXY_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("[repruvia] Request failed:", request.url, error);
    return {
      ok: false,
      error: timedOut
        ? "That took too long to answer. Try again."
        : "Couldn't reach that service. Check your connection and try again.",
    };
  }
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
  sessions.pruneOlderThan(SESSION_TTL_MS).catch(() => {});
  snapshots.pruneOlderThan(SNAPSHOT_TTL_MS).catch(() => {});
}

chrome.runtime.onInstalled.addListener(prune);
chrome.runtime.onStartup.addListener(prune);
