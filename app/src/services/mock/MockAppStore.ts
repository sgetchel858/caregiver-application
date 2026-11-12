import type { AppStore } from '../AppStore'
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
} from '../types'
import { simulate } from './latency'
import { ServiceError } from '../errors'
import { initialsOf } from '../../lib/family'
import { mockClock } from './MockHealthApi'
import { appointments, currentUser, defaultSettings, family, toBookItems, type StoredFamily, type StoredMember } from './fixtures/app'

/**
 * Mock app store backed by localStorage (per browser), seeded from fixtures.
 * Shape mirrors the suggested Supabase tables in DATA.md.
 */
const PREFIX = 'casante-demo:app:'

interface Tables {
  user: AppUser
  /** the family as edited in the demo; starts as the fixture family */
  family: StoredFamily
  settings: UserSettings
  prepSheets: Record<string, SavedPrepSheet>
  questionLists: Record<string, QuestionList>
  drafts: Record<string, MessageDraft>
  familyUpdates: FamilyUpdate[]
  /** escort choices made in the demo, over the fixture appointments: appointmentId -> escortId */
  appointmentEscorts: Record<string, string | null>
}

const EMPTY: Tables = {
  user: currentUser,
  family,
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

const withAge = (m: StoredMember): FamilyMember => ({
  ...m,
  age: m.birthYear === null ? null : mockClock.now().getFullYear() - m.birthYear,
})

/**
 * Fixture appointments for people still in the family, with the saved escort
 * choices applied. Who could take them: the user first, then the care circle.
 */
function allAppointments(): Appointment[] {
  const escorts = read('appointmentEscorts')
  const fam = read('family')
  const user = read('user')
  const inFamily = (id: string) => fam.members.some((m) => m.id === id)
  return appointments
    .filter((a) => inFamily(a.memberId))
    .map((a) => {
      const escortId = a.id in escorts ? escorts[a.id] : a.escortId
      return {
        ...a,
        escortId: escortId && inFamily(escortId) ? escortId : null,
        escortOptions: a.kind === 'visit' ? [...new Set([user.id, ...(fam.careCircles[a.memberId] ?? [])])] : [],
      }
    })
}

function storedMember(fam: StoredFamily, memberId: string): StoredMember {
  const m = fam.members.find((x) => x.id === memberId) ?? fam.members.find((x) => x.healthMemberId === memberId)
  if (!m) throw new ServiceError('not-found', `No family member "${memberId}"`)
  return m
}

export class MockAppStore implements AppStore {
  getCurrentUser(): Promise<AppUser> {
    return simulate(() => read('user'))
  }

  getFamily(): Promise<Family> {
    return simulate(() => {
      const fam = read('family')
      return { ...fam, members: fam.members.map(withAge) }
    })
  }

  addMember(input: MemberInput): Promise<FamilyMember> {
    return simulate(() => {
      const fam = read('family')
      const created: StoredMember = {
        ...input,
        id: `mem-${Date.now().toString(36)}`,
        healthMemberId: null,
        initials: initialsOf(input.firstName, input.lastName),
        isSelf: false,
      }
      write('family', { ...fam, members: [...fam.members, created] })
      return withAge(created)
    }, 'write')
  }

  updateMember(memberId: string, patch: Partial<MemberInput>): Promise<FamilyMember> {
    return simulate(() => {
      const fam = read('family')
      const before = storedMember(fam, memberId)
      const next: StoredMember = { ...before, ...patch }
      // initials tell people apart ("MM", "MK"), so they only change with the name
      if (next.firstName !== before.firstName || next.lastName !== before.lastName) {
        next.initials = initialsOf(next.firstName, next.lastName)
      }
      write('family', { ...fam, members: fam.members.map((m) => (m.id === before.id ? next : m)) })
      if (next.isSelf) {
        write('user', {
          ...read('user'),
          firstName: next.firstName,
          lastName: next.lastName,
          initials: next.initials,
          avatarColor: next.avatarColor,
        })
      }
      return withAge(next)
    }, 'write')
  }

  removeMember(memberId: string): Promise<void> {
    return simulate(() => {
      const fam = read('family')
      const gone = storedMember(fam, memberId)
      if (gone.isSelf) throw new ServiceError('forbidden', 'You cannot remove yourself from the family')
      const careCircles: Record<string, string[]> = {}
      for (const [about, notify] of Object.entries(fam.careCircles)) {
        if (about !== gone.id) careCircles[about] = notify.filter((id) => id !== gone.id)
      }
      write('family', { ...fam, members: fam.members.filter((m) => m.id !== gone.id), careCircles })
    }, 'write')
  }

  setCareCircle(memberId: string, notifyIds: string[]): Promise<string[]> {
    return simulate(() => {
      const fam = read('family')
      const about = storedMember(fam, memberId)
      const saved = fam.members
        .filter((m) => !m.isSelf && m.id !== about.id && notifyIds.includes(m.id))
        .map((m) => m.id)
      write('family', { ...fam, careCircles: { ...fam.careCircles, [about.id]: saved } })
      return saved
    }, 'write')
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
    return simulate(() => {
      const members = read('family').members
      return toBookItems
        .filter((t) => t.familyId === familyId && members.some((m) => m.id === t.memberId))
        .sort((a, b) => a.dueBy.localeCompare(b.dueBy))
    })
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
