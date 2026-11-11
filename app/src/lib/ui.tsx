import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface UI {
  /** the phone-sized container; sheets and overlays portal into it */
  deviceEl: HTMLElement | null
  toast: (message: string) => void
  openDemoMenu: () => void
}

const Ctx = createContext<UI | null>(null)

export function UIProvider({
  deviceEl,
  openDemoMenu,
  children,
}: {
  deviceEl: HTMLElement | null
  openDemoMenu: () => void
  children: ReactNode
}) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number>()
  const toast = useCallback((m: string) => {
    setMessage(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(null), 2800)
  }, [])

  return (
    <Ctx.Provider value={{ deviceEl, toast, openDemoMenu }}>
      {children}
      {message && (
        <div className="toast" role="status" aria-live="polite">
          {message}
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useUI(): UI {
  const ui = useContext(Ctx)
  if (!ui) throw new Error('useUI must be used inside <UIProvider>')
  return ui
}
