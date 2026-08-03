import { EventEmitter } from 'node:events'
import { ERROR_CODES, MAX_BACKOFF_MS } from '@shared/constants'
import type { EmailPreview, MailSnapshot } from '@shared/types'
import { toAppError } from '../core/errors'
import { createLogger } from '../core/logger'
import type { AuthService } from './authService'
import type { GmailService } from './gmailService'

const log = createLogger('watcher')

const SEEN_IDS_LIMIT = 250

type Events = {
  update: [MailSnapshot]
  'new-mail': [EmailPreview]
}

const EMPTY_SNAPSHOT: MailSnapshot = {
  status: 'loading',
  email: null,
  unreadCount: 0,
  lastUpdatedAt: null,
  error: null,
  isFetching: false,
  account: null
}

export type RefreshReason = 'startup' | 'interval' | 'manual' | 'auth' | 'resume' | 'mark-read'

/**
 * Keeps a single source of truth for "what should the widget show right now".
 *
 * Polls Gmail on a timer, detects genuinely new messages, applies exponential
 * backoff when Gmail or the network misbehaves, and pushes every change to
 * listeners so the renderer only ever mirrors state it is given.
 */
export class MailWatcher extends EventEmitter<Events> {
  private readonly auth: AuthService
  private readonly gmail: GmailService

  private snapshot: MailSnapshot = EMPTY_SNAPSHOT
  private timer: NodeJS.Timeout | null = null
  private intervalSeconds: number
  private inFlight: Promise<MailSnapshot> | null = null
  private failureCount = 0
  private lastRevision: string | null = null
  private seenIds: string[] = []
  private primed = false
  private suspended = false
  private started = false

  constructor(auth: AuthService, gmail: GmailService, intervalSeconds: number) {
    super()
    this.auth = auth
    this.gmail = gmail
    this.intervalSeconds = intervalSeconds

    this.auth.on('state-change', () => {
      this.resetSyncState()
      if (this.started) void this.refresh('auth')
    })
  }

  /* ------------------------------ Lifecycle ------------------------------ */

  start(): void {
    if (this.started) return
    this.started = true
    log.info(`Watching Gmail every ${this.intervalSeconds}s`)
    void this.refresh('startup')
    this.scheduleNext()
  }

  stop(): void {
    this.started = false
    this.clearTimer()
  }

  setIntervalSeconds(seconds: number): void {
    if (seconds === this.intervalSeconds) return
    this.intervalSeconds = seconds
    log.info(`Poll interval changed to ${seconds}s`)
    if (this.started) this.scheduleNext()
  }

  /** Pauses polling while the machine sleeps or the session is locked. */
  setSuspended(suspended: boolean): void {
    if (this.suspended === suspended) return
    this.suspended = suspended
    log.debug(suspended ? 'Polling suspended' : 'Polling resumed')
    if (suspended) {
      this.clearTimer()
      return
    }
    if (this.started) {
      void this.refresh('resume')
      this.scheduleNext()
    }
  }

  getSnapshot(): MailSnapshot {
    return this.snapshot
  }

  /* -------------------------------- Polling ------------------------------- */

  async refresh(reason: RefreshReason = 'manual'): Promise<MailSnapshot> {
    if (this.inFlight) return this.inFlight

    const showSpinner = reason === 'manual' || reason === 'auth' || reason === 'startup'
    this.inFlight = this.runRefresh(reason, showSpinner).finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async runRefresh(reason: RefreshReason, showSpinner: boolean): Promise<MailSnapshot> {
    try {
      return await this.fetchOnce(reason, showSpinner)
    } finally {
      // One place decides when the next poll happens — including after an
      // early return or a failure, where `nextDelayMs()` applies backoff.
      this.scheduleNext()
    }
  }

  private async fetchOnce(reason: RefreshReason, showSpinner: boolean): Promise<MailSnapshot> {
    const authState = this.auth.getState()

    if (authState.status !== 'signed-in') {
      return this.publish({
        ...EMPTY_SNAPSHOT,
        status: authState.status === 'unconfigured' ? 'unconfigured' : 'signed-out',
        error: authState.error
          ? { code: ERROR_CODES.NotSignedIn, message: authState.error, retryable: false }
          : null,
        lastUpdatedAt: this.snapshot.lastUpdatedAt
      })
    }

    if (showSpinner) this.publish({ ...this.snapshot, isFetching: true })

    try {
      const inbox = await this.gmail.getInboxState()
      const unchanged =
        inbox.historyId !== '' &&
        inbox.historyId === this.lastRevision &&
        this.snapshot.status === 'ready' &&
        (this.snapshot.email?.id ?? null) === inbox.newestUnreadId

      this.lastRevision = inbox.historyId || this.lastRevision
      this.failureCount = 0

      if (unchanged) {
        log.debug(`No mailbox changes (${reason})`)
        return this.publish({
          ...this.snapshot,
          isFetching: false,
          unreadCount: inbox.unreadCount,
          lastUpdatedAt: Date.now(),
          error: null
        })
      }

      let email: EmailPreview | null = null
      if (inbox.newestUnreadId) {
        email =
          this.snapshot.email?.id === inbox.newestUnreadId
            ? this.snapshot.email
            : await this.gmail.getMessage(inbox.newestUnreadId)
      }

      const isNewArrival = email !== null && !this.seenIds.includes(email.id)
      if (email) this.remember(email.id)

      const next = this.publish({
        status: 'ready',
        email,
        unreadCount: inbox.unreadCount,
        lastUpdatedAt: Date.now(),
        error: null,
        isFetching: false,
        account: authState.account?.email ?? null
      })

      if (email && isNewArrival) {
        if (this.primed) {
          log.info(`New mail from ${email.sender.email || email.sender.name}`)
          this.emit('new-mail', email)
        } else {
          log.debug('Seeding known message ids on first sync')
        }
      }
      this.primed = true

      return next
    } catch (error) {
      const appError = toAppError(error)
      this.failureCount += 1
      log.warn(`Refresh failed (attempt ${this.failureCount}): ${appError.message}`)

      return this.publish({
        ...this.snapshot,
        status: this.auth.isSignedIn() ? 'error' : 'signed-out',
        error: appError,
        isFetching: false
      })
    }
  }

  /* ------------------------------ Mark as read ---------------------------- */

  async markRead(messageId: string): Promise<MailSnapshot> {
    if (!messageId) return this.snapshot

    // Optimistic: drop it locally so the widget reacts instantly.
    if (this.snapshot.email?.id === messageId) {
      this.publish({
        ...this.snapshot,
        email: null,
        unreadCount: Math.max(0, this.snapshot.unreadCount - 1),
        isFetching: true
      })
    }

    try {
      await this.gmail.markAsRead(messageId)
    } catch (error) {
      log.error(`Could not mark ${messageId} as read: ${toAppError(error).message}`)
    }

    this.lastRevision = null
    return this.refresh('mark-read')
  }

  /* -------------------------------- Helpers ------------------------------- */

  private publish(snapshot: MailSnapshot): MailSnapshot {
    this.snapshot = snapshot
    this.emit('update', snapshot)
    return snapshot
  }

  private remember(id: string): void {
    if (this.seenIds.includes(id)) return
    this.seenIds.push(id)
    if (this.seenIds.length > SEEN_IDS_LIMIT) {
      this.seenIds = this.seenIds.slice(-SEEN_IDS_LIMIT)
    }
  }

  private resetSyncState(): void {
    this.lastRevision = null
    this.seenIds = []
    this.primed = false
    this.failureCount = 0
  }

  private nextDelayMs(): number {
    const base = this.intervalSeconds * 1000
    if (this.failureCount === 0) return base
    return Math.min(base * 2 ** this.failureCount, MAX_BACKOFF_MS)
  }

  private scheduleNext(): void {
    this.clearTimer()
    if (!this.started || this.suspended) return

    const delay = this.nextDelayMs()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.refresh('interval')
    }, delay)
    this.timer.unref?.()
  }

  private clearTimer(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
  }
}
