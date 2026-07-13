import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Logo } from '../components/Logo'
import { SettingsMenu } from '../components/SettingsMenu'

export function LoginPage() {
  const { user, login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError(t.login.invalidCredentials)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-paper px-4 dark:bg-paper-dark">
      <div className="absolute top-4 right-4">
        <SettingsMenu />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-4 h-28 w-28 text-ink dark:text-cream" />
          <h1 className="font-display text-3xl font-semibold tracking-wide text-ink dark:text-cream">
            J.A. Caero
          </h1>
          <p className="mt-1.5 text-sm text-graphite dark:text-graphite-dark">{t.login.subtitle}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm dark:border-line-dark dark:bg-surface-dark"
        >
          <div>
            <label htmlFor="email" className="text-sm font-medium text-ink dark:text-cream">
              {t.login.email}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-ink dark:text-cream">
              {t.login.password}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream"
            />
          </div>

          {error && <p className="text-sm text-rust dark:text-rust-dark">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-ink text-sm font-semibold text-cream transition hover:bg-ink/90 disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90"
          >
            {isSubmitting ? t.login.signingIn : t.login.signIn}
          </button>
        </form>
      </div>
    </div>
  )
}
