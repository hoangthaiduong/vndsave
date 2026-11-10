import { useEffect } from 'react';
import {
  AlertTriangle, ArrowRight, CircleAlert, CheckCircle2, FolderOpen, Plus, X, TrendingUp, TrendingDown,
  Utensils, BookOpen, Clapperboard, ShoppingBag, CarFront, Receipt, HeartPulse,
  WalletCards, House, Plane, Gift, BriefcaseBusiness, CircleHelp,
} from 'lucide-react';
import { formatVND } from '../lib/finance.js';

const CATEGORY_ICON_MAP = {
  utensils: Utensils, 'book-open': BookOpen, clapperboard: Clapperboard,
  'shopping-bag': ShoppingBag, 'car-front': CarFront, receipt: Receipt,
  'heart-pulse': HeartPulse, wallet: WalletCards, home: House, plane: Plane,
  gift: Gift, 'briefcase-business': BriefcaseBusiness, 'paw-print': CircleHelp,
  'more-horizontal': MoreHorizontal,
};
export function CategoryIcon({ name = 'wallet', size = 18 }) {
  const Icon = CATEGORY_ICON_MAP[name] || WalletCards;
  return <Icon size={size} strokeWidth={1.9} />;
}
export function EmptyState({ icon: Icon = FolderOpen, title, description, action, actionLabel }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={25} /></div><h3>{title}</h3><p>{description}</p>{action && <button className="btn btn-primary" onClick={action}><Plus size={17} />{actionLabel || 'Thêm mới'}</button>}</div>;
}
export function Modal({ title, subtitle, onClose, children, wide = false, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
      <div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={19} /></button></div>
      <div className="modal-content">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </section>
  </div>;
}
export function Toast({ toast, onClose }) {
  if (!toast) return null;
  const Icon = toast.type === 'error' ? CircleAlert : toast.type === 'warning' ? AlertTriangle : CheckCircle2;
  return <div className={`toast toast-${toast.type || 'success'}`}><Icon size={18} /><span>{toast.message}</span><button onClick={onClose}><X size={16} /></button></div>;
}
export function MetricCard({ icon: Icon, label, value, note, tone = 'blue', trend }) {
  return <article className="metric-card"><div className="metric-top"><div className={`metric-icon ${tone}`}><Icon size={20} /></div>{trend !== undefined && trend !== null && <span className={`trend ${trend >= 0 ? 'up' : 'down'}`}>{trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(trend).toFixed(1)}%</span>}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>;
}
export function SectionHeading({ title, description, action, actionLabel, actionIcon: ActionIcon = ArrowRight }) {
  return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action && <button className="text-action" onClick={action}>{actionLabel || 'Xem tất cả'} <ActionIcon size={16} /></button>}</div>;
}
export function ProgressBar({ value, color = '#2563eb' }) {
  return <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: color }} /></div>;
}
export function Amount({ value, type }) { return <span className={`amount ${type}`}>{type === 'income' ? '+' : '−'}{formatVND(value)}</span>; }

