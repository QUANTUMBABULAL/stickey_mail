import { app, nativeTheme, powerMonitor, screen, shell } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IpcChannel } from '@shared/channels'
import { APP_ID, APP_NAME, gmailInboxUrl, gmailThreadUrl } from '@shared/constants'
import { needsWindowRecreate } from '@shared/settings'
import type { AppSettings, EmailPreview, MailSnapshot } from '@shared/types'
import { createLogger } from './core/logger'
import { broadcast, registerIpcHandlers } from './ipc/registerIpc'
import { AuthService } from './services/authService'
import { GmailService } from './services/gmailService'
import { MailWatcher } from './services/mailWatcher'
import { NotificationService } from './services/notificationService'
import { TrayService } from './services/trayService'
import { CredentialStore } from './store/credentialStore'
import { SettingsStore } from './store/settingsStore'
import { showWidgetContextMenu } from './windows/contextMenu'
import { SettingsWindow } from './windows/settingsWindow'
import { WidgetWindow } from './windows/widgetWindow'

const log = createLogger('main')

/**
 * Owns the object graph and the wiring between services and windows.
 * Everything is constructed once, after `app.whenReady()`.
 */
export class MailStickerApp {
  private readonly settings = new SettingsStore()
  private readonly credentials = new CredentialStore()
  private readonly auth = new AuthService(this.credentials)
  private readonly gmail = new GmailService(this.auth)
  private readonly watcher: MailWatcher
  private readonly notifications: NotificationService
  private readonly widget: WidgetWindow
  private readonly settingsWindow = new SettingsWindow()
  private readonly tray: TrayService
  private quitting = false

  constructor(private readonly isDev: boolean) {
    const settings = this.settings.get()

    this.watcher = new MailWatcher(this.auth, this.gmail, settings.pollIntervalSeconds)

    this.notifications = new NotificationService(settings.showNotifications, {
      onOpenMessage: (messageId) => void this.openMessage(messageId)
    })

    this.widget = new WidgetWindow({
      getSettings: () => this.settings.get(),
      persist: (patch) => this.settings.update(patch),
      onContextMenu: (window) =>
        showWidgetContextMenu(window, this.watcher.getSnapshot(), {
          refresh: () => void this.watcher.refresh('manual'),
          markRead: (id) => void this.watcher.markRead(id),
          openMessage: (id) => void this.openMessage(id),
          openInbox: () => void this.openInbox(),
          openSettings: () => this.settingsWindow.open(),
          signIn: () => void this.signIn(),
          hideWidget: () => this.widget.hide(),
          quit: () => this.quit()
        })
    })

    this.tray = new TrayService({
      toggleWidget: () => this.widget.toggle(),
      refresh: () => void this.watcher.refresh('manual'),
      openInbox: () => void this.openInbox(),
      openSettings: () => this.settingsWindow.open(),
      signIn: () => void this.signIn(),
      signOut: () => void this.auth.signOut(),
      quit: () => this.quit()
    })
  }

  /* ------------------------------- Bootstrap ------------------------------ */

  start(): void {
    // Windows attributes toasts and taskbar identity to this id. The app name
    // itself is deliberately left alone: it decides `userData`, and the stores
    // in this class have already resolved their paths from it.
    electronApp.setAppUserModelId(APP_ID)

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window, { zoom: false, escToCloseWindow: false })
    })

    this.wireServices()
    this.wireSystemEvents()

    registerIpcHandlers({
      settings: this.settings,
      auth: this.auth,
      watcher: this.watcher,
      widget: this.widget,
      settingsWindow: this.settingsWindow,
      openMessage: (id) => this.openMessage(id),
      openInbox: () => this.openInbox(),
      quit: () => this.quit(),
      isDev: this.isDev
    })

    this.widget.create()
    this.tray.init()
    this.tray.update({
      auth: this.auth.getState(),
      snapshot: this.watcher.getSnapshot(),
      widgetVisible: this.settings.get().widgetVisible
    })

    this.applyTheme(this.settings.get())
    this.applyLaunchAtLogin(this.settings.get())
    this.watcher.start()

    log.info(`${APP_NAME} started (dev=${this.isDev})`)
  }

  /* -------------------------------- Wiring -------------------------------- */

  private wireServices(): void {
    this.settings.on('change', ({ settings, previous, changedKeys }) => {
      broadcast(IpcChannel.SettingsChanged, settings)

      if (needsWindowRecreate(previous, settings)) {
        this.widget.recreate()
      } else {
        this.widget.applySettings(settings, changedKeys)
      }

      if (changedKeys.includes('theme')) {
        this.applyTheme(settings)
      }
      if (changedKeys.includes('pollIntervalSeconds')) {
        this.watcher.setIntervalSeconds(settings.pollIntervalSeconds)
      }
      if (changedKeys.includes('showNotifications')) {
        this.notifications.setEnabled(settings.showNotifications)
      }
      if (changedKeys.includes('launchAtLogin')) {
        this.applyLaunchAtLogin(settings)
      }
      if (changedKeys.includes('widgetVisible')) {
        this.tray.update({ widgetVisible: settings.widgetVisible })
      }
    })

    this.auth.on('state-change', (state) => {
      broadcast(IpcChannel.AuthStateChanged, state)
      this.tray.update({ auth: state })
    })

    this.auth.on('credentials-change', (state) => {
      broadcast(IpcChannel.AuthCredentialsChanged, state)
    })

    this.watcher.on('update', (snapshot: MailSnapshot) => {
      broadcast(IpcChannel.MailUpdated, snapshot)
      this.tray.update({ snapshot })
    })

    this.watcher.on('new-mail', (email: EmailPreview) => {
      broadcast(IpcChannel.MailNewMessage, email)
      this.notifications.notifyNewMail(email)
      // A sticker that is hidden stays hidden; a visible one is nudged to the
      // front so the arrival animation is actually seen.
      if (this.widget.isVisible()) this.widget.get()?.moveTop()
    })
  }

  private wireSystemEvents(): void {
    powerMonitor.on('suspend', () => this.watcher.setSuspended(true))
    powerMonitor.on('resume', () => this.watcher.setSuspended(false))
    powerMonitor.on('lock-screen', () => this.watcher.setSuspended(true))
    powerMonitor.on('unlock-screen', () => this.watcher.setSuspended(false))

    const onDisplayChange = (): void => this.widget.handleDisplayChange()
    screen.on('display-added', onDisplayChange)
    screen.on('display-removed', onDisplayChange)
    screen.on('display-metrics-changed', onDisplayChange)

    app.on('before-quit', () => {
      this.quitting = true
      this.widget.markQuitting()
    })

    app.on('will-quit', () => this.dispose())

    // Tray-resident app: closing the settings window must not end the process.
    app.on('window-all-closed', () => {
      if (this.quitting) app.quit()
    })

    app.on('second-instance', () => {
      log.info('Second instance requested — surfacing the widget')
      this.widget.show()
    })

    app.on('activate', () => this.widget.show())
  }

  /* -------------------------------- Actions ------------------------------- */

  private async signIn(): Promise<void> {
    try {
      await this.auth.signIn()
      await this.watcher.refresh('auth')
    } catch (error) {
      log.warn(`Sign-in aborted: ${(error as Error).message}`)
    }
  }

  private async openMessage(messageId: string): Promise<void> {
    const snapshot = this.watcher.getSnapshot()
    const email = snapshot.email?.id === messageId ? snapshot.email : null
    const target = email?.threadId ?? messageId
    await shell.openExternal(gmailThreadUrl(target, snapshot.account))
    log.info('Opened message in Gmail')
  }

  private async openInbox(): Promise<void> {
    await shell.openExternal(gmailInboxUrl(this.watcher.getSnapshot().account))
    log.info('Opened Gmail inbox')
  }

  /**
   * Windows tints the Mica/Acrylic backdrop from the app's native theme, so it
   * has to track the user's choice — otherwise a light widget on a dark system
   * ends up with dark text on a dark backdrop.
   */
  private applyTheme(settings: AppSettings): void {
    nativeTheme.themeSource = settings.theme
  }

  private applyLaunchAtLogin(settings: AppSettings): void {
    if (this.isDev) return
    try {
      app.setLoginItemSettings({
        openAtLogin: settings.launchAtLogin,
        openAsHidden: false,
        name: APP_NAME,
        args: ['--autostart']
      })
    } catch (error) {
      log.error(`Could not update launch-at-login: ${(error as Error).message}`)
    }
  }

  quit(): void {
    this.quitting = true
    this.widget.markQuitting()
    app.quit()
  }

  private dispose(): void {
    log.info('Shutting down')
    this.watcher.stop()
    this.tray.destroy()
    this.widget.destroy()
    this.settingsWindow.destroy()
    this.settings.flush()
    this.credentials.flush()
  }
}
