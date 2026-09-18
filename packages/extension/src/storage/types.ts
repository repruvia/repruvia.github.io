import type { RepruviaSession, SessionSummary, Snapshot, SnapshotSummary } from "@repruvia/shared";

export interface SessionRepository {
  save(session: RepruviaSession): Promise<void>;
  get(sessionId: string): Promise<RepruviaSession | null>;
  /** Lightweight list-view projections (no steps/screenshots). */
  listSummaries(): Promise<SessionSummary[]>;
  delete(sessionId: string): Promise<void>;
  /** Remove sessions whose `startedAt` is older than `olderThanMs` ago. */
  pruneOlderThan(olderThanMs: number): Promise<void>;
}

export interface SnapshotRepository {
  save(snapshot: Snapshot): Promise<void>;
  get(snapshotId: string): Promise<Snapshot | null>;
  /** Lightweight list-view projections (no image). */
  listSummaries(): Promise<SnapshotSummary[]>;
  delete(snapshotId: string): Promise<void>;
  /** Remove snapshots whose `createdAt` is older than `olderThanMs` ago. */
  pruneOlderThan(olderThanMs: number): Promise<void>;
}
