import { Auth0Client, GenericError, type CacheLocation } from '@auth0/auth0-spa-js'
import type { Auth, AuthState } from './Auth'

export interface Auth0Config {
  domain: string
  clientId: string
  /** the Cognatum API audience, `https://sil-api` on beta */
  audience: string
  /** where Auth0 sends the browser back to; must be in the app's Allowed Callback URLs */
  redirectUri: string
  cacheLocation: CacheLocation
}

interface AppState {
  /** the hash route the user was on when sign-in started */
  returnTo?: string
}

/** Auth0 errors that mean "the session is over, sign in again" rather than a fault. */
const SESSION_ENDED = new Set(['login_required', 'consent_required', 'interaction_required', 'missing_refresh_token', 'invalid_grant'])

/**
 * Auth0 Universal Login with PKCE (the SPA flow: no client secret in the bundle).
 *
 * Refresh tokens with rotation are on so the session survives a reload on iOS
 * Safari, which blocks the third-party cookies Auth0's silent iframe relies on.
 */
export class Auth0Auth implements Auth {
  readonly enabled = true
  private client: Auth0Client
  private state: AuthState = { status: 'loading', user: null, error: null }
  private listeners = new Set<() => void>()
  private initOnce: Promise<void> | null = null

  constructor(cfg: Auth0Config) {
    this.client = new Auth0Client({
      domain: cfg.domain,
      clientId: cfg.clientId,
      cacheLocation: cfg.cacheLocation,
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
      authorizationParams: {
        audience: cfg.audience,
        redirect_uri: cfg.redirectUri,
        scope: 'openid profile email offline_access',
      },
    })
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = () => this.state

  private set(next: AuthState) {
    this.state = next
    this.listeners.forEach((l) => l())
  }

  init(): Promise<void> {
    // StrictMode runs effects twice; the redirect code can only be exchanged once.
    this.initOnce ??= this.doInit()
    return this.initOnce
  }

  private async doInit() {
    const url = new URL(window.location.href)
    const p = url.searchParams
    if (p.has('state') && (p.has('code') || p.has('error'))) {
      let returnTo: string | undefined
      let error: string | null = null
      try {
        const res = await this.client.handleRedirectCallback<AppState>()
        returnTo = res.appState?.returnTo
      } catch (e) {
        error = e instanceof GenericError ? e.error_description || e.error : 'Sign-in did not finish. Try again.'
      }
      for (const k of ['code', 'state', 'error', 'error_description']) p.delete(k)
      url.hash = returnTo ?? url.hash
      window.history.replaceState(null, '', url.toString())
      if (error) {
        this.set({ status: 'signed-out', user: null, error })
        return
      }
    }
    await this.refreshUser()
  }

  private async refreshUser() {
    try {
      // Throws when there is no session; a cached session returns without a network call.
      await this.client.getTokenSilently()
      const u = await this.client.getUser()
      this.set({ status: 'signed-in', user: { email: u?.email ?? null, name: u?.name ?? null }, error: null })
    } catch (e) {
      if (e instanceof GenericError && SESSION_ENDED.has(e.error)) {
        this.set({ status: 'signed-out', user: null, error: null })
      } else {
        this.set({ status: 'error', user: null, error: "We couldn't reach the sign-in service. Try again." })
      }
    }
  }

  async login() {
    await this.client.loginWithRedirect<AppState>({ appState: { returnTo: window.location.hash || '#/' } })
  }

  async logout() {
    this.set({ status: 'signed-out', user: null, error: null })
    const base = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
    await this.client.logout({ logoutParams: { returnTo: base } })
  }

  async getAccessToken(): Promise<string> {
    try {
      const token = await this.client.getTokenSilently()
      if (!token) throw new Error('Auth0 returned no access token')
      return token
    } catch (e) {
      if (e instanceof GenericError && SESSION_ENDED.has(e.error)) {
        this.set({ status: 'signed-out', user: null, error: 'Your session ended. Sign in again.' })
      }
      throw e
    }
  }

  async getIdToken(): Promise<string> {
    await this.getAccessToken() // refreshes the session, and with it the ID token, when it has expired
    const claims = await this.client.getIdTokenClaims()
    if (!claims?.__raw) throw new Error('Auth0 returned no ID token')
    return claims.__raw
  }
}
