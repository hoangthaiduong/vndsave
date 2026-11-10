export const BACKUP_VERSION = 1;

function localDateStamp(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function createBackup(state) {
  return {
    format: 'vndsave',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: state.profile,
    categories: state.categories || [],
    transactions: state.transactions || [],
    budgets: state.budgets || [],
    savingsGoals: state.savingsGoals || [],
    settings: state.settings || { theme: 'light', currency: 'VND' },
  };
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Tệp không có cấu trúc dữ liệu hợp lệ.');
  if (data.format !== 'vndsave') throw new Error('Đây không phải tệp sao lưu VND Save (.vndsave).');
  if (data.version !== BACKUP_VERSION) throw new Error(`Phiên bản backup ${data.version ?? 'không xác định'} chưa được hỗ trợ. Phiên bản hiện tại: ${BACKUP_VERSION}.`);
  for (const key of ['categories', 'transactions', 'budgets', 'savingsGoals']) {
    if (!Array.isArray(data[key])) throw new Error(`Dữ liệu ${key} không hợp lệ.`);
  }
  if (!data.profile || typeof data.profile.name !== 'string' || !data.profile.name.trim() || !Number.isSafeInteger(data.profile.monthlyIncome) || data.profile.monthlyIncome < 0) throw new Error('Thông tin hồ sơ trong backup không hợp lệ.');
  if (!data.settings || typeof data.settings !== 'object' || !['light', 'dark'].includes(data.settings.theme || 'light')) throw new Error('Cài đặt trong backup không hợp lệ.');
  if (data.categories.some((c) => !c || typeof c !== 'object' || !c.id || typeof c.name !== 'string' || !c.name.trim())) throw new Error('Backup chứa danh mục không hợp lệ.');
  for (const key of ['categories', 'transactions', 'budgets', 'savingsGoals']) {
    const ids = data[key].map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Backup chứa ID bị trùng trong nhóm ${key}.`);
  }
  if (data.transactions.some((t) => {
    if (!t || typeof t !== 'object' || !t.id || !['income', 'expense'].includes(t.type) || !Number.isSafeInteger(t.amount) || t.amount <= 0 || typeof t.title !== 'string' || !t.title.trim() || typeof t.categoryName !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) return true;
    const date = new Date(`${t.date}T12:00:00`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== t.date;
  })) throw new Error('Backup chứa giao dịch không hợp lệ.');
  if (data.budgets.some((b) => !b || !b.id || !b.categoryId || !/^\d{4}-\d{2}$/.test(b.month || '') || !Number.isSafeInteger(b.amount) || b.amount < 0)) throw new Error('Backup chứa ngân sách không hợp lệ.');
  if (data.savingsGoals.some((g) => !g || !g.id || typeof g.name !== 'string' || !g.name.trim() || !Number.isSafeInteger(g.target) || g.target <= 0 || !Number.isSafeInteger(g.saved) || g.saved < 0)) throw new Error('Backup chứa mục tiêu tiết kiệm không hợp lệ.');
  return data;
}

export function downloadBackup(state) {
  const backup = createBackup(state);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/vnd.vndsave+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VND-Save-Backup-${localDateStamp()}.vndsave`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function downloadCSV(transactions) {
  const header = ['Ngày', 'Loại', 'Tên giao dịch', 'Danh mục', 'Số tiền (VND)', 'Ghi chú'];
  const rows = transactions.map((t) => [t.date, t.type === 'income' ? 'Thu nhập' : 'Chi tiêu', t.title, t.categoryName || '', t.amount, t.note || '']);
  const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VND-Save-Transactions-${localDateStamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
