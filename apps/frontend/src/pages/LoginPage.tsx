import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.svg'

export function LoginPage() {
  const { user, login } = useAuth()
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
      setError('Invalid email or password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4 dark:bg-paper-dark">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-cream ring-1 ring-yellow">
            <img src={logo} alt="" className="h-9 w-9" />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-wide text-ink uppercase dark:text-cream">
            J.A. Caero
          </h1>
          <p className="mt-1 font-mono text-xs tracking-wide text-graphite uppercase dark:text-graphite-dark">
            Sign in to your account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-md border border-line bg-paper p-6 dark:border-line-dark dark:bg-paper-dark"
        >
          <div>
            <label
              htmlFor="email"
              className="font-mono text-xs tracking-wide text-graphite uppercase dark:text-graphite-dark"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink outline-none focus:border-yellow dark:border-line-dark dark:bg-paper-dark dark:text-cream"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="font-mono text-xs tracking-wide text-graphite uppercase dark:text-graphite-dark"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink outline-none focus:border-yellow dark:border-line-dark dark:bg-paper-dark dark:text-cream"
            />
          </div>

          {error && <p className="font-mono text-xs text-rust dark:text-rust-dark">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-md bg-ink font-display text-sm font-semibold tracking-wide text-cream uppercase transition hover:bg-ink/90 disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
