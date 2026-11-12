export type ServiceErrorCode =
  | 'network'
  | 'timeout'
  | 'not-found'
  | 'server'
  | 'not-configured'
  | 'unauthorized'
  | 'forbidden'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode
  readonly retryable: boolean
  constructor(code: ServiceErrorCode, message: string) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.retryable = code === 'network' || code === 'timeout' || code === 'server'
  }
}

export function userMessage(err: unknown): string {
  if (err instanceof ServiceError) {
    switch (err.code) {
      case 'network':
        return "We couldn't reach Casanté. Check your connection and try again."
      case 'timeout':
        return 'This is taking longer than usual. Try again in a moment.'
      case 'not-found':
        return "We couldn't find that. It may have been removed."
      case 'not-configured':
        return 'This service isn’t set up yet.'
      case 'unauthorized':
        return 'Your session ended. Sign in again.'
      case 'forbidden':
        return 'Your account doesn’t have access to this.'
      default:
        return 'Something went wrong on our side. Try again in a moment.'
    }
  }
  return 'Something went wrong. Try again in a moment.'
}
