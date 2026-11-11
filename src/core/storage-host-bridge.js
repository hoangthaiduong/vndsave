(function () {
  'use strict';
  const CHANNEL = 'VND_SAVE_STORAGE_BRIDGE_V1';
  const allowed = new Set(['read', 'write', 'replace', 'clear']);

  window.addEventListener('message', async (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || message.type !== 'request' || !allowed.has(message.action)) return;
    try {
      let result;
      if (message.action === 'read') result = await window.VNDStorage.read();
      if (message.action === 'write') result = await window.VNDStorage.write(message.payload && message.payload.state);
      if (message.action === 'replace') result = await window.VNDStorage.replace(message.payload && message.payload.state);
      if (message.action === 'clear') result = await window.VNDStorage.clear();
      event.source.postMessage({ channel: CHANNEL, type: 'response', id: message.id, ok: true, result, fallback: window.VNDStorage.getUsingFallback() }, '*');
    } catch (error) {
      event.source.postMessage({ channel: CHANNEL, type: 'response', id: message.id, ok: false, error: error && error.message ? error.message : 'Không thể truy cập dữ liệu.', fallback: window.VNDStorage.getUsingFallback() }, '*');
    }
  });

  // The iframe origin is intentionally the same storage-host.html path for all pages.
  window.parent.postMessage({ channel: CHANNEL, type: 'ready' }, '*');
})();
