// IndexedDB High-Capacity Storage Utility for ANGEL AI
// Supports gigabyte-scale storage for custom communication datasets, gold playbooks, uploaded files, and zip archives
// Safely bypasses browser localStorage 5MB quota restrictions

const DB_NAME = 'AngelAiTerminalDB';
const DB_VERSION = 1;
const MEMORIES_STORE = 'gold_memories';
const DATASETS_STORE = 'communication_datasets';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MEMORIES_STORE)) {
        db.createObjectStore(MEMORIES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DATASETS_STORE)) {
        db.createObjectStore(DATASETS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveMemoriesToIndexedDb(memories: any[]): Promise<boolean> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEMORIES_STORE, 'readwrite');
      const store = tx.objectStore(MEMORIES_STORE);

      // Clear existing and rewrite
      store.clear();
      for (const item of memories) {
        if (item && item.id) {
          store.put(item);
        }
      }

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB saveMemories error:', err);
    return false;
  }
}

export async function loadMemoriesFromIndexedDb(): Promise<any[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEMORIES_STORE, 'readonly');
      const store = tx.objectStore(MEMORIES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB loadMemories error:', err);
    return [];
  }
}

export async function saveCommunicationDatasetItem(datasetItem: any): Promise<boolean> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DATASETS_STORE, 'readwrite');
      const store = tx.objectStore(DATASETS_STORE);
      store.put(datasetItem);

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB saveCommunicationDatasetItem error:', err);
    return false;
  }
}

export async function loadCommunicationDatasets(): Promise<any[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DATASETS_STORE, 'readonly');
      const store = tx.objectStore(DATASETS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB loadCommunicationDatasets error:', err);
    return [];
  }
}
