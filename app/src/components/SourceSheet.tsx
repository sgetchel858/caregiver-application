import type { ReactNode } from 'react'
import { Sheet } from './Sheet'
import { Async, Skeleton } from './Feedback'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { monthDayYear } from '../lib/format'
import type { SourceRef } from '../services/types'

function highlight(text: string, part?: string): ReactNode {
  if (!part) return text
  const i = text.indexOf(part)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{part}</mark>
      {text.slice(i + part.length)}
    </>
  )
}

/** Opens the record behind a citation, with the passage the agent used highlighted. */
export function SourceSheet({ memberId, source, onClose }: { memberId: string; source: SourceRef; onClose: () => void }) {
  const { health } = useServices()
  const rec = useAsync(() => health.getRecord(memberId, source.recordId), [memberId, source.recordId])
  return (
    <Sheet title={source.label} onClose={onClose}>
      <Async
        state={rec}
        skeleton={
          <div className="stack" style={{ gap: 10 }}>
            <Skeleton h={18} w="60%" />
            <Skeleton h={110} />
          </div>
        }
      >
        {(r) => (
          <>
            <div className="stack" style={{ gap: 2 }}>
              <span style={{ fontWeight: 600, color: '#0C4668' }}>{r.title}</span>
              <span className="small muted">
                {monthDayYear(r.date)} · {r.facility}
                {r.author ? ` · ${r.author}` : ''}
              </span>
            </div>
            <p className="excerpt" style={{ margin: 0 }}>
              {highlight(r.excerpt, r.highlight)}
            </p>
            <p className="small muted" style={{ margin: 0 }}>
              {r.kind === 'interaction-db'
                ? 'From a licensed drug-interaction database, not the AI’s judgment.'
                : r.kind === 'hub-log'
                  ? 'From the kitchen hub’s dose log.'
                  : 'From her medical records in MyChart.'}
            </p>
          </>
        )}
      </Async>
    </Sheet>
  )
}
