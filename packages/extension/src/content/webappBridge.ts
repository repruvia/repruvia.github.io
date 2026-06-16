/**
 * Runs only on the Repruvia web app origins. Its sole job is to make the
 * extension self-identifying so the web app never needs a hand-configured
 * `VITE_EXTENSION_ID`: it publishes `chrome.runtime.id` to the page both as a
 * DOM attribute (synchronous read) and via a small postMessage handshake (for
 * pages that loaded before this script ran).
 */

const EXTENSION_ID = chrome.runtime.id;

// Synchronous channel: the web app can read this immediately on demand.
document.documentElement.dataset.repruviaExtensionId = EXTENSION_ID;

const announce = (): void => {
  window.postMessage({ source: "repruvia-extension", kind: "extension-id", id: EXTENSION_ID }, "*");
};

// Proactively announce, and answer any "who is the extension?" probe.
announce();
window.addEventListener("message", (event: MessageEvent) => {
  if (event.source === window && event.data?.source === "repruvia-webapp" && event.data?.kind === "whois") {
    announce();
  }
});
