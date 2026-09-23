/**
 * Pure classifier for pages Repruvia can never record, independent of
 * whether a content script happens to be attached right now. Used by the
 * popup to pick between "reload this page" (fixable) and "can't record this
 * kind of page" (never fixable) copy — see CLAUDE.md's content-script
 * attachment gotcha.
 */

/** Schemes Chrome never injects content scripts into, regardless of `matches`. */
const NEVER_RECORDABLE_SCHEMES = new Set([
  "chrome:",
  "chrome-extension:",
  "chrome-untrusted:",
  "edge:",
  "about:",
  "view-source:",
  "devtools:",
]);

/** Both the legacy and current Chrome Web Store hosts. */
const CHROME_WEB_STORE_HOSTS = new Set(["chrome.google.com", "chromewebstore.google.com"]);

export interface NeverRecordablePageOptions {
  /**
   * Whether the extension has been granted "Allow access to file URLs".
   * Without it, `file://` pages never get a content script; with it, they're
   * treated like any other page.
   */
  fileAccessAllowed?: boolean;
}

/**
 * True when `url` can never host a Repruvia content script — reloading it
 * will never help. Covers Chrome/Edge internal pages, the Web Store,
 * view-source, the built-in PDF viewer, and (unless opted in) local files.
 */
export function isNeverRecordablePage(
  url: string | null | undefined,
  options: NeverRecordablePageOptions = {},
): boolean {
  if (!url) return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }

  if (NEVER_RECORDABLE_SCHEMES.has(parsed.protocol)) return true;
  if (parsed.protocol === "file:" && !options.fileAccessAllowed) return true;
  if (
    (parsed.protocol === "http:" || parsed.protocol === "https:") &&
    CHROME_WEB_STORE_HOSTS.has(parsed.hostname)
  ) {
    return true;
  }
  // Chrome renders PDFs in a built-in viewer, not the page's own DOM, so no
  // content script runs there. There's no reliable signal but the extension.
  if (parsed.pathname.toLowerCase().endsWith(".pdf")) return true;

  return false;
}
