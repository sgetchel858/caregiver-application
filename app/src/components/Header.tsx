import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from './Icon'
import { Logo } from './Logo'
import { Avatar } from './Avatar'
import { ContextStrip } from './ContextStrip'

/** Home header: user avatar, logo lockup, notifications. */
export function HomeHeader({ user, onBell }: { user?: { initials: string; avatarColor: string; firstName: string }; onBell: () => void }) {
  return (
    <header className="header">
      <div className="header__bar header__bar--home">
        {user ? (
          <Avatar initials={user.initials} color={user.avatarColor} size={40} label={user.firstName} />
        ) : (
          <div style={{ width: 40 }} />
        )}
        <Logo lockup />
        <button className="header__icon-btn" aria-label="Notifications" onClick={onBell}>
          <Icon name="bell" strokeWidth={1.8} />
        </button>
      </div>
    </header>
  )
}

/**
 * Inner-screen header: back (or close), optional member avatar, title, logo.
 * `contextFor` shows the "At St. Luke's" strip when that member has an active encounter.
 */
export function Header({
  title,
  back,
  backLabel = 'Back',
  close,
  avatar,
  contextFor,
  extra,
}: {
  title: string
  /** route to go back to; omitted = browser history */
  back?: string | (() => void)
  backLabel?: string
  close?: boolean
  avatar?: { initials: string; color: string }
  contextFor?: string
  extra?: ReactNode
}) {
  const navigate = useNavigate()
  const goBack = () => {
    if (typeof back === 'function') back()
    else if (typeof back === 'string') navigate(back)
    else navigate(-1)
  }
  return (
    <header className="header">
      <div className="header__bar">
        <button className="header__icon-btn" aria-label={close ? 'Close' : backLabel} onClick={goBack}>
          <Icon name={close ? 'close' : 'back'} size={close ? 22 : 24} />
        </button>
        {avatar && <Avatar initials={avatar.initials} color={avatar.color} size={32} />}
        <span className="header__title">{title}</span>
        {extra}
        <Logo className="logo-btn--end" />
      </div>
      {contextFor && <ContextStrip memberId={contextFor} />}
    </header>
  )
}
