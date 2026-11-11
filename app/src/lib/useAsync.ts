import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: unknown }

/**
 * Runs an async loader on mount and when deps change. Ignores results from
 * stale runs. `reload()` retries (used by every error state's Retry button).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)
  const run = useRef(0)

  useEffect(() => {
    const id = ++run.current
    setState({ status: 'loading' })
    fn().then(
      (data) => id === run.current && setState({ status: 'success', data }),
      (error) => id === run.current && setState({ status: 'error', error }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}

/** wraps a one-off action (button press) with pending and error state */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true)
      setError(null)
      try {
        return await fn(...args)
      } catch (e) {
        setError(e)
        return undefined
      } finally {
        setPending(false)
      }
    },
    [fn],
  )
  return { run, pending, error, clearError: () => setError(null) }
}
