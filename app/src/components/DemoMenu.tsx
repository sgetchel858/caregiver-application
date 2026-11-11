import { useSyncExternalStore } from 'react'
import { Sheet } from './Sheet'
import { demoState, SCENES, type SceneId } from '../services/demo/demoState'
import { useServices } from '../lib/services'

/** Hidden presenter menu (long-press the logo). */
export function DemoMenu({
  onClose,
  onJump,
  onReset,
}: {
  onClose: () => void
  onJump: (scene: SceneId) => void
  onReset: () => void
}) {
  const state = useSyncExternalStore(demoState.subscribe, demoState.get)
  const { modes } = useServices()
  return (
    <Sheet title="Demo menu" onClose={onClose}>
      <div className="stack" style={{ gap: 10 }}>
        <span className="eyebrow">Jump to the start of</span>
        {SCENES.map((s) => (
          <button
            key={s.id}
            className="btn btn--outline btn--block"
            style={{ justifyContent: 'space-between', minHeight: 60, textAlign: 'left', ...(state.scene === s.id ? { borderWidth: 2 } : {}) }}
            onClick={() => onJump(s.id)}
          >
            <span className="stack" style={{ gap: 2 }}>
              <span>{s.title}</span>
              <span className="small muted" style={{ fontWeight: 400 }}>
                {s.subtitle}
              </span>
            </span>
            {state.scene === s.id && <span className="badge">Current</span>}
          </button>
        ))}
      </div>

      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">Network</span>
        <label className="check-row">
          <input type="checkbox" checked={state.slowNetwork} onChange={(e) => demoState.set({ slowNetwork: e.target.checked })} />
          <span>Slow network (4× delay)</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={state.failNext} onChange={(e) => demoState.set({ failNext: e.target.checked })} />
          <span>Fail the next request (shows the error state)</span>
        </label>
      </div>

      <button className="btn btn--text" onClick={onReset}>
        Reset demo data
      </button>
      <p className="small muted" style={{ margin: 0 }}>
        Health API: {modes.health} · App store: {modes.store}
      </p>
    </Sheet>
  )
}
