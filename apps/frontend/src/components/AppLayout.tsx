import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.svg'

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-paper dark:bg-paper-dark">
      <header className="flex items-center justify-between border-b border-line bg-paper px-4 py-3 dark:border-line-dark dark:bg-paper-dark">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cream ring-1 ring-yellow">
            <img src={logo} alt="" className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-wide text-ink uppercase dark:text-cream">
            J.A. Caero
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-xs text-graphite sm:inline dark:text-graphite-dark">
            {user?.fullName}
          </span>
          <button
            type="button"
            onClick={logout}
            className="font-mono text-xs tracking-wide text-graphite uppercase hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
