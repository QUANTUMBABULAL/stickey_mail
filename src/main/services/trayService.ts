import { Menu, Tray, nativeImage } from 'electron'
import { APP_NAME } from '@shared/constants'
import type { AuthState, MailSnapshot } from '@shared/types'
import { createLogger } from '../core/logger'
import { resourcePath } from '../core/paths'

const log = createLogger('tray')

export interface TrayActions {
  toggleWidget: () => void
  refresh: () => void
  openInbox: () => void
  openSettings: () => void
  signIn: () => void
  signOut: () => void
  quit: () => void
}

/**
 * System-tray presence. The sticker has no taskbar button, so the tray is the
 * way back to a hidden widget.
 */
export class TrayService {
  private tray: Tray | null = null
  private readonly actions: TrayActions
  private snapshot: MailSnapshot | null = null
  private auth: AuthState | null = null
  private widgetVisible = true
  private currentIcon: 'idle' | 'unread' | null = null

  constructor(actions: TrayActions) {
    this.actions = actions
  }

  init(): void {
    if (this.tray) return

    const image = loadIcon('tray.png')
    this.tray = new Tray(image)
    this.currentIcon = 'idle'
    this.tray.setToolTip(APP_NAME)
    this.tray.on('click', () => this.actions.toggleWidget())
    this.tray.on('double-click', () => this.actions.openInbox())
    this.render()
    log.info('Tray icon created')
  }

  update(options: {
    snapshot?: MailSnapshot
    auth?: AuthState
    widgetVisible?: boolean
  }): void {
    if (options.snapshot) this.snapshot = options.snapshot
    if (options.auth) this.auth = options.auth
    if (typeof options.widgetVisible === 'boolean') this.widgetVisible = options.widgetVisible
    this.render()
  }

  private render(): void {
    if (!this.tray || this.tray.isDestroyed()) return

    const unread = this.snapshot?.unreadCount ?? 0
    const signedIn = this.auth?.status === 'signed-in'
    const desiredIcon = unread > 0 ? 'unread' : 'idle'

    if (desiredIcon !== this.currentIcon) {
      this.tray.setImage(loadIcon(desiredIcon === 'unread' ? 'tray-unread.png' : 'tray.png'))
      this.currentIcon = desiredIcon
    }

    this.tray.setToolTip(buildTooltip(this.auth, this.snapshot))

    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: this.widgetVisible ? 'Hide widget' : 'Show widget',
          click: () => this.actions.toggleWidget()
        },
        { type: 'separator' },
        {
          label: unread > 0 ? `${unread} unread email${unread === 1 ? '' : 's'}` : 'No unread email',
          enabled: false
        },
        { label: 'Refresh now', enabled: signedIn, click: () => this.actions.refresh() },
        { label: 'Open Gmail inbox', enabled: signedIn, click: () => this.actions.openInbox() },
        { type: 'separator' },
        signedIn
          ? { label: 'Sign out', click: () => this.actions.signOut() }
          : { label: 'Sign in with Google', click: () => this.actions.signIn() },
        { label: 'Settings…', click: () => this.actions.openSettings() },
        { type: 'separator' },
        { label: `Exit ${APP_NAME}`, click: () => this.actions.quit() }
      ])
    )
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}

function buildTooltip(auth: AuthState | null, snapshot: MailSnapshot | null): string {
  if (!auth || auth.status === 'unconfigured') return `${APP_NAME} — needs Google credentials`
  if (auth.status !== 'signed-in') return `${APP_NAME} — not signed in`

  const account = auth.account?.email ?? ''
  const unread = snapshot?.unreadCount ?? 0
  const headline = unread > 0 ? `${unread} unread` : 'All caught up'
  return `${APP_NAME}\n${headline}${account ? `\n${account}` : ''}`
}

function loadIcon(fileName: string): Electron.NativeImage {
  const image = nativeImage.createFromPath(resourcePath(fileName))
  if (image.isEmpty()) {
    log.warn(`Tray icon ${fileName} missing — run "npm run icons"`)
  }
  return image
}
