import { addDays, fullDay, toISODate, weekdayShort } from '../../lib/format'

/**
 * Sun–Sat strip. Today is filled, the focused day has a teal ring, and days
 * with events carry a dot. Tapping a day shows the agenda from that day.
 */
export function WeekStrip({
  weekStart,
  today,
  focusDay,
  eventDays,
  onPick,
}: {
  weekStart: Date
  /** ISO date */
  today: string
  focusDay: string | null
  /** ISO date -> number of events */
  eventDays: Map<string, number>
  onPick: (isoDate: string) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  return (
    <div className="cal-week" role="group" aria-label="This week">
      {days.map((d) => {
        const iso = toISODate(d)
        const count = eventDays.get(iso) ?? 0
        const isToday = iso === today
        const focus = iso === focusDay && !isToday
        return (
          <button
            key={iso}
            className={`cal-day ${isToday ? 'cal-day--today' : ''} ${focus ? 'cal-day--focus' : ''}`}
            aria-current={isToday ? 'date' : undefined}
            aria-label={`${fullDay(d)}${isToday ? ', today' : ''}, ${count === 0 ? 'nothing scheduled' : count === 1 ? '1 event' : `${count} events`}`}
            onClick={() => onPick(iso)}
          >
            <span className="cal-day__name">{weekdayShort(d)}</span>
            <span className="cal-day__num">{d.getDate()}</span>
            <span className={`cal-day__dot ${count ? 'cal-day__dot--on' : ''}`} />
          </button>
        )
      })}
    </div>
  )
}
