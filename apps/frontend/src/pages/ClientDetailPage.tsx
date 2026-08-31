import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2, UserCheck, UserX } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'

type Location = { id: string; name: string; address: string | null; city: string | null; postalCode: string | null }
type Contact = { id: string; fullName: string; email: string; phone: string | null; jobTitle: string | null }
type Contract = {
  id: string
  label: string
  startDate: string
  endDate: string
  status: 'ACTIVE' | 'EXPIRED'
  hourlyRate: number | null
  overtimeRate: number | null
}
type ClientDetail = {
  id: string
  name: string
  taxId: string | null
  email: string | null
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE'
  locations: Location[]
  contacts: Contact[]
  contracts: Contract[]
}

const inputClass =
  'h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

const cardClass =
  'rounded-2xl border border-line bg-surface p-5 shadow-sm dark:border-line-dark dark:bg-surface-dark'

const primaryButtonClass =
  'h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90'

const secondaryButtonClass =
  'h-10 rounded-xl border border-line px-4 text-sm font-semibold text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'

function toDateInput(iso: string) {
  return iso.slice(0, 10)
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const { data: client } = useQuery({
    queryKey: ['clients', id],
    queryFn: async () => (await api.get<ClientDetail>(`/clients/${id}`)).data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['clients', id] })

  const [editingClient, setEditingClient] = useState(false)
  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  function startEditClient() {
    if (!client) return
    setName(client.name)
    setTaxId(client.taxId ?? '')
    setEmail(client.email ?? '')
    setPhone(client.phone ?? '')
    setEditingClient(true)
  }

  const updateClientMutation = useMutation({
    mutationFn: () =>
      api.patch(`/clients/${id}`, {
        name,
        taxId: taxId.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate()
      setEditingClient(false)
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: () => api.patch(`/clients/${id}`, { status: client?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
    onSuccess: invalidate,
  })

  if (!client) return null

  return (
    <div>
      <Link
        to="/clients"
        className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.clients.back}
      </Link>

      {editingClient ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            updateClientMutation.mutate()
          }}
          className={`${cardClass} mt-4 space-y-3`}
        >
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
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
          <div className="flex gap-2">
            <button type="submit" disabled={updateClientMutation.isPending} className={`flex-1 ${primaryButtonClass}`}>
              {t.team.save}
            </button>
            <button type="button" onClick={() => setEditingClient(false)} className={secondaryButtonClass}>
              {t.team.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-wide text-ink dark:text-cream">
              {client.name}
            </h1>
            <p className="text-sm text-graphite dark:text-graphite-dark">
              {[client.taxId, client.email, client.phone].filter(Boolean).join(' · ') || '—'}
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
            <button
              type="button"
              title={t.team.edit}
              onClick={startEditClient}
              className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={client.status === 'ACTIVE' ? t.team.deactivate : t.team.activate}
              disabled={toggleStatusMutation.isPending}
              onClick={() => toggleStatusMutation.mutate()}
              className="text-graphite hover:text-ink disabled:opacity-50 dark:text-graphite-dark dark:hover:text-cream"
            >
              {client.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        <ContractsSection clientId={client.id} contracts={client.contracts} onChange={invalidate} />
        <LocationsSection clientId={client.id} locations={client.locations} onChange={invalidate} />
        <ContactsSection clientId={client.id} contacts={client.contacts} onChange={invalidate} />
      </div>
    </div>
  )
}

function SectionHeader({ label, showForm, onToggle, addLabel }: { label: string; showForm: boolean; onToggle: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-ink dark:text-cream">{label}</h2>
      <button
        type="button"
        onClick={onToggle}
        className="text-sm font-semibold text-yellow hover:underline"
      >
        {showForm ? '×' : '+'} {addLabel}
      </button>
    </div>
  )
}

function LocationsSection({
  clientId,
  locations,
  onChange,
}: {
  clientId: string
  locations: Location[]
  onChange: () => void
}) {
  const { t } = useLanguage()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')

  function reset() {
    setShowForm(false)
    setName('')
    setAddress('')
    setCity('')
    setPostalCode('')
  }

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/clients/${clientId}/locations`, {
        name,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
      }),
    onSuccess: () => {
      onChange()
      reset()
    },
  })

  const removeMutation = useMutation({
    mutationFn: (locationId: string) => api.delete(`/clients/locations/${locationId}`),
    onSuccess: onChange,
  })

  function handleRemove(locationId: string) {
    if (confirm(t.clients.confirmDeleteLocation)) removeMutation.mutate(locationId)
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editPostalCode, setEditPostalCode] = useState('')

  function startEdit(loc: Location) {
    setEditingId(loc.id)
    setEditName(loc.name)
    setEditAddress(loc.address ?? '')
    setEditCity(loc.city ?? '')
    setEditPostalCode(loc.postalCode ?? '')
  }

  const updateMutation = useMutation({
    mutationFn: (locationId: string) =>
      api.patch(`/clients/locations/${locationId}`, {
        name: editName,
        address: editAddress.trim() || undefined,
        city: editCity.trim() || undefined,
        postalCode: editPostalCode.trim() || undefined,
      }),
    onSuccess: () => {
      onChange()
      setEditingId(null)
    },
  })

  return (
    <div className={`${cardClass} space-y-3`}>
      <SectionHeader
        label={t.clients.locations}
        showForm={showForm}
        onToggle={() => (showForm ? reset() : setShowForm(true))}
        addLabel={t.clients.addLocation}
      />

      {showForm && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            addMutation.mutate()
          }}
          className="space-y-2"
        >
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.clients.locationName}
            className={inputClass}
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t.clients.address}
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t.clients.city}
              className={inputClass}
            />
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder={t.clients.postalCode}
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={addMutation.isPending} className={primaryButtonClass}>
            {t.clients.addLocation}
          </button>
        </form>
      )}

      {locations.length === 0 && !showForm && (
        <p className="text-sm text-graphite dark:text-graphite-dark">{t.clients.noLocations}</p>
      )}
      <div className="space-y-2">
        {locations.map((loc) =>
          editingId === loc.id ? (
            <form
              key={loc.id}
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                updateMutation.mutate(loc.id)
              }}
              className="space-y-2 rounded-xl border border-line p-3 dark:border-line-dark"
            >
              <input required value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
              <input
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder={t.clients.address}
                className={inputClass}
              />
              <div className="flex gap-2">
                <input
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder={t.clients.city}
                  className={inputClass}
                />
                <input
                  value={editPostalCode}
                  onChange={(e) => setEditPostalCode(e.target.value)}
                  placeholder={t.clients.postalCode}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={updateMutation.isPending} className={`flex-1 ${primaryButtonClass}`}>
                  {t.team.save}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className={secondaryButtonClass}>
                  {t.team.cancel}
                </button>
              </div>
            </form>
          ) : (
            <div key={loc.id} className="flex items-center justify-between">
              <p className="min-w-0 truncate text-sm text-ink dark:text-cream">
                {loc.name}
                {loc.city && <span className="text-graphite dark:text-graphite-dark"> · {loc.city}</span>}
              </p>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(loc)}
                  className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(loc.id)}
                  className="text-graphite hover:text-rust dark:text-graphite-dark dark:hover:text-rust-dark"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  )
}

function ContactsSection({
  clientId,
  contacts,
  onChange,
}: {
  clientId: string
  contacts: Contact[]
  onChange: () => void
}) {
  const { t } = useLanguage()
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  function reset() {
    setShowForm(false)
    setFullName('')
    setEmail('')
    setPhone('')
    setJobTitle('')
  }

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/clients/${clientId}/contacts`, {
        fullName,
        email,
        phone: phone.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
      }),
    onSuccess: () => {
      onChange()
      reset()
    },
  })

  const removeMutation = useMutation({
    mutationFn: (contactId: string) => api.delete(`/clients/contacts/${contactId}`),
    onSuccess: onChange,
  })

  function handleRemove(contactId: string) {
    if (confirm(t.clients.confirmDeleteContact)) removeMutation.mutate(contactId)
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editJobTitle, setEditJobTitle] = useState('')

  function startEdit(c: Contact) {
    setEditingId(c.id)
    setEditFullName(c.fullName)
    setEditEmail(c.email)
    setEditPhone(c.phone ?? '')
    setEditJobTitle(c.jobTitle ?? '')
  }

  const updateMutation = useMutation({
    mutationFn: (contactId: string) =>
      api.patch(`/clients/contacts/${contactId}`, {
        fullName: editFullName,
        email: editEmail,
        phone: editPhone.trim() || undefined,
        jobTitle: editJobTitle.trim() || undefined,
      }),
    onSuccess: () => {
      onChange()
      setEditingId(null)
    },
  })

  return (
    <div className={`${cardClass} space-y-3`}>
      <SectionHeader
        label={t.clients.contacts}
        showForm={showForm}
        onToggle={() => (showForm ? reset() : setShowForm(true))}
        addLabel={t.clients.addContact}
      />

      {showForm && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            addMutation.mutate()
          }}
          className="space-y-2"
        >
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t.clients.contactName}
            className={inputClass}
          />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.team.email}
            className={inputClass}
          />
          <div className="flex gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Tel." className={inputClass} />
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder={t.profile.jobTitle}
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={addMutation.isPending} className={primaryButtonClass}>
            {t.clients.addContact}
          </button>
        </form>
      )}

      {contacts.length === 0 && !showForm && (
        <p className="text-sm text-graphite dark:text-graphite-dark">{t.clients.noContacts}</p>
      )}
      <div className="space-y-2">
        {contacts.map((c) =>
          editingId === c.id ? (
            <form
              key={c.id}
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                updateMutation.mutate(c.id)
              }}
              className="space-y-2 rounded-xl border border-line p-3 dark:border-line-dark"
            >
              <input
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className={inputClass}
              />
              <input
                required
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className={inputClass}
              />
              <div className="flex gap-2">
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Tel."
                  className={inputClass}
                />
                <input
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  placeholder={t.profile.jobTitle}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={updateMutation.isPending} className={`flex-1 ${primaryButtonClass}`}>
                  {t.team.save}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className={secondaryButtonClass}>
                  {t.team.cancel}
                </button>
              </div>
            </form>
          ) : (
            <div key={c.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink dark:text-cream">{c.fullName}</p>
                <p className="truncate text-sm text-graphite dark:text-graphite-dark">
                  {c.email}
                  {c.jobTitle && ` · ${c.jobTitle}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(c.id)}
                  className="text-graphite hover:text-rust dark:text-graphite-dark dark:hover:text-rust-dark"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  )
}

function ContractsSection({
  clientId,
  contracts,
  onChange,
}: {
  clientId: string
  contracts: Contract[]
  onChange: () => void
}) {
  const { t } = useLanguage()
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [overtimeRate, setOvertimeRate] = useState('')

  function reset() {
    setShowForm(false)
    setLabel('')
    setStartDate('')
    setEndDate('')
    setHourlyRate('')
    setOvertimeRate('')
  }

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/clients/${clientId}/contracts`, { label, startDate, endDate, hourlyRate, overtimeRate }),
    onSuccess: () => {
      onChange()
      reset()
    },
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editHourly, setEditHourly] = useState('')
  const [editOvertime, setEditOvertime] = useState('')
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'EXPIRED'>('ACTIVE')

  function startEdit(c: Contract) {
    setEditingId(c.id)
    setEditLabel(c.label)
    setEditStart(toDateInput(c.startDate))
    setEditEnd(toDateInput(c.endDate))
    setEditHourly(c.hourlyRate?.toString() ?? '')
    setEditOvertime(c.overtimeRate?.toString() ?? '')
    setEditStatus(c.status)
  }

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/clients/contracts/${id}`, {
        label: editLabel,
        startDate: editStart,
        endDate: editEnd,
        status: editStatus,
        hourlyRate: editHourly,
        overtimeRate: editOvertime,
      }),
    onSuccess: () => {
      onChange()
      setEditingId(null)
    },
  })

  return (
    <div className={`${cardClass} space-y-3`}>
      <SectionHeader
        label={t.clients.contracts}
        showForm={showForm}
        onToggle={() => (showForm ? reset() : setShowForm(true))}
        addLabel={t.clients.addContract}
      />

      {showForm && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            addMutation.mutate()
          }}
          className="space-y-2"
        >
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.clients.contractLabel}
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
            <input
              required
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder={t.clients.hourlyRate}
              className={inputClass}
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={overtimeRate}
              onChange={(e) => setOvertimeRate(e.target.value)}
              placeholder={t.clients.overtimeRate}
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={addMutation.isPending} className={primaryButtonClass}>
            {t.clients.addContract}
          </button>
        </form>
      )}

      {contracts.length === 0 && !showForm && (
        <p className="text-sm text-graphite dark:text-graphite-dark">{t.clients.noContracts}</p>
      )}
      <div className="space-y-2">
        {contracts.map((c) =>
          editingId === c.id ? (
            <form
              key={c.id}
              onSubmit={(e) => {
                e.preventDefault()
                updateMutation.mutate(c.id)
              }}
              className="space-y-2 rounded-xl border border-line p-3 dark:border-line-dark"
            >
              <input required value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={inputClass} />
              <div className="flex gap-2">
                <input
                  required
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className={inputClass}
                />
                <input
                  required
                  type="date"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={editHourly}
                  onChange={(e) => setEditHourly(e.target.value)}
                  placeholder={t.clients.hourlyRate}
                  className={inputClass}
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={editOvertime}
                  onChange={(e) => setEditOvertime(e.target.value)}
                  placeholder={t.clients.overtimeRate}
                  className={inputClass}
                />
              </div>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'EXPIRED')}
                className={inputClass}
              >
                <option value="ACTIVE">{t.clients.contractActive}</option>
                <option value="EXPIRED">{t.clients.contractExpired}</option>
              </select>
              <div className="flex gap-2">
                <button type="submit" disabled={updateMutation.isPending} className={`flex-1 ${primaryButtonClass}`}>
                  {t.team.save}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className={secondaryButtonClass}>
                  {t.team.cancel}
                </button>
              </div>
            </form>
          ) : (
            <div key={c.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink dark:text-cream">{c.label}</p>
                <p className="truncate text-sm text-graphite dark:text-graphite-dark">
                  {toDateInput(c.startDate)} – {toDateInput(c.endDate)} · {c.hourlyRate}€/h · {c.overtimeRate}€/h extra
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    c.status === 'ACTIVE'
                      ? 'bg-yellow/15 text-ink dark:text-cream'
                      : 'bg-graphite/15 text-graphite dark:text-graphite-dark'
                  }`}
                >
                  {c.status === 'ACTIVE' ? t.clients.contractActive : t.clients.contractExpired}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
