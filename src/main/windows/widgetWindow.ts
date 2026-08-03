import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { widgetWindowSize } from '@shared/settings'
import type { AppSettings, DragPoint, WidgetPosition } from '@shared/types'
import { devToolsRequested } from '../core/config'
import { createLogger } from '../core/logger'
import { resourcePath } from '../core/paths'
import { clampToWorkArea, computeWidgetPosition, resolveDroppedPosition } from '../utils/geometry'
import { attachRendererLogging } from '../utils/rendererLogging'

const log = createLogger('widget')

interface DragSession {
  pointerOrigin: DragPoint
  windowOrigin: WidgetPosition
}

export interface WidgetWindowDeps {
  getSettings: () => AppSettings
  /** Persists position/corner after a drag. */
  persist: (patch: Partial<AppSettings>) => void
  onContextMenu: (window: BrowserWindow) => void
}

/**
 * The floating sticker itself.
 *
 * Windows notes:
 *  - `transparent: true` gives real per-pixel transparency (rounded corners and
 *    a CSS drop shadow), but it is mutually exclusive with the Mica/Acrylic
 *    backdrop materials, so the window is rebuilt when that setting changes.
 *  - Owning the window with a hidden parent is what actually removes it from
 *    Alt+Tab; `skipTaskbar` alone only hides the taskbar button.
 */
export class WidgetWindow {
  private readonly deps: WidgetWindowDeps
  private window: BrowserWindow | null = null
  private owner: BrowserWindow | null = null
  private drag: DragSession | null = null
  private destroyed = false
  private quitting = false

  constructor(deps: WidgetWindowDeps) {
    this.deps = deps
  }

  /* ------------------------------- Creation ------------------------------- */

  create(): BrowserWindow {
    const settings = this.deps.getSettings()
    const size = widgetWindowSize(settings)
    const position = computeWidgetPosition(settings, size)
    const material = settings.blurEffect === 'none' ? undefined : settings.blurEffect
    const useMaterial = material !== undefined

    const window = new BrowserWindow({
      width: size.width,
      height: size.height,
      x: position.x,
      y: position.y,
      show: false,
      frame: false,
      transparent: !useMaterial,
      backgroundColor: useMaterial ? '#00000000' : undefined,
      backgroundMaterial: material,
      roundedCorners: true,
      hasShadow: useMaterial,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: settings.alwaysOnTop,
      acceptFirstMouse: true,
      focusable: true,
      title: 'Mail Sticker',
      icon: resourcePath('icon.png'),
      parent: settings.hideFromAltTab ? this.ensureOwner() : undefined,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: false,
        devTools: is.dev || devToolsRequested(),
        backgroundThrottling: false
      }
    })

    window.setMenuBarVisibility(false)
    window.setOpacity(settings.opacity)
    this.applyAlwaysOnTop(window, settings.alwaysOnTop)

    window.on('ready-to-show', () => {
      if (this.deps.getSettings().widgetVisible) window.showInactive()
      if (devToolsRequested()) window.webContents.openDevTools({ mode: 'detach' })
      log.debug(`ready-to-show → visible=${window.isVisible()}`)
    })

    attachRendererLogging(window.webContents, log, 'widget')

    // A borderless sticker has no chrome to close; hide instead of destroy —
    // unless the app is actually quitting, which must not be blocked.
    window.on('close', (event) => {
      if (this.destroyed || this.quitting) return
      event.preventDefault()
      this.hide()
    })

    window.on('closed', () => {
      if (this.window === window) this.window = null
    })

    window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    void this.load(window)
    this.window = window
    log.info(
      `Widget created (${size.width}x${size.height} at ${position.x},${position.y}, blur=${settings.blurEffect})`
    )
    return window
  }

  private async load(window: BrowserWindow): Promise<void> {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    try {
      if (is.dev && devUrl) {
        await window.loadURL(`${devUrl}/widget.html`)
      } else {
        await window.loadFile(join(__dirname, '../renderer/widget.html'))
      }
    } catch (error) {
      log.error(`Failed to load widget renderer: ${(error as Error).message}`)
    }
  }

  private ensureOwner(): BrowserWindow {
    if (this.owner && !this.owner.isDestroyed()) return this.owner

    // Never shown. Owning the sticker with it is what keeps the sticker out of
    // the Alt+Tab list on Windows.
    this.owner = new BrowserWindow({
      width: 1,
      height: 1,
      x: -32000,
      y: -32000,
      show: false,
      frame: false,
      transparent: true,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    })
    return this.owner
  }

  /* ----------------------------- Window access ---------------------------- */

  get(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null
  }

  private require(): BrowserWindow {
    const window = this.get()
    if (window) return window
    return this.create()
  }

  isVisible(): boolean {
    return this.get()?.isVisible() ?? false
  }

  show(): void {
    const window = this.require()
    if (!window.isVisible()) window.showInactive()
    window.moveTop()
    this.deps.persist({ widgetVisible: true })
  }

  hide(): void {
    this.get()?.hide()
    this.deps.persist({ widgetVisible: false })
  }

  toggle(): void {
    if (this.isVisible()) this.hide()
    else this.show()
  }

  send(channel: string, payload?: unknown): void {
    const window = this.get()
    if (!window || window.webContents.isDestroyed()) return
    window.webContents.send(channel, payload)
  }

  /* ------------------------------- Settings ------------------------------- */

  /** Applies live-updatable settings; the caller handles structural changes. */
  applySettings(settings: AppSettings, changedKeys: (keyof AppSettings)[]): void {
    const window = this.get()
    if (!window) return

    if (changedKeys.includes('opacity')) {
      window.setOpacity(settings.opacity)
    }

    if (changedKeys.includes('alwaysOnTop')) {
      this.applyAlwaysOnTop(window, settings.alwaysOnTop)
    }

    if (changedKeys.includes('widgetSize') || changedKeys.includes('corner')) {
      this.applyBounds(window, settings)
    } else if (changedKeys.includes('position') && settings.corner === 'custom') {
      this.applyBounds(window, settings)
    }

    if (changedKeys.includes('widgetVisible')) {
      if (settings.widgetVisible && !window.isVisible()) window.showInactive()
      if (!settings.widgetVisible && window.isVisible()) window.hide()
    }
  }

  private applyBounds(window: BrowserWindow, settings: AppSettings): void {
    const size = widgetWindowSize(settings)
    const position = computeWidgetPosition(settings, size)
    window.setBounds({ ...position, ...size }, false)
  }

  private applyAlwaysOnTop(window: BrowserWindow, enabled: boolean): void {
    // `screen-saver` keeps the sticker above full-screen apps and other
    // "always on top" windows such as Task Manager.
    window.setAlwaysOnTop(enabled, enabled ? 'screen-saver' : 'normal')
    window.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: enabled })
  }

  /** Rebuilds the window for settings only honoured at construction time. */
  recreate(): void {
    const previous = this.window
    this.window = null

    if (previous && !previous.isDestroyed()) {
      previous.removeAllListeners('close')
      previous.destroy()
    }

    if (this.owner && !this.owner.isDestroyed() && !this.deps.getSettings().hideFromAltTab) {
      this.owner.destroy()
      this.owner = null
    }

    this.create()
    log.info('Widget window recreated')
  }

  /* --------------------------------- Drag --------------------------------- */

  beginDrag(point: DragPoint): void {
    const window = this.get()
    if (!window) return
    const [x, y] = window.getPosition()
    this.drag = { pointerOrigin: point, windowOrigin: { x, y } }
  }

  updateDrag(point: DragPoint): void {
    const window = this.get()
    if (!window || !this.drag) return

    const next = {
      x: Math.round(this.drag.windowOrigin.x + (point.x - this.drag.pointerOrigin.x)),
      y: Math.round(this.drag.windowOrigin.y + (point.y - this.drag.pointerOrigin.y))
    }
    window.setPosition(next.x, next.y, false)
  }

  endDrag(): void {
    const window = this.get()
    if (!window || !this.drag) {
      this.drag = null
      return
    }
    this.drag = null

    const settings = this.deps.getSettings()
    const bounds = window.getBounds()
    const size = { width: bounds.width, height: bounds.height }
    const clamped = clampToWorkArea({ x: bounds.x, y: bounds.y }, size)
    if (clamped.x !== bounds.x || clamped.y !== bounds.y) {
      window.setPosition(clamped.x, clamped.y, false)
    }

    const resolved = resolveDroppedPosition(clamped, settings, size)
    if (resolved.position && (resolved.position.x !== clamped.x || resolved.position.y !== clamped.y)) {
      window.setPosition(resolved.position.x, resolved.position.y, true)
    }
    this.deps.persist(resolved)
  }

  /* ------------------------------- Displays ------------------------------- */

  /** Re-anchors the sticker when monitors are added, removed or rescaled. */
  handleDisplayChange(): void {
    const window = this.get()
    if (!window) return
    const settings = this.deps.getSettings()
    const size = widgetWindowSize(settings)
    const position = computeWidgetPosition(settings, size)
    window.setBounds({ ...position, ...size }, false)
    log.debug(`Re-anchored widget after display change (${screen.getAllDisplays().length} displays)`)
  }

  showContextMenu(): void {
    const window = this.get()
    if (window) this.deps.onContextMenu(window)
  }

  /** Lets `close` events through once the app has committed to quitting. */
  markQuitting(): void {
    this.quitting = true
  }

  destroy(): void {
    this.destroyed = true
    this.window?.destroy()
    this.window = null
    this.owner?.destroy()
    this.owner = null
  }
}
