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

export function openWebDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

export async function idbPut(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openWebDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openWebDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
