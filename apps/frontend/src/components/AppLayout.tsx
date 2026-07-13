import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Logo } from './Logo'
import { SettingsMenu } from './SettingsMenu'
import { Avatar } from './Avatar'

export function AppLayout() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()

  return (
    <div className="min-h-dvh bg-paper dark:bg-paper-dark">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3.5 sm:px-6 dark:border-line-dark dark:bg-surface-dark">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-10 w-10 text-ink dark:text-cream" />
          <span className="font-display text-lg font-semibold tracking-wide text-ink dark:text-cream">
            J.A. Caero
          </span>
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

      <main className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
