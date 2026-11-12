import { useEffect, useState } from 'react'

/** Sign out after this long with no taps, keys or scrolling. */
export const IDLE_LIMIT_MS = 10 * 60_000
/** Show "still there?" this long before signing out. */
export const IDLE_WARNING_MS = 60_000

// Shared by every tab of the app, and kept when the tab closes, so coming back
// to a tab that was left open (or reopening the app) counts the time away.
const LAST_ACTIVE = 'casante:last-active'
const SIGNED_OUT_IDLE = 'casante:signed-out-idle'

function lastActive(): number | null {
  try {
    const n = Number(localStorage.getItem(LAST_ACTIVE))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function markActive() {
  try {
    localStorage.setItem(LAST_ACTIVE, String(Date.now()))
  } catch {
    /* storage blocked: the timeout still runs from this tab's own activity */
  }
}

/** Forget the activity time (on sign-out, so the next sign-in starts fresh). */
export function clearActive() {
  try {
    localStorage.removeItem(LAST_ACTIVE)
  } catch {
    /* ignore */
  }
}

/** True when a session was left idle past the limit, e.g. the app was closed and reopened later. */
export function idleExpired(): boolean {
  const t = lastActive()
  return t !== null && Date.now() - t >= IDLE_LIMIT_MS
}

/** Remember, across the sign-out redirect, why the user is back on the sign-in screen. */
export function noteIdleSignOut() {
  try {
    sessionStorage.setItem(SIGNED_OUT_IDLE, '1')
  } catch {
    /* ignore */
  }
}

export function wasIdleSignOut(): boolean {
  try {
    return sessionStorage.getItem(SIGNED_OUT_IDLE) === '1'
  } catch {
    return false
  }
}

export function clearIdleSignOut() {
  try {
    sessionStorage.removeItem(SIGNED_OUT_IDLE)
  } catch {
    /* ignore */
  }
}

// What a person does. Not `scroll`: the page scrolls itself (focus moving to the
// warning does it), which would cancel the warning it just showed.
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * While `active`, watches for taps, keys and wheel or touch scrolling. Calls `onTimeout` once
 * after IDLE_LIMIT_MS without any. Returns the seconds left once the warning
 * should show, otherwise null.
 */
export function useIdleTimeout(active: boolean, onTimeout: () => void): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!active) return
    // Opening the app counts as activity. A session left idle too long never gets here: AuthGate ends it first.
    let last = Date.now()
    let written = 0
    let done = false
    markActive()

    const onActivity = () => {
      last = Date.now()
      // these fire constantly; one write every few seconds is plenty
      if (last - written > 5_000) {
        written = last
        markActive()
      }
      setSecondsLeft(null)
    }

    const check = () => {
      if (done) return
      // another tab of the app may have been used more recently
      last = Math.max(last, lastActive() ?? 0)
      const left = IDLE_LIMIT_MS - (Date.now() - last)
      if (left <= 0) {
        done = true
        onTimeout()
      } else {
        setSecondsLeft(left <= IDLE_WARNING_MS ? Math.ceil(left / 1000) : null)
      }
    }

    for (const e of ACTIVITY) window.addEventListener(e, onActivity, { capture: true, passive: true })
    // Timers slow down or stop in a background tab, so check again on return.
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    const timer = window.setInterval(check, 1_000)
    return () => {
      for (const e of ACTIVITY) window.removeEventListener(e, onActivity, { capture: true })
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return active ? secondsLeft : null
}
