import type { SilClient } from './SilClient'
import { SEED_ROOT_FOLDER } from './cognatumSeed'

/**
 * Recall test for the seeded Mitchell records: asks Margaret's Cognatum folder a
 * set of caregiver questions through SIL folder chat (POST /folders/{id}/chat)
 * and checks that each answer cites at least one expected record.
 *
 * Questions go out the way the /ask adapter will send them: "Mom" is replaced by
 * her name, because SIL only knows the documents, not the family's words.
 * `save_to_thread: false` keeps the test out of the folder's chat thread.
 */
const MEMBER_FOLDER = 'Margaret Mitchell'
/** SIL allows 30 chat calls a minute per user; stay well under it */
const MIN_GAP_MS = 2_500

export interface RecallCase {
  q: string
  /** pass when any of these is cited; empty = expect no citations (out of scope) */
  expect: string[]
}

export const RECALL_CASES: RecallCase[] = [
  { q: "What was Mom's BP at her last appointment with Dr. Green?", expect: ['rec-visit-2026-09-09', 'rec-care-team', 'rec-visit-2026-10-28'] },
  { q: "What was Mom's blood pressure at her last check-up?", expect: ['rec-visit-2026-10-28'] },
  { q: 'Has her blood pressure changed this year?', expect: ['rec-visit-2026-04-02', 'rec-visit-2026-07-14', 'rec-visit-2026-10-28'] },
  { q: 'What year did Mom break her ankle?', expect: ['rec-er-2019-03-14', 'rec-rad-2019-03-14'] },
  { q: 'when did mom break her ankle', expect: ['rec-er-2019-03-14', 'rec-rad-2019-03-14'] },
  { q: 'Where were the X-rays taken, and what did they find?', expect: ['rec-rad-2019-03-14', 'rec-rad-2019-05-02'] },
  { q: 'Did her ankle heal?', expect: ['rec-rad-2019-05-02'] },
  { q: 'When did she last take her warfarin?', expect: ['rec-hub-log'] },
  { q: 'last warfarin dose', expect: ['rec-hub-log'] },
  { q: 'Did Mom take her blood thinner every night this week?', expect: ['rec-hub-log'] },
  { q: 'What meds is Mom on?', expect: ['rec-med-list'] },
  { q: 'Who prescribed her warfarin?', expect: ['rec-rx-warfarin', 'rec-med-list'] },
  { q: 'When was her warfarin last refilled?', expect: ['rec-rx-warfarin'] },
  { q: "Who's her cardiologist?", expect: ['rec-care-team'] },
  { q: "What's her GP's phone number?", expect: ['rec-care-team'] },
  { q: 'Is Mom allergic to anything?', expect: ['rec-allergies', 'rec-profile'] },
  { q: 'Why is Mom seeing a neurologist?', expect: ['rec-referral-neuro', 'rec-visit-2026-10-28', 'rec-appt-okafor'] },
  { q: 'When is her neurology appointment?', expect: ['rec-appt-okafor'] },
  { q: 'What should she bring to the neurology appointment?', expect: ['rec-appt-okafor'] },
  { q: 'What does she take for her thyroid?', expect: ['rec-med-list'] },
  { q: 'How old is Mom?', expect: ['rec-profile'] },
  { q: "What's the weather in Boston tomorrow?", expect: [] },
  { q: 'Should Mom stop taking warfarin?', expect: ['rec-rx-warfarin', 'rec-med-list', 'rec-hub-log'] },
]

export interface RecallRow {
  q: string
  sent: string
  pass: boolean
  expected: string[]
  cited: string[]
  notCovered: boolean
  answer: string
  error?: string
}

interface ChatResponse {
  answer: string
  citations: { document_id: string; title?: string | null }[]
  not_covered?: boolean | null
}

/** "Mom" → her name, the way the /ask adapter will rewrite questions */
export function adaptQuestion(q: string, name = 'Margaret'): string {
  return q.replace(/\b[Mm]om's\b/g, `${name}'s`).replace(/\b[Mm]om\b/g, name)
}

export async function runRecallTest(sil: SilClient, onProgress: (line: string) => void): Promise<RecallRow[]> {
  const { folders: roots } = await sil.request<{ folders: { id: string; name: string }[] }>('GET', '/folders?limit=200')
  const root = roots.find((f) => f.name === SEED_ROOT_FOLDER)
  if (!root) throw new Error('Seed the Mitchell records first')
  const { folders: members } = await sil.request<{ folders: { id: string; name: string }[] }>('GET', `/folders?parent_id=${root.id}&limit=200`)
  const member = members.find((f) => f.name === MEMBER_FOLDER)
  if (!member) throw new Error('Seed the Mitchell records first')

  // document id → record id, from the " - <recordId>.md" file names
  const recordOf = new Map<string, string>()
  const { folders: subs } = await sil.request<{ folders: { id: string }[] }>('GET', `/folders?parent_id=${member.id}&limit=200`)
  for (const sub of subs) {
    const { documents } = await sil.request<{ documents: { id: string; filename: string }[] }>('GET', `/folders/${sub.id}/documents?limit=200`)
    for (const d of documents) recordOf.set(d.id, d.filename.match(/ - (rec-[\w-]+)\.md$/)?.[1] ?? d.filename)
  }

  const rows: RecallRow[] = []
  for (const [i, c] of RECALL_CASES.entries()) {
    onProgress(`Question ${i + 1} of ${RECALL_CASES.length}…`)
    const started = Date.now()
    const sent = adaptQuestion(c.q)
    try {
      const r = await sil.request<ChatResponse>('POST', `/folders/${member.id}/chat`, {
        question: sent,
        history: [],
        include_subfolders: true,
        stream: false,
        save_to_thread: false,
      })
      const cited = [...new Set(r.citations.map((x) => recordOf.get(x.document_id) ?? x.title ?? x.document_id))]
      const pass = c.expect.length === 0 ? cited.length === 0 : c.expect.some((id) => cited.includes(id))
      rows.push({ q: c.q, sent, pass, expected: c.expect, cited, notCovered: !!r.not_covered, answer: r.answer })
    } catch (e) {
      rows.push({ q: c.q, sent, pass: false, expected: c.expect, cited: [], notCovered: false, answer: '', error: String(e) })
    }
    const wait = MIN_GAP_MS - (Date.now() - started)
    if (wait > 0) await new Promise((res) => setTimeout(res, wait))
  }
  return rows
}
