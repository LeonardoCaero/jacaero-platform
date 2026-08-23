import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight, PieChart, Pencil, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { api } from '../lib/axios'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'

type TimeEntry = {
  id: string
  date: string
  hours: string
  description: string | null
  isOvertime: boolean
}

type TeamMember = { id: string; fullName: string }

type TeamSummary = {
  byUser: { userId: string; fullName: string; hours: number }[]
  byDay: Record<string, number>
}

const TEAM_VIEW = '__team__'

// dataviz skill default categorical palette — validated (CVD + contrast) against this app's
// light/dark surfaces before use, see conversation. Do not eyeball new colors in here.
const DONUT_COLORS = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#eb6834', dark: '#d95926' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
  { light: '#e87ba4', dark: '#d55181' },
  { light: '#008300', dark: '#008300' },
  { light: '#4a3aa7', dark: '#9085e9' },
  { light: '#e34948', dark: '#e66767' },
]

function isWeekendKey(key: string) {
  return new Date(`${key}T00:00:00Z`).getUTCDay() % 6 === 0
}

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthGrid(year: number, monthIndex: number) {
  const startOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: (string | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateKey(new Date(year, monthIndex, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function formatDate(key: string, locale: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' })
}

const inputClass =
  'h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-base text-ink outline-none focus:border-yellow focus:ring-2 focus:ring-yellow/30 dark:border-line-dark dark:bg-paper-dark dark:text-cream'

const quickButtonClass =
  'rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-graphite transition hover:border-yellow hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream'

export function TimeTrackerPage() {
  const { t, language } = useLanguage()
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const canViewAll = hasPermission('TIME:VIEW_ALL')

  const [month, setMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const monthKey = toMonthKey(month)
  const todayKey = useMemo(() => toDateKey(new Date()), [])
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hours, setHours] = useState('8')
  const [description, setDescription] = useState('')
  const [isOvertime, setIsOvertime] = useState(isWeekendKey(todayKey))
  const [viewUserId, setViewUserId] = useState('')
  const isTeamView = viewUserId === TEAM_VIEW
  const isViewingSelf = !viewUserId || viewUserId === user?.id
  const [showTeamChart, setShowTeamChart] = useState(false)

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<TeamMember[]>('/users')).data,
    enabled: canViewAll,
  })

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['time-entries', monthKey, viewUserId],
    queryFn: async () =>
      (
        await api.get<TimeEntry[]>('/time-entries', {
          params: { month: monthKey, userId: viewUserId || undefined },
        })
      ).data,
    enabled: !isTeamView,
  })

  const { data: teamSummary } = useQuery({
    queryKey: ['time-entries-team-summary', monthKey],
    queryFn: async () => (await api.get<TeamSummary>('/time-entries/team-summary', { params: { month: monthKey } })).data,
    enabled: isTeamView,
  })

  const myTeamHours = teamSummary?.byUser.find((u) => u.userId === user?.id)?.hours ?? 0
  const teamTotalHours = teamSummary?.byUser.reduce((sum, u) => sum + u.hours, 0) ?? 0

  const entriesByDay = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const entry of entries) {
      const key = entry.date.slice(0, 10)
      map.set(key, [...(map.get(key) ?? []), entry])
    }
    return map
  }, [entries])

  const monthTotal = isTeamView ? teamTotalHours : entries.reduce((sum, e) => sum + Number(e.hours), 0)
  const selectedEntries = selectedDate ? (entriesByDay.get(selectedDate) ?? []) : []

  function resetEntryForm(forKey?: string) {
    setEditingId(null)
    setHours('8')
    setDescription('')
    setIsOvertime(forKey ? isWeekendKey(forKey) : false)
  }

  function changeMonth(delta: number) {
    setMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + delta)
      return next
    })
    setSelectedDate(null)
    resetEntryForm()
  }

  function selectDay(key: string) {
    if (isTeamView) return
    setSelectedDate(key)
    resetEntryForm(key)
  }

  function jumpToToday() {
    const now = new Date()
    now.setDate(1)
    setMonth(now)
    setSelectedDate(todayKey)
    resetEntryForm(todayKey)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date: selectedDate,
        hours: Number(hours),
        description: description.trim() || undefined,
        isOvertime,
      }
      if (editingId) return (await api.patch(`/time-entries/${editingId}`, payload)).data
      return (await api.post('/time-entries', payload)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', monthKey] })
      resetEntryForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/time-entries/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries', monthKey] }),
  })

  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id)
    setHours(entry.hours)
    setDescription(entry.description ?? '')
    setIsOvertime(entry.isOvertime)
  }

  function handleDelete(id: string) {
    if (!confirm(t.timeTracker.confirmDelete)) return
    deleteMutation.mutate(id)
    if (editingId === id) resetEntryForm()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveMutation.mutate()
  }

  const weekdayLabels = useMemo(() => {
    // Monday-first short weekday labels, locale-aware
    const base = new Date(Date.UTC(2024, 0, 1)) // a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base)
      d.setUTCDate(base.getUTCDate() + i)
      return d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
    })
  }, [locale])

  return (
    <div>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.comingSoon.back}
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-ink dark:text-cream">
          {t.modules.timeTracker.label}
        </h1>
        <span className="rounded-full bg-yellow/15 px-3 py-1 text-sm font-semibold text-ink dark:text-cream">
          {monthTotal}h
        </span>
      </div>

      {canViewAll && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={viewUserId}
            onChange={(e) => {
              setViewUserId(e.target.value)
              setSelectedDate(null)
              resetEntryForm()
            }}
            className="h-10 rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-yellow dark:border-line-dark dark:bg-paper-dark dark:text-cream"
          >
            <option value="">{t.timeTracker.myself}</option>
            <option value={TEAM_VIEW}>{t.timeTracker.team}</option>
            {teamMembers
              .filter((m) => m.id !== user?.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
          </select>

          {isTeamView && (
            <button
              type="button"
              onClick={() => setShowTeamChart(true)}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-graphite hover:border-yellow hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream"
            >
              <PieChart className="h-4 w-4" />
              {t.timeTracker.viewStats}
            </button>
          )}
        </div>
      )}

      {isTeamView && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-line bg-surface p-3 dark:border-line-dark dark:bg-surface-dark">
            <p className="text-xs text-graphite dark:text-graphite-dark">{t.timeTracker.myHours}</p>
            <p className="mt-0.5 text-xl font-semibold text-ink dark:text-cream">{myTeamHours}h</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 dark:border-line-dark dark:bg-surface-dark">
            <p className="text-xs text-graphite dark:text-graphite-dark">{t.timeTracker.teamTotal}</p>
            <p className="mt-0.5 text-xl font-semibold text-ink dark:text-cream">{teamTotalHours}h</p>
          </div>
        </div>
      )}

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
            const dayEntries = entriesByDay.get(key) ?? []
            const total = isTeamView ? (teamSummary?.byDay[key] ?? 0) : dayEntries.reduce((sum, e) => sum + Number(e.hours), 0)
            const hasOvertime = dayEntries.some((e) => e.isOvertime)
            const isToday = key === todayKey
            const isSelected = key === selectedDate
            const isWeekend = isWeekendKey(key)
            const hasEntries = total > 0

            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(key)}
                className={[
                  'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-sm transition',
                  isSelected
                    ? 'border-transparent bg-ink text-cream dark:bg-cream dark:text-ink'
                    : isToday
                      ? 'border-transparent ring-1 ring-yellow'
                      : 'border-transparent hover:bg-paper dark:hover:bg-paper-dark',
                  !isSelected && hasEntries && 'border-yellow/50 bg-yellow/5 dark:bg-yellow/10',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  className={
                    isSelected
                      ? ''
                      : isWeekend
                        ? 'text-graphite/60 dark:text-graphite-dark/60'
                        : 'text-ink dark:text-cream'
                  }
                >
                  {Number(key.slice(8, 10))}
                </span>
                {hasEntries && (
                  <span
                    className={`text-[10px] font-semibold ${isSelected ? 'opacity-80' : 'text-graphite dark:text-graphite-dark'}`}
                  >
                    {total}h{hasOvertime && '•'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-sm dark:border-line-dark dark:bg-surface-dark">
          <p className="font-display text-lg font-semibold tracking-wide text-ink capitalize dark:text-cream">
            {formatDate(selectedDate, locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          {selectedEntries.length > 0 && (
            <div className="mt-3 space-y-2">
              {selectedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 dark:border-line-dark"
                >
                  <div className="min-w-0">
                    {entry.description && (
                      <p className="truncate text-sm text-ink dark:text-cream">{entry.description}</p>
                    )}
                    {!entry.description && (
                      <p className="text-sm text-graphite dark:text-graphite-dark">—</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-ink dark:text-cream">
                      {Number(entry.hours)}h{entry.isOvertime && ' •'}
                    </span>
                    {isViewingSelf && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          aria-label={t.timeTracker.update}
                          className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          aria-label={t.timeTracker.confirmDelete}
                          className="text-graphite hover:text-rust dark:text-graphite-dark dark:hover:text-rust-dark"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isViewingSelf && (
          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={quickButtonClass} onClick={() => setHours('8')}>
                {t.timeTracker.fullDay}
              </button>
              <button type="button" className={quickButtonClass} onClick={() => setHours('4')}>
                {t.timeTracker.halfDay}
              </button>
            </div>

            <div className="flex gap-3">
              <input
                type="number"
                required
                step="0.5"
                min="0.5"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                aria-label={t.timeTracker.hours}
                className={`w-24 ${inputClass}`}
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.timeTracker.descriptionPlaceholder}
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-graphite dark:text-graphite-dark">
              <input
                type="checkbox"
                checked={isOvertime}
                onChange={(e) => setIsOvertime(e.target.checked)}
                className="h-4 w-4 rounded border-line accent-yellow dark:border-line-dark"
              />
              {t.timeTracker.overtime}
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="h-11 flex-1 rounded-xl bg-ink text-sm font-semibold text-cream transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50 dark:bg-cream dark:text-ink dark:hover:bg-cream/90"
              >
                {editingId ? t.timeTracker.update : t.timeTracker.save}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => resetEntryForm()}
                  className="h-11 rounded-xl border border-line px-5 text-sm font-semibold text-graphite hover:text-ink dark:border-line-dark dark:text-graphite-dark dark:hover:text-cream"
                >
                  {t.timeTracker.cancel}
                </button>
              )}
            </div>
          </form>
          )}
        </div>
      )}

      {!isTeamView && !isLoading && entries.length === 0 && (
        <p className="mt-4 text-center text-sm text-graphite dark:text-graphite-dark">{t.timeTracker.empty}</p>
      )}

      {showTeamChart &&
        createPortal(
          <TeamHoursChart
            summary={teamSummary}
            monthLabel={month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            otherLabel={t.timeTracker.otherPeople}
            onClose={() => setShowTeamChart(false)}
          />,
          document.body,
        )}
    </div>
  )
}

const CHART_SIZE = 200
const CHART_STROKE = 28
const CHART_RADIUS = (CHART_SIZE - CHART_STROKE) / 2
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS
const CHART_GAP = 3
const CHART_MAX_SLICES = 8

function TeamHoursChart({
  summary,
  monthLabel,
  otherLabel,
  onClose,
}: {
  summary?: TeamSummary
  monthLabel: string
  otherLabel: string
  onClose: () => void
}) {
  const users = summary?.byUser ?? []
  const top = users.slice(0, CHART_MAX_SLICES)
  const restHours = users.slice(CHART_MAX_SLICES).reduce((sum, u) => sum + u.hours, 0)
  const raw = restHours > 0 ? [...top, { userId: 'other', fullName: otherLabel, hours: restHours }] : top
  const total = raw.reduce((sum, s) => sum + s.hours, 0)

  let acc = 0
  const segments = raw.map((s, i) => {
    const start = acc
    acc += s.hours
    const color = `var(--series-${s.userId === 'other' ? 'other' : (i % DONUT_COLORS.length) + 1})`
    return { ...s, start, color }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="team-chart w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl dark:bg-surface-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          .team-chart { ${DONUT_COLORS.map((c, i) => `--series-${i + 1}:${c.light};`).join(' ')} --series-other:#9ca3af; }
          .dark .team-chart { ${DONUT_COLORS.map((c, i) => `--series-${i + 1}:${c.dark};`).join(' ')} --series-other:#71717a; }
        `}</style>

        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold tracking-wide text-ink capitalize dark:text-cream">
            {monthLabel}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {segments.length === 0 ? (
          <p className="mt-6 text-center text-sm text-graphite dark:text-graphite-dark">—</p>
        ) : (
          <>
            <div className="mt-4 flex justify-center">
              <svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
                <g transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}>
                  {segments.map((s) => {
                    const length = Math.max((s.hours / total) * CHART_CIRCUMFERENCE - CHART_GAP, 0)
                    const offset = -(s.start / total) * CHART_CIRCUMFERENCE
                    return (
                      <circle
                        key={s.userId}
                        cx={CHART_SIZE / 2}
                        cy={CHART_SIZE / 2}
                        r={CHART_RADIUS}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={CHART_STROKE}
                        strokeDasharray={`${length} ${CHART_CIRCUMFERENCE}`}
                        strokeDashoffset={offset}
                      />
                    )
                  })}
                </g>
                <text
                  x="50%"
                  y="46%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-ink dark:fill-cream"
                  style={{ fontSize: 28, fontWeight: 600 }}
                >
                  {total}h
                </text>
                <text
                  x="50%"
                  y="62%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-graphite dark:fill-graphite-dark"
                  style={{ fontSize: 11 }}
                >
                  total
                </text>
              </svg>
            </div>

            <div className="mt-4 space-y-1.5">
              {segments.map((s) => (
                <div key={s.userId} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink dark:text-cream">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    {s.fullName}
                  </span>
                  <span className="font-semibold text-graphite dark:text-graphite-dark">{s.hours}h</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
