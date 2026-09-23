/**
 * The web app's IndexedDB (`repruvia_web`). One module owns the connection +
 * schema so the stores don't fight over the DB version.
 */

const DB_NAME = "repruvia_web";
// v5: bump to re-run the upgrade so the `snapshots` store is created for DBs that
// reached v4 before it existed. Create calls below are guarded, so this is idempotent.
const DB_VERSION = 5;

export const STORES = {
  REPORTS: "reports",
  SETTINGS: "settings",
  TICKETS: "tickets",
  SNAPSHOTS: "snapshots",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

/** Give up on an open that never settles (e.g. blocked by another tab mid-upgrade). */
const OPEN_TIMEOUT_MS = 5000;

export function openWebDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("Repruvia couldn't open its saved data — close other Repruvia tabs and reload."));
    }, OPEN_TIMEOUT_MS);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.REPORTS)) {
        db.createObjectStore(STORES.REPORTS, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS);
      }
      if (!db.objectStoreNames.contains(STORES.TICKETS)) {
        db.createObjectStore(STORES.TICKETS, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
        db.createObjectStore(STORES.SNAPSHOTS, { keyPath: "snapshotId" });
      }
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      const db = request.result;
      if (timedOut) {
        // We already gave up on this open; don't leak a connection nobody uses.
        db.close();
        return;
      }
      // An older tab holding the connection would block a newer version's
      // upgrade (blank app in the new tab) — step aside and reopen on next use.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
  }).catch((error: unknown) => {
    // Don't memoize a failed open — let the next call retry.
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openWebDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openWebDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/** Resolve on commit; reject on error or abort (quota exceeded aborts without a request error). */
function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        new Error("Your browser wouldn't finish that save. It may be out of space.", {
          cause: tx.error,
        }),
      );
  });
}

export async function idbPut(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openWebDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value, key);
  await awaitTransaction(tx);
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openWebDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(key);
  await awaitTransaction(tx);
}
