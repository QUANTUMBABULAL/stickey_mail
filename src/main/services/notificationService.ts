import { existsSync } from 'node:fs'
import { Notification } from 'electron'
import type { EmailPreview } from '@shared/types'
import { createLogger } from '../core/logger'
import { resourcePath } from '../core/paths'

const log = createLogger('notifications')

export interface NotificationHandlers {
  onOpenMessage: (messageId: string) => void
}

/**
 * Windows toast notifications for newly arrived mail.
 *
 * Requires `app.setAppUserModelId` to have been called, otherwise Windows
 * silently drops the toast for unpackaged builds.
 */
export class NotificationService {
  private enabled: boolean
  private readonly handlers: NotificationHandlers
  private readonly iconPath: string | undefined

  constructor(enabled: boolean, handlers: NotificationHandlers) {
    this.enabled = enabled
    this.handlers = handlers

    const icon = resourcePath('icon.png')
    this.iconPath = existsSync(icon) ? icon : undefined
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  notifyNewMail(email: EmailPreview): void {
    if (!this.enabled) return

    if (!Notification.isSupported()) {
      log.warn('Native notifications are not supported on this system')
      return
    }

    try {
      const notification = new Notification({
        title: email.sender.name || email.sender.email || 'New email',
        subtitle: email.subject,
        body: `${email.subject}\n${email.preview.split('\n').slice(0, 2).join(' ')}`.trim(),
        icon: this.iconPath,
        silent: false,
        timeoutType: 'default'
      })

      notification.on('click', () => this.handlers.onOpenMessage(email.id))
      notification.show()
    } catch (error) {
      log.error(`Failed to show notification: ${(error as Error).message}`)
    }
  }
}
