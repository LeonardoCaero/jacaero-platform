import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Search, Sparkles } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../components/feedback'
import { formatEuro } from '../lib/format'
import {
  PageHeader,
  filterActiveClass,
  filterClass,
  filterIdleClass,
  listCardClass as cardClass,
  primaryButtonClass,
  searchInputClass,
  sectionLabelClass,
  smallButtonClass,
} from '../components/ui'

type DocCategory = 'presupuesto' | 'albaran' | 'factura' | 'pedidoMaterial' | 'horasTrabajo'

type EmailOrder = {
  id: string
  orderNumber: string | null
  quoteRef: string | null
  orderDate: string | null
  subject: string
  totalAmount: string | null
  quotedAt: string | null
  deliveryNoteAt: string | null
  invoicedAt: string | null
  receivedAt: string
  client: { id: string; name: string } | null
}

type Candidate = { number: string; name: string; title: string; total: number | null; reason?: 'order' | 'quote' | 'amount' }

type TargetKey = 'missingQuote' | 'missingAlbaran' | 'missingFactura'
type Target = { key: TargetKey; categories: DocCategory[] }

function usePdfPreview() {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  async function load(fetcher: () => Promise<Blob>) {
    const blob = await fetcher()
    setUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(blob)
    })
  }

  return { url, load }
}

export function ReconcilePage() {
  const { id } = useParams<{ id: string }>()
  const { t, language } = useLanguage()
  const { toast, confirm } = useFeedback()
  const [searchParams] = useSearchParams()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const queryClient = useQueryClient()
  const r = t.reconcileManual

  const { data: order } = useQuery({
    queryKey: ['email-orders', id],
    queryFn: async () => (await api.get<EmailOrder>(`/email-orders/${id}`)).data,
  })

  const orderPreview = usePdfPreview()
  useEffect(() => {
    if (!id) return
    orderPreview.load(async () => (await api.get(`/email-orders/${id}/pdf`, { responseType: 'blob' })).data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Arriving from an albarán / factura ("Buscar pedido") or from the order's "Buscar": preselect.
  const wantedTarget = searchParams.get('target')
  const [targetKey, setTargetKey] = useState<TargetKey | null>(
    wantedTarget === 'albaran' ? 'missingAlbaran' : wantedTarget === 'factura' ? 'missingFactura' : null,
  )
  const [category, setCategory] = useState<DocCategory | null>(null)
  const [selected, setSelected] = useState<{ category: DocCategory; number: string; name: string } | null>(null)
  const [search, setSearch] = useState('')
  const docPreview = usePdfPreview()

  const year = order ? new Date(order.orderDate ?? order.receivedAt).getFullYear() : new Date().getFullYear()

  const targets: Target[] = order
    ? ([
        order.quoteRef && !order.quotedAt ? { key: 'missingQuote', categories: ['presupuesto', 'pedidoMaterial', 'horasTrabajo'] } : null,
        order.orderNumber && !order.deliveryNoteAt ? { key: 'missingAlbaran', categories: ['albaran'] } : null,
        order.orderNumber && !order.invoicedAt ? { key: 'missingFactura', categories: ['factura'] } : null,
      ].filter(Boolean) as Target[])
    : []
  const target = targets.find((x) => x.key === targetKey) ?? targets[0] ?? null
  const activeCategory = category && target?.categories.includes(category) ? category : (target?.categories[0] ?? null)

  // One call: likely matches plus every candidate with the total read from its PDF.
  const { data: candidates, isFetching: suggesting } = useQuery({
    queryKey: ['email-orders', id, 'suggestions', activeCategory],
    queryFn: async () =>
      (
        await api.get<{ suggestions: Candidate[]; documents: Candidate[] }>(`/email-orders/${id}/suggestions`, {
          params: { category: activeCategory },
        })
      ).data,
    enabled: !!activeCategory && !!id,
  })
  const suggestions = candidates?.suggestions ?? []
  const wantedDoc = searchParams.get('doc')
  const preselected = useRef(false)
  useEffect(() => {
    if (preselected.current || !wantedDoc || !candidates || !activeCategory) return
    const doc = candidates.documents.find((d) => d.name === wantedDoc)
    preselected.current = true
    if (doc) selectDoc(activeCategory, doc.number, doc.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, activeCategory, wantedDoc])
  const docs = candidates?.documents ?? []
  const previewRef = useRef<HTMLElement>(null)

  const categoryLabel: Record<DocCategory, string> = t.docLinks.singular
  const reasonLabel = { order: r.reasonOrder, quote: r.reasonQuote, amount: r.reasonAmount }

  const linkMutation = useMutation({
    mutationFn: (doc: { category: DocCategory; number: string }) =>
      api.patch(`/email-orders/${id}/link`, { category: doc.category, number: doc.number }),
    onSuccess: (_d, doc) => {
      // This page is not a modal, so the toast's undo button is reachable here.
      const field = doc.category === 'albaran' ? 'deliveryNoteAt' : doc.category === 'factura' ? 'invoicedAt' : null
      toast(t.docLinks.linked.replace('{doc}', `${categoryLabel[doc.category]} ${doc.number}`), 'success', {
        label: t.common.undo,
        onClick: async () => {
          await (field
            ? api.patch(`/email-orders/${id}/milestone`, { field, done: false })
            : api.patch(`/email-orders/${id}/quote-status`, { category: 'pending' }))
          queryClient.invalidateQueries({ queryKey: ['email-orders'] })
          toast(t.docLinks.unlinked.replace('{doc}', `${categoryLabel[doc.category]} ${doc.number}`))
        },
      })
      queryClient.invalidateQueries({ queryKey: ['email-orders'] })
      setSelected(null)
      setTargetKey(null)
      setCategory(null)
      setSearch('')
    },
    onError: () => toast(t.common.saveError, 'error'),
  })

  function selectDoc(cat: DocCategory, number: string, name: string) {
    setSelected({ category: cat, number, name })
    // On phones the preview sits under the long list; take the user to it.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
    docPreview.load(
      async () =>
        (await api.get(`/documents/${cat}/file`, { params: { year, number, name, ext: 'pdf' }, responseType: 'blob' })).data,
    )
  }

  if (!order) return null

  const selectedTotal = selected ? (docs.find((d) => d.name === selected.name)?.total ?? null) : null
  const orderTotal = order.totalAmount != null ? Number(order.totalAmount) : null
  const amountsMatch = selectedTotal != null && orderTotal != null && Math.abs(selectedTotal - orderTotal) < 0.01

  const query = search.trim().toLowerCase()
  const list = docs.filter((d) => !query || `${d.number} ${d.title}`.toLowerCase().includes(query))
  const isSelected = (name: string) => selected?.category === activeCategory && selected?.name === name

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8rem)]">
      <PageHeader
        backTo="/papeleo/pedidos"
        backLabel={r.back}
        title={r.title}
        subtitle={
          <span className="font-mono">
            {[order.orderNumber, order.client?.name, order.totalAmount && formatEuro(order.totalAmount, locale)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        }
      />

      {targets.length === 0 ? (
        <p className={`${cardClass} flex items-center gap-2 text-sm text-ink dark:text-cream`}>
          <Check className="h-4 w-4" />
          {r.allLinked}
        </p>
      ) : (
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:overflow-hidden">
          {/* Picker: what is missing, likely matches first, then the full searchable list */}
          <section className={`${cardClass} flex flex-col lg:w-[380px] lg:shrink-0 lg:overflow-hidden`}>
            {targets.length === 1 ? (
              <p className="text-sm font-semibold text-ink dark:text-cream">
                {r.missingOne.replace('{doc}', categoryLabel[targets[0].categories[0]])}
              </p>
            ) : (
            <div role="radiogroup" aria-label={r.missing} className="flex flex-wrap gap-2">
              {targets.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  role="radio"
                  aria-checked={target?.key === x.key}
                  onClick={() => {
                    setTargetKey(x.key)
                    setCategory(null)
                    setSelected(null)
                  }}
                  className={`${filterClass} ${target?.key === x.key ? filterActiveClass : filterIdleClass}`}
                >
                  {r[x.key]}
                </button>
              ))}
            </div>
            )}
            {target && target.categories.length > 1 && (
              <div role="radiogroup" aria-label={r.documentType} className="mt-2 flex flex-wrap gap-1.5">
                {target.categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={activeCategory === c}
                    onClick={() => {
                      setCategory(c)
                      setSelected(null)
                    }}
                    className={`${smallButtonClass} ${activeCategory === c ? 'border-ink text-ink dark:border-yellow dark:text-yellow' : ''}`}
                  >
                    {categoryLabel[c]}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <h2 className={`flex items-center gap-1.5 ${sectionLabelClass}`}>
                <Sparkles className="h-3.5 w-3.5" />
                {r.suggestions}
              </h2>
              {suggesting ? (
                <p className="mt-2 text-sm text-graphite dark:text-graphite-dark">{r.searchingMatches}</p>
              ) : suggestions.length === 0 ? (
                <p className="mt-2 text-sm text-graphite dark:text-graphite-dark">{r.noSuggestions}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {suggestions.map((s) => (
                    <li
                      key={s.name}
                      className={`rounded-xl border p-3 ${
                        isSelected(s.name) ? 'border-yellow bg-yellow/10' : 'border-line dark:border-line-dark'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectDoc(activeCategory!, s.number, s.name)}
                        className="block w-full text-left"
                      >
                        <span className="text-sm text-ink dark:text-cream">
                          <span className="mr-1 font-mono font-semibold text-yellow-ink dark:text-yellow">{s.number}</span>
                          {s.title}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-graphite dark:text-graphite-dark">
                          {s.total != null && <span className="font-mono tabular">{formatEuro(s.total, locale)}</span>}
                          {s.reason && <span>{reasonLabel[s.reason]}</span>}
                        </span>
                      </button>
                      {!isSelected(s.name) && (
                        <button
                          type="button"
                          onClick={() => selectDoc(activeCategory!, s.number, s.name)}
                          className={`${smallButtonClass} mt-2`}
                        >
                          {r.reviewMatch}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <h2 className={`mt-5 ${sectionLabelClass}`}>{r.allDocuments}</h2>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite dark:text-graphite-dark" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.documents.searchPlaceholder}
                  aria-label={t.documents.searchPlaceholder}
                  className={searchInputClass}
                />
              </div>
              {!suggesting && list.length === 0 && <p className="mt-2 text-sm text-graphite dark:text-graphite-dark">{r.noDocuments}</p>}
              <ul className="mt-2 space-y-1">
                {list.map((doc) => (
                  <li key={doc.name}>
                    <button
                      type="button"
                      aria-pressed={isSelected(doc.name)}
                      onClick={() => selectDoc(activeCategory!, doc.number, doc.name)}
                      className={`min-h-11 w-full rounded-lg px-2.5 py-2.5 text-left text-sm transition ${
                        isSelected(doc.name)
                          ? 'bg-yellow/15 text-ink dark:text-cream'
                          : 'text-ink hover:bg-ink/5 dark:text-cream dark:hover:bg-cream/10'
                      }`}
                    >
                      <span className="mr-1 font-mono font-semibold text-yellow-ink dark:text-yellow">{doc.number}</span>
                      {doc.title}
                      {doc.total != null && (
                        <span className="mt-0.5 block font-mono text-xs tabular text-graphite dark:text-graphite-dark">
                          {formatEuro(doc.total, locale)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Selected document, to check it before linking */}
          <section ref={previewRef} className={`${cardClass} flex min-h-80 scroll-mt-4 flex-col lg:flex-1 lg:overflow-hidden`}>
            <h2 className={sectionLabelClass}>{selected ? `${categoryLabel[selected.category]} ${selected.number}` : r.preview}</h2>
            {selectedTotal != null && orderTotal != null && (
              <p
                className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  amountsMatch
                    ? 'bg-yellow/15 text-ink dark:text-yellow'
                    : 'bg-rust/10 text-rust dark:bg-rust-dark/15 dark:text-rust-dark'
                }`}
              >
                {amountsMatch
                  ? r.amountMatches.replace('{doc}', formatEuro(selectedTotal, locale))
                  : r.amountDiffers.replace('{doc}', formatEuro(selectedTotal, locale)).replace('{order}', formatEuro(orderTotal, locale))}
              </p>
            )}
            {!selected ? (
              <p className="mt-2 text-sm text-graphite dark:text-graphite-dark">{r.selectDocument}</p>
            ) : (
              <>
                <div className="mt-2 h-96 overflow-hidden rounded-xl border border-line lg:h-auto lg:flex-1 dark:border-line-dark">
                  {docPreview.url && <iframe title={r.preview} src={docPreview.url} className="h-full w-full" />}
                </div>
                <button
                  type="button"
                  disabled={linkMutation.isPending}
                  onClick={async () => {
                    if (!amountsMatch && selectedTotal != null && orderTotal != null) {
                      const ok = await confirm({ message: r.confirmMismatch, confirmLabel: r.linkButton })
                      if (!ok) return
                    }
                    linkMutation.mutate(selected)
                  }}
                  className={`${primaryButtonClass} mt-3`}
                >
                  {linkMutation.isPending ? r.linking : r.linkButton}
                </button>
              </>
            )}
          </section>

          {/* The order itself, for comparison */}
          <section className={`${cardClass} flex min-h-80 flex-col lg:flex-1 lg:overflow-hidden`}>
            <h2 className={sectionLabelClass}>{r.orderPreview}</h2>
            <div className="mt-2 h-96 overflow-hidden rounded-xl border border-line lg:h-auto lg:flex-1 dark:border-line-dark">
              {orderPreview.url && <iframe title={r.orderPreview} src={orderPreview.url} className="h-full w-full" />}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
