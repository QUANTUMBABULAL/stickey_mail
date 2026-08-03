import { gmail, type gmail_v1 } from '@googleapis/gmail'
import type { OAuth2Client } from 'google-auth-library'
import { ERROR_CODES } from '@shared/constants'
import type { EmailPreview } from '@shared/types'
import { MailStickerError, toAppError } from '../core/errors'
import { createLogger } from '../core/logger'
import {
  extractPreview,
  getHeader,
  hasAttachments,
  parseSender,
  resolveReceivedAt
} from '../utils/mime'
import type { AuthService } from './authService'

const log = createLogger('gmail')

export interface InboxState {
  /** Mailbox revision id — cheap way to tell whether anything changed. */
  historyId: string
  unreadCount: number
  newestUnreadId: string | null
}

/**
 * Thin, typed wrapper over the Gmail REST API.
 *
 * The poll loop is deliberately frugal: `users.getProfile` costs a single quota
 * unit and reveals whether the mailbox changed at all, so a quiet inbox never
 * triggers a message fetch.
 */
export class GmailService {
  private readonly auth: AuthService
  private cachedClient: { key: OAuth2Client; api: gmail_v1.Gmail } | null = null

  constructor(auth: AuthService) {
    this.auth = auth
  }

  private api(): gmail_v1.Gmail {
    const client = this.auth.getAuthenticatedClient()
    if (this.cachedClient?.key === client) return this.cachedClient.api

    const api = gmail({ version: 'v1', auth: client })
    this.cachedClient = { key: client, api }
    return api
  }

  /** Runs a Gmail call, converting auth failures into a signed-out state. */
  private async call<T>(operation: string, run: (api: gmail_v1.Gmail) => Promise<T>): Promise<T> {
    try {
      return await run(this.api())
    } catch (error) {
      const appError = toAppError(error)
      if (appError.code === ERROR_CODES.AuthExpired) {
        this.auth.handleInvalidGrant(appError.message)
      }
      log.debug(`${operation} failed: ${appError.code} — ${appError.message}`)
      throw error
    }
  }

  async getMailboxRevision(): Promise<string> {
    return this.call('getProfile', async (api) => {
      const { data } = await api.users.getProfile({ userId: 'me' })
      return data.historyId ?? ''
    })
  }

  /** Exact unread count for the inbox label. */
  async getUnreadCount(): Promise<number> {
    return this.call('labels.get', async (api) => {
      const { data } = await api.users.labels.get({ userId: 'me', id: 'INBOX' })
      return data.messagesUnread ?? 0
    })
  }

  async listUnreadIds(maxResults = 5): Promise<string[]> {
    return this.call('messages.list', async (api) => {
      const { data } = await api.users.messages.list({
        userId: 'me',
        labelIds: ['INBOX', 'UNREAD'],
        maxResults,
        includeSpamTrash: false
      })
      return (data.messages ?? [])
        .map((message) => message.id)
        .filter((id): id is string => Boolean(id))
    })
  }

  async getMessage(messageId: string): Promise<EmailPreview> {
    return this.call('messages.get', async (api) => {
      const { data } = await api.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      })
      return toEmailPreview(data)
    })
  }

  /** One round trip that answers "did anything change, and what is newest?". */
  async getInboxState(): Promise<InboxState> {
    const [historyId, unreadCount, ids] = await Promise.all([
      this.getMailboxRevision(),
      this.getUnreadCount(),
      this.listUnreadIds(1)
    ])
    return { historyId, unreadCount, newestUnreadId: ids[0] ?? null }
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.call('messages.modify', async (api) => {
      await api.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { removeLabelIds: ['UNREAD'] }
      })
    })
    log.info(`Marked ${messageId} as read`)
  }
}

function toEmailPreview(message: gmail_v1.Schema$Message): EmailPreview {
  if (!message.id) {
    throw new MailStickerError(ERROR_CODES.Gmail, 'Gmail returned a message without an id.')
  }

  const labelIds = message.labelIds ?? []
  return {
    id: message.id,
    threadId: message.threadId ?? message.id,
    sender: parseSender(getHeader(message, 'From')),
    subject: getHeader(message, 'Subject').trim() || '(no subject)',
    preview: extractPreview(message),
    receivedAt: resolveReceivedAt(message),
    unread: labelIds.includes('UNREAD'),
    hasAttachments: hasAttachments(message.payload ?? undefined),
    isImportant: labelIds.includes('IMPORTANT')
  }
}
