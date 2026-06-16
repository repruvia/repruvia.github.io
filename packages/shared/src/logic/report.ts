import type {
  RepruviaSession,
  ConsoleEntry,
  NetworkFailure,
  SessionSummary,
  Step,
} from "../types/domain.js";

/** Project a full session down to its list-view summary. */
export function toSessionSummary(session: RepruviaSession): SessionSummary {
  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    tabUrl: session.tabUrl,
    stepCount: session.steps.length,
    consoleErrorCount: session.consoleErrors.length,
    networkFailureCount: session.networkFailures.length,
  };
}

/** The text actually shown for a step: tester edit wins over the auto value. */
export function resolveStepText(step: Step): string {
  return step.editedDescription?.trim() || step.autoDescription;
}

/** Reindex steps to keep `index` consistent after reorder/delete (1-based). */
export function reindexSteps(steps: Step[]): Step[] {
  return steps.map((step, i) => (step.index === i + 1 ? step : { ...step, index: i + 1 }));
}

/**
 * Assign each console/network entry to the step that is temporally nearest at
 * or before it, so the report can surface errors against the action that
 * triggered them. Pure: returns new arrays, never mutates inputs.
 */
export function assignNearestSteps<T extends ConsoleEntry | NetworkFailure>(
  entries: T[],
  steps: Step[],
): T[] {
  if (steps.length === 0) return entries.map((e) => ({ ...e, nearestStepId: null }));
  const ordered = [...steps].sort((a, b) => a.timestamp - b.timestamp);

  return entries.map((entry) => {
    let nearest = ordered[0]!;
    for (const step of ordered) {
      if (step.timestamp <= entry.timestamp) nearest = step;
      else break;
    }
    return { ...entry, nearestStepId: nearest.id };
  });
}

/** Group already-assigned entries by their `nearestStepId` for per-step display. */
export function groupByStep<T extends { nearestStepId: string | null }>(
  entries: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const entry of entries) {
    if (!entry.nearestStepId) continue;
    const list = map.get(entry.nearestStepId) ?? [];
    list.push(entry);
    map.set(entry.nearestStepId, list);
  }
  return map;
}

/** Re-run all derived assignments after edits. Returns a normalized session. */
export function assembleSession(session: RepruviaSession): RepruviaSession {
  const steps = reindexSteps(session.steps);
  return {
    ...session,
    steps,
    consoleErrors: assignNearestSteps(session.consoleErrors, steps),
    networkFailures: assignNearestSteps(session.networkFailures, steps),
  };
}
