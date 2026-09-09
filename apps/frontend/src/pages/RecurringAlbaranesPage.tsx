import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, Check } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'

type RecurringAlbaranTemplate = {
  id: string
  clientName: string
  orderNumber: string
  label: string
  lastPeriod: string | null
  lastNumber: string | null
}

const primaryButtonClass =
  'flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90'

const secondaryButtonClass =
  'flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-graphite transition hover:text-ink active:scale-[0.98] disabled:opacity-50 dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function RecurringAlbaranesPage() {
  const { t, language } = useLanguage()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(currentPeriod())
  const [savedByTemplate, setSavedByTemplate] = useState<Record<string, string>>({})

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['recurring-albaranes'],
    queryFn: async () => (await api.get<RecurringAlbaranTemplate[]>('/recurring-albaranes')).data,
  })

  const previewMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await api.get(`/recurring-albaranes/${templateId}/preview`, {
        params: { period },
        responseType: 'blob',
      })
      return data as Blob
    },
    onSuccess: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
  })

  const confirmMutation = useMutation({
    mutationFn: async (templateId: string) =>
      (await api.post<{ number: string; filename: string }>(`/recurring-albaranes/${templateId}/confirm`, { period }))
        .data,
    onSuccess: (data, templateId) => {
      setSavedByTemplate((prev) => ({ ...prev, [templateId]: data.number }))
      queryClient.invalidateQueries({ queryKey: ['recurring-albaranes'] })
    },
  })

  function formatPeriod(iso: string | null) {
    if (!iso) return t.recurringAlbaranes.never
    return new Date(iso).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          to="/papeleo"
          className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.recurringAlbaranes.back}
        </Link>

        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-9 rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-yellow dark:border-line-dark dark:bg-paper-dark dark:text-cream"
        />
      </div>

      <h1 className="mt-4 font-display text-2xl font-semibold tracking-wide text-ink dark:text-cream">
        {t.papeleo.generacion.label}
      </h1>

      <div className="mt-4 space-y-2">
        {!isLoading && templates.length === 0 && (
          <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">
            {t.recurringAlbaranes.empty}
          </p>
        )}

        {templates.map((tpl) => {
          const isPreviewing = previewMutation.isPending && previewMutation.variables === tpl.id
          const isConfirming = confirmMutation.isPending && confirmMutation.variables === tpl.id
          const savedNumber = savedByTemplate[tpl.id]

          return (
            <div
              key={tpl.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm dark:border-line-dark dark:bg-surface-dark"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink dark:text-cream">
                  {tpl.clientName} · {tpl.label}
                </p>
                <p className="text-xs text-graphite dark:text-graphite-dark">
                  {t.emailOrders.albaranNumber} {tpl.orderNumber} — {t.recurringAlbaranes.lastGenerated}:{' '}
                  {formatPeriod(tpl.lastPeriod)}
                  {tpl.lastNumber ? ` (${tpl.lastNumber})` : ''}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {savedNumber && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-ink dark:text-cream">
                    <Check className="h-3.5 w-3.5" />
                    {t.recurringAlbaranes.saved.replace('{number}', savedNumber)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => previewMutation.mutate(tpl.id)}
                  disabled={isPreviewing}
                  className={secondaryButtonClass}
                >
                  <Eye className="h-4 w-4" />
                  {isPreviewing ? t.recurringAlbaranes.previewing : t.recurringAlbaranes.preview}
                </button>
                <button
                  type="button"
                  onClick={() => confirmMutation.mutate(tpl.id)}
                  disabled={isConfirming}
                  className={primaryButtonClass}
                >
                  {isConfirming ? t.recurringAlbaranes.confirming : t.recurringAlbaranes.confirm}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {confirmMutation.isError && (
        <p className="mt-4 text-center text-sm text-rust dark:text-rust-dark">{t.recurringAlbaranes.error}</p>
      )}
    </div>
  )
}
