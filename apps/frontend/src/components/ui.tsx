import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'

export const inputClass =
  'h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

export const textareaClass =
  'w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

export const selectClass =
  'h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-surface-dark dark:text-cream'

export const cardClass =
  'rounded-2xl border border-line bg-surface p-5 shadow-sm dark:border-line-dark dark:bg-surface-dark'

export const listCardClass =
  'rounded-2xl border border-line bg-surface p-4 shadow-sm dark:border-line-dark dark:bg-surface-dark'

export const primaryButtonClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90'

export const secondaryButtonClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line px-4 text-sm font-semibold text-graphite transition hover:text-ink active:scale-[0.98] disabled:opacity-50 dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'

export const smallButtonClass =
  'inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-semibold text-graphite transition hover:border-yellow hover:text-ink disabled:opacity-50 dark:border-line-dark dark:text-graphite-dark dark:hover:border-yellow/60 dark:hover:text-cream'

export const iconButtonClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-graphite transition hover:border-yellow hover:text-ink disabled:opacity-50 dark:border-line-dark dark:text-graphite-dark dark:hover:border-yellow/60 dark:hover:text-cream'

export const dangerIconButtonClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-graphite transition hover:border-rust hover:text-rust disabled:opacity-50 dark:border-line-dark dark:text-graphite-dark dark:hover:border-rust-dark dark:hover:text-rust-dark'

export const searchInputClass =
  'h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-sm text-ink shadow-sm outline-none transition focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-surface-dark dark:text-cream'

export const statusClass =
  'rounded-xl border border-yellow/40 bg-yellow/10 px-3 py-2 text-sm text-ink dark:text-cream'

export const labelClass = 'block text-xs font-medium text-graphite dark:text-graphite-dark'

export const sectionLabelClass =
  'text-xs font-semibold uppercase tracking-wider text-graphite dark:text-graphite-dark'

export const chipClass = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold'
export const chipDoneClass = `${chipClass} bg-yellow/20 text-ink dark:text-cream`
export const chipPendingClass = `${chipClass} border border-line text-graphite dark:border-line-dark dark:text-graphite-dark`

export const filterClass =
  'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition'
export const filterIdleClass =
  'border-line bg-surface text-graphite hover:text-ink dark:border-line-dark dark:bg-surface-dark dark:text-graphite-dark dark:hover:text-cream'
export const filterActiveClass = 'border-yellow bg-yellow text-ink'

export function PageHeader({
  backTo,
  backLabel,
  title,
  subtitle,
  aside,
  actions,
}: {
  backTo?: string
  backLabel?: string
  title: ReactNode
  subtitle?: ReactNode
  aside?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header>
      {(backTo || aside) && (
        <div className="flex min-h-9 items-center justify-between gap-3">
          {backTo ? (
            <Link
              to={backTo}
              className="inline-flex items-center gap-1.5 rounded-md text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          ) : (
            <span />
          )}
          {aside}
        </div>
      )}
      <div className={`flex flex-wrap items-end justify-between gap-3 ${backTo || aside ? 'mt-3' : ''}`}>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold text-ink dark:text-cream">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-graphite dark:text-graphite-dark">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

// Native <dialog> gives us Escape, focus trapping and an inert background for free.
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  size = 'md',
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  closeLabel: string
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const width = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] ${width} overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl dark:border-line-dark dark:bg-surface-dark dark:text-cream`}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 dark:border-line-dark">
            <h2 className="min-w-0 font-display text-xl font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label={closeLabel} className={iconButtonClass}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  )
}
