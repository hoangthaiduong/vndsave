/* Simulates parent pages and their shared storage-host iframe without browser APIs. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const base = path.join(__dirname, '..');
const CHANNEL = 'VND_SAVE_STORAGE_BRIDGE_V1';
const parentListeners = [];
const hostListeners = [];
const backing = { profile: { name: 'Shared User' }, transactions: [1, 2, 3] };
let fallbackMode = false;
const parentWindow = {
  location: { href: 'file:///local/vnd-save/index.html' },
  addEventListener(type, fn) { if (type === 'message') parentListeners.push(fn); },
  postMessage(data) { parentListeners.forEach(fn => fn({ source: iframeWindow, data, origin: 'null' })); }
};
const iframeWindow = {
  postMessage(data) { hostListeners.forEach(fn => fn({ source: parentWindow, data, origin: 'null' })); }
};
const frame = {
  contentWindow: iframeWindow,
  style: {},
  addEventListener() {},
  setAttribute() {}
};
const parentDocument = { body: { appendChild() {} }, createElement(name) { if (name !== 'iframe') throw new Error('Unexpected node'); return frame; } };
const parentSandbox = {
  window: parentWindow,
  document: parentDocument,
  URL,
  location: { href: 'file:///local/vnd-save/index.html' },
  setTimeout(fn) { return 1; }, clearTimeout() {},
  console
};
vm.createContext(parentSandbox);
vm.runInContext(fs.readFileSync(path.join(base, 'src/core/storage-bridge.js'), 'utf8'), parentSandbox, { filename: 'storage-bridge.js' });

const hostWindow = {
  parent: parentWindow,
  VNDStorage: {
    async read() { return JSON.parse(JSON.stringify(backing)); },
    async write(state) { Object.keys(backing).forEach(k => delete backing[k]); Object.assign(backing, state); return { mode: 'indexeddb' }; },
    async replace(state) { Object.keys(backing).forEach(k => delete backing[k]); Object.assign(backing, state); return { mode: 'indexeddb' }; },
    async clear() { Object.keys(backing).forEach(k => delete backing[k]); },
    getUsingFallback() { return fallbackMode; }
  },
  addEventListener(type, fn) { if (type === 'message') hostListeners.push(fn); }
};
const hostSandbox = { window: hostWindow, console };
vm.createContext(hostSandbox);
vm.runInContext(fs.readFileSync(path.join(base, 'src/core/storage-host-bridge.js'), 'utf8'), hostSandbox, { filename: 'storage-host-bridge.js' });

(async () => {
  const first = await parentSandbox.window.VNDStorage.read();
  if (first.profile.name !== 'Shared User' || first.transactions.length !== 3) throw new Error('Bridge read failed.');
  await parentSandbox.window.VNDStorage.write({ profile: { name: 'Updated User' }, transactions: [7] });
  const second = await parentSandbox.window.VNDStorage.read();
  if (second.profile.name !== 'Updated User' || second.transactions[0] !== 7) throw new Error('Bridge write/read failed.');
  await parentSandbox.window.VNDStorage.replace({ profile: { name: 'Restored User' }, transactions: [] });
  const third = await parentSandbox.window.VNDStorage.read();
  if (third.profile.name !== 'Restored User' || third.transactions.length !== 0) throw new Error('Bridge replace failed.');
  await parentSandbox.window.VNDStorage.clear();
  const fourth = await parentSandbox.window.VNDStorage.read();
  if (Object.keys(fourth).length !== 0) throw new Error('Bridge clear failed.');
  console.log('VND Save shared storage bridge tests: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
