/** Names of the extension's IndexedDB database and object stores. */
export const DB = {
  NAME: "repruvia_db",
  VERSION: 1,
  STORES: {
    SESSIONS: "sessions",
  },
} as const;

/** Sessions older than this are pruned on extension startup. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Debounce window for screenshot capture after an interaction (TRD §3.2). */
export const SCREENSHOT_DEBOUNCE_MS = 150;

/** Limits applied to captured metadata to keep payloads bounded. */
export const LIMITS = {
  TEXT_CONTENT_MAX: 80,
  REACT_PROPS_MAX: 10,
  STEPS_BATCH_SIZE: 5,
} as const;

/** Query param used when the extension opens the web app. */
export const SESSION_QUERY_PARAM = "session";

/** Origins the extension will respond to over `onMessageExternal` (TRD §6, §12). */
export const ALLOWED_WEB_APP_ORIGINS = [
  "http://localhost:3000",
  "https://repruvia.app",
  // GitHub Pages deploy — set to your actual Pages origin if different.
  "https://repruvia.github.io",
] as const;

/**
 * Hosts the `PROXY_FETCH` channel may target. The extension performs these
 * cross-origin requests on the web app's behalf (bypassing page CORS), so the
 * allowlist is kept tight to ticket-provider storage/API endpoints only.
 */
export const PROXY_FETCH_ALLOWED_HOST_SUFFIXES = [
  "linear.app", // api.linear.app, uploads.linear.app
  "atlassian.net", // <site>.atlassian.net (Jira)
  "openai.com", // OpenAI API
  "anthropic.com", // Anthropic API
  "generativelanguage.googleapis.com", // Google Gemini (only this host, not all of googleapis.com)
  "x.ai", // xAI Grok (api.x.ai)
] as const;

/** True when `url`'s host is covered by the proxy allowlist. */
export function isProxyFetchAllowed(url: string): boolean {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    host = parsed.hostname;
  } catch {
    return false;
  }
  return PROXY_FETCH_ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}
