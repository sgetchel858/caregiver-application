/**
 * Shared domain types for both services.
 *
 * Dates: `ISODate` is "YYYY-MM-DD". `LocalDateTime` is "YYYY-MM-DDTHH:mm:ss"
 * with no offset, in the member's own time zone (wall-clock time). The UI
 * parses these with `parseLocal()` so times show as recorded, wherever the
 * phone is.
 *
 * Text fields marked "rich" may contain **bold** spans and nothing else.
 */

export type ISODate = string
export type LocalDateTime = string

/* ------------------------------------------------------------------ */
/* Health API: medical information                                     */
/* ------------------------------------------------------------------ */

export interface AgentNudge {
  id: string
  memberId: string
  /** rich */
  text: string
  action?: { kind: 'prep-visit'; visitId: string; label: string }
}

export interface MemberStatus {
  memberId: string
  line: string
  /** false when we can't read this member's records yet (only Mom in the demo) */
  recordsConnected: boolean
}

export interface FamilyBriefing {
  nudges: AgentNudge[]
  statuses: MemberStatus[]
}

export interface Allergy {
  substance: string
  reaction: string
}

export interface MemberProfile {
  memberId: string
  fullName: string
  firstName: string
  dateOfBirth: ISODate
  age: number
  primaryClinicianId: string
  allergies: Allergy[]
  connection: { source: 'MyChart'; healthSystems: number; updatedAt: LocalDateTime }
}

export interface Medication {
  id: string
  name: string
  strength: string
  /** e.g. "every morning" */
  schedule: string
  /** e.g. "morning" */
  scheduleShort: string
  prescriberId: string
  /** plain words, e.g. "blood pressure" */
  purpose: string
  lastDose?: { takenAt: LocalDateTime; source: 'kitchen-hub' | 'self-report' }
  lastRefill?: { date: ISODate; pharmacy: string }
}

export interface Clinician {
  id: string
  name: string
  /** e.g. "GP", "Neurology", "Cardiology", "Dentist" */
  role: string
  practice: string
  phone?: string
}

export interface Visit {
  id: string
  clinicianId: string
  startsAt: LocalDateTime
  location: string
  /** e.g. "Hand tremor" */
  reason: string
  referredById?: string
  referredOn?: ISODate
}

export interface BpReading {
  id: string
  type: 'bp'
  systolic: number
  diastolic: number
  unit: 'mmHg'
  takenAt: LocalDateTime
  clinicianId: string
  facility: string
  recordId: string
}

export type VitalReading = BpReading

export type RecordKind =
  | 'visit-summary'
  | 'er-note'
  | 'radiology'
  | 'prescription'
  | 'hub-log'
  | 'care-team'
  | 'referral'
  | 'medication-list'
  | 'appointment'
  | 'interaction-db'
  | 'profile'

export interface SourceRef {
  recordId: string
  /** chip label, e.g. "Visit summary · Oct 28" */
  label: string
}

export interface RecordDetail {
  id: string
  kind: RecordKind
  title: string
  date: ISODate
  facility: string
  author?: string
  /** a short passage from the record */
  excerpt: string
  /** the part of `excerpt` the answer relied on (highlighted) */
  highlight?: string
}

export interface Encounter {
  id: string
  facility: string
  kind: 'emergency'
  startedAt: LocalDateTime
  /** new prescriptions written during this encounter, not yet in the med list */
  newOrders: NewMedication[]
}

export interface AskSuggestions {
  /** short questions shown as chips */
  prompts: string[]
  /** text to pre-fill in the ask box, if any */
  prefill?: string
}

/* ---------------- Ask: answers are a list of typed blocks ---------------- */

export type AnswerBlock =
  | { type: 'text'; style: 'tint' | 'plain'; text: string /* rich */ }
  | { type: 'big-value'; value: string; text: string /* rich */ }
  | {
      type: 'bp-reading'
      label: string
      reading: BpReading
      trendLabel: string
      trend: BpReading[]
    }
  | {
      type: 'timeline'
      entries: {
        eyebrow: string
        place: string
        text: string
        quote?: { label: string; text: string }
      }[]
    }
  | {
      type: 'dose-log'
      headline: string
      detail: string
      weekLabel: string
      days: { label: string; taken: boolean; latest?: boolean }[]
      summary: string
      medication: { title: string /* rich */; lines: string[] }
    }
  | { type: 'list'; title?: string; items: { primary: string /* rich */; secondary?: string }[] }
  | { type: 'note'; text: string /* rich */ }

export type AnswerAction =
  | { kind: 'add-to-prep'; label: string; visitId: string; pin: PrepPin; style: 'primary' }
  | { kind: 'show-vitals'; label: string; vitalType: 'bp'; style: 'secondary' }
  | { kind: 'show-to-nurse'; label: string; style: 'dock' }

export interface Suggestion {
  label: string
  /** the full question to send when tapped */
  question?: string
  action?: 'show-to-nurse'
}

export interface AgentAnswer {
  id: string
  memberId: string | null
  question: string
  /** "answer": from the records. "out-of-scope": polite refusal. */
  kind: 'answer' | 'out-of-scope'
  blocks: AnswerBlock[]
  sources: SourceRef[]
  actions: AnswerAction[]
  followUps: Suggestion[]
}

export interface AskRequest {
  memberId?: string
  question: string
  threadId?: string
}

/* ---------------- Visit prep ---------------- */

export interface PrepPin {
  kind: 'vital'
  id: string
}

export type PrepSection =
  | { type: 'text'; id: string; title: string; text: string /* rich */ }
  | {
      type: 'vital'
      id: string
      title: string
      reading: BpReading
      clinicianName: string
      pinnedAt?: string /* real ISO timestamp when Sarah added it */
    }
  | {
      type: 'medications'
      id: string
      title: string
      items: { name: string; strength: string; schedule: string; detail: string }[]
    }
  | { type: 'questions'; id: string; title: string; items: { id: string; text: string }[] }

export interface PrepSheet {
  id: string
  memberId: string
  visitId: string
  /** "Margaret" */
  forName: string
  /** "Neurology with Dr. Okafor" */
  title: string
  startsAt: LocalDateTime
  location: string
  sections: PrepSection[]
  sources: SourceRef[]
  /** e.g. "Mom's MyChart" */
  sourcesFrom: string
  /** plain summary used when sharing with family */
  shareSummary: string
  builtAt: string
}

/* ---------------- Show to nurse ---------------- */

export interface NurseCard {
  memberId: string
  fullName: string
  dateOfBirth: ISODate
  age: number
  sections: {
    label: string
    boxed?: boolean
    lines: { text: string; size: 'xl' | 'lg' | 'md' | 'muted' }[]
  }[]
  sourcesNote: string
  sources: SourceRef[]
}

/* ---------------- Medications and interaction check ---------------- */

export interface NewMedication {
  /** what was typed or scanned, e.g. "Ciprofloxacin 500 mg" */
  name: string
  frequency: string
  prescribedBy: string
  reason?: string
}

export interface DrugMatch {
  id: string
  name: string
  strength?: string
  /** e.g. "An antibiotic" */
  drugClass: string
}

export type CheckResult = 'pending' | 'clear' | 'minor' | 'moderate' | 'major'

export interface InteractionCheckItem {
  id: string
  kind: 'medication' | 'allergy'
  label: string
  sublabel: string
  result: CheckResult
  /** e.g. "No major interaction", "Not a penicillin" */
  resultLabel?: string
}

export interface InteractionFinding {
  id: string
  severity: 'major' | 'moderate' | 'minor'
  itemId: string
  title: string
  summary: string
  sections: { title: string; text: string /* rich */ }[]
}

export interface InteractionCheck {
  id: string
  memberId: string
  status: 'running' | 'complete'
  drug: { name: string; label: string; drugClass: string }
  /** e.g. "Against Mom's 4 medications from 2 doctors, and her allergies" */
  scopeLine: string
  items: InteractionCheckItem[]
  findings: InteractionFinding[]
  source: SourceRef
  disclaimer: string
}

/* ---------------- Messages to the care team ---------------- */

export interface MessageDraft {
  id: string
  memberId: string
  to: { clinicianId: string; name: string; role: string }
  channel: 'MyChart'
  body: string
  createdAt: string
  updatedAt: string
  /** what this draft is about, so it can be found again */
  about?: { kind: 'interaction-check'; id: string }
}

export interface CareTeamFollowUp {
  inPerson: { heading: string; paragraphs: string[] /* rich */ }
  messageHeading: string
  draft: MessageDraft
  /** plain summary for family members */
  familySummary: string
}

export interface SentMessage {
  id: string
  sentAt: string
  status: 'sent'
}

/* ---- calendar (agent) ---- */

/** The agent's read on the family's week, for the calendar tab. */
export interface CalendarSummary {
  /** rich; one line, e.g. "One visit this week: …" */
  text: string
  /** short agent labels for visits in the range, e.g. "Prep sheet ready" */
  visitLabels: { visitId: string; label: string }[]
}

export interface VisitReadinessItem {
  id: string
  kind: 'prep-sheet' | 'record'
  /** "Prep sheet", "Referral from Dr. Yojansen" */
  title: string
  /** "Latest BP, 4 medications, 3 questions" */
  detail: string
  /** kind "record": the record to open */
  recordId?: string
  /** kind "prep-sheet": what the agent would put on the sheet */
  suggestedPins?: PrepPin[]
}

/** What is ready for an upcoming visit, and what the agent will do afterwards. */
export interface VisitReadiness {
  memberId: string
  visitId: string
  items: VisitReadinessItem[]
  afterVisitNote: string
}

/* ------------------------------------------------------------------ */
/* App store: app data only (no medical records)                       */
/* ------------------------------------------------------------------ */

export interface AppUser {
  id: string
  firstName: string
  lastName: string
  initials: string
  avatarColor: string
}

export interface FamilyMember {
  /** the member's id. For the user's own entry (`isSelf`) this is the user's id. */
  id: string
  /** id in the Health API, or null if no records are connected */
  healthMemberId: string | null
  firstName: string
  lastName: string
  /** how the user refers to them, e.g. "Mom", "Husband". "Me" for the user's own entry. */
  relation: string
  /** how this member refers to the user, e.g. "daughter". "self" for the user's own entry. */
  userIs: string
  birthYear: number | null
  /** from `birthYear`; null when it isn't known */
  age: number | null
  initials: string
  avatarColor: string
  /** true for the signed-in user's own entry */
  isSelf: boolean
}

/** What the user can set on a family member's profile. */
export interface MemberInput {
  firstName: string
  lastName: string
  relation: string
  userIs: string
  birthYear: number | null
  avatarColor: string
}

export interface Family {
  id: string
  name: string
  /** everyone in the family, the user included (`isSelf`) */
  members: FamilyMember[]
  /** who gets updates about whom, besides the user: memberId -> memberIds */
  careCircles: Record<string, string[]>
}

export interface UserSettings {
  largeText: boolean
  shareUpdatesByDefault: boolean
}

export interface SavedPrepSheet {
  memberId: string
  visitId: string
  sheet: PrepSheet
  savedAt: string
}

export interface QuestionList {
  memberId: string
  visitId: string
  items: { id: string; text: string; checked: boolean; addedBy: 'agent' | 'user' }[]
  updatedAt: string
}

export interface FamilyUpdate {
  id: string
  fromUserId: string
  aboutMemberId: string
  toMemberIds: string[]
  summary: string
  ref: { kind: 'prep-sheet' | 'message' | 'interaction-check' | 'appointment'; id: string }
  createdAt: string
}

/* ---- calendar (app store) ---- */

/** inclusive on both ends */
export interface DateRange {
  from: ISODate
  to: ISODate
}

/** A dated health event on the family calendar. Health events only. */
export interface Appointment {
  id: string
  familyId: string
  /** FamilyMember.id */
  memberId: string
  kind: 'visit' | 'refill'
  /** "Neurology with Dr. Okafor", "Warfarin refill due" */
  title: string
  date: ISODate
  /** null = no set time (a refill due date) */
  startsAt: LocalDateTime | null
  /** "Riverside Neurology" */
  place: string | null
  placePhone: string | null
  /** "first visit, hand tremor" */
  note: string | null
  /** Health API visit id, when the visit is in the member's records */
  healthVisitId: string | null
  /** who is taking them: the user's id or a FamilyMember.id */
  escortId: string | null
  /** who could take them: the user first, then the member's care circle */
  escortOptions: string[]
}

/** Something that still needs booking ("Flu shot · due this month"). */
export interface ToBookItem {
  id: string
  familyId: string
  memberId: string
  title: string
  dueBy: ISODate
}
