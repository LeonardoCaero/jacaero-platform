import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Eye, FileText, Plus, Trash2, X } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'

type Kind = 'albaran' | 'factura'

type LastDoc = { filename: string; period: string | null; at: string } | null

type RecurringOrder = {
  id: string
  clientName: string
  orderNumber: string
  label: string
  albaran: LastDoc
  factura: LastDoc
}

type Draft = {
  number: string
  date: string
  conceptLines: string[]
  baseAmount: number
  title: string
}

const IVA = 0.21
const WAIT_HOURS = 48

const primaryButtonClass =
  'flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90'

const secondaryButtonClass =
  'flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-graphite transition hover:text-ink active:scale-[0.98] disabled:opacity-50 dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'

const inputClass =
  'mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

const labelClass = 'block text-xs text-graphite dark:text-graphite-dark'

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const samePeriod = (iso: string | null, period: string) => !!iso && iso.slice(0, 7) === period

export function RecurringAlbaranesPage() {
  const { t, language } = useLanguage()
  const r = t.recurringAlbaranes
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(currentPeriod())
  const [editing, setEditing] = useState<{ order: RecurringOrder; kind: Kind; draft: Draft } | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newOrder, setNewOrder] = useState({ clientId: '', orderNumber: '', label: '' })

  const monthLabel = new Date(`${period}-01T12:00:00`).toLocaleDateString(locale, { month: 'long' })
  const money = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const apiError = (err: any) => err?.response?.data?.error ?? r.error

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['recurring-albaranes'],
    queryFn: async () => (await api.get<RecurringOrder[]>('/recurring-albaranes')).data,
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['recurring-albaranes', 'clients'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/recurring-albaranes/clients')).data,
  })

  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/recurring-albaranes', newOrder)).data,
    onMutate: () => setError(null),
    onSuccess: () => {
      setNewOrder({ clientId: '', orderNumber: '', label: '' })
      queryClient.invalidateQueries({ queryKey: ['recurring-albaranes'] })
    },
    onError: (err) => setError(apiError(err)),
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/recurring-albaranes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-albaranes'] }),
    onError: (err) => setError(apiError(err)),
  })

  const openMutation = useMutation({
    mutationFn: async ({ order, kind }: { order: RecurringOrder; kind: Kind }) => {
      const { data } = await api.get<Draft>(`/recurring-albaranes/${order.id}/draft`, { params: { period, kind } })
      return { order, kind, draft: data }
    },
    onMutate: () => {
      setError(null)
      setSaved(null)
    },
    onSuccess: setEditing,
    onError: (err) => setError(apiError(err)),
  })

  const previewMutation = useMutation({
    mutationFn: async () => {
      const { order, kind, draft } = editing!
      const { data } = await api.post(`/recurring-albaranes/${order.id}/preview`, { ...draft, kind, period }, { responseType: 'blob' })
      return data as Blob
    },
    onMutate: () => setError(null),
    onSuccess: (blob) => window.open(URL.createObjectURL(blob), '_blank'),
    onError: async (err: any) => {
      const blob = err?.response?.data
      const message = blob instanceof Blob ? JSON.parse(await blob.text()).error : undefined
      setError(message ?? r.error)
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { order, kind, draft } = editing!
      return (await api.post<{ filename: string }>(`/recurring-albaranes/${order.id}/generate`, { ...draft, kind, period })).data
    },
    onMutate: () => setError(null),
    onSuccess: (data) => {
      setSaved(data.filename)
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['recurring-albaranes'] })
    },
    onError: (err) => setError(apiError(err)),
  })

  function confirmInvoiceTiming(order: RecurringOrder) {
    const albaran = order.albaran
    if (!albaran || !samePeriod(albaran.period, period)) {
      return confirm(r.noAlbaranYet.replace('{month}', monthLabel))
    }
    const hours = Math.floor((Date.now() - new Date(albaran.at).getTime()) / 3_600_000)
    if (hours < WAIT_HOURS) {
      return confirm(
        r.tooSoon
          .replace('{number}', albaran.filename.split(' ')[0])
          .replace('{month}', monthLabel)
          .replace('{hours}', String(hours))
          .replace('{wait}', String(WAIT_HOURS)),
      )
    }
    return true
  }

  function handleGenerate() {
    if (editing!.kind === 'factura' && !confirmInvoiceTiming(editing!.order)) return
    generateMutation.mutate()
  }

  function updateDraft(patch: Partial<Draft>) {
    setEditing((e) => e && { ...e, draft: { ...e.draft, ...patch } })
  }

  function describe(doc: LastDoc) {
    if (!doc) return r.never
    const date = new Date(doc.at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    return `${doc.filename} · ${date}`
  }

  const draft = editing?.draft
  const iva = draft ? Math.round(draft.baseAmount * IVA * 100) / 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          to="/papeleo"
          className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" />
          {r.back}
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

      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-cream">
          <Check className="h-4 w-4" />
          {r.saved.replace('{number}', saved)}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {!isLoading && orders.length === 0 && (
          <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">{r.empty}</p>
        )}

        {orders.map((order) => (
          <div
            key={order.id}
            className="rounded-2xl border border-line bg-surface p-4 shadow-sm dark:border-line-dark dark:bg-surface-dark"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-ink dark:text-cream">
                {order.clientName} · {order.label}
              </p>
              <button
                type="button"
                title={r.remove}
                onClick={() => confirm(r.confirmRemove.replace('{order}', order.orderNumber)) && removeMutation.mutate(order.id)}
                className="text-graphite hover:text-rust dark:text-graphite-dark dark:hover:text-rust-dark"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-graphite dark:text-graphite-dark">
              {r.order} {order.orderNumber}
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(['albaran', 'factura'] as const).map((kind) => {
                const loading = openMutation.isPending && openMutation.variables?.order.id === order.id && openMutation.variables.kind === kind
                return (
                  <div key={kind} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 dark:border-line-dark">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink dark:text-cream">{r[kind]}</p>
                      <p className="truncate text-xs text-graphite dark:text-graphite-dark">
                        {r.last}: {describe(order[kind])}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openMutation.mutate({ order, kind })}
                      disabled={loading}
                      className={`${primaryButtonClass} shrink-0`}
                    >
                      <FileText className="h-4 w-4" />
                      {loading ? r.loading : r.create.replace('{month}', monthLabel)}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <form
        className="mt-6 rounded-2xl border border-dashed border-line p-4 dark:border-line-dark"
        onSubmit={(e) => {
          e.preventDefault()
          createMutation.mutate()
        }}
      >
        <p className="text-sm font-semibold text-ink dark:text-cream">{r.addTitle}</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            {r.client}
            <select
              required
              value={newOrder.clientId}
              onChange={(e) => setNewOrder({ ...newOrder, clientId: e.target.value })}
              className={inputClass}
            >
              <option value="" />
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {r.order}
            <input
              required
              value={newOrder.orderNumber}
              onChange={(e) => setNewOrder({ ...newOrder, orderNumber: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            {r.label}
            <input
              required
              value={newOrder.label}
              onChange={(e) => setNewOrder({ ...newOrder, label: e.target.value })}
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={createMutation.isPending} className={secondaryButtonClass}>
            <Plus className="h-4 w-4" />
            {r.add}
          </button>
        </div>
      </form>

      {error && !editing && <p className="mt-4 text-center text-sm text-rust dark:text-rust-dark">{error}</p>}

      {editing &&
        draft &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setEditing(null)}>
            <form
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl dark:bg-surface-dark"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault()
                handleGenerate()
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink dark:text-cream">
                  {r[editing.kind]} · {editing.order.label} · {monthLabel}
                </p>
                <button type="button" onClick={() => setEditing(null)} className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  {r.number}
                  <input
                    required
                    inputMode="numeric"
                    pattern="\d{1,4}"
                    value={draft.number}
                    onChange={(e) => updateDraft({ number: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {r.date}
                  <input type="date" required value={draft.date} onChange={(e) => updateDraft({ date: e.target.value })} className={inputClass} />
                </label>
              </div>

              <div className="mt-3 space-y-3">
                {draft.conceptLines.map((line, i) => (
                  <label key={i} className={labelClass}>
                    {r.concept} {i + 1}
                    <input
                      value={line}
                      onChange={(e) => updateDraft({ conceptLines: draft.conceptLines.map((l, j) => (j === i ? e.target.value : l)) })}
                      className={inputClass}
                    />
                  </label>
                ))}

                <label className={labelClass}>
                  {r.baseAmount}
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={draft.baseAmount}
                    onChange={(e) => updateDraft({ baseAmount: Number(e.target.value) })}
                    className={inputClass}
                  />
                </label>
                <p className="text-xs text-graphite dark:text-graphite-dark">
                  IVA 21 %: {money(iva)} · {r.total}: <span className="font-semibold text-ink dark:text-cream">{money(draft.baseAmount + iva)}</span>
                </p>

                <label className={labelClass}>
                  {r.filename}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-graphite dark:text-graphite-dark">{draft.number}</span>
                    <input required value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} className={`${inputClass} mt-0`} />
                  </div>
                </label>
              </div>

              {error && <p className="mt-3 text-sm text-rust dark:text-rust-dark">{error}</p>}

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending} className={secondaryButtonClass}>
                  <Eye className="h-4 w-4" />
                  {previewMutation.isPending ? r.previewing : r.preview}
                </button>
                <button type="submit" disabled={generateMutation.isPending} className={primaryButtonClass}>
                  {generateMutation.isPending ? r.generating : r.generate}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </div>
  )
}
