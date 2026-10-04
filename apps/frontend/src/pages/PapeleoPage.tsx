import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { papeleoSections } from '../lib/modules'
import { PageHeader } from '../components/ui'
import { Logo } from '../components/Logo'

export function PapeleoPage() {
  const { t } = useLanguage()
  const [primary, ...secondary] = papeleoSections

  return (
    <div>
      <PageHeader backTo="/" backLabel={t.comingSoon.back} title={t.modules.papeleo.label} />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Link
          to={primary.path}
          className="animate-fade-up relative col-span-2 flex h-36 flex-col justify-between overflow-hidden rounded-2xl bg-ink p-5 text-cream shadow-sm transition hover:shadow-md active:scale-[0.98] dark:border dark:border-line-dark"
        >
          <Logo className="pointer-events-none absolute -right-6 -bottom-8 h-40 w-40 opacity-10" />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-yellow">
            <primary.icon className="h-5 w-5 text-ink" />
          </span>
          <div className="relative">
            <p className="font-display text-xl font-semibold tracking-wide">{t.papeleo[primary.key].label}</p>
            <p className="text-sm opacity-70">{t.papeleo[primary.key].description}</p>
          </div>
        </Link>

        {secondary.map((s, i) => (
          <Link
            key={s.path}
            to={s.path}
            style={{ animationDelay: `${(i + 1) * 60}ms` }}
            className="animate-fade-up flex min-h-[112px] flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-yellow hover:shadow-md active:scale-[0.98] dark:border-line-dark dark:bg-surface-dark"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow/15">
              <s.icon className="h-4.5 w-4.5 text-ink dark:text-cream" />
            </span>
            <div>
              <p className="font-display text-base font-semibold tracking-wide text-ink dark:text-cream">
                {t.papeleo[s.key].label}
              </p>
              <p className="text-xs text-graphite dark:text-graphite-dark">{t.papeleo[s.key].description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
