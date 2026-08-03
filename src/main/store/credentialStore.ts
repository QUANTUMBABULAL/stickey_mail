import { EventEmitter } from 'node:events'
import { safeStorage } from 'electron'
import type { AccountInfo, CredentialsState } from '@shared/types'
import { envCredentials } from '../core/config'
import { JsonStore } from '../core/jsonStore'
import { createLogger } from '../core/logger'
import { CREDENTIALS_FILE, userDataPath } from '../core/paths'

const log = createLogger('credentials')

interface CredentialsFile {
  version: number
  /** OAuth client id — not secret, stored in the clear. */
  clientId: string
  /** OAuth client secret, DPAPI-encrypted where available. */
  clientSecret: string
  /** Long-lived Google refresh token, DPAPI-encrypted where available. */
  refreshToken: string
  accountEmail: string
  connectedAt: number
}

const DEFAULTS: CredentialsFile = {
  version: 1,
  clientId: '',
  clientSecret: '',
  refreshToken: '',
  accountEmail: '',
  connectedAt: 0
}

const ENCRYPTED_PREFIX = 'enc.v1:'
const PLAIN_PREFIX = 'raw.v1:'

type Events = {
  change: []
}

/**
 * Owns the OAuth client credentials and the Google refresh token.
 *
 * Secrets are encrypted with Electron's `safeStorage`, which is backed by
 * Windows DPAPI and scoped to the current user account. When the OS refuses to
 * provide encryption we still store the value, but clearly marked as plain so
 * it can be re-encrypted later.
 */
export class CredentialStore extends EventEmitter<Events> {
  private readonly store: JsonStore<CredentialsFile>

  constructor() {
    super()
    this.store = new JsonStore<CredentialsFile>({
      filePath: userDataPath(CREDENTIALS_FILE),
      defaults: DEFAULTS,
      sanitize: (raw, defaults) => {
        const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<CredentialsFile>
        return {
          version: 1,
          clientId: typeof input.clientId === 'string' ? input.clientId : defaults.clientId,
          clientSecret:
            typeof input.clientSecret === 'string' ? input.clientSecret : defaults.clientSecret,
          refreshToken:
            typeof input.refreshToken === 'string' ? input.refreshToken : defaults.refreshToken,
          accountEmail:
            typeof input.accountEmail === 'string' ? input.accountEmail : defaults.accountEmail,
          connectedAt:
            typeof input.connectedAt === 'number' ? input.connectedAt : defaults.connectedAt
        }
      }
    })
  }

  /* --------------------------- OAuth client pair -------------------------- */

  /** Effective credentials: environment first, then what the user saved. */
  getClientCredentials(): { clientId: string; clientSecret: string } | null {
    const fromEnv = envCredentials()
    if (fromEnv) return fromEnv

    const file = this.store.get()
    if (!file.clientId) return null
    return { clientId: file.clientId, clientSecret: this.decrypt(file.clientSecret) }
  }

  getCredentialsState(): CredentialsState {
    const fromEnv = envCredentials()
    if (fromEnv) {
      return {
        configured: true,
        source: 'env',
        clientIdPreview: redactClientId(fromEnv.clientId),
        hasSecret: Boolean(fromEnv.clientSecret),
        readOnly: true
      }
    }

    const file = this.store.get()
    if (file.clientId) {
      return {
        configured: true,
        source: 'stored',
        clientIdPreview: redactClientId(file.clientId),
        hasSecret: Boolean(file.clientSecret),
        readOnly: false
      }
    }

    return {
      configured: false,
      source: 'none',
      clientIdPreview: null,
      hasSecret: false,
      readOnly: false
    }
  }

  saveClientCredentials(clientId: string, clientSecret: string): CredentialsState {
    this.store.set({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim() ? this.encrypt(clientSecret.trim()) : ''
    })
    log.info('Stored OAuth client credentials')
    this.emit('change')
    return this.getCredentialsState()
  }

  clearClientCredentials(): CredentialsState {
    this.store.set({ clientId: '', clientSecret: '' })
    log.info('Cleared OAuth client credentials')
    this.emit('change')
    return this.getCredentialsState()
  }

  /* ----------------------------- Refresh token ---------------------------- */

  getRefreshToken(): string | null {
    const value = this.decrypt(this.store.get().refreshToken)
    return value || null
  }

  getAccount(): AccountInfo | null {
    const { accountEmail, connectedAt } = this.store.get()
    if (!accountEmail || !this.getRefreshToken()) return null
    return { email: accountEmail, connectedAt }
  }

  saveSession(refreshToken: string, accountEmail: string): void {
    this.store.set({
      refreshToken: this.encrypt(refreshToken),
      accountEmail,
      connectedAt: Date.now()
    })
    log.info(`Linked Google account ${redactEmail(accountEmail)}`)
    this.emit('change')
  }

  /** Persists a rotated refresh token without touching the account metadata. */
  updateRefreshToken(refreshToken: string): void {
    if (!refreshToken) return
    this.store.set({ refreshToken: this.encrypt(refreshToken) })
    log.debug('Refresh token rotated')
  }

  clearSession(): void {
    this.store.set({ refreshToken: '', accountEmail: '', connectedAt: 0 })
    log.info('Cleared Google session')
    this.emit('change')
  }

  flush(): void {
    this.store.flush()
  }

  /* ------------------------------ Encryption ------------------------------ */

  private encrypt(value: string): string {
    if (!value) return ''
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return ENCRYPTED_PREFIX + safeStorage.encryptString(value).toString('base64')
      }
    } catch (error) {
      log.warn(`safeStorage encryption failed: ${(error as Error).message}`)
    }
    log.warn('OS encryption unavailable — storing secret without encryption')
    return PLAIN_PREFIX + Buffer.from(value, 'utf8').toString('base64')
  }

  private decrypt(value: string): string {
    if (!value) return ''
    try {
      if (value.startsWith(ENCRYPTED_PREFIX)) {
        const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64')
        return safeStorage.decryptString(payload)
      }
      if (value.startsWith(PLAIN_PREFIX)) {
        return Buffer.from(value.slice(PLAIN_PREFIX.length), 'base64').toString('utf8')
      }
      // Legacy/unprefixed values are treated as plain text.
      return value
    } catch (error) {
      log.error(`Failed to decrypt stored secret: ${(error as Error).message}`)
      return ''
    }
  }
}

function redactClientId(clientId: string): string {
  const [id] = clientId.split('.apps.googleusercontent.com')
  if (!id) return clientId
  const head = id.slice(0, 8)
  const tail = id.slice(-4)
  return `${head}…${tail}.apps.googleusercontent.com`
}

function redactEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!name || !domain) return '***'
  return `${name.slice(0, 2)}***@${domain}`
}
