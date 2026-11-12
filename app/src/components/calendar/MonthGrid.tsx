import { Icon } from '../Icon'
import { addDays, fullDay, monthShort, startOfMonth, startOfWeek, toISODate } from '../../lib/format'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Simple month grid: a dot on days with events. Tapping a day opens its agenda. */
export function MonthGrid({
  month,
  today,
  eventDays,
  onPick,
  onMonth,
}: {
  /** any day in the month to show */
  month: Date
  today: string
  eventDays: Map<string, number>
  onPick: (isoDate: string) => void
  onMonth: (firstOfMonth: Date) => void
}) {
  const first = startOfMonth(month)
  const prev = startOfMonth(month, -1)
  const next = startOfMonth(month, 1)
  const gridStart = startOfWeek(first)
  const weeks = Math.ceil((first.getDay() + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))

  return (
    <div className="cal-month">
      <div className="cal-month__nav">
        <button className="cal-month__step" onClick={() => onMonth(prev)} aria-label={`Previous month, ${monthShort(prev)}`}>
          <Icon name="back" size={18} />
          {monthShort(prev)}
        </button>
        <button className="cal-month__step" onClick={() => onMonth(next)} aria-label={`Next month, ${monthShort(next)}`}>
          {monthShort(next)}
          <Icon name="chevron" size={18} />
        </button>
      </div>
      <div className="cal-month__grid" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-day__name">
            {w}
          </span>
        ))}
      </div>
      <div className="cal-month__grid">
        {cells.map((d) => {
          const iso = toISODate(d)
          if (d.getMonth() !== first.getMonth()) return <span key={iso} />
          const count = eventDays.get(iso) ?? 0
          const isToday = iso === today
          return (
            <button
              key={iso}
              className={`cal-day cal-day--cell ${isToday ? 'cal-day--today' : ''}`}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${fullDay(d)}${isToday ? ', today' : ''}, ${count === 0 ? 'nothing scheduled' : count === 1 ? '1 event' : `${count} events`}`}
              onClick={() => onPick(iso)}
            >
              <span className="cal-day__num">{d.getDate()}</span>
              <span className={`cal-day__dot ${count ? 'cal-day__dot--on' : ''}`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
