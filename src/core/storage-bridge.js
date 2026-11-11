(function () {
  'use strict';
  // A single hidden storage document keeps file:// pages on one IndexedDB origin.
  // Modern browsers may assign a unique origin to every file path, so each HTML
  // page delegates storage operations to the same storage-host.html document.
  const CHANNEL = 'VND_SAVE_STORAGE_BRIDGE_V1';
  const pending = new Map();
  let requestId = 0;
  let fallback = false;
  let frame = null;
  let readyResolve;
  let readyReject;
  let ready = false;

  const readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  function onMessage(event) {
    if (!frame || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL) return;
    if (message.type === 'ready') {
      ready = true;
      readyResolve();
      return;
    }
    if (message.type === 'response' && pending.has(message.id)) {
      const handlers = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(handlers.timer);
      fallback = Boolean(message.fallback);
      if (message.ok) handlers.resolve(message.result);
      else handlers.reject(new Error(message.error || 'Thao tác lưu trữ thất bại.'));
    }
  }

  window.addEventListener('message', onMessage);
  frame = document.createElement('iframe');
  frame.src = new URL('./storage-host.html', window.location.href).href;
  frame.title = 'VND Save local storage service';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none';
  frame.addEventListener('error', () => readyReject(new Error('Không thể mở kho lưu trữ dùng chung. Hãy giữ storage-host.html cùng thư mục với các trang ứng dụng.')));
  document.body.appendChild(frame);
  setTimeout(() => {
    if (!ready) readyReject(new Error('Kho lưu trữ dùng chung không phản hồi. Hãy kiểm tra storage-host.html có nằm trong thư mục dự án không.'));
  }, 10000);

  function request(action, payload) {
    return readyPromise.then(() => new Promise((resolve, reject) => {
      const id = ++requestId;
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error('Thao tác lưu trữ hết thời gian chờ. Vui lòng thử lại.'));
      }, 12000);
      pending.set(id, { resolve, reject, timer });
      try {
        frame.contentWindow.postMessage({ channel: CHANNEL, type: 'request', id, action, payload: payload || null }, '*');
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    }));
  }

  window.VNDStorage = {
    read: () => request('read'),
    write: (state) => request('write', { state }),
    replace: (state) => request('replace', { state }),
    clear: () => request('clear'),
    getUsingFallback: () => fallback,
    getDatabaseName: () => 'vnd-save-local'
  };
})();
