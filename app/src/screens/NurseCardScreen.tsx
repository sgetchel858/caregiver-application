import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Async, Skeleton } from '../components/Feedback'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { SourceChips } from '../components/Agent'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { birthDate } from '../lib/format'

const lineStyle = {
  xl: { fontSize: 22, fontWeight: 700 },
  lg: { fontSize: 19 },
  md: { fontSize: 17 },
  muted: { fontSize: 17, color: '#535458' },
} as const

/** Large-type card Sarah hands to the nurse. White, no chrome, very readable. */
export function NurseCardScreen() {
  const { memberId = '' } = useParams()
  const { health, store } = useServices()
  const navigate = useNavigate()
  const location = useLocation()
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const state = useAsync(async () => {
    const [card, user, family] = await Promise.all([health.buildNurseCard(memberId), store.getCurrentUser(), store.getFamily()])
    const member = family.members.find((m) => m.healthMemberId === memberId)
    return { card, user, member }
  }, [memberId])

  const done = () => (location.key !== 'default' ? navigate(-1) : navigate(`/m/${memberId}/ask`))

  return (
    <div className="screen screen--white">
      <div style={{ height: 'var(--safe-top)', background: 'var(--navy-1200)', flexShrink: 0 }} aria-hidden="true" />
      <header style={{ flexShrink: 0, borderBottom: '1px solid #E4E4E4' }}>
        <div className="col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <span className="small muted">
            {state.status === 'success' && state.data.member
              ? `Shown by ${state.data.user.firstName} (${state.data.member.userIs})`
              : ' '}
          </span>
          <button
            onClick={done}
            style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: '#F4F4F4', color: '#0C4668', fontSize: 15, fontWeight: 600 }}
          >
            Done
          </button>
        </div>
      </header>

      <div className="scroll">
        <main className="col handover" style={{ padding: '20px 20px 16px', fontFamily: 'var(--font-head)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Async
            state={state}
            errorTitle="Couldn't build the card"
            skeleton={
              <div className="stack" style={{ gap: 16 }} role="status" aria-label="Building the card">
                <Skeleton h={36} w="80%" />
                <Skeleton h={22} w="55%" />
                <Skeleton h={72} />
                <Skeleton h={90} />
                <Skeleton h={110} />
              </div>
            }
          >
            {({ card }) => (
              <>
                <div className="stack" style={{ gap: 2 }}>
                  <h1 style={{ margin: 0, fontWeight: 700, fontSize: 30, color: '#012E4D' }}>{card.fullName}</h1>
                  <span style={{ fontSize: 20 }}>
                    Born {birthDate(card.dateOfBirth)} · {card.age}
                  </span>
                </div>
                {card.sections.map((s) => (
                  <section
                    key={s.label}
                    className="stack"
                    style={{
                      gap: s.lines.length > 2 ? 4 : 2,
                      ...(s.boxed ? { border: '2px solid #012E4D', borderRadius: 12, padding: '12px 14px' } : {}),
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#535458' }}>{s.label}</h2>
                    {s.lines.map((l) => (
                      <span key={l.text} style={lineStyle[l.size]}>
                        {l.text}
                      </span>
                    ))}
                  </section>
                ))}
              </>
            )}
          </Async>
        </main>
      </div>

      {state.status === 'success' && (
        <footer style={{ flexShrink: 0, background: '#F4F4F4', paddingBottom: 'calc(14px + var(--safe-bottom))' }}>
          <p className="col source-line" style={{ paddingTop: 12 }}>
            <Icon name="doc" size={14} color="#535458" />
            {state.data.card.sourcesNote} ·{' '}
            <button className="link-btn" onClick={() => setSourcesOpen(true)}>
              Sources
            </button>
          </p>
        </footer>
      )}
      {sourcesOpen && state.status === 'success' && (
        <Sheet title="Sources" onClose={() => setSourcesOpen(false)}>
          <p className="p muted">Every line on this card comes from these records. Tap one to read it.</p>
          <SourceChips memberId={memberId} sources={state.data.card.sources} />
        </Sheet>
      )}
    </div>
  )
}
