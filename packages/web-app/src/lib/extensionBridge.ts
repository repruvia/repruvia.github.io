import type {
  RepruviaSession,
  ExternalRequest,
  ExternalResponse,
  SessionSummary,
} from "@repruvia/shared";

/** Optional explicit override; normally the ID is auto-discovered. */
const ENV_EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID ?? "";

/** How long to wait for the extension's self-announcement before giving up. */
const DISCOVERY_TIMEOUT_MS = 2000;

export class ExtensionUnavailableError extends Error {
  constructor() {
    super(
      "Repruvia extension not reachable. Install the extension and open this report from it (or set VITE_EXTENSION_ID).",
    );
    this.name = "ExtensionUnavailableError";
  }
}

interface ChromeRuntime {
  sendMessage: (
    extensionId: string,
    message: ExternalRequest,
    callback: (response: ExternalResponse | undefined) => void,
  ) => void;
  lastError?: { message?: string };
}

function getRuntime(): ChromeRuntime | null {
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  return runtime ?? null;
}

/** Read the id the extension's content script writes onto <html>. */
function readIdFromDom(): string | null {
  return document.documentElement.dataset.repruviaExtensionId ?? null;
}

let cachedId: string | null = null;
let discovery: Promise<string> | null = null;

/**
 * Resolve the extension id without manual configuration. Precedence:
 * explicit env override → DOM attribute (set synchronously by the extension's
 * web-app content script) → a postMessage handshake for late-loading pages.
 */
function resolveExtensionId(): Promise<string> {
  if (ENV_EXTENSION_ID) return Promise.resolve(ENV_EXTENSION_ID);
  if (cachedId) return Promise.resolve(cachedId);

  const fromDom = readIdFromDom();
  if (fromDom) {
    cachedId = fromDom;
    return Promise.resolve(fromDom);
  }

  if (discovery) return discovery;
  discovery = new Promise<string>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data?.source === "repruvia-extension" &&
        event.data?.kind === "extension-id" &&
        typeof event.data.id === "string"
      ) {
        cachedId = event.data.id;
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        resolve(event.data.id);
      }
    };
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      discovery = null;
      const late = readIdFromDom();
      if (late) {
        cachedId = late;
        resolve(late);
      } else {
        reject(new ExtensionUnavailableError());
      }
    }, DISCOVERY_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    window.postMessage({ source: "repruvia-webapp", kind: "whois" }, "*");
  });
  return discovery;
}

/** True when the page can in principle talk to the extension. */
export function isExtensionAvailable(): boolean {
  return Boolean(getRuntime()) && (Boolean(ENV_EXTENSION_ID) || readIdFromDom() !== null);
}

async function request(message: ExternalRequest): Promise<ExternalResponse> {
  const runtime = getRuntime();
  if (!runtime) throw new ExtensionUnavailableError();
  const extensionId = await resolveExtensionId();

  return new Promise((resolve, reject) => {
    runtime.sendMessage(extensionId, message, (response) => {
      if (runtime.lastError || !response) {
        reject(new ExtensionUnavailableError());
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Typed facade over the extension's `onMessageExternal` API. The rest of the
 * app depends on these functions, not on `chrome.*`, so the transport can be
 * swapped (e.g. mocked in tests).
 */
export const extensionBridge = {
  async getSession(sessionId: string): Promise<RepruviaSession | null> {
    const res = await request({ type: "GET_SESSION", sessionId });
    if (!res.ok) throw new Error(res.error);
    return res.type === "GET_SESSION" ? res.session : null;
  },

  async listSessions(): Promise<SessionSummary[]> {
    const res = await request({ type: "LIST_SESSIONS" });
    if (!res.ok) throw new Error(res.error);
    return res.type === "LIST_SESSIONS" ? res.sessions : [];
  },

  async deleteSession(sessionId: string): Promise<void> {
    const res = await request({ type: "DELETE_SESSION", sessionId });
    if (!res.ok) throw new Error(res.error);
  },
};
