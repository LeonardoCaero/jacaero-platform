import { useEffect, useRef } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Logo } from './Logo'
import { SettingsMenu } from './SettingsMenu'
import { Avatar } from './Avatar'
import { api } from '../lib/axios'

export function AppLayout() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const knownVersion = useRef<string | null>(null)

  const isWide = location.pathname.endsWith('/reconcile')

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
          {import.meta.env.VITE_ENVIRONMENT === 'dev' && (
            <span className="rounded-full bg-rust px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cream dark:bg-rust-dark">
              Dev
            </span>
          )}
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={logout}
            className="hidden px-2 text-sm text-graphite hover:text-ink sm:inline dark:text-graphite-dark dark:hover:text-cream"
          >
            {t.nav.signOut}
          </button>
          <SettingsMenu />
          <Link to="/profile" className="flex items-center gap-2 rounded-full hover:opacity-80">
            <span className="hidden text-sm text-graphite sm:inline dark:text-graphite-dark">
              {user?.fullName}
            </span>
            <Avatar name={user?.fullName} />
          </Link>
        </div>
      </header>

      <main className={`mx-auto px-4 py-4 sm:px-6 ${isWide ? 'max-w-7xl' : 'max-w-3xl'}`}>
        <div key={location.pathname} className="animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
