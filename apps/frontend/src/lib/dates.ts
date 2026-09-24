export function isWeekendKey(key: string) {
  return new Date(`${key}T00:00:00Z`).getUTCDay() % 6 === 0
}

export function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function buildMonthGrid(year: number, monthIndex: number) {
  const startOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: (string | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateKey(new Date(year, monthIndex, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function formatDate(key: string, locale: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' })
}

// Monday-first short weekday labels, locale-aware
export function weekdayLabels(locale: string) {
  const base = new Date(Date.UTC(2024, 0, 1)) // a Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    return d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
  })
}
