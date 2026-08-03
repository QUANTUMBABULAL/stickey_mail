import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { APP_NAME } from '@shared/constants'
import { IpcChannel } from '@shared/channels'
import type {
  AppInfo,
  AppSettings,
  AuthState,
  CredentialsInput,
  CredentialsState,
  DragPoint,
  MailSnapshot
} from '@shared/types'
import { toAppError } from '../core/errors'
import { createLogger, getLogFilePath } from '../core/logger'
import type { AuthService } from '../services/authService'
import type { MailWatcher } from '../services/mailWatcher'
import type { SettingsStore } from '../store/settingsStore'
import type { SettingsWindow } from '../windows/settingsWindow'
import type { WidgetWindow } from '../windows/widgetWindow'

const log = createLogger('ipc')

export interface IpcContext {
  settings: SettingsStore
  auth: AuthService
  watcher: MailWatcher
  widget: WidgetWindow
  settingsWindow: SettingsWindow
  openMessage: (messageId: string) => Promise<void>
  openInbox: () => Promise<void>
  quit: () => void
  isDev: boolean
}

/** Sends an event to every live renderer. */
export function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue
    window.webContents.send(channel, payload)
  }
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`Expected a non-empty string for "${field}"`)
  }
  return value.trim()
}

function asPoint(value: unknown): DragPoint | null {
  if (!value || typeof value !== 'object') return null
  const point = value as Partial<DragPoint>
  if (typeof point.x !== 'number' || typeof point.y !== 'number') return null
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  return { x: point.x, y: point.y }
}

/**
 * Wraps a handler so unexpected failures reach the renderer as a readable
 * message instead of `Error invoking remote method ...`.
 */
function handle<T>(channel: string, handler: (...args: unknown[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      const appError = toAppError(error)
      log.error(`${channel} failed: ${appError.message}`)
      throw new Error(appError.message)
    }
  })
}

export function registerIpcHandlers(ctx: IpcContext): void {
  /* ------------------------------- Settings ------------------------------- */

  handle<AppSettings>(IpcChannel.SettingsGet, () => ctx.settings.get())

  handle<AppSettings>(IpcChannel.SettingsUpdate, (patch) => {
    if (!patch || typeof patch !== 'object') throw new TypeError('Invalid settings patch')
    return ctx.settings.update(patch as Partial<AppSettings>)
  })

  handle<AppSettings>(IpcChannel.SettingsReset, () => ctx.settings.reset())

  /* --------------------------------- Auth --------------------------------- */

  handle<AuthState>(IpcChannel.AuthGetState, () => ctx.auth.getState())
  handle<AuthState>(IpcChannel.AuthSignIn, () => ctx.auth.signIn())
  handle<AuthState>(IpcChannel.AuthSignOut, () => ctx.auth.signOut())

  handle<CredentialsState>(IpcChannel.AuthGetCredentials, () => ctx.auth.getCredentialsState())

  handle<CredentialsState>(IpcChannel.AuthSaveCredentials, (input) => {
    const value = (input ?? {}) as Partial<CredentialsInput>
    return ctx.auth.saveCredentials({
      clientId: asString(value.clientId, 'clientId'),
      clientSecret: typeof value.clientSecret === 'string' ? value.clientSecret.trim() : ''
    })
  })

  handle<CredentialsState>(IpcChannel.AuthClearCredentials, () => ctx.auth.clearCredentials())

  /* --------------------------------- Mail --------------------------------- */

  handle<MailSnapshot>(IpcChannel.MailGetSnapshot, () => ctx.watcher.getSnapshot())
  handle<MailSnapshot>(IpcChannel.MailRefresh, () => ctx.watcher.refresh('manual'))

  handle<MailSnapshot>(IpcChannel.MailMarkRead, (messageId) =>
    ctx.watcher.markRead(asString(messageId, 'messageId'))
  )

  handle<void>(IpcChannel.MailOpenMessage, (messageId) =>
    ctx.openMessage(asString(messageId, 'messageId'))
  )

  handle<void>(IpcChannel.MailOpenInbox, () => ctx.openInbox())

  /* ---------------------------------- App --------------------------------- */

  handle<AppInfo>(IpcChannel.AppGetInfo, () => ({
    name: APP_NAME,
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: `${process.platform} ${process.arch}`,
    isDev: ctx.isDev,
    logFile: getLogFilePath(),
    userDataPath: app.getPath('userData')
  }))

  handle<void>(IpcChannel.AppOpenLogFolder, () => {
    const logFile = getLogFilePath()
    if (logFile) shell.showItemInFolder(logFile)
  })

  handle<void>(IpcChannel.AppOpenExternal, async (url) => {
    const target = asString(url, 'url')
    // Only ever hand https links to the OS.
    if (!/^https:\/\//i.test(target)) {
      throw new TypeError('Refusing to open a non-https URL')
    }
    await shell.openExternal(target)
  })

  /* ------------------------- Fire-and-forget events ------------------------ */

  ipcMain.on(IpcChannel.WidgetDragStart, (_event, point: unknown) => {
    const parsed = asPoint(point)
    if (parsed) ctx.widget.beginDrag(parsed)
  })

  ipcMain.on(IpcChannel.WidgetDragMove, (_event, point: unknown) => {
    const parsed = asPoint(point)
    if (parsed) ctx.widget.updateDrag(parsed)
  })

  ipcMain.on(IpcChannel.WidgetDragEnd, () => ctx.widget.endDrag())
  ipcMain.on(IpcChannel.WidgetHide, () => ctx.widget.hide())
  ipcMain.on(IpcChannel.WidgetContextMenu, () => ctx.widget.showContextMenu())
  ipcMain.on(IpcChannel.WidgetOpenSettings, () => ctx.settingsWindow.open())
  ipcMain.on(IpcChannel.WindowMinimizeSettings, () => ctx.settingsWindow.minimize())
  ipcMain.on(IpcChannel.WindowCloseSettings, () => ctx.settingsWindow.close())
  ipcMain.on(IpcChannel.AppQuit, () => ctx.quit())

  log.info('IPC handlers registered')
}
