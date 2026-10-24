import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronRight, Info, Loader2, RefreshCw, X } from 'lucide-react';
import { acquireOverlay } from '../../../utils/overlayStack';

/**
 * Admin Workspace V2 design system.
 * One vocabulary for every admin area: page header, panels, stats, status pills,
 * tabs, empty/error/loading states, buttons and confirmation dialogs.
 * Presentation only: no component here talks to the API.
 */

export type AdminTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'accent';

const toneText: Record<AdminTone, string> = {
  neutral: 'text-slate-300', success: 'text-emerald-300', info: 'text-sky-300',
  warning: 'text-amber-300', danger: 'text-rose-300', accent: 'text-[#00c365]',
};
const tonePill: Record<AdminTone, string> = {
  neutral: 'bg-slate-800/80 text-slate-300 border-slate-700',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  info: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  danger: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  accent: 'bg-[#00c365]/10 text-[#00c365] border-[#00c365]/30',
};
const toneDot: Record<AdminTone, string> = {
  neutral: 'bg-slate-500', success: 'bg-emerald-400', info: 'bg-sky-400', warning: 'bg-amber-400', danger: 'bg-rose-400', accent: 'bg-[#00c365]',
};
const toneBorder: Record<AdminTone, string> = {
  neutral: 'border-slate-800', success: 'border-emerald-500/25', info: 'border-sky-500/25',
  warning: 'border-amber-500/35', danger: 'border-rose-500/35', accent: 'border-[#00c365]/30',
};

export const adminField = 'mh-field text-sm placeholder:text-slate-500 focus:border-[#00c365] focus:outline-none';
export const adminLabel = 'block space-y-1.5 text-sm text-slate-300';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
const buttonBase = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45';
const buttonVariant: Record<ButtonVariant, string> = {
  primary: 'bg-[#00c365] text-black hover:bg-[#00e575]',
  secondary: 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500',
  danger: 'border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
  ghost: 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
};
export function adminButton(variant: ButtonVariant = 'secondary', extra = '') {
  return `${buttonBase} ${buttonVariant[variant]} ${extra}`.trim();
}
export function AdminButton({ variant = 'secondary', className = '', busy = false, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }) {
  return (
    <button type="button" {...props} disabled={props.disabled || busy} className={adminButton(variant, className)}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function AdminPageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00c365]">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function AdminPanel({ title, description, actions, children, tone = 'neutral', className = '', id }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; tone?: AdminTone; className?: string; id?: string }) {
  return (
    <section id={id} className={`min-w-0 rounded-2xl border bg-[#0d151b] ${toneBorder[tone]} ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-white">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-400">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

/** A metric. Pass onClick only when the metric opens the place where the operator acts on it. */
export function AdminStat({ label, value, hint, tone = 'neutral', onClick, actionLabel, icon,compact=false }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: AdminTone; onClick?: () => void; actionLabel?: string; icon?: React.ReactNode;compact?:boolean }) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-sm text-slate-400">
        <span>{label}</span>
        {icon}
      </span>
      <span className={`block text-2xl font-bold tabular-nums tracking-tight ${tone === 'neutral' ? 'text-white' : toneText[tone]}`}>{value}</span>
      {hint && <span className={`${compact?'sr-only sm:not-sr-only sm:block':'block'} text-xs leading-relaxed text-slate-500`}>{hint}</span>}
      {onClick && <span className={`${compact?'hidden sm:inline-flex':'inline-flex'} items-center gap-1 pt-1 text-xs font-semibold text-[#00c365]`}>{actionLabel || 'Open'}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></span>}
    </>
  );
  const cls = `min-w-0 space-y-1.5 rounded-2xl border bg-[#0d151b] p-4 text-left ${toneBorder[tone]}`;
  return onClick ? <button type="button" onClick={onClick} className={`${cls} transition-colors hover:border-slate-600 focus-visible:border-[#00c365]`}>{body}</button> : <div className={cls}>{body}</div>;
}

export function StatusPill({ tone = 'neutral', children, dot = true, title }: { tone?: AdminTone; children: React.ReactNode; dot?: boolean; title?: string }) {
  return (
    <span title={title} className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tonePill[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]}`} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export interface AdminTabItem<T extends string> { id: T; label: string; count?: number | null; tone?: AdminTone }
export function AdminTabs<T extends string>({ tabs, value, onChange, label }: { tabs: AdminTabItem<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {tabs.map(tab => {
        const active = tab.id === value;
        return (
          <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(tab.id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${active ? 'border-[#00c365]/50 bg-[#00c365]/12 text-white' : 'border-slate-800 bg-[#0d151b] text-slate-400 hover:text-white'}`}>
            {tab.label}
            {tab.count != null && tab.count > 0 && <span className={`rounded-full px-1.5 text-xs tabular-nums ${tab.tone === 'warning' ? 'bg-amber-400/20 text-amber-200' : tab.tone === 'danger' ? 'bg-rose-400/20 text-rose-200' : 'bg-slate-700 text-slate-200'}`}>{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function AdminLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-[#0d151b] p-8 text-sm text-slate-400">
      <RefreshCw className="h-5 w-5 animate-spin text-[#00c365]" aria-hidden />
      {label}
    </div>
  );
}

export function AdminError({ title = 'Could not load this information', message, onRetry }: { title?: string; message?: string | null; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-rose-200">{title}</p>
          {message && <p className="break-words text-sm text-slate-400">{message}</p>}
        </div>
      </div>
      {onRetry && <AdminButton onClick={onRetry}>Try again</AdminButton>}
    </div>
  );
}

export function AdminEmpty({ title, children, action, icon }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-800 px-6 py-10 text-center">
      {icon || <CheckCircle2 className="h-7 w-7 text-slate-600" aria-hidden />}
      <p className="text-sm font-semibold text-white">{title}</p>
      {children && <div className="max-w-md text-sm text-slate-400">{children}</div>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function AdminNotice({ tone = 'info', title, children, action }: { tone?: AdminTone; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  const Icon = tone === 'warning' || tone === 'danger' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between ${toneBorder[tone]} ${tone === 'neutral' ? 'bg-slate-900/40' : tonePill[tone].split(' ')[0]}`}>
      <div className="flex min-w-0 gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${toneText[tone]}`} aria-hidden />
        <div className="min-w-0 space-y-1 text-sm">
          {title && <p className={`font-semibold ${toneText[tone]}`}>{title}</p>}
          {children && <div className="leading-relaxed text-slate-300">{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Relative "Updated …" label. Re-renders every 30 seconds so the age stays honest. */
export function Freshness({ at, prefix = 'Updated' }: { at: number | string | null | undefined; prefix?: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 30_000); return () => clearInterval(timer); }, []);
  if (!at) return null;
  const time = typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(time)) return null;
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  const label = seconds < 45 ? 'just now' : seconds < 3600 ? `${Math.round(seconds / 60)} min ago` : seconds < 86400 ? `${Math.round(seconds / 3600)} h ago` : new Date(time).toLocaleString();
  return <span className="text-xs text-slate-500" title={new Date(time).toLocaleString()}>{prefix} {label}</span>;
}

export function RefreshButton({ onClick, busy, label = 'Refresh' }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <AdminButton onClick={onClick} disabled={busy} aria-label={label}>
      <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin text-[#00c365]' : ''}`} aria-hidden />
      <span className="hidden sm:inline">{busy ? 'Refreshing…' : label}</span>
    </AdminButton>
  );
}

export function DefinitionList({ items }: { items: Array<[React.ReactNode, React.ReactNode]> }) {
  return (
    <dl className="divide-y divide-slate-800/80 text-sm">
      {items.map(([term, value], index) => (
        <div key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
          <dt className="text-slate-400">{term}</dt>
          <dd className="min-w-0 break-words text-right font-medium text-slate-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Bottom sheet on phones, centred dialog on larger screens. Native <dialog> keeps focus
 * trapping, Escape and backdrop behaviour consistent with the existing admin dialogs.
 */
export function AdminSheet({ title, subtitle, onClose, busy = false, children, footer, wide = false }: { title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; busy?: boolean; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Native showModal() already makes the rest inert; the shared stack only holds the page still.
    const release = acquireOverlay(dialog, { modal: false });
    return () => { release(); if (dialog?.open) dialog.close(); };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId}
      onCancel={event => {
        // React propagates a nested dialog's cancel event to its parent sheet.
        // Escape must close only the dialog that actually received it.
        if (event.target !== event.currentTarget) return;
        event.preventDefault(); if (!busy) onClose();
      }}
      onClick={event => { if (event.target === ref.current && !busy) onClose(); }}
      className={`m-0 mt-auto max-h-[94dvh] w-full max-w-none overflow-hidden rounded-t-3xl border border-slate-700 bg-[#0b1217] p-0 text-slate-100 backdrop:bg-black/75 sm:m-auto sm:max-h-[90dvh] sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}>
      <div className="flex max-h-[94dvh] flex-col sm:max-h-[90dvh]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-lg font-semibold text-white">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-slate-400">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="-mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
        {footer && <div className="border-t border-slate-800 bg-[#0b1217] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</div>}
      </div>
    </dialog>
  );
}

export interface ConfirmField { key: string; label: string; placeholder?: string; multiline?: boolean; minLength?: number; maxLength?: number; required?: boolean; help?: string }
/**
 * Replaces window.prompt/window.confirm for audited actions. Collects named text values,
 * an optional typed confirmation word and an explicit acknowledgement before calling onConfirm.
 */
export function ConfirmAction({ title, summary, warning, fields = [], typedWord, acknowledgement, confirmLabel, tone = 'primary', busy, error, onConfirm, onClose }: {
  title: string; summary?: React.ReactNode; warning?: React.ReactNode; fields?: ConfirmField[]; typedWord?: string; acknowledgement?: string;
  confirmLabel: string; tone?: 'primary' | 'danger'; busy?: boolean; error?: string | null;
  onConfirm: (values: Record<string, string>) => void; onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(field => [field.key, ''])));
  const [typed, setTyped] = useState('');
  const [acknowledged, setAcknowledged] = useState(!acknowledgement);
  const fieldsValid = fields.every(field => { const v = (values[field.key] || '').trim(); return field.required === false ? true : v.length >= (field.minLength ?? 1); });
  const ready = fieldsValid && (!typedWord || typed.trim() === typedWord) && acknowledged && !busy;
  return (
    <AdminSheet title={title} onClose={onClose} busy={busy}
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><AdminButton onClick={onClose} disabled={busy}>Cancel</AdminButton><AdminButton variant={tone} busy={busy} disabled={!ready} onClick={() => onConfirm(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])))}>{confirmLabel}</AdminButton></div>}>
      <div className="space-y-4">
        {summary && <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-200">{summary}</div>}
        {warning && <AdminNotice tone="warning">{warning}</AdminNotice>}
        {fields.map(field => (
          <label key={field.key} className={adminLabel}>
            <span>{field.label}{field.required === false && <span className="text-slate-500"> (optional)</span>}</span>
            {field.multiline
              ? <textarea className={`${adminField} min-h-24`} value={values[field.key]} maxLength={field.maxLength} placeholder={field.placeholder} disabled={busy} onChange={e => setValues({ ...values, [field.key]: e.target.value })} />
              : <input className={adminField} value={values[field.key]} maxLength={field.maxLength} placeholder={field.placeholder} disabled={busy} onChange={e => setValues({ ...values, [field.key]: e.target.value })} />}
            {field.help && <span className="block text-xs text-slate-500">{field.help}</span>}
          </label>
        ))}
        {typedWord && (
          <label className={adminLabel}>
            <span>Type <strong className="font-mono text-white">{typedWord}</strong> to confirm</span>
            <input className={`${adminField} font-mono`} value={typed} autoCapitalize="characters" autoComplete="off" disabled={busy} onChange={e => setTyped(e.target.value)} />
          </label>
        )}
        {acknowledgement && (
          <label className="flex min-h-11 items-start gap-3 text-sm text-slate-300">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#00c365]" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} />
            <span>{acknowledgement}</span>
          </label>
        )}
        {error && <p role="alert" className="break-words text-sm text-rose-300">{error}</p>}
      </div>
    </AdminSheet>
  );
}

export function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{children}</h2>
      {action}
    </div>
  );
}

export function RowLink({ children, onClick, meta }: { children: React.ReactNode; onClick: () => void; meta?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/60">
      <span className="min-w-0 flex-1">{children}</span>
      {meta}
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
    </button>
  );
}

export const ghs = (minor: number | null | undefined) => minor == null || !Number.isFinite(minor) ? '—' : `GH₵${(minor / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const ghsMajor = (major: number | null | undefined) => major == null || !Number.isFinite(major) ? '—' : `GH₵${major.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
