import type { HealthApi } from '../HealthApi'
import type { Clock } from '../Clock'
import type {
  AgentAnswer,
  CalendarSummary,
  DateRange,
  VisitReadiness,
  AskRequest,
  AskSuggestions,
  CareTeamFollowUp,
  Clinician,
  DrugMatch,
  Encounter,
  FamilyBriefing,
  InteractionCheck,
  InteractionCheckItem,
  InteractionFinding,
  MemberProfile,
  Medication,
  MessageDraft,
  NewMedication,
  NurseCard,
  PrepPin,
  PrepSection,
  PrepSheet,
  RecordDetail,
  SentMessage,
  VitalReading,
  Visit,
} from '../types'
import { ServiceError } from '../errors'
import { demoState, SCENES } from '../demo/demoState'
import { simulate } from './latency'
import { answerQuestion } from './scriptedAnswers'
import * as fx from './fixtures/health'
import { monthDay, parseLocal, time, weekdayMonthDay, monthYear } from '../../lib/format'

/** the mock clock follows the demo scene */
export const mockClock: Clock = {
  now: () => parseLocal((SCENES.find((s) => s.id === demoState.get().scene) ?? SCENES[0]).now),
}

function need<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new ServiceError('not-found', `${what} not found`)
  return value
}

const clinicianLabel = (c: Clinician) => (c.role === 'GP' ? c.name : `${c.name}, ${c.role.toLowerCase()}`)

/* ---------------- interaction checks (kept in session storage) ---------------- */

interface StoredCheck {
  check: InteractionCheck
  drugId: string | null
  startedAt: number
  /** ms after start when each item resolves */
  resolveAt: Record<string, number>
  /** final results */
  final: Record<string, Pick<InteractionCheckItem, 'result' | 'resultLabel'>>
  findings: InteractionFinding[]
}

const CHECKS_KEY = 'casante-demo:checks'

function loadChecks(): Record<string, StoredCheck> {
  try {
    return JSON.parse(sessionStorage.getItem(CHECKS_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function saveChecks(all: Record<string, StoredCheck>) {
  try {
    sessionStorage.setItem(CHECKS_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

function findDrug(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  const first = q.split(/\s+/)[0]
  return fx.drugs.find((d) => d.aliases.some((a) => a.startsWith(first) || first.startsWith(a)))
}

export class MockHealthApi implements HealthApi {
  constructor(private clock: Clock = mockClock) {}

  private scene() {
    return demoState.get().scene
  }

  private profileOf(memberId: string): MemberProfile {
    return need(fx.profiles[memberId], 'Member')
  }

  private teamOf(memberId: string): Clinician[] {
    return need(fx.careTeam[memberId], 'Care team')
  }

  private encounterNow(memberId: string): Encounter | null {
    if (memberId !== fx.MARGARET) return null
    const e = fx.encounters[this.scene()]
    return e ? { id: 'enc-stlukes-2026-11-14', kind: 'emergency', ...e } : null
  }

  /* ---------------- medical information ---------------- */

  getFamilyBriefing(memberIds: string[]): Promise<FamilyBriefing> {
    return simulate(() => {
      const b = fx.briefings[this.scene()]
      return {
        nudges: b.nudges
          .filter((n) => memberIds.includes(n.memberId))
          .map((n, i) => ({ id: `nudge-${i}`, memberId: n.memberId, text: n.text })),
        statuses: memberIds.filter((id) => b.statuses[id]).map((id) => ({ memberId: id, line: b.statuses[id], recordsConnected: !!fx.profiles[id] })),
      }
    })
  }

  getProfile(memberId: string): Promise<MemberProfile> {
    return simulate(() => this.profileOf(memberId))
  }

  getMedications(memberId: string): Promise<Medication[]> {
    return simulate(() => need(fx.medications[memberId], 'Medications'))
  }

  getCareTeam(memberId: string): Promise<Clinician[]> {
    return simulate(() => this.teamOf(memberId))
  }

  getVisits(memberId: string, opts?: { upcoming?: boolean }): Promise<Visit[]> {
    return simulate(() => {
      const now = this.clock.now()
      const all = [...need(fx.visits[memberId], 'Visits')].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      return opts?.upcoming ? all.filter((v) => parseLocal(v.startsAt) > now) : all.filter((v) => parseLocal(v.startsAt) <= now)
    })
  }

  getVitals(memberId: string, type: 'bp'): Promise<VitalReading[]> {
    return simulate(() => {
      if (type !== 'bp') return []
      const now = this.clock.now()
      return need(fx.bpReadings[memberId], 'Vitals').filter((r) => parseLocal(r.takenAt) <= now)
    })
  }

  getRecord(memberId: string, recordId: string): Promise<RecordDetail> {
    return simulate(() => {
      this.profileOf(memberId)
      return need(fx.records[recordId], 'Record')
    })
  }

  getCurrentEncounter(memberId: string): Promise<Encounter | null> {
    return simulate(() => this.encounterNow(memberId))
  }

  /* ---------------- agent ---------------- */

  getAskSuggestions(memberId: string): Promise<AskSuggestions> {
    return simulate(() => (memberId === fx.MARGARET ? fx.askSuggestions[this.scene()] : { prompts: [] }))
  }

  ask(req: AskRequest): Promise<AgentAnswer> {
    return simulate(() => {
      const memberId = req.memberId ?? fx.MARGARET
      const enc = this.encounterNow(memberId)
      return answerQuestion(req.question, {
        scene: this.scene(),
        now: this.clock.now(),
        memberId,
        atFacility: enc?.facility ?? null,
      })
    }, 'agent')
  }

  lookupDrug(query: string): Promise<DrugMatch | null> {
    return simulate(() => {
      const d = findDrug(query)
      return d ? { id: d.id, name: d.name, strength: d.strength, drugClass: d.drugClass } : null
    })
  }

  startInteractionCheck(memberId: string, med: NewMedication): Promise<InteractionCheck> {
    return simulate(() => {
      const meds = need(fx.medications[memberId], 'Medications')
      const profile = this.profileOf(memberId)
      const team = this.teamOf(memberId)
      const drug = findDrug(med.name)
      const id = `chk-${Date.now().toString(36)}`

      const items: InteractionCheckItem[] = [
        ...meds.map((m) => ({
          id: m.id,
          kind: 'medication' as const,
          label: `${m.name} ${m.strength}`,
          sublabel: clinicianLabel(team.find((c) => c.id === m.prescriberId)!),
          result: 'pending' as const,
        })),
        ...profile.allergies.map((a) => ({
          id: `allergy-${a.substance.toLowerCase()}`,
          kind: 'allergy' as const,
          label: `${a.substance} allergy`,
          sublabel: 'From her chart',
          result: 'pending' as const,
        })),
      ]

      const final: StoredCheck['final'] = {}
      const findings: InteractionFinding[] = []
      for (const item of items) {
        if (item.kind === 'medication') {
          const hit = drug && fx.interactionTable.find((r) => r.drugId === drug.id && r.medicationId === item.id)
          if (hit) {
            final[item.id] = { result: hit.severity, resultLabel: 'Major interaction' }
            findings.push({ id: `f-${item.id}`, severity: hit.severity, itemId: item.id, title: hit.title, summary: hit.summary, sections: hit.sections })
          } else {
            final[item.id] = { result: 'clear', resultLabel: 'No major interaction' }
          }
        } else {
          const substance = item.label.replace(' allergy', '').toLowerCase()
          if (drug?.isPenicillin && substance === 'penicillin') {
            final[item.id] = { result: 'major', resultLabel: 'Allergy match' }
            findings.push({
              id: `f-${item.id}`,
              severity: 'major',
              itemId: item.id,
              title: `${drug.name} + penicillin allergy`,
              summary: `${drug.name} is a penicillin. Her chart lists a penicillin allergy (hives).`,
              sections: [{ title: 'What care teams often do', text: 'Choose an antibiotic from a different family.' }],
            })
          } else {
            final[item.id] = { result: 'clear', resultLabel: `Not a ${substance}` }
          }
        }
      }

      // Clear items resolve in order; anything flagged resolves last and slowest.
      const slow = demoState.get().slowNetwork ? 2 : 1
      const resolveAt: Record<string, number> = {}
      let t = 0
      for (const item of items.filter((i) => final[i.id].result === 'clear')) resolveAt[item.id] = (t += 850 * slow)
      for (const item of items.filter((i) => final[i.id].result !== 'clear')) resolveAt[item.id] = (t += 1700 * slow)

      const doctors = new Set(meds.map((m) => m.prescriberId)).size
      const check: InteractionCheck = {
        id,
        memberId,
        status: 'running',
        drug: {
          name: drug?.name ?? med.name.split(/\s+/)[0],
          label: med.name,
          drugClass: drug?.drugClass ?? 'Medication',
        },
        scopeLine: `Against Mom's ${meds.length} medications from ${doctors} doctors, and her allergies`,
        items,
        findings: [],
        source: { recordId: 'rec-interaction-cipro-warfarin', label: 'drug-interaction database' },
        disclaimer: "This doesn't replace her care team. Don't stop or change any medicine without asking them.",
      }
      const all = loadChecks()
      all[id] = { check, drugId: drug?.id ?? null, startedAt: Date.now(), resolveAt, final, findings }
      saveChecks(all)
      return check
    }, 'write')
  }

  getInteractionCheck(checkId: string): Promise<InteractionCheck> {
    return simulate(() => {
      const stored = need(loadChecks()[checkId], 'Interaction check')
      const elapsed = Date.now() - stored.startedAt
      const items = stored.check.items.map((item) =>
        elapsed >= stored.resolveAt[item.id] ? { ...item, ...stored.final[item.id] } : item,
      )
      const done = items.every((i) => i.result !== 'pending')
      return {
        ...stored.check,
        items,
        status: done ? 'complete' : 'running',
        findings: stored.findings.filter((f) => items.find((i) => i.id === f.itemId)?.result !== 'pending'),
      }
    }, 'read')
  }

  buildPrepSheet(memberId: string, visitId: string, opts?: { pins?: PrepPin[] }): Promise<PrepSheet> {
    return simulate(() => {
      const profile = this.profileOf(memberId)
      const team = this.teamOf(memberId)
      const visit = need(fx.visits[memberId]?.find((v) => v.id === visitId), 'Visit')
      const content = need(fx.prepContent[visitId], 'Prep content')
      const doc = team.find((c) => c.id === visit.clinicianId)!
      const meds = fx.medications[memberId]

      const sections: PrepSection[] = [{ type: 'text', id: 'why', title: "Why she's going", text: content.why }]
      let pinnedBp: VitalReading | undefined
      for (const pin of opts?.pins ?? []) {
        const reading = fx.bpReadings[memberId]?.find((r) => r.id === pin.id)
        if (pin.kind === 'vital' && reading) {
          pinnedBp = reading
          sections.push({
            type: 'vital',
            id: `pin-${reading.id}`,
            title: 'Latest blood pressure',
            reading,
            clinicianName: team.find((c) => c.id === reading.clinicianId)!.name,
            pinnedAt: new Date().toISOString(),
          })
        }
      }
      sections.push({
        type: 'medications',
        id: 'meds',
        title: `Current medications · ${meds.length}`,
        items: meds.map((m) => ({
          name: m.name,
          strength: m.strength,
          schedule: m.schedule,
          detail: `${clinicianLabel(team.find((c) => c.id === m.prescriberId)!)} · ${m.purpose}`,
        })),
      })
      sections.push({
        type: 'questions',
        id: 'questions',
        title: 'Questions to ask',
        items: content.questions.map((text, i) => ({ id: `q-${i + 1}`, text })),
      })

      const when = `${weekdayMonthDay(visit.startsAt)} at ${time(visit.startsAt)}`
      return {
        id: `prep-${visitId}`,
        memberId,
        visitId,
        forName: profile.firstName,
        title: `${doc.role} with ${doc.name}`,
        startsAt: visit.startsAt,
        location: visit.location,
        sections,
        sources: content.sourceIds.map((id) => ({
          recordId: id,
          label: `${fx.records[id].title} · ${monthDay(fx.records[id].date)}`,
        })),
        sourcesFrom: "Mom's MyChart",
        shareSummary:
          `Prep for Mom's ${doc.role.toLowerCase()} visit with ${doc.name}, ${when}. ` +
          (pinnedBp ? `Latest BP ${pinnedBp.systolic}/${pinnedBp.diastolic} (${monthDay(pinnedBp.takenAt)}). ` : '') +
          `${meds.length} current medications and ${content.questions.length} questions to ask.`,
        builtAt: new Date().toISOString(),
      }
    }, 'agent')
  }

  buildNurseCard(memberId: string): Promise<NurseCard> {
    return simulate(() => {
      const p = this.profileOf(memberId)
      const team = this.teamOf(memberId)
      const meds = need(fx.medications[memberId], 'Medications')
      const gp = team.find((c) => c.id === p.primaryClinicianId)!
      const thinner = meds.find((m) => m.purpose === 'blood thinner')
      const others = meds.filter((m) => m !== thinner)
      const here = this.encounterNow(memberId)?.facility.startsWith("St. Luke's")
      const injuries = fx.injuryHistory[memberId] ?? []

      const sections: NurseCard['sections'] = [
        { label: 'Allergy', boxed: true, lines: p.allergies.map((a) => ({ text: `${a.substance} (${a.reaction})`, size: 'xl' as const })) },
      ]
      if (thinner) {
        const lines: NurseCard['sections'][number]['lines'] = [{ text: `${thinner.name} ${thinner.strength} ${thinner.schedule}`, size: 'xl' }]
        if (thinner.lastDose) lines.push({ text: `Last dose: ${weekdayMonthDay(thinner.lastDose.takenAt)}, ${time(thinner.lastDose.takenAt)}`, size: 'lg' })
        sections.push({ label: 'Blood thinner', lines })
      }
      sections.push({ label: 'Other medications', lines: others.map((m) => ({ text: `${m.name} ${m.strength} · ${m.scheduleShort}`, size: 'lg' as const })) })
      for (const inj of injuries) {
        sections.push({
          label: 'Past injury',
          lines: [
            { text: inj.summary, size: 'lg' },
            { text: here ? inj.detail.replace("at St. Luke's", "here at St. Luke's") : inj.detail, size: 'muted' },
          ],
        })
      }
      sections.push({
        label: 'Primary doctor',
        lines: [{ text: `${gp.name} · ${gp.practice}`, size: 'lg' }, ...(gp.phone ? [{ text: gp.phone, size: 'lg' as const }] : [])],
      })
      return {
        memberId,
        fullName: p.fullName,
        dateOfBirth: p.dateOfBirth,
        age: p.age,
        sections,
        sourcesNote: `From ${p.firstName}'s medical records and hub log`,
        sources: [
          { recordId: 'rec-allergies', label: 'Allergies' },
          { recordId: 'rec-med-list', label: 'Medication list' },
          { recordId: 'rec-hub-log', label: 'Hub dose log' },
          { recordId: 'rec-er-2019-03-14', label: `ER visit note · ${monthYear('2019-03-14')}` },
          { recordId: 'rec-care-team', label: 'Care team list' },
        ],
      }
    }, 'agent')
  }

  draftInteractionFollowUp(memberId: string, checkId: string): Promise<CareTeamFollowUp> {
    return simulate(() => {
      const stored = need(loadChecks()[checkId], 'Interaction check')
      const finding = need(stored.findings[0], 'Interaction finding')
      const content = need(fx.followUpContent[`${stored.drugId}:${finding.itemId}`], 'Follow-up')
      const to = this.teamOf(memberId).find((c) => c.id === content.toClinicianId)!
      const enc = this.encounterNow(memberId)
      const now = new Date().toISOString()
      const draft: MessageDraft = {
        id: `draft-${checkId}`,
        memberId,
        to: { clinicianId: to.id, name: to.name, role: to.role },
        channel: 'MyChart',
        body: content.body,
        createdAt: now,
        updatedAt: now,
        about: { kind: 'interaction-check', id: checkId },
      }
      return {
        inPerson: { heading: enc ? 'Show the ER doctor now' : 'Ask at her next visit', paragraphs: content.inPerson },
        messageHeading: `Let ${to.name} know`,
        draft,
        familySummary: content.familySummary,
      }
    }, 'agent')
  }

  sendMessage(draft: MessageDraft): Promise<SentMessage> {
    return simulate(() => {
      // Demo: nothing leaves the browser.
      return { id: `msg-${draft.id}`, sentAt: new Date().toISOString(), status: 'sent' as const }
    }, 'write')
  }

  getCalendarSummary(memberIds: string[], range: DateRange): Promise<CalendarSummary> {
    return simulate(() => {
      const c = fx.calendarSummaries[this.scene()]
      const inRange = (visitId: string) =>
        memberIds.some((id) =>
          (fx.visits[id] ?? []).some((v) => v.id === visitId && v.startsAt.slice(0, 10) >= range.from && v.startsAt.slice(0, 10) <= range.to),
        )
      return { text: c.text, visitLabels: c.visitLabels.filter((l) => inRange(l.visitId)) }
    })
  }

  getVisitReadiness(memberId: string, visitId: string): Promise<VisitReadiness> {
    return simulate(() => {
      this.profileOf(memberId)
      const r = need(fx.visitReadiness[visitId], 'Visit')
      return { memberId, visitId, ...r }
    })
  }
}
