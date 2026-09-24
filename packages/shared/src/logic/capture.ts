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

/** Identifies the tab whose viewport a step screenshot should show. */
export interface CaptureTarget {
  tabId: number;
  windowId: number;
}

/** The few tab fields needed to tell whether that tab is the one on screen. */
export interface VisibleTabInfo {
  id?: number;
  windowId?: number;
  active?: boolean;
}

/**
 * True when `tab` is still the recorded tab AND the one currently on screen in
 * the target window.
 *
 * Chrome's `captureVisibleTab` photographs whatever is active in a window, not
 * a tab we name. Captures are deliberately delayed and throttled, so by the
 * time one runs the user may have switched tabs (or a `target="_blank"` link
 * may have opened one) — and the step would then carry a picture of an
 * unrelated page. Checking this first lets a capture be skipped instead.
 */
export function isCaptureTargetVisible(
  target: CaptureTarget,
  tab: VisibleTabInfo | null | undefined,
): boolean {
  if (!tab) return false;
  return tab.id === target.tabId && tab.windowId === target.windowId && tab.active === true;
}
