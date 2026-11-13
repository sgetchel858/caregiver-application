/**
 * The mock agent. Demo questions always return the designed answers, with
 * tolerance for rewording and small typos. Anything else gets a polite
 * "I can only answer from Mom's records in this demo".
 */
import type { AgentAnswer, AnswerAction, BpReading, Clinician, Suggestion } from '../types'
import type { SceneId } from '../demo/demoState'
import {
  bpReadings,
  careTeam,
  hubDoseLog,
  medications,
  visits,
  MARGARET,
} from './fixtures/health'
import { longDate, monthDay, monthDayYear, parseLocal, relativeDay, time, weekdayMonthDay } from '../../lib/format'

export interface AskContext {
  scene: SceneId
  now: Date
  memberId: string | null
  /** facility of the current encounter, if any */
  atFacility: string | null
}

/* ---------------- matching ---------------- */

export function normalize(q: string): string {
  return q
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/x[\s-]?rays?/g, ' xray ')
    .replace(/blood[\s-]*pressure/g, ' bp ')
    .replace(/b\.\s?p\.?/g, ' bp ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/** word-prefix match, plus one-typo tolerance for longer words */
function matcher(normalized: string) {
  const tokens = normalized.split(' ')
  return (...words: string[]) =>
    words.some((w) =>
      tokens.some((t) => t.startsWith(w) || (w.length >= 6 && (lev(t, w) <= 1 || lev(t.slice(0, w.length), w) <= 1))),
    )
}

/* ---------------- helpers over fixtures ---------------- */

const team = () => careTeam[MARGARET]
const clinician = (id: string) => team().find((c) => c.id === id)!

const roleNoun: Record<string, string> = {
  GP: 'GP',
  Dentist: 'dentist',
  Neurology: 'neurologist',
  Cardiology: 'cardiologist',
}

function readingsUpTo(now: Date): BpReading[] {
  return bpReadings[MARGARET].filter((r) => parseLocal(r.takenAt) <= now)
}

function nextVisit(now: Date) {
  return visits[MARGARET].filter((v) => parseLocal(v.startsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
}

function base(question: string, ctx: AskContext): Omit<AgentAnswer, 'blocks' | 'sources'> {
  return {
    id: `ans-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    memberId: ctx.memberId,
    question,
    kind: 'answer',
    actions: [],
    followUps: [],
  }
}

/* ---------------- answer cards (shared with the live Cognatum answers) ---------------- */

/** Mom's latest BP with its trend, plus "Add to … prep" and "All readings" */
export function bpCard(now: Date): { block: AgentAnswer['blocks'][number]; latest: BpReading; actions: AnswerAction[] } {
  const readings = readingsUpTo(now)
  const latest = readings[readings.length - 1]
  const by = clinician(latest.clinicianId)
  const trend = readings.filter((r) => r.clinicianId === by.id).slice(-3)
  const actions: AnswerAction[] = []
  const upcoming = nextVisit(now)
  if (upcoming) {
    const rel = relativeDay(upcoming.startsAt, now)
    actions.push({
      kind: 'add-to-prep',
      label: rel === 'Tomorrow' ? "Add to tomorrow's prep" : rel === 'Today' ? "Add to today's prep" : 'Add to visit prep',
      visitId: upcoming.id,
      pin: { kind: 'vital', id: latest.id },
      style: 'primary',
    })
  }
  actions.push({ kind: 'show-vitals', label: 'All readings', vitalType: 'bp', style: 'secondary' })
  return {
    block: { type: 'bp-reading', label: 'Blood pressure', reading: latest, trendLabel: `Last ${trend.length} visits with ${by.name}`, trend },
    latest,
    actions,
  }
}

/** Mom's warfarin doses this week from the kitchen hub */
export function doseLogCard(now: Date): AgentAnswer['blocks'][number] {
  const med = medications[MARGARET].find((m) => m.id === 'med-warfarin')!
  const log = hubDoseLog.filter((d) => d.takenAt && parseLocal(d.takenAt) <= now).slice(-7)
  const last = log[log.length - 1]
  const lastAt = last.takenAt!
  const rel = relativeDay(lastAt, now)
  const headline = rel === 'Yesterday' ? `Last night, ${time(lastAt)}` : rel === 'Today' ? `Today, ${time(lastAt)}` : `${weekdayMonthDay(lastAt)}, ${time(lastAt)}`
  const taken = log.filter((d) => d.takenAt).length
  const prescriber = clinician(med.prescriberId)
  return {
    type: 'dose-log',
    headline,
    detail: `${weekdayMonthDay(lastAt)} · logged on Mom's kitchen hub`,
    weekLabel: 'Evening doses this week',
    days: log.map((d, i) => ({
      label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parseLocal(d.date)),
      taken: !!d.takenAt,
      latest: i === log.length - 1,
    })),
    summary: taken === log.length ? `Taken all ${taken} evenings` : `Taken ${taken} of ${log.length} evenings`,
    medication: {
      title: `**${med.name}** ${med.strength} · once ${med.schedule}`,
      lines: [
        `Prescribed by ${prescriber.name}, ${prescriber.role.toLowerCase()}`,
        `Last refill ${monthDay(med.lastRefill!.date)} · ${med.lastRefill!.pharmacy}`,
      ],
    },
  }
}

/* ---------------- scripted answers ---------------- */

function bpAnswer(question: string, ctx: AskContext, named: Clinician | undefined): AgentAnswer {
  const readings = readingsUpTo(ctx.now)
  const latest = readings[readings.length - 1]
  const by = clinician(latest.clinicianId)
  const blocks: AgentAnswer['blocks'] = []

  const namedHasReadings = named && readings.some((r) => r.clinicianId === named.id)
  if (named && !namedHasReadings) {
    blocks.push({
      type: 'text',
      style: 'tint',
      text:
        `Quick heads-up: **${named.name} is Mom's ${roleNoun[named.role] ?? named.role.toLowerCase()}** at ${named.practice}, ` +
        `and her chart has no blood pressure from that office.\n\n` +
        `Her most recent reading was with her ${roleNoun[by.role] ?? 'doctor'}, **${by.name}**:`,
    })
  } else {
    blocks.push({
      type: 'text',
      style: 'tint',
      text: `Her most recent reading was with her ${roleNoun[by.role] ?? 'doctor'}, **${by.name}**:`,
    })
  }

  const card = bpCard(ctx.now)
  blocks.push(card.block)
  const actions = card.actions

  const sources = [{ recordId: latest.recordId, label: `Visit summary · ${monthDay(latest.takenAt)}` }]
  if (named) sources.push({ recordId: 'rec-care-team', label: 'Care team list' })

  return { ...base(question, ctx), blocks, sources, actions }
}

function ankleAnswer(question: string, ctx: AskContext): AgentAnswer {
  const here = ctx.atFacility?.startsWith("St. Luke's")
  const blocks: AgentAnswer['blocks'] = [
    {
      type: 'big-value',
      value: '2019',
      text: `She broke her **right ankle** on **${longDate('2019-03-14')}** and was seen in the emergency room ${here ? "here at St. Luke's" : "at St. Luke's Medical Center"}.`,
    },
  ]
  if (here) {
    blocks.push({
      type: 'note',
      text: 'Good to know: this hospital already has those records, so the team can pull them up by her name and date of birth.',
    })
  }
  const followUps: Suggestion[] = [
    { label: 'Where were the X-rays taken?', question: 'Where were the X-rays taken, and what did they find?' },
  ]
  if (ctx.atFacility) followUps.push({ label: 'Show to nurse', action: 'show-to-nurse' })
  return {
    ...base(question, ctx),
    blocks,
    sources: [{ recordId: 'rec-er-2019-03-14', label: `ER visit note · ${monthDayYear('2019-03-14')}` }],
    followUps,
  }
}

function xrayAnswer(question: string, ctx: AskContext): AgentAnswer {
  return {
    ...base(question, ctx),
    blocks: [
      {
        type: 'timeline',
        entries: [
          {
            eyebrow: `${monthDayYear('2019-03-14')} · First X-rays`,
            place: "St. Luke's Medical Center, ER",
            text: "A small, clean break in the outer ankle bone. The bones stayed lined up, so she didn't need surgery.",
            quote: { label: "Radiologist's wording", text: 'Non-displaced fracture of the right lateral malleolus.' },
          },
          {
            eyebrow: `${monthDayYear('2019-05-02')} · Follow-up`,
            place: 'Valley Imaging Center',
            text: 'The break had fully healed.',
          },
        ],
      },
    ],
    sources: [
      { recordId: 'rec-rad-2019-03-14', label: `Radiology report · ${monthDayYear('2019-03-14')}` },
      { recordId: 'rec-rad-2019-05-02', label: `Radiology report · ${monthDayYear('2019-05-02')}` },
    ],
    followUps: [{ label: 'When did she last take her warfarin?', question: 'When did she last take her warfarin?' }],
  }
}

function warfarinAnswer(question: string, ctx: AskContext): AgentAnswer {
  const med = medications[MARGARET].find((m) => m.id === 'med-warfarin')!
  const prescriber = clinician(med.prescriberId)
  const actions: AnswerAction[] = ctx.atFacility ? [{ kind: 'show-to-nurse', label: 'Show answers to the nurse', style: 'dock' }] : []

  return {
    ...base(question, ctx),
    blocks: [
      doseLogCard(ctx.now),
      {
        type: 'note',
        text: 'Her prescription and refills come from MyChart. The time she took it comes from her kitchen hub log.',
      },
    ],
    sources: [
      { recordId: 'rec-hub-log', label: 'Hub dose log' },
      { recordId: 'rec-rx-warfarin', label: `Prescription · ${prescriber.name}` },
    ],
    actions,
  }
}

function medsAnswer(question: string, ctx: AskContext): AgentAnswer {
  const meds = medications[MARGARET]
  return {
    ...base(question, ctx),
    blocks: [
      { type: 'text', style: 'tint', text: `Mom takes **${meds.length} medications**:` },
      {
        type: 'list',
        items: meds.map((m) => {
          const c = clinician(m.prescriberId)
          return {
            primary: `**${m.name}** ${m.strength} · ${m.schedule}`,
            secondary: `${c.role === 'GP' ? c.name : `${c.name}, ${c.role.toLowerCase()}`} · ${m.purpose}`,
          }
        }),
      },
    ],
    sources: [{ recordId: 'rec-med-list', label: `Medication list · ${monthDay('2026-10-28')}` }],
  }
}

function cardiologistAnswer(question: string, ctx: AskContext): AgentAnswer {
  const c = team().find((t) => t.role === 'Cardiology')!
  return {
    ...base(question, ctx),
    blocks: [
      {
        type: 'text',
        style: 'tint',
        text: `Her cardiologist is **${c.name}** at ${c.practice}. ${c.name} prescribes her warfarin.`,
      },
    ],
    sources: [{ recordId: 'rec-care-team', label: 'Care team list' }],
  }
}

function outOfScope(question: string, ctx: AskContext): AgentAnswer {
  const tryThis: Suggestion[] =
    ctx.scene === 'm1'
      ? [{ label: "Mom's last blood pressure", question: "What was Mom's last blood pressure?" }]
      : [{ label: 'When did Mom break her ankle?', question: 'What year did Mom break her ankle?' }]
  return {
    ...base(question, ctx),
    kind: 'out-of-scope',
    blocks: [
      {
        type: 'text',
        style: 'tint',
        text: "I can only answer from Mom's records in this demo. Try asking about her blood pressure, her medications, or her ankle injury.",
      },
    ],
    sources: [],
    followUps: tryThis,
  }
}

/* ---------------- router ---------------- */

export function answerQuestion(question: string, ctx: AskContext): AgentAnswer {
  const n = normalize(question)
  const has = matcher(n)

  // Questions about someone other than Mom are out of scope in this demo.
  const aboutMom = has('mom', 'mother', 'margaret', 'her', 'she')
  const aboutOther = has('dad', 'robert', 'mike', 'husband', 'emma', 'leo', 'kids', 'son')
  if (aboutOther && !aboutMom) return outOfScope(question, ctx)

  if (has('xray', 'radiolog', 'imaging', 'scan')) return xrayAnswer(question, ctx)
  if (has('ankle', 'fracture') || (has('broke', 'break') && has('year', 'when'))) return ankleAnswer(question, ctx)
  if (has('warfarin', 'coumadin', 'thinner') && has('last', 'when', 'dose', 'take', 'took', 'taken'))
    return warfarinAnswer(question, ctx)
  if (has('bp', 'pressure')) {
    const named = team().find((c) => has(c.name.replace('Dr. ', '').toLowerCase()))
    return bpAnswer(question, ctx, named)
  }
  if (has('cardiolog', 'heart')) return cardiologistAnswer(question, ctx)
  if (has('meds', 'medication', 'medicine', 'pills', 'prescription')) return medsAnswer(question, ctx)

  return outOfScope(question, ctx)
}
