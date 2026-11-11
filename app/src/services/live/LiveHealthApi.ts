import type { HealthApi } from '../HealthApi'
import type {
  AgentAnswer,
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
} from '../types'
import { ServiceError } from '../errors'

/**
 * REST client for the Health API. The contract is in app/DATA.md.
 * The base URL comes from VITE_HEALTH_API_URL; no other URL lives in the app.
 *
 * Auth is not wired yet. When it is, add the header in `request()` (e.g. a
 * short-lived bearer token from your auth provider). Never ship a static
 * secret: everything in the bundle is public.
 */
const TIMEOUT_MS = 20_000

export class LiveHealthApi implements HealthApi {
  private baseUrl: string | null

  constructor(baseUrl: string | undefined) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : null
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!this.baseUrl) throw new ServiceError('not-configured', 'VITE_HEALTH_API_URL is not set')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(this.baseUrl + path, {
        method,
        headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      })
    } catch (e) {
      throw new ServiceError((e as Error).name === 'AbortError' ? 'timeout' : 'network', `${method} ${path} failed`)
    } finally {
      clearTimeout(timer)
    }
    if (res.status === 204) return null as T
    if (res.status === 404) throw new ServiceError('not-found', `${method} ${path}: 404`)
    if (!res.ok) throw new ServiceError('server', `${method} ${path}: ${res.status}`)
    return (await res.json()) as T
  }

  private m(memberId: string) {
    return `/members/${encodeURIComponent(memberId)}`
  }

  getFamilyBriefing(memberIds: string[]) {
    return this.request<FamilyBriefing>('GET', `/family/briefing?members=${memberIds.map(encodeURIComponent).join(',')}`)
  }
  getProfile(memberId: string) {
    return this.request<MemberProfile>('GET', `${this.m(memberId)}/profile`)
  }
  getMedications(memberId: string) {
    return this.request<Medication[]>('GET', `${this.m(memberId)}/medications`)
  }
  getCareTeam(memberId: string) {
    return this.request<Clinician[]>('GET', `${this.m(memberId)}/care-team`)
  }
  getVisits(memberId: string, opts?: { upcoming?: boolean }) {
    return this.request<Visit[]>('GET', `${this.m(memberId)}/visits?upcoming=${opts?.upcoming ? 'true' : 'false'}`)
  }
  getVitals(memberId: string, type: 'bp') {
    return this.request<VitalReading[]>('GET', `${this.m(memberId)}/vitals?type=${type}`)
  }
  getRecord(memberId: string, recordId: string) {
    return this.request<RecordDetail>('GET', `${this.m(memberId)}/records/${encodeURIComponent(recordId)}`)
  }
  getCurrentEncounter(memberId: string) {
    return this.request<Encounter | null>('GET', `${this.m(memberId)}/encounters/current`)
  }
  getAskSuggestions(memberId: string) {
    return this.request<AskSuggestions>('GET', `${this.m(memberId)}/ask/suggestions`)
  }
  ask(req: AskRequest) {
    return this.request<AgentAnswer>('POST', `/ask`, req)
  }
  lookupDrug(query: string) {
    return this.request<DrugMatch | null>('GET', `/drugs/lookup?q=${encodeURIComponent(query)}`)
  }
  startInteractionCheck(memberId: string, med: NewMedication) {
    return this.request<InteractionCheck>('POST', `${this.m(memberId)}/interaction-checks`, med)
  }
  getInteractionCheck(checkId: string) {
    return this.request<InteractionCheck>('GET', `/interaction-checks/${encodeURIComponent(checkId)}`)
  }
  buildPrepSheet(memberId: string, visitId: string, opts?: { pins?: PrepPin[] }) {
    return this.request<PrepSheet>('POST', `${this.m(memberId)}/visits/${encodeURIComponent(visitId)}/prep-sheet`, {
      pins: opts?.pins ?? [],
    })
  }
  buildNurseCard(memberId: string) {
    return this.request<NurseCard>('POST', `${this.m(memberId)}/nurse-card`, {})
  }
  draftInteractionFollowUp(memberId: string, checkId: string) {
    return this.request<CareTeamFollowUp>(
      'POST',
      `${this.m(memberId)}/interaction-checks/${encodeURIComponent(checkId)}/follow-up`,
      {},
    )
  }
  sendMessage(draft: MessageDraft) {
    return this.request<SentMessage>('POST', `/messages`, draft)
  }
}
