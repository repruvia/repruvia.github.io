/**
 * Technical text that should never reach end-user copy: raw JSON/object
 * dumps, backend error codes, vendor/provider/API names, console links, and
 * network-stack error names. `toFriendlyMessage` uses these to decide
 * whether a caught error's own message is safe to show verbatim, or whether
 * the caller's plain-language `fallback` should be shown instead.
 */
const UNSAFE_PATTERNS: RegExp[] = [
  /[{}[\]]/, // JSON-shaped payloads, e.g. `{"error":{"code":403,...}}`
  /"[\w-]+"\s*:/, // JSON "key": value pairs
  /https?:\/\//i, // links, e.g. "visit https://console.developers.google.com/..."
  /PERMISSION_DENIED|SERVICE_DISABLED|UNAUTHENTICATED|UNAVAILABLE|INVALID_ARGUMENT|NOT_FOUND|RESOURCE_EXHAUSTED|INTERNAL/,
  /firebase|firestore|google cloud|graphql|indexeddb|webgpu|cors|econnrefused|enotfound|networkerror|failed to fetch/i,
];

const MAX_SAFE_LENGTH = 140;

function isSafeMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > MAX_SAFE_LENGTH) return false;
  return !UNSAFE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Turns a caught, unknown error into a short sentence safe to show a
 * non-technical user. A backend error dump (raw JSON, gRPC-style status
 * enums, links, vendor/API names, or anything long) is replaced with
 * `fallback`; a short, clean, human-authored message (one our own code threw
 * on purpose) is passed through as-is.
 *
 * Pure — does no logging or I/O. Callers should log the original `error` to
 * the console themselves for developers.
 */
export function toFriendlyMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return isSafeMessage(message) ? message : fallback;
}
