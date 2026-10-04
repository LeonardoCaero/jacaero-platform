import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, Info, X } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { Modal, primaryButtonClass, secondaryButtonClass } from './ui'

type Tone = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; tone: Tone }

type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

type Feedback = {
  toast: (message: string, tone?: Tone) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<Feedback | null>(null)

const TOAST_MS = 3500

const toneIcon = { success: Check, error: AlertTriangle, info: Info }
const toneIconClass = {
  success: 'bg-yellow text-ink',
  error: 'bg-rust text-cream dark:bg-rust-dark dark:text-ink',
  info: 'bg-ink/10 text-ink dark:bg-cream/15 dark:text-cream',
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (message: string, tone: Tone = 'success') => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { id, message, tone }])
      window.setTimeout(() => dismiss(id), TOAST_MS)
    },
    [dismiss],
  )

  const confirm = useCallback((options: ConfirmOptions) => {
    setPending(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function settle(ok: boolean) {
    resolver.current?.(ok)
    resolver.current = null
    setPending(null)
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <Modal open={!!pending} onClose={() => settle(false)} title={pending?.title ?? t.common.confirmTitle} closeLabel={t.common.close} size="sm">
        {pending && (
          <>
            <p className="text-sm text-ink dark:text-cream">{pending.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => settle(false)} className={secondaryButtonClass}>
                {t.common.cancel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={
                  pending.danger
                    ? 'inline-flex h-10 items-center justify-center rounded-xl bg-rust px-4 text-sm font-semibold text-cream transition hover:bg-rust/90 active:scale-[0.98] dark:bg-rust-dark dark:text-ink dark:hover:bg-rust-dark/90'
                    : primaryButtonClass
                }
              >
                {pending.confirmLabel ?? t.common.confirm}
              </button>
            </div>
          </>
        )}
      </Modal>

      {createPortal(
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        >
          {toasts.map((x) => {
            const Icon = toneIcon[x.tone]
            return (
              <div
                key={x.id}
                className="animate-fade-up pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface py-2.5 pl-2.5 pr-2 text-sm font-medium text-ink shadow-lg dark:border-line-dark dark:bg-surface-dark dark:text-cream"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toneIconClass[x.tone]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">{x.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(x.id)}
                  aria-label={t.common.close}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-graphite transition hover:bg-ink/5 hover:text-ink dark:text-graphite-dark dark:hover:bg-cream/10 dark:hover:text-cream"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider')
  return ctx
}
