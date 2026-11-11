/* Onboarding flow smoke test with a minimal DOM shim. Run: node tests/onboarding-smoke-test.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const initial = { profile: { name: '', monthlyIncome: 0 }, transactions: [], categories: null, budgets: [], savingsGoals: [], settings: { theme: 'light' }, onboardingComplete: false };
let stored = JSON.stringify(initial);
const root = { innerHTML: '' };
const toastRegion = { appendChild() {} };
const listeners = {};
global.window = global;
global.location = { hash: '', assign(url) { global.lastNavigation = url; } };
global.matchMedia = () => ({ matches: false, addEventListener() {} });
global.addEventListener = () => {};
global.localStorage = {
  getItem(key) { if (key === 'vnd-save-use-fallback') return '1'; if (key === 'vnd-save-state-v1') return stored; return null; },
  setItem(key, value) { if (key === 'vnd-save-state-v1') stored = value; },
  removeItem() {}
};
global.document = {
  body: { dataset: { page: 'dashboard' } },
  documentElement: { dataset: {} },
  querySelector(selector) { if (selector === '#app') return root; if (selector === '#toast-region') return toastRegion; if (selector === 'meta[name="theme-color"]') return { setAttribute() {} }; return null; },
  addEventListener(name, fn) { listeners[name] = fn; },
  createElement() { return { dataset: {}, remove() {}, isConnected: false }; }
};
global.setTimeout = () => 0;
class FakeFormData {
  constructor(form) { this.form = form; }
  get(key) {
    const values = this.form.values || {};
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
  }
}
global.FormData = FakeFormData;
for (const file of ['src/core/storage.js','src/core/finance.js','src/core/backup.js','src/ui/icons.js','src/ui/charts.js','src/app.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { filename: file });
}
function click(action) {
  const target = { dataset: { action }, closest() { return this; } };
  listeners.click({ target });
}
function submit(kind, values, extra) {
  const form = {
    dataset: { form: kind }, values: values || {},
    closest() { return this; },
    querySelectorAll() { return extra && extra.inputs ? extra.inputs : []; },
    querySelector() { return extra && extra.month ? { value: extra.month } : null; }
  };
  listeners.submit({ target: form, preventDefault() {} });
}
setImmediate(() => {
  if (!root.innerHTML.includes('onboarding-shell')) throw new Error('Welcome step did not render.');
  click('onboarding-next');
  if (!root.innerHTML.includes('onboard-profile')) throw new Error('Profile step did not render.');
  submit('onboard-profile', { name: 'Minh Anh', monthlyIncome: '12000000' });
  if (!root.innerHTML.includes('Bước 02')) throw new Error('Category step did not render.');
  submit('onboard-category', { name: 'Thu nhập phụ', type: 'income' });
  if (!root.innerHTML.includes('Thu nhập phụ')) throw new Error('Custom onboarding category was not added.');
  click('onboarding-next');
  if (!root.innerHTML.includes('Bước 03')) throw new Error('Budget step did not render.');
  submit('onboard-budget', {}, { month: '2026-11', inputs: [] });
  if (!root.innerHTML.includes('Bước 04')) throw new Error('Completion step did not render.');
  click('finish-onboarding');
  setImmediate(() => {
    const savedState = JSON.parse(stored);
    if (!savedState.onboardingComplete || savedState.profile.name !== 'Minh Anh') throw new Error('Onboarding state was not persisted.');
    if (global.lastNavigation) throw new Error('Onboarding should complete in-place without a document navigation.');
    if (!root.innerHTML.includes('page-container')) throw new Error('Onboarding should render the dashboard immediately after completion.');
    console.log('VND Save onboarding smoke test: PASS');
  });
});
