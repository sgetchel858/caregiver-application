import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Header } from '../components/Header'
import { AskBar } from '../components/AskBar'
import { AgentAnswerView, AgentMark, SuggestionChips, Typing, UserMessage } from '../components/Agent'
import { ErrorState } from '../components/Feedback'
import { Icon } from '../components/Icon'
import { VitalsSheet } from '../components/VitalsSheet'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { useThreads } from '../state/threads'
import type { AnswerAction, Suggestion } from '../services/types'

/** location keys whose ?q= we've already sent (survives StrictMode double effects) */
const consumed = new Set<string>()

export function AskThread() {
  const { memberId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { store, health } = useServices()
  const threads = useThreads()
  const turns = threads.turns(memberId)
  const [draft, setDraft] = useState<string | null>(null)
  const [vitalsOpen, setVitalsOpen] = useState(false)
  const turnRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const meta = useAsync(async () => {
    const [family, suggestions] = await Promise.all([store.getFamily(), health.getAskSuggestions(memberId)])
    return { member: family.members.find((m) => m.healthMemberId === memberId), suggestions }
  }, [memberId])

  const member = meta.status === 'success' ? meta.data.member : undefined
  const relation = member?.relation ?? 'them'

  // A question handed over from another screen (?q=...) is sent once.
  useEffect(() => {
    const q = params.get('q')
    if (q && !consumed.has(location.key)) {
      consumed.add(location.key)
      threads.ask(memberId, q)
      setParams({}, { replace: true })
    }
  }, [params, location.key, memberId, threads, setParams])

  // Keep the newest question at the top of the view, like the designs.
  const last = turns[turns.length - 1]
  useEffect(() => {
    if (!last) return
    const el = turnRefs.current[last.id]
    const box = el?.closest('.scroll')
    if (!el || !box) return
    // scroll only the thread (scrollIntoView would also shift the fixed shell)
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 16
    box.scrollTo({ top, behavior: 'smooth' })
  }, [last?.id, last?.status])

  const ask = (q: string) => {
    setDraft('')
    threads.ask(memberId, q)
  }

  const onAction = (a: AnswerAction) => {
    if (a.kind === 'add-to-prep') navigate(`/m/${memberId}/prep/${a.visitId}?pin=${a.pin.kind}:${encodeURIComponent(a.pin.id)}`)
    else if (a.kind === 'show-vitals') setVitalsOpen(true)
    else if (a.kind === 'show-to-nurse') navigate(`/m/${memberId}/nurse`)
  }

  const onSuggestion = (s: Suggestion) => {
    if (s.action === 'show-to-nurse') navigate(`/m/${memberId}/nurse`)
    else if (s.question) ask(s.question)
  }

  const prefill = turns.length === 0 && meta.status === 'success' ? (meta.data.suggestions.prefill ?? '') : ''
  const value = draft ?? prefill
  const lastAnswer = last?.status === 'done' ? last.answer : undefined
  const dockAction = lastAnswer?.actions.find((a) => a.style === 'dock')
  const followUps = lastAnswer?.followUps ?? []
  const busy = last?.status === 'pending'

  return (
    <div className="screen">
      <Header
        title={`Ask about ${relation === 'them' ? '…' : relation}`}
        back={`/m/${memberId}`}
        backLabel={`Back to ${relation}`}
        avatar={member ? { initials: member.initials, color: member.avatarColor } : undefined}
        contextFor={memberId}
      />

      <div className="scroll">
        <main className="col stack thread" aria-live="polite">
          {turns.length === 0 && (
            <div className="msg-agent">
              <AgentMark />
              <div className="msg-agent__body">
                <div className="bubble bubble--tint bubble--first">
                  Ask me anything about {relation === 'them' ? 'them' : relation}'s health. I answer only from the records
                  and show where each answer came from.
                </div>
              </div>
            </div>
          )}

          {turns.map((t) => (
            <div key={t.id} className="thread__turn" ref={(el) => (turnRefs.current[t.id] = el)}>
              <UserMessage text={t.question} />
              {t.status === 'pending' && <Typing />}
              {t.status === 'error' && (
                <div className="msg-agent">
                  <AgentMark />
                  <div className="msg-agent__body">
                    <ErrorState
                      title="I couldn't check the records just now"
                      message={t.error}
                      onRetry={() => threads.retry(memberId, t.id)}
                    />
                  </div>
                </div>
              )}
              {t.status === 'done' && t.answer && <AgentAnswerView answer={t.answer} memberId={memberId} onAction={onAction} />}
            </div>
          ))}
          {/* room so the newest question can scroll to the top */}
          {turns.length > 1 && <div style={{ minHeight: '40vh' }} aria-hidden="true" />}
        </main>
      </div>

      <div className="dock">
        <div className="col dock__inner">
          {dockAction ? (
            <button className="btn btn--primary btn--48" onClick={() => onAction(dockAction)}>
              <Icon name="card" size={18} />
              {dockAction.label}
            </button>
          ) : (
            <>
              <SuggestionChips items={followUps} onPick={onSuggestion} disabled={busy} />
              <AskBar
                value={value}
                onChange={setDraft}
                onSubmit={ask}
                placeholder={turns.length > 0 && followUps.length === 0 ? 'Ask a follow-up…' : `Ask about ${relation}…`}
                label={`Ask about ${relation}`}
                disabled={busy}
                active={!!prefill && draft === null}
              />
            </>
          )}
        </div>
      </div>
      {vitalsOpen && <VitalsSheet memberId={memberId} onClose={() => setVitalsOpen(false)} />}
    </div>
  )
}
