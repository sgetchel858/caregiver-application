/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEALTH_API?: 'mock' | 'live'
  readonly VITE_HEALTH_API_URL?: string
  readonly VITE_APP_STORE?: 'mock' | 'supabase'
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_AUTH?: 'none' | 'auth0'
  readonly VITE_AUTH0_DOMAIN?: string
  readonly VITE_AUTH0_CLIENT_ID?: string
  readonly VITE_AUTH0_AUDIENCE?: string
  readonly VITE_AUTH0_CACHE?: 'localstorage' | 'memory'
  readonly VITE_SIL_API_URL?: string
  readonly VITE_SIL_TENANT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
