import type { RepruviaSession, ReportMeta, Step } from "@repruvia/shared";
import { idbDelete, idbGet, idbGetAll, idbPut, STORES } from "./db";

/**
 * Persists the editable report layer (title, severity, description, per-step
 * edits/order) in IndexedDB, keyed by session id. The captured session is
 * immutable; only the tester's edits live here. Screenshots are NOT stored —
 * they are re-fetched from the extension on load.
 */

interface PersistedStep {
  id: string;
  editedDescription: string | null;
}

export interface PersistedReport {
  meta: ReportMeta;
  /** Step ids in display order (captures reorder/delete) + their edits. */
  steps: PersistedStep[];
}

interface StoredRecord extends PersistedReport {
  sessionId: string;
}

export async function loadPersistedReport(sessionId: string): Promise<PersistedReport | null> {
  try {
    const record = await idbGet<StoredRecord>(STORES.REPORTS, sessionId);
    return record ? { meta: record.meta, steps: record.steps } : null;
  } catch {
    return null;
  }
}

export async function loadAllPersistedMeta(): Promise<Map<string, ReportMeta>> {
  try {
    const records = await idbGetAll<StoredRecord>(STORES.REPORTS);
    return new Map(records.map((r) => [r.sessionId, r.meta]));
  } catch {
    return new Map();
  }
}

export async function savePersistedReport(
  sessionId: string,
  meta: ReportMeta,
  steps: Step[],
): Promise<void> {
  try {
    const record: StoredRecord = {
      sessionId,
      meta,
      steps: steps.map((s) => ({ id: s.id, editedDescription: s.editedDescription })),
    };
    await idbPut(STORES.REPORTS, record);
  } catch {
    // IndexedDB unavailable (private mode, quota) — non-fatal.
  }
}

export async function deletePersistedReport(sessionId: string): Promise<void> {
  try {
    await idbDelete(STORES.REPORTS, sessionId);
  } catch {
    // non-fatal
  }
}

/**
 * Apply a persisted edit layer onto a freshly-loaded session, preserving saved
 * order/deletions/edits. Falls back to the raw session if nothing maps (corrupt/stale).
 */
export function applyPersistedReport(
  session: RepruviaSession,
  persisted: PersistedReport,
): { steps: Step[]; meta: ReportMeta } {
  const byId = new Map(session.steps.map((s) => [s.id, s] as const));
  const steps = persisted.steps
    .map((p) => {
      const original = byId.get(p.id);
      return original ? { ...original, editedDescription: p.editedDescription } : null;
    })
    .filter((s): s is Step => s !== null);

  return {
    steps: steps.length > 0 ? steps : session.steps,
    meta: persisted.meta,
  };
}
