import { useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, FileDown, X, Check, Link2, Eye, Star, Search } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'
import { Skeleton } from '../components/Skeleton'

type DocCategory = 'presupuesto' | 'albaran' | 'factura' | 'pedidoMaterial' | 'horasTrabajo'

const QUOTE_CATEGORY_TO_DOC: Record<'PRESUPUESTO' | 'HORAS' | 'MATERIAL', DocCategory> = {
  PRESUPUESTO: 'presupuesto',
  HORAS: 'horasTrabajo',
  MATERIAL: 'pedidoMaterial',
}

function orderSearchText(order: EmailOrder): string {
  return [
    order.orderNumber,
    order.subject,
    order.senderEmail,
    order.contactName,
    order.contactEmail,
    order.contactPhone,
    order.deliveryAddress,
    order.notes,
    order.quoteRef,
    order.albaranNumber,
    order.facturaNumber,
    order.totalAmount,
    ...order.lines.map((l) => l.description),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

async function previewDocument(category: DocCategory, year: number, number: string) {
  const { data } = await api.get(`/documents/${category}/file`, { params: { year, number, ext: 'pdf' } , responseType: 'blob' })
  window.open(URL.createObjectURL(data), '_blank')
}

function PreviewButton({ onClick }: { onClick: (e: MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-md text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
    >
      <Eye className="h-3.5 w-3.5" />
    </button>
  )
}

type EmailOrderLine = {
  id: string
  lineNumber: string | null
  description: string
  quantity: string
  unit: string | null
  unitPrice: string
  amount: string
  deliveryDate: string | null
}

type EmailOrder = {
  id: string
  orderNumber: string | null
  quoteRef: string | null
  orderDate: string | null
  subject: string
  senderEmail: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  deliveryAddress: string | null
  notes: string | null
  totalAmount: string | null
  status: 'NEW' | 'REVIEWED' | 'IGNORED'
  quotedAt: string | null
  quoteCategory: 'PRESUPUESTO' | 'HORAS' | 'MATERIAL' | null
  deliveryNoteAt: string | null
  albaranNumber: string | null
  invoicedAt: string | null
  facturaNumber: string | null
  favorite: boolean
  receivedAt: string
  lines: EmailOrderLine[]
  client: { id: string; name: string } | null
}

const cardClass =
  'rounded-2xl border border-line bg-surface p-4 shadow-sm dark:border-line-dark dark:bg-surface-dark'

const primaryButtonClass =
  'flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90'

function OrderCardSkeleton({ delay }: { delay: number }) {
  return (
    <div className={`${cardClass} animate-fade-up`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <Skeleton className="h-4 w-14 shrink-0" />
      </div>
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}

const secondaryButtonClass =
  'flex h-10 items-center gap-1.5 rounded-xl border border-line px-4 text-sm font-semibold text-graphite transition hover:text-ink active:scale-[0.98] disabled:opacity-50 dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'

type MilestoneField = 'deliveryNoteAt' | 'invoicedAt'
const MILESTONES: { field: MilestoneField; labelKey: 'deliveryNote' | 'invoiced' }[] = [
  { field: 'deliveryNoteAt', labelKey: 'deliveryNote' },
  { field: 'invoicedAt', labelKey: 'invoiced' },
]

function MilestoneBadge({
  done,
  label,
  onToggle,
}: {
  done: boolean
  label: string
  onToggle: (e: MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
        done
          ? 'bg-yellow/20 text-ink dark:text-cream'
          : 'border border-line text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'
      }`}
    >
      {done && <Check className="h-3 w-3" />}
      {label}
    </button>
  )
}

type QuoteCategory = 'pending' | 'presupuesto' | 'horas' | 'material'
const QUOTE_CYCLE: Record<QuoteCategory, QuoteCategory> = {
  pending: 'presupuesto',
  presupuesto: 'horas',
  horas: 'material',
  material: 'pending',
}

function quoteCategoryOf(order: EmailOrder): QuoteCategory {
  if (order.quoteCategory === 'PRESUPUESTO') return 'presupuesto'
  if (order.quoteCategory === 'HORAS') return 'horas'
  if (order.quoteCategory === 'MATERIAL') return 'material'
  return 'pending'
}

function QuoteBadge({
  category,
  labels,
  onCycle,
}: {
  category: QuoteCategory
  labels: Record<QuoteCategory, string>
  onCycle: (e: MouseEvent) => void
}) {
  const style =
    category === 'pending'
      ? 'border border-line text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'
      : 'bg-yellow/20 text-ink dark:text-cream'
  return (
    <button
      type="button"
      onClick={onCycle}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${style}`}
    >
      {category !== 'pending' && <Check className="h-3 w-3" />}
      {labels[category]}
    </button>
  )
}

function FavoriteButton({ favorite, onToggle }: { favorite: boolean; onToggle: (e: MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition ${
        favorite
          ? 'text-yellow'
          : 'text-graphite/40 hover:text-graphite dark:text-graphite-dark/40 dark:hover:text-graphite-dark'
      }`}
    >
      <Star className="h-4 w-4" fill={favorite ? 'currentColor' : 'none'} />
    </button>
  )
}

export function EmailOrdersPage() {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['email-orders'],
    queryFn: async () => (await api.get<EmailOrder[]>('/email-orders')).data,
  })

  const query = search.trim().toLowerCase()
  const filteredOrders = query ? orders.filter((o) => orderSearchText(o).includes(query)) : orders

  const syncMutation = useMutation({
    mutationFn: async (full: boolean) =>
      (
        await api.post<{ created: number; skipped: number; failed: number }>('/email-orders/sync', null, {
          params: { full },
        })
      ).data,
    onSuccess: (data) => {
      let message = t.emailOrders.synced
        .replace('{created}', String(data.created))
        .replace('{skipped}', String(data.skipped))
      if (data.failed > 0) message += ` — ${data.failed} ${t.emailOrders.failed}`
      setSyncMessage(message)
      queryClient.invalidateQueries({ queryKey: ['email-orders'] })
    },
  })

  const reconcileMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ quoteLinked: number; albaranLinked: number; facturaLinked: number }>(
          '/email-orders/reconcile',
        )
      ).data,
    onSuccess: (data) => {
      setSyncMessage(
        t.emailOrders.reconciled
          .replace('{quote}', String(data.quoteLinked))
          .replace('{albaran}', String(data.albaranLinked))
          .replace('{factura}', String(data.facturaLinked)),
      )
      queryClient.invalidateQueries({ queryKey: ['email-orders'] })
    },
  })

  const milestoneMutation = useMutation({
    mutationFn: ({ id, field, done }: { id: string; field: MilestoneField; done: boolean }) =>
      api.patch(`/email-orders/${id}/milestone`, { field, done }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-orders'] }),
  })

  const quoteStatusMutation = useMutation({
    mutationFn: ({ id, category }: { id: string; category: QuoteCategory }) =>
      api.patch(`/email-orders/${id}/quote-status`, { category }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-orders'] }),
  })

  const favoriteMutation = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      api.patch(`/email-orders/${id}/favorite`, { favorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-orders'] }),
  })

  const selected = orders.find((o) => o.id === selectedId) ?? null

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(locale)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          to="/papeleo"
          className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.emailOrders.back}
        </Link>
      </div>

      <h1 className="mt-4 font-display text-2xl font-semibold tracking-wide text-ink dark:text-cream">
        {t.papeleo.pedidosCorreo.label}
      </h1>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setSyncMessage(null)
            syncMutation.mutate(false)
          }}
          disabled={syncMutation.isPending}
          className={primaryButtonClass}
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? t.emailOrders.syncing : t.emailOrders.sync}
        </button>
        <button
          type="button"
          onClick={() => {
            setSyncMessage(null)
            syncMutation.mutate(true)
          }}
          disabled={syncMutation.isPending}
          className={secondaryButtonClass}
        >
          {t.emailOrders.syncFull}
        </button>
        <button
          type="button"
          onClick={() => {
            setSyncMessage(null)
            reconcileMutation.mutate()
          }}
          disabled={reconcileMutation.isPending}
          className={secondaryButtonClass}
        >
          <Link2 className="h-4 w-4" />
          {reconcileMutation.isPending ? t.emailOrders.reconciling : t.emailOrders.reconcile}
        </button>
      </div>

      {syncMessage && <p className="mt-2 text-sm text-graphite dark:text-graphite-dark">{syncMessage}</p>}

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite dark:text-graphite-dark" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.emailOrders.searchPlaceholder}
          className="h-10 w-full rounded-xl border border-line bg-paper pl-9 pr-3 text-sm text-ink outline-none focus:border-yellow dark:border-line-dark dark:bg-paper-dark dark:text-cream"
        />
      </div>

      {isLoading && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <OrderCardSkeleton key={i} delay={i * 60} />
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {!isLoading &&
          filteredOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => setSelectedId(order.id)}
              className={`${cardClass} block w-full text-left transition hover:border-yellow ${
                order.favorite ? 'border-yellow/50 bg-yellow/[0.04]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1">
                  <FavoriteButton
                    favorite={order.favorite}
                    onToggle={(e) => {
                      e.stopPropagation()
                      favoriteMutation.mutate({ id: order.id, favorite: !order.favorite })
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink dark:text-cream">
                      {order.orderNumber ?? order.subject}
                    </p>
                    <p className="truncate text-xs text-graphite dark:text-graphite-dark">
                      {order.senderEmail} · {formatDate(order.orderDate)}
                    </p>
                  </div>
                </div>
                {order.totalAmount && (
                  <span className="shrink-0 text-sm font-semibold text-ink dark:text-cream">
                    {Number(order.totalAmount).toLocaleString(locale)}€
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <QuoteBadge
                  category={quoteCategoryOf(order)}
                  labels={{
                    pending: t.emailOrders.quoted,
                    presupuesto: t.emailOrders.quoteCategoryPresupuesto,
                    horas: t.emailOrders.quoteCategoryHoras,
                    material: t.emailOrders.quoteCategoryMaterial,
                  }}
                  onCycle={(e) => {
                    e.stopPropagation()
                    quoteStatusMutation.mutate({ id: order.id, category: QUOTE_CYCLE[quoteCategoryOf(order)] })
                  }}
                />
                {MILESTONES.map(({ field, labelKey }) => (
                  <MilestoneBadge
                    key={field}
                    done={!!order[field]}
                    label={t.emailOrders[labelKey]}
                    onToggle={(e) => {
                      e.stopPropagation()
                      milestoneMutation.mutate({ id: order.id, field, done: !order[field] })
                    }}
                  />
                ))}
              </div>
            </button>
          ))}
      </div>

      {!isLoading && orders.length === 0 && (
        <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">{t.emailOrders.empty}</p>
      )}
      {!isLoading && orders.length > 0 && filteredOrders.length === 0 && (
        <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">{t.emailOrders.noResults}</p>
      )}

      {selected && <OrderDetail order={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

function OrderDetail({ order, onClose }: { order: EmailOrder; onClose: () => void }) {
  const { t, language } = useLanguage()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const year = order.orderDate ? new Date(order.orderDate).getUTCFullYear() : null
  const quoteDocCategory = order.quoteCategory ? QUOTE_CATEGORY_TO_DOC[order.quoteCategory] : null

  async function downloadPdf() {
    const { data } = await api.get(`/email-orders/${order.id}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    window.open(url, '_blank')
  }

  const hasMissingLink =
    (!!order.quoteRef && !order.quotedAt) ||
    (!!order.orderNumber && !order.deliveryNoteAt) ||
    (!!order.orderNumber && !order.invoicedAt)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl dark:bg-surface-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold tracking-wide text-ink dark:text-cream">
            {order.orderNumber ?? order.subject}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-3 text-sm">
          {order.quoteRef && (
            <p className="flex items-center gap-1 text-graphite dark:text-graphite-dark">
              {t.emailOrders.quoteRef}: <span className="text-ink dark:text-cream">{order.quoteRef}</span>
              {quoteDocCategory && year && (
                <PreviewButton onClick={() => previewDocument(quoteDocCategory, year, order.quoteRef!)} />
              )}
            </p>
          )}
          {order.albaranNumber && (
            <p className="flex items-center gap-1 text-graphite dark:text-graphite-dark">
              {t.emailOrders.albaranNumber}: <span className="text-ink dark:text-cream">{order.albaranNumber}</span>
              {year && <PreviewButton onClick={() => previewDocument('albaran', year, order.albaranNumber!)} />}
            </p>
          )}
          {order.facturaNumber && (
            <p className="flex items-center gap-1 text-graphite dark:text-graphite-dark">
              {t.emailOrders.facturaNumber}: <span className="text-ink dark:text-cream">{order.facturaNumber}</span>
              {year && <PreviewButton onClick={() => previewDocument('factura', year, order.facturaNumber!)} />}
            </p>
          )}

          {(order.contactName || order.contactEmail || order.contactPhone) && (
            <div>
              <p className="font-semibold text-ink dark:text-cream">{t.emailOrders.contact}</p>
              <p className="text-graphite dark:text-graphite-dark">
                {[order.contactName, order.contactEmail, order.contactPhone].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}

          {order.deliveryAddress && (
            <div>
              <p className="font-semibold text-ink dark:text-cream">{t.emailOrders.deliveryAddress}</p>
              <p className="text-graphite dark:text-graphite-dark">{order.deliveryAddress}</p>
            </div>
          )}

          {order.notes && (
            <div>
              <p className="font-semibold text-ink dark:text-cream">{t.emailOrders.notes}</p>
              <p className="whitespace-pre-line text-graphite dark:text-graphite-dark">{order.notes}</p>
            </div>
          )}

          <div>
            <p className="font-semibold text-ink dark:text-cream">{t.emailOrders.lines}</p>
            <div className="mt-1 space-y-1.5">
              {order.lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 dark:border-line-dark">
                  <span className="text-graphite dark:text-graphite-dark">{line.description}</span>
                  <span className="shrink-0 font-semibold text-ink dark:text-cream">
                    {Number(line.amount).toLocaleString(locale)}€
                  </span>
                </div>
              ))}
            </div>
          </div>

          {order.totalAmount && (
            <div className="flex items-center justify-between border-t border-line pt-2 font-semibold text-ink dark:border-line-dark dark:text-cream">
              <span>{t.emailOrders.total}</span>
              <span>{Number(order.totalAmount).toLocaleString(locale)}€</span>
            </div>
          )}

          <button
            type="button"
            onClick={downloadPdf}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-semibold text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream"
          >
            <FileDown className="h-4 w-4" />
            {t.emailOrders.downloadPdf}
          </button>

          {hasMissingLink && (
            <Link
              to={`/papeleo/pedidos/${order.id}/reconcile`}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-ink text-sm font-semibold text-cream hover:bg-ink/90 dark:bg-cream dark:text-ink dark:hover:bg-cream/90"
            >
              <Link2 className="h-4 w-4" />
              {t.reconcileManual.title}
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
