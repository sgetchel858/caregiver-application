import { useNavigate, useSearchParams } from 'react-router'
import { HomeHeader } from '../components/Header'
import { BottomNav } from '../components/BottomNav'
import { AgentMark } from '../components/Agent'
import { ErrorState, Skeleton } from '../components/Feedback'
import { MemberFilter } from '../components/calendar/MemberFilter'
import { WeekStrip } from '../components/calendar/WeekStrip'
import { MonthGrid } from '../components/calendar/MonthGrid'
import { AgendaList } from '../components/calendar/AgendaList'
import { Rich } from '../lib/rich'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { useUI } from '../lib/ui'
import { callName } from '../lib/family'
import { addDays, monthLong, monthName, parseLocal, startOfMonth, startOfWeek, toISODate } from '../lib/format'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

function CalendarSkeleton({ month }: { month: boolean }) {
  return (
    <div className="stack" style={{ gap: 10 }} role="status" aria-label="Loading the calendar">
      {month ? (
        <Skeleton h={330} />
      ) : (
        <>
          <Skeleton h={78} />
          <Skeleton h={64} />
          <Skeleton h={16} w="45%" />
          <Skeleton h={92} />
          <Skeleton h={16} w="30%" />
          <Skeleton h={116} />
        </>
      )}
    </div>
  )
}

/**
 * The family calendar: health events only (visits, refills, things to book).
 * "Today" comes from the shared clock (the demo clock in mock mode), never
 * straight from the device. The filter, view and picked day live in the URL
 * so coming back from a visit restores them.
 */
export function FamilyCalendar() {
  const { store, health, clock } = useServices()
  const { toast } = useUI()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const now = clock.now()
  const today = toISODate(now)

  const who = params.get('who')
  const view: 'agenda' | 'month' = params.get('view') === 'month' ? 'month' : 'agenda'
  const dayParam = params.get('day')
  const pickedDay = dayParam && ISO_DAY.test(dayParam) && dayParam !== today ? dayParam : null
  const fromDay = pickedDay ?? today
  const monthParam = params.get('month')
  const shownMonth =
    view === 'month' && monthParam && ISO_MONTH.test(monthParam) ? parseLocal(`${monthParam}-01`) : startOfMonth(parseLocal(fromDay))

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  // Covers the month grid, the week strip and the "Coming up" list.
  const rangeFrom = toISODate(startOfWeek(shownMonth))
  const rangeTo = toISODate(addDays(startOfMonth(shownMonth, 3), -1))
  // The agent's summary is always about the current week.
  const thisWeek = startOfWeek(parseLocal(today))

  const base = useAsync(() => Promise.all([store.getCurrentUser(), store.getFamily()]), [])
  const family = base.status === 'success' ? base.data[1] : null
  const user = base.status === 'success' ? base.data[0] : undefined

  const cal = useAsync(async () => {
    if (!family) return null
    const healthIds = family.members.map((m) => m.healthMemberId).filter((id): id is string => !!id)
    const [appointments, toBook, summary] = await Promise.all([
      store.listAppointments(family.id, { from: rangeFrom, to: rangeTo }),
      store.listToBookItems(family.id),
      health.getCalendarSummary(healthIds, { from: toISODate(thisWeek), to: toISODate(addDays(thisWeek, 6)) }),
    ])
    return { appointments, toBook, summary }
  }, [family?.id, rangeFrom, rangeTo, today])

  const member = family?.members.find((m) => m.id === who) ?? null
  const loading = base.status === 'loading' || cal.status === 'loading' || (cal.status === 'success' && !cal.data)
  const error = base.status === 'error' ? base : cal.status === 'error' ? cal : null

  let body = <CalendarSkeleton month={view === 'month'} />
  if (error) {
    body = <ErrorState error={error.error} onRetry={error.reload} title="Couldn't load the calendar" />
  } else if (!loading && family && cal.status === 'success' && cal.data) {
    const { appointments, toBook, summary } = cal.data
    const mine = member ? appointments.filter((a) => a.memberId === member.id) : appointments
    const mineToBook = member ? toBook.filter((t) => t.memberId === member.id) : toBook
    const eventDays = new Map<string, number>()
    for (const a of mine) eventDays.set(a.date, (eventDays.get(a.date) ?? 0) + 1)
    const labels = new Map(summary.visitLabels.map((l) => [l.visitId, l.label]))

    if (view === 'month') {
      const prefix = toISODate(shownMonth).slice(0, 7)
      const inMonth = mine.filter((a) => a.date.startsWith(prefix)).length
      body = (
        <>
          <MonthGrid
            month={shownMonth}
            today={today}
            eventDays={eventDays}
            onPick={(iso) => update({ view: null, month: null, day: iso === today ? null : iso })}
            onMonth={(first) => update({ month: toISODate(first).slice(0, 7) })}
          />
          <p className="p muted small" style={{ textAlign: 'center' }} role="status">
            {inMonth === 0
              ? `Nothing scheduled${member ? ` for ${callName(member)}` : ''} in ${monthName(shownMonth)}.`
              : 'Tap a day to see what’s on.'}
          </p>
        </>
      )
    } else {
      const nextUp = mine.find((a) => a.date >= today)
      const weekStart = startOfWeek(parseLocal(fromDay))
      // the summary is about this week, so it steps aside when another week is showing
      const onThisWeek = toISODate(weekStart) === toISODate(thisWeek)
      body = (
        <>
          <WeekStrip
            weekStart={weekStart}
            today={today}
            focusDay={pickedDay ?? nextUp?.date ?? null}
            eventDays={eventDays}
            onPick={(iso) => update({ day: iso === today ? null : iso })}
          />
          {onThisWeek && (
            <div className="note cal-summary">
              <AgentMark size={24} />
              <p className="p" style={{ fontSize: 14 }}>
                <span className="sr-only">Casanté agent: </span>
                <Rich text={summary.text} />
              </p>
            </div>
          )}
          <AgendaList
            appointments={mine}
            toBook={mineToBook}
            members={family.members}
            now={now}
            fromDay={fromDay}
            showFromDay={!!pickedDay}
            labels={labels}
            emptyFor={member ? callName(member) : null}
            onOpen={(a) => navigate(`/calendar/visit/${a.id}`)}
            onBook={() => toast("Booking isn't part of this demo.")}
          />
        </>
      )
    }
  }

  return (
    <div className="screen">
      <HomeHeader user={user} onBell={() => toast('No new notifications.')} />
      <div className="scroll">
        <main className="col stack" style={{ paddingTop: 14, paddingBottom: 12, gap: 10 }}>
          <div className="cal-top">
            <h1 className="h1">{monthLong(shownMonth)}</h1>
            <div className="cal-toggle" role="group" aria-label="Calendar view">
              <button aria-pressed={view === 'agenda'} onClick={() => update({ view: null, month: null })}>
                Agenda
              </button>
              <button aria-pressed={view === 'month'} onClick={() => update({ view: 'month', month: null })}>
                Month
              </button>
            </div>
          </div>
          {family && <MemberFilter members={family.members} selected={member?.id ?? null} onSelect={(id) => update({ who: id })} />}
          {body}
        </main>
      </div>
      <BottomNav current="Calendar" />
    </div>
  )
}
