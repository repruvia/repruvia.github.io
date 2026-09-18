import { LIMITS } from "../constants.js";
import type { NetworkFailure } from "../types/domain.js";

type NetworkSignal = Pick<NetworkFailure, "url" | "method" | "status" | "timestamp">;

/**
 * True when `candidate` is the same failed request as one already recorded. The
 * DevTools monitor and the in-page fetch/XHR patch both see most failures, so
 * the same request arrives twice within a moment of itself.
 */
export function isDuplicateNetworkFailure(
  recorded: readonly NetworkSignal[],
  candidate: NetworkSignal,
  windowMs: number = LIMITS.NETWORK_DEDUPE_WINDOW_MS,
): boolean {
  // Recent entries are at the end; stop scanning once we're past the window.
  for (let i = recorded.length - 1; i >= 0; i -= 1) {
    const entry = recorded[i]!;
    if (candidate.timestamp - entry.timestamp > windowMs) break;
    if (
      entry.status === candidate.status &&
      entry.method.toUpperCase() === candidate.method.toUpperCase() &&
      entry.url === candidate.url
    ) {
      return true;
    }
  }
  return false;
}

/** Cap a captured string (console message, etc.) so one entry can't bloat the session. */
export function truncateText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
