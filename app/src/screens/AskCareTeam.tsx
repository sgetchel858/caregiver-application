import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Header } from '../components/Header'
import { Async, ErrorState, Skeleton } from '../components/Feedback'
import { FullScreen, Sheet } from '../components/Sheet'
import { Icon } from '../components/Icon'
import { Rich } from '../lib/rich'
import { useServices } from '../lib/services'
import { useAsync, useAction } from '../lib/useAsync'
import { joinNames } from '../lib/format'
import type { FamilyMember, MessageDraft } from '../services/types'

/** How Sarah would say it: "Dad", "Mom", otherwise first names. */
const callName = (m: FamilyMember) => (['Mom', 'Dad'].includes(m.relation) ? m.relation : m.firstName)

/** Moment 3 · 4: a question to show the ER doctor now, and a drafted message for later. Nothing sends without confirming. */
export function AskCareTeam() {
  const { memberId = '', checkId = '' } = useParams()
  const { health, store, isDemo } = useServices()
  const navigate = useNavigate()
  const [body, setBody] = useState<string | null>(null)
  const [notifyFamily, setNotifyFamily] = useState(true)
  const [fullScreen, setFullScreen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [sent, setSent] = useState<{ to: string; family: string[] } | null>(null)
  const [saveNote, setSaveNote] = useState('')

  const state = useAsync(async () => {
    const [followUp, drafts, family, user] = await Promise.all([
      health.draftInteractionFollowUp(memberId, checkId),
      store.listDrafts(memberId),
      store.getFamily(),
      store.getCurrentUser(),
    ])
    // if Sarah already edited this draft, keep her version
    const saved = drafts.find((d) => d.about?.kind === 'interaction-check' && d.about.id === checkId)
    const circle = (family.careCircles[memberId] ?? [])
      .map((id) => family.members.find((m) => m.id === id))
      .filter((m): m is FamilyMember => !!m && !m.isSelf)
    return { followUp, draft: saved ?? followUp.draft, circle, user }
  }, [memberId, checkId])

  const draft: MessageDraft | null = state.status === 'success' ? { ...state.data.draft, body: body ?? state.data.draft.body } : null

  // autosave edits to the app store
  const saveTimer = useRef<number>()
  useEffect(() => {
    if (body === null || !draft) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      store.saveDraft(draft).then(
        () => setSaveNote('Draft saved'),
        () => setSaveNote("Couldn't save the draft"),
      )
    }, 800)
    return () => window.clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body])

  const send = useAction(async () => {
    if (!draft || state.status !== 'success') return
    await health.sendMessage(draft)
    const { circle, user, followUp } = state.data
    if (notifyFamily && circle.length) {
      await store.createFamilyUpdate({
        fromUserId: user.id,
        aboutMemberId: memberId,
        toMemberIds: circle.map((m) => m.id),
        summary: followUp.familySummary,
        ref: { kind: 'message', id: draft.id },
      })
    }
    setReviewOpen(false)
    setSent({ to: draft.to.name, family: notifyFamily ? circle.map(callName) : [] })
  })

  if (sent) {
    return (
      <div className="screen">
        <Header title="Ask the care team" back={`/m/${memberId}`} />
        <div className="scroll">
          <main className="col stack main" role="status">
            <section className="card card--16" style={{ borderLeft: '4px solid #62CB6C' }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Icon name="checkCircle" color="#0C4668" />
                <h1 className="h2" style={{ fontSize: 20 }}>
                  Message sent to {sent.to}
                </h1>
              </span>
              {sent.family.length > 0 && <p className="p">{joinNames(sent.family)} got a short update in Casanté.</p>}
              {isDemo && <p className="small muted" style={{ margin: 0 }}>Demo: nothing actually left this device.</p>}
            </section>
            <button className="btn btn--primary btn--48" onClick={() => navigate(`/m/${memberId}`)}>
              Back to her profile
            </button>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <Header title="Ask the care team" back={`/m/${memberId}/meds/check/${checkId}/result`} />
      <div className="scroll">
        <main className="col stack main" style={{ gap: 14, minHeight: '100%' }}>
          <Async
            state={state}
            errorTitle="Couldn't draft the questions"
            skeleton={
              <div className="stack" style={{ gap: 14 }} role="status" aria-label="Drafting">
                <Skeleton h={20} w="50%" />
                <Skeleton h={180} />
                <Skeleton h={20} w="40%" />
                <Skeleton h={260} />
              </div>
            }
          >
            {({ followUp, circle }) => (
              <>
                <section className="stack" style={{ gap: 8 }}>
                  <h2 className="h2 h2--17">{followUp.inPerson.heading}</h2>
                  <div className="handover" style={{ background: '#FFFFFF', border: '2px solid #012E4D', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {followUp.inPerson.paragraphs.map((p, i) => (
                      <p key={i} style={{ margin: 0, fontFamily: 'var(--font-head)', fontSize: 21, lineHeight: 1.4, color: '#012E4D' }}>
                        <Rich text={p} />
                      </p>
                    ))}
                    <button className="btn btn--outline" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => setFullScreen(true)}>
                      Show full screen
                    </button>
                  </div>
                </section>

                {draft && (
                  <section className="stack" style={{ gap: 8 }}>
                    <h2 className="h2 h2--17">{followUp.messageHeading}</h2>
                    <div className="card" style={{ gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <span className="muted">To</span>
                        <span style={{ fontWeight: 600, color: '#0C4668' }}>
                          {draft.to.name} · {draft.to.role}
                        </span>
                        <span className="badge" style={{ marginLeft: 'auto' }}>
                          {draft.channel} message
                        </span>
                      </div>
                      <label htmlFor="draft" className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Drafted for you</span>
                        <span aria-live="polite">{saveNote}</span>
                      </label>
                      <textarea id="draft" className="input" rows={6} value={draft.body} onChange={(e) => setBody(e.target.value)} />
                      {circle.length > 0 && (
                        <label className="check-row" style={{ alignItems: 'center' }}>
                          <input type="checkbox" checked={notifyFamily} onChange={(e) => setNotifyFamily(e.target.checked)} />
                          <span>Also update {joinNames(circle.map(callName))}</span>
                        </label>
                      )}
                    </div>
                  </section>
                )}

                <div className="stack" style={{ gap: 8, marginTop: 'auto' }}>
                  <button className="btn btn--primary btn--lg" disabled={!draft?.body.trim()} onClick={() => setReviewOpen(true)}>
                    Review and send
                  </button>
                  <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
                    Nothing is sent until you confirm.
                  </p>
                </div>

                {fullScreen && (
                  <FullScreen label={followUp.inPerson.heading} onClose={() => setFullScreen(false)}>
                    {followUp.inPerson.paragraphs.map((p, i) => (
                      <p key={i} style={{ margin: 0, fontFamily: 'var(--font-head)', fontSize: 30, lineHeight: 1.35, color: '#012E4D' }}>
                        <Rich text={p} />
                      </p>
                    ))}
                  </FullScreen>
                )}

                {reviewOpen && draft && (
                  <Sheet
                    title="Review before sending"
                    onClose={() => !send.pending && setReviewOpen(false)}
                    footer={
                      <>
                        {!!send.error && <ErrorState error={send.error} title="Not sent" />}
                        <button className="btn btn--primary btn--48" disabled={send.pending} onClick={() => send.run()}>
                          {send.pending ? 'Sending…' : `Send to ${draft.to.name}`}
                        </button>
                        <button className="btn btn--outline btn--48" disabled={send.pending} onClick={() => setReviewOpen(false)}>
                          Keep editing
                        </button>
                      </>
                    }
                  >
                    <div className="stack" style={{ gap: 4 }}>
                      <span className="eyebrow">
                        To {draft.to.name} · {draft.to.role} · {draft.channel}
                      </span>
                      <p className="excerpt" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {draft.body}
                      </p>
                    </div>
                    {notifyFamily && circle.length > 0 && (
                      <div className="stack" style={{ gap: 4 }}>
                        <span className="eyebrow">Also update {joinNames(circle.map(callName))} in Casanté</span>
                        <p className="note" style={{ margin: 0 }}>
                          {followUp.familySummary}
                        </p>
                      </div>
                    )}
                  </Sheet>
                )}
              </>
            )}
          </Async>
        </main>
      </div>
    </div>
  )
}
