import { useState } from 'react'
import { Sheet } from './Sheet'
import { ErrorState } from './Feedback'
import { useServices } from '../lib/services'
import { useAction } from '../lib/useAsync'
import { joinNames } from '../lib/format'
import type { Family, FamilyUpdate } from '../services/types'

/**
 * "Share with family": pick who gets a short update about a member.
 * Nothing is shared until the user confirms. Closes with the ids it went to.
 */
export function ShareSheet({
  family,
  aboutMemberId,
  summary,
  refTo,
  onClose,
}: {
  family: Family
  aboutMemberId: string
  summary: string
  refTo: FamilyUpdate['ref']
  onClose: (sentTo?: string[]) => void
}) {
  const { store } = useServices()
  const candidates = family.members.filter((m) => m.age >= 18 && m.healthMemberId !== aboutMemberId && m.id !== aboutMemberId)
  const [picked, setPicked] = useState<string[]>(
    (family.careCircles[aboutMemberId] ?? []).filter((id) => candidates.some((c) => c.id === id)),
  )
  const send = useAction(async () => {
    const user = await store.getCurrentUser()
    await store.createFamilyUpdate({
      fromUserId: user.id,
      aboutMemberId,
      toMemberIds: picked,
      summary,
      ref: refTo,
    })
    onClose(picked)
  })
  return (
    <Sheet
      title="Share with family"
      onClose={() => onClose()}
      footer={
        <>
          {!!send.error && <ErrorState error={send.error} title="Couldn't share" />}
          <button className="btn btn--primary btn--48" disabled={!picked.length || send.pending} onClick={() => send.run()}>
            {send.pending ? 'Sharing…' : `Share with ${joinNames(candidates.filter((c) => picked.includes(c.id)).map((c) => c.firstName)) || '…'}`}
          </button>
          <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
            Only the people you pick will see it.
          </p>
        </>
      }
    >
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
      <div className="note">{summary}</div>
    </Sheet>
  )
}
