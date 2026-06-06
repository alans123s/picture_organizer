'use strict';

/**
 * Armazenamento local no próprio aparelho (IndexedDB).
 * Guarda cada cadastro com as fotos (Blobs) para funcionar 100% offline.
 * A sincronização com o servidor/Drive acontece depois, quando houver internet.
 */
window.IDB = (() => {
  const DB_NAME = 'cadastro-motores';
  const STORE = 'cadastros';
  const VERSION = 1;
  let dbp;

  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: 'id' });
            store.createIndex('status', 'status', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }

  async function write(fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function read(fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    add: (record) => write((s) => s.put(record)),
    getAll: () => read((s) => s.getAll()),
    getPending: () => read((s) => s.index('status').getAll('pendente')),
    async update(id, patch) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const g = store.get(id);
        g.onsuccess = () => {
          const cur = g.result;
          if (cur) {
            Object.assign(cur, patch);
            store.put(cur);
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    remove: (id) => write((s) => s.delete(id)),
  };
})();
