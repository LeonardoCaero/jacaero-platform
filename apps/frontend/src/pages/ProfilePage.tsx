import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Avatar } from '../components/Avatar'

export function ProfilePage() {
  const { user, logout } = useAuth()
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

      <div className="mt-6 flex items-center gap-4">
        <Avatar name={user?.fullName} size="lg" />
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-wide text-ink dark:text-cream">
            {user?.fullName}
          </h1>
          <p className="text-sm text-graphite dark:text-graphite-dark">{user?.email}</p>
        </div>
      </div>

      <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface dark:divide-line-dark dark:border-line-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-graphite dark:text-graphite-dark">{t.profile.role}</span>
          <span className="text-sm font-medium text-ink dark:text-cream">{user?.role ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-graphite dark:text-graphite-dark">{t.profile.jobTitle}</span>
          <span className="text-sm font-medium text-ink dark:text-cream">{user?.jobTitle ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-graphite dark:text-graphite-dark">{t.profile.account}</span>
          <span className="text-sm font-medium text-ink dark:text-cream">{user?.email}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={logout}
        className="mt-6 h-11 w-full rounded-xl border border-line text-sm font-semibold text-rust transition hover:bg-rust/5 dark:border-line-dark dark:text-rust-dark dark:hover:bg-rust-dark/10"
      >
        {t.nav.signOut}
      </button>
    </div>
  )
}
