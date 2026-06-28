import type { RepruviaSession, Snapshot } from "@repruvia/shared";

export interface SessionRepository {
  save(session: RepruviaSession): Promise<void>;
  get(sessionId: string): Promise<RepruviaSession | null>;
  list(): Promise<RepruviaSession[]>;
  delete(sessionId: string): Promise<void>;
  /** Remove sessions whose `startedAt` is older than `olderThanMs` ago. */
  pruneOlderThan(olderThanMs: number): Promise<void>;
}

export interface SnapshotRepository {
  save(snapshot: Snapshot): Promise<void>;
  get(snapshotId: string): Promise<Snapshot | null>;
  list(): Promise<Snapshot[]>;
  delete(snapshotId: string): Promise<void>;
  /** Remove snapshots whose `createdAt` is older than `olderThanMs` ago. */
  pruneOlderThan(olderThanMs: number): Promise<void>;
}
