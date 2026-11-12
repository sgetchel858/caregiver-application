import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Header } from '../components/Header'
import { AgentMark } from '../components/Agent'
import { Avatar } from '../components/Avatar'
import { Async, Skeleton } from '../components/Feedback'
import { Icon } from '../components/Icon'
import { ShareSheet } from '../components/ShareSheet'
import { SourceSheet } from '../components/SourceSheet'
import { EscortPicker, type EscortOption } from '../components/calendar/EscortPicker'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { useUI } from '../lib/ui'
import { callName, personName } from '../lib/family'
import { joinNames, parseLocal, relativeDay, time, weekdayMonthDay } from '../lib/format'
import { ServiceError } from '../services/errors'
import type { Appointment, SourceRef, VisitReadinessItem } from '../services/types'

function VisitSkeleton() {
  return (
    <div className="stack" style={{ gap: 12 }} role="status" aria-label="Loading the visit">
      <Skeleton h={96} />
      <Skeleton h={46} />
      <Skeleton h={150} />
      <Skeleton h={128} />
    </div>
  )
}

const icsText = (s: string) => s.replace(/([\;,])/g, '\\$1')
const icsStamp = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`

/**
 * A calendar file for the phone's own calendar. The title carries no health
 * details (FLOW.md guardrail: nothing on the lock screen), only who and where.
 * No end time is known, so the event is one hour long.
 */
function icsHref(a: Appointment, who: string, now: Date): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Casante//Family Health Agent//EN', 'BEGIN:VEVENT']
  lines.push(`UID:${a.id}@casante`, `DTSTAMP:${icsStamp(now)}`)
  if (a.startsAt) {
    const start = parseLocal(a.startsAt)
    lines.push(`DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(new Date(start.getTime() + 60 * 60_000))}`)
  } else {
    lines.push(`DTSTART;VALUE=DATE:${a.date.replace(/-/g, '')}`)
  }
  lines.push(`SUMMARY:${icsText(`${who}: appointment`)}`)
  if (a.place) lines.push(`LOCATION:${icsText(a.place)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`
}

export function VisitDetail() {
  const { appointmentId = '' } = useParams()
  const { store, health, clock } = useServices()
  const { toast } = useUI()
  const navigate = useNavigate()
  /** undefined = not changed here yet: show what the store returned */
  const [escort, setEscort] = useState<string | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [source, setSource] = useState<SourceRef | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  const state = useAsync(async () => {
    const [appt, user, family] = await Promise.all([store.getAppointment(appointmentId), store.getCurrentUser(), store.getFamily()])
    const member = appt && family.members.find((m) => m.id === appt.memberId)
    if (!appt || !member) throw new ServiceError('not-found', 'Appointment not found')
    const readiness =
      appt.healthVisitId && member.healthMemberId ? await health.getVisitReadiness(member.healthMemberId, appt.healthVisitId) : null
    return { appt, user, family, member, readiness }
  }, [appointmentId])

  const back = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/calendar', { replace: true })
  }

  return (
    <div className="screen">
      <Header title="Visit" back={back} backLabel="Back to calendar" />
      <div className="scroll">
        <main className="col stack" style={{ paddingTop: 18, paddingBottom: 16, gap: 12, minHeight: '100%' }}>
          <Async state={state} skeleton={<VisitSkeleton />} errorTitle="Couldn't load this visit">
            {({ appt, user, family, member, readiness }) => {
              const who = callName(member)
              const now = clock.now()
              const selected = escort !== undefined ? escort : appt.escortId
              const options: EscortOption[] = appt.escortOptions.flatMap((id) => {
                if (id === user.id) return [{ id, label: 'Me', name: 'you' }]
                const name = personName(id, user, family)
                return name ? [{ id, label: name, name }] : []
              })

              const pickEscort = async (id: string) => {
                const prev = selected
                setEscort(id) // optimistic
                setSaving(true)
                try {
                  await store.setAppointmentEscort(appt.id, id)
                } catch {
                  setEscort(prev)
                  toast("Couldn't save that. Try again.")
                } finally {
                  setSaving(false)
                }
              }

              const openItem = (item: VisitReadinessItem) => {
                if (item.kind === 'prep-sheet') {
                  const pin = item.suggestedPins?.[0]
                  navigate(`/m/${member.healthMemberId}/prep/${appt.healthVisitId}${pin ? `?pin=${pin.kind}:${pin.id}` : ''}`)
                } else if (item.recordId) {
                  setSource({ recordId: item.recordId, label: item.title })
                }
              }

              const taking = selected ? personName(selected, user, family) : null
              const shareSummary = [
                `${who}: ${appt.title}, ${weekdayMonthDay(appt.date)}${appt.startsAt ? ` at ${time(appt.startsAt)}` : ''}${appt.place ? `, ${appt.place}` : ''}.`,
                taking ? `${taking} is taking ${who}.` : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <Avatar initials={member.initials} color={member.avatarColor} size={52} />
                    <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                      <span className="eyebrow">
                        {who} · {relativeDay(appt.date, now) ?? weekdayMonthDay(appt.date)}
                      </span>
                      <h1 className="h1" style={{ fontSize: 24 }}>
                        {appt.title}
                      </h1>
                      <span style={{ fontSize: 15 }}>
                        {weekdayMonthDay(appt.date)}
                        {appt.startsAt ? ` · ${time(appt.startsAt)}` : ''}
                      </span>
                      {(appt.place || appt.note) && (
                        <span className="muted" style={{ fontSize: 14 }}>
                          {[appt.place, appt.note].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {appt.place && (
                    <div className={appt.placePhone ? 'grid-2' : 'stack'}>
                      <a
                        className="btn btn--outline"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.place)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon name="pin" size={18} />
                        Directions
                      </a>
                      {appt.placePhone && (
                        <a className="btn btn--outline" href={`tel:+1${appt.placePhone.replace(/\D/g, '')}`}>
                          <Icon name="phone" size={18} />
                          Call the office
                        </a>
                      )}
                    </div>
                  )}

                  {readiness && readiness.items.length > 0 && (
                    <section className="card" style={{ gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AgentMark size={24} />
                        <h2 className="h2">Ready for this visit</h2>
                      </div>
                      {readiness.items.map((item, i) => (
                        <div key={item.id} className="stack" style={{ gap: 10 }}>
                          {i > 0 && <div className="divider" style={{ background: '#EDEDED' }} />}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Icon name="checkCircle" size={20} strokeWidth={2.2} color="#0C4668" />
                            <div className="stack" style={{ flex: 1, gap: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 15, fontWeight: 600 }}>{item.title}</span>
                              <span className="small muted">{item.detail}</span>
                            </div>
                            <button
                              className="btn btn--text"
                              style={{ alignSelf: 'center', padding: '0 6px', textDecoration: 'underline', textUnderlineOffset: 2 }}
                              onClick={() => openItem(item)}
                              aria-label={`${item.kind === 'prep-sheet' ? 'Open' : 'View'} ${item.title}`}
                            >
                              {item.kind === 'prep-sheet' ? 'Open' : 'View'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </section>
                  )}

                  {options.length > 0 && (
                    <EscortPicker who={who} options={options} selected={selected} userId={user.id} pending={saving} onPick={pickEscort} />
                  )}

                  {readiness?.afterVisitNote && (
                    <div className="note">
                      <span className="sr-only">Casanté agent: </span>
                      {readiness.afterVisitNote}
                    </div>
                  )}

                  <div className="btn-row" style={{ marginTop: 'auto', paddingTop: 4 }}>
                    <a className="btn btn--primary btn--48" href={icsHref(appt, who, now)} download={`${who.toLowerCase()}-appointment-${appt.date}.ics`}>
                      Add to my phone
                    </a>
                    <button className="btn btn--outline btn--48" onClick={() => setShareOpen(true)}>
                      Share with family
                    </button>
                  </div>

                  {source && member.healthMemberId && (
                    <SourceSheet memberId={member.healthMemberId} source={source} onClose={() => setSource(null)} />
                  )}
                  {shareOpen && (
                    <ShareSheet
                      family={family}
                      aboutMemberId={member.id}
                      summary={shareSummary}
                      refTo={{ kind: 'appointment', id: appt.id }}
                      onClose={(sentTo) => {
                        setShareOpen(false)
                        if (sentTo?.length) {
                          const names = family.members.filter((m) => sentTo.includes(m.id)).map((m) => m.firstName)
                          toast(`Shared with ${joinNames(names)}.`)
                        }
                      }}
                    />
                  )}
                </>
              )
            }}
          </Async>
        </main>
      </div>
    </div>
  )
}
