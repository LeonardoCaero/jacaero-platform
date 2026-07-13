import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { modules } from '../lib/modules'
import { Logo } from '../components/Logo'

export function HomePage() {
  const { user, hasPermission } = useAuth()
  const { t, language } = useLanguage()
  const visibleModules = modules.filter((m) => hasPermission(m.permission))
  const primary = visibleModules.find((m) => m.primary)
  const secondary = visibleModules.filter((m) => !m.primary)

  const today = new Date().toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div>
      <p className="text-sm text-graphite dark:text-graphite-dark">{today}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-wide text-ink dark:text-cream">
        {t.home.welcome}, {user?.fullName?.split(' ')[0]}
      </h1>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {primary && (
          <Link
            to={primary.path}
            className="animate-fade-up relative col-span-2 flex h-36 flex-col justify-between overflow-hidden rounded-2xl bg-ink p-5 text-cream shadow-sm transition hover:shadow-md active:scale-[0.98]"
          >
            <Logo className="pointer-events-none absolute -right-6 -bottom-8 h-40 w-40 opacity-10" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-yellow">
              <primary.icon className="h-5 w-5 text-ink" />
            </span>
            <div className="relative">
              <p className="font-display text-xl font-semibold tracking-wide">{t.modules[primary.key].label}</p>
              <p className="text-sm opacity-60">{t.modules[primary.key].description}</p>
            </div>
          </Link>
        )}

        {secondary.map((m, i) => (
          <Link
            key={m.path}
            to={m.path}
            style={{ animationDelay: `${(i + 1) * 60}ms` }}
            className="animate-fade-up flex min-h-[112px] flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-yellow hover:shadow-md active:scale-[0.98] dark:border-line-dark dark:bg-surface-dark"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow/15">
              <m.icon className="h-4.5 w-4.5 text-ink dark:text-cream" />
            </span>
            <div>
              <p className="font-display text-base font-semibold tracking-wide text-ink dark:text-cream">
                {t.modules[m.key].label}
              </p>
              <p className="text-xs text-graphite dark:text-graphite-dark">{t.modules[m.key].description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
