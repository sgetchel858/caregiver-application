import type { FamilyMember } from '../../services/types'
import { callName } from '../../lib/family'

/** Everyone, or one person. Members are told apart by initials as well as color. */
export function MemberFilter({
  members,
  selected,
  onSelect,
}: {
  members: FamilyMember[]
  /** FamilyMember.id, or null for everyone */
  selected: string | null
  onSelect: (memberId: string | null) => void
}) {
  return (
    <div className="cal-filter" role="group" aria-label="Show calendar for">
      <button className="cal-filter__all" aria-pressed={selected === null} onClick={() => onSelect(null)}>
        Everyone
      </button>
      {members.map((m) => (
        <button
          key={m.id}
          className="cal-filter__person"
          style={{ background: m.avatarColor }}
          aria-label={`Show only ${callName(m)}`}
          aria-pressed={selected === m.id}
          onClick={() => onSelect(selected === m.id ? null : m.id)}
        >
          {m.initials}
        </button>
      ))}
    </div>
  )
}
