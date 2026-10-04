import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileText } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'
import { formatEuro } from '../lib/format'
import { listCardClass as cardClass, primaryButtonClass, sectionLabelClass } from '../components/ui'

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

type DocFile = {
  number: string
  name: string
  title: string
  hasPdf: boolean
  hasDocx: boolean
}

type Target = {
  key: 'missingQuote' | 'missingAlbaran' | 'missingFactura'
  categories: DocCategory[]
}

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
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const queryClient = useQueryClient()

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

  const [activeTarget, setActiveTarget] = useState<Target | null>(null)
  const [activeCategory, setActiveCategory] = useState<DocCategory | null>(null)
  const [selected, setSelected] = useState<{ category: DocCategory; number: string; name: string } | null>(null)
  const docPreview = usePdfPreview()

  const year = order
    ? new Date(order.orderDate ?? order.receivedAt).getFullYear()
    : new Date().getFullYear()

  const { data: docs = [] } = useQuery({
    queryKey: ['documents', activeCategory, year],
    queryFn: async () => (await api.get<DocFile[]>(`/documents/${activeCategory}`, { params: { year } })).data,
    enabled: !!activeCategory,
  })

  const linkMutation = useMutation({
    mutationFn: () =>
      api.patch(`/email-orders/${id}/link`, { category: selected!.category, number: selected!.number }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-orders'] })
      setSelected(null)
      setActiveTarget(null)
      setActiveCategory(null)
    },
  })

  if (!order) return null

  const categoryLabel: Record<DocCategory, string> = {
    presupuesto: t.papeleo.presupuesto.label,
    pedidoMaterial: t.papeleo.pedidoMaterial.label,
    horasTrabajo: t.papeleo.horas.label,
    albaran: t.papeleo.albaran.label,
    factura: t.papeleo.facturas.label,
  }

  const targets: Target[] = [
    order.quoteRef && !order.quotedAt
      ? { key: 'missingQuote' as const, categories: ['presupuesto', 'pedidoMaterial', 'horasTrabajo'] as DocCategory[] }
      : null,
    order.orderNumber && !order.deliveryNoteAt
      ? { key: 'missingAlbaran' as const, categories: ['albaran'] as DocCategory[] }
      : null,
    order.orderNumber && !order.invoicedAt
      ? { key: 'missingFactura' as const, categories: ['factura'] as DocCategory[] }
      : null,
  ].filter((t): t is Target => t !== null)

  function selectCategory(target: Target, category: DocCategory) {
    setActiveTarget(target)
    setActiveCategory(category)
    setSelected(null)
  }

  function selectDoc(category: DocCategory, number: string, name: string) {
    setSelected({ category, number, name })
    docPreview.load(
      async () =>
        (await api.get(`/documents/${category}/file`, { params: { year, number, name, ext: 'pdf' }, responseType: 'blob' }))
          .data,
    )
  }

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-12rem)]">
      <Link
        to="/papeleo/pedidos"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.reconcileManual.back}
      </Link>

      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:overflow-hidden">
        {/* Left: order preview, always visible */}
        <div className={`${cardClass} flex w-full flex-col lg:w-2/5 lg:overflow-hidden`}>
          <p className="font-display text-base font-semibold text-ink dark:text-cream">{order.subject}</p>
          <p className="mt-1 text-xs text-graphite dark:text-graphite-dark">
            {[order.client?.name, order.orderNumber, order.totalAmount && formatEuro(order.totalAmount, locale)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-3 h-72 overflow-hidden rounded-xl border border-line dark:border-line-dark lg:h-auto lg:flex-1">
            {orderPreview.url && <iframe title="order-pdf" src={orderPreview.url} className="h-full w-full" />}
          </div>
        </div>

        {/* Middle: document list, grouped by what's missing */}
        <div className={`${cardClass} w-full lg:w-1/4 lg:overflow-y-auto`}>
          {targets.length === 0 && (
            <p className="text-sm text-graphite dark:text-graphite-dark">{t.reconcileManual.allLinked}</p>
          )}
          {targets.map((target) => (
            <div key={target.key} className="mb-4">
              <p className={sectionLabelClass}>
                {t.reconcileManual[target.key]}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {target.categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => selectCategory(target, category)}
                    aria-pressed={activeCategory === category && activeTarget?.key === target.key}
                    className={`h-8 rounded-lg px-2.5 text-xs font-semibold transition ${
                      activeCategory === category && activeTarget?.key === target.key
                        ? 'bg-ink text-cream dark:bg-yellow dark:text-ink'
                        : 'bg-ink/5 text-ink hover:bg-ink/10 dark:bg-cream/10 dark:text-cream dark:hover:bg-cream/15'
                    }`}
                  >
                    {categoryLabel[category]}
                  </button>
                ))}
              </div>
              {activeTarget?.key === target.key && activeCategory && (
                <div className="mt-2 space-y-1">
                  {docs.length === 0 && (
                    <p className="text-xs text-graphite dark:text-graphite-dark">{t.reconcileManual.noDocuments}</p>
                  )}
                  {docs.map((doc) => (
                    <button
                      key={doc.name}
                      type="button"
                      onClick={() => selectDoc(activeCategory, doc.number, doc.name)}
                      aria-pressed={selected?.category === activeCategory && selected?.name === doc.name}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                        selected?.category === activeCategory && selected?.name === doc.name
                          ? 'bg-yellow/20 text-ink dark:text-cream'
                          : 'text-ink hover:bg-ink/5 dark:text-cream dark:hover:bg-cream/10'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        <span className="font-mono text-yellow-ink dark:text-yellow">{doc.number}</span> {doc.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: preview of the selected document */}
        <div className={`${cardClass} flex w-full flex-col lg:w-2/5 lg:overflow-hidden`}>
          {!selected && (
            <p className="text-sm text-graphite dark:text-graphite-dark">{t.reconcileManual.selectDocument}</p>
          )}
          {selected && (
            <>
              <div className="h-72 overflow-hidden rounded-xl border border-line dark:border-line-dark lg:h-auto lg:flex-1">
                {docPreview.url && <iframe title="doc-pdf" src={docPreview.url} className="h-full w-full" />}
              </div>
              <button
                type="button"
                disabled={linkMutation.isPending}
                onClick={() => linkMutation.mutate()}
                className={`${primaryButtonClass} mt-3`}
              >
                {linkMutation.isPending ? t.reconcileManual.linking : t.reconcileManual.linkButton}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
