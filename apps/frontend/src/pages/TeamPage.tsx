import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, Pencil, Send, Trash2, X } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'

type User = {
  id: string
  email: string
  fullName: string
  jobTitle: string | null
  status: 'ACTIVE' | 'INACTIVE'
  role: { id: string; name: string } | null
}

type Role = {
  id: string
  name: string
  isSystem: boolean
  userCount: number
  permissions: string[]
}

type Permission = { id: string; key: string }

type Invitation = {
  id: string
  email: string
  expiresAt: string
  role: { name: string }
}

const inputClass =
  'h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

const cardClass =
  'rounded-2xl border border-line bg-surface p-5 shadow-sm dark:border-line-dark dark:bg-surface-dark'

const primaryButtonClass =
  'h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90'

const secondaryButtonClass =
  'h-11 rounded-xl border border-line px-5 text-sm font-semibold text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'

function tabButtonClass(active: boolean) {
  return `rounded-full px-4 py-1.5 text-sm font-semibold transition ${
    active
      ? 'bg-ink text-cream dark:bg-cream dark:text-ink'
      : 'border border-line text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'
  }`
}

export function TeamPage() {
  const { t } = useLanguage()
  const [tab, setTab] = useState<'users' | 'roles'>('users')

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
        {t.modules.team.label}
      </h1>

      <div className="mt-4 flex gap-2">
        <button type="button" className={tabButtonClass(tab === 'users')} onClick={() => setTab('users')}>
          {t.team.usersTab}
        </button>
        <button type="button" className={tabButtonClass(tab === 'roles')} onClick={() => setTab('roles')}>
          {t.team.rolesTab}
        </button>
      </div>

      <div className="mt-4">{tab === 'users' ? <UsersTab /> : <RolesTab />}</div>
    </div>
  )
}

function UsersTab() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
  })
  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => (await api.get<Invitation[]>('/invitations')).data,
  })

  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editRoleId, setEditRoleId] = useState('')
  const [editJobTitle, setEditJobTitle] = useState('')
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [editError, setEditError] = useState<string | null>(null)

  const inviteMutation = useMutation({
    mutationFn: () => api.post('/invitations', { email: inviteEmail, roleId: inviteRoleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
      setShowInviteForm(false)
      setInviteEmail('')
      setInviteRoleId('')
      setInviteError(null)
    },
    onError: (err: any) => setInviteError(err?.response?.data?.error ?? 'Error'),
  })

  const cancelInviteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/invitations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  const resendInviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/invitations/${id}/resend`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  async function handlePreviewInvite(id: string) {
    const { data } = await api.get<{ html: string }>(`/invitations/${id}/preview`)
    setPreviewHtml(data.html)
  }

  const updateUserMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/users/${id}`, {
        roleId: editRoleId || null,
        jobTitle: editJobTitle.trim() || null,
        status: editStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingUserId(null)
      setEditError(null)
    },
    onError: (err: any) => setEditError(err?.response?.data?.error ?? 'Error'),
  })

  function startEditUser(user: User) {
    setEditingUserId(user.id)
    setEditRoleId(user.role?.id ?? '')
    setEditJobTitle(user.jobTitle ?? '')
    setEditStatus(user.status)
    setEditError(null)
  }

  function handleInviteSubmit(e: FormEvent) {
    e.preventDefault()
    inviteMutation.mutate()
  }

  function handleCancelInvite(id: string) {
    if (confirm(t.team.confirmDeleteInvite)) cancelInviteMutation.mutate(id)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setShowInviteForm((v) => !v)}
        className={showInviteForm ? secondaryButtonClass : primaryButtonClass}
      >
        {showInviteForm ? t.team.cancel : t.team.invite}
      </button>

      {showInviteForm && (
        <form onSubmit={handleInviteSubmit} className={`${cardClass} space-y-3`}>
          <input
            type="email"
            required
            placeholder={t.team.email}
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className={inputClass}
          />
          <select
            required
            value={inviteRoleId}
            onChange={(e) => setInviteRoleId(e.target.value)}
            className={inputClass}
          >
            <option value="">{t.team.selectRole}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {inviteError && <p className="text-sm text-rust dark:text-rust-dark">{inviteError}</p>}
          <button type="submit" disabled={inviteMutation.isPending} className={primaryButtonClass}>
            {t.team.invite}
          </button>
        </form>
      )}

      {invitations.length > 0 && (
        <div className={cardClass}>
          <p className="text-sm font-semibold text-ink dark:text-cream">{t.team.pendingInvitations}</p>
          <div className="mt-2 space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between">
                <p className="min-w-0 truncate text-sm text-graphite dark:text-graphite-dark">
                  {inv.email} · {inv.role.name}
                </p>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    title={t.team.previewInvite}
                    onClick={() => handlePreviewInvite(inv.id)}
                    className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={t.team.resendInvite}
                    disabled={resendInviteMutation.isPending}
                    onClick={() => resendInviteMutation.mutate(inv.id)}
                    className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={t.team.cancel}
                    onClick={() => handleCancelInvite(inv.id)}
                    className="text-graphite hover:text-rust dark:text-graphite-dark dark:hover:text-rust-dark"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {users.map((user) => (
          <div key={user.id} className={cardClass}>
            {editingUserId === user.id ? (
              <div className="space-y-3">
                <select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)} className={inputClass}>
                  <option value="">{t.team.noRole}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  placeholder={t.team.jobTitle}
                  className={inputClass}
                />
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className={inputClass}
                >
                  <option value="ACTIVE">{t.team.active}</option>
                  <option value="INACTIVE">{t.team.inactive}</option>
                </select>
                {editError && <p className="text-sm text-rust dark:text-rust-dark">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateUserMutation.mutate(user.id)}
                    disabled={updateUserMutation.isPending}
                    className={`flex-1 ${primaryButtonClass}`}
                  >
                    {t.team.save}
                  </button>
                  <button type="button" onClick={() => setEditingUserId(null)} className={secondaryButtonClass}>
                    {t.team.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink dark:text-cream">{user.fullName}</p>
                  <p className="truncate text-sm text-graphite dark:text-graphite-dark">
                    {user.email} · {user.role?.name ?? t.team.noRole}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      user.status === 'ACTIVE'
                        ? 'bg-yellow/15 text-ink dark:text-cream'
                        : 'bg-graphite/15 text-graphite dark:text-graphite-dark'
                    }`}
                  >
                    {user.status === 'ACTIVE' ? t.team.active : t.team.inactive}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEditUser(user)}
                    className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {previewHtml &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
            onClick={() => setPreviewHtml(null)}
          >
            <div
              className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-xl dark:bg-surface-dark"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewHtml(null)}
                className="absolute right-3 top-3 z-10 rounded-full bg-ink p-1.5 text-cream shadow-sm hover:bg-ink/90 dark:bg-cream dark:text-ink dark:hover:bg-cream/90"
              >
                <X className="h-4 w-4" />
              </button>
              <iframe title="email-preview" srcDoc={previewHtml} className="h-[80vh] w-full bg-white" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function RolesTab() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
  })
  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => (await api.get<Permission[]>('/roles/permissions')).data,
  })

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setName('')
    setSelectedKeys([])
    setFormError(null)
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(role: Role) {
    setEditingId(role.id)
    setShowForm(true)
    setName(role.name)
    setSelectedKeys(role.permissions)
    setFormError(null)
  }

  function togglePermission(key: string) {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name, permissionKeys: selectedKeys }
      if (editingId) return api.patch(`/roles/${editingId}`, payload)
      return api.post('/roles', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      resetForm()
    },
    onError: (err: any) => setFormError(err?.response?.data?.error ?? 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
    onError: (err: any) => alert(err?.response?.data?.error ?? 'Error'),
  })

  function handleDelete(role: Role) {
    if (confirm(t.team.confirmDeleteRole)) deleteMutation.mutate(role.id)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveMutation.mutate()
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => (showForm ? resetForm() : startCreate())}
        className={showForm ? secondaryButtonClass : primaryButtonClass}
      >
        {showForm ? t.team.cancel : t.team.newRole}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className={`${cardClass} space-y-3`}>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.team.roleName}
            className={inputClass}
          />

          <p className="text-sm font-medium text-ink dark:text-cream">{t.team.permissions}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {permissions.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-graphite dark:text-graphite-dark">
                <input
                  type="checkbox"
                  checked={selectedKeys.includes(p.key)}
                  onChange={() => togglePermission(p.key)}
                  className="h-4 w-4 rounded border-line accent-yellow dark:border-line-dark"
                />
                {p.key}
              </label>
            ))}
          </div>

          {formError && <p className="text-sm text-rust dark:text-rust-dark">{formError}</p>}

          <button type="submit" disabled={saveMutation.isPending} className={primaryButtonClass}>
            {editingId ? t.team.updateRole : t.team.createRole}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {roles.map((role) => (
          <div key={role.id} className={`${cardClass} flex items-center justify-between`}>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-ink dark:text-cream">
                {role.name}
                {role.isSystem && (
                  <span className="rounded-full bg-graphite/15 px-2 py-0.5 text-[10px] font-semibold text-graphite dark:text-graphite-dark">
                    {t.team.systemRole}
                  </span>
                )}
              </p>
              <p className="text-sm text-graphite dark:text-graphite-dark">
                {role.permissions.length} · {role.userCount} {t.team.usersCount}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => startEdit(role)}
                className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {!role.isSystem && role.userCount === 0 && (
                <button
                  type="button"
                  onClick={() => handleDelete(role)}
                  className="text-graphite hover:text-rust dark:text-graphite-dark dark:hover:text-rust-dark"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
