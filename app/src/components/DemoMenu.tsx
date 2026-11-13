import { useState, useSyncExternalStore } from 'react'
import { Sheet } from './Sheet'
import { demoState, SCENES, type AskMode, type SceneId } from '../services/demo/demoState'
import { useServices } from '../lib/services'
import { userMessage, ServiceError } from '../services/errors'
import { seedCognatum } from '../services/live/cognatumSeed'
import { runRecallTest } from '../services/live/recallTest'

const ROLES_CLAIM = 'https://sil.app/roles'

const ASK_MODES: { id: AskMode; label: string }[] = [
  { id: 'hybrid', label: 'Demo questions scripted, others from Cognatum' },
  { id: 'live', label: 'Everything from Cognatum' },
  { id: 'scripted', label: 'Scripted only (offline-safe)' },
]

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

      {modes.ask === 'cognatum' && (
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Ask answers</span>
          {ASK_MODES.map((m) => (
            <label key={m.id} className="check-row">
              <input type="radio" name="ask-mode" checked={state.askMode === m.id} onChange={() => demoState.set({ askMode: m.id })} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      )}

      <button className="btn btn--text" onClick={onReset}>
        Reset demo data
      </button>
      {auth.enabled && <CognatumSection />}

      <p className="small muted" style={{ margin: 0 }}>
        Health API: {modes.health} · Ask: {modes.ask === 'cognatum' ? `Cognatum (${state.askMode})` : 'scripted'} · App store: {modes.store} · Sign-in: {modes.auth}
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
      // SIL re-syncs Auth0-sourced roles from this claim on every request; a token
      // without it strips them. /auth/me works either way, so check it explicitly.
      const claims = await sil.tokenClaims()
      const tokenRoles = claims[ROLES_CLAIM]
      const claimText = Array.isArray(tokenRoles)
        ? `token roles claim: ${tokenRoles.join(', ') || 'empty'}`
        : 'token has NO roles claim'
      setCheck({
        busy: false,
        ok: Array.isArray(tokenRoles) && tokenRoles.length > 0,
        text: `Connected to ${tenant.name} as ${me.email} (${me.roles.join(', ') || 'no roles'}) · ${claimText}`,
      })
    } catch (e) {
      const detail = e instanceof ServiceError ? ` [${e.message}]` : ''
      setCheck({ busy: false, ok: false, text: userMessage(e) + detail })
    }
  }

  const [seedState, setSeedState] = useState<{ busy: boolean; text: string | null }>({ busy: false, text: null })
  const seed = async () => {
    setSeedState({ busy: true, text: 'Starting…' })
    try {
      const r = await seedCognatum(sil, (p) => setSeedState({ busy: true, text: p.line }))
      const failed = r.failed.length ? ` · FAILED: ${r.failed.join('; ')}` : ''
      setSeedState({
        busy: false,
        text: `Done: ${r.uploaded} uploaded, ${r.replaced} replaced, ${r.unchanged} unchanged${failed}. Folders: ${Object.entries(r.memberFolders)
          .map(([m, id]) => `${m} ${id}`)
          .join(', ')}`,
      })
    } catch (e) {
      const detail = e instanceof ServiceError ? ` [${e.message}]` : ` [${String(e)}]`
      setSeedState({ busy: false, text: userMessage(e) + detail })
    }
  }

  const [recallState, setRecallState] = useState<{ busy: boolean; text: string | null }>({ busy: false, text: null })
  const recall = async () => {
    setRecallState({ busy: true, text: 'Starting…' })
    try {
      const rows = await runRecallTest(sil, (line) => setRecallState({ busy: true, text: line }))
      // Full rows for the console (and for whoever is driving the browser).
      ;(window as unknown as { __recall?: unknown }).__recall = rows
      console.table(rows.map((r) => ({ pass: r.pass, q: r.q, cited: r.cited.join(', '), error: r.error ?? '' })))
      const passed = rows.filter((r) => r.pass).length
      const misses = rows.filter((r) => !r.pass).map((r) => r.q)
      setRecallState({ busy: false, text: `Recall: ${passed}/${rows.length} passed${misses.length ? ` · missed: ${misses.join(' | ')}` : ''}` })
    } catch (e) {
      setRecallState({ busy: false, text: `Recall test failed: ${e instanceof Error ? e.message : String(e)}` })
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
        <button className="btn btn--outline" onClick={seed} disabled={seedState.busy || !sil.configured}>
          {seedState.busy ? 'Seeding…' : 'Seed Mitchell records'}
        </button>
        <button className="btn btn--outline" onClick={recall} disabled={recallState.busy || !sil.configured}>
          {recallState.busy ? 'Testing…' : 'Run recall test'}
        </button>
        <button className="btn btn--text" onClick={() => void auth.logout()}>
          Sign out
        </button>
      </div>
      {!sil.configured && <p className="small muted" style={{ margin: 0 }}>Set VITE_SIL_API_URL and VITE_SIL_TENANT to test.</p>}
      {recallState.text && (
        <p className="small" role="status" style={{ margin: 0 }} data-testid="recall-status">
          {recallState.text}
        </p>
      )}
      {seedState.text && (
        <p className="small" role="status" style={{ margin: 0 }} data-testid="seed-status">
          {seedState.text}
        </p>
      )}
      {check.text && (
        <p className={`small ${check.ok ? '' : 'muted'}`} role="status" style={{ margin: 0 }}>
          {check.text}
        </p>
      )}
    </div>
  )
}
