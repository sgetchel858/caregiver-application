import { useServices } from '../lib/services'
import { useAsync } from '../lib/useAsync'
import { weekdayMonthDay } from '../lib/format'
import { Icon } from './Icon'

/** "At St. Luke's Medical Center · Sat, Nov 14". Renders nothing without an active encounter. */
export function ContextStrip({ memberId }: { memberId: string }) {
  const { health } = useServices()
  const enc = useAsync(() => health.getCurrentEncounter(memberId), [memberId])
  if (enc.status !== 'success' || !enc.data) return null
  return (
    <div className="context-strip">
      <div className="col context-strip__inner">
        <Icon name="hospital" size={16} color="#A5D7C7" />
        <span>
          At {enc.data.facility} · {weekdayMonthDay(enc.data.startedAt)}
        </span>
      </div>
    </div>
  )
}
