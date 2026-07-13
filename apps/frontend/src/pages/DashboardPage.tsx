import { useAuth } from '../contexts/AuthContext'

export function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="font-semibold text-neutral-900 dark:text-white">J.A. CAERO</span>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">
          Welcome, {user?.fullName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {user?.role} {user?.jobTitle ? `· ${user.jobTitle}` : ''}
        </p>
      </main>
    </div>
  )
}
