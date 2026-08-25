import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'

type Client = {
  id: string
  name: string
  taxId: string | null
  email: string | null
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE'
  _count: { contracts: number }
}

const inputClass =
  'h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

const cardClass =
  'rounded-2xl border border-line bg-surface p-5 shadow-sm dark:border-line-dark dark:bg-surface-dark'

const primaryButtonClass =
  'h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90'

const secondaryButtonClass =
  'h-11 rounded-xl border border-line px-5 text-sm font-semibold text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'

export function ClientsPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => (await api.get<Client[]>('/clients')).data,
  })

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setShowForm(false)
    setName('')
    setTaxId('')
    setEmail('')
    setPhone('')
    setFormError(null)
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/clients', {
        name,
        taxId: taxId.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      resetForm()
    },
    onError: (err: any) => setFormError(err?.response?.data?.error ?? 'Error'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createMutation.mutate()
  }

  return (
    <div>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.comingSoon.back}
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold tracking-wide text-ink dark:text-cream">
        {t.modules.clients.label}
      </h1>

      <div className="mt-4 space-y-4">
        <button
          type="button"
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className={showForm ? secondaryButtonClass : primaryButtonClass}
        >
          {showForm ? t.team.cancel : t.clients.newClient}
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className={`${cardClass} space-y-3`}>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.clients.name}
              className={inputClass}
            />
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder={t.clients.taxId}
              className={inputClass}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.team.email}
              className={inputClass}
            />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Tel." className={inputClass} />
            {formError && <p className="text-sm text-rust dark:text-rust-dark">{formError}</p>}
            <button type="submit" disabled={createMutation.isPending} className={primaryButtonClass}>
              {t.clients.newClient}
            </button>
          </form>
        )}

        <div className="space-y-2">
          {clients.length === 0 && (
            <p className="text-sm text-graphite dark:text-graphite-dark">{t.clients.noClients}</p>
          )}
          {clients.map((client) => (
            <Link
              key={client.id}
              to={`/clients/${client.id}`}
              className={`${cardClass} flex items-center justify-between hover:border-yellow/60`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink dark:text-cream">{client.name}</p>
                <p className="truncate text-sm text-graphite dark:text-graphite-dark">
                  {client.taxId ?? '—'} · {client._count.contracts} {t.clients.contracts.toLowerCase()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    client.status === 'ACTIVE'
                      ? 'bg-yellow/15 text-ink dark:text-cream'
                      : 'bg-graphite/15 text-graphite dark:text-graphite-dark'
                  }`}
                >
                  {client.status === 'ACTIVE' ? t.team.active : t.team.inactive}
                </span>
                <ChevronRight className="h-4 w-4 text-graphite dark:text-graphite-dark" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
