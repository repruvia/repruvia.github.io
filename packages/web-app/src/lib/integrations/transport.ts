import { extensionBridge, ExtensionUnavailableError } from "@/lib/extensionBridge";

/** One HTTP call a ticket provider wants made. */
export interface HttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Blob;
}

export interface HttpResult {
  status: number;
  statusText: string;
  bodyText: string;
}

/**
 * How a provider's HTTP calls reach Linear/Jira. Providers depend on this, not
 * on `fetch`, so the route can change (browser, extension) without touching
 * provider logic. Rejects only when the call couldn't be made.
 */
export type HttpTransport = (request: HttpRequest) => Promise<HttpResult>;

/** Straight from the page (works where the provider allows browser CORS). */
export const browserTransport: HttpTransport = async ({ url, method, headers, body }) => {
  const res = await fetch(url, { method, headers, body });
  return { status: res.status, statusText: res.statusText, bodyText: await res.text().catch(() => "") };
};

/** Via the extension service worker (CORS-free thanks to host_permissions). */
export const extensionTransport: HttpTransport = (request) => extensionBridge.proxyFetch(request);

/**
 * The route a ticket call should take: the extension service worker, which is
 * CORS-free for every provider host thanks to `host_permissions` (Jira Cloud
 * blocks direct browser calls outright). `fallback` — a direct browser fetch —
 * is used only when the extension itself can't be reached, which is decided
 * before anything is sent, so a create is never retried against a provider
 * that may already have received it.
 */
export function ticketTransport(fallback: HttpTransport): HttpTransport {
  return async (request) => {
    try {
      return await extensionTransport(request);
    } catch (error) {
      if (!(error instanceof ExtensionUnavailableError)) throw error;
      console.warn("[repruvia] Extension route unavailable; calling the provider directly:", error);
      return fallback(request);
    }
  };
}

/** Parse a JSON body, or undefined when it isn't JSON / is empty. */
export function parseJson<T>(result: HttpResult): T | undefined {
  if (!result.bodyText) return undefined;
  try {
    return JSON.parse(result.bodyText) as T;
  } catch {
    return undefined;
  }
}
