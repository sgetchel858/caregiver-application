/** App store fixtures: the family, the user and the family calendar. No medical records here. */
import type { Appointment, AppUser, Family, FamilyMember, ToBookItem, UserSettings } from '../../types'

export const currentUser: AppUser = {
  id: 'sarah',
  firstName: 'Sarah',
  lastName: 'Mitchell',
  initials: 'SM',
  avatarColor: '#A5D7C7',
}

/** As stored: ages are worked out from the birth year when the family is read. */
export type StoredMember = Omit<FamilyMember, 'age'>
export type StoredFamily = Omit<Family, 'members'> & { members: StoredMember[] }
/** As stored: who could take them is worked out from the care circles. */
export type StoredAppointment = Omit<Appointment, 'escortOptions'>

const member = (m: Omit<StoredMember, 'lastName' | 'isSelf' | 'healthMemberId'>): StoredMember => ({
  ...m,
  healthMemberId: m.id,
  lastName: 'Mitchell',
  isSelf: false,
})

export const family: StoredFamily = {
  id: 'fam-mitchell',
  name: 'The Mitchells',
  members: [
    // Sarah herself: her entry has the same id as the user
    { ...member({ id: 'sarah', firstName: 'Sarah', relation: 'Me', userIs: 'self', birthYear: 1981, initials: 'SM', avatarColor: '#A5D7C7' }), healthMemberId: null, isSelf: true },
    member({ id: 'margaret', firstName: 'Margaret', relation: 'Mom', userIs: 'daughter', birthYear: 1948, initials: 'MM', avatarColor: '#B4D455' }),
    member({ id: 'robert', firstName: 'Robert', relation: 'Dad', userIs: 'daughter', birthYear: 1946, initials: 'RM', avatarColor: '#A5D7C7' }),
    member({ id: 'mike', firstName: 'Mike', relation: 'Husband', userIs: 'wife', birthYear: 1979, initials: 'MK', avatarColor: '#D8ECF5' }),
    member({ id: 'emma', firstName: 'Emma', relation: 'Daughter', userIs: 'mom', birthYear: 2012, initials: 'EM', avatarColor: '#FFF6C8' }),
    member({ id: 'leo', firstName: 'Leo', relation: 'Son', userIs: 'mom', birthYear: 2017, initials: 'LM', avatarColor: '#E8F5F1' }),
  ],
  careCircles: { margaret: ['robert', 'mike'], emma: ['mike'], leo: ['mike'] },
}

export const defaultSettings: UserSettings = {
  largeText: false,
  shareUpdatesByDefault: true,
}

/**
 * Calendar, from FLOW.md "Calendar (as of Wed, Nov 11)". Dad and Leo have
 * nothing scheduled. The Riverside Neurology phone number is made up.
 */
export const appointments: StoredAppointment[] = [
  {
    id: 'appt-okafor',
    familyId: 'fam-mitchell',
    memberId: 'margaret',
    kind: 'visit',
    title: 'Neurology with Dr. Okafor',
    date: '2026-11-12',
    startsAt: '2026-11-12T10:30:00',
    place: 'Riverside Neurology',
    placePhone: '(555) 014-3300',
    note: 'first visit, hand tremor',
    healthVisitId: 'v-okafor',
    escortId: 'sarah',
  },
  {
    id: 'appt-warfarin-refill',
    familyId: 'fam-mitchell',
    memberId: 'margaret',
    kind: 'refill',
    title: 'Warfarin refill due',
    date: '2026-11-29',
    startsAt: null,
    place: 'Main Street Pharmacy',
    placePhone: null,
    note: null,
    healthVisitId: null,
    escortId: null,
  },
  {
    id: 'appt-emma-physical',
    familyId: 'fam-mitchell',
    memberId: 'emma',
    kind: 'visit',
    title: 'Annual physical',
    date: '2026-12-03',
    startsAt: '2026-12-03T15:45:00',
    place: null,
    placePhone: null,
    note: null,
    healthVisitId: null,
    escortId: null,
  },
]

export const toBookItems: ToBookItem[] = [
  { id: 'book-mike-flu', familyId: 'fam-mitchell', memberId: 'mike', title: 'Flu shot', dueBy: '2026-11-30' },
]
