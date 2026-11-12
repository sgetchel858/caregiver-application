import { useState } from 'react'
import { Sheet } from './Sheet'
import { Avatar } from './Avatar'
import { ErrorState } from './Feedback'
import { useServices } from '../lib/services'
import { useAction } from '../lib/useAsync'
import { AVATAR_COLORS, RELATIONS, guessUserIs, initialsOf } from '../lib/family'
import type { Family, FamilyMember, MemberInput } from '../services/types'

export type MemberEditResult = { saved: FamilyMember } | { removed: FamilyMember }

/**
 * Add a family member, or edit one (the user's own entry included).
 * Closes with what happened, or with nothing when it was dismissed.
 */
export function MemberEditSheet({
  family,
  member,
  onClose,
}: {
  family: Family
  /** omitted = add a new member */
  member?: FamilyMember
  onClose: (result?: MemberEditResult) => void
}) {
  const { store, clock } = useServices()
  const self = family.members.find((m) => m.isSelf)
  const isSelf = !!member?.isSelf
  const known = !member || RELATIONS.includes(member.relation)

  const [firstName, setFirstName] = useState(member?.firstName ?? '')
  const [lastName, setLastName] = useState(member?.lastName ?? self?.lastName ?? '')
  const [relation, setRelation] = useState(member ? (known ? member.relation : 'Other') : '')
  const [otherRelation, setOtherRelation] = useState(member && !known ? member.relation : '')
  const [userIs, setUserIs] = useState(member?.userIs ?? '')
  const [birthYear, setBirthYear] = useState(member?.birthYear ? String(member.birthYear) : '')
  const [color, setColor] = useState(
    member?.avatarColor ?? AVATAR_COLORS[family.members.length % AVATAR_COLORS.length],
  )
  const [confirmRemove, setConfirmRemove] = useState(false)

  const thisYear = clock.now().getFullYear()
  const year = birthYear.trim() ? Number(birthYear) : null
  const yearOk = year === null || (Number.isInteger(year) && year >= 1900 && year <= thisYear)
  const relationText = relation === 'Other' ? otherRelation.trim() : relation
  const valid = !!firstName.trim() && yearOk && (isSelf || (!!relationText && !!userIs.trim()))

  const pickRelation = (value: string) => {
    setRelation(value)
    if (value !== 'Other') setUserIs(guessUserIs(value, family))
  }

  const save = useAction(async () => {
    const input: MemberInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      relation: isSelf ? member.relation : relationText,
      userIs: isSelf ? member.userIs : userIs.trim(),
      birthYear: year,
      avatarColor: color,
    }
    const saved = member ? await store.updateMember(member.id, input) : await store.addMember(input)
    onClose({ saved })
  })

  const remove = useAction(async () => {
    if (!member) return
    await store.removeMember(member.id)
    onClose({ removed: member })
  })

  const busy = save.pending || remove.pending
  const name = firstName.trim() || 'them'

  return (
    <Sheet
      title={!member ? 'Add a family member' : isSelf ? 'Edit your profile' : `Edit ${member.firstName}'s profile`}
      onClose={() => onClose()}
      footer={
        confirmRemove && member ? (
          <>
            {!!remove.error && <ErrorState error={remove.error} title="Couldn't remove" />}
            <div className="btn-row">
              <button className="btn btn--outline btn--48" disabled={busy} onClick={() => setConfirmRemove(false)}>
                Keep
              </button>
              <button className="btn btn--primary btn--48" disabled={busy} onClick={() => remove.run()}>
                {remove.pending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </>
        ) : (
          <>
            {!!save.error && <ErrorState error={save.error} title="Couldn't save" />}
            <button type="submit" form="member-form" className="btn btn--primary btn--48" disabled={!valid || busy}>
              {save.pending ? 'Saving…' : member ? 'Save' : 'Add to family'}
            </button>
            {member && !isSelf && (
              <button className="btn btn--text" style={{ alignSelf: 'center' }} disabled={busy} onClick={() => setConfirmRemove(true)}>
                Remove from family
              </button>
            )}
          </>
        )
      }
    >
      {confirmRemove && member && (
        <p className="p" style={{ margin: 0 }}>
          Remove {member.firstName} from {family.name}? Their calendar items, prep sheets and drafts in Casanté are removed
          too. Their medical records are not affected.
        </p>
      )}
      <form
        id="member-form"
        className="stack"
        style={{ gap: 14, display: confirmRemove ? 'none' : undefined }}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !busy) save.run()
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar initials={member && firstName.trim() === member.firstName && lastName.trim() === member.lastName ? member.initials : initialsOf(firstName, lastName)} color={color} size={52} />
          <div className="swatches" role="group" aria-label="Color">
            {AVATAR_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                className="swatch"
                style={{ background: c }}
                aria-label={`Color ${i + 1}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor="mem-first">
              First name
            </label>
            <input id="mem-first" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="mem-last">
              Last name
            </label>
            <input id="mem-last" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
          </div>
        </div>

        {!isSelf && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="mem-relation">
                {firstName.trim() ? `${firstName.trim()} is your…` : 'They are your…'}
              </label>
              <select id="mem-relation" className="input" value={relation} onChange={(e) => pickRelation(e.target.value)}>
                <option value="" disabled>
                  Choose
                </option>
                {RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {relation === 'Other' && (
                <input
                  className="input"
                  aria-label="Relationship"
                  placeholder="Aunt, friend, neighbor…"
                  value={otherRelation}
                  onChange={(e) => setOtherRelation(e.target.value)}
                />
              )}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="mem-user-is">
                You are {name === 'them' ? 'their' : `${name}'s`}…
              </label>
              <input id="mem-user-is" className="input" placeholder="daughter, son, partner…" value={userIs} onChange={(e) => setUserIs(e.target.value)} autoCapitalize="none" aria-describedby="mem-user-is-note" />
              <span id="mem-user-is-note" className="small muted">
                Shown when you hand the phone to a nurse or doctor.
              </span>
            </div>
          </>
        )}

        <div className="field">
          <label className="field__label" htmlFor="mem-year">
            Birth year (optional)
          </label>
          <input
            id="mem-year"
            className="input"
            inputMode="numeric"
            maxLength={4}
            placeholder="1948"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))}
            aria-invalid={!yearOk}
            aria-describedby="mem-year-note"
          />
          <span id="mem-year-note" className="small muted" aria-live="polite">
            {yearOk ? ' ' : `Enter a year between 1900 and ${thisYear}.`}
          </span>
        </div>
      </form>
    </Sheet>
  )
}
