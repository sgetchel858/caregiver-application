import { useState, useSyncExternalStore } from 'react'
import { Sheet } from './Sheet'
import { demoState, SCENES, type SceneId } from '../services/demo/demoState'
import { useServices } from '../lib/services'
import { userMessage, ServiceError } from '../services/errors'

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
  const { modes, auth } = useServices()
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
      {auth.enabled && <CognatumSection />}

      <p className="small muted" style={{ margin: 0 }}>
        Health API: {modes.health} · App store: {modes.store} · Sign-in: {modes.auth}
      </p>
    </Sheet>
  )
}

/** Who is signed in, and a one-tap check that the Cognatum API accepts them in the configured workspace. */
function CognatumSection() {
  const { auth, sil } = useServices()
  const { user } = useSyncExternalStore(auth.subscribe, auth.getState)
  const [check, setCheck] = useState<{ busy: boolean; text: string | null; ok: boolean }>({ busy: false, text: null, ok: false })

  const test = async () => {
    setCheck({ busy: true, text: null, ok: false })
    try {
      const { me, tenant } = await sil.connect()
      setCheck({ busy: false, ok: true, text: `Connected to ${tenant.name} as ${me.email} (${me.roles.join(', ') || 'no roles'})` })
    } catch (e) {
      const detail = e instanceof ServiceError ? ` [${e.message}]` : ''
      setCheck({ busy: false, ok: false, text: userMessage(e) + detail })
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="eyebrow">Cognatum</span>
      <p className="small" style={{ margin: 0 }}>
        Signed in as {user?.email ?? user?.name ?? 'unknown'}
      </p>
      <div className="btn-row">
        <button className="btn btn--outline" onClick={test} disabled={check.busy || !sil.configured}>
          {check.busy ? 'Checking…' : 'Test connection'}
        </button>
        <button className="btn btn--text" onClick={() => void auth.logout()}>
          Sign out
        </button>
      </div>
      {!sil.configured && <p className="small muted" style={{ margin: 0 }}>Set VITE_SIL_API_URL and VITE_SIL_TENANT to test.</p>}
      {check.text && (
        <p className={`small ${check.ok ? '' : 'muted'}`} role="status" style={{ margin: 0 }}>
          {check.text}
        </p>
      )}
    </div>
  )
}
