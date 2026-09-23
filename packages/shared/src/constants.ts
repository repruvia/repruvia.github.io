/** Names of the extension's IndexedDB database and object stores. */
export const DB = {
  NAME: "repruvia_db",
  VERSION: 2,
  STORES: {
    SESSIONS: "sessions",
    SNAPSHOTS: "snapshots",
  },
} as const;

/** Sessions older than this are pruned on extension startup. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Snapshots older than this are pruned on extension startup. */
export const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Debounce window for screenshot capture after an interaction (TRD §3.2). */
export const SCREENSHOT_DEBOUNCE_MS = 150;

/** Limits applied to captured metadata to keep payloads bounded. */
export const LIMITS = {
  TEXT_CONTENT_MAX: 80,
  REACT_PROPS_MAX: 10,
  STEPS_BATCH_SIZE: 5,
  /** Console messages longer than this are truncated (huge JSON dumps, stack blobs). */
  CONSOLE_MESSAGE_MAX: 2000,
  /** Per-session caps so a page spamming errors can't grow a session without bound. */
  CONSOLE_ENTRIES_MAX: 500,
  NETWORK_ENTRIES_MAX: 500,
  /** Identical network failures within this window are one failure seen by two sources. */
  NETWORK_DEDUPE_WINDOW_MS: 1500,
} as const;

/** Query param used when the extension opens the web app on a recording. */
export const SESSION_QUERY_PARAM = "session";

/** Query param used when the extension opens the web app on a snip annotation. */
export const SNAPSHOT_QUERY_PARAM = "snapshot";

/** Origins the extension will respond to over `onMessageExternal` (TRD §6, §12). */
export const ALLOWED_WEB_APP_ORIGINS = [
  "http://localhost:3000",
  // Firebase Hosting (primary production site) + its alternate domain.
  "https://repruvia.web.app",
  "https://repruvia.firebaseapp.com",
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
  "groq.com", // Groq (api.groq.com, OpenAI-compatible)
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
