import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, Eye, FileText, RefreshCw, X } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'

type Kind = 'albaran' | 'factura'

type Summary = {
  number: string
  date: string
  conceptLines: string[]
  base: string
  iva: string
  total: string
}

type MonthlyDoc = {
  id: string
  kind: Kind
  period: string
  number: string
  filename: string
  nameMismatch: boolean
  at: string
}

type SelectedDoc = (MonthlyDoc & { summary: Summary | null }) | null

type ResourceOrder = {
  id: string
  orderNumber: string
  year: number
  documents: MonthlyDoc[]
  albaran: SelectedDoc
  factura: SelectedDoc
}

type ClientResources = {
  id: string
  name: string
  resources: { id: string; name: string; order: ResourceOrder | null }[]
}

type Draft = {
  number: string
  date: string
  conceptLines: string[]
  baseAmount: number
  amountSource: 'deliveryDate' | 'description' | 'unitPrice' | 'previous'
  title: string
}

type Editing = { resourceName: string; order: ResourceOrder; kind: Kind; draft: Draft; step: 'edit' | 'review' }

const IVA = 0.21
const WAIT_HOURS = 48
const CLIENT_KEY = 'generacion.clientId'

const primaryButtonClass =
  'flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90'

const secondaryButtonClass =
  'flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-graphite transition hover:text-ink active:scale-[0.98] disabled:opacity-50 dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'

const inputClass =
  'mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

const labelClass = 'block text-xs text-graphite dark:text-graphite-dark'
const mutedClass = 'text-xs text-graphite dark:text-graphite-dark'

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function readStoredClient() {
  try {
    return localStorage.getItem(CLIENT_KEY)
  } catch {
    return null
  }
}

function storeClient(id: string) {
  try {
    localStorage.setItem(CLIENT_KEY, id)
  } catch {
    return
  }
}

export function RecurringAlbaranesPage() {
  const { t, language } = useLanguage()
  const r = t.recurringAlbaranes
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(currentPeriod())
  const [clientId, setClientId] = useState<string | null>(readStoredClient())
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const monthLabel = new Date(`${period}-01T12:00:00`).toLocaleDateString(locale, { month: 'long' })
  const year = period.slice(0, 4)
  const money = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const apiError = (err: any) => err?.response?.data?.error ?? r.error

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['recurring-albaranes', period],
    queryFn: async () => (await api.get<ClientResources[]>('/recurring-albaranes', { params: { period } })).data,
  })

  const client = clients.find((c) => c.id === clientId) ?? clients[0]

  async function openBlob(request: Promise<{ data: Blob }>) {
    setError(null)
    try {
      const { data } = await request
      window.open(URL.createObjectURL(data), '_blank')
    } catch (err: any) {
      const blob = err?.response?.data
      const message = blob instanceof Blob ? JSON.parse(await blob.text()).error : undefined
      setError(message ?? r.error)
    }
  }

  const syncMutation = useMutation({
    mutationFn: async () => {
      const orderIds = client?.resources.flatMap((res) => (res.order ? [res.order.id] : [])) ?? []
      await Promise.all(orderIds.map((id) => api.post(`/recurring-albaranes/${id}/sync`)))
    },
    onMutate: () => setError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-albaranes'] }),
    onError: (err) => setError(apiError(err)),
  })

  const openMutation = useMutation({
    mutationFn: async ({ order, kind, resourceName }: { order: ResourceOrder; kind: Kind; resourceName: string }) => {
      const { data } = await api.get<Draft>(`/recurring-albaranes/${order.id}/draft`, { params: { period, kind } })
      return { order, kind, resourceName, draft: data, step: 'edit' as const }
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
      await openBlob(
        api.post(`/recurring-albaranes/${order.id}/preview`, { ...draft, kind, period }, { responseType: 'blob' }),
      )
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { order, kind, draft } = editing!
      return (await api.post<{ filename: string }>(`/recurring-albaranes/${order.id}/generate`, { ...draft, kind, period }))
        .data
    },
    onMutate: () => setError(null),
    onSuccess: (data) => {
      setSaved(data.filename)
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['recurring-albaranes'] })
    },
    onError: (err) => setError(apiError(err)),
  })

  function create(order: ResourceOrder, kind: Kind, resourceName: string) {
    const existing = order[kind]?.summary
    if (existing && !confirm(r.alreadyExists.replace('{doc}', r[kind]).replace('{number}', existing.number).replace('{month}', monthLabel))) {
      return
    }
    openMutation.mutate({ order, kind, resourceName })
  }

  function warningsFor({ order, kind }: Editing) {
    const warnings: string[] = []
    const existing = order[kind]?.summary
    if (existing) {
      warnings.push(r.alreadyExists.replace('{doc}', r[kind]).replace('{number}', existing.number).replace('{month}', monthLabel))
    }
    if (kind === 'factura') {
      const albaran = order.albaran
      if (!albaran?.summary) {
        warnings.push(r.noAlbaranYet.replace('{month}', monthLabel))
      } else {
        const hours = Math.floor((Date.now() - new Date(albaran.at).getTime()) / 3_600_000)
        if (hours < WAIT_HOURS) {
          warnings.push(
            r.tooSoon
              .replace('{number}', albaran.summary.number)
              .replace('{month}', monthLabel)
              .replace('{hours}', String(hours))
              .replace('{wait}', String(WAIT_HOURS)),
          )
        }
      }
    }
    return warnings
  }

  function updateDraft(patch: Partial<Draft>) {
    setEditing((e) => e && { ...e, draft: { ...e.draft, ...patch } })
  }

  const draft = editing?.draft
  const iva = draft ? Math.round(draft.baseAmount * IVA * 100) / 100 : 0

  function DocColumn({ order, kind, resourceName }: { order: ResourceOrder; kind: Kind; resourceName: string }) {
    const doc = order[kind]
    const last = order.documents.filter((d) => d.kind === kind).at(-1)
    const loading = openMutation.isPending && openMutation.variables?.order.id === order.id && openMutation.variables.kind === kind

    return (
      <div className="flex flex-col gap-2 rounded-xl border border-line p-3 dark:border-line-dark">
        <p className="text-xs font-semibold text-ink dark:text-cream">{r[kind]}</p>

        {doc?.summary ? (
          <div className="space-y-0.5 text-xs text-ink dark:text-cream">
            <p className="flex items-center gap-1 font-semibold">
              <Check className="h-3.5 w-3.5" />
              {r.doneThisMonth.replace('{number}', doc.summary.number)}
            </p>
            {doc.nameMismatch && <p className="text-rust dark:text-rust-dark">{r.nameMismatch}</p>}
            <p className={mutedClass}>{doc.summary.date}</p>
            {doc.summary.conceptLines.map((line) => (
              <p key={line} className="truncate">
                {line}
              </p>
            ))}
            <p className={mutedClass}>
              {doc.summary.base} + IVA {doc.summary.iva} = <span className="font-semibold text-ink dark:text-cream">{doc.summary.total}</span>
            </p>
          </div>
        ) : (
          <p className={`truncate ${mutedClass}`}>
            {r.last}: {last ? last.filename : r.never}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          {doc?.summary && (
            <button
              type="button"
              onClick={() => openBlob(api.get(`/recurring-albaranes/documents/${doc.id}/pdf`, { responseType: 'blob' }))}
              className={secondaryButtonClass}
            >
              <Eye className="h-4 w-4" />
              {r.viewPdf}
            </button>
          )}
          <button
            type="button"
            onClick={() => create(order, kind, resourceName)}
            disabled={loading}
            className={doc?.summary ? secondaryButtonClass : primaryButtonClass}
          >
            <FileText className="h-4 w-4" />
            {loading ? r.loading : doc?.summary ? r.createAnother : r.create.replace('{month}', monthLabel)}
          </button>
        </div>
      </div>
    )
  }

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

      {!isLoading && clients.length === 0 && (
        <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">
          {r.noClients}{' '}
          <Link to="/clients" className="font-semibold text-ink underline dark:text-cream">
            {r.goToClients}
          </Link>
        </p>
      )}

      {client && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {clients.length === 1 ? (
            <p className="text-sm font-semibold text-ink dark:text-cream">{client.name}</p>
          ) : (
            <select
              value={client.id}
              onChange={(e) => {
                setClientId(e.target.value)
                storeClient(e.target.value)
              }}
              className="h-9 rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-yellow dark:border-line-dark dark:bg-paper-dark dark:text-cream"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className={secondaryButtonClass}>
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? r.syncing : r.sync}
          </button>
        </div>
      )}

      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-cream">
          <Check className="h-4 w-4" />
          {r.saved.replace('{number}', saved)}
        </p>
      )}
      {error && !editing && <p className="mt-3 text-sm text-rust dark:text-rust-dark">{error}</p>}

      <div className="mt-4 space-y-2">
        {client?.resources.map((resource) => (
          <div
            key={resource.id}
            className="rounded-2xl border border-line bg-surface p-4 shadow-sm dark:border-line-dark dark:bg-surface-dark"
          >
            <p className="truncate text-sm font-semibold text-ink dark:text-cream">{resource.name}</p>

            {resource.order ? (
              <>
                <p className={mutedClass}>
                  {r.order} {resource.order.orderNumber}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <DocColumn order={resource.order} kind="albaran" resourceName={resource.name} />
                  <DocColumn order={resource.order} kind="factura" resourceName={resource.name} />
                </div>
              </>
            ) : (
              <p className={`mt-1 ${mutedClass}`}>
                {r.noOrder.replace('{year}', year)}{' '}
                <Link to="/papeleo/pedidos" className="font-semibold text-ink underline dark:text-cream">
                  {r.goToOrders}
                </Link>
              </p>
            )}
          </div>
        ))}
      </div>

      {editing &&
        draft &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setEditing(null)}>
            <form
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl dark:bg-surface-dark"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault()
                if (editing.step === 'edit') setEditing({ ...editing, step: 'review' })
                else generateMutation.mutate()
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink dark:text-cream">
                  {r[editing.kind]} · {editing.resourceName} · {monthLabel}
                </p>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {editing.step === 'edit' ? (
                <>
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
                      <input
                        type="date"
                        required
                        value={draft.date}
                        onChange={(e) => updateDraft({ date: e.target.value })}
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <div className="mt-3 space-y-3">
                    {draft.conceptLines.map((line, i) => (
                      <label key={i} className={labelClass}>
                        {r.concept} {i + 1}
                        <input
                          value={line}
                          onChange={(e) =>
                            updateDraft({ conceptLines: draft.conceptLines.map((l, j) => (j === i ? e.target.value : l)) })
                          }
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
                    <p className={mutedClass}>
                      {r.amountSource[draft.amountSource].replace('{month}', monthLabel)} · IVA 21 %: {money(iva)} · {r.total}:{' '}
                      <span className="font-semibold text-ink dark:text-cream">{money(draft.baseAmount + iva)}</span>
                    </p>

                    <label className={labelClass}>
                      {r.filename}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-graphite dark:text-graphite-dark">{draft.number}</span>
                        <input
                          required
                          value={draft.title}
                          onChange={(e) => updateDraft({ title: e.target.value })}
                          className={`${inputClass} mt-0`}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button type="submit" className={primaryButtonClass}>
                      {r.review}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    <dt className={mutedClass}>{r.number}</dt>
                    <dd className="font-semibold text-ink dark:text-cream">{draft.number}</dd>
                    <dt className={mutedClass}>{r.date}</dt>
                    <dd className="text-ink dark:text-cream">
                      {new Date(`${draft.date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </dd>
                    {draft.conceptLines.map((line, i) => (
                      <div key={i} className="contents">
                        <dt className={mutedClass}>
                          {r.concept} {i + 1}
                        </dt>
                        <dd className="text-ink dark:text-cream">{line}</dd>
                      </div>
                    ))}
                    <dt className={mutedClass}>{r.baseAmountShort}</dt>
                    <dd className="text-ink dark:text-cream">{money(draft.baseAmount)}</dd>
                    <dt className={mutedClass}>IVA 21 %</dt>
                    <dd className="text-ink dark:text-cream">{money(iva)}</dd>
                    <dt className={mutedClass}>{r.total}</dt>
                    <dd className="font-semibold text-ink dark:text-cream">{money(draft.baseAmount + iva)}</dd>
                    <dt className={mutedClass}>{r.filename}</dt>
                    <dd className="break-all text-ink dark:text-cream">
                      {draft.number} {draft.title}
                    </dd>
                  </dl>
                  <p className={`mt-2 ${mutedClass}`}>{r.amountSource[draft.amountSource].replace('{month}', monthLabel)}</p>

                  {warningsFor(editing).map((w) => (
                    <p
                      key={w}
                      className="mt-3 flex items-start gap-2 rounded-xl bg-yellow/10 p-3 text-sm text-ink dark:text-cream"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {w}
                    </p>
                  ))}

                  {error && <p className="mt-3 text-sm text-rust dark:text-rust-dark">{error}</p>}

                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, step: 'edit' })}
                      className={secondaryButtonClass}
                    >
                      {r.backToEdit}
                    </button>
                    <button
                      type="button"
                      onClick={() => previewMutation.mutate()}
                      disabled={previewMutation.isPending}
                      className={secondaryButtonClass}
                    >
                      <Eye className="h-4 w-4" />
                      {previewMutation.isPending ? r.previewing : r.preview}
                    </button>
                    <button type="submit" disabled={generateMutation.isPending} className={primaryButtonClass}>
                      {generateMutation.isPending ? r.generating : r.generate}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>,
          document.body,
        )}
    </div>
  )
}
