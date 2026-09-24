import type { CaptureMessage } from "@repruvia/shared";

/**
 * DevTools network monitor (TRD §3.4). When the Repruvia DevTools context is
 * present, this is the most reliable source of network failures — it sees every
 * finished request, including ones the `fetch`/XHR patch can't (e.g. beacons,
 * service-worker-proxied requests). Failures are forwarded to the SW, which
 * adds them to the active session if this is the recorded tab (and drops the
 * duplicate when the in-page patch reported the same request).
 */
chrome.devtools.network.onRequestFinished.addListener((request) => {
  const status = request.response.status;
  if (status < 400) return;

  const message: CaptureMessage = {
    type: "CAPTURE_NETWORK",
    failure: {
      url: request.request.url,
      method: request.request.method,
      status,
      timestamp: Date.now(),
    },
    // This page has no tab of its own; say which tab it's inspecting so the
    // service worker only records failures from the tab being recorded.
    tabId: chrome.devtools.inspectedWindow.tabId,
  };
  chrome.runtime.sendMessage(message).catch(() => {});
});
