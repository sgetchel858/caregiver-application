/** App store fixtures: the family, the user and the family calendar. No medical records here. */
import type { Appointment, AppUser, Family, ToBookItem, UserSettings } from '../../types'

export const currentUser: AppUser = {
  id: 'sarah',
  firstName: 'Sarah',
  lastName: 'Mitchell',
  initials: 'SM',
  avatarColor: '#A5D7C7',
}

export const family: Family = {
  id: 'fam-mitchell',
  name: 'The Mitchells',
  members: [
    { id: 'margaret', healthMemberId: 'margaret', firstName: 'Margaret', relation: 'Mom', userIs: 'daughter', age: 78, initials: 'MM', avatarColor: '#B4D455' },
    { id: 'robert', healthMemberId: 'robert', firstName: 'Robert', relation: 'Dad', userIs: 'daughter', age: 80, initials: 'RM', avatarColor: '#A5D7C7' },
    { id: 'mike', healthMemberId: 'mike', firstName: 'Mike', relation: 'Husband', userIs: 'wife', age: 47, initials: 'MK', avatarColor: '#D8ECF5' },
    { id: 'emma', healthMemberId: 'emma', firstName: 'Emma', relation: 'Daughter', userIs: 'mom', age: 14, initials: 'EM', avatarColor: '#FFF6C8' },
    { id: 'leo', healthMemberId: 'leo', firstName: 'Leo', relation: 'Son', userIs: 'mom', age: 9, initials: 'LM', avatarColor: '#E8F5F1' },
  ],
  careCircles: { margaret: ['robert', 'mike'] },
}

export const defaultSettings: UserSettings = {
  largeText: false,
  shareUpdatesByDefault: true,
}

/**
 * Calendar, from FLOW.md "Calendar (as of Wed, Nov 11)". Dad and Leo have
 * nothing scheduled. The Riverside Neurology phone number is made up.
 */
export const appointments: Appointment[] = [
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
    escortOptions: ['sarah', 'robert', 'mike'],
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
    escortOptions: [],
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
    escortOptions: ['sarah', 'mike'],
  },
]

export const toBookItems: ToBookItem[] = [
  { id: 'book-mike-flu', familyId: 'fam-mitchell', memberId: 'mike', title: 'Flu shot', dueBy: '2026-11-30' },
]
