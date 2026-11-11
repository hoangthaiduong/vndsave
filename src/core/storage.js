(function () {
  'use strict';
  const DB_NAME = 'vnd-save-local';
  const STORE = 'app-state';
  const KEY = 'primary';
  const FALLBACK_KEY = 'vnd-save-use-fallback';
  let dbPromise;
  let fallback = false;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      let request;
      let settled = false;
      let timer;
      const fail = (error) => { if (settled) return; settled = true; clearTimeout(timer); reject(error); };
      const succeed = (db) => { if (settled) { db.close(); return; } settled = true; clearTimeout(timer); resolve(db); };
      try { request = indexedDB.open(DB_NAME, 1); }
      catch (error) { fail(error); return; }
      timer = setTimeout(() => fail(new Error('IndexedDB không phản hồi trong thời gian cho phép.')), 5000);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => succeed(request.result);
      request.onerror = () => fail(request.error || new Error('Không thể mở kho dữ liệu.'));
      request.onblocked = () => fail(new Error('Kho dữ liệu đang được mở ở một cửa sổ khác.'));
    });
    return dbPromise;
  }

  async function read() {
    try {
      if (localStorage.getItem(FALLBACK_KEY) === '1') {
        const fallbackRaw = localStorage.getItem('vnd-save-state-v1');
        fallback = true;
        return fallbackRaw ? JSON.parse(fallbackRaw) : null;
      }
    } catch (_) {}
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('Không thể đọc dữ liệu.'));
      });
    } catch (error) {
      fallback = true;
      try {
        const raw = localStorage.getItem('vnd-save-state-v1');
        return raw ? JSON.parse(raw) : null;
      } catch (storageError) {
        throw new Error('Không thể truy cập bộ nhớ trên thiết bị này: ' + (storageError.message || error.message));
      }
    }
  }

  async function write(state) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(state, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Không thể ghi dữ liệu.'));
        tx.onabort = () => reject(tx.error || new Error('Đã hủy thao tác lưu dữ liệu.'));
      });
      fallback = false;
      try { localStorage.removeItem('vnd-save-state-v1'); localStorage.removeItem(FALLBACK_KEY); } catch (_) {}
      return { mode: 'indexeddb' };
    } catch (error) {
      try {
        localStorage.setItem('vnd-save-use-fallback', '1');
        localStorage.setItem('vnd-save-state-v1', JSON.stringify(state));
        fallback = true;
        return { mode: 'localstorage-fallback', warning: error.message };
      } catch (storageError) {
        throw new Error('Không thể lưu dữ liệu. Hãy kiểm tra dung lượng trống và quyền lưu trữ của trình duyệt.');
      }
    }
  }

  async function replace(state) {
    // The whole application state is a single IndexedDB record. A restore is therefore
    // one atomic put: a failed transaction leaves the previous record unchanged.
    return write(state);
  }

  async function clear() {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => { try { localStorage.removeItem('vnd-save-state-v1'); localStorage.removeItem(FALLBACK_KEY); } catch (_) {} resolve(); };
        tx.onerror = () => reject(tx.error || new Error('Không thể xóa dữ liệu.'));
        tx.onabort = () => reject(tx.error || new Error('Đã hủy thao tác xóa.'));
      });
    } catch (error) {
      try { localStorage.removeItem('vnd-save-state-v1'); localStorage.setItem(FALLBACK_KEY, '1'); fallback = true; }
      catch (_) { throw error; }
    }
  }

  window.VNDStorage = {
    read,
    write,
    replace,
    clear,
    getUsingFallback: () => fallback,
    getDatabaseName: () => DB_NAME
  };
})();
