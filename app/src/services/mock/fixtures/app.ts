/** App store fixtures: the family and the user. No medical data here. */
import type { AppUser, Family, UserSettings } from '../../types'

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
