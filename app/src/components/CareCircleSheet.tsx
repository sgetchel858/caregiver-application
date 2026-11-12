import { useState } from 'react'
import { Sheet } from './Sheet'
import { ErrorState } from './Feedback'
import { useServices } from '../lib/services'
import { useAction } from '../lib/useAsync'
import { isAdult } from '../lib/family'
import type { Family, FamilyMember } from '../services/types'

/** The adults who could get updates about this member: not the user, not the member. */
export function circleCandidates(family: Family, about: FamilyMember): FamilyMember[] {
  return family.members.filter((m) => !m.isSelf && m.id !== about.id && isAdult(m))
}

/** Pick who else gets updates about a member. Closes with `true` when it was saved. */
export function CareCircleSheet({
  family,
  about,
  onClose,
}: {
  family: Family
  about: FamilyMember
  onClose: (saved?: boolean) => void
}) {
  const { store } = useServices()
  const candidates = circleCandidates(family, about)
  const [picked, setPicked] = useState<string[]>(family.careCircles[about.id] ?? [])
  const save = useAction(async () => {
    await store.setCareCircle(about.id, picked)
    onClose(true)
  })
  return (
    <Sheet
      title={about.isSelf ? 'Updates about you' : `Updates about ${about.firstName}`}
      onClose={() => onClose()}
      footer={
        <>
          {!!save.error && <ErrorState error={save.error} title="Couldn't save" />}
          <button className="btn btn--primary btn--48" disabled={save.pending} onClick={() => save.run()}>
            {save.pending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <p className="p muted" style={{ margin: 0 }}>
        {about.isSelf
          ? 'Pick who is offered first when you share an update about yourself.'
          : `You always see updates about ${about.firstName}. Pick who else is offered first when you share one, and who can take ${about.firstName} to visits.`}
      </p>
      <div className="stack">
        {candidates.map((c) => (
          <label key={c.id} className="check-row">
            <input
              type="checkbox"
              checked={picked.includes(c.id)}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))}
            />
            <span>
              {c.firstName} · {c.relation}
            </span>
          </label>
        ))}
      </div>
    </Sheet>
  )
}
