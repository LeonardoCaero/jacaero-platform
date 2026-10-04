import { useLanguage } from '../contexts/LanguageContext'
import type { ModuleKey } from '../lib/modules'
import { PageHeader } from '../components/ui'

export function ComingSoonPage({ moduleKey }: { moduleKey: ModuleKey }) {
  const { t } = useLanguage()

  return (
    <div>
      <PageHeader backTo="/" backLabel={t.comingSoon.back} title={t.modules[moduleKey].label} />

      <div className="mt-5 rounded-2xl border border-line bg-surface p-10 text-center shadow-sm dark:border-line-dark dark:bg-surface-dark">
        <p className="text-sm text-graphite dark:text-graphite-dark">{t.comingSoon.label}</p>
      </div>
    </div>
  )
}
