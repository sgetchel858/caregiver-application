import type { AppStore } from '../AppStore'
import type {
  AppUser,
  Family,
  FamilyUpdate,
  MessageDraft,
  QuestionList,
  SavedPrepSheet,
  UserSettings,
} from '../types'
import { simulate } from './latency'
import { currentUser, defaultSettings, family } from './fixtures/app'

/**
 * Mock app store backed by localStorage (per browser), seeded from fixtures.
 * Shape mirrors the suggested Supabase tables in DATA.md.
 */
const PREFIX = 'casante-demo:app:'

interface Tables {
  settings: UserSettings
  prepSheets: Record<string, SavedPrepSheet>
  questionLists: Record<string, QuestionList>
  drafts: Record<string, MessageDraft>
  familyUpdates: FamilyUpdate[]
}

const EMPTY: Tables = {
  settings: defaultSettings,
  prepSheets: {},
  questionLists: {},
  drafts: {},
  familyUpdates: [],
}

function read<K extends keyof Tables>(table: K): Tables[K] {
  try {
    const raw = localStorage.getItem(PREFIX + table)
    if (raw) return JSON.parse(raw)
  } catch {
    /* storage blocked: fall through to defaults */
  }
  return structuredClone(EMPTY[table])
}

function write<K extends keyof Tables>(table: K, value: Tables[K]) {
  try {
    localStorage.setItem(PREFIX + table, JSON.stringify(value))
  } catch {
    /* storage blocked: keep going without persistence */
  }
}

export function resetMockAppStore() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

const key = (memberId: string, visitId: string) => `${memberId}:${visitId}`

export class MockAppStore implements AppStore {
  getCurrentUser(): Promise<AppUser> {
    return simulate(() => currentUser)
  }

  getFamily(): Promise<Family> {
    return simulate(() => family)
  }

  getSettings(): Promise<UserSettings> {
    return simulate(() => read('settings'))
  }

  updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
    return simulate(() => {
      const next = { ...read('settings'), ...patch }
      write('settings', next)
      return next
    }, 'write')
  }

  getPrepSheet(memberId: string, visitId: string): Promise<SavedPrepSheet | null> {
    return simulate(() => read('prepSheets')[key(memberId, visitId)] ?? null)
  }

  savePrepSheet(sheet: SavedPrepSheet): Promise<SavedPrepSheet> {
    return simulate(() => {
      const all = read('prepSheets')
      all[key(sheet.memberId, sheet.visitId)] = sheet
      write('prepSheets', all)
      return sheet
    }, 'write')
  }

  getQuestionList(memberId: string, visitId: string): Promise<QuestionList | null> {
    return simulate(() => read('questionLists')[key(memberId, visitId)] ?? null)
  }

  saveQuestionList(list: QuestionList): Promise<QuestionList> {
    return simulate(() => {
      const all = read('questionLists')
      const saved = { ...list, updatedAt: new Date().toISOString() }
      all[key(list.memberId, list.visitId)] = saved
      write('questionLists', all)
      return saved
    }, 'write')
  }

  listDrafts(memberId: string): Promise<MessageDraft[]> {
    return simulate(() => Object.values(read('drafts')).filter((d) => d.memberId === memberId))
  }

  saveDraft(draft: MessageDraft): Promise<MessageDraft> {
    return simulate(() => {
      const all = read('drafts')
      const saved = { ...draft, updatedAt: new Date().toISOString() }
      all[draft.id] = saved
      write('drafts', all)
      return saved
    }, 'write')
  }

  createFamilyUpdate(update: Omit<FamilyUpdate, 'id' | 'createdAt'>): Promise<FamilyUpdate> {
    return simulate(() => {
      const created: FamilyUpdate = {
        ...update,
        id: `upd-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
      }
      write('familyUpdates', [...read('familyUpdates'), created])
      return created
    }, 'write')
  }
}
