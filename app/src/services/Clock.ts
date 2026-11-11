/** "Now" for the app. Live: the real time. Mock: the demo scene's time. */
export interface Clock {
  now(): Date
}

export const realClock: Clock = { now: () => new Date() }
