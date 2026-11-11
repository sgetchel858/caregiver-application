import type {
  AppUser,
  Family,
  FamilyUpdate,
  MessageDraft,
  QuestionList,
  SavedPrepSheet,
  UserSettings,
} from './types'

/**
 * App store: app data only (family, saved prep sheets, question lists,
 * message drafts, settings). No medical records and no agent logic.
 * Real implementation: Supabase (stub in ./live/SupabaseAppStore.ts).
 */
export interface AppStore {
  getCurrentUser(): Promise<AppUser>
  getFamily(): Promise<Family>
  getSettings(): Promise<UserSettings>
  updateSettings(patch: Partial<UserSettings>): Promise<UserSettings>

  getPrepSheet(memberId: string, visitId: string): Promise<SavedPrepSheet | null>
  savePrepSheet(sheet: SavedPrepSheet): Promise<SavedPrepSheet>

  getQuestionList(memberId: string, visitId: string): Promise<QuestionList | null>
  saveQuestionList(list: QuestionList): Promise<QuestionList>

  listDrafts(memberId: string): Promise<MessageDraft[]>
  saveDraft(draft: MessageDraft): Promise<MessageDraft>

  createFamilyUpdate(update: Omit<FamilyUpdate, 'id' | 'createdAt'>): Promise<FamilyUpdate>
}
