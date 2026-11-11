(function () {
  'use strict';
  const APP = 'VND Save';
  const VERSION = 1;
  const REQUIRED_ARRAYS = ['transactions', 'categories', 'budgets', 'savingsGoals'];

  function build(state) {
    return {
      app: APP,
      formatVersion: VERSION,
      createdAt: new Date().toISOString(),
      metadata: { product: 'VND Save', currency: 'VND', storage: 'local-device' },
      data: {
        profile: state.profile,
        transactions: state.transactions,
        categories: state.categories,
        budgets: state.budgets,
        savingsGoals: state.savingsGoals,
        settings: state.settings,
        onboardingComplete: !!state.onboardingComplete
      }
    };
  }

  function validate(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('File không có cấu trúc JSON hợp lệ.');
    if (payload.app !== APP) throw new Error('Tệp này không phải bản sao lưu của VND Save.');
    if (payload.formatVersion !== VERSION) throw new Error('Phiên bản backup không được hỗ trợ (đang hỗ trợ v' + VERSION + ').');
    if (!payload.data || typeof payload.data !== 'object') throw new Error('Không tìm thấy phần dữ liệu trong file backup.');
    const data = payload.data;
    if (!data.profile || typeof data.profile.name !== 'string' || !Number.isFinite(Number(data.profile.monthlyIncome))) throw new Error('Thông tin hồ sơ bị thiếu hoặc không hợp lệ.');
    REQUIRED_ARRAYS.forEach(key => { if (!Array.isArray(data[key])) throw new Error('Dữ liệu mục "' + key + '" không hợp lệ.'); });
    if (!data.settings || typeof data.settings !== 'object') throw new Error('Thiết lập ứng dụng không hợp lệ.');
    const ids = new Set();
    const categoryTypes = new Map();
    data.categories.forEach((c, i) => {
      if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || !['income', 'expense'].includes(c.type)) throw new Error('Danh mục thứ ' + (i + 1) + ' không hợp lệ.');
      if (ids.has(c.id)) throw new Error('Phát hiện ID danh mục bị trùng.'); ids.add(c.id); categoryTypes.set(c.id, c.type);
    });
    const txIds = new Set();
    data.transactions.forEach((t, i) => {
      if (!t || typeof t.id !== 'string' || !t.id || txIds.has(t.id)) throw new Error('Giao dịch thứ ' + (i + 1) + ' có ID không hợp lệ hoặc bị trùng.');
      if (!['income', 'expense'].includes(t.type) || typeof t.name !== 'string' || !t.name.trim() || !Number.isSafeInteger(Number(t.amount)) || Number(t.amount) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) throw new Error('Thông tin giao dịch thứ ' + (i + 1) + ' không hợp lệ.');
      if (!ids.has(t.categoryId)) throw new Error('Giao dịch "' + t.name + '" đang tham chiếu đến danh mục không tồn tại.');
      if (categoryTypes.get(t.categoryId) !== t.type) throw new Error('Loại danh mục không khớp với giao dịch "' + t.name + '".');
      txIds.add(t.id);
    });
    const budgetIds = new Set(), budgetKeys = new Set();
    data.budgets.forEach((b, i) => {
      const key = b && b.categoryId + '|' + b.month;
      if (!b || typeof b.id !== 'string' || budgetIds.has(b.id) || !ids.has(b.categoryId) || categoryTypes.get(b.categoryId) !== 'expense' || !/^\d{4}-\d{2}$/.test(b.month) || !Number.isSafeInteger(Number(b.amount)) || Number(b.amount) < 0 || budgetKeys.has(key)) throw new Error('Ngân sách thứ ' + (i + 1) + ' không hợp lệ hoặc bị trùng.');
      budgetIds.add(b.id); budgetKeys.add(key);
    });
    const goalIds = new Set();
    data.savingsGoals.forEach((g, i) => {
      if (!g || typeof g.id !== 'string' || goalIds.has(g.id) || typeof g.name !== 'string' || !g.name.trim() || !Number.isSafeInteger(Number(g.target)) || Number(g.target) <= 0 || !Number.isSafeInteger(Number(g.saved)) || Number(g.saved) < 0) throw new Error('Mục tiêu tiết kiệm thứ ' + (i + 1) + ' không hợp lệ hoặc bị trùng.');
      goalIds.add(g.id);
    });
    return {
      profile: { name: data.profile.name.trim(), monthlyIncome: Number(data.profile.monthlyIncome) },
      transactions: data.transactions,
      categories: data.categories,
      budgets: data.budgets,
      savingsGoals: data.savingsGoals,
      settings: { theme: ['light', 'dark', 'system'].includes(data.settings.theme) ? data.settings.theme : 'light' },
      onboardingComplete: !!data.onboardingComplete
    };
  }

  function download(state) {
    const blob = new Blob([JSON.stringify(build(state), null, 2)], { type: 'application/vnd.vndsave+json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = 'VND-Save-backup-' + stamp + '.vndsave';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function readFile(file) {
    if (!file) throw new Error('Chưa chọn file backup.');
    if (file.size > 25 * 1024 * 1024) throw new Error('File quá lớn (giới hạn 25 MB).');
    const raw = await file.text();
    let payload;
    try { payload = JSON.parse(raw); } catch (_) { throw new Error('Không thể đọc JSON. File có thể bị hỏng hoặc không đúng định dạng.'); }
    const restored = validate(payload);
    return {
      restored,
      summary: {
        app: payload.app,
        createdAt: payload.createdAt,
        transactions: restored.transactions.length,
        categories: restored.categories.length,
        budgets: restored.budgets.length,
        savingsGoals: restored.savingsGoals.length
      }
    };
  }
  window.VNDBackup = { build, validate, download, readFile, VERSION };
})();
