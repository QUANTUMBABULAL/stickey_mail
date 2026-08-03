export const APP_ID = 'com.mailsticker.app'
export const APP_NAME = 'Mail Sticker'

/**
 * Least-privilege Gmail scope: `gmail.modify` covers reading messages and
 * removing the UNREAD label. The account address is read from
 * `users.getProfile`, so no extra profile scope is required.
 */
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.modify'] as const

/**
 * Gmail accepts an account index *or* an email address in the `/u/` segment,
 * so passing the linked address opens the right mailbox even when the browser
 * is signed into several Google accounts.
 */
function mailboxSegment(account?: string | null): string {
  return account ? encodeURIComponent(account) : '0'
}

export function gmailInboxUrl(account?: string | null): string {
  return `https://mail.google.com/mail/u/${mailboxSegment(account)}/#inbox`
}

/** Deep link to a single conversation inside the Gmail web client. */
export function gmailThreadUrl(threadId: string, account?: string | null): string {
  return `https://mail.google.com/mail/u/${mailboxSegment(account)}/#inbox/${encodeURIComponent(threadId)}`
}

/** Number of characters kept from the plain-text body for the preview. */
export const PREVIEW_MAX_CHARS = 260

/** How long the OAuth loopback server waits for the browser round-trip. */
export const OAUTH_TIMEOUT_MS = 5 * 60 * 1000

/** Backoff ceiling applied after repeated Gmail failures. */
export const MAX_BACKOFF_MS = 5 * 60 * 1000

export const ERROR_CODES = {
  NoCredentials: 'no-credentials',
  NotSignedIn: 'not-signed-in',
  AuthExpired: 'auth-expired',
  Network: 'network',
  RateLimited: 'rate-limited',
  Gmail: 'gmail',
  Unknown: 'unknown'
} as const
