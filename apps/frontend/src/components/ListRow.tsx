import type { CSSProperties, ReactNode } from 'react'

// One layout for every list in Papeleo (orders and documents):
// desktop -> a single line; mobile -> heading on top, then a divider with status chips and actions.
export function ListRow({
  onOpen,
  openLabel,
  heading,
  aside,
  chips,
  actions,
  highlighted,
  style,
}: {
  onOpen: () => void
  openLabel: string
  heading: ReactNode
  aside?: ReactNode
  chips?: ReactNode
  actions: ReactNode
  highlighted?: boolean
  style?: CSSProperties
}) {
  return (
    <li
      style={style}
      className={`animate-fade-up relative cursor-pointer rounded-2xl border bg-surface px-4 py-3 shadow-sm transition hover:border-yellow dark:bg-surface-dark dark:hover:border-yellow/60 ${
        highlighted ? 'border-yellow/50 bg-yellow/[0.04] dark:border-yellow/30' : 'border-line dark:border-line-dark'
      }`}
    >
      <button type="button" onClick={onOpen} aria-label={openLabel} tabIndex={-1} className="absolute inset-0 rounded-2xl" />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex min-w-0 items-start justify-between gap-3 lg:flex-1 lg:items-center">
          <div className="min-w-0 flex-1">{heading}</div>
          {aside && <div className="shrink-0 lg:hidden">{aside}</div>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 lg:border-0 lg:pt-0 dark:border-line-dark">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 lg:flex-nowrap">{chips}</div>
          <div className="flex shrink-0 items-center gap-2">
            {aside && <div className="hidden lg:block">{aside}</div>}
            {actions}
          </div>
        </div>
      </div>
    </li>
  )
}
