import type { AgentAnswer, AnswerAction, AnswerBlock, AskRequest, SourceRef, Suggestion } from '../types'
import type { SilClient } from './SilClient'
import { MockHealthApi } from '../mock/MockHealthApi'
import { bpCard, doseLogCard } from '../mock/scriptedAnswers'
import * as fx from '../mock/fixtures/health'
import { demoState } from '../demo/demoState'
import { SEED_ROOT_FOLDER } from './cognatumSeed'
import { ServiceError } from '../errors'
import { monthDay, monthDayYear } from '../../lib/format'

/**
 * The Ask agent on Cognatum: records stay on the demo fixtures, but `ask()` can
 * answer from the member's documents in Cognatum through SIL folder chat
 * (POST /folders/{id}/chat). The demo menu's "Ask answers" switch picks:
 *
 *   scripted  every question gets the designed demo answer (MockHealthApi)
 *   hybrid    the demo questions stay scripted; anything else goes to Cognatum
 *   live      every question goes to Cognatum
 *
 * SIL returns prose with [n] citation markers and no answer schema, so this
 * class is the adapter: it maps citations to record ids (the seeded file names
 * end in " - <recordId>.md"), turns the prose into the app's blocks, adds the
 * typed cards (BP, dose log) from our own records, and adds the "ask the doctor"
 * route that the FLOW.md guardrail requires for advice questions.
 *
 * Runs in the browser, so it needs the Vite proxy locally (SIL's CORS never
 * admits localhost). A hosted build needs this moved behind a server or the
 * app's origin in SIL's CORS_ORIGINS.
 */

/** the member's folder in Cognatum, and which family word to swap for their name */
const MEMBERS: Record<string, { folder: string; name: string; word: RegExp; called: string }> = {
  [fx.MARGARET]: { folder: 'Margaret Mitchell', name: 'Margaret', word: /\b[Mm]om\b/g, called: 'Mom' },
}

interface SilDoc {
  id: string
  filename: string
}
interface MemberDocs {
  folderId: string
  docs: { id: string; recordId: string; date: string; isAppointment: boolean }[]
}
interface ChatResponse {
  answer: string
  citations: { document_id: string; title?: string | null }[]
  not_covered?: boolean | null
  suggestions?: string[] | null
}
type Turn = { role: 'user' | 'assistant'; text: string }

const MAX_HISTORY = 20
const ADVICE = /\b(should|safe|okay|ok to|alright to|stop|quit|skip|increase|decrease|double|change (her|the) dose|is it bad|can she take|can mom take)\b/i

export class CognatumAskHealthApi extends MockHealthApi {
  private folders = new Map<string, Promise<MemberDocs>>()
  private threads = new Map<string, Turn[]>()

  constructor(private sil: SilClient) {
    super()
  }

  override async ask(req: AskRequest): Promise<AgentAnswer> {
    const mode = demoState.get().askMode
    if (mode === 'scripted') return super.ask(req)
    if (mode === 'hybrid') {
      const scripted = await super.ask(req)
      if (scripted.kind === 'answer') return scripted
    }
    return this.askCognatum(req)
  }

  private async askCognatum(req: AskRequest): Promise<AgentAnswer> {
    const memberId = req.memberId ?? fx.MARGARET
    const now = this.clock.now()
    const base = {
      id: `ans-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      memberId,
      question: req.question,
      actions: [] as AnswerAction[],
      followUps: [] as Suggestion[],
    }
    const member = MEMBERS[memberId]
    if (!member) {
      const name = fx.profiles[memberId]?.firstName ?? 'Their'
      return {
        ...base,
        kind: 'out-of-scope',
        blocks: [{ type: 'text', style: 'tint', text: `${name === 'Their' ? 'Their' : `${name}'s`} records aren't connected yet, so I can't answer from them.` }],
        sources: [],
      }
    }

    const { folderId, docs } = await this.memberDocs(memberId, member.folder)
    // The demo clock: leave out documents dated after "now" (appointments are known ahead).
    const today = isoDate(now)
    const exclude = docs.filter((d) => d.date > today && !d.isAppointment).map((d) => d.id)
    const threadKey = req.threadId ?? `thread-${memberId}`
    const history = this.threads.get(threadKey) ?? []
    const question = req.question.replace(/\b[Mm]om's\b/g, `${member.name}'s`).replace(member.word, member.name)

    const body = {
      question,
      history,
      include_subfolders: true,
      exclude_document_ids: exclude,
      stream: false,
      save_to_thread: false,
    }
    // One automatic retry: a single transient SIL error shouldn't reach the screen mid-demo.
    const r = await this.sil
      .request<ChatResponse>('POST', `/folders/${folderId}/chat`, body)
      .catch((e: unknown) => {
        if (e instanceof ServiceError && e.retryable) return this.sil.request<ChatResponse>('POST', `/folders/${folderId}/chat`, body)
        throw e
      })

    const recordOf = new Map(docs.map((d) => [d.id, d.recordId]))
    const cited = [...new Set(r.citations.map((c) => recordOf.get(c.document_id)).filter((id): id is string => !!id))]
    // SIL also suggests "What does <file name> cover?"; only keep questions a family would ask.
    const followUps: Suggestion[] = (r.suggestions ?? [])
      .filter((s) => !/\.md\b|rec-[\w-]+|\d{4}-\d{2}-\d{2}|What does [“"]/.test(s))
      .slice(0, 3)
      .map((s) => ({ label: s, question: s }))
    this.remember(threadKey, question, r.answer)

    const advice = ADVICE.test(req.question)
    // SIL can flag not_covered and still cite what the records do say (e.g. "should she stop
    // warfarin?" → no advice in the chart, but here is her prescription). Only an uncited
    // reply is out of scope.
    if (cited.length === 0) {
      const blocks: AnswerBlock[] = [{ type: 'text', style: 'tint', text: `I couldn't find that in ${member.called}'s records.` }]
      if (advice) blocks.push({ type: 'note', text: adviceRoute(memberId, req.question, member.called) })
      return {
        ...base,
        kind: 'out-of-scope',
        blocks,
        sources: [],
        followUps,
      }
    }

    // Typed cards from our own records, when the answer leans on them.
    const cards: AnswerBlock[] = []
    const actions: AnswerAction[] = []
    // A BP question always shows her latest reading (the designed answer does too),
    // even when the visit asked about has none.
    const asksBp = /\b(bp|blood[\s-]*pressure)\b/i.test(req.question)
    if (asksBp && fx.bpReadings[memberId]?.length) {
      const card = bpCard(now)
      const by = fx.careTeam[memberId]?.find((c) => c.id === card.latest.clinicianId)
      if (!cited.some((id) => id === card.latest.recordId)) {
        cards.push({ type: 'text', style: 'plain', text: `Her most recent reading was with ${by ? `**${by.name}**` : 'her doctor'}:` })
        cited.push(card.latest.recordId)
      }
      cards.push(card.block)
      actions.push(...card.actions)
    }
    if (cited.includes('rec-hub-log') && /warfarin|thinner|dose|took|take/i.test(req.question)) {
      cards.push(doseLogCard(now))
    }
    if (this.encounterNow(memberId)) actions.push({ kind: 'show-to-nurse', label: 'Show answers to the nurse', style: 'dock' })

    const blocks = proseToBlocks(r.answer, member.called, cards.some((c) => c.type !== 'text'), member.name)
    blocks.push(...cards)
    if (advice) blocks.push({ type: 'note', text: adviceRoute(memberId, req.question, member.called) })

    return { ...base, kind: 'answer', blocks, sources: sourcesFor(cited, now), actions, followUps }
  }

  private memberDocs(memberId: string, folderName: string): Promise<MemberDocs> {
    let p = this.folders.get(memberId)
    if (!p) {
      p = this.loadMemberDocs(folderName).catch((e) => {
        this.folders.delete(memberId) // let a retry look it up again
        throw e
      })
      this.folders.set(memberId, p)
    }
    return p
  }

  private async loadMemberDocs(folderName: string): Promise<MemberDocs> {
    type F = { folders: { id: string; name: string }[] }
    const { folders: roots } = await this.sil.request<F>('GET', '/folders?limit=200')
    const root = roots.find((f) => f.name === SEED_ROOT_FOLDER)
    const members = root ? (await this.sil.request<F>('GET', `/folders?parent_id=${root.id}&limit=200`)).folders : []
    const folder = members.find((f) => f.name === folderName)
    if (!folder) throw new Error(`No "${folderName}" folder in Cognatum. Seed the Mitchell records from the demo menu.`)
    const { folders: subs } = await this.sil.request<F>('GET', `/folders?parent_id=${folder.id}&limit=200`)
    const docs: MemberDocs['docs'] = []
    for (const sub of subs) {
      const { documents } = await this.sil.request<{ documents: SilDoc[] }>('GET', `/folders/${sub.id}/documents?limit=200`)
      for (const d of documents) {
        // "Margaret Mitchell - Visit summary - 2026-10-28 - rec-visit-2026-10-28.md"
        const m = d.filename.match(/ - (\d{4}-\d{2}-\d{2}) - (rec-[\w-]+)\.md$/)
        if (m) docs.push({ id: d.id, date: m[1], recordId: m[2], isAppointment: / - Appointment /.test(d.filename) })
      }
    }
    return { folderId: folder.id, docs }
  }

  private remember(key: string, question: string, answer: string) {
    const turns = this.threads.get(key) ?? []
    turns.push({ role: 'user', text: question.slice(0, 4000) }, { role: 'assistant', text: stripCitations(answer).slice(0, 4000) || '…' })
    this.threads.set(key, turns.slice(-MAX_HISTORY))
  }
}

/* ---------------- mapping SIL prose to the app's blocks ---------------- */

function stripCitations(text: string): string {
  return text.replace(/\s?(\[\d+\])+/g, '')
}

/**
 * The app's rich text is **bold** and paragraphs only. Tables and bullets become
 * list blocks (tables are dropped when a typed card already shows the same data),
 * headings become bold lines, and SIL's own words for its sources become "records".
 */
export function proseToBlocks(answer: string, called: string, hasCard: boolean, name?: string): AnswerBlock[] {
  let text = stripCitations(answer)
    // "2026-09-09" → "Sep 9, 2026", the way the app writes dates
    .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) => monthDayYear(d))
  // the family's word for her, as everywhere else in the app (not inside quotes from the record)
  if (name) text = text.replace(new RegExp(`\\b${name}(?! Mitchell)('s)?\\b`, 'g'), (_m, s: string | undefined) => `${called}${s ?? ''}`)
  text = text
    .replace(/\b(the|these|those) (passages|documents|excerpts)\b/gi, `${called}'s records`)
    .replace(/\bthe records provided\b/gi, `${called}'s records`)
    .replace(/\bpassages\b/g, 'records')
    .replace(/\bpassage\b/g, 'record')
  const blocks: AnswerBlock[] = []
  let para: string[] = []
  let list: { primary: string; secondary?: string }[] = []
  let table: string[][] = []

  const inline = (s: string) =>
    s
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2') // *italic* → plain
      .replace(/__([^_]+)__/g, '**$1**')
      .trim()
  const pushText = (t: string) => blocks.push({ type: 'text', style: blocks.length === 0 ? 'tint' : 'plain', text: t })
  const flushPara = () => {
    const t = para.join(' ').trim()
    if (t) pushText(inline(t))
    para = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', items: list })
    list = []
  }
  const flushTable = () => {
    if (table.length > 1 && !hasCard) {
      const [, ...rows] = table
      blocks.push({
        type: 'list',
        items: rows.map((cells) => ({ primary: inline(cells[0] ?? ''), secondary: cells.slice(1).map(inline).filter(Boolean).join(' · ') || undefined })),
      })
    }
    table = []
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('|')) {
      flushPara()
      flushList()
      if (/^\|[\s:|-]+\|?$/.test(line)) continue // the |---|---| separator
      table.push(line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
      continue
    }
    flushTable()
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (bullet) {
      flushPara()
      list.push({ primary: inline(bullet[1]) })
      continue
    }
    flushList()
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      flushPara()
      pushText(`**${inline(heading[1]).replace(/\*\*/g, '')}**`)
      continue
    }
    if (!line) {
      flushPara()
      continue
    }
    para.push(line)
  }
  flushTable()
  flushList()
  flushPara()
  if (blocks.length === 0) pushText('Here is what her records say.')
  return blocks
}

function sourcesFor(recordIds: string[], now: Date): SourceRef[] {
  const out: SourceRef[] = []
  for (const id of recordIds) {
    const r = fx.records[id]
    if (!r) continue // only records the app can open
    const dated = r.kind !== 'hub-log' && r.kind !== 'care-team' && r.kind !== 'profile'
    // "Visit summary · Oct 28", but "Radiology report · May 2, 2019" for another year
    const when = r.date.startsWith(String(now.getFullYear())) ? monthDay(r.date) : monthDayYear(r.date)
    out.push({ recordId: id, label: dated ? `${r.title} · ${when}` : r.title })
  }
  return out
}

/** FLOW.md guardrail: show what the chart says, then route the decision to a doctor */
function adviceRoute(memberId: string, question: string, called: string): string {
  const q = question.toLowerCase()
  const meds = fx.medications[memberId] ?? []
  const team = fx.careTeam[memberId] ?? []
  const med = meds.find((m) => q.includes(m.name.toLowerCase()) || (m.purpose && q.includes(m.purpose.toLowerCase())))
  const primary = fx.profiles[memberId]?.primaryClinicianId
  const doctor = team.find((c) => c.id === (med?.prescriberId ?? primary)) ?? team[0]
  const who = doctor ? `**${doctor.name}**${doctor.phone ? ` (${doctor.phone})` : ''}` : 'her doctor'
  return `I can't give medical advice. ${med ? `For a decision about her ${med.name.toLowerCase()}, ask` : 'Before changing anything, check with'} ${who}${med ? `, who prescribed it` : ''}. ${called}'s care team can tell you what's right for her.`
}

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
