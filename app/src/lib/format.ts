/**
 * Date helpers. Service dates are local wall-clock strings with no offset
 * ("2026-11-12T10:30:00" or "2026-11-12"), so we build Date objects in the
 * device's local zone and format them back as written.
 */

export function parseLocal(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s)
  if (!m) return new Date(s)
  const [, y, mo, d, h = '0', mi = '0', sec = '0'] = m
  return new Date(+y, +mo - 1, +d, +h, +mi, +sec)
}

const toDate = (d: Date | string) => (typeof d === 'string' ? parseLocal(d) : d)

const f = (opts: Intl.DateTimeFormatOptions) => {
  const fmt = new Intl.DateTimeFormat('en-US', opts)
  return (d: Date | string) => fmt.format(toDate(d))
}

/** "Oct 28" */
export const monthDay = f({ month: 'short', day: 'numeric' })
/** "Oct 28, 2026" */
export const monthDayYear = f({ month: 'short', day: 'numeric', year: 'numeric' })
/** "March 14, 2019" */
export const longDate = f({ month: 'long', day: 'numeric', year: 'numeric' })
/** "Thu, Nov 12" */
export const weekdayMonthDay = f({ weekday: 'short', month: 'short', day: 'numeric' })
/** "Apr 3, 1948" */
export const birthDate = monthDayYear
/** "May 2019" */
export const monthYear = f({ month: 'short', year: 'numeric' })

/** "10:30 AM" */
export function time(d: Date | string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(toDate(d))
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** "Today" / "Tomorrow" / "Yesterday", or null */
export function relativeDay(d: Date | string, now: Date): string | null {
  const diff = Math.round((startOfDay(toDate(d)) - startOfDay(now)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return null
}

export function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** "Sarah and Mike", "Robert, Mike and Emma" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/* ---- calendar ---- */

/** "2026-11-12" for a local date */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/** the Sunday on or before this day */
export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay())
}

/** first day of the month, `offset` months away */
export function startOfMonth(d: Date, offset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1)
}

/** "November 2026" */
export const monthLong = f({ month: 'long', year: 'numeric' })
/** "November" */
export const monthName = f({ month: 'long' })
/** "Nov" */
export const monthShort = f({ month: 'short' })
/** "Thu" */
export const weekdayShort = f({ weekday: 'short' })
/** "Thursday, November 12" */
export const fullDay = f({ weekday: 'long', month: 'long', day: 'numeric' })
