import { postToContent } from "./post.js";

/**
 * Monkey-patches `fetch` and `XMLHttpRequest` to report 4xx/5xx responses and
 * requests that failed outright (network/CORS/DNS — reported as status 0).
 * This is the fallback path that works without the DevTools panel open
 * (TRD §3.4). Response bodies are never read.
 */
export function installNetworkInterceptor(): () => void {
  const originalFetch = window.fetch;

  // Runs inside the page's own requests: capturing must never throw into them.
  const report = (url: string, method: string, status: number) => {
    try {
      postToContent({ source: "repruvia", kind: "network", url, method, status, timestamp: Date.now() });
    } catch {
      // ignore
    }
  };

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    let response: Response;
    try {
      response = await originalFetch(...args);
    } catch (error) {
      // An abort is the page's own choice, not a failure worth reporting.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        report(resolveUrl(args[0]), resolveMethod(args[0], args[1]), 0);
      }
      throw error;
    }
    if (response.status >= 400) {
      report(resolveUrl(args[0]), resolveMethod(args[0], args[1]), response.status);
    }
    return response;
  };

  const OriginalXhrOpen = XMLHttpRequest.prototype.open;
  const OriginalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(
    this: XMLHttpRequest & { __repruvia?: { method: string; url: string } },
    method: string,
    url: string | URL,
  ) {
    this.__repruvia = { method: method.toUpperCase(), url: absoluteUrl(String(url)) };
    // eslint-disable-next-line prefer-rest-params
    return OriginalXhrOpen.apply(this, arguments as never);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function patchedSend(
    this: XMLHttpRequest & { __repruvia?: { method: string; url: string } },
  ) {
    const request = this.__repruvia;
    if (request) {
      this.addEventListener("loadend", () => {
        if (this.status >= 400) report(request.url, request.method, this.status);
      });
      // Network/CORS failure: `loadend` fires too, but with status 0.
      this.addEventListener("error", () => report(request.url, request.method, 0));
      this.addEventListener("timeout", () => report(request.url, request.method, 0));
    }
    // eslint-disable-next-line prefer-rest-params
    return OriginalXhrSend.apply(this, arguments as never);
  } as typeof XMLHttpRequest.prototype.send;

  return () => {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = OriginalXhrOpen;
    XMLHttpRequest.prototype.send = OriginalXhrSend;
  };
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return absoluteUrl(input);
  if (input instanceof URL) return input.href;
  return input.url;
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  // init.method wins; otherwise a Request object carries its own method.
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  return method.toUpperCase();
}

/** Resolve a page-relative URL so it matches what DevTools reports (enables dedupe). */
function absoluteUrl(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}
