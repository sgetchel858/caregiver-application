/**
 * A real interaction check, run in the browser against RxNorm and openFDA labels
 * (see ./openDrugData.ts). Checks are kept in session storage so the progress and
 * result screens can poll them, and so a reload mid-check picks up where it left off.
 */
import type {
  Allergy,
  CareTeamFollowUp,
  Clinician,
  DrugMatch,
  InteractionCheck,
  InteractionCheckItem,
  InteractionFinding,
  Medication,
  MessageDraft,
  NewMedication,
  RecordDetail,
} from '../types'
import { ServiceError } from '../errors'
import {
  DrugDataError,
  SECTION_TITLES,
  fetchLabel,
  findMentions,
  normalizeDrug,
  type DrugLabel,
  type LabelMention,
  type NormalizedDrug,
} from './openDrugData'

/** what the check needs to know about the person */
export interface CheckSubject {
  memberId: string
  /** how the app refers to them: "Mom", "Robert" */
  callName: string
  medications: Medication[]
  allergies: Allergy[]
  careTeam: Clinician[]
  primaryClinicianId: string
}

/** a label passage kept with a finding, for the result screen and the source sheet */
interface StoredPassage {
  labelOf: string
  genericName: string
  manufacturer?: string
  effectiveDate: string
  section: string
  passage: string
  term: string
}

interface StoredCheck {
  check: InteractionCheck
  subject: CheckSubject
  med: NewMedication
  drug: NormalizedDrug
  /** finding id → label passages behind it */
  passages: Record<string, StoredPassage[]>
  error?: string
}

const KEY = 'casante:interaction-checks'
const SOURCE_PREFIX = 'openfda:'

function loadAll(): Record<string, StoredCheck> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}
function save(stored: StoredCheck) {
  try {
    const all = loadAll()
    all[stored.check.id] = stored
    sessionStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage full or blocked: the in-memory copy still works */
  }
  memory.set(stored.check.id, stored)
}
function load(checkId: string): StoredCheck {
  const s = memory.get(checkId) ?? loadAll()[checkId]
  if (!s) throw new ServiceError('not-found', 'Interaction check not found')
  memory.set(checkId, s)
  return s
}

const memory = new Map<string, StoredCheck>()
const running = new Set<string>()

/** "Vitamin K Antagonist" → "vitamin K antagonist" (acronyms kept) */
const lower = (s: string) => s.replace(/\b[A-Z][a-z]+\b/g, (w) => w.toLowerCase())
const article = (s: string) => (/^[aeiou]/i.test(s) ? 'An' : 'A')
const strengthOf = (typed: string) => typed.match(/\d+(\.\d+)?\s*(mg|mcg|g|ml|units?|%)/i)?.[0]

function asError(e: unknown): never {
  if (e instanceof ServiceError) throw e
  if (e instanceof DrugDataError) throw new ServiceError('network', e.message)
  throw e
}

/* ---------------- lookup ---------------- */

export async function lookupDrug(query: string): Promise<DrugMatch | null> {
  const d = await normalizeDrug(query).catch(asError)
  if (!d) return null
  return {
    id: d.rxcui,
    name: d.name,
    strength: strengthOf(query),
    drugClass: d.classes[0] ? `${article(d.classes[0])} ${lower(d.classes[0])}` : '',
  }
}

/* ---------------- starting and running a check ---------------- */

const clinicianLabel = (c?: Clinician) => (!c ? 'Prescriber unknown' : c.role === 'GP' ? c.name : `${c.name}, ${c.role.toLowerCase()}`)

export async function startCheck(subject: CheckSubject, med: NewMedication): Promise<InteractionCheck> {
  const drug = await normalizeDrug(med.name).catch(asError)
  if (!drug) {
    throw new ServiceError('not-found', `We couldn't find “${med.name}” in RxNorm. Check the spelling and try again.`)
  }
  const id = `chk-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const items: InteractionCheckItem[] = [
    ...subject.medications.map((m) => ({
      id: m.id,
      kind: 'medication' as const,
      label: `${m.name} ${m.strength}`,
      sublabel: clinicianLabel(subject.careTeam.find((c) => c.id === m.prescriberId)),
      result: 'pending' as const,
    })),
    ...subject.allergies.map((a) => ({
      id: `allergy-${a.substance.toLowerCase().replace(/\W+/g, '-')}`,
      kind: 'allergy' as const,
      label: `${a.substance} allergy`,
      sublabel: 'From the chart',
      result: 'pending' as const,
    })),
  ]
  const doctors = new Set(subject.medications.map((m) => m.prescriberId)).size
  const n = subject.medications.length
  const check: InteractionCheck = {
    id,
    memberId: subject.memberId,
    status: 'running',
    drug: { name: drug.name, label: med.name, drugClass: drug.classes[0] ?? 'Medication' },
    scopeLine:
      `Against ${subject.callName}'s ${n} medication${n === 1 ? '' : 's'}` +
      (doctors > 1 ? ` from ${doctors} doctors` : '') +
      (subject.allergies.length ? ', and allergies' : ''),
    items,
    findings: [],
    source: { recordId: `${SOURCE_PREFIX}${id}`, label: 'FDA drug labels (openFDA) and RxNorm' },
    disclaimer: `This reads the FDA-approved drug labels. It doesn't replace ${subject.callName}'s care team or pharmacist. Don't stop or change any medicine without asking them.`,
  }
  const stored: StoredCheck = { check, subject, med, drug, passages: {} }
  save(stored)
  void run(id)
  return structuredClone(check)
}

/** current state; restarts the work if the page was reloaded mid-check */
export async function getCheck(checkId: string): Promise<InteractionCheck> {
  const s = load(checkId)
  if (s.error) {
    const msg = s.error
    // let a retry start over
    s.error = undefined
    save(s)
    throw new ServiceError('network', msg)
  }
  if (s.check.status === 'running' && !running.has(checkId)) void run(checkId)
  return structuredClone(s.check)
}

function resolveItem(checkId: string, itemId: string, result: Pick<InteractionCheckItem, 'result' | 'resultLabel'>, finding?: InteractionFinding, passages?: StoredPassage[]) {
  const s = load(checkId)
  s.check.items = s.check.items.map((i) => (i.id === itemId ? { ...i, ...result } : i))
  if (finding) {
    s.check.findings = [...s.check.findings.filter((f) => f.id !== finding.id), finding].sort(
      (a, b) => (a.severity === 'major' ? 0 : 1) - (b.severity === 'major' ? 0 : 1),
    )
    if (passages) s.passages[finding.id] = passages
  }
  if (s.check.items.every((i) => i.result !== 'pending')) s.check.status = 'complete'
  save(s)
}

async function run(checkId: string) {
  if (running.has(checkId)) return
  running.add(checkId)
  try {
    const s = load(checkId)
    const newLabel = await fetchLabel(s.drug)
    const pending = s.check.items.filter((i) => i.result === 'pending')
    await Promise.all(
      pending.map(async (item) => {
        if (item.kind === 'medication') {
          const med = s.subject.medications.find((m) => m.id === item.id)!
          await checkMedication(checkId, s, item, med, newLabel)
        } else {
          const allergy = s.subject.allergies.find((a) => item.label === `${a.substance} allergy`)!
          await checkAllergy(checkId, s, item, allergy, newLabel)
        }
      }),
    )
  } catch (e) {
    try {
      const s = load(checkId)
      s.error = e instanceof Error ? e.message : "Couldn't finish the check"
      save(s)
    } catch {
      /* check gone */
    }
  } finally {
    running.delete(checkId)
  }
}

const keep = (m: LabelMention): StoredPassage => ({
  labelOf: m.labelOf,
  genericName: m.label.genericName,
  manufacturer: m.label.manufacturer,
  effectiveDate: m.label.effectiveDate,
  section: SECTION_TITLES[m.section],
  passage: m.passage,
  term: m.term,
})

/** flattened tables of drug names ("…amlodipine, amprenavir, aprepitant, atorvastatin…") */
const isList = (passage: string) => (passage.match(/,/g)?.length ?? 0) / Math.max(passage.length, 1) > 1 / 30

const quote = (p: StoredPassage) =>
  isList(p.passage)
    ? `The **${p.labelOf.toLowerCase()}** label lists ${p.term} among the drugs that can interact with it (${p.section.toLowerCase()}).`
    : `The **${p.labelOf.toLowerCase()}** label (${p.section.toLowerCase()}) says: “${p.passage}”`

async function checkMedication(checkId: string, s: StoredCheck, item: InteractionCheckItem, med: Medication, newLabel: DrugLabel | null) {
  const current = await normalizeDrug(med.name)
  if (!current) {
    resolveItem(checkId, item.id, { result: 'clear', resultLabel: 'Not in RxNorm' })
    return
  }
  if (current.ingredients.some((i) => s.drug.ingredients.includes(i))) {
    const finding: InteractionFinding = {
      id: `f-${item.id}`,
      severity: 'major',
      itemId: item.id,
      title: `${s.drug.name} is already on the list`,
      summary: `${med.name} ${med.strength} contains ${current.ingredients.join(' and ')}, the same medicine. Taking both could mean a double dose.`,
      sections: [
        { title: `Why it matters for ${s.subject.callName}`, text: `${s.subject.callName} already takes **${med.name} ${med.strength}** ${med.schedule}.` },
        { title: 'What to ask', text: 'Whether the new prescription replaces the old one, or both should be taken.' },
      ],
    }
    resolveItem(checkId, item.id, { result: 'major', resultLabel: 'Same medicine' }, finding, [])
    return
  }
  const currentLabel = await fetchLabel(current)
  // new drug's label naming the current one, and the current one's label naming the new drug
  const mentions = [
    ...(newLabel ? findMentions(s.drug.name, newLabel, current) : []),
    ...(currentLabel ? findMentions(current.name, currentLabel, s.drug) : []),
  ]
  if (!mentions.length) {
    resolveItem(checkId, item.id, {
      result: 'clear',
      resultLabel: newLabel || currentLabel ? 'None on the labels' : 'No label to check',
    })
    return
  }
  const severity = mentions.some((m) => m.severity === 'major') ? 'major' : 'moderate'
  // the clearest passages first: serious ones, then the new drug's own label
  const rank = (m: LabelMention) => (m.severity === 'major' ? 0 : 4) + (isList(m.passage) ? 2 : 0) + (m.labelOf === s.drug.name ? 0 : 1)
  const ranked = [...mentions].sort((a, b) => rank(a) - rank(b))
  const passages = ranked
    .filter((m, i) => ranked.findIndex((o) => o.passage === m.passage) === i)
    .slice(0, 2)
    .map(keep)
  const prescriber = s.subject.careTeam.find((c) => c.id === med.prescriberId)
  const finding: InteractionFinding = {
    id: `f-${item.id}`,
    severity,
    itemId: item.id,
    title: `${s.drug.name} + ${current.name}`,
    summary:
      severity === 'major'
        ? `The FDA label warns about taking ${s.drug.name.toLowerCase()} with ${current.name.toLowerCase()}. Check with ${s.subject.callName}'s care team before starting it.`
        : `The FDA label mentions ${s.drug.name.toLowerCase()} and ${current.name.toLowerCase()} together. Worth asking the care team or pharmacist.`,
    sections: [
      {
        title: `Why it matters for ${s.subject.callName}`,
        text: `${s.subject.callName} takes **${med.name.toLowerCase()} ${med.strength}** ${med.schedule}${prescriber ? `, prescribed by ${prescriber.name}${prescriber.role === 'GP' ? '' : ` (${prescriber.role.toLowerCase()})`}` : ''}.`,
      },
      { title: 'What the FDA label says', text: passages.map(quote).join('\n\n') },
      {
        title: 'What to ask',
        text: `Is ${s.drug.name.toLowerCase()} safe with ${current.name.toLowerCase()} for ${s.subject.callName}, and does anything need to be checked or changed while taking both?`,
      },
    ],
  }
  resolveItem(checkId, item.id, { result: severity, resultLabel: severity === 'major' ? 'Major interaction' : 'Possible interaction' }, finding, passages)
}

async function checkAllergy(checkId: string, s: StoredCheck, item: InteractionCheckItem, allergy: Allergy, newLabel: DrugLabel | null) {
  const word = allergy.substance.toLowerCase()
  const allergen = await normalizeDrug(allergy.substance)
  const sameIngredient = !!allergen && allergen.ingredients.some((i) => s.drug.ingredients.includes(i))
  const classHit = s.drug.classes.find((c) => c.toLowerCase().includes(word))
  const sharedClass = allergen?.classes.find((c) => s.drug.classes.includes(c))

  const reasonText = sameIngredient
    ? `${s.drug.name} contains ${word}.`
    : classHit
      ? `${s.drug.name} is ${article(classHit).toLowerCase()} ${lower(classHit)}.`
      : sharedClass
        ? `${s.drug.name} and ${word} are both ${lower(sharedClass)}s.`
        : null

  if (reasonText) {
    const finding: InteractionFinding = {
      id: `f-${item.id}`,
      severity: 'major',
      itemId: item.id,
      title: `${s.drug.name} + ${word} allergy`,
      summary: `${reasonText} ${s.subject.callName}'s chart lists a ${word} allergy (${allergy.reaction}).`,
      sections: [
        { title: 'What care teams often do', text: 'Choose a medicine from a different family, or confirm the allergy history before the first dose.' },
        { title: 'Where this comes from', text: `RxNorm lists ${s.drug.name.toLowerCase()} as **${(classHit ?? sharedClass ?? s.drug.name).toLowerCase()}** (FDA drug class).` },
      ],
    }
    resolveItem(checkId, item.id, { result: 'major', resultLabel: 'Allergy match' }, finding, [])
    return
  }

  // the label itself may warn about this allergy (e.g. cephalosporins and penicillin)
  const asAllergen: NormalizedDrug = {
    rxcui: allergen?.rxcui ?? '',
    name: allergy.substance,
    ingredients: [...new Set([word, ...(allergen?.ingredients ?? [])])],
    brands: [],
    classes: allergen?.classes ?? [],
  }
  const mentions = newLabel
    ? findMentions(s.drug.name, newLabel, asAllergen).filter((m) =>
        ['contraindications', 'warnings_and_cautions', 'warnings', 'boxed_warning', 'do_not_use'].includes(m.section),
      )
    : []
  if (mentions.length) {
    const passages = mentions.slice(0, 1).map(keep)
    const finding: InteractionFinding = {
      id: `f-${item.id}`,
      severity: 'moderate',
      itemId: item.id,
      title: `${s.drug.name} and a ${word} allergy`,
      summary: `${s.drug.name} isn't ${word}, but its FDA label mentions people with a ${word} allergy. ${s.subject.callName}'s chart lists one (${allergy.reaction}).`,
      sections: [
        { title: 'What the FDA label says', text: passages.map(quote).join('\n\n') },
        { title: 'What to ask', text: `Is ${s.drug.name.toLowerCase()} safe given ${s.subject.callName}'s ${word} allergy?` },
      ],
    }
    resolveItem(checkId, item.id, { result: 'moderate', resultLabel: 'Label mentions it' }, finding, passages)
    return
  }
  resolveItem(checkId, item.id, { result: 'clear', resultLabel: allergen ? `Not ${article(word).toLowerCase()} ${word}` : 'No match' })
}

/* ---------------- source sheet ---------------- */

export function isCheckSource(recordId: string) {
  return recordId.startsWith(SOURCE_PREFIX)
}

export function checkSourceRecord(recordId: string): RecordDetail {
  const s = load(recordId.slice(SOURCE_PREFIX.length))
  const all = Object.values(s.passages).flat()
  const first = all.find((p) => !isList(p.passage)) ?? all[0]
  if (!first) {
    return {
      id: recordId,
      kind: 'interaction-db',
      title: `${s.drug.name}: FDA label`,
      date: new Date().toISOString().slice(0, 10),
      facility: 'openFDA · U.S. Food and Drug Administration',
      excerpt: `RxNorm matched “${s.med.name}” to ${s.drug.name}${s.drug.classes[0] ? ` (${s.drug.classes[0]})` : ''}. Its FDA label and the labels of ${s.subject.callName}'s medications were searched for each other by name, brand name and drug class.`,
    }
  }
  return {
    id: recordId,
    kind: 'interaction-db',
    title: `${first.labelOf} label · ${first.section}`,
    date: first.effectiveDate,
    facility: 'openFDA · U.S. Food and Drug Administration',
    author: first.manufacturer,
    excerpt: first.passage,
    highlight: first.passage.match(new RegExp(first.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))?.[0],
  }
}

/* ---------------- follow-up for the care team ---------------- */

export function draftFollowUp(checkId: string, opts: { atFacility: string | null; userFirstName: string }): CareTeamFollowUp {
  const s = load(checkId)
  const finding = s.check.findings[0]
  if (!finding) throw new ServiceError('not-found', 'Interaction finding not found')
  const who = s.subject.callName
  const item = s.check.items.find((i) => i.id === finding.itemId)!
  const med = s.subject.medications.find((m) => m.id === finding.itemId)
  // write to whoever prescribed the medicine in question; for allergies, the primary doctor
  const to =
    s.subject.careTeam.find((c) => c.id === med?.prescriberId) ??
    s.subject.careTeam.find((c) => c.id === s.subject.primaryClinicianId) ??
    s.subject.careTeam[0]
  if (!to) throw new ServiceError('not-found', 'No one on the care team to message')
  const newMed = [s.med.name, s.med.frequency].filter(Boolean).join(' ')
  const from = s.med.prescribedBy ? ` by ${s.med.prescribedBy}` : ''
  const where = opts.atFacility ? ` at ${opts.atFacility}` : ''
  const concern = med
    ? `${who} takes ${med.name.toLowerCase()} ${med.strength} ${med.schedule}, and the FDA label flags taking the two together.`
    : `${who}'s chart lists a ${item.label.toLowerCase()}, and this was flagged against it.`
  const now = new Date().toISOString()
  const draft: MessageDraft = {
    id: `draft-${checkId}`,
    memberId: s.subject.memberId,
    to: { clinicianId: to.id, name: to.name, role: to.role },
    channel: 'MyChart',
    body: `Hi ${to.name}, ${who} was prescribed ${newMed}${from}${where}. ${concern} Is it safe to start, or should anything be checked or changed? Thank you, ${opts.userFirstName}`,
    createdAt: now,
    updatedAt: now,
    about: { kind: 'interaction-check', id: checkId },
  }
  return {
    inPerson: {
      heading: opts.atFacility ? 'Show the doctor now' : 'Ask at the next visit',
      paragraphs: [
        med ? `${who} takes **${med.name.toLowerCase()} ${med.strength}** ${med.schedule}.` : `${who}'s chart lists a **${item.label.toLowerCase()}**.`,
        `Is ${s.drug.name.toLowerCase()} safe with it, or should something be checked first?`,
      ],
    },
    messageHeading: `Let ${to.name} know`,
    draft,
    familySummary: `${who} was prescribed ${s.drug.name.toLowerCase()}${where}. Its FDA label flags it with ${med ? `${who}'s ${med.name.toLowerCase()}` : `${who}'s ${item.label.toLowerCase()}`}, so ${opts.userFirstName} asked ${to.name} whether it's safe to start.`,
  }
}
