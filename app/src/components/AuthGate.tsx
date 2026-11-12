import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import logomark from '../assets/casante-logomark-on-navy.png'
import { useServices } from '../lib/services'

/**
 * Shows the app only to a signed-in user when VITE_AUTH=auth0.
 * With sign-in off (the default demo), it renders the app straight away.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { auth } = useServices()
  const state = useSyncExternalStore(auth.subscribe, auth.getState)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void auth.init()
  }, [auth])

  if (!auth.enabled || state.status === 'signed-in') return <>{children}</>

  const signIn = () => {
    setBusy(true)
    auth.login().catch(() => setBusy(false))
  }

  return (
    <div className="screen screen--white">
      <div className="scroll">
        <div className="col stack main" style={{ minHeight: '100%', justifyContent: 'center', gap: 18 }}>
          <img src={logomark} alt="Casanté" width={56} height={56} style={{ borderRadius: 14 }} />
          {state.status === 'loading' ? (
            <p className="p muted" role="status">
              Signing you in…
            </p>
          ) : (
            <>
              <h1 className="h1">Sign in to Casanté</h1>
              <p className="p muted" style={{ margin: 0 }}>
                Use your Cognatum email and password.
              </p>
              {state.error && (
                <p className="p" role="alert" style={{ margin: 0 }}>
                  {state.error}
                </p>
              )}
              <button className="btn btn--primary btn--block btn--lg" onClick={signIn} disabled={busy}>
                {busy ? 'Opening sign-in…' : 'Sign in'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
