import { useState } from 'react';
import {
  AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronLeft,
  Plus, Save, ShieldCheck, Trash2, UserRound,
} from 'lucide-react';
import { DEFAULT_CATEGORIES, CATEGORY_ICONS, formatVND, formatDate, monthKey, id } from '../lib/finance.js';
import { CategoryIcon, Modal } from './ui.jsx';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TransactionModal({ initial, categories, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ type: initial?.type || 'expense', title: initial?.title || '', amount: initial?.amount ? String(initial.amount) : '', categoryId: initial?.categoryId || categories[0]?.id || '', date: initial?.date || today(), note: initial?.note || '' }));
  const [error, setError] = useState('');
  const available = categories.filter((c) => c.active !== false);
  if (initial?.categoryId && !available.some((c) => c.id === initial.categoryId)) available.push({ id: initial.categoryId, name: `${initial.categoryName || 'Danh mục đã lưu'} (đã lưu)`, icon: 'wallet', color: initial.categoryColor || '#94A3B8' });
  const submit = (e) => {
    e.preventDefault();
    const amount = Number(String(form.amount).replace(/[,.\s]/g, ''));
    if (!form.title.trim()) return setError('Vui lòng nhập tên giao dịch.');
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amount)) return setError('Số tiền phải là số nguyên VND lớn hơn 0.');
    if (!form.date) return setError('Vui lòng chọn ngày giao dịch.');
    const category = available.find((c) => c.id === form.categoryId);
    if (!category) return setError('Vui lòng chọn một danh mục hợp lệ.');
    onSave({ ...initial, ...form, title: form.title.trim(), amount, categoryName: initial?.categoryId === category.id ? (initial.categoryName || category.name) : category.name, categoryColor: category.color, id: initial?.id || id() });
  };
  return <Modal title={initial ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch mới'} subtitle="Nhập thông tin để ghi nhận chính xác dòng tiền của bạn." onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" form="transaction-form" type="submit" disabled={!available.length}><Save size={16} />{initial ? 'Lưu thay đổi' : 'Lưu giao dịch'}</button></>}>
    <form id="transaction-form" className="form-stack" onSubmit={submit}>
      <div className="segmented"><button type="button" className={form.type === 'expense' ? 'selected expense' : ''} onClick={() => setForm({ ...form, type: 'expense' })}><ArrowUpRight size={16} /> Chi tiêu</button><button type="button" className={form.type === 'income' ? 'selected income' : ''} onClick={() => setForm({ ...form, type: 'income' })}><ArrowDownLeft size={16} /> Thu nhập</button></div>
      <label className="field"><span>Tên giao dịch <b>*</b></span><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ví dụ: Ăn trưa, lương tháng..." maxLength={90} /></label>
      <label className="field"><span>Số tiền (VND) <b>*</b></span><div className="input-suffix"><input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9]/g, '') })} placeholder="0" /><span>₫</span></div></label>
      <div className="form-grid"><label className="field"><span>Danh mục <b>*</b></span>{available.length ? <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <div className="inline-error">Chưa có danh mục. Hãy thêm danh mục trong phần Cài đặt trước khi tạo giao dịch.</div>}</label><label className="field"><span>Ngày giao dịch <b>*</b></span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label></div>
      <label className="field"><span>Ghi chú <small>Không bắt buộc</small></span><textarea rows="3" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Thêm thông tin chi tiết..." maxLength={500} /></label>
      {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
    </form>
  </Modal>;
}

export function CategoryModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [icon, setIcon] = useState(initial?.icon || 'wallet');
  const [color, setColor] = useState(initial?.color || '#2563EB');
  const [error, setError] = useState('');
  return <Modal title={initial ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'} onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" onClick={() => { if (!name.trim()) return setError('Tên danh mục không được để trống.'); onSave({ ...initial, id: initial?.id || id(), name: name.trim(), icon, color, active: true }); }}>Lưu danh mục</button></>}>
    <div className="form-stack"><label className="field"><span>Tên danh mục</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Chăm sóc cá nhân" maxLength={40} /></label><div className="field"><span>Biểu tượng</span><div className="icon-picker">{CATEGORY_ICONS.map(([key, label]) => <button key={key} title={label} className={icon === key ? 'chosen' : ''} onClick={() => setIcon(key)} type="button"><CategoryIcon name={key} size={19} /></button>)}</div></div><label className="field"><span>Màu nhận diện</span><div className="color-row">{['#2563EB','#0EA5E9','#14B8A6','#16A34A','#F59E0B','#F97316','#EC4899','#8B5CF6','#64748B','#EF4444'].map((c) => <button type="button" key={c} className={color === c ? 'color-dot active' : 'color-dot'} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}</div></label>{error && <div className="inline-error">{error}</div>}</div>
  </Modal>;
}

export function GoalModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ name: initial?.name || '', target: initial?.target ? String(initial.target) : '', saved: initial?.saved ? String(initial.saved) : '0', targetDate: initial?.targetDate || '', note: initial?.note || '' });
  const [error, setError] = useState('');
  return <Modal title={initial ? 'Chỉnh sửa mục tiêu' : 'Tạo mục tiêu tiết kiệm'} subtitle="Đặt một cột mốc rõ ràng cho kế hoạch tài chính của bạn." onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" onClick={() => { const target = Number(form.target); const saved = Number(form.saved); if (!form.name.trim()) return setError('Vui lòng nhập tên mục tiêu.'); if (!Number.isSafeInteger(target) || target <= 0) return setError('Số tiền mục tiêu phải là số nguyên VND lớn hơn 0.'); if (!Number.isSafeInteger(saved) || saved < 0) return setError('Số tiền đã tiết kiệm không hợp lệ.'); onSave({ ...initial, id: initial?.id || id(), name: form.name.trim(), target, saved, targetDate: form.targetDate, note: form.note.trim() }); }}><Save size={16} />Lưu mục tiêu</button></>}>
    <div className="form-stack"><label className="field"><span>Tên mục tiêu <b>*</b></span><input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Quỹ dự phòng" maxLength={80} /></label><div className="form-grid"><label className="field"><span>Số tiền cần đạt (₫) <b>*</b></span><input inputMode="numeric" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value.replace(/[^0-9]/g, '') })} placeholder="20.000.000" /></label><label className="field"><span>Đã tiết kiệm (₫)</span><input inputMode="numeric" value={form.saved} onChange={(e) => setForm({ ...form, saved: e.target.value.replace(/[^0-9]/g, '') })} /></label></div><label className="field"><span>Ngày mục tiêu</span><input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} /></label><label className="field"><span>Ghi chú</span><textarea rows="2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Kế hoạch hoặc lý do tiết kiệm..." /></label>{error && <div className="inline-error">{error}</div>}</div>
  </Modal>;
}

export function ContributionModal({ goal, mode, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  return <Modal title={mode === 'add' ? 'Nạp tiền vào mục tiêu' : 'Rút tiền khỏi mục tiêu'} subtitle={goal.name} onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" onClick={() => { const value = Number(amount); if (!Number.isSafeInteger(value) || value <= 0) return setError('Nhập số tiền nguyên VND lớn hơn 0.'); if (mode === 'withdraw' && value > goal.saved) return setError('Số tiền rút vượt quá số dư mục tiêu.'); onSave(mode === 'add' ? goal.saved + value : goal.saved - value); }}><Check size={16} />Xác nhận</button></>}>
    <div className="form-stack"><div className="contribution-balance"><span>Số dư hiện tại</span><strong>{formatVND(goal.saved)}</strong></div><label className="field"><span>Số tiền {mode === 'add' ? 'nạp' : 'rút'} (VND)</span><input autoFocus inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" /></label>{error && <div className="inline-error">{error}</div>}</div>
  </Modal>;
}

export function Onboarding({ onComplete, toast }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [income, setIncome] = useState('');
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES.map((c) => ({ ...c, budget: '' })));
  const [custom, setCustom] = useState(null);
  const [error, setError] = useState('');
  const totalBudget = categories.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);
  const updateCategory = (key, changes) => setCategories((list) => list.map((c) => c.id === key ? { ...c, ...changes } : c));
  const finish = () => {
    const expected = Number(income);
    if (!name.trim()) return setError('Vui lòng nhập tên của bạn.');
    if (!Number.isSafeInteger(expected) || expected < 0) return setError('Thu nhập dự kiến phải là số nguyên VND không âm.');
    if (totalBudget > expected && !window.confirm(`Tổng ngân sách (${formatVND(totalBudget)}) lớn hơn thu nhập dự kiến (${formatVND(expected)}). Bạn vẫn muốn tiếp tục với các mức ngân sách này?`)) return;
    const nowMonth = monthKey();
    const finalCategories = categories.map((c) => ({ ...c, budget: Number(c.budget) || 0, active: true }));
    onComplete({ profile: { id: 'profile', name: name.trim(), monthlyIncome: expected }, categories: finalCategories, budgets: finalCategories.map((c) => ({ id: `${c.id}-${nowMonth}`, categoryId: c.id, month: nowMonth, amount: c.budget })), transactions: [], savingsGoals: [], settings: { id: 'app', theme: 'light', currency: 'VND', onboarded: true } });
  };
  return <div className="onboarding-shell"><div className="onboarding-top"><img src="/assets/logo.svg" alt="VND Save" /><span>Thiết lập không gian tài chính của bạn</span></div><div className="onboarding-main"><div className="onboarding-progress"><div className={step >= 1 ? 'active' : ''}><span>1</span><label>Hồ sơ</label></div><i /><div className={step >= 2 ? 'active' : ''}><span>2</span><label>Ngân sách</label></div><i /><div className={step >= 3 ? 'active' : ''}><span>3</span><label>Xác nhận</label></div></div>
    <div className="onboarding-card">
      {step === 1 && <><div className="onboarding-kicker">CHÀO MỪNG ĐẾN VND SAVE</div><h1>Bắt đầu với một<br /><em>bức tranh tài chính</em> rõ ràng.</h1><p className="onboarding-lead">Một vài thông tin cơ bản giúp bạn thiết lập ngân sách phù hợp và theo dõi dòng tiền dễ dàng hơn.</p><div className="form-stack onboarding-form"><label className="field"><span>Bạn muốn được gọi là gì?</span><div className="input-with-icon"><UserRound size={18} /><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên của bạn" maxLength={50} /></div></label><label className="field"><span>Thu nhập dự kiến mỗi tháng (VND)</span><div className="input-suffix"><input inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Ví dụ: 15.000.000" /><span>₫</span></div><small>Chỉ dùng làm mức tham chiếu, không tự động cộng vào thu nhập thực tế.</small></label></div><button className="btn btn-primary btn-large full" onClick={() => { if (!name.trim()) return setError('Vui lòng nhập tên của bạn.'); if (income === '' || !Number.isSafeInteger(Number(income))) return setError('Vui lòng nhập thu nhập dự kiến hợp lệ.'); setError(''); setStep(2); }}>Tiếp tục <ArrowRight size={17} /></button></>}
      {step === 2 && <><div className="onboarding-kicker">THIẾT LẬP NGÂN SÁCH</div><h1>Phân bổ ngân sách<br /><em>theo cách của bạn.</em></h1><p className="onboarding-lead">Bạn có thể bắt đầu từ các danh mục phổ biến, thay đổi số tiền hoặc thêm danh mục riêng.</p><div className="onboard-category-list">{categories.map((c) => <div className="onboard-category" key={c.id}><button type="button" className="category-symbol" style={{ color: c.color, background: `${c.color}15` }} title="Đổi biểu tượng và màu" onClick={() => setCustom(c)}><CategoryIcon name={c.icon} /></button><input className="category-name-input" value={c.name} onChange={(e) => updateCategory(c.id, { name: e.target.value })} aria-label="Tên danh mục" /><div className="onboard-budget-input"><input inputMode="numeric" value={c.budget} onChange={(e) => updateCategory(c.id, { budget: e.target.value.replace(/[^0-9]/g, '') })} placeholder="0" /><span>₫</span></div><button className="subtle-icon-btn" onClick={() => setCategories((list) => list.filter((x) => x.id !== c.id))} title="Xóa danh mục"><Trash2 size={16} /></button></div>)}</div><button className="add-category-link" onClick={() => setCustom({ name: '', icon: 'wallet', color: '#2563EB' })}><Plus size={16} /> Thêm danh mục khác</button><div className="onboard-total"><div><span>Tổng ngân sách tháng</span><strong>{formatVND(totalBudget)}</strong></div><span className="muted">Thu nhập dự kiến: {formatVND(Number(income) || 0)}</span></div><div className="onboarding-actions"><button className="btn btn-secondary" onClick={() => setStep(1)}><ChevronLeft size={16} /> Quay lại</button><button className="btn btn-primary" onClick={() => { if (!categories.length) return setError('Hãy giữ lại hoặc thêm ít nhất một danh mục.'); if (categories.some((c) => !c.name.trim())) return setError('Tên danh mục không được để trống.'); setError(''); setStep(3); }}>Tiếp tục <ArrowRight size={17} /></button></div></>}
      {step === 3 && <><div className="onboarding-kicker">XÁC NHẬN THIẾT LẬP</div><h1>Mọi thứ đã sẵn sàng<br /><em>để bắt đầu.</em></h1><p className="onboarding-lead">Kiểm tra lại các thông tin trước khi tạo không gian quản lý tài chính.</p><div className="setup-summary"><div><span>Chủ tài khoản</span><strong>{name}</strong></div><div><span>Thu nhập dự kiến/tháng</span><strong>{formatVND(Number(income) || 0)}</strong></div><div><span>Số danh mục</span><strong>{categories.length} danh mục</strong></div><div><span>Tổng ngân sách</span><strong>{formatVND(totalBudget)}</strong></div><div className="summary-highlight"><span>Còn lại sau phân bổ</span><strong className={Number(income) - totalBudget < 0 ? 'negative' : ''}>{formatVND(Number(income) - totalBudget)}</strong></div></div>{totalBudget > Number(income) && <div className="setup-warning"><AlertTriangle size={18} /><span>Ngân sách đang cao hơn thu nhập dự kiến. Bạn có thể quay lại điều chỉnh, hoặc xác nhận tiếp tục với thiết lập hiện tại.</span></div>}<div className="onboarding-actions"><button className="btn btn-secondary" onClick={() => setStep(2)}><ChevronLeft size={16} /> Quay lại</button><button className="btn btn-primary" onClick={finish}>Hoàn tất thiết lập <Check size={17} /></button></div></>}
      {error && <div className="inline-error onboarding-error">{error}</div>}
    </div><p className="onboarding-foot"><ShieldCheck size={15} /> Dữ liệu được lưu trực tiếp trên trình duyệt của bạn.</p></div>
    {custom && <CategoryModal initial={custom.id ? custom : null} onClose={() => setCustom(null)} onSave={(c) => { setCategories((list) => custom.id ? list.map((item) => item.id === c.id ? { ...item, ...c } : item) : [...list, { ...c, budget: '' }]); setCustom(null); }} />}
  </div>;
}

export function ProfileModal({ profile, onSave, onClose }) {
  const [name, setName] = useState(profile.name);
  const [income, setIncome] = useState(String(profile.monthlyIncome ?? 0));
  const [error, setError] = useState('');
  return <Modal title="Chỉnh sửa hồ sơ" onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Hủy</button><button className="btn btn-primary" onClick={() => { const n = Number(income); if (!name.trim() || !Number.isSafeInteger(n) || n < 0) return setError('Vui lòng kiểm tra lại thông tin.'); onSave({ name: name.trim(), monthlyIncome: n }); }}>Lưu</button></>}><div className="form-stack"><label className="field"><span>Tên hiển thị</span><input value={name} onChange={(e) => setName(e.target.value)} /></label><label className="field"><span>Thu nhập dự kiến/tháng (VND)</span><input inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^0-9]/g, ''))} /></label>{error && <div className="inline-error">{error}</div>}</div></Modal>;
}

