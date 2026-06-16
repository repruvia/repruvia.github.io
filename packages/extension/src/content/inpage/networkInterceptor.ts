import { postToContent } from "./post.js";

/**
 * Monkey-patches `fetch` and `XMLHttpRequest` to report 4xx/5xx responses.
 * This is the fallback path that works without the DevTools panel open
 * (TRD §3.4). Response bodies are never read.
 */
export function installNetworkInterceptor(): () => void {
  const originalFetch = window.fetch;

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    if (response.status >= 400) {
      postToContent({
        source: "repruvia",
        kind: "network",
        url: resolveUrl(args[0]),
        method: resolveMethod(args[1]),
        status: response.status,
        timestamp: Date.now(),
      });
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
    this.__repruvia = { method, url: String(url) };
    // eslint-disable-next-line prefer-rest-params
    return OriginalXhrOpen.apply(this, arguments as never);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function patchedSend(
    this: XMLHttpRequest & { __repruvia?: { method: string; url: string } },
  ) {
    this.addEventListener("loadend", () => {
      if (this.status >= 400 && this.__repruvia) {
        postToContent({
          source: "repruvia",
          kind: "network",
          url: this.__repruvia.url,
          method: this.__repruvia.method,
          status: this.status,
          timestamp: Date.now(),
        });
      }
    });
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
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function resolveMethod(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}
