import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import type { ModuleKey } from '../lib/modules'

export function ComingSoonPage({ moduleKey }: { moduleKey: ModuleKey }) {
  const { t } = useLanguage()

  return (
    <div>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.comingSoon.back}
      </Link>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-10 text-center shadow-sm dark:border-line-dark dark:bg-surface-dark">
        <p className="font-display text-lg font-semibold tracking-wide text-ink dark:text-cream">
          {t.modules[moduleKey].label}
        </p>
        <p className="mt-1 text-sm text-graphite dark:text-graphite-dark">{t.comingSoon.label}</p>
      </div>
    </div>
  )
}
