const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function startOfLocalDay(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

/**
 * Compact due-date label, max 5 chars. Returns '' for missing/invalid.
 *
 *   past  → "late"
 *   today → "today"
 *   +1d   → "tmrw"
 *   +2-6d → "Nd"
 *   +7-13 → day-of-week ("sun"..."sat")
 *   ≥14d  → "M/D"
 */
export function formatDue(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const due = new Date(iso)
  if (isNaN(due.getTime())) return ''

  const dayDiff = Math.round(
    (startOfLocalDay(due).getTime() - startOfLocalDay(now).getTime()) / 86400000
  )

  if (dayDiff < 0) return 'late'
  if (dayDiff === 0) return 'today'
  if (dayDiff === 1) return 'tmrw'
  if (dayDiff < 7) return `${dayDiff}d`
  if (dayDiff < 14) return DAY_NAMES[due.getDay()]
  return `${due.getMonth() + 1}/${due.getDate()}`
}
