import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AgentAnswer } from '../services/types'
import { useServices } from '../lib/services'
import { userMessage } from '../services/errors'

export interface Turn {
  id: string
  question: string
  status: 'pending' | 'done' | 'error'
  answer?: AgentAnswer
  error?: string
}

type Threads = Record<string, Turn[]>

interface ThreadsApi {
  turns: (memberId: string) => Turn[]
  ask: (memberId: string, question: string) => void
  retry: (memberId: string, turnId: string) => void
}

const KEY = 'casante-demo:threads'
const Ctx = createContext<ThreadsApi | null>(null)

function load(): Threads {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

/**
 * Ask conversations, one per family member. Kept for this browser session
 * only (not in the app store); see DATA.md if you want them persisted.
 */
export function ThreadsProvider({ children }: { children: ReactNode }) {
  const { health } = useServices()
  const [threads, setThreads] = useState<Threads>(load)
  const latest = useRef(threads)
  latest.current = threads

  useEffect(() => {
    try {
      // never persist in-flight turns: a reload would leave them spinning forever
      const settled: Threads = {}
      for (const [k, v] of Object.entries(threads)) settled[k] = v.filter((t) => t.status !== 'pending')
      sessionStorage.setItem(KEY, JSON.stringify(settled))
    } catch {
      /* ignore */
    }
  }, [threads])

  const update = (memberId: string, turnId: string, patch: Partial<Turn>) =>
    setThreads((all) => ({
      ...all,
      [memberId]: (all[memberId] ?? []).map((t) => (t.id === turnId ? { ...t, ...patch } : t)),
    }))

  const run = useCallback(
    (memberId: string, turnId: string, question: string) => {
      health.ask({ memberId, question, threadId: `thread-${memberId}` }).then(
        (answer) => update(memberId, turnId, { status: 'done', answer, error: undefined }),
        (err) => update(memberId, turnId, { status: 'error', error: userMessage(err) }),
      )
    },
    [health],
  )

  const ask = useCallback(
    (memberId: string, question: string) => {
      const id = `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      setThreads((all) => ({ ...all, [memberId]: [...(all[memberId] ?? []), { id, question, status: 'pending' }] }))
      run(memberId, id, question)
    },
    [run],
  )

  const retry = useCallback(
    (memberId: string, turnId: string) => {
      const turn = latest.current[memberId]?.find((t) => t.id === turnId)
      if (!turn) return
      update(memberId, turnId, { status: 'pending', error: undefined })
      run(memberId, turnId, turn.question)
    },
    [run],
  )

  const turns = useCallback((memberId: string) => threads[memberId] ?? [], [threads])

  return <Ctx.Provider value={{ turns, ask, retry }}>{children}</Ctx.Provider>
}

export function clearThreads() {
  try {
    sessionStorage.removeItem(KEY)
    sessionStorage.removeItem('casante-demo:checks')
  } catch {
    /* ignore */
  }
}

export function useThreads(): ThreadsApi {
  const t = useContext(Ctx)
  if (!t) throw new Error('useThreads must be used inside <ThreadsProvider>')
  return t
}
