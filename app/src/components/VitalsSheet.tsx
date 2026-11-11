import { Sheet } from './Sheet'
import { Async, Skeleton } from './Feedback'
import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { monthDayYear } from '../lib/format'

export function VitalsSheet({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const { health } = useServices()
  const state = useAsync(() => health.getVitals(memberId, 'bp'), [memberId])
  return (
    <Sheet title="Blood pressure readings" onClose={onClose}>
      <Async state={state} skeleton={<Skeleton h={160} />}>
        {(readings) => (
          <div className="card" style={{ padding: '4px 16px', background: '#F4F4F4' }}>
            {[...readings].reverse().map((r, i) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: i ? '1px solid #E4E4E4' : 0 }}>
                <div className="stack" style={{ gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{monthDayYear(r.takenAt)}</span>
                  <span className="small muted">{r.facility}</span>
                </div>
                <span className="big-value" style={{ fontSize: 22 }}>
                  {r.systolic}/{r.diastolic}
                </span>
              </div>
            ))}
          </div>
        )}
      </Async>
    </Sheet>
  )
}
