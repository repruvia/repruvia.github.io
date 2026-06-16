import type { PageMessage } from "@repruvia/shared";

/** Post a typed message to the ISOLATED content script (same window). */
export function postToContent(message: PageMessage): void {
  window.postMessage(message, "*");
}
