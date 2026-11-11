/* Persistent shell / double-buffered navigation assertions. Run: node tests/navigation-shell-test.js */
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(base, 'src/app.js'), 'utf8');
const pages = ['dashboard','transactions','budgets','analytics','insights','goals','reports','settings'];
for (const page of pages) {
  const html = fs.readFileSync(path.join(base, page + '.html'), 'utf8');
  if (!html.includes(`data-page="${page}"`)) throw new Error(`Missing page identity: ${page}`);
  if (html.includes('boot-screen') || html.includes('startup=1')) throw new Error(`A child page still contains startup loading: ${page}`);
}
for (const required of ['vnd-boot','vnd-frame-a','vnd-frame-b','is-preparing','is-leaving','VND_SAVE_APP_NAV_V1','completePage','prefers-reduced-motion']) {
  if (!shell.includes(required)) throw new Error(`Missing shell transition behavior: ${required}`);
}
for (const required of ["type: 'navigate'", "type: 'ready'", 'navigatePage(nextPage)', 'notifyParentReady()']) {
  if (!app.includes(required)) throw new Error(`Missing child-to-shell navigation handshake: ${required}`);
}
if (!app.includes("window.parent.postMessage({ channel: NAV_CHANNEL, type: 'navigate', page: nextPage }, '*')")) throw new Error('Page changes must be sent to the persistent shell.');
console.log('VND Save persistent navigation shell tests: PASS');
