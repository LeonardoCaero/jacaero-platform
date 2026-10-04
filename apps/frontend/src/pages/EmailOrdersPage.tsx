import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, FileText, Check, Link2, Eye, Info, Star, Search, Repeat } from 'lucide-react'
import { api } from '../lib/axios'
import { formatEuro } from '../lib/format'
import { Skeleton } from '../components/Skeleton'
import { DocumentNotes } from '../components/DocumentNotes'
import {
  Modal,
  PageHeader,
  chipDoneClass,
  chipPendingClass,
  filterActiveClass,
  filterClass,
  filterIdleClass,
  iconButtonClass,
  inputClass,
  listCardClass,
  primaryButtonClass,
  searchInputClass,
  secondaryButtonClass,
  sectionLabelClass,
  smallButtonClass,
  statusClass,
} from '../components/ui'
import { useFeedback } from '../components/feedback'
import { useLanguage } from '../contexts/LanguageContext'

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

// Same as Documentos: hand the blob to a new tab so mobile opens it in the system PDF viewer —
// an in-page <iframe> can't render PDFs on mobile browsers.
async function openPdf(path: string, params?: Record<string, unknown>) {
  const { data } = await api.get(path, { params, responseType: 'blob' })
  window.open(URL.createObjectURL(data), '_blank')
}

function PreviewButton({ onClick, label }: { onClick: (e: MouseEvent) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${iconButtonClass} relative z-10`}
    >
      <Eye className="h-4 w-4" />
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
  albaranSentAt: string | null
  facturarOkAt: string | null
  invoicedAt: string | null
  facturaNumber: string | null
  favorite: boolean
  receivedAt: string
  lines: EmailOrderLine[]
  client: { id: string; name: string } | null
  contractResource: { id: string; name: string } | null
}

type Resource = {
  id: string
  name: string
  client: { id: string; name: string }
  orders: { id: string; year: number }[]
}

const orderYearOf = (o: EmailOrder) => new Date(o.orderDate ?? o.receivedAt).getUTCFullYear()

function OrderCardSkeleton({ delay }: { delay: number }) {
  return (
    <div className={`${listCardClass} animate-fade-up`} style={{ animationDelay: `${delay}ms` }}>
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

type MilestoneField = 'deliveryNoteAt' | 'invoicedAt'
const MILESTONES: { field: MilestoneField; labelKey: 'deliveryNote' | 'invoiced' }[] = [
  { field: 'deliveryNoteAt', labelKey: 'deliveryNote' },
  { field: 'invoicedAt', labelKey: 'invoiced' },
]

type QuoteCategory = 'pending' | 'presupuesto' | 'horas' | 'material'
const QUOTE_CATEGORIES: QuoteCategory[] = ['pending', 'presupuesto', 'horas', 'material']

function quoteCategoryOf(order: EmailOrder): QuoteCategory {
  if (order.quoteCategory === 'PRESUPUESTO') return 'presupuesto'
  if (order.quoteCategory === 'HORAS') return 'horas'
  if (order.quoteCategory === 'MATERIAL') return 'material'
  return 'pending'
}

// Read-only in the list: changing state happens explicitly in the order detail.
function StatusChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={done ? chipDoneClass : chipPendingClass}>
      {done && <Check className="h-3 w-3" />}
      {label}
    </span>
  )
}

function FavoriteButton({
  favorite,
  label,
  onToggle,
}: {
  favorite: boolean
  label: string
  onToggle: (e: MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={favorite}
      title={label}
      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-ink/5 dark:hover:bg-cream/10 ${
        favorite
          ? 'text-yellow-ink dark:text-yellow'
          : 'text-graphite/50 hover:text-graphite dark:text-graphite-dark/50 dark:hover:text-graphite-dark'
      }`}
    >
      <Star className="h-4 w-4" fill={favorite ? 'currentColor' : 'none'} />
    </button>
  )
}

export function EmailOrdersPage() {
  const { t, language } = useLanguage()
  const { confirm, toast } = useFeedback()
  const queryClient = useQueryClient()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<QuoteCategory | 'all'>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [resourceOrder, setResourceOrder] = useState<EmailOrder | null>(null)
  const [chosenResource, setChosenResource] = useState('')
  const [resourceError, setResourceError] = useState<string | null>(null)

  const {
    data: orders = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['email-orders'],
    queryFn: async () => (await api.get<EmailOrder[]>('/email-orders')).data,
  })

  const quoteLabels: Record<QuoteCategory, string> = {
    pending: t.emailOrders.quoted,
    presupuesto: t.emailOrders.quoteCategoryPresupuesto,
    horas: t.emailOrders.quoteCategoryHoras,
    material: t.emailOrders.quoteCategoryMaterial,
  }

  const query = search.trim().toLowerCase()
  const searchedOrders = orders
    .filter((o) => !query || orderSearchText(o).includes(query))
    .filter((o) => !favoritesOnly || o.favorite)
  const filteredOrders = searchedOrders.filter((o) => typeFilter === 'all' || quoteCategoryOf(o) === typeFilter)

  const typeFilters: { value: QuoteCategory | 'all'; label: string }[] = [
    { value: 'all', label: t.emailOrders.filterTypeAll },
    { value: 'pending', label: t.emailOrders.filterTypePending },
    { value: 'presupuesto', label: t.emailOrders.quoteCategoryPresupuesto },
    { value: 'horas', label: t.emailOrders.quoteCategoryHoras },
    { value: 'material', label: t.emailOrders.quoteCategoryMaterial },
  ]
  const countFor = (value: QuoteCategory | 'all') =>
    value === 'all' ? searchedOrders.length : searchedOrders.filter((o) => quoteCategoryOf(o) === value).length

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
    onError: () => setSyncMessage(t.common.loadError),
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
    onError: () => setSyncMessage(t.common.loadError),
  })

  const orderLabel = (id: string) => {
    const order = orders.find((o) => o.id === id)
    return order?.orderNumber ?? order?.subject ?? ''
  }

  const milestoneMutation = useMutation({
    mutationFn: ({ id, field, done }: { id: string; field: MilestoneField; done: boolean }) =>
      api.patch(`/email-orders/${id}/milestone`, { field, done }),
    onSuccess: (_d, { id, field, done }) => {
      const label = t.emailOrders[MILESTONES.find((m) => m.field === field)!.labelKey]
      toast((done ? t.emailOrders.markedOn : t.emailOrders.markedOff).replace('{order}', orderLabel(id)).replace('{label}', label))
      queryClient.invalidateQueries({ queryKey: ['email-orders'] })
    },
    onError: () => toast(t.common.saveError, 'error'),
  })

  const quoteStatusMutation = useMutation({
    mutationFn: ({ id, category }: { id: string; category: QuoteCategory }) =>
      api.patch(`/email-orders/${id}/quote-status`, { category }),
    onSuccess: (_d, { id, category }) => {
      const label = category === 'pending' ? t.emailOrders.filterTypePending : quoteLabels[category]
      toast(t.emailOrders.quoteTypeSet.replace('{order}', orderLabel(id)).replace('{label}', label.toLowerCase()))
      queryClient.invalidateQueries({ queryKey: ['email-orders'] })
    },
    onError: () => toast(t.common.saveError, 'error'),
  })

  const { data: resources = [] } = useQuery({
    queryKey: ['email-orders', 'resources'],
    queryFn: async () => (await api.get<Resource[]>('/email-orders/resources')).data,
  })

  const freeResourcesFor = (order: EmailOrder) =>
    resources.filter((r) => !r.orders.some((o) => o.year === orderYearOf(order) && o.id !== order.id))

  function openResource(order: EmailOrder) {
    const free = freeResourcesFor(order)
    setResourceError(null)
    setChosenResource(order.contractResource?.id ?? (free.length === 1 ? free[0].id : ''))
    setResourceOrder(order)
  }

  const resourceMutation = useMutation({
    mutationFn: ({ id, contractResourceId }: { id: string; contractResourceId: string | null }) =>
      api.patch(`/email-orders/${id}/resource`, { contractResourceId }),
    onSuccess: () => {
      setResourceOrder(null)
      queryClient.invalidateQueries({ queryKey: ['email-orders'] })
      queryClient.invalidateQueries({ queryKey: ['recurring-albaranes'] })
    },
    onError: (err: any) => setResourceError(err?.response?.data?.error ?? 'Error'),
  })

  const favoriteMutation = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      api.patch(`/email-orders/${id}/favorite`, { favorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-orders'] }),
    onError: () => toast(t.common.saveError, 'error'),
  })

  const selected = orders.find((o) => o.id === selectedId) ?? null

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(locale)
  }

  async function unlinkMilestone(order: EmailOrder, field: MilestoneField) {
    const message = field === 'invoicedAt' ? t.emailOrders.confirmUninvoice : t.emailOrders.confirmUnlinkAlbaran
    if (!(await confirm({ message, danger: field === 'invoicedAt' }))) return
    milestoneMutation.mutate({ id: order.id, field, done: false })
  }

  return (
    <div>
      <PageHeader
        title={t.papeleo.pedidosCorreo.label}
        subtitle={t.papeleo.pedidosCorreo.description}
        actions={
          <>
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
                syncMutation.mutate(false)
              }}
              disabled={syncMutation.isPending}
              className={primaryButtonClass}
            >
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? t.emailOrders.syncing : t.emailOrders.sync}
            </button>
          </>
        }
      />

      <div role="status" aria-live="polite">
        {syncMessage && <p className={`mt-4 ${statusClass}`}>{syncMessage}</p>}
      </div>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite dark:text-graphite-dark" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.emailOrders.searchPlaceholder}
          aria-label={t.emailOrders.searchPlaceholder}
          className={searchInputClass}
        />
      </div>

      <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={typeFilter === f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`${filterClass} ${typeFilter === f.value ? filterActiveClass : filterIdleClass}`}
            >
              {f.label}
              <span className="font-mono text-xs tabular opacity-70">{countFor(f.value)}</span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`${filterClass} ${favoritesOnly ? filterActiveClass : filterIdleClass}`}
          >
            <Star className="h-3.5 w-3.5" fill={favoritesOnly ? 'currentColor' : 'none'} />
            {t.emailOrders.filterFavorites}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <OrderCardSkeleton key={i} delay={i * 60} />
          ))}
        </div>
      )}

      {isError && (
        <div className={`mt-4 flex items-center justify-between gap-3 ${statusClass}`}>
          <span>{t.common.loadError}</span>
          <button type="button" onClick={() => refetch()} className={secondaryButtonClass}>
            {t.common.retry}
          </button>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {!isLoading &&
          filteredOrders.map((order) => (
            <li
              key={order.id}
              className={`${listCardClass} relative py-3 transition hover:border-yellow dark:hover:border-yellow/60 ${
                order.favorite ? 'border-yellow/50 bg-yellow/[0.04] dark:border-yellow/30' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedId(order.id)}
                aria-label={`${t.emailOrders.openOrder} ${order.orderNumber ?? order.subject}`}
                tabIndex={-1}
                className="absolute inset-0 rounded-2xl"
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="order-1 flex min-w-0 flex-1 items-center gap-1">
                  <FavoriteButton
                    favorite={order.favorite}
                    label={t.emailOrders.favorite}
                    onToggle={() => favoriteMutation.mutate({ id: order.id, favorite: !order.favorite })}
                  />
                  {(order.contractResource || (order.orderNumber && freeResourcesFor(order).length > 0)) && (
                    <button
                      type="button"
                      title={t.emailOrders.monthlyResource}
                      aria-label={t.emailOrders.monthlyResource}
                      aria-pressed={!!order.contractResource}
                      onClick={() => openResource(order)}
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-ink/5 dark:hover:bg-cream/10 ${
                        order.contractResource
                          ? 'text-ink dark:text-cream'
                          : 'text-graphite/50 hover:text-graphite dark:text-graphite-dark/50 dark:hover:text-graphite-dark'
                      }`}
                    >
                      <Repeat className="h-4 w-4" />
                    </button>
                  )}
                  <div className="min-w-0 pl-1">
                    <p className="truncate font-mono text-sm font-semibold text-ink dark:text-cream">
                      {order.orderNumber ?? order.subject}
                    </p>
                    <p className="truncate text-xs text-graphite dark:text-graphite-dark">
                      {order.client?.name ?? order.senderEmail} · {formatDate(order.orderDate)}
                    </p>
                    {order.contractResource && (
                      <p className="truncate text-xs font-semibold text-ink dark:text-cream">
                        {t.emailOrders.resourceTag.replace('{name}', order.contractResource.name)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="order-2 flex shrink-0 items-center gap-1 lg:order-3">
                  {order.totalAmount && (
                    <span className="min-w-24 text-right font-mono text-sm font-semibold tabular text-ink dark:text-cream">
                      {formatEuro(order.totalAmount, locale)}
                    </span>
                  )}
                  <div className="ml-2 flex items-center gap-2">
                    <PreviewButton
                      label={t.emailOrders.previewPdf}
                      onClick={() => openPdf(`/email-orders/${order.id}/pdf`)}
                    />
                    <button
                      type="button"
                      title={t.documents.details}
                      aria-label={t.documents.details}
                      onClick={() => setSelectedId(order.id)}
                      className={`${iconButtonClass} relative z-10`}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="order-3 flex w-full flex-wrap gap-1.5 pl-9 lg:order-2 lg:w-auto lg:justify-end lg:pl-0">
                  <StatusChip done={quoteCategoryOf(order) !== 'pending'} label={quoteLabels[quoteCategoryOf(order)]} />
                  {MILESTONES.map(({ field, labelKey }) => (
                    <StatusChip key={field} done={!!order[field]} label={t.emailOrders[labelKey]} />
                  ))}
                  {order.facturarOkAt && !order.invoicedAt && (
                    <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-cream dark:bg-yellow dark:text-ink">
                      {t.emailOrders.facturarOk}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
      </ul>

      {!isLoading && !isError && orders.length === 0 && (
        <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">{t.emailOrders.empty}</p>
      )}
      {!isLoading && orders.length > 0 && filteredOrders.length === 0 && (
        <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">{t.emailOrders.noResults}</p>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={<span className="font-mono">{selected?.orderNumber ?? selected?.subject}</span>}
        closeLabel={t.common.close}
      >
        {selected && (
          <OrderDetail
            order={selected}
            quoteLabels={quoteLabels}
            onQuoteCategory={(category) => quoteStatusMutation.mutate({ id: selected.id, category })}
            onUnlinkMilestone={(field) => unlinkMilestone(selected, field)}
          />
        )}
      </Modal>

      <Modal
        open={!!resourceOrder}
        onClose={() => setResourceOrder(null)}
        title={t.emailOrders.monthlyResource}
        closeLabel={t.common.close}
        size="sm"
      >
        {resourceOrder && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              resourceMutation.mutate({ id: resourceOrder.id, contractResourceId: chosenResource })
            }}
          >
            <p className="text-sm text-graphite dark:text-graphite-dark">
              {t.emailOrders.monthlyResourceHint.replace('{order}', resourceOrder.orderNumber ?? '')}
            </p>
            <select
              required
              value={chosenResource}
              onChange={(e) => setChosenResource(e.target.value)}
              aria-label={t.emailOrders.chooseResource}
              className={`mt-4 ${inputClass}`}
            >
              <option value="" disabled hidden>
                {t.emailOrders.chooseResource}
              </option>
              {[
                ...resources.filter((r) => r.id === resourceOrder.contractResource?.id),
                ...freeResourcesFor(resourceOrder).filter((r) => r.id !== resourceOrder.contractResource?.id),
              ].map((r) => (
                <option key={r.id} value={r.id}>
                  {`${r.client.name} -> ${r.name}`}
                </option>
              ))}
            </select>
            {resourceError && <p className="mt-2 text-sm text-rust dark:text-rust-dark">{resourceError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              {resourceOrder.contractResource && (
                <button
                  type="button"
                  onClick={() => resourceMutation.mutate({ id: resourceOrder.id, contractResourceId: null })}
                  className={secondaryButtonClass}
                >
                  {t.emailOrders.unlinkResource}
                </button>
              )}
              <button
                type="submit"
                disabled={!chosenResource || resourceMutation.isPending}
                className={primaryButtonClass}
              >
                {t.emailOrders.linkResource}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

function OrderDetail({
  order,
  quoteLabels,
  onQuoteCategory,
  onUnlinkMilestone,
}: {
  order: EmailOrder
  quoteLabels: Record<QuoteCategory, string>
  onQuoteCategory: (category: QuoteCategory) => void
  onUnlinkMilestone: (field: MilestoneField) => void
}) {
  const { t, language } = useLanguage()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const year = order.orderDate ? new Date(order.orderDate).getUTCFullYear() : null
  const quoteDocCategory = order.quoteCategory ? QUOTE_CATEGORY_TO_DOC[order.quoteCategory] : null
  const currentCategory = quoteCategoryOf(order)

  function previewDocument(category: DocCategory, year: number, number: string) {
    openPdf(`/documents/${category}/file`, { year, number, ext: 'pdf' })
  }

  const hasMissingLink =
    (!!order.quoteRef && !order.quotedAt) ||
    (!!order.orderNumber && !order.deliveryNoteAt) ||
    (!!order.orderNumber && !order.invoicedAt)

  const docRefs = [
    order.quoteRef && {
      label: t.emailOrders.quoteRef,
      value: order.quoteRef,
      preview: quoteDocCategory && year ? () => previewDocument(quoteDocCategory, year, order.quoteRef!) : null,
    },
    order.albaranSentAt && {
      label: t.emailOrders.albaranSent,
      value: new Date(order.albaranSentAt).toLocaleDateString(locale),
      preview: null,
    },
  ].filter(Boolean) as { label: string; value: string; preview: (() => void) | null }[]

  return (
    <div className="space-y-5 text-sm">
      <section>
        <h3 className={sectionLabelClass}>{t.emailOrders.status}</h3>
        <p className="mt-2 text-xs text-graphite dark:text-graphite-dark">{t.emailOrders.quoteType}</p>
        <div role="radiogroup" aria-label={t.emailOrders.quoteType} className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {QUOTE_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              role="radio"
              aria-checked={currentCategory === category}
              onClick={() => currentCategory !== category && onQuoteCategory(category)}
              className={`h-9 rounded-lg border px-2 text-xs font-semibold transition ${
                currentCategory === category
                  ? 'border-yellow bg-yellow text-ink'
                  : 'border-line text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'
              }`}
            >
              {category === 'pending' ? t.emailOrders.filterTypePending : quoteLabels[category]}
            </button>
          ))}
        </div>
        <div className="mt-3 divide-y divide-line rounded-xl border border-line dark:divide-line-dark dark:border-line-dark">
          {MILESTONES.map(({ field, labelKey }) => {
            const number = field === 'deliveryNoteAt' ? order.albaranNumber : order.facturaNumber
            const docCategory = field === 'deliveryNoteAt' ? 'albaran' : 'factura'
            return (
              <div key={field} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-ink dark:text-cream">
                  {order[field] ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
                  {t.emailOrders[labelKey]}
                  {number ? (
                    <span className="font-mono font-semibold text-yellow-ink dark:text-yellow">{number}</span>
                  ) : (
                    order[field] && <span className="text-xs text-graphite dark:text-graphite-dark">{t.emailOrders.markedNoDoc}</span>
                  )}
                  {field === 'invoicedAt' && order.facturarOkAt && !order.invoicedAt && (
                    <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-cream dark:bg-yellow dark:text-ink">
                      {t.emailOrders.facturarOk}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {number && year && (
                    <PreviewButton label={t.emailOrders.previewPdf} onClick={() => previewDocument(docCategory, year, number)} />
                  )}
                  {!number && (
                    <Link to={`/papeleo/pedidos/${order.id}/reconcile`} className={smallButtonClass}>
                      <Link2 className="h-3.5 w-3.5" />
                      {t.emailOrders.linkDoc}
                    </Link>
                  )}
                  {order[field] && (
                    <button type="button" onClick={() => onUnlinkMilestone(field)} className={smallButtonClass}>
                      {number ? t.emailOrders.unlinkDoc : t.emailOrders.removeMark}
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {docRefs.length > 0 && (
        <dl className="divide-y divide-line rounded-xl border border-line dark:divide-line-dark dark:border-line-dark">
          {docRefs.map((ref) => (
            <div key={ref.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-graphite dark:text-graphite-dark">{ref.label}</dt>
              <dd className="flex items-center gap-1 font-mono text-ink dark:text-cream">
                {ref.value}
                {ref.preview && <PreviewButton label={t.emailOrders.previewPdf} onClick={ref.preview} />}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {(order.contactName || order.contactEmail || order.contactPhone) && (
        <section>
          <h3 className={sectionLabelClass}>{t.emailOrders.contact}</h3>
          <p className="mt-1 text-ink dark:text-cream">
            {[order.contactName, order.contactEmail, order.contactPhone].filter(Boolean).join(' · ')}
          </p>
        </section>
      )}

      {order.deliveryAddress && (
        <section>
          <h3 className={sectionLabelClass}>{t.emailOrders.deliveryAddress}</h3>
          <p className="mt-1 text-ink dark:text-cream">{order.deliveryAddress}</p>
        </section>
      )}

      {order.notes && (
        <section>
          <h3 className={sectionLabelClass}>{t.emailOrders.notes}</h3>
          <p className="mt-1 whitespace-pre-line text-ink dark:text-cream">{order.notes}</p>
        </section>
      )}

      <section>
        <h3 className={sectionLabelClass}>{t.emailOrders.lines}</h3>
        <div className="mt-1.5 divide-y divide-line rounded-xl border border-line dark:divide-line-dark dark:border-line-dark">
          {order.lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="text-ink dark:text-cream">{line.description}</span>
              <span className="shrink-0 font-mono font-semibold tabular text-ink dark:text-cream">
                {formatEuro(line.amount, locale)}
              </span>
            </div>
          ))}
          {order.totalAmount && (
            <div className="flex items-center justify-between gap-3 bg-paper px-3 py-2 font-semibold text-ink dark:bg-paper-dark dark:text-cream">
              <span>{t.emailOrders.total}</span>
              <span className="font-mono tabular">{formatEuro(order.totalAmount, locale)}</span>
            </div>
          )}
        </div>
      </section>

      <DocumentNotes category="pedido" year={0} name={order.id} />

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => openPdf(`/email-orders/${order.id}/pdf`)}
          className={secondaryButtonClass}
        >
          <FileText className="h-4 w-4" />
          {t.emailOrders.viewPdf}
        </button>
        {hasMissingLink && (
          <Link to={`/papeleo/pedidos/${order.id}/reconcile`} className={primaryButtonClass}>
            <Link2 className="h-4 w-4" />
            {t.reconcileManual.title}
          </Link>
        )}
      </div>
    </div>
  )
}
