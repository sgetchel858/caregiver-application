import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { Header } from '../components/Header'
import { Async, Skeleton } from '../components/Feedback'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { ShareSheet } from '../components/ShareSheet'
import { SourceChips } from '../components/Agent'
import { Rich } from '../lib/rich'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { useUI } from '../lib/ui'
import { joinNames, monthDay, relativeDay, time, weekdayMonthDay } from '../lib/format'
import type { PrepPin, PrepSheet, PrepSection, QuestionList, SavedPrepSheet } from '../services/types'

const pinsOf = (sheet: PrepSheet): PrepPin[] =>
  sheet.sections.flatMap((s) => (s.type === 'vital' ? [{ kind: 'vital' as const, id: s.reading.id }] : []))

function parsePin(raw: string | null): PrepPin | null {
  if (!raw) return null
  const [kind, ...rest] = raw.split(':')
  return kind === 'vital' && rest.length ? { kind: 'vital', id: rest.join(':') } : null
}

function addedLabel(pinnedAt?: string) {
  if (!pinnedAt) return null
  return Date.now() - new Date(pinnedAt).getTime() < 10 * 60_000 ? 'Added just now' : 'Added by you'
}

function PrepSkeleton() {
  return (
    <div className="stack" style={{ gap: 12 }} role="status" aria-label="Building the prep sheet">
      <Skeleton h={14} w="40%" />
      <Skeleton h={30} w="85%" />
      <Skeleton h={18} w="70%" />
      <p className="p muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        Building it from her records…
      </p>
      <Skeleton h={84} />
      <Skeleton h={160} />
      <Skeleton h={150} />
    </div>
  )
}

function Section({ section }: { section: PrepSection }) {
  switch (section.type) {
    case 'text':
      return (
        <section className="card">
          <h2 className="h2">{section.title}</h2>
          <p className="p">
            <Rich text={section.text} />
          </p>
        </section>
      )
    case 'vital': {
      const badge = addedLabel(section.pinnedAt)
      return (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h2 className="h2">{section.title}</h2>
            {badge && <span className="badge">{badge}</span>}
          </div>
          <p className="p">
            <strong style={{ fontSize: 20, color: '#0C4668' }}>
              {section.reading.systolic}/{section.reading.diastolic}
            </strong>{' '}
            · {monthDay(section.reading.takenAt)} · {section.clinicianName}
          </p>
        </section>
      )
    }
    case 'medications':
      return (
        <section className="card" style={{ gap: 10 }}>
          <h2 className="h2">{section.title}</h2>
          <ul className="stack" style={{ gap: 8, fontSize: 15, listStyle: 'none', margin: 0, padding: 0 }}>
            {section.items.map((m) => (
              <li key={m.name} className="stack" style={{ gap: 1 }}>
                <span>
                  <strong>{m.name}</strong> {m.strength} · {m.schedule}
                </span>
                <span className="small muted">{m.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )
    case 'questions':
      return null // rendered by QuestionsCard, which owns the saved checklist
  }
}

function QuestionsCard({ title, list, onChange }: { title: string; list: QuestionList; onChange: (l: QuestionList) => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  const toggle = (id: string) =>
    onChange({ ...list, items: list.items.map((q) => (q.id === id ? { ...q, checked: !q.checked } : q)) })

  const add = async () => {
    const t = text.trim()
    if (!t) return
    await onChange({ ...list, items: [...list.items, { id: `u-${Date.now().toString(36)}`, text: t, checked: false, addedBy: 'user' }] })
    setText('')
    setAdding(false)
  }

  return (
    <section className="card" style={{ gap: 6 }}>
      <h2 className="h2" style={{ marginBottom: 4 }}>
        {title}
      </h2>
      {list.items.map((q) => (
        <label key={q.id} className={`check-row ${q.checked ? 'check-row--done' : ''}`}>
          <input type="checkbox" checked={q.checked} onChange={() => toggle(q.id)} />
          <span>{q.text}</span>
        </label>
      ))}
      {adding ? (
        <form
          className="stack"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <label className="sr-only" htmlFor="new-q">
            New question
          </label>
          <input id="new-q" className="input input--active" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question for the doctor" />
          <div className="btn-row">
            <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
              Add
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn--text" onClick={() => setAdding(true)}>
          + Add a question
        </button>
      )}
    </section>
  )
}

export function PrepSheetScreen() {
  const { memberId = '', visitId = '' } = useParams()
  const [params] = useSearchParams()
  const pin = parsePin(params.get('pin'))
  const { health, store, clock } = useServices()
  const { toast } = useUI()
  const [questions, setQuestions] = useState<QuestionList | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const state = useAsync(async () => {
    const [saved, family, savedQuestions] = await Promise.all([
      store.getPrepSheet(memberId, visitId),
      store.getFamily(),
      store.getQuestionList(memberId, visitId),
    ])
    let sheet = saved?.sheet
    const existing = sheet ? pinsOf(sheet) : []
    const isNewPin = pin && !existing.some((p) => p.kind === pin.kind && p.id === pin.id)
    if (!sheet || isNewPin) {
      const pins = isNewPin ? [...existing, pin] : existing
      const built = await health.buildPrepSheet(memberId, visitId, { pins })
      // keep the original "added" time for pins that were already there
      built.sections = built.sections.map((s) => {
        if (s.type !== 'vital') return s
        const prev = sheet?.sections.find((p) => p.type === 'vital' && p.reading.id === s.reading.id)
        return prev && prev.type === 'vital' ? { ...s, pinnedAt: prev.pinnedAt } : s
      })
      const record: SavedPrepSheet = { memberId, visitId, sheet: built, savedAt: new Date().toISOString() }
      await store.savePrepSheet(record)
      sheet = built
    }
    const qSection = sheet.sections.find((s) => s.type === 'questions')
    const list: QuestionList = savedQuestions ?? {
      memberId,
      visitId,
      items: (qSection?.type === 'questions' ? qSection.items : []).map((q) => ({ id: q.id, text: q.text, checked: false, addedBy: 'agent' as const })),
      updatedAt: new Date().toISOString(),
    }
    return { sheet, family, list }
  }, [memberId, visitId, pin?.id])

  const list = questions ?? (state.status === 'success' ? state.data.list : null)

  const saveQuestions = async (next: QuestionList) => {
    const prev = list
    setQuestions(next) // optimistic
    try {
      await store.saveQuestionList(next)
    } catch {
      setQuestions(prev)
      toast("Couldn't save that change. Try again.")
    }
  }

  return (
    <div className="screen">
      <Header title="Visit prep" />
      <div className="scroll">
        <main className="col stack main" style={{ gap: 12 }}>
          <Async state={state} skeleton={<PrepSkeleton />} errorTitle="Couldn't build the prep sheet">
            {({ sheet, family }) => {
              const rel = relativeDay(sheet.startsAt, clock.now())
              const qSection = sheet.sections.find((s) => s.type === 'questions')
              return (
                <>
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="eyebrow">
                      For {sheet.forName} · {rel ?? weekdayMonthDay(sheet.startsAt)}
                    </span>
                    <h1 className="h1">{sheet.title}</h1>
                    <span style={{ fontSize: 15 }}>
                      {weekdayMonthDay(sheet.startsAt)} · {time(sheet.startsAt)} · {sheet.location}
                    </span>
                  </div>

                  {sheet.sections.map((s) =>
                    s.type === 'questions' ? (
                      list && <QuestionsCard key={s.id} title={s.title} list={list} onChange={saveQuestions} />
                    ) : (
                      <Section key={s.id} section={s} />
                    ),
                  )}
                  {!qSection && list && <QuestionsCard title="Questions to ask" list={list} onChange={saveQuestions} />}

                  <p className="source-line">
                    <Icon name="doc" size={14} color="#535458" />
                    Built from {sheet.sources.length} records in {sheet.sourcesFrom} ·{' '}
                    <button className="link-btn no-print" onClick={() => setSourcesOpen(true)}>
                      View sources
                    </button>
                  </p>

                  <div className="btn-row no-print" style={{ marginTop: 8 }}>
                    <button className="btn btn--primary btn--48" onClick={() => setShareOpen(true)}>
                      Share with family
                    </button>
                    <button className="btn btn--outline btn--48" onClick={() => window.print()}>
                      Print or PDF
                    </button>
                  </div>

                  {sourcesOpen && (
                    <Sheet title={`Sources · ${sheet.sources.length} records`} onClose={() => setSourcesOpen(false)}>
                      <p className="p muted">Everything on this sheet comes from these records. Tap one to read it.</p>
                      <SourceChips memberId={memberId} sources={sheet.sources} />
                    </Sheet>
                  )}
                  {shareOpen && (
                    <ShareSheet
                      family={family}
                      aboutMemberId={memberId}
                      summary={sheet.shareSummary}
                      refTo={{ kind: 'prep-sheet', id: sheet.id }}
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
