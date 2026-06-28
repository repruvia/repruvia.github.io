import { idbDelete, idbGet, idbGetAll, idbPut, STORES } from "./db";
import type { AnnotationShape } from "./annotations/types";

/**
 * Persists the editable layer over a snip snapshot (title, description,
 * annotation shapes) in IndexedDB, keyed by snapshot id. The captured image is
 * immutable and re-fetched on load; only the tester's edits live here.
 */

export interface PersistedSnapshot {
  title: string;
  description: string;
  shapes: AnnotationShape[];
}

interface StoredRecord extends PersistedSnapshot {
  snapshotId: string;
}

export async function loadPersistedSnapshot(
  snapshotId: string,
): Promise<PersistedSnapshot | null> {
  try {
    const record = await idbGet<StoredRecord>(STORES.SNAPSHOTS, snapshotId);
    return record
      ? { title: record.title, description: record.description, shapes: record.shapes ?? [] }
      : null;
  } catch {
    return null;
  }
}

export async function loadAllSnapshotMeta(): Promise<
  Map<string, { title: string; description: string }>
> {
  try {
    const records = await idbGetAll<StoredRecord>(STORES.SNAPSHOTS);
    return new Map(records.map((r) => [r.snapshotId, { title: r.title, description: r.description }]));
  } catch {
    return new Map();
  }
}

export async function savePersistedSnapshot(
  snapshotId: string,
  data: PersistedSnapshot,
): Promise<void> {
  try {
    const record: StoredRecord = { snapshotId, ...data };
    await idbPut(STORES.SNAPSHOTS, record);
  } catch {
    // IndexedDB unavailable (private mode, quota) — non-fatal.
  }
}

export async function deletePersistedSnapshot(snapshotId: string): Promise<void> {
  try {
    await idbDelete(STORES.SNAPSHOTS, snapshotId);
  } catch {
    // non-fatal
  }
}
