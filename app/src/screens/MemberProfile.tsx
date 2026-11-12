import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Header } from '../components/Header'
import { Avatar } from '../components/Avatar'
import { Icon, type IconName } from '../components/Icon'
import { AskBar } from '../components/AskBar'
import { SuggestionChips } from '../components/Agent'
import { Async, Skeleton } from '../components/Feedback'
import { VitalsSheet } from '../components/VitalsSheet'
import { MemberEditSheet } from '../components/MemberEditSheet'
import { CareCircleSheet, circleCandidates } from '../components/CareCircleSheet'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { useUI } from '../lib/ui'
import { useThreads } from '../state/threads'
import { joinNames, monthDay, relativeDay, time, weekdayMonthDay } from '../lib/format'
import { callName, findMember, fullName } from '../lib/family'
import { ServiceError } from '../services/errors'

function Tile({ icon, title, sub, onClick }: { icon: IconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button className="tile" onClick={onClick}>
      <Icon name={icon} size={22} strokeWidth={1.8} color="#0C4668" />
      <span className="tile__title">{title}</span>
      <span className="tile__sub">{sub}</span>
    </button>
  )
}

function ProfileSkeleton() {
  return (
    <div className="stack" style={{ gap: 14 }} role="status" aria-label="Loading profile">
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Skeleton h={64} w={64} r={32} />
        <div className="stack" style={{ gap: 6, flex: 1 }}>
          <Skeleton h={26} w="80%" />
          <Skeleton h={14} w="50%" />
        </div>
      </div>
      <Skeleton h={168} />
      <div className="grid-2 tiles">
        <Skeleton h={96} />
        <Skeleton h={96} />
        <Skeleton h={96} />
        <Skeleton h={96} />
      </div>
    </div>
  )
}

/**
 * A family member's profile. Who they are (name, relation, who gets updates)
 * comes from the app store and can be edited. Their health summary comes from
 * the Health API, when their records are connected.
 *
 * `:memberId` is the member's id or their Health API id.
 */
export function MemberProfile() {
  const { memberId = '' } = useParams()
  const { health, store, clock } = useServices()
  const { toast } = useUI()
  const navigate = useNavigate()
  const threads = useThreads()
  const [draft, setDraft] = useState<string | null>(null)
  const [vitalsOpen, setVitalsOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [circleOpen, setCircleOpen] = useState(false)

  const state = useAsync(async () => {
    const family = await store.getFamily()
    const member = findMember(family, memberId)
    if (!member) throw new ServiceError('not-found', 'Family member not found')
    const hid = member.healthMemberId
    if (!hid) return { family, member, chart: null }

    // The briefing says whether we can read their records. Ask for the chart at
    // the same time; if they aren't connected, its failure doesn't matter.
    const [briefing, loaded] = await Promise.all([
      health.getFamilyBriefing([hid]),
      Promise.all([
        health.getProfile(hid),
        health.getCareTeam(hid),
        health.getMedications(hid),
        health.getVisits(hid, { upcoming: true }),
        health.getVisits(hid),
        health.getAskSuggestions(hid),
      ]).then(
        ([profile, team, meds, upcoming, past, suggestions]) => ({ ok: true as const, hid, profile, team, meds, upcoming, past, suggestions }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    ])
    if (!briefing.statuses.some((x) => x.memberId === hid && x.recordsConnected)) return { family, member, chart: null }
    if (!loaded.ok) throw loaded.error
    return { family, member, chart: loaded }
  }, [memberId])

  const data = state.status === 'success' ? state.data : null
  const chart = data?.chart ?? null
  const title = data ? (data.member.isSelf ? 'You' : data.member.relation) : ''
  const who = data ? (data.member.isSelf ? 'yourself' : callName(data.member)) : ''
  const prefill = chart && threads.turns(chart.hid).length === 0 ? (chart.suggestions.prefill ?? '') : ''
  const value = draft ?? prefill

  const ask = (q: string) => {
    if (!chart) return
    setDraft('')
    navigate(`/m/${chart.hid}/ask?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="screen">
      <Header
        title={title || ' '}
        back="/"
        backLabel="Back to family"
        contextFor={chart?.hid}
        extra={
          data && (
            <button className="header__text-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
          )
        }
      />
      <div className="scroll">
        <main className="col stack main">
          <Async state={state} skeleton={<ProfileSkeleton />} errorTitle="Couldn't load this profile">
            {({ family, member, chart }) => {
              const name = member.isSelf ? 'you' : member.firstName
              const circle = (family.careCircles[member.id] ?? [])
                .map((id) => family.members.find((m) => m.id === id))
                .filter((m) => !!m)
              const canShare = circleCandidates(family, member).length > 0
              const gp = chart?.team.find((c) => c.id === chart.profile.primaryClinicianId)
              const next = chart?.upcoming[0]
              const nextDoc = next && chart?.team.find((c) => c.id === next.clinicianId)
              const referrer = next?.referredById && chart?.team.find((c) => c.id === next.referredById)
              const last = chart?.past[chart.past.length - 1]
              const rel = next && relativeDay(next.startsAt, clock.now())
              const age = chart?.profile.age ?? member.age
              const facts = [age, gp ? `${gp.role}: ${gp.name}` : !chart && !member.isSelf ? member.relation : null].filter((x) => x !== null)
              return (
                <>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <Avatar initials={member.initials} color={member.avatarColor} size={64} />
                    <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                      <h1 className="h1">{fullName(member)}</h1>
                      {facts.length > 0 && (
                        <span style={{ fontSize: 14 }} className="muted">
                          {facts.join(' · ')}
                        </span>
                      )}
                      <span className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="link" size={14} color="#0C4668" />
                        {chart
                          ? `${chart.profile.connection.source} · ${chart.profile.connection.healthSystems} health systems · updated ${time(chart.profile.connection.updatedAt)}`
                          : 'Records not connected'}
                      </span>
                    </div>
                  </div>

                  {!chart ? (
                    <section className="card card--16" aria-label="Medical records">
                      <span className="eyebrow">Medical records</span>
                      <span style={{ fontSize: 15 }}>
                        Connect {member.isSelf ? 'your' : `${member.firstName}'s`} patient portal to see medications, visits and results here,
                        and to ask questions about them.
                      </span>
                      <button className="btn btn--outline" onClick={() => toast("Connecting records isn't part of this demo.")}>
                        Connect records
                      </button>
                    </section>
                  ) : next && nextDoc ? (
                    <section className="card card--16" aria-label="Next visit">
                      <span className="eyebrow">Next visit · {rel ?? weekdayMonthDay(next.startsAt)}</span>
                      <div className="stack" style={{ gap: 3 }}>
                        <span className="h2" style={{ fontSize: 19 }}>
                          {nextDoc.role} with {nextDoc.name}
                        </span>
                        <span style={{ fontSize: 15 }}>
                          {weekdayMonthDay(next.startsAt)} · {time(next.startsAt)}
                        </span>
                        <span style={{ fontSize: 14 }} className="muted">
                          {next.reason}
                          {referrer ? ` · referred by ${referrer.name}` : ''}
                        </span>
                      </div>
                      <button className="btn btn--primary" onClick={() => navigate(`/m/${chart.hid}/prep/${next.id}`)}>
                        Prepare for this visit
                      </button>
                    </section>
                  ) : (
                    <section className="card card--16">
                      <span className="eyebrow">Next visit</span>
                      <span style={{ fontSize: 15 }}>No upcoming visits in the chart.</span>
                    </section>
                  )}

                  {chart && (
                    <div className="grid-2 tiles">
                      <Tile icon="pill" title="Medications" sub={`${chart.meds.length} current`} onClick={() => navigate(`/m/${chart.hid}/meds`)} />
                      <Tile icon="stethoscope" title="Care team" sub={`${chart.team.length} doctors`} onClick={() => toast("The care team list isn't part of this demo.")} />
                      <Tile
                        icon="docLines"
                        title="Visits & notes"
                        sub={last ? `Last: ${monthDay(last.startsAt)}` : 'None yet'}
                        onClick={() => toast("Visit notes aren't part of this demo.")}
                      />
                      <Tile icon="pulse" title="Vitals & results" sub="BP, labs, imaging" onClick={() => setVitalsOpen(true)} />
                    </div>
                  )}

                  {canShare && (
                    <section className="card card--16" aria-label="Family updates">
                      <span className="eyebrow">Family updates</span>
                      <span style={{ fontSize: 15 }}>
                        {circle.length
                          ? `Updates about ${name} go to ${joinNames([...circle.map(callName), ...(member.isSelf ? [] : ['you'])])}.`
                          : member.isSelf
                            ? 'Updates about you stay with you.'
                            : `Only you see updates about ${name}.`}
                      </span>
                      <button className="btn btn--text" onClick={() => setCircleOpen(true)}>
                        Change who gets updates
                      </button>
                    </section>
                  )}
                </>
              )
            }}
          </Async>
        </main>
      </div>

      {chart && (
        <div className="dock">
          <div className="col dock__inner">
            <SuggestionChips
              items={chart.suggestions.prompts.map((p) => ({ label: p, question: p }))}
              onPick={(s) => s.question && ask(s.question)}
            />
            <AskBar value={value} onChange={setDraft} onSubmit={ask} placeholder={`Ask about ${who}…`} label={`Ask about ${who}`} />
          </div>
        </div>
      )}
      {vitalsOpen && chart && <VitalsSheet memberId={chart.hid} onClose={() => setVitalsOpen(false)} />}
      {editing && data && (
        <MemberEditSheet
          family={data.family}
          member={data.member}
          onClose={(result) => {
            setEditing(false)
            if (!result) return
            if ('removed' in result) {
              toast(`${result.removed.firstName} was removed from ${data.family.name}.`)
              navigate('/', { replace: true })
            } else state.reload()
          }}
        />
      )}
      {circleOpen && data && (
        <CareCircleSheet
          family={data.family}
          about={data.member}
          onClose={(saved) => {
            setCircleOpen(false)
            if (saved) state.reload()
          }}
        />
      )}
    </div>
  )
}
