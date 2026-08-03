import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { app } from 'electron'
import { createLogger } from './logger'

const log = createLogger('config')

export interface EnvCredentials {
  clientId: string
  clientSecret: string
}

let loaded = false

/**
 * Loads `.env` files, most specific first. Values already present in
 * `process.env` always win, so a real environment variable can override a file.
 *
 * Lookup order:
 *   1. repo root            (development)
 *   2. process.cwd()        (however the app was launched)
 *   3. next to the exe      (portable installs)
 *   4. resources/           (shipped alongside a packaged build)
 *   5. %APPDATA%/mail-sticker (per-user override for installed builds)
 */
export function loadEnvironment(): void {
  if (loaded) return
  loaded = true

  const candidates = [
    join(app.getAppPath(), '.env'),
    join(process.cwd(), '.env'),
    join(dirname(app.getPath('exe')), '.env'),
    app.isPackaged ? join(process.resourcesPath, '.env') : null,
    join(app.getPath('userData'), '.env')
  ].filter((value): value is string => Boolean(value))

  const seen = new Set<string>()
  for (const file of candidates) {
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const result = loadDotenv({ path: file, override: false, quiet: true })
    if (result.error) {
      log.warn(`Failed to parse ${file}: ${result.error.message}`)
    } else {
      log.info(`Loaded environment from ${file}`)
    }
  }
}

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return ''
}

/**
 * OAuth credentials supplied through the environment, if any. Returns `null`
 * when no client id is configured — the app then falls back to credentials the
 * user pasted into the settings window.
 */
export function envCredentials(): EnvCredentials | null {
  const clientId = readEnv('GOOGLE_CLIENT_ID', 'MAIL_STICKER_GOOGLE_CLIENT_ID')
  if (!clientId) return null
  return {
    clientId,
    clientSecret: readEnv('GOOGLE_CLIENT_SECRET', 'MAIL_STICKER_GOOGLE_CLIENT_SECRET')
  }
}

export function devToolsRequested(): boolean {
  return readEnv('MAIL_STICKER_DEVTOOLS') === '1'
}
