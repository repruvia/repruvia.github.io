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
  "https://leoanimesh.github.io",
] as const;
