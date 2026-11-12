import type {
  Appointment,
  AppUser,
  DateRange,
  Family,
  FamilyMember,
  FamilyUpdate,
  MemberInput,
  MessageDraft,
  QuestionList,
  SavedPrepSheet,
  ToBookItem,
  UserSettings,
} from './types'

/**
 * App store: app data only (family, calendar, saved prep sheets, question
 * lists, message drafts, settings). No medical records and no agent logic.
 * Real implementation: Supabase (stub in ./live/SupabaseAppStore.ts).
 */
export interface AppStore {
  getCurrentUser(): Promise<AppUser>
  /** the family, the user's own entry included */
  getFamily(): Promise<Family>

  /* ---- family members ---- */
  addMember(input: MemberInput): Promise<FamilyMember>
  /** editing the user's own entry also updates the user (name, initials, color) */
  updateMember(memberId: string, patch: Partial<MemberInput>): Promise<FamilyMember>
  /** removes a member and their app data (calendar items, prep sheets…). Never the user's own entry. */
  removeMember(memberId: string): Promise<void>
  /** who gets updates about this member, besides the user; returns the saved list */
  setCareCircle(memberId: string, notifyIds: string[]): Promise<string[]>

  getSettings(): Promise<UserSettings>
  updateSettings(patch: Partial<UserSettings>): Promise<UserSettings>

  getPrepSheet(memberId: string, visitId: string): Promise<SavedPrepSheet | null>
  savePrepSheet(sheet: SavedPrepSheet): Promise<SavedPrepSheet>

  getQuestionList(memberId: string, visitId: string): Promise<QuestionList | null>
  saveQuestionList(list: QuestionList): Promise<QuestionList>

  listDrafts(memberId: string): Promise<MessageDraft[]>
  saveDraft(draft: MessageDraft): Promise<MessageDraft>

  createFamilyUpdate(update: Omit<FamilyUpdate, 'id' | 'createdAt'>): Promise<FamilyUpdate>

  /* ---- calendar ---- */
  /** a family's appointments with a date inside the range, oldest first */
  listAppointments(familyId: string, range: DateRange): Promise<Appointment[]>
  getAppointment(appointmentId: string): Promise<Appointment | null>
  /** things that still need booking, soonest due first */
  listToBookItems(familyId: string): Promise<ToBookItem[]>
  /** who is taking the member to a visit: the user's id, a family member's id, or null */
  setAppointmentEscort(appointmentId: string, escortId: string | null): Promise<Appointment>
}
