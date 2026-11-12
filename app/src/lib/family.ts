import type { AppUser, Family, FamilyMember } from '../services/types'

const BY_RELATION = new Set(['Mom', 'Dad', 'Grandma', 'Grandpa'])

/** How the user says who this is: "Mom", "Dad", or a first name. */
export function callName(m: FamilyMember): string {
  return BY_RELATION.has(m.relation) ? m.relation : m.firstName
}

/** Name for the user's id or a family member's id; null if neither. */
export function personName(id: string, user: AppUser, family: Family): string | null {
  if (id === user.id) return user.firstName
  const m = family.members.find((x) => x.id === id)
  return m ? callName(m) : null
}

export function fullName(m: FamilyMember): string {
  return `${m.firstName} ${m.lastName}`.trim()
}

export function initialsOf(firstName: string, lastName: string): string {
  const first = firstName.trim()
  const last = lastName.trim()
  if (!first) return ''
  return ((first[0] ?? '') + (last[0] ?? first[1] ?? '')).toUpperCase()
}

/** Adults can get updates and take people to visits. An unknown age counts as an adult. */
export function isAdult(m: FamilyMember): boolean {
  return m.age === null || m.age >= 18
}

/** The member for a route id: their own id or their Health API id. */
export function findMember(family: Family, id: string): FamilyMember | undefined {
  return family.members.find((m) => m.id === id) ?? family.members.find((m) => m.healthMemberId === id)
}

/* ---- relationships ---- */

export const AVATAR_COLORS = ['#B4D455', '#A5D7C7', '#D8ECF5', '#FFF6C8', '#E8F5F1']

/** relation -> how that person refers to the user: [as a woman, as a man, either] */
const INVERSE: Record<string, [string, string, string]> = {
  Mom: ['daughter', 'son', 'child'],
  Dad: ['daughter', 'son', 'child'],
  Husband: ['wife', 'husband', 'partner'],
  Wife: ['wife', 'husband', 'partner'],
  Partner: ['partner', 'partner', 'partner'],
  Daughter: ['mom', 'dad', 'parent'],
  Son: ['mom', 'dad', 'parent'],
  Sister: ['sister', 'brother', 'sibling'],
  Brother: ['sister', 'brother', 'sibling'],
  Grandma: ['granddaughter', 'grandson', 'grandchild'],
  Grandpa: ['granddaughter', 'grandson', 'grandchild'],
}

export const RELATIONS = [...Object.keys(INVERSE), 'Other']

/**
 * A starting value for "you are their …" when the user picks a relation.
 * It follows the words already used in this family ("daughter", "wife"), and
 * stays neutral when there is nothing to go on. The user can change it.
 */
export function guessUserIs(relation: string, family: Family): string {
  const forms = INVERSE[relation]
  if (!forms) return 'family member'
  const used = new Set(family.members.map((m) => m.userIs))
  const all = Object.values(INVERSE)
  const column = [0, 1].find((i) => all.some((f) => f[i] !== f[1 - i] && used.has(f[i]))) ?? 2
  return forms[column]
}
