const DB_NAME = 'vnd-save-db';
const DB_VERSION = 1;
const STORES = ['profile', 'categories', 'transactions', 'budgets', 'savingsGoals', 'settings'];

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Trình duyệt này không hỗ trợ IndexedDB.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không thể mở cơ sở dữ liệu.'));
    request.onblocked = () => reject(new Error('Cơ sở dữ liệu đang bị chặn bởi một tab khác.'));
  });
}

const dbPromise = openDatabase();

function readStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState() {
  const db = await dbPromise;
  const entries = await Promise.all(STORES.map((name) => readStore(db, name)));
  const result = Object.fromEntries(STORES.map((name, index) => [name, entries[index]]));
  return {
    profile: result.profile[0] || null,
    categories: result.categories,
    transactions: result.transactions,
    budgets: result.budgets,
    savingsGoals: result.savingsGoals,
    settings: result.settings[0] || { id: 'app', theme: 'light', currency: 'VND' },
  };
}

export async function saveState(state) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    const payloads = {
      profile: state.profile ? [{ ...state.profile, id: 'profile' }] : [],
      categories: state.categories || [],
      transactions: state.transactions || [],
      budgets: state.budgets || [],
      savingsGoals: state.savingsGoals || [],
      settings: [{ ...(state.settings || {}), id: 'app' }],
    };
    for (const store of STORES) {
      const objectStore = tx.objectStore(store);
      objectStore.clear();
      for (const item of payloads[store]) objectStore.put(item);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('Không thể lưu dữ liệu.'));
    tx.onabort = () => reject(tx.error || new Error('Giao dịch lưu dữ liệu đã bị hủy.'));
  });
}

export async function clearDatabase() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    STORES.forEach((store) => tx.objectStore(store).clear());
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
