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
  MemberProfile,
  Medication,
  MessageDraft,
  NewMedication,
  NurseCard,
  PrepPin,
  PrepSheet,
  RecordDetail,
  SentMessage,
  VitalReading,
  Visit,
} from './types'

/**
 * Health API: medical information and the agent.
 * Real implementation: REST client in ./live/LiveHealthApi.ts (contract in DATA.md).
 */
export interface HealthApi {
  /* ---- medical information ---- */
  getFamilyBriefing(memberIds: string[]): Promise<FamilyBriefing>
  getProfile(memberId: string): Promise<MemberProfile>
  getMedications(memberId: string): Promise<Medication[]>
  getCareTeam(memberId: string): Promise<Clinician[]>
  getVisits(memberId: string, opts?: { upcoming?: boolean }): Promise<Visit[]>
  getVitals(memberId: string, type: 'bp'): Promise<VitalReading[]>
  getRecord(memberId: string, recordId: string): Promise<RecordDetail>
  /** where the member is being seen right now (e.g. an ER visit), or null */
  getCurrentEncounter(memberId: string): Promise<Encounter | null>

  /* ---- agent ---- */
  getAskSuggestions(memberId: string): Promise<AskSuggestions>
  ask(req: AskRequest): Promise<AgentAnswer>
  lookupDrug(query: string): Promise<DrugMatch | null>
  /** starts a check; returns immediately with every item "pending" */
  startInteractionCheck(memberId: string, med: NewMedication): Promise<InteractionCheck>
  /** current state of a check; items resolve one by one until status is "complete" */
  getInteractionCheck(checkId: string): Promise<InteractionCheck>
  /** adds a medication to the member's list (after the user confirms in the UI) */
  addMedication(memberId: string, med: NewMedication): Promise<Medication>
  buildPrepSheet(memberId: string, visitId: string, opts?: { pins?: PrepPin[] }): Promise<PrepSheet>
  buildNurseCard(memberId: string): Promise<NurseCard>
  draftInteractionFollowUp(memberId: string, checkId: string): Promise<CareTeamFollowUp>
  /** only ever called after the user confirms in the UI */
  sendMessage(draft: MessageDraft): Promise<SentMessage>

  /* ---- calendar ---- */
  /** the agent's one-line read on these members' health events in the range */
  getCalendarSummary(memberIds: string[], range: DateRange): Promise<CalendarSummary>
  /** what is ready for a visit (prep sheet, referral…) and what the agent does afterwards */
  getVisitReadiness(memberId: string, visitId: string): Promise<VisitReadiness>
}
