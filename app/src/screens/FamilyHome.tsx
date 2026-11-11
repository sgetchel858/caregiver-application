import { useState } from 'react'
import { useNavigate } from 'react-router'
import { HomeHeader } from '../components/Header'
import { BottomNav } from '../components/BottomNav'
import { AgentNudge } from '../components/Agent'
import { AskBar } from '../components/AskBar'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Async, Skeleton } from '../components/Feedback'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { useUI } from '../lib/ui'
import { greeting } from '../lib/format'
import type { FamilyMember, MemberStatus } from '../services/types'

function MemberCard({
  member,
  status,
  focus,
  compact,
  onOpen,
}: {
  member: FamilyMember
  status?: MemberStatus
  focus: boolean
  compact: boolean
  onOpen: () => void
}) {
  const label = compact ? `${member.firstName} · ${member.age}` : `${member.firstName} · ${member.relation}`
  return (
    <button className={`member-card ${focus ? 'member-card--focus' : ''} ${compact ? 'member-card--compact' : ''}`} onClick={onOpen}>
      <Avatar initials={member.initials} color={member.avatarColor} size={compact ? 40 : 52} />
      <span className="member-card__text">
        <span className="member-card__name">{label}</span>
        <span className="member-card__line">{status?.line ?? ' '}</span>
      </span>
      {!compact && <Icon name="chevron" size={20} color="#535458" />}
    </button>
  )
}

function HomeSkeleton() {
  return (
    <div className="stack" style={{ gap: 14 }} role="status" aria-label="Loading your family">
      <Skeleton h={34} w="70%" />
      <Skeleton h={18} w="45%" />
      <Skeleton h={74} />
      <Skeleton h={20} w="30%" />
      <Skeleton h={76} />
      <Skeleton h={76} />
      <Skeleton h={76} />
    </div>
  )
}

export function FamilyHome() {
  const { store, health, clock } = useServices()
  const { toast } = useUI()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')

  const state = useAsync(async () => {
    const [user, family] = await Promise.all([store.getCurrentUser(), store.getFamily()])
    const ids = family.members.map((m) => m.healthMemberId).filter((id): id is string => !!id)
    const briefing = await health.getFamilyBriefing(ids)
    return { user, family, briefing }
  }, [])

  const openMember = (m: FamilyMember, status?: MemberStatus) => {
    if (m.healthMemberId && status?.recordsConnected) navigate(`/m/${m.healthMemberId}`)
    else toast(`${m.firstName}'s records aren't part of this demo. Try Mom.`)
  }

  const askFamily = (q: string) => {
    if (state.status !== 'success') return
    const lower = q.toLowerCase()
    const members = state.data.family.members
    const named = members.find(
      (m) => lower.includes(m.relation.toLowerCase()) || lower.includes(m.firstName.toLowerCase()),
    )
    // default to whoever the agent is focused on today
    const target = named ?? members.find((m) => state.data.briefing.nudges.some((n) => n.memberId === m.healthMemberId))
    if (!target?.healthMemberId) {
      toast('Say who you’re asking about, like “Mom”.')
      return
    }
    setQuestion('')
    navigate(`/m/${target.healthMemberId}/ask?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="screen">
      <HomeHeader
        user={state.status === 'success' ? state.data.user : undefined}
        onBell={() => toast('No new notifications.')}
      />
      <div className="scroll">
        <main className="col stack" style={{ paddingTop: 20, paddingBottom: 12, gap: 14 }}>
          <Async state={state} skeleton={<HomeSkeleton />} errorTitle="Couldn't load your family">
            {({ user, family, briefing }) => {
              const statusOf = (m: FamilyMember) => briefing.statuses.find((s) => s.memberId === m.healthMemberId)
              const focusIds = new Set(briefing.nudges.map((n) => n.memberId))
              const adults = family.members.filter((m) => m.age >= 18)
              const kids = family.members.filter((m) => m.age < 18)
              return (
                <>
                  <div className="stack" style={{ gap: 4 }}>
                    <h1 className="h1 h1--28">
                      {greeting(clock.now())}, {user.firstName}
                    </h1>
                    <p className="p muted">
                      {family.name} · {family.members.length} people
                    </p>
                  </div>

                  {briefing.nudges.map((n) => (
                    <AgentNudge key={n.id} text={n.text} />
                  ))}

                  <h2 className="h2 h2--17" style={{ marginTop: 6 }}>
                    Your family
                  </h2>

                  <div className="stack" style={{ gap: 10 }}>
                    <div className="family-adults">
                      {adults.map((m) => (
                        <MemberCard
                          key={m.id}
                          member={m}
                          status={statusOf(m)}
                          focus={!!m.healthMemberId && focusIds.has(m.healthMemberId)}
                          compact={false}
                          onOpen={() => openMember(m, statusOf(m))}
                        />
                      ))}
                    </div>
                    {kids.length > 0 && (
                      <div className="grid-2">
                        {kids.map((m) => (
                          <MemberCard key={m.id} member={m} status={statusOf(m)} focus={false} compact onOpen={() => openMember(m, statusOf(m))} />
                        ))}
                      </div>
                    )}
                    <button className="btn btn--dashed" onClick={() => toast("Adding family members isn't part of this demo.")}>
                      + Add a family member
                    </button>
                  </div>
                </>
              )
            }}
          </Async>
        </main>
      </div>
      <div className="dock dock--plain">
        <div className="col">
          <AskBar
            white
            value={question}
            onChange={setQuestion}
            onSubmit={askFamily}
            placeholder="Ask about anyone in your family…"
            label="Ask about anyone in your family"
            disabled={state.status !== 'success'}
          />
        </div>
      </div>
      <BottomNav current="Family" />
    </div>
  )
}
