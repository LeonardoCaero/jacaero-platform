import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownUp,
  Building2,
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Info,
  List,
  Search,
  Send,
  Share2,
  StickyNote,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { api } from '../lib/axios'
import { useFeedback } from '../components/feedback'
import { useLanguage } from '../contexts/LanguageContext'
import type { translations } from '../lib/translations'
import { Skeleton } from '../components/Skeleton'
import { DocumentNotes } from '../components/DocumentNotes'
import { ListRow } from '../components/ListRow'
import { DocumentOrigin, QuoteLinks, type DocOrigin, type LinkedDoc } from '../components/DocumentLinks'
import {
  Modal,
  PageHeader,
  filterActiveClass as pillActiveClass,
  filterClass as pillClass,
  filterIdleClass as pillIdleClass,
  iconButtonClass,
  inputClass,
  primaryButtonClass,
  searchInputClass,
  sectionLabelClass,
  segmentClass,
  smallButtonClass,
} from '../components/ui'

type DocCategory = 'presupuesto' | 'albaran' | 'factura' | 'pedidoMaterial' | 'horasTrabajo'
type PapeleoKey = keyof (typeof translations)['en']['papeleo']

type DocFile = {
  number: string
  name?: string
  title: string
  hasPdf: boolean
  hasDocx: boolean
  orderNumbers?: string[]
  orders?: { id: string; orderNumber: string; linked: boolean; albaranNumber?: string | null; facturaNumber?: string | null }[]
  links?: LinkedDoc[]
  linkedFrom?: DocOrigin
  sent?: { at: string; to: string; viaClient: boolean } | null
  client?: string | null
  noteCount?: number
  status?: { status: QuoteState | null; replacedBy: string | null }
}

type QuoteState = 'ANULADO' | 'STANDBY' | 'SUSTITUIDO'
const closedStates: (QuoteState | null | undefined)[] = ['ANULADO', 'SUSTITUIDO']

type QuoteFilter = 'all' | 'noOrder' | 'notSent'

const rowClass =
  'group cursor-pointer rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm transition hover:border-yellow/60 dark:border-line-dark dark:bg-surface-dark dark:hover:border-yellow/40'

const currentYear = new Date().getFullYear()
const years = [currentYear, currentYear - 1]

const docKey = (f: DocFile) => f.name ?? f.number

function RowSkeleton({ delay }: { delay: number }) {
  return (
    <div className={`${rowClass} flex items-center gap-3 animate-fade-up`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="hidden h-9 w-28 rounded-xl sm:block" />
    </div>
  )
}

export function DocumentsPage({ category, titleKey }: { category: DocCategory; titleKey: PapeleoKey }) {
  const { t, language } = useLanguage()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const [searchParams, setSearchParams] = useSearchParams()
  const [year, setYear] = useState(() => Number(searchParams.get('year')) || currentYear)
  const [search, setSearch] = useState('')
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilter>('all')
  const [clientFilter, setClientFilter] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)
  const [detail, setDetail] = useState<DocFile | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const isQuote = category === 'presupuesto'
  const { toast: showToast } = useFeedback()

  const { data: files = [], isLoading, isError } = useQuery({
    queryKey: ['documents', category, year],
    queryFn: async () => (await api.get<DocFile[]>(`/documents/${category}`, { params: { year } })).data,
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const query = search.trim().toLowerCase()
  const matchesSearch = (f: DocFile) =>
    !query || [f.number, f.title, f.client ?? '', ...(f.orderNumbers ?? [])].join(' ').toLowerCase().includes(query)
  const matchesClient = (f: DocFile) => !clientFilter || f.client === clientFilter
  const base = files.filter((f) => matchesSearch(f) && matchesClient(f))
  const counts = {
    all: base.length,
    noOrder: base.filter((f) => !f.orderNumbers?.length && !closedStates.includes(f.status?.status)).length,
    notSent: base.filter((f) => !f.sent).length,
  }
  const filteredFiles = base
    .filter((f) => quoteFilter !== 'noOrder' || (!f.orderNumbers?.length && !closedStates.includes(f.status?.status)))
    .filter((f) => quoteFilter !== 'notSent' || !f.sent)
    .sort((a, b) => (Number(b.number) - Number(a.number)) * (newestFirst ? 1 : -1))
  const clientOptions = [...new Set(files.map((f) => f.client).filter((c): c is string => !!c))].sort()

  async function openFile(number: string, ext: 'pdf' | 'docx', name?: string, sameTab = false) {
    const { data } = await api.get(`/documents/${category}/file`, {
      params: { year, number, ext, name },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(data)
    if (sameTab) window.location.href = url
    else window.open(url, '_blank')
  }

  // "Go to document" from another tab lands here with ?detail=<name>: open it once the list is in.
  useEffect(() => {
    const wanted = searchParams.get('detail')
    if (!wanted || files.length === 0) return
    const file = files.find((f) => f.name === wanted) ?? files.find((f) => Number(f.number) === Number(wanted))
    if (file) {
      setReplacedBy(file.status?.replacedBy ?? '')
      setDetail(file)
    }
    setSearchParams((prev) => {
      prev.delete('detail')
      return prev
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  // Shared links land here logged out; ProtectedRoute bounces to /login and back, then this opens the file.
  // Same-tab navigation (not window.open) because it can't rely on a fresh user gesture at that point.
  useEffect(() => {
    const number = searchParams.get('number')
    const ext = searchParams.get('ext')
    if (!searchParams.get('open') || !number || (ext !== 'pdf' && ext !== 'docx')) return
    openFile(number, ext, searchParams.get('name') ?? undefined, true).catch(() => showToast(t.documents.unreachable, 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queryClient = useQueryClient()
  const [replacedBy, setReplacedBy] = useState('')
  const statusMutation = useMutation({
    mutationFn: async ({ file, status, replaced }: { file: DocFile; status: QuoteState | null; replaced?: string }) =>
      api.put('/notes/quote-status', { category, year, name: file.name, status, replacedBy: replaced }),
    onSuccess: (_d, { file, status, replaced }) => {
      setDetail((cur) => cur && { ...cur, status: { status, replacedBy: status === 'SUSTITUIDO' ? replaced ?? null : null } })
      queryClient.invalidateQueries({ queryKey: ['documents', category, year] })
      const qs = t.documents.quoteStates
      const state =
        status === 'SUSTITUIDO'
          ? qs.replacedBy.replace('{n}', replaced || '?')
          : status === 'ANULADO'
            ? qs.cancelled
            : status === 'STANDBY'
              ? qs.standby
              : qs.active
      showToast(qs.changed.replace('{n}', file.number).replace('{state}', state.toLowerCase()))
    },
    onError: () => showToast(t.common.saveError, 'error'),
  })

  async function previewOrder(id: string) {
    try {
      const { data } = await api.get(`/email-orders/${id}/pdf`, { responseType: 'blob' })
      window.open(URL.createObjectURL(data), '_blank')
    } catch {
      showToast(t.documents.orderPdfMissing, 'error')
    }
  }

  function shareFile(f: DocFile) {
    const url = new URL(window.location.pathname, window.location.origin)
    url.searchParams.set('open', '1')
    url.searchParams.set('year', String(year))
    url.searchParams.set('number', f.number)
    if (f.name) url.searchParams.set('name', f.name)
    url.searchParams.set('ext', 'pdf')

    if (navigator.share) {
      navigator.share({ title: `${f.number} · ${f.title}`, url: url.toString() }).catch(() => {
        // user cancelled the share sheet, nothing to do
      })
      return
    }

    navigator.clipboard.writeText(url.toString()).then(() => showToast(t.documents.linkCopied))
  }

  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'numeric' })

  return (
    <div>
      <PageHeader
        title={t.papeleo[titleKey].label}
        subtitle={t.papeleo[titleKey].description}
        actions={
          <label className={`${pillClass} ${pillIdleClass} relative cursor-pointer`}>
            <CalendarDays className="h-4 w-4" />
            <span className="text-ink dark:text-cream">{year}</span>
            <ChevronDown className="h-4 w-4" />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label={t.documents.year}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite dark:text-graphite-dark" />
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isQuote ? t.documents.searchQuotePlaceholder : t.documents.searchPlaceholder}
          aria-label={isQuote ? t.documents.searchQuotePlaceholder : t.documents.searchPlaceholder}
          aria-keyshortcuts="Control+K"
          className={`${searchInputClass} sm:pr-20`}
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 font-mono text-xs text-graphite sm:block dark:border-line-dark dark:text-graphite-dark">
          Ctrl K
        </kbd>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(isQuote ? (['all', 'noOrder', 'notSent'] as const) : (['all', 'notSent'] as const)).map((f) => {
          const Icon = f === 'all' ? List : f === 'noOrder' ? FileText : Send
          const active = quoteFilter === f
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => setQuoteFilter(f)}
              className={`${pillClass} shrink-0 ${active ? pillActiveClass : pillIdleClass}`}
            >
              <Icon className="h-4 w-4" />
              {t.documents.quoteFilters[f]}
              <span
                className={`rounded-full px-1.5 py-px font-mono text-xs tabular ${
                  active ? 'bg-ink/15 text-ink' : 'bg-ink/5 text-ink dark:bg-cream/10 dark:text-cream'
                }`}
              >
                {counts[f]}
              </span>
            </button>
          )
        })}
        {clientOptions.length > 1 && (
          <label className={`${pillClass} relative shrink-0 cursor-pointer ${clientFilter ? pillActiveClass : pillIdleClass}`}>
            <Users className="h-4 w-4" />
            <span className="max-w-48 truncate">{clientFilter || t.documents.allClients}</span>
            <ChevronDown className="h-4 w-4" />
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              aria-label={t.documents.allClients}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">{t.documents.allClients}</option>
              {clientOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!isLoading && !isError && files.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-graphite dark:text-graphite-dark">
          <span>{t.documents.found.replace('{count}', String(filteredFiles.length))}</span>
          <button
            type="button"
            onClick={() => setNewestFirst((v) => !v)}
            className="inline-flex items-center gap-1.5 font-semibold hover:text-ink dark:hover:text-cream"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            {newestFirst ? t.documents.newestFirst : t.documents.oldestFirst}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <RowSkeleton key={i} delay={i * 50} />
          ))}
        </div>
      )}

      <ul className="mt-2 space-y-2">
        {!isLoading &&
          filteredFiles.map((f, i) => {
            const orderCount = f.orderNumbers?.length ?? 0
            const pendingCount = f.orders?.filter((o) => !o.linked).length ?? 0
            const state = f.status?.status
            const stateChip = state ? (
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  state === 'STANDBY'
                    ? 'border-yellow/70 text-ink dark:text-yellow'
                    : 'border-line text-graphite line-through decoration-graphite/50 dark:border-line-dark dark:text-graphite-dark'
                }`}
              >
                {state === 'SUSTITUIDO'
                  ? t.documents.quoteStates.replacedBy.replace('{n}', f.status?.replacedBy ?? '?')
                  : t.documents.quoteStates[state === 'ANULADO' ? 'cancelled' : 'standby']}
              </span>
            ) : null
            const orderChip = !isQuote ? stateChip : state ? (
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  state === 'STANDBY'
                    ? 'border-yellow/70 text-ink dark:text-yellow'
                    : 'border-line text-graphite line-through decoration-graphite/50 dark:border-line-dark dark:text-graphite-dark'
                }`}
              >
                {state === 'SUSTITUIDO'
                  ? t.documents.quoteStates.replacedBy.replace('{n}', f.status?.replacedBy ?? '?')
                  : t.documents.quoteStates[state === 'ANULADO' ? 'cancelled' : 'standby']}
              </span>
            ) :
              orderCount > 0 ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-yellow/70 bg-yellow/15 px-2.5 py-1 text-xs font-semibold text-ink dark:text-yellow">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  {orderCount === 1 ? t.documents.order : t.documents.orders.replace('{count}', String(orderCount))}
                </span>
              ) : pendingCount > 0 ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-yellow/80 px-2.5 py-1 text-xs font-semibold text-ink dark:text-yellow">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  {t.documents.toLink}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-graphite dark:border-line-dark dark:text-graphite-dark">
                  <span className="h-1.5 w-1.5 rounded-full bg-graphite/60 dark:bg-graphite-dark/60" />
                  {t.documents.noOrder}
                </span>
              )
            const sentChip = f.sent ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink dark:text-cream">
                <Send className="h-3.5 w-3.5" />
                {t.documents.sent} {shortDate(f.sent.at)}
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-rust dark:text-rust-dark">
                <Send className="h-3.5 w-3.5" />
                {t.documents.notSent}
              </span>
            )
            const openDetail = () => {
              setReplacedBy(f.status?.replacedBy ?? '')
              setDetail(f)
            }
            const actions = (
              <>
                {f.hasPdf && (
                  <button
                    type="button"
                    title={t.documents.viewPdf}
                    aria-label={t.documents.viewPdf}
                    onClick={() => openFile(f.number, 'pdf', f.name)}
                    className={`${iconButtonClass} relative z-10`}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  title={t.documents.details}
                  aria-label={t.documents.details}
                  onClick={openDetail}
                  className={`${iconButtonClass} relative z-10`}
                >
                  <Info className="h-4 w-4" />
                </button>
              </>
            )
            const heading = (
              <div className="flex min-w-0 items-start gap-3 lg:items-center">
                <div className="min-w-0">
                  <p
                    title={`${f.number} · ${f.title}`}
                    className="line-clamp-2 font-display text-base font-semibold leading-snug tracking-wide text-ink lg:line-clamp-1 dark:text-cream"
                  >
                    <span className="mr-1 font-mono text-sm text-yellow-ink dark:text-yellow">{f.number}</span> {f.title}
                  </p>
                  {!!f.noteCount && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-yellow-ink dark:text-yellow">
                      <StickyNote className="h-3.5 w-3.5 shrink-0" />
                      {f.noteCount === 1 ? t.docNotes.countOne : t.docNotes.count.replace('{count}', String(f.noteCount))}
                    </p>
                  )}
                  {f.client && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-graphite dark:text-graphite-dark">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      {f.client}
                    </p>
                  )}
                </div>
              </div>
            )

            return (
              <ListRow
                key={docKey(f)}
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                onOpen={openDetail}
                openLabel={`${t.documents.details} ${f.number}`}
                heading={heading}
                chips={
                  <>
                    {orderChip && <span className="lg:w-32">{orderChip}</span>}
                    <span className="lg:w-32">{sentChip}</span>
                  </>
                }
                actions={actions}
              />
            )
          })}
      </ul>

      {isError && <p className="mt-6 text-center text-sm text-rust dark:text-rust-dark">{t.documents.unreachable}</p>}
      {!isLoading && !isError && files.length === 0 && (
        <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">{t.documents.empty}</p>
      )}
      {!isLoading && !isError && files.length > 0 && filteredFiles.length === 0 && (
        <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">{t.documents.noResults}</p>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        closeLabel={t.common.close}
        title={
          detail && (
            <span className="block">
              <span className="mr-1 font-mono text-yellow-ink dark:text-yellow">{detail.number}</span> {detail.title}
              {detail.client && (
                <span className="mt-1 flex items-center gap-1 font-sans text-xs font-normal text-graphite dark:text-graphite-dark">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  {detail.client}
                </span>
              )}
            </span>
          )
        }
      >
        {detail && (
          <>
          <>
          <h3 id="doc-state-label" className={sectionLabelClass}>
            {t.documents.quoteStates.title}
          </h3>
          <div role="radiogroup" aria-labelledby="doc-state-label" className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {([null, 'STANDBY', 'ANULADO', 'SUSTITUIDO'] as const).map((st) => {
              const active = (detail.status?.status ?? null) === st
              const label =
                st === null
                  ? t.documents.quoteStates.active
                  : st === 'STANDBY'
                    ? t.documents.quoteStates.standby
                    : st === 'ANULADO'
                      ? t.documents.quoteStates.cancelled
                      : t.documents.quoteStates.replaced
              return (
                <button
                  key={st ?? 'active'}
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    st === 'SUSTITUIDO'
                      ? setDetail({ ...detail, status: { status: 'SUSTITUIDO', replacedBy: detail.status?.replacedBy ?? null } })
                      : statusMutation.mutate({ file: detail, status: st })
                  }
                  role="radio"
                  aria-checked={active}
                  className={segmentClass(active)}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {detail.status?.status === 'SUSTITUIDO' && (
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                statusMutation.mutate({ file: detail, status: 'SUSTITUIDO', replaced: replacedBy.trim() })
              }}
            >
              <input
                value={replacedBy}
                onChange={(e) => setReplacedBy(e.target.value)}
                placeholder={t.documents.quoteStates.replacedPlaceholder}
                aria-label={t.documents.quoteStates.replacedPlaceholder}
                    className={inputClass}
              />
              <button type="submit" className={`${primaryButtonClass} shrink-0`}>
                {t.docNotes.save}
              </button>
            </form>
          )}

          {isQuote && (
            <>
          <h3 className={`mt-5 ${sectionLabelClass}`}>
            {t.documents.columnOrder}
          </h3>
          {detail.orders?.length ? (
            <div className="mt-2 space-y-2">
              <div className="divide-y divide-line rounded-xl border border-line dark:divide-line-dark dark:border-line-dark">
                {detail.orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-ink dark:text-cream">
                      <ShoppingCart className="h-4 w-4 shrink-0" />
                      <span className="font-mono font-semibold">{o.orderNumber}</span>
                      {!o.linked && <span className="text-xs text-graphite dark:text-graphite-dark">{t.documents.toLink}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => previewOrder(o.id)}
                        title={t.documents.previewOrder}
                        aria-label={`${t.documents.previewOrder} ${o.orderNumber}`}
                        className={iconButtonClass}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {!o.linked && (
                        <Link to={`/papeleo/pedidos/${o.id}/reconcile`} className={smallButtonClass}>
                          {t.documents.link}
                        </Link>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {detail.orders.some((o) => !o.linked) && (
                <p className="text-xs text-graphite dark:text-graphite-dark">{t.documents.toLinkHint}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-graphite dark:text-graphite-dark">{t.documents.noOrder}</p>
          )}

          {detail.name && (
            <QuoteLinks
              quote={{ name: detail.name }}
              year={year}
              orders={detail.orders ?? []}
              links={detail.links ?? []}
              onChange={(links) => {
                setDetail((cur) => cur && { ...cur, links })
                queryClient.invalidateQueries({ queryKey: ['documents'] })
              }}
            />
          )}
            </>
          )}

          {detail.linkedFrom && <DocumentOrigin origin={detail.linkedFrom} onPreviewOrder={previewOrder} />}

          <h3 className={`mt-5 ${sectionLabelClass}`}>
            {t.documents.columnSent}
          </h3>
          {detail.sent ? (
            <div className="mt-2 rounded-xl border border-line px-3 py-2.5 text-sm dark:border-line-dark">
              <p className="flex items-center gap-2 font-semibold text-ink dark:text-cream">
                <Send className="h-4 w-4" />
                {new Date(detail.sent.at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="mt-1 break-all text-xs text-graphite dark:text-graphite-dark">
                {detail.sent.viaClient ? t.documents.viaClient : `${t.documents.to} ${detail.sent.to}`}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-rust dark:text-rust-dark">{t.documents.notSent}</p>
          )}
          </>

          {detail.name && (
            <div className="mt-5">
              <DocumentNotes category={category} year={year} name={detail.name} />
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!detail.hasPdf}
              onClick={() => openFile(detail.number, 'pdf', detail.name)}
              className="flex flex-col items-center gap-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-ink transition hover:border-yellow disabled:opacity-40 dark:border-line-dark dark:text-cream"
            >
              <Eye className="h-4 w-4" />
              {t.documents.viewPdf}
            </button>
            <button
              type="button"
              disabled={!detail.hasPdf}
              onClick={() => shareFile(detail)}
              className="flex flex-col items-center gap-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-ink transition hover:border-yellow disabled:opacity-40 dark:border-line-dark dark:text-cream"
            >
              <Share2 className="h-4 w-4" />
              {t.documents.share}
            </button>
            <button
              type="button"
              disabled={!detail.hasDocx}
              onClick={() => openFile(detail.number, 'docx', detail.name)}
              className="flex flex-col items-center gap-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-ink transition hover:border-yellow disabled:opacity-40 dark:border-line-dark dark:text-cream"
            >
              <Download className="h-4 w-4" />
              {t.documents.downloadWord}
            </button>
          </div>
          </>
        )}
      </Modal>

    </div>
  )
}
