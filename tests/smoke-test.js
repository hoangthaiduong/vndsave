/* Lightweight core smoke tests. Run: node tests/smoke-test.js */
const fs = require('fs');
const vm = require('vm');
global.window = global;
for (const file of ['src/core/finance.js', 'src/core/backup.js']) {
  vm.runInThisContext(fs.readFileSync(require('path').join(__dirname, '..', file), 'utf8'), { filename: file });
}
const F = global.VNDFinance;
const categories = F.DEFAULT_CATEGORIES;
const sample = {
  profile: { name: 'Test', monthlyIncome: 12000000 },
  categories,
  transactions: [
    { id: 't1', name: 'Lương', type: 'income', categoryId: 'inc-salary', amount: 12000000, date: '2026-11-01', note: '' },
    { id: 't2', name: 'Ăn trưa', type: 'expense', categoryId: 'exp-food', amount: 80000, date: '2026-11-02', note: '' },
    { id: 't3', name: 'Xe buýt', type: 'expense', categoryId: 'exp-transport', amount: 20000, date: '2026-11-03', note: '' }
  ],
  budgets: [{ id: 'b1', categoryId: 'exp-food', amount: 100000, month: '2026-11' }],
  savingsGoals: [{ id: 'g1', name: 'Quỹ dự phòng', target: 5000000, saved: 1000000, deadline: null }],
  settings: { theme: 'dark' },
  onboardingComplete: true
};
const t = F.totals(sample.transactions, '2026-11');
if (t.income !== 12000000 || t.expense !== 100000 || t.net !== 11900000) throw new Error('Finance totals are incorrect.');
const b = F.budgetUsage(sample.transactions, sample.budgets, categories, '2026-11')[0];
if (b.spent !== 80000 || b.percent !== 80 || b.status !== 'warning') throw new Error('Budget progress threshold is incorrect.');
const analysis = F.analyze(sample.transactions, sample.budgets, categories, '2026-11');
if (analysis.current.expense !== 100000 || analysis.spending[0].id !== 'exp-food') throw new Error('Insight analysis is incorrect.');
const payload = VNDBackup.build(sample);
const restored = VNDBackup.validate(payload);
if (restored.transactions.length !== 3 || restored.savingsGoals.length !== 1 || restored.settings.theme !== 'dark') throw new Error('Backup round-trip validation failed.');
let rejected = false;
try { VNDBackup.validate({ ...payload, app: 'Other App' }); } catch (_) { rejected = true; }
if (!rejected) throw new Error('Backup validation accepted an unrelated file.');
const wrongType = JSON.parse(JSON.stringify(payload));
wrongType.data.transactions[1].type = 'income';
rejected = false;
try { VNDBackup.validate(wrongType); } catch (_) { rejected = true; }
if (!rejected) throw new Error('Backup validation accepted a transaction/category mismatch.');
console.log('VND Save core smoke tests: PASS');
