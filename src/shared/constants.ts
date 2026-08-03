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
 *
 * `@` must survive verbatim: it is a legal path character (RFC 3986 pchar) and
 * Gmail resolves the segment *before* percent-decoding it, so `u/me%40gmail.com`
 * matches no account and lands on Gmail's "Temporary Error (404)" page.
 */
function mailboxSegment(account?: string | null): string {
  if (!account) return '0'
  // Every character a real address can hold — letters, digits and `@ . _ - +`
  // — is already legal in a path segment, so the address goes through as-is.
  // Anything else is not an address worth trusting in a URL: fall back to the
  // first signed-in account rather than emit a malformed (or escapable) link.
  return /^[A-Za-z0-9@._+-]+$/.test(account) ? account : '0'
}

export function gmailInboxUrl(account?: string | null): string {
  return `https://mail.google.com/mail/u/${mailboxSegment(account)}/#inbox`
}

/**
 * Deep link to a single conversation inside the Gmail web client.
 *
 * The thread is addressed through `all` rather than `inbox`: the `inbox` view
 * can only resolve ids it currently holds, so a conversation that sits behind a
 * category tab — or that was archived between the widget rendering it and the
 * click — fails there. All Mail holds every thread regardless of label.
 */
export function gmailThreadUrl(threadId: string, account?: string | null): string {
  return `https://mail.google.com/mail/u/${mailboxSegment(account)}/#all/${encodeURIComponent(threadId)}`
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
