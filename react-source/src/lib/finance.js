export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Ăn uống', icon: 'utensils', color: '#F59E0B', budget: 0, active: true },
  { id: 'education', name: 'Giáo dục', icon: 'book-open', color: '#8B5CF6', budget: 0, active: true },
  { id: 'entertainment', name: 'Giải trí', icon: 'clapperboard', color: '#EC4899', budget: 0, active: true },
  { id: 'shopping', name: 'Mua sắm', icon: 'shopping-bag', color: '#0EA5E9', budget: 0, active: true },
  { id: 'transport', name: 'Di chuyển', icon: 'car-front', color: '#14B8A6', budget: 0, active: true },
  { id: 'bills', name: 'Hóa đơn', icon: 'receipt', color: '#64748B', budget: 0, active: true },
  { id: 'health', name: 'Sức khỏe', icon: 'heart-pulse', color: '#EF4444', budget: 0, active: true },
  { id: 'other', name: 'Khác', icon: 'wallet', color: '#94A3B8', budget: 0, active: true },
];

export const CATEGORY_ICONS = [
  ['utensils', 'Ăn uống'], ['book-open', 'Giáo dục'], ['clapperboard', 'Giải trí'],
  ['shopping-bag', 'Mua sắm'], ['car-front', 'Di chuyển'], ['receipt', 'Hóa đơn'],
  ['heart-pulse', 'Sức khỏe'], ['wallet', 'Ví tiền'], ['home', 'Nhà cửa'],
  ['plane', 'Du lịch'], ['gift', 'Quà tặng'], ['briefcase-business', 'Công việc'],
  ['paw-print', 'Thú cưng'], ['more-horizontal', 'Khác'],
];

export const formatVND = (value, compact = false) => {
  const amount = Number(value) || 0;
  if (compact && Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr ₫`;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
};

export const formatDate = (value, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) => {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '—';
  return new Intl.DateTimeFormat('vi-VN', options).format(new Date(year, month - 1, day));
};

export const monthKey = (date = new Date()) => {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T12:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `Tháng ${m}, ${y}`;
};
export const shiftMonth = (key, offset) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return monthKey(d);
};
export const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function totals(transactions, key) {
  const rows = key ? transactions.filter((t) => t.date?.slice(0, 7) === key) : transactions;
  const result = rows.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount;
    else if (t.type === 'expense') acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0, balance: 0, count: rows.length });
  result.balance = result.income - result.expense;
  return result;
}

export const withBalance = (t) => ({ ...t, balance: t.income - t.expense });

export function budgetFor(budgets, categoryId, key) {
  const exact = budgets.find((b) => b.categoryId === categoryId && b.month === key);
  if (exact) return exact.amount;
  const previous = budgets
    .filter((b) => b.categoryId === categoryId && b.month < key)
    .sort((a, b) => b.month.localeCompare(a.month))[0];
  return previous?.amount ?? 0;
}

export function categorySpending(transactions, categoryId, key) {
  return transactions.filter((t) => t.type === 'expense' && t.categoryId === categoryId && t.date?.slice(0, 7) === key)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function monthlySeries(transactions, count = 6, endKey = monthKey()) {
  return Array.from({ length: count }, (_, i) => {
    const key = shiftMonth(endKey, i - count + 1);
    const t = totals(transactions, key);
    return { key, label: `T${Number(key.slice(5))}`, income: t.income, expense: t.expense };
  });
}

export function periodTransactions(transactions, period, year, month) {
  if (period === 'month') return transactions.filter((t) => t.date?.slice(0, 7) === `${year}-${String(month).padStart(2, '0')}`);
  if (period === 'quarter') {
    const q = Math.floor((month - 1) / 3);
    return transactions.filter((t) => {
      const d = new Date(`${t.date}T12:00:00`);
      return d.getFullYear() === year && Math.floor(d.getMonth() / 3) === q;
    });
  }
  return transactions.filter((t) => Number(t.date?.slice(0, 4)) === year);
}

export function percentChange(current, previous) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function safePercent(numerator, denominator) {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}
