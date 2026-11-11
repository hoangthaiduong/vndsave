(function () {
  'use strict';
  const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  const DEFAULT_CATEGORIES = [
    { id: 'inc-salary', name: 'Lương', type: 'income', color: '#16A34A' },
    { id: 'inc-bonus', name: 'Thưởng', type: 'income', color: '#0D9488' },
    { id: 'inc-gift', name: 'Tiền được cho', type: 'income', color: '#0891B2' },
    { id: 'inc-other', name: 'Thu nhập khác', type: 'income', color: '#64748B' },
    { id: 'exp-food', name: 'Ăn uống', type: 'expense', color: '#2563EB' },
    { id: 'exp-transport', name: 'Di chuyển', type: 'expense', color: '#7C3AED' },
    { id: 'exp-education', name: 'Học tập', type: 'expense', color: '#0D9488' },
    { id: 'exp-shopping', name: 'Mua sắm', type: 'expense', color: '#D97706' },
    { id: 'exp-entertainment', name: 'Giải trí', type: 'expense', color: '#DB2777' },
    { id: 'exp-health', name: 'Sức khỏe', type: 'expense', color: '#DC2626' },
    { id: 'exp-bills', name: 'Hóa đơn', type: 'expense', color: '#64748B' },
    { id: 'exp-other', name: 'Khác', type: 'expense', color: '#94A3B8' }
  ];
  const PALETTE = ['#2563EB', '#7C3AED', '#0D9488', '#D97706', '#DB2777', '#DC2626', '#0891B2', '#65A30D', '#64748B', '#EA580C'];
  const uid = (prefix) => (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const money = (value) => nf.format(Math.round(Number(value) || 0)) + ' ₫';
  const number = (value) => Math.round(Number(value) || 0);
  const monthKey = (date) => String(date || '').slice(0, 7);
  const currentMonth = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const localDate = (date) => {
    const d = date ? new Date(date + 'T00:00:00') : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const dateLabel = (date, options) => {
    if (!date) return '—';
    const d = new Date(date + 'T00:00:00');
    return new Intl.DateTimeFormat('vi-VN', options || { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  };
  const monthLabel = (month) => {
    if (!month) return '—';
    const [y, m] = month.split('-').map(Number);
    return 'Tháng ' + m + ', ' + y;
  };
  const monthTransactions = (transactions, month) => transactions.filter(t => monthKey(t.date) === month);
  const sum = (items, predicate) => items.reduce((total, item) => predicate(item) ? total + number(item.amount) : total, 0);
  const totals = (transactions, month) => {
    const list = month ? monthTransactions(transactions, month) : transactions;
    const income = sum(list, t => t.type === 'income');
    const expense = sum(list, t => t.type === 'expense');
    return { income, expense, net: income - expense, count: list.length };
  };
  const categoryById = (categories, id) => categories.find(c => c.id === id);
  const categoryTotals = (transactions, categories, month, type) => {
    const list = month ? monthTransactions(transactions, month) : transactions;
    return categories.filter(c => !type || c.type === type).map(c => ({
      ...c,
      amount: sum(list, t => t.categoryId === c.id && (!type || t.type === type))
    })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
  };
  const budgetUsage = (transactions, budgets, categories, month) => {
    const rows = budgets.filter(b => b.month === month).map(b => {
      const category = categoryById(categories, b.categoryId);
      const spent = sum(monthTransactions(transactions, month), t => t.type === 'expense' && t.categoryId === b.categoryId);
      const amount = number(b.amount);
      const percent = amount > 0 ? spent / amount * 100 : (spent > 0 ? 100 : 0);
      return { ...b, categoryName: category ? category.name : 'Danh mục đã xóa', color: category ? category.color : '#94A3B8', spent, remaining: amount - spent, percent, status: percent >= 100 ? 'over' : percent >= 80 ? 'warning' : 'normal' };
    });
    return rows.sort((a, b) => b.percent - a.percent);
  };
  const budgetTotals = (rows) => ({
    total: rows.reduce((s, b) => s + number(b.amount), 0),
    spent: rows.reduce((s, b) => s + b.spent, 0),
    remaining: rows.reduce((s, b) => s + b.amount - b.spent, 0)
  });
  const byDay = (transactions, month) => {
    const [year, m] = month.split('-').map(Number);
    const days = new Date(year, m, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const key = month + '-' + String(i + 1).padStart(2, '0');
      return { label: String(i + 1), income: sum(transactions, t => t.date === key && t.type === 'income'), expense: sum(transactions, t => t.date === key && t.type === 'expense') };
    });
  };
  const monthlySeries = (transactions, count, endingMonth) => {
    const [y, m] = endingMonth.split('-').map(Number);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(y, m - 1 - (count - 1 - i), 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const t = totals(transactions, key);
      return { month: key, label: 'T' + (d.getMonth() + 1), income: t.income, expense: t.expense };
    });
  };
  const analyze = (transactions, budgets, categories, month) => {
    const current = totals(transactions, month);
    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = prevDate.getFullYear() + '-' + String(prevDate.getMonth() + 1).padStart(2, '0');
    const previous = totals(transactions, prevMonth);
    const spending = categoryTotals(transactions, categories, month, 'expense');
    const previousSpending = categoryTotals(transactions, categories, prevMonth, 'expense');
    const budgetRows = budgetUsage(transactions, budgets, categories, month);
    const days = Math.max(1, Number(month === currentMonth() ? new Date().getDate() : new Date(y, m, 0).getDate()));
    const notes = [];
    if (current.count > 0) notes.push({ type: 'info', title: 'Tổng chi tiêu', detail: 'Bạn đã chi ' + money(current.expense) + ' trong ' + monthLabel(month).toLowerCase() + '.' });
    if (spending.length) notes.push({ type: 'info', title: 'Danh mục chi tiêu lớn nhất', detail: spending[0].name + ' đang chiếm vị trí đầu với ' + money(spending[0].amount) + (current.expense ? ' (' + Math.round(spending[0].amount / current.expense * 100) + '% tổng chi tiêu).' : '.') });
    if (previous.count > 0 && previousSpending.length > 0 && spending.length > 0) {
      const oldTop = previousSpending[0];
      const nowForCategory = spending.find(c => c.id === oldTop.id);
      if (nowForCategory && oldTop.amount > 0 && nowForCategory.amount > oldTop.amount) {
        const pct = (nowForCategory.amount - oldTop.amount) / oldTop.amount * 100;
        notes.push({ type: pct >= 20 ? 'warning' : 'info', title: 'Danh mục tăng chi tiêu', detail: oldTop.name + ' tăng ' + pct.toFixed(1) + '% so với tháng trước (' + money(oldTop.amount) + ' lên ' + money(nowForCategory.amount) + ').' });
      }
    }
    if (previous.count > 0 && previous.expense > 0) {
      const change = (current.expense - previous.expense) / previous.expense * 100;
      notes.push({ type: change > 0 ? 'warning' : 'success', title: 'So với tháng trước', detail: 'Chi tiêu ' + (change > 0 ? 'tăng ' : 'giảm ') + Math.abs(change).toFixed(1) + '% so với ' + monthLabel(prevMonth).toLowerCase() + '.' });
    } else {
      notes.push({ type: 'muted', title: 'Chưa đủ dữ liệu so sánh', detail: 'Cần có giao dịch của tháng trước để so sánh xu hướng chi tiêu.' });
    }
    if (current.income > 0) notes.push({ type: current.expense / current.income > 0.8 ? 'warning' : 'success', title: 'Tỷ lệ chi tiêu trên thu nhập', detail: (current.expense / current.income * 100).toFixed(1) + '% thu nhập thực nhận trong tháng đã được sử dụng.' });
    budgetRows.filter(b => b.status !== 'normal').forEach(b => notes.push({ type: b.status === 'over' ? 'danger' : 'warning', title: b.status === 'over' ? 'Vượt ngân sách: ' + b.categoryName : 'Sắp chạm ngân sách: ' + b.categoryName, detail: 'Đã sử dụng ' + Math.round(b.percent) + '% ngân sách (' + money(b.spent) + ' / ' + money(b.amount) + ').' }));
    return { current, previous, prevMonth, spending, previousSpending, budgetRows, averageDaily: current.expense / days, expenseRatio: current.income > 0 ? current.expense / current.income * 100 : null, notes };
  };
  window.VNDFinance = { DEFAULT_CATEGORIES, PALETTE, uid, money, number, monthKey, currentMonth, localDate, dateLabel, monthLabel, monthTransactions, totals, categoryById, categoryTotals, budgetUsage, budgetTotals, byDay, monthlySeries, analyze };
})();
