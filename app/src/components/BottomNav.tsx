import { Icon, type IconName } from './Icon'
import { useUI } from '../lib/ui'

const ITEMS: { label: string; icon: IconName }[] = [
  { label: 'Family', icon: 'family' },
  { label: 'Calendar', icon: 'calendar' },
  { label: 'Settings', icon: 'settings' },
]

export function BottomNav({ current = 'Family' }: { current?: string }) {
  const { toast } = useUI()
  return (
    <nav className="bottom-nav" aria-label="Main">
      <div className="bottom-nav__inner">
        {ITEMS.map((it) => {
          const active = it.label === current
          return (
            <button
              key={it.label}
              className="bottom-nav__item"
              aria-current={active ? 'page' : undefined}
              onClick={() => !active && toast(`${it.label} isn't part of this demo.`)}
            >
              <span className="bottom-nav__pill">
                <Icon name={it.icon} size={22} strokeWidth={1.8} color={active ? '#012E4D' : '#535458'} />
              </span>
              {it.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
