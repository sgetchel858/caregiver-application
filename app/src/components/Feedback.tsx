import type { ReactNode } from 'react'
import { userMessage } from '../services/errors'
import type { AsyncState } from '../lib/useAsync'
import { Icon } from './Icon'

export function Skeleton({ h = 72, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />
}

/** Default skeleton for a screen: a few card-shaped blocks. */
export function ScreenSkeleton({ blocks = [56, 140, 96, 96] }: { blocks?: number[] }) {
  return (
    <div className="stack" style={{ gap: 14 }} role="status" aria-label="Loading">
      {blocks.map((h, i) => (
        <Skeleton key={i} h={h} />
      ))}
    </div>
  )
}

export function ErrorState({
  error,
  message,
  onRetry,
  title = "Couldn't load this",
}: {
  error?: unknown
  message?: string
  onRetry?: () => void
  title?: string
}) {
  return (
    <div className="error-box" role="alert">
      <p className="error-box__title">{title}</p>
      <p className="p muted">{message ?? userMessage(error)}</p>
      {onRetry && (
        <button className="btn btn--outline" onClick={onRetry}>
          <Icon name="refresh" size={18} />
          Try again
        </button>
      )}
    </div>
  )
}

/** Renders loading, error (with retry) or the content for an async state. */
export function Async<T>({
  state,
  skeleton,
  errorTitle,
  children,
}: {
  state: AsyncState<T> & { reload: () => void }
  skeleton?: ReactNode
  errorTitle?: string
  children: (data: T) => ReactNode
}) {
  if (state.status === 'loading') return <>{skeleton ?? <ScreenSkeleton />}</>
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={state.reload} title={errorTitle} />
  return <>{children(state.data)}</>
}

export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="spinner">
      <circle cx="12" cy="12" r="9" fill="none" stroke="#E4E4E4" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="#23B5AF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
