/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEALTH_API?: 'mock' | 'live'
  readonly VITE_HEALTH_API_URL?: string
  readonly VITE_APP_STORE?: 'mock' | 'supabase'
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
