/**
 * Sign-in for the live services. Screens never touch the Auth0 SDK directly.
 *
 *   VITE_AUTH = none | auth0
 *
 * `none` (default) keeps the demo fully offline. `auth0` signs the user in with
 * Auth0 Universal Login and gets access tokens for the Cognatum (SIL) API.
 */
export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'error'

export interface AuthUser {
  email: string | null
  name: string | null
}

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  /** a sign-in error to show on the sign-in screen (e.g. the user denied consent) */
  error: string | null
}

export interface Auth {
  readonly enabled: boolean
  /** finishes a login redirect if there is one, then restores any existing session */
  init(): Promise<void>
  /** sends the browser to the sign-in page; returns to the current screen afterwards */
  login(): Promise<void>
  logout(): Promise<void>
  /** a short-lived access token for the Cognatum API; signs out if the session has ended */
  getAccessToken(): Promise<string>
  /** the user's ID token, which Supabase trusts for the app store; refreshed with the session */
  getIdToken(): Promise<string>

  /* useSyncExternalStore */
  subscribe(listener: () => void): () => void
  getState(): AuthState
}

const SIGNED_IN: AuthState = { status: 'signed-in', user: null, error: null }

/** No sign-in: the mock services need none. */
export class NoAuth implements Auth {
  readonly enabled = false
  async init() {}
  async login() {}
  async logout() {}
  async getAccessToken(): Promise<string> {
    throw new Error('Sign-in is not configured (VITE_AUTH=none)')
  }
  async getIdToken(): Promise<string> {
    throw new Error('Sign-in is not configured (VITE_AUTH=none)')
  }
  subscribe() {
    return () => {}
  }
  getState() {
    return SIGNED_IN
  }
}
