import { ERROR_CODES } from '@shared/constants'
import type { AppError } from '@shared/types'

/** Error carrying a stable code that survives the trip to the renderer. */
export class MailStickerError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, options: { retryable?: boolean; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'MailStickerError'
    this.code = code
    this.retryable = options.retryable ?? false
  }

  toAppError(): AppError {
    return { code: this.code, message: this.message, retryable: this.retryable }
  }
}

interface GoogleApiErrorShape {
  code?: number | string
  message?: string
  response?: { status?: number; data?: { error?: string; error_description?: string } }
  errors?: { message?: string; reason?: string }[]
}

const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET'
])

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error
  return 'Unexpected error'
}

/**
 * Normalises anything thrown by googleapis / node into an `AppError` the UI can
 * present, with a code the widget uses to decide between "retry" and "sign in".
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof MailStickerError) return error.toAppError()

  const raw = (error ?? {}) as GoogleApiErrorShape & { code?: string | number }
  const status = typeof raw.response?.status === 'number' ? raw.response.status : undefined
  const oauthError = raw.response?.data?.error
  const nodeCode = typeof raw.code === 'string' ? raw.code : undefined

  if (nodeCode && NETWORK_CODES.has(nodeCode)) {
    return {
      code: ERROR_CODES.Network,
      message: 'No connection to Gmail. Retrying automatically.',
      retryable: true
    }
  }

  if (oauthError === 'invalid_grant' || status === 401) {
    return {
      code: ERROR_CODES.AuthExpired,
      message: 'Google access expired. Please sign in again.',
      retryable: false
    }
  }

  if (oauthError === 'invalid_client') {
    return {
      code: ERROR_CODES.NoCredentials,
      message: 'The Google OAuth client id or secret is not valid.',
      retryable: false
    }
  }

  if (status === 429 || status === 403) {
    return {
      code: ERROR_CODES.RateLimited,
      message: 'Gmail is rate limiting requests. Slowing down.',
      retryable: true
    }
  }

  if (typeof status === 'number' && status >= 500) {
    return {
      code: ERROR_CODES.Gmail,
      message: 'Gmail is temporarily unavailable.',
      retryable: true
    }
  }

  return {
    code: ERROR_CODES.Unknown,
    message: messageOf(error),
    retryable: true
  }
}

export function isAuthError(error: AppError): boolean {
  return error.code === ERROR_CODES.AuthExpired || error.code === ERROR_CODES.NotSignedIn
}
