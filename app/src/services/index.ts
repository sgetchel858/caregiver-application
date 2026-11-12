/**
 * Picks the service implementations from env vars, once, at startup.
 * Screens get them through useServices() and never know which is which.
 *
 *   VITE_HEALTH_API = mock | live        (live needs VITE_HEALTH_API_URL)
 *   VITE_APP_STORE  = mock | supabase
 *   VITE_AUTH       = none | auth0       (auth0 needs VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID)
 *   VITE_SIL_API_URL, VITE_SIL_TENANT    the Cognatum API and workspace the signed-in user calls
 */
import type { HealthApi } from './HealthApi'
import type { AppStore } from './AppStore'
import { realClock, type Clock } from './Clock'
import { MockHealthApi, mockClock } from './mock/MockHealthApi'
import { MockAppStore } from './mock/MockAppStore'
import { LiveHealthApi } from './live/LiveHealthApi'
import { SupabaseAppStore } from './live/SupabaseAppStore'
import { SilClient } from './live/SilClient'
import { NoAuth, type Auth } from './auth/Auth'
import { Auth0Auth } from './auth/Auth0Auth'

export interface Services {
  health: HealthApi
  store: AppStore
  clock: Clock
  /** sign-in; a no-op unless VITE_AUTH=auth0 */
  auth: Auth
  /** authenticated Cognatum (SIL) API client for the configured tenant */
  sil: SilClient
  /** true when either service is a mock (enables demo-only controls) */
  isDemo: boolean
  modes: { health: 'mock' | 'live'; store: 'mock' | 'supabase'; auth: 'none' | 'auth0' }
}

function createAuth(env: ImportMetaEnv): Auth {
  if (env.VITE_AUTH !== 'auth0') return new NoAuth()
  if (!env.VITE_AUTH0_DOMAIN || !env.VITE_AUTH0_CLIENT_ID) {
    throw new Error('VITE_AUTH=auth0 needs VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID')
  }
  return new Auth0Auth({
    domain: env.VITE_AUTH0_DOMAIN,
    clientId: env.VITE_AUTH0_CLIENT_ID,
    audience: env.VITE_AUTH0_AUDIENCE || 'https://sil-api',
    // The app's own root (hash routing keeps every screen under it).
    redirectUri: new URL(env.BASE_URL, window.location.origin).toString(),
    cacheLocation: env.VITE_AUTH0_CACHE === 'memory' ? 'memory' : 'localstorage',
  })
}

export function createServices(env: ImportMetaEnv = import.meta.env): Services {
  const healthMode = env.VITE_HEALTH_API === 'live' ? 'live' : 'mock'
  const storeMode = env.VITE_APP_STORE === 'supabase' ? 'supabase' : 'mock'

  const auth = createAuth(env)
  const sil = new SilClient(env.VITE_SIL_API_URL, env.VITE_SIL_TENANT, auth)

  const health: HealthApi =
    healthMode === 'live'
      ? new LiveHealthApi(env.VITE_HEALTH_API_URL, auth.enabled ? () => sil.authHeaders() : undefined)
      : new MockHealthApi()
  const store: AppStore = storeMode === 'supabase' ? new SupabaseAppStore() : new MockAppStore()

  return {
    health,
    store,
    clock: healthMode === 'live' ? realClock : mockClock,
    auth,
    sil,
    isDemo: healthMode === 'mock' || storeMode === 'mock',
    modes: { health: healthMode, store: storeMode, auth: auth.enabled ? 'auth0' : 'none' },
  }
}

export type { HealthApi, AppStore, Clock, Auth }
