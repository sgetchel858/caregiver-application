import { ServiceError } from '../errors'
import { demoState } from '../demo/demoState'

export type CallKind = 'read' | 'write' | 'agent'

const RANGES: Record<CallKind, [number, number]> = {
  read: [300, 650],
  write: [250, 500],
  agent: [900, 1500],
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Wraps every mock call: a short realistic delay, optional "slow network",
 * a one-shot simulated failure, and a deep copy so callers can't mutate fixtures.
 */
export async function simulate<T>(fn: () => T | Promise<T>, kind: CallKind = 'read'): Promise<T> {
  const [min, max] = RANGES[kind]
  let ms = min + Math.random() * (max - min)
  if (demoState.get().slowNetwork) ms *= 4
  await sleep(ms)
  if (demoState.takeFailure()) {
    throw new ServiceError('network', 'Simulated network failure (demo menu)')
  }
  const value = await fn()
  return value === undefined ? value : structuredClone(value)
}
