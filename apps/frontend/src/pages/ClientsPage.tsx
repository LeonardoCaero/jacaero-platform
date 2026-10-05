import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'
import {
  Modal,
  PageHeader,
  inputClass,
  labelClass,
  listCardClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { Skeleton } from '../components/Skeleton'

type Client = {
  id: string
  name: string
  taxId: string | null
  email: string | null
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE'
  _count: { contracts: number }
}

export function ClientsPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const { data: clients = [], isLoading } = useQuery({
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
      <PageHeader
        backTo="/"
        backLabel={t.comingSoon.back}
        title={t.modules.clients.label}
        subtitle={t.modules.clients.description}
        actions={
          <button type="button" onClick={() => setShowForm(true)} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            {t.clients.newClient}
          </button>
        }
      />

      <ul className="mt-5 space-y-2">
        {isLoading &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className={listCardClass}>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-28" />
            </li>
          ))}
        {!isLoading && clients.length === 0 && (
          <li className="text-sm text-graphite dark:text-graphite-dark">{t.clients.noClients}</li>
        )}
        {clients.map((client) => (
          <li key={client.id}>
            <Link
              to={`/clients/${client.id}`}
              className={`${listCardClass} flex items-center justify-between gap-3 transition hover:border-yellow dark:hover:border-yellow/60`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink dark:text-cream">{client.name}</p>
                <p className="truncate text-sm text-graphite dark:text-graphite-dark">
                  {[client.taxId, `${client._count.contracts} ${t.clients.contracts.toLowerCase()}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {client.status !== 'ACTIVE' && (
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-graphite dark:border-line-dark dark:text-graphite-dark">
                    {t.team.inactive}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-graphite dark:text-graphite-dark" />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Modal open={showForm} onClose={resetForm} title={t.clients.newClient} closeLabel={t.common.close} size="sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className={labelClass}>
            {t.clients.name}
            <input required value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className={labelClass}>
            {t.clients.taxId}
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className={labelClass}>
            {t.team.email}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className={labelClass}>
            {t.clients.phone}
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          {formError && <p className="text-sm text-rust dark:text-rust-dark">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={resetForm} className={secondaryButtonClass}>
              {t.team.cancel}
            </button>
            <button type="submit" disabled={createMutation.isPending} className={primaryButtonClass}>
              {t.clients.newClient}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
