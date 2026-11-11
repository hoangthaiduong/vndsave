(function () {
  'use strict';
  const F = window.VNDFinance;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const dateToday = () => F.localDate();
  const stateDefaults = () => ({
    profile: { name: '', monthlyIncome: 0 },
    transactions: [],
    categories: clone(F.DEFAULT_CATEGORIES),
    budgets: [],
    savingsGoals: [],
    settings: { theme: 'light' },
    onboardingComplete: false
  });
  let state = stateDefaults();
  const PAGE_FILES = { dashboard: 'dashboard.html', transactions: 'transactions.html', budgets: 'budgets.html', analytics: 'analytics.html', insights: 'insights.html', goals: 'goals.html', reports: 'reports.html', settings: 'settings.html' };
  const NAV_CHANNEL = 'VND_SAVE_APP_NAV_V1';
  function navigatePage(nextPage) {
    const destination = PAGE_FILES[nextPage];
    if (!destination || nextPage === page) return;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ channel: NAV_CHANNEL, type: 'navigate', page: nextPage }, '*');
    } else {
      window.location.assign(destination);
    }
  }
  function notifyParentReady() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ channel: NAV_CHANNEL, type: 'ready', page }, '*');
    }
  }
  let page = (document.body && document.body.dataset.page) || 'dashboard';
  let selectedMonth = F.currentMonth();
  let txFilters = { search: '', type: 'all', category: 'all', month: 'all', start: '', end: '', sort: 'date-desc', min: '', max: '' };
  let analyticsPeriod = '6m';
  let customRange = { start: '', end: '' };
  let reportPeriod = 'month';
  let settingsTab = 'profile';
  let modal = null;
  let pendingConfirm = null;
  let restoreDraft = null;
  let onboardStep = 0;
  let draft = null;
  let toastId = 0;
  let saveQueue = Promise.resolve();

  const pageMeta = {
    dashboard: ['Tổng quan', 'Bức tranh tài chính của bạn, được cập nhật theo từng giao dịch.'],
    transactions: ['Giao dịch', 'Theo dõi mọi khoản thu và chi trong một nơi.'],
    budgets: ['Ngân sách', 'Đặt giới hạn chi tiêu và theo dõi tiến độ theo tháng.'],
    analytics: ['Phân tích', 'Khám phá xu hướng thu nhập và chi tiêu của bạn.'],
    insights: ['Góc nhìn tài chính', 'Những quan sát được rút ra trực tiếp từ dữ liệu của bạn.'],
    goals: ['Mục tiêu tiết kiệm', 'Lập kế hoạch cho những điều quan trọng với bạn.'],
    reports: ['Báo cáo', 'Tổng hợp dòng tiền theo tháng, quý hoặc năm.'],
    settings: ['Cài đặt', 'Quản lý hồ sơ, danh mục, giao diện và dữ liệu cá nhân.']
  };

  function toast(title, message, type) {
    const region = $('#toast-region');
    const id = ++toastId;
    const icon = type === 'error' ? 'warning' : type === 'warning' ? 'info' : 'check';
    const node = document.createElement('div');
    node.className = 'toast ' + (type || 'success');
    node.innerHTML = '<div class="toast-icon">' + VNDIcon(icon, 17) + '</div><div><strong>' + esc(title) + '</strong><span>' + esc(message || '') + '</span></div><button class="icon-button" type="button" aria-label="Đóng thông báo" style="margin-left:auto;width:25px;height:25px" data-action="dismiss-toast">' + VNDIcon('close', 14) + '</button>';
    node.dataset.toastId = id;
    region.appendChild(node);
    setTimeout(() => { if (node.isConnected) node.remove(); }, 4300);
  }

  function persist(successMessage) {
    saveQueue = saveQueue.then(() => VNDStorage.write(state)).then((result) => {
      if (result.mode === 'localstorage-fallback') toast('Đã lưu ở chế độ dự phòng', 'IndexedDB không khả dụng; dữ liệu đang được lưu bằng bộ nhớ trình duyệt.', 'warning');
      if (successMessage) toast('Đã lưu thay đổi', successMessage, 'success');
      return result;
    }).catch(error => {
      toast('Không thể lưu dữ liệu', error.message || 'Vui lòng thử lại.', 'error');
      throw error;
    });
    return saveQueue;
  }

  function themeApply() {
    let theme = state.settings.theme || 'light';
    if (theme === 'system') theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#0B1220' : '#F8FAFC');
  }

  function category(id) { return F.categoryById(state.categories, id); }
  function categoryName(id) { const c = category(id); return c ? c.name : 'Danh mục đã xóa'; }
  function categoryColor(id) { const c = category(id); return c ? c.color : '#94A3B8'; }
  function currency(value) { return F.money(value); }
  function pageShell(content) {
    const [title, desc] = pageMeta[page] || pageMeta.dashboard;
    const initials = (state.profile.name || 'Bạn').trim().split(/\s+/).slice(-2).map(x => x[0]).join('').toUpperCase();
    return '<div class="app-shell">' +
      '<aside class="sidebar" id="sidebar">' +
        '<div class="brand"><img class="brand-logo" src="./public/logo.svg" alt="VND Save"/><div><div class="brand-name">VND Save</div><div class="brand-tag">Take Control of Your Money</div></div></div>' +
        '<div class="nav-section">Không gian của bạn</div><nav class="nav-list" aria-label="Điều hướng chính">' +
          navItem('dashboard', 'Tổng quan', 'dashboard') + navItem('transactions', 'Giao dịch', 'transactions') + navItem('budgets', 'Ngân sách', 'wallet') + navItem('analytics', 'Phân tích', 'analytics') +
        '</nav><div class="nav-section" style="margin-top:22px">Kế hoạch & báo cáo</div><nav class="nav-list">' +
          navItem('insights', 'Góc nhìn tài chính', 'insights') + navItem('goals', 'Mục tiêu tiết kiệm', 'savings') + navItem('reports', 'Báo cáo', 'reports') +
        '</nav><div class="nav-spacer"></div>' +
        '<div class="sidebar-note"><div class="note-icon">' + VNDIcon('shield', 17) + '</div><strong>Dữ liệu thuộc về bạn</strong><p>Thông tin tài chính được lưu trên thiết bị này. Sao lưu định kỳ để tránh mất dữ liệu.</p></div>' +
        '<div class="profile-mini"><div class="avatar">' + esc(initials || 'B') + '</div><div class="profile-mini-copy"><strong>' + esc(state.profile.name || 'Người dùng') + '</strong><span>Không gian cá nhân</span></div><button class="icon-button" aria-label="Mở cài đặt" data-page="settings">' + VNDIcon('settings', 17) + '</button></div>' +
      '</aside><div class="main-area"><header class="topbar"><div class="topbar-left"><button class="icon-button mobile-menu" data-action="toggle-sidebar" aria-label="Mở menu">' + VNDIcon('menu', 20) + '</button><div class="breadcrumb">VND Save <span style="padding:0 7px;color:var(--border-strong)">/</span> <strong>' + esc(title) + '</strong></div></div><div class="topbar-right"><button class="icon-button" title="Chuyển giao diện" aria-label="Chuyển giao diện" data-action="toggle-theme">' + VNDIcon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18) + '</button><span class="topbar-divider"></span><button class="icon-button" aria-label="Cài đặt" title="Cài đặt" data-page="settings">' + VNDIcon('settings', 18) + '</button><div class="avatar" style="width:30px;height:30px;border-radius:9px;font-size:10px">' + esc(initials || 'B') + '</div></div></header>' +
        '<main class="page-container"><div class="page-heading"><div><h1 class="page-title">' + esc(title) + '</h1><p class="page-description">' + esc(desc) + '</p></div>' + (page === 'dashboard' ? '<div class="page-actions"><input class="toolbar-select" type="month" aria-label="Chọn tháng" data-filter="dashboard-month" value="' + esc(selectedMonth) + '"/><button class="btn btn-primary" data-action="add-transaction">' + VNDIcon('plus', 16) + ' Thêm giao dịch</button></div>' : (page === 'transactions' ? '<div class="page-actions"><button class="btn btn-primary" data-action="add-transaction">' + VNDIcon('plus', 16) + ' Thêm giao dịch</button></div>' : (page === 'budgets' ? '<div class="page-actions"><button class="btn btn-primary" data-action="add-budget">' + VNDIcon('plus', 16) + ' Tạo ngân sách</button></div>' : (page === 'goals' ? '<div class="page-actions"><button class="btn btn-primary" data-action="add-goal">' + VNDIcon('plus', 16) + ' Tạo mục tiêu</button></div>' : '')))) + '</div>' + content + '</main></div>' +
      '<div class="sidebar-scrim" data-action="close-sidebar"></div>' + (modal ? modal : '') + '</div>';
  }

  function navItem(id, label, icon) {
    return '<button class="nav-item ' + (page === id ? 'active' : '') + '" data-page="' + id + '" ' + (page === id ? 'aria-current="page"' : '') + '>' + VNDIcon(icon, 18) + '<span>' + esc(label) + '</span></button>';
  }

  function emptyState(icon, title, message, action, label) {
    return '<div class="empty-state"><div class="empty-icon">' + VNDIcon(icon, 23) + '</div><h3>' + esc(title) + '</h3><p>' + esc(message) + '</p>' + (action ? '<button class="btn btn-primary btn-sm" data-action="' + action + '">' + VNDIcon('plus', 14) + esc(label || 'Bắt đầu') + '</button>' : '') + '</div>';
  }

  function metric(label, value, icon, foot, tone) {
    const display = String(value == null ? '—' : value);
    const match = display.match(/^(.*)\s₫$/);
    const valueHtml = match
      ? '<span class="metric-number">' + esc(match[1]) + '</span><span class="metric-currency">₫</span>'
      : '<span class="metric-number metric-number-plain">' + esc(display) + '</span>';
    return '<div class="card metric-card"><div class="metric-top"><span class="metric-label">' + esc(label) + '</span><span class="metric-icon" ' + (tone ? 'style="color:' + tone + '"' : '') + '>' + VNDIcon(icon, 17) + '</span></div><div class="metric-value mono" title="' + esc(display) + '">' + valueHtml + '</div><div class="metric-foot">' + (foot || '') + '</div></div>';
  }

  function transactionRows(rows, showActions) {
    if (!rows.length) return '';
    return rows.map(t => {
      const isIncome = t.type === 'income';
      return '<tr data-tx-row="' + esc(t.id) + '"><td><div class="td-primary">' + esc(t.name) + '</div>' + (t.note ? '<div class="small text-muted" style="margin-top:4px">' + esc(t.note) + '</div>' : '') + '</td><td>' + esc(F.dateLabel(t.date)) + '</td><td><span class="category-chip"><i style="background:' + esc(categoryColor(t.categoryId)) + '"></i>' + esc(categoryName(t.categoryId)) + '</span></td><td><span class="type-badge ' + (isIncome ? 'income' : 'expense') + '">' + (isIncome ? 'Thu nhập' : 'Chi tiêu') + '</span></td><td class="' + (isIncome ? 'amount-income' : 'amount-expense') + ' mono" style="text-align:right">' + (isIncome ? '+' : '−') + esc(currency(t.amount)) + '</td>' + (showActions ? '<td><div style="display:flex;gap:3px;justify-content:flex-end"><button class="icon-button" style="width:29px;height:29px" aria-label="Sửa giao dịch" data-action="edit-transaction" data-id="' + esc(t.id) + '">' + VNDIcon('edit', 14) + '</button><button class="icon-button" style="width:29px;height:29px" aria-label="Xóa giao dịch" data-action="delete-transaction" data-id="' + esc(t.id) + '">' + VNDIcon('trash', 14) + '</button></div></td>' : '') + '</tr>';
    }).join('');
  }

  function dashboardPage() {
    const tx = F.monthTransactions(state.transactions, selectedMonth);
    const monthTotals = F.totals(state.transactions, selectedMonth);
    const lifetime = F.totals(state.transactions);
    const budgetRows = F.budgetUsage(state.transactions, state.budgets, state.categories, selectedMonth);
    const bt = F.budgetTotals(budgetRows);
    const categories = F.categoryTotals(state.transactions, state.categories, selectedMonth, 'expense');
    const series = F.monthlySeries(state.transactions, 6, selectedMonth);
    const recent = [...tx].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0,5);
    const analysis = F.analyze(state.transactions, state.budgets, state.categories, selectedMonth);
    const highest = categories[0];
    const remaining = bt.remaining;
    const budgetFoot = budgetRows.length ? (remaining < 0 ? '<span class="text-danger">Vượt ' + esc(currency(Math.abs(remaining))) + '</span>' : '<span class="text-success">Còn ' + esc(currency(remaining)) + '</span>') : 'Chưa thiết lập ngân sách';
    return '<div class="overview-grid">' +
      metric('Số dư ròng tích lũy', currency(lifetime.net), 'wallet', 'Tổng thu nhập trừ tổng chi tiêu', '#2563EB') +
      metric('Thu nhập · ' + F.monthLabel(selectedMonth), currency(monthTotals.income), 'income', '<span class="text-success">' + monthTotals.count + ' giao dịch trong tháng</span>', '#16A34A') +
      metric('Chi tiêu · ' + F.monthLabel(selectedMonth), currency(monthTotals.expense), 'expense', highest ? 'Nhiều nhất: ' + esc(highest.name) : 'Chưa có chi tiêu trong tháng', '#D97706') +
      metric('Ngân sách còn lại', budgetRows.length ? currency(remaining) : '—', 'target', budgetFoot, remaining < 0 ? '#DC2626' : '#7C3AED') +
      '</div>' +
      '<div class="dash-grid"><section class="card"><div class="card-header"><div><h2 class="card-title">Thu nhập và chi tiêu</h2><div class="card-subtitle">Xu hướng 6 tháng gần nhất tính đến ' + esc(F.monthLabel(selectedMonth).toLowerCase()) + '</div></div><div class="chart-legend-inline"><span><i style="background:#16A34A"></i>Thu nhập</span><span><i style="background:#2563EB"></i>Chi tiêu</span></div></div><div class="chart-area">' + VNDCharts.bars(series) + '</div></section>' +
      '<section class="card"><div class="card-header"><div><h2 class="card-title">Cơ cấu chi tiêu</h2><div class="card-subtitle">Phân bổ theo danh mục trong tháng</div></div><span class="badge badge-neutral">' + esc(tx.filter(t => t.type === 'expense').length) + ' khoản chi</span></div><div class="chart-area"><div class="donut-layout">' + VNDCharts.donut(categories, monthTotals.expense) + VNDCharts.legend(categories, monthTotals.expense) + '</div></div></section></div>' +
      '<div class="dash-grid"><section class="card"><div class="card-header"><div><h2 class="card-title">Tiến độ ngân sách</h2><div class="card-subtitle">' + esc(F.monthLabel(selectedMonth)) + '</div></div><button class="section-link" data-page="budgets">Quản lý ngân sách ' + VNDIcon('arrowUpRight', 12) + '</button></div>' +
      (budgetRows.length ? '<div class="budget-list">' + budgetRows.slice(0,5).map(b => '<div class="budget-row"><div class="budget-head"><span class="budget-label"><i class="budget-dot" style="background:' + esc(b.color) + '"></i>' + esc(b.categoryName) + '</span><span class="budget-amount">' + esc(currency(b.spent)) + ' / ' + esc(currency(b.amount)) + '</span></div><div class="progress-track"><span style="width:' + Math.min(100,b.percent) + '%;background:' + (b.status === 'over' ? 'var(--danger)' : b.status === 'warning' ? 'var(--warning)' : 'var(--primary)') + '"></span></div><div class="budget-bottom"><span>' + Math.round(b.percent) + '% đã dùng</span><span class="' + (b.remaining < 0 ? 'text-danger' : '') + '">' + (b.remaining < 0 ? 'Vượt ' + esc(currency(-b.remaining)) : 'Còn ' + esc(currency(b.remaining))) + '</span></div></div>').join('') + '</div>' : emptyState('wallet', 'Chưa có ngân sách', 'Thiết lập ngân sách theo danh mục để theo dõi giới hạn chi tiêu.', 'add-budget', 'Tạo ngân sách')) + '</section>' +
      '<section class="card"><div class="card-header"><div><h2 class="card-title">Góc nhìn nhanh</h2><div class="card-subtitle">Quan sát từ dữ liệu hiện có</div></div><button class="section-link" data-page="insights">Xem phân tích</button></div>' +
      (analysis.notes.length ? '<div class="insight-list" style="grid-template-columns:1fr">' + analysis.notes.slice(0,3).map(n => '<div class="insight-card ' + esc(n.type) + '" style="padding:11px"><div class="insight-icon">' + VNDIcon(n.type === 'warning' || n.type === 'danger' ? 'warning' : n.type === 'success' ? 'check' : 'insights', 16) + '</div><div><h4>' + esc(n.title) + '</h4><p>' + esc(n.detail) + '</p></div></div>').join('') + '</div>' : emptyState('insights','Chưa có dữ liệu','Ghi nhận giao dịch để nhận góc nhìn tài chính.')) + '</section></div>' +
      '<section class="card"><div class="card-header"><div><h2 class="card-title">Giao dịch gần đây</h2><div class="card-subtitle">Các giao dịch trong ' + esc(F.monthLabel(selectedMonth).toLowerCase()) + '</div></div><button class="section-link" data-page="transactions">Xem tất cả ' + VNDIcon('arrowUpRight', 12) + '</button></div>' +
      (recent.length ? '<div class="transaction-table-wrap"><table class="data-table"><thead><tr><th>GIAO DỊCH</th><th>NGÀY</th><th>DANH MỤC</th><th>LOẠI</th><th style="text-align:right">SỐ TIỀN</th></tr></thead><tbody>' + transactionRows(recent, false) + '</tbody></table></div>' : emptyState('transactions', 'Chưa có giao dịch trong tháng', 'Bắt đầu ghi nhận khoản thu hoặc chi đầu tiên để xem tổng quan.', 'add-transaction', 'Thêm giao dịch')) + '</section>';
  }

  function transactionsPage() {
    let rows = [...state.transactions];
    if (txFilters.search) { const q = txFilters.search.toLocaleLowerCase('vi'); rows = rows.filter(t => (t.name + ' ' + (t.note || '')).toLocaleLowerCase('vi').includes(q)); }
    if (txFilters.type !== 'all') rows = rows.filter(t => t.type === txFilters.type);
    if (txFilters.category !== 'all') rows = rows.filter(t => t.categoryId === txFilters.category);
    if (txFilters.month !== 'all') rows = rows.filter(t => F.monthKey(t.date) === txFilters.month);
    if (txFilters.start) rows = rows.filter(t => t.date >= txFilters.start);
    if (txFilters.end) rows = rows.filter(t => t.date <= txFilters.end);
    if (txFilters.min !== '') rows = rows.filter(t => t.amount >= Number(txFilters.min));
    if (txFilters.max !== '') rows = rows.filter(t => t.amount <= Number(txFilters.max));
    rows.sort((a,b) => txFilters.sort === 'date-asc' ? a.date.localeCompare(b.date) : txFilters.sort === 'amount-desc' ? b.amount-a.amount : txFilters.sort === 'amount-asc' ? a.amount-b.amount : b.date.localeCompare(a.date));
    const catOptions = '<option value="all">Tất cả danh mục</option>' + state.categories.map(c => '<option value="' + esc(c.id) + '" ' + (txFilters.category === c.id ? 'selected' : '') + '>' + esc(c.name) + '</option>').join('');
    return '<section class="card" style="padding:0;overflow:hidden"><div class="filter-bar" style="margin:14px 14px 0"><div class="search-field">' + VNDIcon('search', 16) + '<input class="field-input" type="search" placeholder="Tìm tên giao dịch hoặc ghi chú…" value="' + esc(txFilters.search) + '" data-filter="search" aria-label="Tìm giao dịch"/></div><select class="field-select filter-control" data-filter="type"><option value="all">Tất cả loại</option><option value="income" ' + (txFilters.type === 'income' ? 'selected' : '') + '>Thu nhập</option><option value="expense" ' + (txFilters.type === 'expense' ? 'selected' : '') + '>Chi tiêu</option></select><select class="field-select filter-control" data-filter="category">' + catOptions + '</select><input class="field-input filter-control" type="month" value="' + (txFilters.month === 'all' ? '' : esc(txFilters.month)) + '" data-filter="month" aria-label="Lọc theo tháng"/><select class="field-select filter-control" data-filter="sort"><option value="date-desc" ' + (txFilters.sort === 'date-desc' ? 'selected' : '') + '>Mới nhất</option><option value="date-asc" ' + (txFilters.sort === 'date-asc' ? 'selected' : '') + '>Cũ nhất</option><option value="amount-desc" ' + (txFilters.sort === 'amount-desc' ? 'selected' : '') + '>Số tiền cao</option><option value="amount-asc" ' + (txFilters.sort === 'amount-asc' ? 'selected' : '') + '>Số tiền thấp</option></select><button class="btn btn-ghost btn-sm" data-action="reset-tx-filters">Đặt lại</button></div>' +
      '<div class="filter-bar" style="margin:10px 14px 0;padding:0;border:0;background:transparent"><span class="small text-muted">Từ ngày</span><input class="field-input" style="width:145px;min-height:32px" type="date" aria-label="Từ ngày" value="' + esc(txFilters.start) + '" data-filter="start"/><span class="small text-muted">Đến ngày</span><input class="field-input" style="width:145px;min-height:32px" type="date" aria-label="Đến ngày" value="' + esc(txFilters.end) + '" data-filter="end"/><span class="small text-muted">Số tiền từ</span><input class="field-input" style="width:120px;min-height:32px" type="number" min="0" placeholder="Từ (₫)" value="' + esc(txFilters.min) + '" data-filter="min"/><input class="field-input" style="width:120px;min-height:32px" type="number" min="0" placeholder="Đến (₫)" value="' + esc(txFilters.max) + '" data-filter="max"/><span class="small text-muted" style="margin-left:auto">' + rows.length + ' kết quả</span></div>' +
      (rows.length ? '<div class="transaction-table-wrap" style="padding:8px 14px 0"><table class="data-table"><thead><tr><th>GIAO DỊCH</th><th>NGÀY</th><th>DANH MỤC</th><th>LOẠI</th><th style="text-align:right">SỐ TIỀN</th><th></th></tr></thead><tbody>' + transactionRows(rows, true) + '</tbody></table></div><div class="table-footer" style="padding:13px 18px">Hiển thị ' + rows.length + ' giao dịch <button class="btn btn-secondary btn-sm" data-action="export-csv">' + VNDIcon('download', 14) + ' Xuất CSV</button></div>' : emptyState(state.transactions.length ? 'search' : 'transactions', state.transactions.length ? 'Không tìm thấy giao dịch' : 'Chưa có giao dịch nào', state.transactions.length ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Tất cả khoản thu và chi sẽ xuất hiện tại đây.', state.transactions.length ? null : 'add-transaction', 'Thêm giao dịch')) + '</section>';
  }

  function budgetsPage() {
    const rows = F.budgetUsage(state.transactions, state.budgets, state.categories, selectedMonth);
    const totals = F.budgetTotals(rows);
    const income = Number(state.profile.monthlyIncome || 0);
    return '<div class="page-actions" style="margin:-7px 0 16px"><input type="month" class="toolbar-select" value="' + esc(selectedMonth) + '" data-filter="dashboard-month" aria-label="Tháng áp dụng ngân sách"/><span class="small text-muted">Ngân sách áp dụng riêng cho từng tháng.</span></div>' +
      '<div class="report-summary"><div class="report-stat"><span>Tổng ngân sách</span><strong>' + esc(currency(totals.total)) + '</strong></div><div class="report-stat"><span>Đã sử dụng</span><strong>' + esc(currency(totals.spent)) + '</strong></div><div class="report-stat"><span>Còn lại</span><strong class="' + (totals.remaining < 0 ? 'text-danger' : 'text-success') + '">' + esc(currency(totals.remaining)) + '</strong></div></div>' +
      (income > 0 && totals.total > income ? '<div class="confirm-warning" style="margin-bottom:14px">' + VNDIcon('warning', 16) + '<span>Tổng ngân sách (' + esc(currency(totals.total)) + ') đang cao hơn thu nhập dự kiến mỗi tháng (' + esc(currency(income)) + '). Thu nhập dự kiến không được tính là thu nhập thực nhận.</span></div>' : '') +
      '<section class="card"><div class="card-header"><div><h2 class="card-title">Ngân sách theo danh mục</h2><div class="card-subtitle">' + esc(F.monthLabel(selectedMonth)) + '</div></div><span class="badge badge-neutral">' + rows.length + ' danh mục</span></div>' +
      (rows.length ? '<div class="budget-list">' + rows.map(b => '<div class="budget-row" style="padding:12px 0;border-bottom:1px solid var(--border)"><div class="budget-head"><span class="budget-label"><i class="budget-dot" style="background:' + esc(b.color) + '"></i>' + esc(b.categoryName) + '</span><div style="display:flex;align-items:center;gap:9px"><span class="badge ' + (b.status === 'over' ? 'badge-danger' : b.status === 'warning' ? 'badge-warning' : 'badge-success') + '">' + (b.status === 'over' ? 'Vượt ngân sách' : b.status === 'warning' ? 'Sắp chạm mức' : 'Trong giới hạn') + '</span><button class="icon-button" aria-label="Sửa ngân sách" data-action="edit-budget" data-id="' + esc(b.id) + '">' + VNDIcon('edit', 14) + '</button><button class="icon-button" aria-label="Xóa ngân sách" data-action="delete-budget" data-id="' + esc(b.id) + '">' + VNDIcon('trash', 14) + '</button></div></div><div class="budget-head"><span class="budget-amount">Đã chi <strong class="text-secondary">' + esc(currency(b.spent)) + '</strong></span><span class="budget-amount">Ngân sách <strong class="text-secondary">' + esc(currency(b.amount)) + '</strong></span></div><div class="progress-track" style="height:9px"><span style="width:' + Math.min(100,b.percent) + '%;background:' + (b.status === 'over' ? 'var(--danger)' : b.status === 'warning' ? 'var(--warning)' : 'var(--primary)') + '"></span></div><div class="budget-bottom"><span>' + Math.round(b.percent) + '% đã sử dụng</span><span class="' + (b.remaining < 0 ? 'text-danger' : 'text-success') + '">' + (b.remaining < 0 ? 'Vượt ' + esc(currency(-b.remaining)) : 'Còn ' + esc(currency(b.remaining))) + '</span></div></div>').join('') + '</div>' : emptyState('wallet', 'Chưa thiết lập ngân sách', 'Tạo giới hạn chi tiêu cho các danh mục và chọn tháng áp dụng.', 'add-budget', 'Tạo ngân sách')) + '</section>';
  }

  function analyticsPage() {
    const [y,m] = selectedMonth.split('-').map(Number);
    let start, end, label, series;
    if (analyticsPeriod === 'month') {
      start = selectedMonth + '-01'; end = y+'-'+String(m).padStart(2,'0')+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0');
      label = F.monthLabel(selectedMonth); series = F.byDay(state.transactions, selectedMonth);
    } else if (analyticsPeriod === 'quarter') {
      const q = Math.floor((m-1)/3), first = new Date(y,q*3,1), last = new Date(y,q*3+3,0);
      start = first.getFullYear()+'-'+String(first.getMonth()+1).padStart(2,'0')+'-01';
      end = last.getFullYear()+'-'+String(last.getMonth()+1).padStart(2,'0')+'-'+String(last.getDate()).padStart(2,'0');
      label = 'Quý ' + (q+1) + ' / ' + y;
      series = F.monthlySeries(state.transactions,3,last.getFullYear()+'-'+String(last.getMonth()+1).padStart(2,'0'));
    } else if (analyticsPeriod === 'year') {
      start = y+'-01-01'; end = y+'-12-31'; label = 'Năm ' + y;
      series = F.monthlySeries(state.transactions,12,y+'-12');
    } else {
      start = customRange.start || selectedMonth+'-01';
      const last = new Date(Number(selectedMonth.slice(0,4)),Number(selectedMonth.slice(5,7)),0);
      end = customRange.end || (selectedMonth===F.currentMonth()?dateToday():last.getFullYear()+'-'+String(last.getMonth()+1).padStart(2,'0')+'-'+String(last.getDate()).padStart(2,'0'));
      label = F.dateLabel(start) + ' – ' + F.dateLabel(end);
      const sm=start.slice(0,7), em=end.slice(0,7); const [sy,smn]=sm.split('-').map(Number),[ey,emn]=em.split('-').map(Number);
      const count=Math.max(1,Math.min(24,(ey-sy)*12+emn-smn+1));
      series=F.monthlySeries(state.transactions,count,em);
    }
    const filtered = state.transactions.filter(t=>t.date>=start&&t.date<=end);
    const total = F.totals(filtered);
    const cats = F.categoryTotals(filtered, state.categories, null, 'expense');
    const max = Math.max(1, ...cats.map(c=>c.amount));
    return '<div class="filter-bar"><label class="small text-muted" for="analytics-period">Khoảng thời gian</label><select id="analytics-period" class="field-select filter-control" data-filter="analytics-period"><option value="month" ' + (analyticsPeriod==='month'?'selected':'') + '>Tháng</option><option value="quarter" ' + (analyticsPeriod==='quarter'?'selected':'') + '>Quý</option><option value="year" ' + (analyticsPeriod==='year'?'selected':'') + '>Năm</option><option value="custom" ' + (analyticsPeriod==='custom'?'selected':'') + '>Tùy chỉnh</option></select>' +
      (analyticsPeriod==='custom' ? '<input type="date" class="toolbar-select" aria-label="Từ ngày" value="'+esc(customRange.start)+'" data-filter="analytics-start"/><span class="small text-muted">đến</span><input type="date" class="toolbar-select" aria-label="Đến ngày" value="'+esc(customRange.end)+'" data-filter="analytics-end"/>' : '<input type="month" class="toolbar-select" value="' + esc(selectedMonth) + '" data-filter="dashboard-month" aria-label="Tháng tham chiếu"/>') + '</div>' +
      '<div class="report-summary"><div class="report-stat"><span>Tổng thu nhập · ' + esc(label) + '</span><strong class="text-success">' + esc(currency(total.income)) + '</strong></div><div class="report-stat"><span>Tổng chi tiêu · ' + esc(label) + '</span><strong>' + esc(currency(total.expense)) + '</strong></div><div class="report-stat"><span>Chênh lệch thu chi</span><strong class="' + (total.net < 0 ? 'text-danger' : 'text-success') + '">' + esc(currency(total.net)) + '</strong></div></div>' +
      '<div class="dash-grid"><section class="card"><div class="card-header"><div><h2 class="card-title">Thu nhập và chi tiêu</h2><div class="card-subtitle">' + esc(label) + '</div></div><div class="chart-legend-inline"><span><i style="background:#16A34A"></i>Thu nhập</span><span><i style="background:#2563EB"></i>Chi tiêu</span></div></div><div class="chart-area">' + VNDCharts.bars(series) + '</div></section><section class="card"><div class="card-header"><div><h2 class="card-title">Chi tiêu theo danh mục</h2><div class="card-subtitle">Tỷ trọng trên tổng chi tiêu</div></div></div><div class="chart-area"><div class="donut-layout">' + VNDCharts.donut(cats,total.expense) + VNDCharts.legend(cats,total.expense) + '</div></div></section></div>' +
      '<div class="dash-grid equal"><section class="card"><div class="card-header"><div><h2 class="card-title">So sánh danh mục</h2><div class="card-subtitle">Theo số tiền đã chi trong kỳ</div></div></div>' + VNDCharts.hBars(cats.slice(0,8),max) + '</section><section class="card"><div class="card-header"><div><h2 class="card-title">Tóm tắt dữ liệu</h2><div class="card-subtitle">Các chỉ số trong khoảng thời gian</div></div></div><div class="budget-list"><div class="setting-row"><div><strong>Số giao dịch</strong><span>Tổng số khoản thu và chi</span></div><strong>' + total.count + '</strong></div><div class="setting-row"><div><strong>Chi tiêu trung bình / giao dịch</strong><span>Dựa trên giao dịch chi tiêu</span></div><strong>' + esc(currency(total.expense / Math.max(1,filtered.filter(t=>t.type==='expense').length))) + '</strong></div><div class="setting-row"><div><strong>Tỷ lệ chi tiêu / thu nhập</strong><span>Không tính thu nhập dự kiến</span></div><strong>' + (total.income ? (total.expense/total.income*100).toFixed(1)+'%' : 'Chưa đủ dữ liệu') + '</strong></div></div></section></div>';
  }

  function insightsPage() {
    const a = F.analyze(state.transactions, state.budgets, state.categories, selectedMonth);
    const [y,m] = selectedMonth.split('-').map(Number);
    const currentDays = Math.max(1, selectedMonth === F.currentMonth() ? new Date().getDate() : new Date(y,m,0).getDate());
    const avg = a.averageDaily;
    const notes = a.notes;
    const noData = a.current.count === 0;
    return '<div class="filter-bar"><label class="small text-muted">Tháng phân tích</label><input type="month" class="toolbar-select" value="' + esc(selectedMonth) + '" data-filter="dashboard-month"/></div>' +
      (noData ? emptyState('insights','Chưa có dữ liệu để phân tích','Khi bạn ghi nhận giao dịch, VND Save sẽ tự động tổng hợp các xu hướng có căn cứ.', 'add-transaction', 'Ghi nhận giao dịch') : '<div class="overview-grid">' + metric('Tổng thu nhập',currency(a.current.income),'income','Trong tháng đã chọn','#16A34A') + metric('Tổng chi tiêu',currency(a.current.expense),'expense','Trong tháng đã chọn','#D97706') + metric('Chi tiêu trung bình / ngày',currency(avg),'calendar','Tính theo ' + currentDays + ' ngày','#2563EB') + metric('Tỷ lệ chi tiêu / thu nhập',a.expenseRatio == null ? '—' : a.expenseRatio.toFixed(1)+'%','analytics',a.expenseRatio == null ? 'Chưa có thu nhập thực tế' : 'Dựa trên dòng tiền thực tế','#7C3AED') + '</div>') +
      '<div class="card-header" style="margin-top:23px"><div><h2 class="card-title">Quan sát từ dữ liệu</h2><div class="card-subtitle">' + esc(F.monthLabel(selectedMonth)) + '</div></div><span class="badge badge-neutral">Không sử dụng AI bên ngoài</span></div>' +
      (notes.length ? '<div class="insight-list">' + notes.map(n => '<article class="insight-card ' + esc(n.type) + '"><div class="insight-icon">' + VNDIcon(n.type === 'danger' || n.type === 'warning' ? 'warning' : n.type === 'success' ? 'check' : 'insights', 17) + '</div><div><h4>' + esc(n.title) + '</h4><p>' + esc(n.detail) + '</p></div></article>').join('') + '</div>' : '') +
      (a.spending.length ? '<section class="card" style="margin-top:15px"><div class="card-header"><div><h2 class="card-title">Chi tiết danh mục chi tiêu</h2><div class="card-subtitle">Danh mục có phát sinh trong tháng</div></div></div>' + VNDCharts.hBars(a.spending, a.spending[0].amount) + '</section>' : '');
  }

  function goalsPage() {
    const goals = [...state.savingsGoals].sort((a,b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
    const totalSaved = goals.reduce((s,g)=>s+Number(g.saved||0),0);
    const totalTarget = goals.reduce((s,g)=>s+Number(g.target||0),0);
    return '<div class="report-summary"><div class="report-stat"><span>Mục tiêu đang theo dõi</span><strong>' + goals.filter(g=>g.saved<g.target).length + '</strong></div><div class="report-stat"><span>Tổng đã tiết kiệm</span><strong class="text-success">' + esc(currency(totalSaved)) + '</strong></div><div class="report-stat"><span>Tổng mục tiêu</span><strong>' + esc(currency(totalTarget)) + '</strong></div></div>' +
      (goals.length ? '<div class="goal-grid">' + goals.map(g => {
        const pct = Math.min(100, g.saved/g.target*100);
        const completed = g.saved >= g.target;
        let remaining = Math.max(0,g.target-g.saved);
        let days = g.deadline ? Math.ceil((new Date(g.deadline+'T00:00:00') - new Date(dateToday()+'T00:00:00'))/86400000) : null;
        return '<article class="card goal-card"><div class="goal-top"><div class="goal-icon">' + VNDIcon(completed?'check':'target',18) + '</div><span class="badge ' + (completed?'badge-success':'badge-neutral') + '">' + (completed?'Đã hoàn thành':'Đang thực hiện') + '</span></div><div><div class="goal-name">' + esc(g.name) + '</div><div class="goal-target">Mục tiêu ' + esc(currency(g.target)) + '</div></div><div class="goal-numbers"><div><div class="goal-saved">' + esc(currency(g.saved)) + '</div><div class="goal-target">Đã tích lũy</div></div><div class="goal-percent">' + pct.toFixed(0) + '%</div></div><div class="progress-bar-large"><span style="width:' + pct + '%;background:' + (completed?'var(--success)':'var(--primary)') + '"></span></div><div class="goal-meta"><span>' + (completed?'Mục tiêu đã đạt': 'Còn ' + esc(currency(remaining))) + '</span><span>' + (g.deadline ? (days < 0 ? 'Quá hạn ' + Math.abs(days) + ' ngày' : days === 0 ? 'Đến hạn hôm nay' : 'Còn ' + days + ' ngày') : 'Không đặt hạn') + '</span></div><div class="goal-actions">' + (!completed?'<button class="btn btn-primary btn-sm" style="flex:1" data-action="add-funds" data-id="'+esc(g.id)+'">'+VNDIcon('plus',14)+' Thêm tiền</button>':'<span class="small text-success" style="margin:auto">'+VNDIcon('check',13)+' Hoàn thành</span>') + '<button class="icon-button" aria-label="Sửa mục tiêu" data-action="edit-goal" data-id="' + esc(g.id) + '">' + VNDIcon('edit',15) + '</button><button class="icon-button" aria-label="Xóa mục tiêu" data-action="delete-goal" data-id="' + esc(g.id) + '">' + VNDIcon('trash',15) + '</button></div></article>';
      }).join('') + '</div>' : emptyState('savings','Chưa có mục tiêu tiết kiệm','Tạo mục tiêu cho chuyến đi, món đồ hoặc khoản dự phòng bạn đang hướng tới.','add-goal','Tạo mục tiêu đầu tiên')) +
      '<p class="field-hint" style="margin-top:16px">Lưu ý: Số tiền thêm vào mục tiêu chỉ được ghi nhận trong kế hoạch tiết kiệm, không tự động trừ khỏi số dư giao dịch.</p>';
  }

  function reportTransactions(period) {
    if (reportPeriod === 'year') return state.transactions.filter(t => t.date.slice(0,4) === selectedMonth.slice(0,4));
    if (reportPeriod === 'quarter') {
      const [y,m] = selectedMonth.split('-').map(Number), quarter = Math.floor((m-1)/3), start = new Date(y,quarter*3,1), end = new Date(y,quarter*3+3,0);
      const startKey = F.localDate(start.getFullYear()+'-'+String(start.getMonth()+1).padStart(2,'0')+'-01');
      const endKey = F.localDate(end.getFullYear()+'-'+String(end.getMonth()+1).padStart(2,'0')+'-'+String(end.getDate()).padStart(2,'0'));
      return state.transactions.filter(t=>t.date>=startKey&&t.date<=endKey);
    }
    return F.monthTransactions(state.transactions, selectedMonth);
  }
  function reportsPage() {
    const rows = reportTransactions();
    const total = F.totals(rows);
    const cats = F.categoryTotals(rows, state.categories, null, 'expense');
    const [y,m] = selectedMonth.split('-').map(Number);
    const quarter = Math.floor((m-1)/3)+1;
    const periodName = reportPeriod === 'year' ? 'Năm ' + y : reportPeriod === 'quarter' ? 'Quý ' + quarter + ' / ' + y : F.monthLabel(selectedMonth);
    let budgetStart, budgetEnd;
    if (reportPeriod === 'year') { budgetStart=y+'-01'; budgetEnd=y+'-12'; }
    else if (reportPeriod === 'quarter') { const q=Math.floor((m-1)/3); budgetStart=y+'-'+String(q*3+1).padStart(2,'0'); budgetEnd=y+'-'+String(q*3+3).padStart(2,'0'); }
    else { budgetStart=selectedMonth; budgetEnd=selectedMonth; }
    const periodBudgets=state.budgets.filter(b=>b.month>=budgetStart&&b.month<=budgetEnd);
    const bTotals={total:periodBudgets.reduce((sum,b)=>sum+Number(b.amount||0),0),spent:0};
    bTotals.spent=periodBudgets.reduce((sum,b)=>sum+F.monthTransactions(state.transactions,b.month).filter(t=>t.type==='expense'&&t.categoryId===b.categoryId).reduce((subtotal,t)=>subtotal+Number(t.amount||0),0),0);
    return '<div class="filter-bar"><label class="small text-muted">Kỳ báo cáo</label><select class="field-select filter-control" data-filter="report-period"><option value="month" '+(reportPeriod==='month'?'selected':'')+'>Theo tháng</option><option value="quarter" '+(reportPeriod==='quarter'?'selected':'')+'>Theo quý</option><option value="year" '+(reportPeriod==='year'?'selected':'')+'>Theo năm</option></select><input type="month" class="toolbar-select" value="'+esc(selectedMonth)+'" data-filter="dashboard-month"/><button class="btn btn-secondary btn-sm" data-action="export-csv">'+VNDIcon('download',14)+' Xuất CSV</button></div>' +
      '<div class="card" style="margin-bottom:15px"><div class="card-header"><div><h2 class="card-title">Báo cáo ' + esc(periodName) + '</h2><div class="card-subtitle">Tổng hợp từ ' + rows.length + ' giao dịch đã ghi nhận</div></div><span class="badge badge-neutral">VND</span></div><div class="report-summary" style="margin-bottom:0"><div class="report-stat"><span>Tổng thu nhập</span><strong class="text-success">' + esc(currency(total.income)) + '</strong></div><div class="report-stat"><span>Tổng chi tiêu</span><strong>' + esc(currency(total.expense)) + '</strong></div><div class="report-stat"><span>Chênh lệch thu chi</span><strong class="' + (total.net < 0 ? 'text-danger' : 'text-success') + '">' + esc(currency(total.net)) + '</strong></div></div></div>' +
      '<div class="dash-grid"><section class="card"><div class="card-header"><div><h2 class="card-title">Chi tiêu theo danh mục</h2><div class="card-subtitle">' + esc(periodName) + '</div></div></div>' + VNDCharts.hBars(cats, Math.max(1,...cats.map(c=>c.amount))) + '</section><section class="card"><div class="card-header"><div><h2 class="card-title">Chỉ số báo cáo</h2><div class="card-subtitle">Thông tin trong kỳ đã chọn</div></div></div><div class="budget-list"><div class="setting-row"><div><strong>Danh mục chi tiêu lớn nhất</strong><span>Danh mục có tổng chi cao nhất</span></div><strong>' + esc(cats[0] ? cats[0].name : '—') + '</strong></div><div class="setting-row"><div><strong>Ngân sách đã sử dụng</strong><span>' + (periodBudgets.length+' ngân sách trong kỳ') + '</span></div><strong>' + (bTotals.total ? Math.round(bTotals.spent/bTotals.total*100)+'% · '+currency(bTotals.spent) : '—') + '</strong></div><div class="setting-row"><div><strong>Số giao dịch</strong><span>Thu nhập và chi tiêu</span></div><strong>' + total.count + '</strong></div></div></section></div>' +
      (rows.length ? '<section class="card"><div class="card-header"><div><h2 class="card-title">Giao dịch trong báo cáo</h2><div class="card-subtitle">Có thể xuất đầy đủ dữ liệu bằng CSV</div></div></div><div class="transaction-table-wrap"><table class="data-table"><thead><tr><th>GIAO DỊCH</th><th>NGÀY</th><th>DANH MỤC</th><th>LOẠI</th><th style="text-align:right">SỐ TIỀN</th></tr></thead><tbody>' + transactionRows(rows.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12),false) + '</tbody></table></div></section>' : emptyState('reports','Chưa có dữ liệu báo cáo','Chưa có giao dịch trong kỳ được chọn.'));
  }

  function settingsPage() {
    const tabs = [ ['profile','user','Hồ sơ'], ['categories','transactions','Danh mục'], ['appearance','sun','Giao diện'], ['data','shield','Dữ liệu & sao lưu'], ['about','info','Giới thiệu'] ];
    let panel = '';
    if (settingsTab === 'profile') panel = '<section class="settings-section"><h3>Thông tin cá nhân</h3><p>Những thông tin này chỉ được lưu trên thiết bị của bạn.</p><form data-form="profile-settings"><div class="form-grid"><div class="form-field"><label class="field-label">Tên hiển thị</label><input class="field-input" name="name" maxlength="60" required value="' + esc(state.profile.name) + '"/></div><div class="form-field"><label class="field-label">Thu nhập dự kiến mỗi tháng (₫)</label><input class="field-input" name="monthlyIncome" type="number" min="0" step="1" required value="' + esc(state.profile.monthlyIncome) + '"/><div class="field-hint">Chỉ để tham khảo và lập ngân sách, không được tính vào thu nhập thực tế.</div></div></div><div style="margin-top:16px"><button class="btn btn-primary" type="submit">Lưu hồ sơ</button></div></form></section>';
    if (settingsTab === 'categories') {
      const incomeCats = state.categories.filter(c=>c.type==='income'), expenseCats = state.categories.filter(c=>c.type==='expense');
      const renderCats = list => list.map(c=>'<div class="category-manage-row"><div class="cat-title"><i style="background:'+esc(c.color)+'"></i>'+esc(c.name)+'</div><div style="display:flex;gap:4px"><button class="icon-button" aria-label="Sửa danh mục" data-action="edit-category" data-id="'+esc(c.id)+'">'+VNDIcon('edit',14)+'</button><button class="icon-button" aria-label="Xóa danh mục" data-action="delete-category" data-id="'+esc(c.id)+'">'+VNDIcon('trash',14)+'</button></div></div>').join('');
      panel = '<section class="settings-section"><div class="card-header"><div><h3>Danh mục thu nhập</h3><p>Phân loại những khoản tiền bạn nhận được.</p></div><button class="btn btn-secondary btn-sm" data-action="add-category" data-type="income">'+VNDIcon('plus',14)+' Thêm</button></div><div class="category-manage-list">'+(incomeCats.length?renderCats(incomeCats):'<span class="small text-muted">Chưa có danh mục thu nhập.</span>')+'</div></section><section class="settings-section"><div class="card-header"><div><h3>Danh mục chi tiêu</h3><p>Phân loại những khoản tiền bạn đã sử dụng.</p></div><button class="btn btn-secondary btn-sm" data-action="add-category" data-type="expense">'+VNDIcon('plus',14)+' Thêm</button></div><div class="category-manage-list">'+(expenseCats.length?renderCats(expenseCats):'<span class="small text-muted">Chưa có danh mục chi tiêu.</span>')+'</div></section>';
    }
    if (settingsTab === 'appearance') panel = '<section class="settings-section"><h3>Giao diện ứng dụng</h3><p>Chọn chế độ hiển thị phù hợp với môi trường sử dụng.</p><div class="setting-row"><div><strong>Chế độ sáng / tối</strong><span>Cài đặt được lưu trên thiết bị này.</span></div><div class="segmented"><button class="'+(state.settings.theme==='light'?'active':'')+'" data-action="set-theme" data-theme="light">'+VNDIcon('sun',13)+' Sáng</button><button class="'+(state.settings.theme==='dark'?'active':'')+'" data-action="set-theme" data-theme="dark">'+VNDIcon('moon',13)+' Tối</button><button class="'+(state.settings.theme==='system'?'active':'')+'" data-action="set-theme" data-theme="system">Hệ thống</button></div></div></section>';
    if (settingsTab === 'data') panel = '<section class="settings-section"><h3>Sao lưu và khôi phục</h3><p>Tạo một bản sao lưu đầy đủ hoặc khôi phục dữ liệu từ tệp .vndsave. Khôi phục sẽ thay thế dữ liệu hiện có.</p><div class="setting-row"><div><strong>Tạo bản sao lưu</strong><span>Tải về hồ sơ, giao dịch, danh mục, ngân sách, mục tiêu và thiết lập.</span></div><button class="btn btn-primary btn-sm" data-action="backup">'+VNDIcon('download',14)+' Backup .vndsave</button></div><div class="setting-row"><div><strong>Khôi phục dữ liệu</strong><span>Kiểm tra nội dung tệp trước khi ghi đè dữ liệu.</span></div><button class="btn btn-secondary btn-sm" data-action="choose-restore">'+VNDIcon('upload',14)+' Chọn file</button></div><div class="restore-drop" id="restore-drop" style="margin-top:14px"><div class="empty-icon">'+VNDIcon('upload',22)+'</div><strong>Kéo thả file .vndsave vào đây</strong><p>Hoặc chọn file từ thiết bị của bạn · Tối đa 25 MB</p><button class="btn btn-secondary btn-sm" data-action="choose-restore">Chọn tệp sao lưu</button><input id="restore-input" type="file" accept=".vndsave,application/json" hidden/></div><div class="confirm-warning">'+VNDIcon('lock',15)+'<span>Dữ liệu được lưu trên thiết bị này và không tự đồng bộ lên máy chủ. Hãy sao lưu trước khi xóa dữ liệu trình duyệt hoặc đổi thiết bị.</span></div></section><section class="settings-section"><h3>Xuất dữ liệu</h3><p>CSV phù hợp để mở bằng Excel hoặc phần mềm bảng tính.</p><div class="setting-row"><div><strong>Xuất giao dịch CSV</strong><span>'+state.transactions.length+' giao dịch hiện có · UTF-8 BOM hỗ trợ tiếng Việt</span></div><button class="btn btn-secondary btn-sm" data-action="export-csv">'+VNDIcon('download',14)+' Export CSV</button></div></section><section class="settings-section"><h3>Vùng thao tác nguy hiểm</h3><p>Xóa toàn bộ dữ liệu trên thiết bị này. Thao tác không thể hoàn tác trừ khi bạn có file backup.</p><div class="setting-row"><div><strong>Xóa toàn bộ dữ liệu</strong><span>Gỡ hồ sơ, giao dịch, ngân sách và mục tiêu.</span></div><button class="btn btn-danger btn-sm" data-action="clear-data">Xóa dữ liệu</button></div></section>';
    if (settingsTab === 'about') panel = '<section class="settings-section"><div style="display:flex;align-items:center;gap:15px;margin-bottom:17px"><img src="./public/logo.svg" alt="VND Save" style="width:60px;height:60px;padding:4px;border-radius:15px;background:#EFF6FF"/><div><h3 style="font-size:19px;margin:0 0 4px">VND Save</h3><span class="text-muted small">Take Control of Your Money.</span></div></div><div class="setting-row"><div><strong>Phiên bản</strong><span>Ứng dụng web chạy cục bộ</span></div><strong>1.3.0</strong></div><div class="setting-row"><div><strong>Đơn vị tiền tệ</strong><span>Đồng Việt Nam</span></div><strong>VND (₫)</strong></div><div class="setting-row"><div><strong>Lưu trữ</strong><span>IndexedDB trên trình duyệt · localStorage dự phòng</span></div><strong>'+ (VNDStorage.getUsingFallback()?'Dự phòng':'IndexedDB') +'</strong></div><div class="setting-row"><div><strong>Quyền riêng tư</strong><span>Không tài khoản, không máy chủ, không API tài chính.</span></div><span class="badge badge-success">Lưu trên thiết bị</span></div><p class="field-hint" style="margin-top:15px">© 2026 VND Save. Dữ liệu tài chính là dữ liệu cá nhân; bạn chịu trách nhiệm lưu giữ bản sao lưu an toàn.</p></section>';
    return '<div class="settings-layout"><nav class="card settings-tabs" aria-label="Danh mục cài đặt">' + tabs.map(t=>'<button class="settings-tab '+(settingsTab===t[0]?'active':'')+'" data-settings-tab="'+t[0]+'">'+VNDIcon(t[1],16)+t[2]+'</button>').join('') + '</nav><section class="card settings-panel">' + panel + '</section></div>';
  }

  function render() {
    themeApply();
    const root = $('#app');
    if (!state.onboardingComplete) { root.innerHTML = renderOnboarding(); return; }
    let content = '';
    switch (page) {
      case 'dashboard': content = dashboardPage(); break;
      case 'transactions': content = transactionsPage(); break;
      case 'budgets': content = budgetsPage(); break;
      case 'analytics': content = analyticsPage(); break;
      case 'insights': content = insightsPage(); break;
      case 'goals': content = goalsPage(); break;
      case 'reports': content = reportsPage(); break;
      case 'settings': content = settingsPage(); break;
      default: page = 'dashboard'; content = dashboardPage();
    }
    root.innerHTML = pageShell(content);
    wireDropZone();
  }

  function renderOnboarding() {
    if (!draft) draft = { profile: { name: '', monthlyIncome: '' }, categories: clone(F.DEFAULT_CATEGORIES), budgets: {} };
    const progress = [0,1,2,3,4].map(i=>'<span class="'+(i<=onboardStep?'done':'')+'"></span>').join('');
    let body = '';
    if (onboardStep === 0) body = '<div class="onboarding-step-label">Bắt đầu hành trình</div><h2>Tiền bạc rõ ràng hơn. Mục tiêu gần hơn.</h2><p>VND Save giúp bạn hiểu dòng tiền, kiểm soát ngân sách và xây dựng thói quen tiết kiệm — tất cả trong không gian riêng tư trên thiết bị của bạn.</p><div class="card" style="padding:15px;margin-top:22px"><div style="display:flex;gap:11px;align-items:flex-start"><div class="empty-icon" style="width:35px;height:35px;margin:0;border-radius:9px">'+VNDIcon('shield',17)+'</div><div><strong style="font-size:11px">Riêng tư theo mặc định</strong><div class="small text-muted" style="line-height:1.6;margin-top:4px">Không cần tài khoản. Không tải dữ liệu tài chính lên máy chủ. Bạn có thể tự sao lưu bất cứ lúc nào.</div></div></div></div><div class="onboarding-actions"><span></span><button class="btn btn-primary" data-action="onboarding-next">Thiết lập ngay '+VNDIcon('arrowUpRight',15)+'</button></div>';
    if (onboardStep === 1) body = '<div class="onboarding-step-label">Bước 01 · Hồ sơ</div><h2>Trước tiên, hãy làm quen.</h2><p>Thông tin này giúp cá nhân hóa trải nghiệm và hỗ trợ bạn lập ngân sách. Thu nhập dự kiến không được tính là khoản thu thực tế.</p><form data-form="onboard-profile"><div class="form-field" style="margin-bottom:15px"><label class="field-label">Tên bạn muốn hiển thị</label><input class="field-input" name="name" maxlength="60" required placeholder="Ví dụ: Minh Anh" value="'+esc(draft.profile.name)+'"/></div><div class="form-field"><label class="field-label">Thu nhập dự kiến mỗi tháng (₫)</label><input class="field-input" name="monthlyIncome" type="number" min="0" step="1" placeholder="0" value="'+esc(draft.profile.monthlyIncome)+'"/><div class="field-hint">Có thể để trống hoặc nhập 0 nếu thu nhập chưa cố định.</div></div><div class="onboarding-actions"><button type="button" class="btn btn-secondary" data-action="onboarding-back">Quay lại</button><button class="btn btn-primary" type="submit">Tiếp tục '+VNDIcon('chevronRight',15)+'</button></div></form>';
    if (onboardStep === 2) body = '<div class="onboarding-step-label">Bước 02 · Danh mục</div><h2>Tiền của bạn đi đâu?</h2><p>Chọn các danh mục bạn thường sử dụng. Bạn có thể thêm, đổi tên hoặc xóa danh mục sau này trong Cài đặt.</p><div class="small text-muted" style="font-weight:700;margin:0 0 9px">THU NHẬP</div><div class="category-pick-grid">'+draft.categories.filter(c=>c.type==='income').map(c=>'<label class="category-pick"><input type="checkbox" data-draft-category="'+esc(c.id)+'" '+(c.selected===false?'':'checked')+'/><i style="width:7px;height:7px;background:'+esc(c.color)+';border-radius:2px"></i>'+esc(c.name)+'</label>').join('')+'</div><div class="small text-muted" style="font-weight:700;margin:17px 0 9px">CHI TIÊU</div><div class="category-pick-grid">'+draft.categories.filter(c=>c.type==='expense').map(c=>'<label class="category-pick"><input type="checkbox" data-draft-category="'+esc(c.id)+'" '+(c.selected===false?'':'checked')+'/><i style="width:7px;height:7px;background:'+esc(c.color)+';border-radius:2px"></i>'+esc(c.name)+'</label>').join('')+'</div><form data-form="onboard-category" style="display:flex;gap:7px;margin-top:15px"><input class="field-input" name="name" maxlength="35" placeholder="Tên danh mục mới…" required/><select class="field-select" name="type" style="width:130px"><option value="expense">Chi tiêu</option><option value="income">Thu nhập</option></select><button class="btn btn-secondary" type="submit">'+VNDIcon('plus',14)+' Thêm</button></form><div class="onboarding-actions"><button class="btn btn-secondary" data-action="onboarding-back">Quay lại</button><button class="btn btn-primary" data-action="onboarding-next">Tiếp tục '+VNDIcon('chevronRight',15)+'</button></div>';
    if (onboardStep === 3) {
      const expenses = draft.categories.filter(c=>c.type==='expense' && c.selected!==false);
      body = '<div class="onboarding-step-label">Bước 03 · Ngân sách</div><h2>Đặt giới hạn chi tiêu.</h2><p>Đây là ngân sách theo tháng. Bạn có thể bỏ qua hoặc thay đổi bất cứ lúc nào.</p><form data-form="onboard-budget"><div class="form-field" style="margin-bottom:14px"><label class="field-label">Áp dụng cho tháng</label><input class="field-input" type="month" name="budgetMonth" value="'+esc(draft.budgetMonth||F.currentMonth())+'"/></div><div style="display:flex;flex-direction:column;gap:9px">'+expenses.map(c=>'<div style="display:flex;align-items:center;gap:10px"><span class="budget-dot" style="background:'+esc(c.color)+';width:9px;height:9px"></span><label style="flex:1;font-size:11px;font-weight:600" for="budget-'+esc(c.id)+'">'+esc(c.name)+'</label><input id="budget-'+esc(c.id)+'" class="field-input" style="width:170px" type="number" min="0" step="1" name="budget-'+esc(c.id)+'" placeholder="0 ₫" value="'+esc(draft.budgets[c.id]||'')+'"/></div>').join('')+'</div><div class="onboarding-actions"><button type="button" class="btn btn-secondary" data-action="onboarding-back">Quay lại</button><button class="btn btn-primary" type="submit">Tiếp tục '+VNDIcon('chevronRight',15)+'</button></div></form>';
    }
    if (onboardStep === 4) body = '<div class="onboarding-step-label">Bước 04 · Hoàn tất</div><h2>Không gian tài chính đã sẵn sàng.</h2><p>VND Save đã được thiết lập. Từ bây giờ, các chỉ số sẽ chỉ phản ánh những giao dịch bạn thực sự ghi nhận — không có dữ liệu mẫu.</p><div class="card" style="padding:16px"><div class="setting-row"><div><strong>Hồ sơ</strong><span>'+esc(draft.profile.name)+'</span></div>'+VNDIcon('check',17,'text-success')+'</div><div class="setting-row"><div><strong>Danh mục được chọn</strong><span>'+draft.categories.filter(c=>c.selected!==false).length+' danh mục</span></div>'+VNDIcon('check',17,'text-success')+'</div><div class="setting-row"><div><strong>Ngân sách ban đầu</strong><span>'+Object.values(draft.budgets).filter(x=>Number(x)>0).length+' ngân sách</span></div>'+VNDIcon('check',17,'text-success')+'</div></div><div class="onboarding-actions"><button class="btn btn-secondary" data-action="onboarding-back">Quay lại</button><button class="btn btn-primary" data-action="finish-onboarding">Vào VND Save '+VNDIcon('arrowUpRight',15)+'</button></div>';
    return '<div class="onboarding-shell"><section class="onboarding-brand-panel"><div class="onboarding-brand"><img src="./public/logo.svg" alt=""/> VND Save</div><div class="onboarding-pitch"><h1>Take Control of Your Money.</h1><p>Một cách rõ ràng và bình tĩnh hơn để quản lý tiền bạc, theo dõi chi tiêu và tiến gần tới mục tiêu của bạn.</p></div><div class="onboarding-proof">'+VNDIcon('shield',15)+' Dữ liệu tài chính lưu trên thiết bị của bạn</div></section><section class="onboarding-main"><div class="onboarding-content"><div class="onboarding-progress">'+progress+'</div>'+body+'</div></section></div>';
  }

  function showModal(title, subtitle, body, footer, wide) {
    modal = '<div class="modal-backdrop" data-action="backdrop-close"><section class="modal '+(wide?'wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="modal-header"><div><h2>'+esc(title)+'</h2>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div><button class="icon-button" data-action="close-modal" aria-label="Đóng">'+VNDIcon('close',18)+'</button></div><div class="modal-body">'+body+'</div>'+(footer?'<div class="modal-footer">'+footer+'</div>':'')+'</section></div>';
    render();
    const first = $('.modal input, .modal select, .modal button'); if (first) first.focus();
  }
  function closeModal() { modal = null; pendingConfirm = null; restoreDraft = null; render(); }

  function showConfirm(title, message, callback, options) {
    const o = options || {};
    pendingConfirm = callback;
    const body = '<div class="confirm-copy">'+message+'</div>'+(o.warning?'<div class="confirm-warning">'+VNDIcon('warning',16)+'<span>'+esc(o.warning)+'</span></div>':'');
    showModal(title, o.subtitle || '', body, '<button class="btn btn-secondary" data-action="close-modal">Bỏ qua</button><button class="btn '+(o.danger?'btn-danger':'btn-primary')+'" data-action="confirm-action">'+esc(o.confirmLabel || 'Xác nhận')+'</button>');
  }

  function categoryOptions(type, selected) {
    return state.categories.filter(c=>c.type===type).map(c=>'<option value="'+esc(c.id)+'" '+(c.id===selected?'selected':'')+'>'+esc(c.name)+'</option>').join('');
  }

  function transactionModal(id) {
    const t = id ? state.transactions.find(x=>x.id===id) : null;
    const type = t ? t.type : 'expense';
    const cats = categoryOptions(type, t ? t.categoryId : (state.categories.find(c=>c.type===type)||{}).id);
    const body = '<form data-form="transaction" data-id="'+(t?esc(t.id):'')+'"><div class="form-grid"><div class="form-field full"><label class="field-label">Tên giao dịch *</label><input class="field-input" name="name" maxlength="90" required placeholder="Ví dụ: Ăn trưa, nhận lương…" value="'+esc(t?t.name:'')+'"/></div><div class="form-field"><label class="field-label">Số tiền (₫) *</label><input class="field-input" type="number" name="amount" min="1" max="9007199254740991" step="1" required placeholder="0" value="'+esc(t?t.amount:'')+'"/></div><div class="form-field"><label class="field-label">Loại giao dịch *</label><select class="field-select" name="type" data-transaction-type><option value="expense" '+(type==='expense'?'selected':'')+'>Chi tiêu</option><option value="income" '+(type==='income'?'selected':'')+'>Thu nhập</option></select></div><div class="form-field"><label class="field-label">Danh mục *</label><select class="field-select" name="categoryId" data-category-select required>'+cats+'</select></div><div class="form-field"><label class="field-label">Ngày giao dịch *</label><input class="field-input" type="date" name="date" required value="'+esc(t?t.date:dateToday())+'"/></div><div class="form-field full"><label class="field-label">Ghi chú</label><textarea class="field-textarea" name="note" maxlength="400" placeholder="Thông tin bổ sung (không bắt buộc)…">'+esc(t?t.note||'':'')+'</textarea></div></div></form>';
    const footer = '<button class="btn btn-secondary" data-action="close-modal">Hủy</button><button class="btn btn-primary" data-action="submit-modal-form">'+VNDIcon('check',14)+(t?'Lưu thay đổi':'Lưu giao dịch')+'</button>';
    showModal(t?'Chỉnh sửa giao dịch':'Thêm giao dịch', 'Giao dịch được cập nhật ngay vào các báo cáo liên quan.', body, footer);
  }

  function budgetModal(id) {
    const b = id ? state.budgets.find(x=>x.id===id) : null;
    const catId = b ? b.categoryId : (state.categories.find(c=>c.type==='expense')||{}).id;
    const existing = state.budgets.find(x=>x.month===(b?b.month:selectedMonth)&&x.categoryId===catId&&(!b||x.id!==b.id));
    const body = '<form data-form="budget" data-id="'+(b?esc(b.id):'')+'"><div class="form-grid"><div class="form-field full"><label class="field-label">Danh mục chi tiêu *</label><select class="field-select" name="categoryId" required>'+categoryOptions('expense',catId)+'</select></div><div class="form-field"><label class="field-label">Ngân sách (₫) *</label><input class="field-input" type="number" name="amount" min="0" step="1" required value="'+esc(b?b.amount:'')+'" placeholder="0"/></div><div class="form-field"><label class="field-label">Tháng áp dụng *</label><input class="field-input" type="month" name="month" required value="'+esc(b?b.month:selectedMonth)+'"/></div></div><p class="field-hint">Ngân sách 0 ₫ vẫn có thể lưu để theo dõi khoản chi không đặt hạn mức, nhưng phần trăm sẽ không chia cho 0.</p></form>';
    showModal(b?'Chỉnh sửa ngân sách':'Tạo ngân sách','Mỗi danh mục chỉ có một ngân sách trong cùng một tháng.',body,'<button class="btn btn-secondary" data-action="close-modal">Hủy</button><button class="btn btn-primary" data-action="submit-modal-form">Lưu ngân sách</button>');
  }

  function goalModal(id, funds) {
    const g = id ? state.savingsGoals.find(x=>x.id===id) : null;
    if (funds && g) {
      const body = '<form data-form="goal-funds" data-id="'+esc(g.id)+'"><div class="field-hint" style="margin-bottom:14px">Đã tiết kiệm '+esc(currency(g.saved))+' trên '+esc(currency(g.target))+'. Khoản thêm này chỉ cập nhật mục tiêu, không tạo giao dịch chi tiêu.</div><div class="form-field"><label class="field-label">Số tiền muốn thêm (₫) *</label><input class="field-input" type="number" min="1" step="1" name="amount" required placeholder="0"/></div></form>';
      showModal('Thêm tiền vào mục tiêu',g.name,body,'<button class="btn btn-secondary" data-action="close-modal">Hủy</button><button class="btn btn-primary" data-action="submit-modal-form">Cập nhật mục tiêu</button>');
      return;
    }
    const body = '<form data-form="goal" data-id="'+(g?esc(g.id):'')+'"><div class="form-grid"><div class="form-field full"><label class="field-label">Tên mục tiêu *</label><input class="field-input" name="name" maxlength="70" required value="'+esc(g?g.name:'')+'" placeholder="Ví dụ: Quỹ dự phòng"/></div><div class="form-field"><label class="field-label">Số tiền cần đạt (₫) *</label><input class="field-input" type="number" name="target" min="1" step="1" required value="'+esc(g?g.target:'')+'" placeholder="0"/></div><div class="form-field"><label class="field-label">Đã tiết kiệm (₫)</label><input class="field-input" type="number" name="saved" min="0" step="1" value="'+esc(g?g.saved:'0')+'"/></div><div class="form-field full"><label class="field-label">Ngày mục tiêu</label><input class="field-input" type="date" name="deadline" value="'+esc(g?g.deadline||'':'')+'"/><div class="field-hint">Không bắt buộc. Mục tiêu có thể không có thời hạn.</div></div></div></form>';
    showModal(g?'Chỉnh sửa mục tiêu':'Tạo mục tiêu tiết kiệm','Theo dõi tiến độ của một mục tiêu cụ thể.',body,'<button class="btn btn-secondary" data-action="close-modal">Hủy</button><button class="btn btn-primary" data-action="submit-modal-form">Lưu mục tiêu</button>');
  }

  function categoryModal(id, type) {
    const c = id ? category(id) : null;
    const body = '<form data-form="category" data-id="'+(c?esc(c.id):'')+'"><div class="form-field"><label class="field-label">Tên danh mục *</label><input class="field-input" name="name" maxlength="35" required value="'+esc(c?c.name:'')+'" placeholder="Ví dụ: Chăm sóc cá nhân"/></div><div class="form-field" style="margin-top:14px"><label class="field-label">Loại danh mục *</label><select class="field-select" name="type"><option value="income" '+((c?c.type:type)==='income'?'selected':'')+'>Thu nhập</option><option value="expense" '+((c?c.type:type)==='expense'?'selected':'')+'>Chi tiêu</option></select></div></form>';
    showModal(c?'Chỉnh sửa danh mục':'Thêm danh mục','Danh mục giúp phân loại và phân tích giao dịch.',body,'<button class="btn btn-secondary" data-action="close-modal">Hủy</button><button class="btn btn-primary" data-action="submit-modal-form">Lưu danh mục</button>');
  }

  function restorePreview(fileResult, fileName) {
    restoreDraft = fileResult.restored;
    const s = fileResult.summary;
    const created = s.createdAt ? new Date(s.createdAt).toLocaleString('vi-VN') : 'Không có thông tin';
    const body = '<p class="confirm-copy">Tệp <strong>'+esc(fileName)+'</strong> được xác thực là bản sao lưu VND Save phiên bản '+VNDBackup.VERSION+'. Kiểm tra thông tin trước khi tiếp tục.</p><div class="backup-summary"><div class="backup-stat"><span>Ngày tạo</span><strong style="font-size:11px">'+esc(created)+'</strong></div><div class="backup-stat"><span>Giao dịch</span><strong>'+s.transactions+'</strong></div><div class="backup-stat"><span>Danh mục</span><strong>'+s.categories+'</strong></div><div class="backup-stat"><span>Ngân sách</span><strong>'+s.budgets+'</strong></div><div class="backup-stat"><span>Mục tiêu tiết kiệm</span><strong>'+s.savingsGoals+'</strong></div><div class="backup-stat"><span>Hồ sơ</span><strong style="font-size:12px">'+esc(fileResult.restored.profile.name)+'</strong></div></div><div class="confirm-warning" style="margin-top:15px">'+VNDIcon('warning',16)+'<span>Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại trên thiết bị. Nên tạo backup hiện tại trước khi tiếp tục.</span></div>';
    showModal('Xem trước bản sao lưu','Chưa có dữ liệu nào bị thay đổi.',body,'<button class="btn btn-secondary" data-action="close-modal">Hủy</button><button class="btn btn-primary" data-action="restore-confirm">Khôi phục và ghi đè</button>',true);
  }

  function exportCSV() {
    const headers = ['Ngày giao dịch','Tên giao dịch','Loại','Danh mục','Số tiền (VND)','Ghi chú'];
    const rows = state.transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[
      t.date, t.name, t.type==='income'?'Thu nhập':'Chi tiêu', categoryName(t.categoryId), String(t.amount), t.note||''
    ]);
    const csv = '\uFEFF' + [headers,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href=url; a.download='VND-Save-giao-dich-'+dateToday()+'.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
    toast('Đã xuất CSV',state.transactions.length+' giao dịch đã được xuất.','success');
  }

  function wireDropZone() {
    const input = $('#restore-input'), drop = $('#restore-drop');
    if (input) input.addEventListener('change', async () => { if (input.files && input.files[0]) await handleRestoreFile(input.files[0]); input.value=''; });
    if (drop) {
      ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover');}));
      ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover');}));
      drop.addEventListener('drop',e=>{const file=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(file)handleRestoreFile(file);});
    }
  }
  async function handleRestoreFile(file) {
    try { const result = await VNDBackup.readFile(file); restorePreview(result,file.name); }
    catch (error) { toast('Không thể khôi phục',error.message,'error'); }
  }

  function saveStateThenRender(message) { persist(message).then(()=>render()).catch(()=>{}); }

  function handleSubmit(event) {
    const form = event.target.closest('form[data-form]'); if (!form) return;
    event.preventDefault();
    const data = new FormData(form); const kind = form.dataset.form; const id = form.dataset.id;
    if (kind === 'onboard-profile') {
      const name = String(data.get('name')||'').trim(); const income = Number(data.get('monthlyIncome')||0);
      if (!name || !Number.isFinite(income) || income<0) return toast('Thông tin chưa hợp lệ','Vui lòng nhập tên và thu nhập dự kiến hợp lệ.','error');
      draft.profile = { name, monthlyIncome: Math.round(income) }; onboardStep=2; render(); return;
    }
    if (kind === 'onboard-category') {
      const name = String(data.get('name')||'').trim(), type=String(data.get('type')||'expense');
      if (!name) return;
      if (draft.categories.some(c=>c.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi')&&c.type===type)) return toast('Danh mục đã tồn tại','Hãy chọn tên khác.','warning');
      draft.categories.push({id:F.uid('cat'),name,type,color:F.PALETTE[draft.categories.length%F.PALETTE.length]}); render(); return;
    }
    if (kind === 'onboard-budget') {
      form.querySelectorAll('input[name^="budget-"]').forEach(input=>{draft.budgets[input.name.slice(7)]=input.value;});
      draft.budgetMonth = form.querySelector('[name="budgetMonth"]')?.value || F.currentMonth();
      const total = Object.values(draft.budgets).reduce((s,v)=>s+(Number(v)||0),0);
      if (draft.profile.monthlyIncome>0 && total>draft.profile.monthlyIncome) {
        showConfirm('Ngân sách cao hơn thu nhập dự kiến','Tổng ngân sách bạn vừa nhập là <strong>'+esc(currency(total))+'</strong>, cao hơn thu nhập dự kiến <strong>'+esc(currency(draft.profile.monthlyIncome))+'</strong>.',()=>{onboardStep=4;modal=null;render();},{warning:'Bạn vẫn có thể tiếp tục và điều chỉnh ngân sách sau trong ứng dụng.',confirmLabel:'Vẫn tiếp tục'}); return;
      }
      onboardStep=4; render(); return;
    }
    if (kind === 'transaction') {
      const name=String(data.get('name')||'').trim(), amount=Number(data.get('amount')), type=String(data.get('type')), categoryId=String(data.get('categoryId')), date=String(data.get('date'));
      if (!name || !Number.isSafeInteger(amount) || amount<=0 || !['income','expense'].includes(type) || !categoryId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast('Giao dịch chưa hợp lệ','Kiểm tra tên, số tiền lớn hơn 0, loại, danh mục và ngày giao dịch.','error');
      const cat=category(categoryId); if (!cat || cat.type!==type) return toast('Danh mục không phù hợp','Hãy chọn danh mục cùng loại với giao dịch.','error');
      const tx={id:id||F.uid('tx'),name,amount,type,categoryId,date,note:String(data.get('note')||'').trim(),createdAt:id?(state.transactions.find(x=>x.id===id)||{}).createdAt||Date.now():Date.now()};
      if(id){const i=state.transactions.findIndex(x=>x.id===id);if(i<0)return toast('Không tìm thấy giao dịch','Dữ liệu có thể đã thay đổi.','error');state.transactions[i]=tx;} else state.transactions.push(tx);
      modal=null; saveStateThenRender(id?'Giao dịch đã được cập nhật.':'Giao dịch đã được thêm vào sổ thu chi.'); return;
    }
    if (kind === 'budget') {
      const categoryId=String(data.get('categoryId')), amount=Number(data.get('amount')), month=String(data.get('month'));
      if (!category(categoryId) || category(categoryId).type!=='expense' || !Number.isSafeInteger(amount) || amount<0 || !/^\d{4}-\d{2}$/.test(month)) return toast('Ngân sách chưa hợp lệ','Kiểm tra danh mục, số tiền và tháng áp dụng.','error');
      const duplicate=state.budgets.find(b=>b.month===month&&b.categoryId===categoryId&&b.id!==id);
      if (duplicate) return toast('Ngân sách đã tồn tại','Danh mục này đã có ngân sách trong tháng được chọn.','warning');
      const b={id:id||F.uid('budget'),categoryId,amount,month};
      if(id){const i=state.budgets.findIndex(x=>x.id===id);if(i<0)return toast('Không tìm thấy ngân sách','Vui lòng tải lại trang.','error');state.budgets[i]=b;}else state.budgets.push(b);
      modal=null; saveStateThenRender('Ngân sách đã được lưu.'); return;
    }
    if (kind === 'goal') {
      const name=String(data.get('name')||'').trim(),target=Number(data.get('target')),saved=Number(data.get('saved')||0),deadline=String(data.get('deadline')||'');
      if(!name||!Number.isSafeInteger(target)||target<=0||!Number.isSafeInteger(saved)||saved<0) return toast('Mục tiêu chưa hợp lệ','Tên và số tiền mục tiêu phải hợp lệ; số tiền đã tiết kiệm không được âm.','error');
      const g={id:id||F.uid('goal'),name,target,saved,deadline:deadline||null,completed:saved>=target};
      if(id){const i=state.savingsGoals.findIndex(x=>x.id===id);if(i<0)return toast('Không tìm thấy mục tiêu','Vui lòng tải lại trang.','error');state.savingsGoals[i]=g;}else state.savingsGoals.push(g);
      modal=null; saveStateThenRender('Mục tiêu tiết kiệm đã được lưu.'); return;
    }
    if (kind === 'goal-funds') {
      const amount=Number(data.get('amount')),g=state.savingsGoals.find(x=>x.id===id);
      if(!g||!Number.isSafeInteger(amount)||amount<=0)return toast('Số tiền không hợp lệ','Nhập số tiền lớn hơn 0.','error');
      g.saved+=amount;g.completed=g.saved>=g.target;modal=null;saveStateThenRender(g.completed?'Chúc mừng! Mục tiêu đã hoàn thành.':'Khoản tiết kiệm đã được cập nhật.');return;
    }
    if (kind === 'category') {
      const name=String(data.get('name')||'').trim(),type=String(data.get('type'));
      if(!name||!['income','expense'].includes(type))return toast('Danh mục chưa hợp lệ','Nhập tên và loại danh mục hợp lệ.','error');
      if(state.categories.some(c=>c.id!==id&&c.type===type&&c.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi')))return toast('Tên danh mục đã tồn tại','Hãy chọn tên khác.','warning');
      if(id){const c=category(id);if(!c)return;const oldType=c.type;const used=state.transactions.some(t=>t.categoryId===id);if(oldType!==type&&used)return toast('Không thể đổi loại danh mục','Danh mục đang được giao dịch sử dụng. Hãy tạo danh mục mới cùng loại để chuyển dữ liệu.','warning');c.name=name;c.type=type;if(oldType!==type)state.budgets=state.budgets.filter(b=>b.categoryId!==id);}
      else state.categories.push({id:F.uid('cat'),name,type,color:F.PALETTE[state.categories.length%F.PALETTE.length]});
      modal=null;saveStateThenRender('Danh mục đã được lưu.');return;
    }
    if (kind === 'profile-settings') {
      const name=String(data.get('name')||'').trim(),income=Number(data.get('monthlyIncome'));
      if(!name||!Number.isFinite(income)||income<0)return toast('Thông tin chưa hợp lệ','Tên không được để trống và thu nhập dự kiến không được âm.','error');
      state.profile={name,monthlyIncome:Math.round(income)};saveStateThenRender('Thông tin hồ sơ đã được cập nhật.');return;
    }
  }

  function handleClick(event) {
    const target = event.target.closest('[data-action],[data-page],[data-settings-tab]'); if (!target) return;
    if (target.dataset.page) {
      const nextPage = target.dataset.page;
      const destination = PAGE_FILES[nextPage];
      if (!destination) return;
      if (nextPage !== page) navigatePage(nextPage);
      return;
    }
    if (target.dataset.settingsTab) { settingsTab=target.dataset.settingsTab; render(); return; }
    const a=target.dataset.action, id=target.dataset.id;
    if (a==='dismiss-toast') {target.closest('.toast')?.remove();return;}
    if (a==='toggle-sidebar') {$('#sidebar')?.classList.toggle('open');$('.sidebar-scrim')?.classList.toggle('visible');return;}
    if (a==='close-sidebar') {$('#sidebar')?.classList.remove('open');$('.sidebar-scrim')?.classList.remove('visible');return;}
    if (a==='close-modal') {closeModal();return;}
    if (a==='backdrop-close' && event.target===target) {closeModal();return;}
    if (a==='submit-modal-form') {const form=$('.modal form[data-form]');if(form){if(form.requestSubmit)form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}return;}
    if (a==='confirm-action') {const fn=pendingConfirm;pendingConfirm=null;modal=null;if(fn)fn();else render();return;}
    if (a==='toggle-theme') {state.settings.theme=state.settings.theme==='dark'?'light':'dark';themeApply();saveStateThenRender('Giao diện đã được thay đổi.');return;}
    if (a==='set-theme') {state.settings.theme=target.dataset.theme;themeApply();saveStateThenRender('Đã lưu chế độ giao diện.');return;}
    if (a==='add-transaction') {transactionModal();return;}
    if (a==='edit-transaction') {transactionModal(id);return;}
    if (a==='delete-transaction') {const t=state.transactions.find(x=>x.id===id);if(!t)return;showConfirm('Xóa giao dịch này?','Bạn sắp xóa giao dịch <strong>'+esc(t.name)+'</strong> với số tiền <strong>'+esc(currency(t.amount))+'</strong>.',()=>{state.transactions=state.transactions.filter(x=>x.id!==id);saveStateThenRender('Giao dịch đã được xóa.');},{danger:true,confirmLabel:'Xóa giao dịch'});return;}
    if (a==='add-budget') {budgetModal();return;}
    if (a==='edit-budget') {budgetModal(id);return;}
    if (a==='delete-budget') {showConfirm('Xóa ngân sách?','Ngân sách này sẽ bị xóa. Các giao dịch thuộc danh mục vẫn được giữ nguyên.',()=>{state.budgets=state.budgets.filter(x=>x.id!==id);saveStateThenRender('Ngân sách đã được xóa.');},{danger:true,confirmLabel:'Xóa ngân sách'});return;}
    if (a==='add-goal') {goalModal();return;}
    if (a==='edit-goal') {goalModal(id);return;}
    if (a==='add-funds') {goalModal(id,true);return;}
    if (a==='delete-goal') {const g=state.savingsGoals.find(x=>x.id===id);showConfirm('Xóa mục tiêu tiết kiệm?','Mục tiêu <strong>'+esc(g?g.name:'')+'</strong> và tiến độ tích lũy trong ứng dụng sẽ bị xóa. Các giao dịch tài chính không bị ảnh hưởng.',()=>{state.savingsGoals=state.savingsGoals.filter(x=>x.id!==id);saveStateThenRender('Mục tiêu đã được xóa.');},{danger:true,confirmLabel:'Xóa mục tiêu'});return;}
    if (a==='add-category') {categoryModal(null,target.dataset.type||'expense');return;}
    if (a==='edit-category') {categoryModal(id);return;}
    if (a==='delete-category') {
      const c=category(id);if(!c)return;const count=state.transactions.filter(t=>t.categoryId===id).length;const fallback=state.categories.find(x=>x.type===c.type&&x.name.toLocaleLowerCase('vi')==='khác'&&x.id!==id)||state.categories.find(x=>x.type===c.type&&x.id!==id);
      showConfirm('Xóa danh mục "'+c.name+'"?',count?'Có '+count+' giao dịch đang sử dụng danh mục này. Khi xóa, các giao dịch đó sẽ được chuyển sang danh mục "'+(fallback?fallback.name:'Khác')+'". Ngân sách gắn với danh mục này cũng sẽ bị xóa.':'Danh mục này sẽ bị xóa. Ngân sách gắn với danh mục cũng sẽ bị xóa.',()=>{
        const destination=fallback||{id:F.uid('cat'),name:'Khác',type:c.type,color:'#94A3B8'};if(!fallback)state.categories.push(destination);
        state.transactions.forEach(t=>{if(t.categoryId===id)t.categoryId=destination.id;});state.budgets=state.budgets.filter(b=>b.categoryId!==id);state.categories=state.categories.filter(x=>x.id!==id);saveStateThenRender('Danh mục đã xóa; dữ liệu liên quan đã được xử lý.');
      },{danger:true,confirmLabel:'Xóa danh mục',warning:count?'Hệ thống sẽ chuyển giao dịch sang danh mục khác để không làm mất lịch sử thu chi.':''});return;
    }
    if (a==='backup') {VNDBackup.download(state);toast('Đã tạo bản sao lưu','Tệp .vndsave chứa dữ liệu ứng dụng hiện tại.');return;}
    if (a==='choose-restore') {$('#restore-input')?.click();return;}
    if (a==='restore-confirm') {
      if(!restoreDraft)return toast('Không có dữ liệu khôi phục','Hãy chọn lại file backup.','error');
      const next=clone(restoreDraft);VNDStorage.replace(next).then(()=>{state=next;selectedMonth=F.currentMonth();modal=null;restoreDraft=null;txFilters={search:'',type:'all',category:'all',month:'all',start:'',end:'',sort:'date-desc',min:'',max:''};render();toast('Khôi phục thành công','Dữ liệu từ file backup đã thay thế dữ liệu trên thiết bị.','success');}).catch(error=>toast('Khôi phục thất bại',error.message,'error'));return;
    }
    if (a==='export-csv') {exportCSV();return;}
    if (a==='clear-data') {showConfirm('Xóa toàn bộ dữ liệu VND Save?','Hồ sơ, tất cả giao dịch, danh mục tùy chỉnh, ngân sách, mục tiêu tiết kiệm và thiết lập sẽ bị xóa khỏi thiết bị này.',async()=>{try{await VNDStorage.clear();state=stateDefaults();draft=null;onboardStep=0;page='dashboard';modal=null;render();toast('Dữ liệu đã được xóa','Ứng dụng đã quay về trạng thái thiết lập ban đầu.');}catch(e){toast('Không thể xóa dữ liệu',e.message,'error');}},{danger:true,confirmLabel:'Xóa toàn bộ',warning:'Thao tác này không thể hoàn tác. Hãy tải bản sao lưu trước nếu bạn muốn giữ dữ liệu.'});return;}
    if (a==='reset-tx-filters') {txFilters={search:'',type:'all',category:'all',month:'all',start:'',end:'',sort:'date-desc',min:'',max:''};render();return;}
    if (a==='onboarding-next') {onboardStep=Math.min(4,onboardStep+1);render();return;}
    if (a==='onboarding-back') {if(onboardStep===3){const f=$('form[data-form="onboard-budget"]');if(f){f.querySelectorAll('input[name^="budget-"]').forEach(input=>draft.budgets[input.name.slice(7)]=input.value);draft.budgetMonth=f.querySelector('[name="budgetMonth"]')?.value||F.currentMonth();}}onboardStep=Math.max(0,onboardStep-1);render();return;}
    if (a==='finish-onboarding') {
      const categories=draft.categories.filter(c=>c.selected!==false).map(({selected,...c})=>c);
      if(!categories.length)return toast('Chưa chọn danh mục','Hãy chọn ít nhất một danh mục.','warning');
      const selectedCategoryIds=new Set(categories.filter(c=>c.type==='expense').map(c=>c.id));
      const budgets=Object.entries(draft.budgets||{}).filter(([categoryId,v])=>selectedCategoryIds.has(categoryId)&&Number(v)>0).map(([categoryId,amount])=>({id:F.uid('budget'),categoryId,amount:Math.round(Number(amount)),month:draft.budgetMonth||F.currentMonth()}));
      state={profile:draft.profile,categories,transactions:[],budgets,savingsGoals:[],settings:{theme:'light'},onboardingComplete:true};
      persist('Thiết lập ban đầu đã hoàn tất.').then(()=>{draft=null;page='dashboard';render();toast('Chào mừng bạn đến với VND Save','Không gian tài chính của bạn đã sẵn sàng.','success');}).catch(()=>{});return;
    }
  }

  function handleChange(event) {
    const t=event.target;
    if (t.matches('[data-filter="dashboard-month"]')) {if(/^\d{4}-\d{2}$/.test(t.value)){selectedMonth=t.value;render();}return;}
    if (t.matches('[data-filter]')) {
      const key=t.dataset.filter;
      if (key==='search') txFilters.search=t.value;
      if (key==='type') txFilters.type=t.value;
      if (key==='category') txFilters.category=t.value;
      if (key==='month') txFilters.month=t.value||'all';
      if (key==='start') txFilters.start=t.value;
      if (key==='end') txFilters.end=t.value;
      if (key==='sort') txFilters.sort=t.value;
      if (key==='min') txFilters.min=t.value;
      if (key==='max') txFilters.max=t.value;
      if (key==='analytics-period') analyticsPeriod=t.value;
      if (key==='analytics-start') customRange.start=t.value;
      if (key==='analytics-end') customRange.end=t.value;
      if (key==='report-period') reportPeriod=t.value;
      if ((key==='analytics-start' || key==='analytics-end') && customRange.start && customRange.end && customRange.start>customRange.end) { toast('Khoảng thời gian không hợp lệ','Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.','error'); return; }
      if ((key==='start' || key==='end') && txFilters.start && txFilters.end && txFilters.start>txFilters.end) { toast('Khoảng thời gian không hợp lệ','Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.','error'); return; }
      if (key!=='dashboard-month') render();
      return;
    }
    if (t.matches('[data-transaction-type]')) {
      const form=t.closest('form');const select=$('[data-category-select]',form);if(select)select.innerHTML=categoryOptions(t.value,'');return;
    }
    if (t.matches('[data-draft-category]')) {const c=draft.categories.find(x=>x.id===t.dataset.draftCategory);if(c)c.selected=t.checked;return;}
  }

  function handleInput(event) {
    const t=event.target;
    if (t.matches('[data-filter="search"],[data-filter="min"],[data-filter="max"]')) {
      const key=t.dataset.filter;txFilters[key]=t.value;
      const oldScroll=window.scrollY;
      const active=document.activeElement, start=active.selectionStart, end=active.selectionEnd;
      render();
      const replacement=$('[data-filter="'+key+'"]');if(replacement){replacement.focus();try{replacement.setSelectionRange(start,end);}catch(_){}}
      window.scrollTo(0,oldScroll);
    }
  }

  function handleKeydown(event) {
    if(event.key==='Escape') {
      if(modal){closeModal();return;}
      $('#sidebar')?.classList.remove('open');$('.sidebar-scrim')?.classList.remove('visible');
    }
  }

  function init() {
    document.addEventListener('click',handleClick);
    document.addEventListener('submit',handleSubmit);
    document.addEventListener('change',handleChange);
    document.addEventListener('input',handleInput);
    document.addEventListener('keydown',handleKeydown);
    if(window.matchMedia)window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(state.settings.theme==='system')themeApply();});
    VNDStorage.read().then(saved=>{
      if(saved && typeof saved==='object') {
        const base=stateDefaults();
        state={...base,...saved,profile:{...base.profile,...(saved.profile||{})},categories:Array.isArray(saved.categories)?saved.categories:base.categories,transactions:Array.isArray(saved.transactions)?saved.transactions:[],budgets:Array.isArray(saved.budgets)?saved.budgets:[],savingsGoals:Array.isArray(saved.savingsGoals)?saved.savingsGoals:[],settings:{...base.settings,...(saved.settings||{})}};
      }
      if(VNDStorage.getUsingFallback())toast('Chế độ lưu trữ dự phòng','Trình duyệt không cấp quyền IndexedDB; ứng dụng đang dùng localStorage.','warning');
      page = (document.body && document.body.dataset.page) || page;
      render();
      notifyParentReady();
    }).catch(error=>{
      state=stateDefaults();render();toast('Không thể đọc dữ liệu đã lưu',error.message,'error');
      notifyParentReady();
    });
  }

  init();
})();
