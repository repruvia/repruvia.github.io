import type {
  RepruviaSession,
  ExternalRequest,
  ExternalResponse,
  SessionSummary,
} from "@repruvia/shared";

/** Optional explicit override; normally the ID is auto-discovered. */
const ENV_EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID ?? "";

/**
 * The published Chrome Web Store extension ID. Used as a reliable fallback so
 * the deployed web app can message the production extension directly even before
 * its content script announces itself. (Dev unpacked builds get a different ID,
 * which the content-script DOM announcement provides and takes precedence.)
 */
const PUBLISHED_EXTENSION_ID = "ggjjdcmbiifemkldlbeplfljlpehepdl";

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
 * web-app content script, e.g. a dev unpacked build) → the published Web Store
 * ID → a postMessage handshake for late-loading pages. Whether the extension is
 * actually installed is determined by whether messaging that id succeeds.
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
  discovery = new Promise<string>((resolve) => {
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
      // Fall back to the published ID; if the extension isn't installed, the
      // actual sendMessage will fail and surface as unavailable.
      resolve(readIdFromDom() ?? PUBLISHED_EXTENSION_ID);
    }, DISCOVERY_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    window.postMessage({ source: "repruvia-webapp", kind: "whois" }, "*");
  });
  return discovery;
}

/** True when the page can in principle talk to an extension (install confirmed by messaging). */
export function isExtensionAvailable(): boolean {
  return Boolean(getRuntime());
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

  /**
   * Run a cross-origin request from the extension service worker (CORS-free),
   * used to upload ticket screenshots to provider storage that rejects
   * browser-origin requests. Allowed hosts are enforced extension-side.
   */
  async proxyFetch(init: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: Blob;
  }): Promise<{ status: number; statusText: string; bodyText: string }> {
    const bodyBase64 = init.body ? await blobToBase64(init.body) : undefined;
    const res = await request({
      type: "PROXY_FETCH",
      url: init.url,
      method: init.method,
      headers: init.headers,
      bodyBase64,
    });
    if (!res.ok) throw new Error(res.error);
    if (res.type !== "PROXY_FETCH") throw new Error("Unexpected proxy response");
    return { status: res.status, statusText: res.statusText, bodyText: res.bodyText };
  },
};

/** Encode a Blob as base64 (no data-URL prefix) for JSON messaging. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000; // avoid arg-count limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
