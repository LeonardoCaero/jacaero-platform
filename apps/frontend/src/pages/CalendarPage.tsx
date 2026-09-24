import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { ArrowLeft, Building2, ChevronLeft, ChevronRight, Image as ImageIcon, Lock, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { FullPhoto, PendingPhotoThumbnail, PhotoThumbnail } from '../components/Photos'
import { buildMonthGrid, formatDate, isWeekendKey, toDateKey, toMonthKey, weekdayLabels as getWeekdayLabels } from '../lib/dates'

type Person = { id: string; fullName: string }

type CalendarNote = {
  id: string
  title: string
  description: string | null
  date: string
  endDate: string | null
  photos: string[]
  color: string | null
  visibility: 'PERSONAL' | 'COMPANY'
  createdBy: string
  authorName: string
  sharedWith: Person[]
  canEdit: boolean
}

type Audience = 'me' | 'some' | 'all'

// Same categorical palette as the Time Tracker chart.
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7']

const inputClass =
  'h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

const iconButtonClass = 'text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream'

function startKey(n: CalendarNote) {
  return n.date.slice(0, 10)
}

function endKey(n: CalendarNote) {
  return (n.endDate ?? n.date).slice(0, 10)
}

function audienceOf(n: CalendarNote): Audience {
  if (n.visibility === 'COMPANY') return 'all'
  return n.sharedWith.length > 0 ? 'some' : 'me'
}

export function CalendarPage() {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'

  const [month, setMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const monthKey = toMonthKey(month)
  const todayKey = useMemo(() => toDateKey(new Date()), [])
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [audience, setAudience] = useState<Audience>('me')
  const [sharedWith, setSharedWith] = useState<string[]>([])
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([])
  const [previewNote, setPreviewNote] = useState<CalendarNote | null>(null)

  const range = useMemo(() => {
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    return { from: `${monthKey}-01`, to: toDateKey(last) }
  }, [month, monthKey])

  const { data: notes = [] } = useQuery({
    queryKey: ['calendar', range.from],
    queryFn: async () => (await api.get<CalendarNote[]>('/calendar', { params: range })).data,
  })

  const { data: people = [] } = useQuery({
    queryKey: ['calendar-people'],
    queryFn: async () => (await api.get<Person[]>('/calendar/people')).data,
    enabled: formOpen,
  })

  const notesOn = (key: string) => notes.filter((n) => startKey(n) <= key && key <= endKey(n))
  const selectedNotes = selectedDate ? notesOn(selectedDate) : []
  const editingNote = editingId ? (notes.find((n) => n.id === editingId) ?? null) : null

  function resetForm() {
    setFormOpen(false)
    setEditingId(null)
    setTitle('')
    setDescription('')
    setTo('')
    setColor(COLORS[0])
    setAudience('me')
    setSharedWith([])
    setPendingPhotos([])
  }

  function openNew() {
    resetForm()
    setFrom(selectedDate ?? todayKey)
    setFormOpen(true)
  }

  function startEdit(n: CalendarNote) {
    setEditingId(n.id)
    setTitle(n.title)
    setDescription(n.description ?? '')
    setFrom(startKey(n))
    setTo(n.endDate ? endKey(n) : '')
    setColor(n.color ?? COLORS[0])
    setAudience(audienceOf(n))
    setSharedWith(n.sharedWith.map((p) => p.id))
    setPendingPhotos([])
    setFormOpen(true)
  }

  function changeMonth(delta: number) {
    setMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + delta)
      return next
    })
    setSelectedDate(null)
    resetForm()
  }

  function jumpToToday() {
    const now = new Date()
    now.setDate(1)
    setMonth(now)
    setSelectedDate(todayKey)
    resetForm()
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        date: from,
        endDate: to && to !== from ? to : null,
        color,
        visibility: audience === 'all' ? 'COMPANY' : 'PERSONAL',
        sharedWith: audience === 'some' ? sharedWith : [],
      }
      const note = editingId
        ? (await api.patch<CalendarNote>(`/calendar/${editingId}`, payload)).data
        : (await api.post<CalendarNote>('/calendar', payload)).data
      if (pendingPhotos.length > 0) {
        const form = new FormData()
        pendingPhotos.forEach((file) => form.append('photos', file))
        await api.post(`/calendar/${note.id}/photos`, form)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      resetForm()
    },
  })

  const deletePhotoMutation = useMutation({
    mutationFn: ({ noteId, filename }: { noteId: string; filename: string }) =>
      api.delete(`/calendar/${noteId}/photos/${filename}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  })

  function handleDelete(id: string) {
    if (!confirm(t.calendar.confirmDelete)) return
    deleteMutation.mutate(id)
    if (editingId === id) resetForm()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveMutation.mutate()
  }

  const weekdayLabels = useMemo(() => getWeekdayLabels(locale), [locale])

  const audienceOptions: { key: Audience; label: string; icon: typeof Lock }[] = [
    { key: 'me', label: t.calendar.onlyMe, icon: Lock },
    { key: 'some', label: t.calendar.somePeople, icon: Users },
    { key: 'all', label: t.calendar.everyone, icon: Building2 },
  ]

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
        {t.modules.calendar.label}
      </h1>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5 dark:border-line-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-graphite hover:bg-paper hover:text-ink dark:text-graphite-dark dark:hover:bg-paper-dark dark:hover:text-cream"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={jumpToToday} className="group flex flex-col items-center">
            <p className="font-display text-lg font-semibold tracking-wide text-ink capitalize group-hover:opacity-70 dark:text-cream">
              {month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            </p>
            {!(monthKey === toMonthKey(new Date()) && selectedDate === todayKey) && (
              <span className="text-xs font-medium text-graphite group-hover:text-ink dark:text-graphite-dark dark:group-hover:text-cream">
                {t.timeTracker.jumpToday}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-graphite hover:bg-paper hover:text-ink dark:text-graphite-dark dark:hover:bg-paper-dark dark:hover:text-cream"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-graphite capitalize dark:text-graphite-dark">
          {weekdayLabels.map((label) => (
            <div key={label} className="py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {buildMonthGrid(month.getFullYear(), month.getMonth()).map((key, i) => {
            if (!key) return <div key={i} />
            const dayNotes = notesOn(key)
            const isToday = key === todayKey
            const isSelected = key === selectedDate

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedDate(key)
                  resetForm()
                }}
                className={[
                  'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-transparent text-sm transition',
                  isSelected
                    ? 'bg-ink text-cream dark:bg-cream dark:text-ink'
                    : isToday
                      ? 'ring-1 ring-yellow'
                      : 'hover:bg-paper dark:hover:bg-paper-dark',
                ].join(' ')}
              >
                <span
                  className={
                    isSelected
                      ? ''
                      : isWeekendKey(key)
                        ? 'text-graphite/60 dark:text-graphite-dark/60'
                        : 'text-ink dark:text-cream'
                  }
                >
                  {Number(key.slice(8, 10))}
                </span>
                {dayNotes.length > 0 && (
                  <span className="flex gap-0.5">
                    {dayNotes.slice(0, 3).map((n) => (
                      <span key={n.id} className="h-1.5 w-1.5 rounded-full" style={{ background: n.color ?? COLORS[0] }} />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-sm dark:border-line-dark dark:bg-surface-dark">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold tracking-wide text-ink capitalize dark:text-cream">
              {formatDate(selectedDate, locale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {!formOpen && (
              <button
                type="button"
                onClick={openNew}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-semibold text-cream hover:bg-ink/90 dark:bg-cream dark:text-ink dark:hover:bg-cream/90"
              >
                <Plus className="h-4 w-4" />
                {t.calendar.newNote}
              </button>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {selectedNotes.length === 0 && !formOpen && (
              <p className="text-sm text-graphite dark:text-graphite-dark">{t.calendar.dayEmpty}</p>
            )}
            {selectedNotes.map((n) => {
              const AudienceIcon = audienceOptions.find((o) => o.key === audienceOf(n))!.icon
              const multiDay = startKey(n) !== endKey(n)
              return (
                <div
                  key={n.id}
                  className="flex gap-3 rounded-xl border border-line px-3.5 py-2.5 dark:border-line-dark"
                >
                  <span className="w-1 shrink-0 rounded-full" style={{ background: n.color ?? COLORS[0] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink dark:text-cream">{n.title}</p>
                    {multiDay && (
                      <p className="text-xs text-graphite dark:text-graphite-dark">
                        {formatDate(startKey(n), locale, { day: 'numeric', month: 'short' })} –{' '}
                        {formatDate(endKey(n), locale, { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                    {n.description && (
                      <p className="mt-0.5 text-sm whitespace-pre-line text-graphite dark:text-graphite-dark">
                        {n.description}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-xs text-graphite dark:text-graphite-dark">
                      <AudienceIcon className="h-3 w-3" />
                      {n.createdBy !== user?.id && `${t.calendar.by} ${n.authorName}`}
                      {n.sharedWith.length > 0 && ` · ${n.sharedWith.map((p) => p.fullName).join(', ')}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-3">
                    {n.photos.length > 0 && (
                      <button type="button" onClick={() => setPreviewNote(n)} aria-label={t.timeTracker.viewPhotos} className={iconButtonClass}>
                        <ImageIcon className="h-4 w-4" />
                      </button>
                    )}
                    {n.canEdit && (
                      <>
                      <button type="button" onClick={() => startEdit(n)} aria-label={t.calendar.update} className={iconButtonClass}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(n.id)}
                        aria-label={t.calendar.confirmDelete}
                        className="text-graphite hover:text-rust dark:text-graphite-dark dark:hover:text-rust-dark"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {formOpen && (
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.calendar.titlePlaceholder}
                aria-label={t.calendar.title}
                className={inputClass}
              />
              <textarea
                value={description}
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.calendar.description}
                rows={2}
                className={`${inputClass} h-auto py-2.5`}
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-graphite dark:text-graphite-dark">
                  {t.calendar.from}
                  <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 ${inputClass}`} />
                </label>
                <label className="text-xs text-graphite dark:text-graphite-dark">
                  {t.calendar.to}
                  <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 ${inputClass}`} />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {editingNote?.photos.map((filename) => (
                  <PhotoThumbnail
                    key={filename}
                    url={`/calendar/${editingNote.id}/photos/${filename}`}
                    onDelete={() => {
                      if (confirm(t.timeTracker.confirmDeletePhoto)) {
                        deletePhotoMutation.mutate({ noteId: editingNote.id, filename })
                      }
                    }}
                  />
                ))}
                {pendingPhotos.map((file, i) => (
                  <PendingPhotoThumbnail
                    key={i}
                    file={file}
                    onRemove={() => setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
                <label
                  aria-label={t.timeTracker.addPhoto}
                  className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-line text-graphite hover:border-yellow hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream"
                >
                  <ImageIcon className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? [])
                      setPendingPhotos((prev) => [...prev, ...picked])
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>

              <div className="flex items-center gap-2" role="radiogroup" aria-label={t.calendar.color}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full ${color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface dark:ring-cream dark:ring-offset-surface-dark' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>

              <div>
                <p className="text-xs text-graphite dark:text-graphite-dark">{t.calendar.visibility}</p>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {audienceOptions.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAudience(key)}
                      aria-pressed={audience === key}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition ${
                        audience === key
                          ? 'border-yellow bg-yellow/10 text-ink dark:text-cream'
                          : 'border-line text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {audience === 'some' && (
                <div>
                  <p className="text-xs text-graphite dark:text-graphite-dark">{t.calendar.pickPeople}</p>
                  <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2 dark:border-line-dark">
                    {people
                      .filter((p) => p.id !== user?.id)
                      .map((p) => (
                        <label key={p.id} className="flex items-center gap-2 px-1 py-1 text-sm text-ink dark:text-cream">
                          <input
                            type="checkbox"
                            checked={sharedWith.includes(p.id)}
                            onChange={(e) =>
                              setSharedWith((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                            }
                            className="h-4 w-4 rounded border-line accent-yellow dark:border-line-dark"
                          />
                          {p.fullName}
                        </label>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saveMutation.isPending || (audience === 'some' && sharedWith.length === 0)}
                  className="h-11 flex-1 rounded-xl bg-ink text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90"
                >
                  {editingId ? t.calendar.update : t.calendar.save}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-11 rounded-xl border border-line px-5 text-sm font-semibold text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream"
                >
                  {t.calendar.cancel}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {previewNote &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setPreviewNote(null)}>
            <div
              className="w-full max-w-sm rounded-2xl bg-surface p-4 shadow-xl dark:bg-surface-dark"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink dark:text-cream">{previewNote.title}</p>
                <button type="button" onClick={() => setPreviewNote(null)} className={iconButtonClass}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 max-h-[70vh] space-y-3 overflow-y-auto">
                {previewNote.photos.map((filename) => (
                  <FullPhoto key={filename} url={`/calendar/${previewNote.id}/photos/${filename}`} />
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
