import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { modules } from '../lib/modules'

const today = new Date().toLocaleDateString('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function HomePage() {
  const { user, hasPermission } = useAuth()
  const visibleModules = modules.filter((m) => hasPermission(m.permission))
  const primary = visibleModules.find((m) => m.primary)
  const secondary = visibleModules.filter((m) => !m.primary)

  return (
    <div>
      <p className="font-mono text-xs tracking-widest text-graphite uppercase dark:text-graphite-dark">
        {today}
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink dark:text-cream">
        Welcome, {user?.fullName?.split(' ')[0]}
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {primary && (
          <Link
            to={primary.path}
            className="ticket-stub col-span-2 flex h-[140px] flex-col justify-between overflow-hidden rounded-md bg-ink p-5 text-cream transition hover:bg-ink/90 dark:bg-cream dark:text-ink dark:hover:bg-cream/90"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-yellow">
              <primary.icon className="h-5 w-5 text-ink" />
            </span>
            <div>
              <p className="font-display text-xl font-semibold tracking-tight">{primary.label}</p>
              <p className="font-mono text-xs text-cream/60 dark:text-ink/60">{primary.description}</p>
            </div>
          </Link>
        )}

        {secondary.map((m) => (
          <Link
            key={m.path}
            to={m.path}
            className="tile-corners flex min-h-[110px] flex-col justify-between rounded-md border border-line bg-paper p-4 transition hover:border-yellow dark:border-line-dark dark:bg-paper-dark"
          >
            <m.icon className="h-5 w-5 text-graphite dark:text-graphite-dark" />
            <div>
              <p className="font-display text-base font-semibold tracking-tight text-ink dark:text-cream">
                {m.label}
              </p>
              <p className="font-mono text-[11px] text-graphite dark:text-graphite-dark">{m.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
