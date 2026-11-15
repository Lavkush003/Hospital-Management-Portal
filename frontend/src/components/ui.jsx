import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { cn, initials } from '../lib/utils';
import { STATUS_TONES } from '../lib/constants';

const buttonVariants = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  soft: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
};

const buttonSizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
};

export function Button({ variant = 'primary', size = 'md', className, loading, children, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:opacity-60',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800', className)}
      {...props}
    >
      {children}
    </button>
  );
}

const toneClasses = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  purple: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export function Badge({ children, tone = 'neutral', className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', toneClasses[tone] || toneClasses.neutral, className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] || 'neutral'}>{String(status || '').replace(/_/g, ' ')}</Badge>;
}

export function Avatar({ firstName, lastName, size = 'md', className }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 font-bold text-white', sizes[size], className)}>
      {initials(firstName, lastName)}
    </div>
  );
}

export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label} {required ? <span className="text-rose-500">*</span> : null}
        </span>
      ) : null}
      {children}
      {hint && !error ? <span className="block text-xs text-slate-400">{hint}</span> : null}
      {error ? <span className="block text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-500';

export function Input({ className, ...props }) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(inputClass, 'appearance-none', className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn(inputClass, 'resize-y', className)} {...props} />;
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8">
      <div className={cn('my-auto w-full rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200', sizes[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', description, loading, confirmLabel = 'Confirm' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle size={20} />
        </div>
        <p className="text-sm leading-6 text-slate-600">{description || 'This action cannot be undone.'}</p>
      </div>
    </Modal>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'teal' }) {
  const tones = {
    teal: 'bg-teal-50 text-teal-600',
    blue: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tones[tone])}>
            <Icon size={20} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Loader2 size={18} className="animate-spin text-teal-600" />
      {label}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', description, action, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      {Icon ? <Icon size={32} className="text-slate-300" /> : null}
      <h3 className="mt-3 text-sm font-semibold text-slate-700">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-lg px-3 py-2 text-sm font-semibold transition',
            active === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ meta, onPageChange }) {
  if (!meta) return null;
  const { page = 1, totalPages = 1, total = 0, limit = 10 } = meta;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={14} /> Prev
        </Button>
        <span className="px-2 text-xs font-semibold text-slate-600">Page {page} of {totalPages}</span>
        <Button size="sm" variant="secondary" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

export function Table({ children, className }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, className }) {
  return <th className={cn('whitespace-nowrap bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500', className)}>{children}</th>;
}

export function Td({ children, className }) {
  return <td className={cn('whitespace-nowrap px-4 py-3 text-slate-600', className)}>{children}</td>;
}

export function Tr({ children, onClick, className }) {
  return (
    <tr onClick={onClick} className={cn('border-t border-slate-100 transition hover:bg-slate-50/80', onClick && 'cursor-pointer', className)}>
      {children}
    </tr>
  );
}
