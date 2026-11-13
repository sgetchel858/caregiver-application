import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Header } from '../components/Header'
import { ErrorState, ScreenSkeleton, Spinner } from '../components/Feedback'
import { Icon } from '../components/Icon'
import { useServices } from '../lib/services'
import type { InteractionCheck, InteractionCheckItem } from '../services/types'

const POLL_MS = 600
/** minimum time between rows ticking over, so fast backends still read as a check */
const REVEAL_MS = 650

export function useInteractionCheck(checkId: string, initial?: InteractionCheck) {
  const { health } = useServices()
  const [check, setCheck] = useState<InteractionCheck | undefined>(initial)
  const [error, setError] = useState<unknown>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let live = true
    let timer: number
    const poll = async () => {
      try {
        const c = await health.getInteractionCheck(checkId)
        if (!live) return
        setCheck(c)
        setError(null)
        if (c.status !== 'complete') timer = window.setTimeout(poll, POLL_MS)
      } catch (e) {
        if (live) setError(e)
      }
    }
    poll()
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [checkId, health, nonce])

  return { check, error, retry: () => setNonce((n) => n + 1) }
}

function RowIcon({ item, state }: { item: InteractionCheckItem; state: 'done' | 'checking' | 'queued' }) {
  if (state === 'checking') return <Spinner />
  if (state === 'queued')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#E4E4E4" strokeWidth="3" />
      </svg>
    )
  if (item.result === 'major' || item.result === 'moderate')
    return <Icon name="alert" size={22} color={item.result === 'major' ? '#FD6530' : '#FDD728'} strokeWidth={2.4} />
  return <Icon name="checkCircle" size={22} color="#0C4668" strokeWidth={2.2} />
}

function Ring({ progress, done, flagged }: { progress: number; done: boolean; flagged: boolean }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#E4E4E4" strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="#23B5AF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(progress, 0.04) * c} ${c}`}
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      {done && !flagged && <path d="m25 37 7 7 15-17" fill="none" stroke="#0C4668" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
      {done && flagged && (
        <g transform="translate(22 21) scale(1.17)" fill="none" stroke="#FD6530" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" />
        </g>
      )}
    </svg>
  )
}

/** Moment 3 · 2: the check animates through her medication list, then offers the result. */
export function InteractionCheckScreen() {
  const { memberId = '', checkId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const initial = (location.state as { check?: InteractionCheck } | null)?.check
  const { check, error, retry } = useInteractionCheck(checkId, initial)

  // Rows tick over one at a time, in the order the backend resolved them.
  const [revealed, setRevealed] = useState<string[]>([])
  const revealedRef = useRef(revealed)
  revealedRef.current = revealed
  useEffect(() => {
    if (!check) return
    const t = window.setInterval(() => {
      const next = check.items.find((i) => i.result !== 'pending' && !revealedRef.current.includes(i.id))
      if (next) setRevealed((r) => [...r, next.id])
    }, REVEAL_MS)
    return () => window.clearInterval(t)
  }, [check])

  const total = check?.items.length ?? 0
  const allShown = !!check && check.status === 'complete' && revealed.length === total
  const flagged = check?.items.filter((i) => revealed.includes(i.id) && i.result !== 'clear') ?? []
  const firstWaiting = check?.items.find((i) => !revealed.includes(i.id))

  return (
    <div className="screen">
      <Header title="Interaction check" back={`/m/${memberId}/meds/new`} />
      <div className="scroll">
        <main className="col stack main" style={{ paddingTop: 28, gap: 18, minHeight: '100%' }}>
          {!check && !error && <ScreenSkeleton blocks={[120, 300]} />}
          {!!error && !check && <ErrorState error={error} onRetry={retry} title="Couldn't run the check" />}
          {check && (
            <>
              <div className="stack" style={{ alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <Ring progress={total ? revealed.length / total : 0} done={allShown} flagged={flagged.length > 0} />
                <h1 className="h1" style={{ fontSize: 24 }} aria-live="polite">
                  {allShown
                    ? flagged.length
                      ? `${flagged.length} ${flagged.some((f) => f.result === 'major') ? 'major ' : ''}${flagged.length === 1 ? 'interaction' : 'interactions'} found`
                      : 'No major interactions found'
                    : `Checking ${check.drug.name.toLowerCase()}`}
                </h1>
                <p className="p muted">{check.scopeLine}</p>
              </div>

              <ul className="card" style={{ padding: '4px 16px', gap: 0, listStyle: 'none', margin: 0 }} aria-label="Checks">
                {check.items.map((item, i) => {
                  const shown = revealed.includes(item.id)
                  const state = shown ? 'done' : item.id === firstWaiting?.id ? 'checking' : 'queued'
                  const flaggedRow = shown && item.result !== 'clear'
                  return (
                    <li
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 0',
                        borderBottom: i < check.items.length - 1 ? '1px solid #EDEDED' : 0,
                        opacity: state === 'queued' ? 0.6 : 1,
                        transition: 'opacity 0.3s ease',
                      }}
                    >
                      <RowIcon item={item} state={state} />
                      <div className="stack" style={{ flex: 1, gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 16, fontWeight: 600 }}>{item.label}</span>
                        <span className="small muted">{item.sublabel}</span>
                      </div>
                      <span
                        className="small"
                        style={{
                          textAlign: 'right',
                          color: flaggedRow ? '#2A2B39' : state === 'checking' ? '#0C4668' : '#535458',
                          fontWeight: flaggedRow || state === 'checking' ? 700 : 400,
                        }}
                      >
                        {shown ? item.resultLabel : state === 'checking' ? 'Checking…' : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
                Checked against {check.source.label}, not guessed.
              </p>
              {!!error && <ErrorState error={error} onRetry={retry} title="Lost connection during the check" />}

              <button
                className={`btn btn--48 ${allShown ? 'btn--primary' : 'btn--outline'}`}
                style={{ marginTop: 'auto' }}
                disabled={!allShown}
                onClick={() => navigate(`/m/${memberId}/meds/check/${checkId}/result`)}
              >
                See results
              </button>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
