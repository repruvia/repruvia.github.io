import { DB, type RepruviaSession, type Snapshot } from "@repruvia/shared";
import type { SessionRepository, SnapshotRepository } from "./types.js";

/** Open (and migrate) the Repruvia IndexedDB database once, memoized. */
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB.NAME, DB.VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB.STORES.SESSIONS)) {
        db.createObjectStore(DB.STORES.SESSIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DB.STORES.SNAPSHOTS)) {
        db.createObjectStore(DB.STORES.SNAPSHOTS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const request = run(transaction.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export class IndexedDbSessionRepository implements SessionRepository {
  save(session: RepruviaSession): Promise<void> {
    return tx(DB.STORES.SESSIONS, "readwrite", (store) => store.put(session)).then(() => undefined);
  }

  async get(sessionId: string): Promise<RepruviaSession | null> {
    const result = await tx<RepruviaSession | undefined>(DB.STORES.SESSIONS, "readonly", (store) =>
      store.get(sessionId),
    );
    return result ?? null;
  }

  list(): Promise<RepruviaSession[]> {
    return tx<RepruviaSession[]>(DB.STORES.SESSIONS, "readonly", (store) => store.getAll());
  }

  delete(sessionId: string): Promise<void> {
    return tx(DB.STORES.SESSIONS, "readwrite", (store) => store.delete(sessionId)).then(
      () => undefined,
    );
  }

  async pruneOlderThan(olderThanMs: number): Promise<void> {
    const cutoff = Date.now() - olderThanMs;
    const sessions = await this.list();
    await Promise.all(
      sessions.filter((s) => s.startedAt < cutoff).map((s) => this.delete(s.id)),
    );
  }
}

export class IndexedDbSnapshotRepository implements SnapshotRepository {
  save(snapshot: Snapshot): Promise<void> {
    return tx(DB.STORES.SNAPSHOTS, "readwrite", (store) => store.put(snapshot)).then(
      () => undefined,
    );
  }

  async get(snapshotId: string): Promise<Snapshot | null> {
    const result = await tx<Snapshot | undefined>(DB.STORES.SNAPSHOTS, "readonly", (store) =>
      store.get(snapshotId),
    );
    return result ?? null;
  }

  list(): Promise<Snapshot[]> {
    return tx<Snapshot[]>(DB.STORES.SNAPSHOTS, "readonly", (store) => store.getAll());
  }

  delete(snapshotId: string): Promise<void> {
    return tx(DB.STORES.SNAPSHOTS, "readwrite", (store) => store.delete(snapshotId)).then(
      () => undefined,
    );
  }

  async pruneOlderThan(olderThanMs: number): Promise<void> {
    const cutoff = Date.now() - olderThanMs;
    const snapshots = await this.list();
    await Promise.all(
      snapshots.filter((s) => s.createdAt < cutoff).map((s) => this.delete(s.id)),
    );
  }
}
