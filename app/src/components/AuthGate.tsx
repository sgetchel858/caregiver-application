import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import logomark from '../assets/casante-logomark-on-navy.png'
import { useServices } from '../lib/services'
import { clearThreads } from '../state/threads'
import {
  IDLE_LIMIT_MS,
  clearActive,
  clearIdleSignOut,
  idleExpired,
  noteIdleSignOut,
  useIdleTimeout,
  wasIdleSignOut,
} from '../lib/idle'

const IDLE_MINUTES = Math.round(IDLE_LIMIT_MS / 60_000)

/**
 * Shows the app only to a signed-in user when VITE_AUTH=auth0.
 * With sign-in off (the default demo), it renders the app straight away.
 *
 * A signed-in user is signed out after 10 minutes without a tap, key or scroll
 * (lib/idle.ts), with a one-minute warning first.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { auth } = useServices()
  const state = useSyncExternalStore(auth.subscribe, auth.getState)
  const [busy, setBusy] = useState(false)

  const signedIn = auth.enabled && state.status === 'signed-in'

  const signOutIdle = () => {
    clearThreads() // Ask conversations kept in this tab
    clearActive()
    noteIdleSignOut()
    void auth.logout()
  }

  useEffect(() => {
    if (!auth.enabled) return
    // Coming back from the sign-in page is a fresh session, whatever the last one left behind.
    const q = new URLSearchParams(window.location.search)
    const returning = q.has('state') && (q.has('code') || q.has('error'))
    if (returning) clearActive()
    // Left idle too long while the app was closed: end that session before showing anything.
    if (!returning && idleExpired()) signOutIdle()
    else void auth.init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth])

  // Signed out by any route: the next sign-in starts with a fresh clock.
  useEffect(() => {
    if (state.status === 'signed-out') clearActive()
  }, [state.status])

  const secondsLeft = useIdleTimeout(signedIn, signOutIdle)

  if (!auth.enabled) return <>{children}</>
  if (state.status === 'signed-in') {
    return (
      <>
        {children}
        {secondsLeft !== null && (
          <div className="overlay" style={{ zIndex: 80 }}>
            <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-text">
              <div className="sheet__head">
                <h2 className="sheet__title" id="idle-title">
                  Still there?
                </h2>
              </div>
              <div className="sheet__body">
                <p className="p" id="idle-text" style={{ margin: 0 }}>
                  To keep your family's health details private, you'll be signed out in {secondsLeft}{' '}
                  {secondsLeft === 1 ? 'second' : 'seconds'}.
                </p>
                {/* any tap counts as activity, so the button needs no handler of its own */}
                <button className="btn btn--primary btn--48" autoFocus>
                  Stay signed in
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  const idleNote = state.status === 'signed-out' && !state.error && wasIdleSignOut()

  const signIn = () => {
    clearIdleSignOut()
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
              {idleNote && (
                <p className="p" role="status" style={{ margin: 0 }}>
                  You were signed out after {IDLE_MINUTES} minutes without activity.
                </p>
              )}
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
