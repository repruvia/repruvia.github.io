import { DB, type RepruviaSession } from "@repruvia/shared";
import type { SessionRepository } from "./types.js";

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

/** IndexedDB-backed session metadata store. */
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
