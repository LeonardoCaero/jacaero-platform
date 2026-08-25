import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, Download, Search } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'
import type { translations } from '../lib/translations'
import { Skeleton } from '../components/Skeleton'

type DocCategory = 'presupuesto' | 'albaran' | 'factura' | 'pedidoMaterial' | 'horasTrabajo'
type PapeleoKey = keyof (typeof translations)['en']['papeleo']

type DocFile = {
  number: string
  title: string
  hasPdf: boolean
  hasDocx: boolean
}

const cardClass =
  'flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm dark:border-line-dark dark:bg-surface-dark'

const currentYear = new Date().getFullYear()
const years = [currentYear, currentYear - 1]

function FileCardSkeleton({ delay }: { delay: number }) {
  return (
    <div className={`${cardClass} animate-fade-up`} style={{ animationDelay: `${delay}ms` }}>
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-4 w-4 shrink-0 rounded" />
    </div>
  )
}

export function DocumentsPage({ category, titleKey }: { category: DocCategory; titleKey: PapeleoKey }) {
  const { t } = useLanguage()
  const [year, setYear] = useState(currentYear)
  const [search, setSearch] = useState('')

  const { data: files = [], isLoading, isError } = useQuery({
    queryKey: ['documents', category, year],
    queryFn: async () => (await api.get<DocFile[]>(`/documents/${category}`, { params: { year } })).data,
  })

  const query = search.trim().toLowerCase()
  const filteredFiles = query
    ? files.filter((f) => `${f.number} ${f.title}`.toLowerCase().includes(query))
    : files

  async function openFile(number: string, ext: 'pdf' | 'docx') {
    const { data } = await api.get(`/documents/${category}/file`, {
      params: { year, number, ext },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(data)
    window.open(url, '_blank')
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          to="/papeleo"
          className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.documents.back}
        </Link>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-9 rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-yellow dark:border-line-dark dark:bg-paper-dark dark:text-cream"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <h1 className="mt-4 font-display text-2xl font-semibold tracking-wide text-ink dark:text-cream">
        {t.papeleo[titleKey].label}
      </h1>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite dark:text-graphite-dark" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.documents.searchPlaceholder}
          className="h-10 w-full rounded-xl border border-line bg-paper pl-9 pr-3 text-sm text-ink outline-none focus:border-yellow dark:border-line-dark dark:bg-paper-dark dark:text-cream"
        />
      </div>

      {isLoading && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <FileCardSkeleton key={i} delay={i * 50} />
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {!isLoading &&
          filteredFiles.map((f) => (
            <div key={f.number} className={cardClass}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink dark:text-cream">
                  {f.number} · {f.title}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {f.hasPdf && (
                  <button
                    type="button"
                    title={t.documents.viewPdf}
                    onClick={() => openFile(f.number, 'pdf')}
                    className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                {f.hasDocx && (
                  <button
                    type="button"
                    title={t.documents.downloadWord}
                    onClick={() => openFile(f.number, 'docx')}
                    className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      {isError && <p className="mt-6 text-center text-sm text-rust dark:text-rust-dark">{t.documents.unreachable}</p>}
      {!isLoading && !isError && files.length === 0 && (
        <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">{t.documents.empty}</p>
      )}
      {!isLoading && !isError && files.length > 0 && filteredFiles.length === 0 && (
        <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">{t.documents.noResults}</p>
      )}
    </div>
  )
}
