import type { RepruviaSession } from "@repruvia/shared";

/** Persistence contract for session metadata (everything except the video). */
export interface SessionRepository {
  save(session: RepruviaSession): Promise<void>;
  get(sessionId: string): Promise<RepruviaSession | null>;
  list(): Promise<RepruviaSession[]>;
  delete(sessionId: string): Promise<void>;
  /** Remove sessions whose `startedAt` is older than `olderThanMs` ago. */
  pruneOlderThan(olderThanMs: number): Promise<void>;
}
