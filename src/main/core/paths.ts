import { join } from 'node:path'
import { app } from 'electron'

/**
 * Root of the bundled `resources/` folder (tray icons, app icon).
 * In development that is the repo folder; when packaged, electron-builder
 * copies it next to app.asar (see `extraResources` in electron-builder.yml).
 */
export function resourcesRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
}

export function resourcePath(...segments: string[]): string {
  return join(resourcesRoot(), ...segments)
}

export function userDataPath(...segments: string[]): string {
  return join(app.getPath('userData'), ...segments)
}

export const SETTINGS_FILE = 'settings.json'
export const CREDENTIALS_FILE = 'credentials.json'
