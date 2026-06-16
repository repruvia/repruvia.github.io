/** Format a timestamp as an offset from a session start, e.g. "+4.2s". */
export function relativeTime(timestamp: number, startedAt: number): string {
  const deltaSeconds = Math.max(0, (timestamp - startedAt) / 1000);
  return `+${deltaSeconds.toFixed(1)}s`;
}

/** ISO date for display, e.g. "2026-06-16T10:32:00.000Z". */
export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}
