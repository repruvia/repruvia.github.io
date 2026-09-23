/**
 * Coercion helpers for documents read back from the optional cloud backend.
 *
 * A stored document is weakly typed (any field can be missing, null, or of an
 * unexpected type after a schema change) and its timestamps arrive in whatever
 * shape the SDK hands over — a `Timestamp`-like object, an epoch number, or an
 * ISO string. These pure functions turn that into the narrow types the app
 * works with, never throwing on bad input.
 */

/** A string field, or `null` when absent/blank/not a string. */
export function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? value : null;
}

/** A string field, or `""` when absent/not a string (for always-present form fields). */
export function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A map field narrowed to string → non-empty string; anything else yields `{}`. */
export function toStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry) result[key] = entry;
  }
  return result;
}

/**
 * A timestamp field as an ISO string, or `null` when it's missing or unusable.
 * Accepts a `Timestamp`-like object (`toDate()` or `{ seconds, nanoseconds }`),
 * a `Date`, epoch milliseconds, or a parseable date string. A server-generated
 * timestamp that hasn't resolved yet reads back as `null`.
 */
export function toIsoTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return isoOrNull(Date.parse(value));
  if (typeof value === "number") return isoOrNull(value);
  if (value instanceof Date) return isoOrNull(value.getTime());
  if (typeof value !== "object") return null;

  const candidate = value as { toDate?: unknown; seconds?: unknown; nanoseconds?: unknown };
  if (typeof candidate.toDate === "function") {
    const date = (candidate.toDate as () => unknown)();
    return date instanceof Date ? isoOrNull(date.getTime()) : null;
  }
  if (typeof candidate.seconds === "number") {
    const nanoseconds = typeof candidate.nanoseconds === "number" ? candidate.nanoseconds : 0;
    return isoOrNull(candidate.seconds * 1000 + Math.floor(nanoseconds / 1e6));
  }
  return null;
}

function isoOrNull(ms: number): string | null {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
