// A small promise wrapper around IndexedDB, the browser's built-in database.
// It keeps BrewHive free of runtime dependencies. If the app later moves to a
// library such as Dexie, only this file and store.ts need to change.

const DB_NAME = 'brewhive';
// 2: adds the ingredient library (v0.2). Opening creates any store that's missing.
const DB_VERSION = 2;

export const STORES = ['recipes', 'batches', 'events', 'cellar', 'pours', 'ingredients', 'settings'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab opened a newer version: let it upgrade.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('BrewHive is open in another tab that is blocking an update.'));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('The database transaction was aborted.'));
  });
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return result(db.transaction(store, 'readonly').objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openDb();
  return result(db.transaction(store, 'readonly').objectStore(store).get(id) as IDBRequest<T | undefined>);
}

export async function putMany<T>(store: StoreName, records: T[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const record of records) os.put(record);
  await done(tx);
  notify();
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([...STORES], 'readwrite');
  for (const name of STORES) tx.objectStore(name).clear();
  await done(tx);
  notify();
}

// --- Change notifications ---------------------------------------------------
// Screens subscribe so they re-read after any write, including writes made in
// another tab of the same browser.

type Listener = () => void;
const listeners = new Set<Listener>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('brewhive-db') : null;

if (channel) {
  channel.onmessage = () => {
    for (const listener of listeners) listener();
  };
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
  channel?.postMessage('changed');
}
