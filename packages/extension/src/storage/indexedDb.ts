import {
  DB,
  toSessionSummary,
  toSnapshotSummary,
  type RepruviaSession,
  type SessionSummary,
  type Snapshot,
  type SnapshotSummary,
} from "@repruvia/shared";
import type { SessionRepository, SnapshotRepository } from "./types.js";

/** Open (and migrate) the Repruvia IndexedDB database once, memoized. */
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
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
    request.onsuccess = () => {
      const db = request.result;
      // Let a newer version (extension update) upgrade instead of blocking on us;
      // the next call reopens.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    // Don't memoize a failed open — let the next call retry.
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

/**
 * Run a read against one store; resolves with the request's result. Watches the
 * transaction as well as the request: a transaction can abort on its own (disk
 * or quota trouble, a forced close) without the request ever failing, and a
 * promise left pending there would wedge every caller awaiting it.
 */
function read<T>(storeName: string, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const request = run(transaction.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"));
      }),
  );
}

/**
 * Run a write against one store. Resolves only once the transaction COMMITS and
 * rejects if it aborts — a quota-exceeded write aborts the transaction without
 * failing the request, so waiting on the request alone could hang forever.
 */
function write(storeName: string, run: (store: IDBObjectStore) => void): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"));
        run(transaction.objectStore(storeName));
      }),
  );
}

/**
 * Walk a store with a cursor, projecting each record as it's read so the whole
 * store (with its base64 images) is never held in memory at once. Like `read`,
 * it settles on a transaction abort as well as a request error.
 */
function collect<T, R>(storeName: string, project: (value: T) => R): Promise<R[]> {
  return openDb().then(
    (db) =>
      new Promise<R[]>((resolve, reject) => {
        const out: R[] = [];
        const transaction = db.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(out);
            return;
          }
          out.push(project(cursor.value as T));
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
        // A mid-walk abort never fails the cursor request — settle here instead
        // of leaving the walk hanging.
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"));
      }),
  );
}

/** Delete every record matching `isStale` in a single readwrite cursor pass. */
function deleteWhere<T>(storeName: string, isStale: (value: T) => boolean): Promise<void> {
  return write(storeName, (store) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (isStale(cursor.value as T)) cursor.delete();
      cursor.continue();
    };
  });
}

export class IndexedDbSessionRepository implements SessionRepository {
  save(session: RepruviaSession): Promise<void> {
    return write(DB.STORES.SESSIONS, (store) => store.put(session));
  }

  async get(sessionId: string): Promise<RepruviaSession | null> {
    const result = await read<RepruviaSession | undefined>(DB.STORES.SESSIONS, (store) =>
      store.get(sessionId),
    );
    return result ?? null;
  }

  listSummaries(): Promise<SessionSummary[]> {
    return collect(DB.STORES.SESSIONS, toSessionSummary);
  }

  delete(sessionId: string): Promise<void> {
    return write(DB.STORES.SESSIONS, (store) => store.delete(sessionId));
  }

  pruneOlderThan(olderThanMs: number): Promise<void> {
    const cutoff = Date.now() - olderThanMs;
    return deleteWhere<RepruviaSession>(DB.STORES.SESSIONS, (s) => s.startedAt < cutoff);
  }
}

export class IndexedDbSnapshotRepository implements SnapshotRepository {
  save(snapshot: Snapshot): Promise<void> {
    return write(DB.STORES.SNAPSHOTS, (store) => store.put(snapshot));
  }

  async get(snapshotId: string): Promise<Snapshot | null> {
    const result = await read<Snapshot | undefined>(DB.STORES.SNAPSHOTS, (store) =>
      store.get(snapshotId),
    );
    return result ?? null;
  }

  listSummaries(): Promise<SnapshotSummary[]> {
    return collect(DB.STORES.SNAPSHOTS, toSnapshotSummary);
  }

  delete(snapshotId: string): Promise<void> {
    return write(DB.STORES.SNAPSHOTS, (store) => store.delete(snapshotId));
  }

  pruneOlderThan(olderThanMs: number): Promise<void> {
    const cutoff = Date.now() - olderThanMs;
    return deleteWhere<Snapshot>(DB.STORES.SNAPSHOTS, (s) => s.createdAt < cutoff);
  }
}
