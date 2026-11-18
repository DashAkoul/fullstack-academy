import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`size-4 animate-spin ${className}`} aria-hidden />
}

export function Badge({
  children,
  tone = 'neutral'
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'accent'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-[var(--surface-2)] text-[var(--text-2)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]'
  }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.68rem] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Callout({
  tone = 'info',
  title,
  children,
  icon
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  title?: string
  children: ReactNode
  icon?: ReactNode
}) {
  const map = {
    info: 'bg-[var(--accent-soft)] border-[color-mix(in_srgb,var(--accent)_35%,transparent)] text-[var(--text-1)]',
    warning: 'bg-[var(--warning-soft)] border-[color-mix(in_srgb,var(--warning)_35%,transparent)]',
    danger: 'bg-[var(--danger-soft)] border-[color-mix(in_srgb,var(--danger)_35%,transparent)]',
    success: 'bg-[var(--success-soft)] border-[color-mix(in_srgb,var(--success)_35%,transparent)]'
  }
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-7 ${map[tone]}`}>
      {title && (
        <div className="mb-1 flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </div>
      )}
      <div className="text-[var(--text-2)]">{children}</div>
    </div>
  )
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)] ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 cursor-default" aria-label="بستن" onClick={onClose} tabIndex={-1} />
      <div
        className={`animate-in surface-card relative my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} p-0 shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onClose}>
            بستن (Esc)
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
