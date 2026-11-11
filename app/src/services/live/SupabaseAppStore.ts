import type { AppStore } from '../AppStore'
import { ServiceError } from '../errors'

/**
 * Supabase-backed app store: NOT WIRED YET.
 *
 * To implement:
 *   1. npm install @supabase/supabase-js
 *   2. createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
 *      (the anon key is public by design; protect every table with row-level security)
 *   3. Implement each method against the tables suggested in DATA.md.
 *
 * App data only: no medical records and no agent logic belong here.
 */
const notYet = (method: string): Promise<never> =>
  Promise.reject(new ServiceError('not-configured', `SupabaseAppStore.${method} is not implemented yet`))

export class SupabaseAppStore implements AppStore {
  getCurrentUser() { return notYet('getCurrentUser') }
  getFamily() { return notYet('getFamily') }
  getSettings() { return notYet('getSettings') }
  updateSettings() { return notYet('updateSettings') }
  getPrepSheet() { return notYet('getPrepSheet') }
  savePrepSheet() { return notYet('savePrepSheet') }
  getQuestionList() { return notYet('getQuestionList') }
  saveQuestionList() { return notYet('saveQuestionList') }
  listDrafts() { return notYet('listDrafts') }
  saveDraft() { return notYet('saveDraft') }
  createFamilyUpdate() { return notYet('createFamilyUpdate') }
}
