import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useUI } from '../lib/ui'
import { Icon } from './Icon'

/** Bottom sheet (modal dialog) inside the phone frame. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const { deviceEl } = useUI()
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  if (!deviceEl) return null
  return createPortal(
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <div className="sheet__grip" aria-hidden="true" />
        <div className="sheet__head">
          <h2 className="sheet__title" id={id}>
            {title}
          </h2>
          <button className="sheet__close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>{footer}</div>}
      </div>
    </div>,
    deviceEl,
  )
}

/** Full-screen large-type view, for handing the phone to a nurse or doctor. */
export function FullScreen({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  const { deviceEl } = useUI()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!deviceEl) return null
  return createPortal(
    <div className="fullscreen" role="dialog" aria-modal="true" aria-label={label}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px 12px 24px' }}>
        <span className="eyebrow">{label}</span>
        <button className="btn btn--outline" onClick={onClose} autoFocus>
          Done
        </button>
      </div>
      <div className="scroll">
        <div className="col stack" style={{ gap: 20, padding: '8px 24px 32px' }}>
          {children}
        </div>
      </div>
    </div>,
    deviceEl,
  )
}
