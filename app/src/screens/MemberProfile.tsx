import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Header } from '../components/Header'
import { Avatar } from '../components/Avatar'
import { Icon, type IconName } from '../components/Icon'
import { AskBar } from '../components/AskBar'
import { SuggestionChips } from '../components/Agent'
import { Async, Skeleton } from '../components/Feedback'
import { VitalsSheet } from '../components/VitalsSheet'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { useUI } from '../lib/ui'
import { useThreads } from '../state/threads'
import { monthDay, relativeDay, time, weekdayMonthDay } from '../lib/format'

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

export function MemberProfile() {
  const { memberId = '' } = useParams()
  const { health, store, clock } = useServices()
  const { toast } = useUI()
  const navigate = useNavigate()
  const threads = useThreads()
  const [draft, setDraft] = useState<string | null>(null)
  const [vitalsOpen, setVitalsOpen] = useState(false)

  const state = useAsync(async () => {
    const [family, profile, team, meds, upcoming, past, suggestions] = await Promise.all([
      store.getFamily(),
      health.getProfile(memberId),
      health.getCareTeam(memberId),
      health.getMedications(memberId),
      health.getVisits(memberId, { upcoming: true }),
      health.getVisits(memberId),
      health.getAskSuggestions(memberId),
    ])
    const member = family.members.find((m) => m.healthMemberId === memberId)
    return { member, profile, team, meds, upcoming, past, suggestions }
  }, [memberId])

  const relation = state.status === 'success' ? (state.data.member?.relation ?? state.data.profile.firstName) : ''
  const prefill =
    state.status === 'success' && threads.turns(memberId).length === 0 ? (state.data.suggestions.prefill ?? '') : ''
  const value = draft ?? prefill

  const ask = (q: string) => {
    setDraft('')
    navigate(`/m/${memberId}/ask?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="screen">
      <Header title={relation || ' '} back="/" backLabel="Back to family" contextFor={memberId} />
      <div className="scroll">
        <main className="col stack main">
          <Async state={state} skeleton={<ProfileSkeleton />} errorTitle="Couldn't load this profile">
            {({ member, profile, team, meds, upcoming, past }) => {
              const gp = team.find((c) => c.id === profile.primaryClinicianId)
              const next = upcoming[0]
              const nextDoc = next && team.find((c) => c.id === next.clinicianId)
              const referrer = next?.referredById && team.find((c) => c.id === next.referredById)
              const last = past[past.length - 1]
              const rel = next && relativeDay(next.startsAt, clock.now())
              return (
                <>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <Avatar initials={member?.initials ?? ''} color={member?.avatarColor ?? '#B4D455'} size={64} />
                    <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                      <h1 className="h1">{profile.fullName}</h1>
                      <span style={{ fontSize: 14 }} className="muted">
                        {profile.age}
                        {gp ? ` · ${gp.role}: ${gp.name}` : ''}
                      </span>
                      <span className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="link" size={14} color="#0C4668" />
                        {profile.connection.source} · {profile.connection.healthSystems} health systems · updated{' '}
                        {time(profile.connection.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {next && nextDoc ? (
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
                      <button className="btn btn--primary" onClick={() => navigate(`/m/${memberId}/prep/${next.id}`)}>
                        Prepare for this visit
                      </button>
                    </section>
                  ) : (
                    <section className="card card--16">
                      <span className="eyebrow">Next visit</span>
                      <span style={{ fontSize: 15 }}>No upcoming visits in her chart.</span>
                    </section>
                  )}

                  <div className="grid-2 tiles">
                    <Tile icon="pill" title="Medications" sub={`${meds.length} current`} onClick={() => navigate(`/m/${memberId}/meds`)} />
                    <Tile icon="stethoscope" title="Care team" sub={`${team.length} doctors`} onClick={() => toast("The care team list isn't part of this demo.")} />
                    <Tile
                      icon="docLines"
                      title="Visits & notes"
                      sub={last ? `Last: ${monthDay(last.startsAt)}` : 'None yet'}
                      onClick={() => toast("Visit notes aren't part of this demo.")}
                    />
                    <Tile icon="pulse" title="Vitals & results" sub="BP, labs, imaging" onClick={() => setVitalsOpen(true)} />
                  </div>
                </>
              )
            }}
          </Async>
        </main>
      </div>

      <div className="dock">
        <div className="col dock__inner">
          {state.status === 'success' && (
            <SuggestionChips
              items={state.data.suggestions.prompts.map((p) => ({ label: p, question: p }))}
              onPick={(s) => s.question && ask(s.question)}
            />
          )}
          <AskBar
            value={value}
            onChange={setDraft}
            onSubmit={ask}
            placeholder={relation ? `Ask about ${relation}…` : 'Ask a question…'}
            label={relation ? `Ask about ${relation}` : 'Ask a question'}
            disabled={state.status !== 'success'}
          />
        </div>
      </div>
      {vitalsOpen && <VitalsSheet memberId={memberId} onClose={() => setVitalsOpen(false)} />}
    </div>
  )
}
