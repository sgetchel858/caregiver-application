import type { ReactNode } from 'react'
import { Avatar } from '../Avatar'
import { Icon } from '../Icon'
import { callName } from '../../lib/family'
import { monthDay, parseLocal, relativeDay, time, weekdayMonthDay, weekdayShort } from '../../lib/format'
import type { Appointment, FamilyMember, ToBookItem } from '../../services/types'

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: 6 }}>
      <h2 className="eyebrow" style={{ margin: 0 }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

const line = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(' · ')

function dueLabel(dueBy: string, now: Date): string {
  const due = parseLocal(dueBy)
  if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return 'overdue'
  if (due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth()) return 'due this month'
  return `due by ${monthDay(due)}`
}

/**
 * The agenda from `fromDay` on: the day's own events as large cards
 * ("Tomorrow · Thu, Nov 12"), then "Coming up", then "Still to book".
 */
export function AgendaList({
  appointments,
  toBook,
  members,
  now,
  fromDay,
  showFromDay,
  labels,
  emptyFor,
  onOpen,
  onBook,
}: {
  /** already filtered to the person, oldest first */
  appointments: Appointment[]
  toBook: ToBookItem[]
  members: FamilyMember[]
  now: Date
  /** ISO date the agenda starts at */
  fromDay: string
  /** true when the user picked the day: show its group even when it is empty */
  showFromDay: boolean
  /** agent labels by Health API visit id, e.g. "Prep sheet ready" */
  labels: Map<string, string>
  /** who the filter is on, for the empty state; null = everyone */
  emptyFor: string | null
  onOpen: (a: Appointment) => void
  onBook: (t: ToBookItem) => void
}) {
  const memberOf = (id: string) => members.find((m) => m.id === id)
  const upcoming = appointments.filter((a) => a.date >= fromDay)

  // The days that get their own heading: the picked day, or today and tomorrow.
  const featuredDays = showFromDay
    ? [fromDay]
    : [...new Set(upcoming.map((a) => a.date))].filter((d) => {
        const rel = relativeDay(d, now)
        return rel === 'Today' || rel === 'Tomorrow'
      })
  const later = upcoming.filter((a) => !featuredDays.includes(a.date))

  if (!upcoming.length && !toBook.length && !showFromDay) {
    return (
      <div className="cal-empty">
        <p className="cal-empty__title">{emptyFor ? `Nothing scheduled for ${emptyFor}` : 'Nothing on the calendar'}</p>
        <p className="p muted">Visits, refills and things to book will show up here as soon as they're in the records.</p>
      </div>
    )
  }

  return (
    <>
      {featuredDays.map((day) => {
        const items = upcoming.filter((a) => a.date === day)
        const rel = relativeDay(day, now)
        return (
          <Group key={day} title={rel ? `${rel} · ${weekdayMonthDay(day)}` : weekdayMonthDay(day)}>
            {items.length === 0 && (
              <div className="cal-empty cal-empty--slim">
                <p className="p muted">{emptyFor ? `Nothing for ${emptyFor} on this day.` : 'Nothing on this day.'}</p>
              </div>
            )}
            {items.map((a) => {
              const m = memberOf(a.memberId)
              const label = a.healthVisitId ? labels.get(a.healthVisitId) : undefined
              const body = (
                <>
                  {m && <Avatar initials={m.initials} color={m.avatarColor} size={44} />}
                  <span className="cal-card__text">
                    <span className="cal-card__title">{a.title}</span>
                    <span className="cal-card__sub">{line([m && callName(m), a.startsAt && time(a.startsAt), a.place])}</span>
                    {label && <span className="badge cal-card__badge">{label}</span>}
                  </span>
                </>
              )
              return a.kind === 'visit' ? (
                <button key={a.id} className="cal-card cal-card--next" onClick={() => onOpen(a)}>
                  {body}
                  <Icon name="chevron" size={20} color="#535458" />
                </button>
              ) : (
                <div key={a.id} className="cal-card cal-card--next">
                  {body}
                </div>
              )
            })}
          </Group>
        )
      })}

      {later.length > 0 && (
        <Group title="Coming up">
          <div className="cal-list">
            {later.map((a) => {
              const m = memberOf(a.memberId)
              const body = (
                <>
                  {m && <Avatar initials={m.initials} color={m.avatarColor} size={36} />}
                  <span className="cal-row__text">
                    <span className="cal-row__title">{a.title}</span>
                    <span className="cal-row__sub">{line([m && callName(m), a.startsAt && time(a.startsAt), a.place])}</span>
                  </span>
                  <span className="cal-row__date">
                    {weekdayShort(a.date)}
                    <br />
                    {monthDay(a.date)}
                  </span>
                </>
              )
              return a.kind === 'visit' ? (
                <button key={a.id} className="cal-row" onClick={() => onOpen(a)}>
                  {body}
                </button>
              ) : (
                <div key={a.id} className="cal-row">
                  {body}
                </div>
              )
            })}
          </div>
        </Group>
      )}

      {toBook.length > 0 && (
        <Group title="Still to book">
          {toBook.map((t) => {
            const m = memberOf(t.memberId)
            return (
              <div key={t.id} className="cal-book">
                {m && <Avatar initials={m.initials} color={m.avatarColor} size={36} />}
                <span className="cal-row__text">
                  <span className="cal-row__title">{t.title}</span>
                  <span className="cal-row__sub">{line([m && callName(m), dueLabel(t.dueBy, now)])}</span>
                </span>
                <button className="btn btn--primary cal-book__btn" onClick={() => onBook(t)}>
                  Find a time
                </button>
              </div>
            )
          })}
        </Group>
      )}
    </>
  )
}
