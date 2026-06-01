import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Health, ChecklistStatus, ProjectStatus } from '../lib/types';
import { CHECKLIST_STATUS_LABELS, PROJECT_STATUS_LABELS, HEALTH_LABELS } from '../lib/labels';

// ───────────────────────── Card ─────────────────────────
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx('rounded-xl border border-border bg-card', className)}>{children}</div>
  );
}

// ───────────────────────── Button ─────────────────────────
type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}
export function Button({ variant = 'primary', size = 'md', className, ...rest }: BtnProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        size === 'sm' ? 'px-3 py-1.5 text-sm min-h-[36px]' : 'px-4 py-2 text-sm min-h-[44px]',
        variant === 'primary' && 'bg-primary text-white hover:bg-primary-600',
        variant === 'outline' && 'border border-border bg-card text-ink hover:bg-surface',
        variant === 'ghost' && 'text-ink hover:bg-surface',
        variant === 'danger' && 'bg-risk text-white hover:opacity-90',
        className,
      )}
      {...rest}
    />
  );
}

// ───────────────────────── Pill (status) ─────────────────────────
const HEALTH_CLS: Record<Health, string> = {
  ok: 'bg-ok/10 text-ok',
  warn: 'bg-warn/10 text-warn',
  risk: 'bg-risk/10 text-risk',
};

export function HealthPill({ health, withLabel = true }: { health: Health; withLabel?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', HEALTH_CLS[health])}>
      <span className="h-2 w-2 rounded-full" style={{ background: `var(--${health === 'ok' ? 'ok' : health === 'warn' ? 'warn' : 'risk'})` }} />
      {withLabel && HEALTH_LABELS[health]}
    </span>
  );
}

const CHECK_CLS: Record<ChecklistStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-primary/10 text-primary-600',
  ready: 'bg-viz/10 text-viz',
  in_review: 'bg-warn/10 text-warn',
  accepted: 'bg-ok/10 text-ok',
  overdue: 'bg-risk/10 text-risk',
};

export function ChecklistStatusPill({ status }: { status: ChecklistStatus }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap', CHECK_CLS[status])}>
      {CHECKLIST_STATUS_LABELS[status]}
    </span>
  );
}

const PROJ_CLS: Record<ProjectStatus, string> = {
  planned: 'bg-slate-100 text-slate-600',
  active: 'bg-primary/10 text-primary-600',
  on_hold: 'bg-warn/10 text-warn',
  done: 'bg-ok/10 text-ok',
  cancelled: 'bg-slate-200 text-slate-500',
};

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap', PROJ_CLS[status])}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

// ───────────────────────── Progress bar ─────────────────────────
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${v}%`, background: v >= 100 ? 'var(--ok)' : 'var(--primary)' }}
      />
    </div>
  );
}

// ───────────────────────── Inputs ─────────────────────────
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink outline-none transition-colors',
        'focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400',
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink outline-none transition-colors min-h-[40px]',
        'focus:border-primary focus:ring-2 focus:ring-primary/20',
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink outline-none transition-colors',
        'focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400',
        props.className,
      )}
    />
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={clsx('mb-1 block text-sm font-medium text-slate-600', className)}>{children}</label>;
}

// ───────────────────────── Misc ─────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary', className)} />
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      <p className="font-medium text-slate-500">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
    </div>
  );
}
