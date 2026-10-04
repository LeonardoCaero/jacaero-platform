import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Eye, Link2, Search, ShoppingCart, X } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from './feedback'
import { iconButtonClass, searchInputClass, secondaryButtonClass, sectionLabelClass } from './ui'

export type LinkedDoc = { id: string; category: 'albaran' | 'factura'; year: number; number: string; name: string }
export type DocOrigin = {
  quotes: { id: string; year: number; name: string; number: string }[]
  orders: { id: string; orderNumber: string | null; quoteRef: string | null }[]
}
type QuoteOrder = { id: string; orderNumber: string; albaranNumber?: string | null; facturaNumber?: string | null }
type PickerFile = { number: string; name: string; title: string }

const ROUTE = { presupuesto: 'presupuestos', albaran: 'albaranes', factura: 'facturas' } as const

async function openDocPdf(category: string, year: number, number: string, name?: string) {
  const { data } = await api.get(`/documents/${category}/file`, { params: { year, number, name, ext: 'pdf' }, responseType: 'blob' })
  window.open(URL.createObjectURL(data), '_blank')
}

function DocRow({
  label,
  number,
  hint,
  onView,
  onGo,
  onRemove,
}: {
  label: string
  number: string
  hint?: string
  onView?: () => void
  onGo?: () => void
  onRemove?: () => void
}) {
  const { t } = useLanguage()
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="min-w-0 text-sm text-ink dark:text-cream">
        {label} <span className="font-mono font-semibold text-yellow-ink dark:text-yellow">{number}</span>
        {hint && <span className="ml-1.5 text-xs text-graphite dark:text-graphite-dark">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {onView && (
          <button type="button" onClick={onView} title={t.documents.viewPdf} aria-label={t.documents.viewPdf} className={iconButtonClass}>
            <Eye className="h-4 w-4" />
          </button>
        )}
        {onGo && (
          <button type="button" onClick={onGo} title={t.docLinks.go} aria-label={t.docLinks.go} className={iconButtonClass}>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} title={t.docLinks.remove} aria-label={t.docLinks.remove} className={iconButtonClass}>
            <X className="h-4 w-4" />
          </button>
        )}
      </span>
    </div>
  )
}

export function QuoteLinks({
  quote,
  year,
  orders,
  links,
  onChange,
}: {
  quote: { name: string }
  year: number
  orders: QuoteOrder[]
  links: LinkedDoc[]
  onChange: (links: LinkedDoc[]) => void
}) {
  const { t } = useLanguage()
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const [picking, setPicking] = useState<'albaran' | 'factura' | null>(null)
  const [search, setSearch] = useState('')
  const docLabel = { albaran: t.emailOrders.deliveryNote, factura: t.docLinks.invoice }

  const { data: candidates = [] } = useQuery({
    queryKey: ['documents', picking, year],
    queryFn: async () => (await api.get<PickerFile[]>(`/documents/${picking}`, { params: { year } })).data,
    enabled: !!picking,
  })

  const addMutation = useMutation({
    mutationFn: async (file: PickerFile) =>
      (
        await api.post<{ id: string }>('/documents/links', {
          fromCategory: 'presupuesto',
          fromYear: year,
          fromName: quote.name,
          toCategory: picking,
          toYear: year,
          toNumber: file.number,
          toName: file.name,
        })
      ).data,
    onSuccess: ({ id }, file) => {
      onChange([...links.filter((l) => l.id !== id), { id, category: picking!, year, number: file.number, name: file.name }])
      toast(t.docLinks.linked.replace('{doc}', `${docLabel[picking!]} ${file.number}`))
      setPicking(null)
      setSearch('')
    },
    onError: () => toast(t.common.saveError, 'error'),
  })

  const removeMutation = useMutation({
    mutationFn: (link: LinkedDoc) => api.delete(`/documents/links/${link.id}`),
    onSuccess: (_d, link) => {
      onChange(links.filter((l) => l.id !== link.id))
      toast(t.docLinks.unlinked.replace('{doc}', `${docLabel[link.category]} ${link.number}`))
    },
    onError: () => toast(t.common.saveError, 'error'),
  })

  const go = (category: 'albaran' | 'factura', docYear: number, name?: string, number?: string) =>
    navigate(`/papeleo/${ROUTE[category]}?year=${docYear}&detail=${encodeURIComponent(name ?? number ?? '')}`)

  const fromOrders = orders.flatMap((o) => [
    ...(o.albaranNumber ? [{ key: `${o.id}-a`, category: 'albaran' as const, number: o.albaranNumber, order: o.orderNumber }] : []),
    ...(o.facturaNumber ? [{ key: `${o.id}-f`, category: 'factura' as const, number: o.facturaNumber, order: o.orderNumber }] : []),
  ])
  const query = search.trim().toLowerCase()
  const filtered = candidates
    .filter((c) => !links.some((l) => l.category === picking && l.name === c.name))
    .filter((c) => !query || `${c.number} ${c.title}`.toLowerCase().includes(query))
    .slice(0, 40)

  return (
    <section>
      <h3 className={`mt-5 ${sectionLabelClass}`}>{t.docLinks.title}</h3>
      {fromOrders.length + links.length > 0 ? (
        <div className="mt-2 divide-y divide-line rounded-xl border border-line dark:divide-line-dark dark:border-line-dark">
          {fromOrders.map((d) => (
            <DocRow
              key={d.key}
              label={docLabel[d.category]}
              number={d.number}
              hint={t.docLinks.viaOrder.replace('{order}', d.order)}
              onView={() => openDocPdf(d.category, year, d.number).catch(() => toast(t.documents.unreachable, 'error'))}
              onGo={() => go(d.category, year, undefined, d.number)}
            />
          ))}
          {links.map((l) => (
            <DocRow
              key={l.id}
              label={docLabel[l.category]}
              number={l.number}
              onView={() => openDocPdf(l.category, l.year, l.number, l.name).catch(() => toast(t.documents.unreachable, 'error'))}
              onGo={() => go(l.category, l.year, l.name)}
              onRemove={async () => {
                if (await confirm({ message: t.docLinks.confirmRemove.replace('{doc}', `${docLabel[l.category]} ${l.number}`) }))
                  removeMutation.mutate(l)
              }}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-graphite dark:text-graphite-dark">{t.docLinks.none}</p>
      )}

      {picking ? (
        <div className="mt-3 rounded-xl border border-line p-3 dark:border-line-dark">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink dark:text-cream">
              {t.docLinks.pick.replace('{doc}', docLabel[picking].toLowerCase())}
            </p>
            <button type="button" onClick={() => setPicking(null)} aria-label={t.common.close} className={iconButtonClass}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite dark:text-graphite-dark" />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.documents.searchPlaceholder}
              aria-label={t.documents.searchPlaceholder}
              className={searchInputClass}
            />
          </div>
          <ul className="mt-2 max-h-56 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  disabled={addMutation.isPending}
                  onClick={() => addMutation.mutate(c)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-ink transition hover:bg-ink/5 disabled:opacity-50 dark:text-cream dark:hover:bg-cream/10"
                >
                  <span className="font-mono text-yellow-ink dark:text-yellow">{c.number}</span>
                  <span className="truncate">{c.title}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2 py-2 text-sm text-graphite dark:text-graphite-dark">{t.documents.noResults}</li>}
          </ul>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {(['albaran', 'factura'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setPicking(c)} className={secondaryButtonClass}>
              <Link2 className="h-4 w-4" />
              {t.docLinks.linkTo.replace('{doc}', docLabel[c].toLowerCase())}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export function DocumentOrigin({ origin, onPreviewOrder }: { origin: DocOrigin; onPreviewOrder: (id: string) => void }) {
  const { t } = useLanguage()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  if (origin.quotes.length + origin.orders.length === 0) return null

  return (
    <section>
      <h3 className={`mt-5 ${sectionLabelClass}`}>{t.docLinks.origin}</h3>
      <div className="mt-2 divide-y divide-line rounded-xl border border-line dark:divide-line-dark dark:border-line-dark">
        {origin.quotes.map((q) => (
          <DocRow
            key={q.id}
            label={t.papeleo.presupuesto.tab}
            number={q.number}
            onView={() => openDocPdf('presupuesto', q.year, q.number, q.name).catch(() => toast(t.documents.unreachable, 'error'))}
            onGo={() => navigate(`/papeleo/presupuestos?year=${q.year}&detail=${encodeURIComponent(q.name)}`)}
          />
        ))}
        {origin.orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink dark:text-cream">
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="font-mono font-semibold">{o.orderNumber}</span>
              {o.quoteRef && <span className="text-xs text-graphite dark:text-graphite-dark">{t.emailOrders.quoteRef} {o.quoteRef}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => onPreviewOrder(o.id)} title={t.documents.previewOrder} aria-label={t.documents.previewOrder} className={iconButtonClass}>
                <Eye className="h-4 w-4" />
              </button>
              {o.quoteRef && (
                <button
                  type="button"
                  onClick={() => navigate(`/papeleo/presupuestos?detail=${encodeURIComponent(o.quoteRef!.replace(/\D/g, ''))}`)}
                  title={t.docLinks.go}
                  aria-label={t.docLinks.go}
                  className={iconButtonClass}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
