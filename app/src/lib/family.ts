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
