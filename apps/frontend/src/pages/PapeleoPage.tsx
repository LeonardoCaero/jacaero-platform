import { Link } from 'react-router-dom'
import { ArrowLeft, Truck, FileSignature, Clock, Package, Mail, Receipt, type LucideIcon } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

type Tile = {
  key: 'albaran' | 'presupuesto' | 'horas' | 'pedidoMaterial' | 'pedidosCorreo' | 'facturas'
  path: string
  icon: LucideIcon
  primary?: boolean
}

const tiles: Tile[] = [
  { key: 'pedidosCorreo', path: '/papeleo/pedidos', icon: Mail, primary: true },
  { key: 'horas', path: '/papeleo/horas', icon: Clock },
  { key: 'presupuesto', path: '/papeleo/presupuestos', icon: FileSignature },
  { key: 'albaran', path: '/papeleo/albaranes', icon: Truck },
  { key: 'pedidoMaterial', path: '/papeleo/pedidos-material', icon: Package },
  { key: 'facturas', path: '/papeleo/facturas', icon: Receipt },
]

export function PapeleoPage() {
  const { t } = useLanguage()
  const primary = tiles.find((tl) => tl.primary)!
  const secondary = tiles.filter((tl) => !tl.primary)

  return (
    <div>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.comingSoon.back}
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold tracking-wide text-ink dark:text-cream">
        {t.modules.papeleo.label}
      </h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Link
          to={primary.path}
          className="animate-fade-up col-span-2 flex h-36 flex-col justify-between rounded-2xl bg-ink p-5 text-cream shadow-sm transition hover:shadow-md active:scale-[0.98] dark:bg-cream dark:text-ink"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow">
            <primary.icon className="h-5 w-5 text-ink" />
          </span>
          <div>
            <p className="font-display text-xl font-semibold tracking-wide">{t.papeleo[primary.key].label}</p>
            <p className="text-sm opacity-60">{t.papeleo[primary.key].description}</p>
          </div>
        </Link>

        {secondary.map((tl, i) => (
          <Link
            key={tl.path}
            to={tl.path}
            style={{ animationDelay: `${(i + 1) * 60}ms` }}
            className="animate-fade-up flex min-h-[112px] flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-yellow hover:shadow-md active:scale-[0.98] dark:border-line-dark dark:bg-surface-dark"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow/15">
              <tl.icon className="h-4.5 w-4.5 text-ink dark:text-cream" />
            </span>
            <div>
              <p className="font-display text-base font-semibold tracking-wide text-ink dark:text-cream">
                {t.papeleo[tl.key].label}
              </p>
              <p className="text-xs text-graphite dark:text-graphite-dark">{t.papeleo[tl.key].description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
