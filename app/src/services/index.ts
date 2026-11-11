/**
 * Picks the service implementations from env vars, once, at startup.
 * Screens get them through useServices() and never know which is which.
 *
 *   VITE_HEALTH_API = mock | live        (live needs VITE_HEALTH_API_URL)
 *   VITE_APP_STORE  = mock | supabase
 */
import type { HealthApi } from './HealthApi'
import type { AppStore } from './AppStore'
import { realClock, type Clock } from './Clock'
import { MockHealthApi, mockClock } from './mock/MockHealthApi'
import { MockAppStore } from './mock/MockAppStore'
import { LiveHealthApi } from './live/LiveHealthApi'
import { SupabaseAppStore } from './live/SupabaseAppStore'

export interface Services {
  health: HealthApi
  store: AppStore
  clock: Clock
  /** true when either service is a mock (enables demo-only controls) */
  isDemo: boolean
  modes: { health: 'mock' | 'live'; store: 'mock' | 'supabase' }
}

export function createServices(env: ImportMetaEnv = import.meta.env): Services {
  const healthMode = env.VITE_HEALTH_API === 'live' ? 'live' : 'mock'
  const storeMode = env.VITE_APP_STORE === 'supabase' ? 'supabase' : 'mock'

  const health: HealthApi = healthMode === 'live' ? new LiveHealthApi(env.VITE_HEALTH_API_URL) : new MockHealthApi()
  const store: AppStore = storeMode === 'supabase' ? new SupabaseAppStore() : new MockAppStore()

  return {
    health,
    store,
    clock: healthMode === 'live' ? realClock : mockClock,
    isDemo: healthMode === 'mock' || storeMode === 'mock',
    modes: { health: healthMode, store: storeMode },
  }
}

export type { HealthApi, AppStore, Clock }
