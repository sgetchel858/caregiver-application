import type { AppStore } from '../AppStore'
import type {
  Appointment,
  AppUser,
  DateRange,
  Family,
  FamilyUpdate,
  MessageDraft,
  QuestionList,
  SavedPrepSheet,
  ToBookItem,
  UserSettings,
} from '../types'
import { simulate } from './latency'
import { ServiceError } from '../errors'
import { appointments, currentUser, defaultSettings, family, toBookItems } from './fixtures/app'

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
  /** escort choices made in the demo, over the fixture appointments: appointmentId -> escortId */
  appointmentEscorts: Record<string, string | null>
}

const EMPTY: Tables = {
  settings: defaultSettings,
  prepSheets: {},
  questionLists: {},
  drafts: {},
  familyUpdates: [],
  appointmentEscorts: {},
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

/** fixture appointments with the saved escort choices applied */
function allAppointments(): Appointment[] {
  const escorts = read('appointmentEscorts')
  return appointments.map((a) => (a.id in escorts ? { ...a, escortId: escorts[a.id] } : a))
}

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

  listAppointments(familyId: string, range: DateRange): Promise<Appointment[]> {
    return simulate(() =>
      allAppointments()
        .filter((a) => a.familyId === familyId && a.date >= range.from && a.date <= range.to)
        .sort((a, b) => (a.startsAt ?? a.date).localeCompare(b.startsAt ?? b.date)),
    )
  }

  getAppointment(appointmentId: string): Promise<Appointment | null> {
    return simulate(() => allAppointments().find((a) => a.id === appointmentId) ?? null)
  }

  listToBookItems(familyId: string): Promise<ToBookItem[]> {
    return simulate(() => toBookItems.filter((t) => t.familyId === familyId).sort((a, b) => a.dueBy.localeCompare(b.dueBy)))
  }

  setAppointmentEscort(appointmentId: string, escortId: string | null): Promise<Appointment> {
    return simulate(() => {
      const appt = allAppointments().find((a) => a.id === appointmentId)
      if (!appt) throw new ServiceError('not-found', 'Appointment not found')
      if (escortId !== null && !appt.escortOptions.includes(escortId)) {
        throw new ServiceError('server', 'That person is not in the care circle for this visit')
      }
      write('appointmentEscorts', { ...read('appointmentEscorts'), [appointmentId]: escortId })
      return { ...appt, escortId }
    }, 'write')
  }
}
