import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { createLogger } from '../core/logger'
import { devToolsRequested } from '../core/config'
import { resourcePath } from '../core/paths'
import { attachRendererLogging } from '../utils/rendererLogging'

const log = createLogger('settings-window')

const WIDTH = 520
const HEIGHT = 700

/** Frameless preferences window with a custom title bar. Single instance. */
export class SettingsWindow {
  private window: BrowserWindow | null = null

  open(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore()
      this.window.show()
      this.window.focus()
      return this.window
    }

    const { workArea } = screen.getPrimaryDisplay()
    const window = new BrowserWindow({
      width: WIDTH,
      height: Math.min(HEIGHT, workArea.height - 60),
      minWidth: 460,
      minHeight: 520,
      x: Math.round(workArea.x + (workArea.width - WIDTH) / 2),
      y: Math.round(workArea.y + Math.max(24, (workArea.height - HEIGHT) / 2)),
      show: false,
      frame: false,
      resizable: true,
      maximizable: false,
      fullscreenable: false,
      backgroundColor: '#0b0f1a',
      title: 'Mail Sticker Settings',
      icon: resourcePath('icon.png'),
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true,
        devTools: is.dev || devToolsRequested()
      }
    })

    attachRendererLogging(window.webContents, log, 'settings')

    window.on('ready-to-show', () => window.show())
    window.on('closed', () => {
      this.window = null
    })
    window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    const devUrl = process.env['ELECTRON_RENDERER_URL']
    const load =
      is.dev && devUrl
        ? window.loadURL(`${devUrl}/settings.html`)
        : window.loadFile(join(__dirname, '../renderer/settings.html'))

    load.catch((error: Error) => log.error(`Failed to load settings renderer: ${error.message}`))

    this.window = window
    return window
  }

  get(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null
  }

  minimize(): void {
    this.get()?.minimize()
  }

  close(): void {
    this.get()?.close()
  }

  send(channel: string, payload?: unknown): void {
    const window = this.get()
    if (!window || window.webContents.isDestroyed()) return
    window.webContents.send(channel, payload)
  }

  destroy(): void {
    this.window?.destroy()
    this.window = null
  }
}
