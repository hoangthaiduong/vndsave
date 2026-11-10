import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpFromLine,
  ArrowUpRight, BarChart3, BookOpen, BriefcaseBusiness, CalendarDays, CarFront,
  ChartNoAxesCombined, ChartPie, CalendarRange, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, CircleDollarSign, CircleHelp, Clapperboard, Download,
  FileChartColumn, FileUp, FolderOpen, Gift, HeartPulse, House, Info, Landmark,
  LayoutDashboard, Lightbulb, Menu, MoreHorizontal, Moon, Pencil, PiggyBank, Plane,
  Plus, Receipt, Save, Search, Settings, ShieldCheck, ShoppingBag, Sparkles, Sun,
  Target, Trash2, TrendingDown, TrendingUp, Utensils, Upload, UserRound, Wallet,
  WalletCards, X,
} from 'lucide-react';
import { loadState, saveState, clearDatabase } from './lib/db.js';
import { formatVND, monthKey, id, totals } from './lib/finance.js';
import { downloadBackup, validateBackup } from './lib/backup.js';


import { Modal, Toast } from './components/ui.jsx';
import { Onboarding, TransactionModal, CategoryModal, GoalModal, ContributionModal, ProfileModal } from './components/modals.jsx';
import { DashboardPage, TransactionsPage, BudgetsPage, AnalyticsPage, InsightsPage, SavingsPage, ReportsPage, SettingsPage } from './pages/index.jsx';

const NAV = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'transactions', label: 'Giao dịch', icon: ArrowLeftRight },
  { id: 'budgets', label: 'Ngân sách', icon: Wallet },
  { id: 'analytics', label: 'Phân tích', icon: ChartNoAxesCombined },
  { id: 'insights', label: 'Monthly Insights', icon: Lightbulb },
  { id: 'savings', label: 'Tiết kiệm', icon: PiggyBank },
  { id: 'reports', label: 'Báo cáo', icon: FileChartColumn },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];
const TITLES = Object.fromEntries(NAV.map((item) => [item.id, item.label]));
function App() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState('');
  const [page, setPage] = useState('dashboard');
  const [month, setMonth] = useState(monthKey());
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [backupPreview, setBackupPreview] = useState(null);
  const [importChoice, setImportChoice] = useState('replace');
  const fileRef = useRef(null);
  const [isPersisting, setIsPersisting] = useState(false);

  useEffect(() => {
    let active = true;
    loadState().then((loaded) => { if (active) { setState(loaded); setLoading(false); } }).catch((error) => { if (active) { setDbError(error.message || 'Không thể truy cập dữ liệu cục bộ.'); setLoading(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!state) return;
    document.documentElement.dataset.theme = state.settings?.theme || 'light';
    document.documentElement.style.colorScheme = state.settings?.theme || 'light';
  }, [state?.settings?.theme]);

  useEffect(() => {
    const handler = (e) => { if (e.detail && NAV.some((item) => item.id === e.detail)) { setPage(e.detail); setMobileNav(false); } };
    window.addEventListener('vnd-navigate', handler);
    return () => window.removeEventListener('vnd-navigate', handler);
  }, []);

  useEffect(() => {
    if (!state || loading) return;
    let active = true;
    setIsPersisting(true);
    saveState(state).then(() => { if (active) setIsPersisting(false); }).catch((error) => { if (active) { setIsPersisting(false); setToast({ type: 'error', message: `Không thể lưu dữ liệu: ${error.message}` }); } });
    return () => { active = false; };
  }, [state, loading]);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3600);
  }, []);
  const update = useCallback((fn) => setState((prev) => typeof fn === 'function' ? fn(prev) : fn), []);
  const currentMonthTransactions = useMemo(() => state ? state.transactions.filter((t) => t.date?.slice(0, 7) === month) : [], [state, month]);
  const currentTotals = useMemo(() => totals(state?.transactions || [], month), [state, month]);
  const allTotals = useMemo(() => totals(state?.transactions || []), [state]);
  const activeCategories = useMemo(() => (state?.categories || []).filter((c) => c.active !== false), [state]);

  const completeOnboarding = (newState) => {
    setState(newState);
    setPage('dashboard');
    notify('Thiết lập VND Save thành công. Chào mừng bạn!', 'success');
  };
  const saveTransaction = (transaction) => {
    const existed = state.transactions.some((t) => t.id === transaction.id);
    update((prev) => ({ ...prev, transactions: prev.transactions.some((t) => t.id === transaction.id) ? prev.transactions.map((t) => t.id === transaction.id ? transaction : t) : [transaction, ...prev.transactions] }));
    setModal(null);
    notify(existed ? 'Đã cập nhật giao dịch.' : 'Đã thêm giao dịch mới.');
  };
  const deleteTransaction = (tx) => {
    if (!window.confirm(`Bạn có chắc muốn xóa giao dịch “${tx.title}” (${formatVND(tx.amount)})?`)) return;
    update((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== tx.id) }));
    notify('Đã xóa giao dịch.');
  };
  const saveCategory = (category) => {
    update((prev) => ({ ...prev, categories: prev.categories.some((c) => c.id === category.id) ? prev.categories.map((c) => c.id === category.id ? { ...c, active: true } : c) : [...prev.categories, category] }));
    setModal(null); notify('Đã cập nhật danh mục.');
  };
  const deleteCategory = (category) => {
    const used = state.transactions.some((t) => t.categoryId === category.id);
    const message = used ? `Danh mục “${category.name}” đã có giao dịch. Danh mục sẽ được ẩn khỏi lựa chọn mới nhưng lịch sử giao dịch và ngân sách cũ được giữ nguyên.` : `Xóa danh mục “${category.name}”?`;
    if (!window.confirm(message)) return;
    update((prev) => ({ ...prev, categories: prev.categories.map((c) => c.id === category.id ? { ...c, active: false } : c) }));
    notify('Đã xóa danh mục khỏi danh sách đang sử dụng.');
  };
  const setBudget = (categoryId, value) => {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount < 0) return notify('Ngân sách phải là số nguyên VND không âm.', 'error');
    update((prev) => {
      const existing = prev.budgets.find((b) => b.categoryId === categoryId && b.month === month);
      const record = { id: existing?.id || `${categoryId}-${month}`, categoryId, month, amount };
      return { ...prev, budgets: existing ? prev.budgets.map((b) => b.id === existing.id ? record : b) : [...prev.budgets, record] };
    });
    notify('Đã cập nhật ngân sách tháng.');
  };
  const setGoal = (goal) => {
    update((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.some((g) => g.id === goal.id) ? prev.savingsGoals.map((g) => g.id === goal.id ? goal : g) : [...prev.savingsGoals, goal] }));
    setModal(null); notify('Đã lưu mục tiêu tiết kiệm.');
  };
  const updateGoalSaved = (goal, amount) => { update((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.map((g) => g.id === goal.id ? { ...g, saved: amount } : g) })); setModal(null); notify('Đã cập nhật số tiền mục tiêu.'); };
  const deleteGoal = (goal) => { if (!window.confirm(`Xóa mục tiêu “${goal.name}”?`)) return; update((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.filter((g) => g.id !== goal.id) })); notify('Đã xóa mục tiêu.'); };
  const saveProfile = (profile) => { update((prev) => ({ ...prev, profile: { ...prev.profile, ...profile } })); notify('Đã cập nhật hồ sơ.'); };
  const setTheme = (theme) => update((prev) => ({ ...prev, settings: { ...prev.settings, theme } }));

  const importFile = async (file) => {
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith('.vndsave')) throw new Error('Vui lòng chọn tệp có phần mở rộng .vndsave.');
      const parsed = JSON.parse(await file.text());
      const backup = validateBackup(parsed);
      setBackupPreview({ backup, fileName: file.name });
    } catch (error) { notify(error.message || 'Không thể đọc tệp sao lưu.', 'error'); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const applyImport = () => {
    if (!backupPreview) return;
    if (importChoice !== 'replace') return notify('Hiện chỉ hỗ trợ thay thế toàn bộ để tránh gộp trùng dữ liệu.', 'warning');
    const b = backupPreview.backup;
    setState({ profile: b.profile, categories: b.categories, transactions: b.transactions, budgets: b.budgets, savingsGoals: b.savingsGoals, settings: { ...b.settings, onboarded: true } });
    setBackupPreview(null); setPage('dashboard'); notify('Đã khôi phục dữ liệu từ backup .vndsave.');
  };
  const exportBackup = () => { downloadBackup(state); notify('Đã tạo tệp backup .vndsave.'); };
  const deleteAll = async () => {
    const accepted = window.confirm('XÓA TOÀN BỘ DỮ LIỆU VND SAVE?\n\nThao tác này sẽ xóa hồ sơ, danh mục, giao dịch, ngân sách, mục tiêu tiết kiệm và cài đặt trên trình duyệt hiện tại. Hãy xuất backup trước nếu cần giữ dữ liệu.');
    if (!accepted) return;
    try { await clearDatabase(); setState({ profile: null, categories: [], transactions: [], budgets: [], savingsGoals: [], settings: { id: 'app', theme: 'light', currency: 'VND', onboarded: false } }); setPage('dashboard'); notify('Đã xóa toàn bộ dữ liệu.'); }
    catch (e) { notify(`Không thể xóa dữ liệu: ${e.message}`, 'error'); }
  };

  if (loading) return <div className="app-loading"><div className="loading-mark"><Wallet size={24} /></div><strong>VND Save</strong><span>Đang mở không gian tài chính...</span><div className="loading-line" /></div>;
  if (dbError) return <div className="fatal-screen"><div className="fatal-card"><div className="fatal-icon"><AlertTriangle size={25} /></div><h1>Không thể mở dữ liệu</h1><p>{dbError}</p><p className="muted">Hãy bật chế độ duyệt web thông thường, kiểm tra cài đặt quyền lưu trữ và mở lại ứng dụng trên một origin ổn định (localhost hoặc domain đã deploy).</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Thử lại</button></div></div>;
  if (!state?.profile || !state?.settings?.onboarded) return <Onboarding onComplete={completeOnboarding} toast={notify} />;

  const navigate = (next) => { setPage(next); setMobileNav(false); };
  const commonProps = { state, update, month, setMonth, notify, setModal, setTransaction: saveTransaction, deleteTransaction, activeCategories, setBudget, saveCategory, deleteCategory, setGoal, updateGoalSaved, deleteGoal };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><img src="/assets/logo.svg" alt="VND Save" /><button className="sidebar-close icon-btn" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="workspace-label">KHÔNG GIAN CỦA BẠN</div>
      <nav className="nav-list">{NAV.map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><Icon size={19} strokeWidth={1.9} /><span>{item.label}</span>{page === item.id && <i />}</button>; })}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-security"><div className="security-icon"><ShieldCheck size={17} /></div><div><strong>Dữ liệu của riêng bạn</strong><span>Lưu trữ trên thiết bị này</span></div></div>
      <button className="profile-mini" onClick={() => navigate('settings')}><div className="avatar">{state.profile.name.slice(0, 1).toUpperCase()}</div><div className="profile-mini-copy"><strong>{state.profile.name}</strong><span>Hồ sơ cá nhân</span></div><ChevronDown size={16} /></button>
    </aside>
    {mobileNav && <button aria-label="Đóng menu" className="sidebar-scrim" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-btn" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div><div className="breadcrumb">VND SAVE <span>/</span> {TITLES[page]}</div><h1>{TITLES[page]}</h1></div></div><div className="topbar-right"><div className={`save-status ${isPersisting ? 'saving' : ''}`}><span />{isPersisting ? 'Đang lưu' : 'Đã lưu trên thiết bị'}</div><button className="theme-quick icon-btn" onClick={() => setTheme(state.settings.theme === 'dark' ? 'light' : 'dark')} title="Đổi giao diện">{state.settings.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><div className="top-avatar">{state.profile.name.slice(0, 1).toUpperCase()}</div></div></header>
      <div className="page-content">
        {page === 'dashboard' && <DashboardPage {...commonProps} allTotals={allTotals} currentTotals={currentTotals} />}
        {page === 'transactions' && <TransactionsPage {...commonProps} />}
        {page === 'budgets' && <BudgetsPage {...commonProps} />}
        {page === 'analytics' && <AnalyticsPage {...commonProps} categories={state.categories} />}
        {page === 'insights' && <InsightsPage {...commonProps} />}
        {page === 'savings' && <SavingsPage {...commonProps} />}
        {page === 'reports' && <ReportsPage {...commonProps} />}
        {page === 'settings' && <SettingsPage {...commonProps} saveProfile={saveProfile} setTheme={setTheme} exportBackup={exportBackup} openImport={() => fileRef.current?.click()} deleteAll={deleteAll} />}
      </div>
      <footer className="app-footer"><span>© {new Date().getFullYear()} VND Save</span><span><ShieldCheck size={14} /> Dữ liệu được lưu cục bộ · Không đồng bộ đám mây</span></footer>
    </main>
    <input ref={fileRef} type="file" accept=".vndsave,application/json" hidden onChange={(e) => importFile(e.target.files?.[0])} />

    {modal?.type === 'transaction' && <TransactionModal initial={modal.initial} categories={activeCategories} onSave={saveTransaction} onClose={() => setModal(null)} />}
    {modal?.type === 'category' && <CategoryModal initial={modal.initial} onSave={saveCategory} onClose={() => setModal(null)} />}
    {modal?.type === 'goal' && <GoalModal initial={modal.initial} onSave={setGoal} onClose={() => setModal(null)} />}
    {modal?.type === 'contribution' && <ContributionModal goal={modal.goal} mode={modal.mode} onClose={() => setModal(null)} onSave={(v) => updateGoalSaved(modal.goal, v)} />}
    {modal?.type === 'profile' && <ProfileModal profile={state.profile} onClose={() => setModal(null)} onSave={(p) => { saveProfile(p); setModal(null); }} />}
    {backupPreview && <Modal title="Xem trước bản sao lưu" subtitle="Kiểm tra nội dung trước khi thay thế dữ liệu hiện tại." onClose={() => setBackupPreview(null)} footer={<><button className="btn btn-secondary" onClick={() => setBackupPreview(null)}>Hủy</button><button className="btn btn-primary" onClick={applyImport}><Upload size={16} />Khôi phục dữ liệu</button></>}>
      <div className="backup-preview"><div className="backup-file"><div className="file-badge"><FileUp size={22} /></div><div><strong>{backupPreview.fileName}</strong><span>Backup VND Save · Phiên bản {backupPreview.backup.version}</span></div></div><div className="backup-stats"><div><strong>{backupPreview.backup.transactions.length}</strong><span>Giao dịch</span></div><div><strong>{backupPreview.backup.categories.length}</strong><span>Danh mục</span></div><div><strong>{backupPreview.backup.savingsGoals.length}</strong><span>Mục tiêu</span></div></div><div className="backup-warning"><AlertTriangle size={18} /><span>Khôi phục sẽ thay thế toàn bộ dữ liệu đang có trên trình duyệt này. Hãy tải backup hiện tại trước khi tiếp tục nếu bạn muốn giữ lại.</span></div><label className="field"><span>Phương thức nhập</span><select value={importChoice} onChange={(e) => setImportChoice(e.target.value)}><option value="replace">Thay thế toàn bộ dữ liệu hiện tại</option></select></label><p className="muted small">Ngày xuất: {backupPreview.backup.exportedAt ? new Date(backupPreview.backup.exportedAt).toLocaleString('vi-VN') : 'Không xác định'}</p></div>
    </Modal>}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </div>;
}

export default App;
