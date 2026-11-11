/**
 * Demo controls: which moment we're in (sets the mock clock), and network
 * simulation for showing loading and error states. Only the mock services and
 * the hidden demo menu read this. Screens never do.
 */

export type SceneId = 'm1' | 'm2' | 'm3'

export interface Scene {
  id: SceneId
  title: string
  subtitle: string
  /** demo "now", local wall time */
  now: string
  startPath: string
}

export const SCENES: Scene[] = [
  {
    id: 'm1',
    title: 'Moment 1 · Neurologist prep',
    subtitle: 'Wed, Nov 11, evening',
    now: '2026-11-11T19:40:00',
    startPath: '/',
  },
  {
    id: 'm2',
    title: 'Moment 2 · Mom is in the hospital',
    subtitle: "Sat, Nov 14, St. Luke's ER",
    now: '2026-11-14T14:40:00',
    startPath: '/m/margaret/ask',
  },
  {
    id: 'm3',
    title: 'Moment 3 · Interaction check',
    subtitle: 'Sat, Nov 14, new prescription',
    now: '2026-11-14T15:05:00',
    startPath: '/m/margaret/meds/new',
  },
]

export interface DemoState {
  scene: SceneId
  slowNetwork: boolean
  failNext: boolean
  /** bumps on every jump/reset so screens remount and refetch */
  epoch: number
}

const KEY = 'casante-demo:state'
const DEFAULT: DemoState = { scene: 'm1', slowNetwork: false, failNext: false, epoch: 0 }

function load(): DemoState {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable: use defaults */
  }
  return { ...DEFAULT }
}

let state = load()
const listeners = new Set<() => void>()

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export const demoState = {
  get(): DemoState {
    return state
  },
  set(patch: Partial<DemoState>) {
    state = { ...state, ...patch }
    save()
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  scene(): Scene {
    return SCENES.find((s) => s.id === state.scene) ?? SCENES[0]
  },
  /** consume the one-shot failure flag */
  takeFailure(): boolean {
    if (!state.failNext) return false
    state = { ...state, failNext: false }
    save()
    return true
  },
}
