/* Render smoke test for the eight separate HTML entry points. Run: node tests/render-smoke-test.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const base = path.join(__dirname, '..');
const sample = {
  profile: { name: 'Nguyễn Minh', monthlyIncome: 15000000 },
  categories: null,
  transactions: [
    { id: 'tx1', name: 'Lương tháng', type: 'income', categoryId: 'inc-salary', amount: 15000000, date: '2026-11-01', note: '', createdAt: 1 },
    { id: 'tx2', name: 'Ăn trưa', type: 'expense', categoryId: 'exp-food', amount: 85000, date: '2026-11-05', note: 'Cơm văn phòng', createdAt: 2 },
    { id: 'tx3', name: 'Xe buýt', type: 'expense', categoryId: 'exp-transport', amount: 30000, date: '2026-11-06', note: '', createdAt: 3 }
  ],
  budgets: [{ id: 'budget1', categoryId: 'exp-food', amount: 100000, month: '2026-11' }],
  savingsGoals: [{ id: 'goal1', name: 'Quỹ dự phòng', target: 5000000, saved: 1200000, deadline: '2026-12-31' }],
  settings: { theme: 'light' }, onboardingComplete: true
};
const pages = [
  ['dashboard.html', 'dashboard', 'Tổng quan'],
  ['transactions.html', 'transactions', 'Giao dịch'],
  ['budgets.html', 'budgets', 'Ngân sách'],
  ['analytics.html', 'analytics', 'Phân tích'],
  ['insights.html', 'insights', 'Góc nhìn tài chính'],
  ['goals.html', 'goals', 'Mục tiêu tiết kiệm'],
  ['reports.html', 'reports', 'Báo cáo'],
  ['settings.html', 'settings', 'Cài đặt']
];

function createContext(page) {
  const root = { innerHTML: '' };
  const toastRegion = { appendChild() {} };
  const listeners = {};
  const document = {
    body: { dataset: { page } },
    documentElement: { dataset: {} },
    querySelector(selector) {
      if (selector === '#app') return root;
      if (selector === '#toast-region') return toastRegion;
      if (selector === 'meta[name="theme-color"]') return { setAttribute() {} };
      return null;
    },
    addEventListener(name, fn) { listeners[name] = fn; },
    createElement() { return { dataset: {}, className: '', innerHTML: '', remove() {}, isConnected: false }; }
  };
  const sandbox = {
    console, document, location: { assign(url) { sandbox.lastNavigation = url; } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}, setTimeout: () => 0, clearTimeout() {},
    VNDStorage: { read: async () => JSON.parse(JSON.stringify(sample)), getUsingFallback: () => false, write: async () => ({}), replace: async () => ({}), clear: async () => {} }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  for (const file of ['src/core/finance.js', 'src/core/backup.js', 'src/ui/icons.js', 'src/ui/charts.js', 'src/app.js']) {
    vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), context, { filename: file });
  }
  return new Promise(resolve => setImmediate(() => resolve({ root, listeners, sandbox, document })));
}

(async () => {
  for (const [file, page, title] of pages) {
    const html = fs.readFileSync(path.join(base, file), 'utf8');
    if (!html.includes(`data-page="${page}"`)) throw new Error(`Wrong page identity: ${file}`);
    for (const asset of ['./src/styles/tokens.css', './src/styles/app.css', './src/styles/responsive.css', './src/core/storage-bridge.js', './src/core/finance.js', './src/core/backup.js', './src/ui/icons.js', './src/ui/charts.js', './src/app.js']) {
      if (!fs.existsSync(path.join(base, asset.slice(2)))) throw new Error(`Missing shared asset ${asset} from ${file}`);
      if (!html.includes(asset)) throw new Error(`Page ${file} does not load ${asset}`);
    }
    for (const asset of ['./public/logo.svg', './public/favicon.svg']) {
      if (!fs.existsSync(path.join(base, asset.slice(2)))) throw new Error(`Missing shared brand asset ${asset}.`);
    }
    const ctx = await createContext(page);
    if (!ctx.root.innerHTML.includes('class="page-container"')) throw new Error(`Page did not render: ${page}`);
    if (!ctx.root.innerHTML.includes(title)) throw new Error(`Page title missing: ${page}`);
    if (ctx.root.innerHTML.includes('undefined')) throw new Error(`Undefined text found on page: ${page}`);
    if (page === 'settings') {
      for (const tab of ['profile', 'categories', 'appearance', 'data', 'about']) {
        const target = { dataset: { settingsTab: tab }, closest() { return this; } };
        ctx.listeners.click({ target });
        if (!ctx.root.innerHTML.includes('settings-panel')) throw new Error(`Settings tab did not render: ${tab}`);
      }
    }
  }
  const launcher = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  if (!launcher.includes('id=\"vnd-boot\"') || !launcher.includes('id=\"vnd-frame-a\"') || !launcher.includes('id=\"vnd-frame-b\"')) throw new Error('index.html must own the one-time startup layer and double-buffered page frames.');
  if (!launcher.includes('220ms') || !launcher.includes('VND_SAVE_APP_NAV_V1')) throw new Error('The app shell must crossfade between ready pages.');
  const dashboardHtml = fs.readFileSync(path.join(base, 'dashboard.html'), 'utf8');
  if (dashboardHtml.includes('boot-screen') || dashboardHtml.includes('startup=1')) throw new Error('Dashboard must not contain a startup loading screen.');
  for (const [file] of pages.filter(([file]) => file !== 'dashboard.html')) {
    const html = fs.readFileSync(path.join(base, file), 'utf8');
    if (html.includes('boot-screen') || html.includes('boot-progress')) throw new Error(`Unexpected loading screen in internal page: ${file}`);
  }
  const appSource = fs.readFileSync(path.join(base, 'src/app.js'), 'utf8');
  if (!appSource.includes("type: 'ready', page")) throw new Error('Each page must notify the shell after its initial render.');
  if (!appSource.includes('function navigatePage(nextPage)')) throw new Error('Navigation should be mediated by the persistent shell.');
  if (appSource.includes("window.location.assign('dashboard.html')")) throw new Error('Onboarding should render the dashboard without reloading the document.');
  const navContext = await createContext('transactions');
  for (const [file, page] of pages) {
    if (page === 'transactions') continue;
    const navTarget = { dataset: { page }, closest() { return this; } };
    navContext.listeners.click({ target: navTarget });
    if (navContext.sandbox.lastNavigation !== file) throw new Error(`Navigation for ${page} does not open ${file}.`);
  }
  const host = fs.readFileSync(path.join(base, 'storage-host.html'), 'utf8');
  if (!host.includes('src/core/storage.js') || !host.includes('src/core/storage-host-bridge.js')) throw new Error('Shared storage host is incomplete.');
  console.log('VND Save eight-page render smoke tests: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
