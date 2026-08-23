import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/axios'
import { tokenStorage } from '../lib/token-storage'
import { useLanguage } from '../contexts/LanguageContext'
import { Logo } from '../components/Logo'
import { SettingsMenu } from '../components/SettingsMenu'

const inputClass =
  'mt-1.5 h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

export function AcceptInvitePage() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const {
    data: invite,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['invitation', token],
    queryFn: async () => (await api.get<{ email: string; roleName: string }>(`/invitations/${token}`)).data,
    enabled: !!token,
    retry: false,
  })

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(t.acceptInvite.passwordMismatch)
      return
    }

    setIsSubmitting(true)
    try {
      const { data } = await api.post(`/invitations/${token}/accept`, { fullName, password })
      tokenStorage.setTokens(data.accessToken, data.refreshToken)
      window.location.href = '/'
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t.acceptInvite.invalid)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-paper px-4 dark:bg-paper-dark">
      <div className="absolute top-4 right-4">
        <SettingsMenu />
      </div>

      <div className="w-full max-w-sm">
        <div className="animate-fade-up mb-8 flex flex-col items-center text-center">
          <Logo className="mb-4 h-28 w-28 text-ink dark:text-cream" />
          <h1 className="font-display text-3xl font-semibold tracking-wide text-ink dark:text-cream">J.A. Caero</h1>
        </div>

        {!token || isError ? (
          <p
            style={{ animationDelay: '80ms' }}
            className="animate-fade-up rounded-2xl border border-line bg-surface p-6 text-center text-sm text-graphite shadow-sm dark:border-line-dark dark:bg-surface-dark dark:text-graphite-dark"
          >
            {t.acceptInvite.invalid}
          </p>
        ) : isLoading ? null : (
          <form
            onSubmit={handleSubmit}
            style={{ animationDelay: '80ms' }}
            className="animate-fade-up space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm dark:border-line-dark dark:bg-surface-dark"
          >
            <p className="text-sm text-graphite dark:text-graphite-dark">
              {t.acceptInvite.invitedAs} <strong className="text-ink dark:text-cream">{invite?.roleName}</strong> (
              {invite?.email})
            </p>

            <div>
              <label htmlFor="fullName" className="text-sm font-medium text-ink dark:text-cream">
                {t.acceptInvite.fullName}
              </label>
              <input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-ink dark:text-cream">
                {t.acceptInvite.password}
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="text-sm font-medium text-ink dark:text-cream">
                {t.acceptInvite.confirmPassword}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-rust dark:text-rust-dark">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl bg-ink text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90"
            >
              {isSubmitting ? t.acceptInvite.submitting : t.acceptInvite.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
