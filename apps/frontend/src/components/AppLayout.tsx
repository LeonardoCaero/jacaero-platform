import { useEffect, useRef } from 'react'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Logo } from './Logo'
import { SettingsMenu } from './SettingsMenu'
import { Avatar } from './Avatar'
import { api } from '../lib/axios'
import { papeleoSections } from '../lib/modules'

const tabClass = (active: boolean) =>
  `flex min-w-0 items-center justify-center rounded-lg font-semibold transition ${
    active ? 'bg-ink text-cream dark:bg-yellow dark:text-ink' : 'text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream'
  }`

function PapeleoNav() {
  const { t } = useLanguage()
  const location = useLocation()
  const primary = papeleoSections.slice(0, 4)
  const secondary = papeleoSections.slice(4)
  const activeSecondary = secondary.find((s) => location.pathname === s.path)
  const more = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (more.current) more.current.open = false
  }, [location.pathname])

  return (
    <nav aria-label={t.modules.papeleo.label} className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
      <Link
        to="/"
        className="-my-2 inline-flex min-h-10 w-fit shrink-0 items-center gap-1.5 rounded-md py-2 pr-2 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.comingSoon.back}
      </Link>

      {/* Phones: the four pipeline tabs plus "Más" for the rest, one row, no horizontal scroll. */}
      <div className="grid grid-cols-5 gap-1 rounded-xl border border-line bg-surface p-1 lg:hidden dark:border-line-dark dark:bg-surface-dark">
        {primary.map((s) => (
          <NavLink key={s.path} to={s.path} className={({ isActive }) => `${tabClass(isActive)} min-h-12 flex-col gap-0.5 px-1 text-xs`}>
            <s.icon className="h-4 w-4 shrink-0" />
            <span className="max-w-full truncate">{t.papeleo[s.key].tab}</span>
          </NavLink>
        ))}
        <details ref={more} className="relative">
          <summary
            className={`${tabClass(!!activeSecondary)} min-h-12 cursor-pointer list-none flex-col gap-0.5 px-1 text-xs [&::-webkit-details-marker]:hidden`}
          >
            {activeSecondary ? <activeSecondary.icon className="h-4 w-4 shrink-0" /> : <MoreHorizontal className="h-4 w-4 shrink-0" />}
            <span className="max-w-full truncate">{activeSecondary ? t.papeleo[activeSecondary.key].tab : t.common.more}</span>
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-line bg-surface p-1 shadow-lg dark:border-line-dark dark:bg-surface-dark">
            {secondary.map((s) => (
              <NavLink
                key={s.path}
                to={s.path}
                className={({ isActive }) => `${tabClass(isActive)} min-h-11 justify-start gap-2 px-3 text-sm`}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {t.papeleo[s.key].tab}
              </NavLink>
            ))}
          </div>
        </details>
      </div>

      <div className="hidden w-max gap-1 rounded-xl border border-line bg-surface p-1 lg:flex dark:border-line-dark dark:bg-surface-dark">
        {papeleoSections.map((s) => (
          <NavLink key={s.path} to={s.path} className={({ isActive }) => `${tabClass(isActive)} h-8 gap-1.5 px-3 text-sm whitespace-nowrap`}>
            <s.icon className="h-3.5 w-3.5 shrink-0" />
            {t.papeleo[s.key].tab}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const knownVersion = useRef<string | null>(null)

  const inPapeleo = location.pathname.startsWith('/papeleo/')
  const isReconcile = location.pathname.endsWith('/reconcile')
  const isWide = inPapeleo || location.pathname === '/time-tracker' || location.pathname === '/calendar'

  // Reload automatically when a new version has been deployed, checked on each navigation.
  useEffect(() => {
    api
      .get<{ version: string }>('/health')
      .then(({ data }) => {
        if (knownVersion.current === null) {
          knownVersion.current = data.version
        } else if (knownVersion.current !== data.version) {
          window.location.reload()
        }
      })
      .catch(() => {})
  }, [location.pathname])

  return (
    <div className="min-h-dvh bg-paper dark:bg-paper-dark">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3.5 sm:px-6 dark:border-line-dark dark:bg-surface-dark">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-10 w-10 text-ink dark:text-cream" />
          <span className="font-display text-lg font-semibold tracking-wide text-ink dark:text-cream">
            J.A. Caero
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <SettingsMenu />
          <Link to="/profile" className="flex min-h-10 items-center gap-2 rounded-full p-1 transition hover:opacity-80">
            <span className="hidden text-sm text-graphite sm:inline dark:text-graphite-dark">
              {user?.fullName}
            </span>
            <Avatar name={user?.fullName} />
          </Link>
        </div>
      </header>

      <main className={`mx-auto px-4 py-4 sm:px-6 ${isWide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        {inPapeleo && !isReconcile && <PapeleoNav />}
        <div key={location.pathname} className="animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
