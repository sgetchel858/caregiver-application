import { useRef } from 'react'
import logomark from '../assets/casante-logomark-on-navy.png'
import typemark from '../assets/casante-typemark-white.png'
import { useUI } from '../lib/ui'

const LONG_PRESS_MS = 600

/**
 * The Casanté logo. A long press (600 ms) opens the hidden demo menu.
 * iOS callout and text selection are suppressed so the press isn't hijacked.
 */
export function Logo({ lockup = false, className = '' }: { lockup?: boolean; className?: string }) {
  const { openDemoMenu } = useUI()
  const timer = useRef<number>()

  const start = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      navigator.vibrate?.(15)
      openDemoMenu()
    }, LONG_PRESS_MS)
  }
  const cancel = () => window.clearTimeout(timer.current)

  return (
    <button
      type="button"
      className={`logo-btn ${className}`}
      aria-label="Casanté (press and hold for demo menu)"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {lockup ? (
        <>
          <img src={logomark} alt="" width={34} height={34} draggable={false} />
          <img src={typemark} alt="" width={77} height={23} draggable={false} />
        </>
      ) : (
        <img src={logomark} alt="" width={32} height={32} draggable={false} />
      )}
    </button>
  )
}
