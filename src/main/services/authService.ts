import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http'
import type { AddressInfo } from 'node:net'
import { shell } from 'electron'
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library'
import { ERROR_CODES, GMAIL_SCOPES, OAUTH_TIMEOUT_MS } from '@shared/constants'
import type { AuthState, CredentialsInput, CredentialsState } from '@shared/types'
import { MailStickerError, toAppError } from '../core/errors'
import { createLogger } from '../core/logger'
import type { CredentialStore } from '../store/credentialStore'
import { renderCallbackPage } from './oauthCallbackPage'

const log = createLogger('auth')

const PROFILE_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/profile'
const CALLBACK_PATH = '/oauth2callback'

type Events = {
  'state-change': [AuthState]
  'credentials-change': [CredentialsState]
}

interface CallbackResult {
  code: string
}

/**
 * Google sign-in for an installed application.
 *
 * Uses the loopback redirect flow with PKCE (RFC 8252): the system browser
 * handles the consent screen — Google blocks embedded webviews — and hands the
 * authorization code back to a short-lived HTTP server bound to 127.0.0.1.
 */
export class AuthService extends EventEmitter<Events> {
  private readonly credentials: CredentialStore
  private state: AuthState
  private client: OAuth2Client | null = null
  private signInFlight: Promise<AuthState> | null = null

  constructor(credentials: CredentialStore) {
    super()
    this.credentials = credentials
    this.state = this.deriveState()
  }

  /* -------------------------------- State -------------------------------- */

  getState(): AuthState {
    return this.state
  }

  isSignedIn(): boolean {
    return this.state.status === 'signed-in'
  }

  private deriveState(error: string | null = null): AuthState {
    if (!this.credentials.getClientCredentials()) {
      return { status: 'unconfigured', account: null, error }
    }
    const account = this.credentials.getAccount()
    if (!account) return { status: 'signed-out', account: null, error }
    return { status: 'signed-in', account, error }
  }

  private setState(next: AuthState): AuthState {
    this.state = next
    this.emit('state-change', next)
    return next
  }

  private refreshState(error: string | null = null): AuthState {
    return this.setState(this.deriveState(error))
  }

  /* ----------------------------- Credentials ----------------------------- */

  getCredentialsState(): CredentialsState {
    return this.credentials.getCredentialsState()
  }

  saveCredentials(input: CredentialsInput): CredentialsState {
    const clientId = input.clientId.trim()
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
      throw new MailStickerError(
        ERROR_CODES.NoCredentials,
        'That does not look like a Google OAuth client id (it should end with .apps.googleusercontent.com).'
      )
    }
    const state = this.credentials.saveClientCredentials(clientId, input.clientSecret)
    this.invalidateClient()
    this.emit('credentials-change', state)
    this.refreshState()
    return state
  }

  clearCredentials(): CredentialsState {
    this.credentials.clearSession()
    const state = this.credentials.clearClientCredentials()
    this.invalidateClient()
    this.emit('credentials-change', state)
    this.refreshState()
    return state
  }

  /* ------------------------------- Sign in ------------------------------- */

  async signIn(): Promise<AuthState> {
    if (this.signInFlight) return this.signInFlight

    this.signInFlight = this.runSignIn().finally(() => {
      this.signInFlight = null
    })
    return this.signInFlight
  }

  private async runSignIn(): Promise<AuthState> {
    const pair = this.credentials.getClientCredentials()
    if (!pair) {
      const error = new MailStickerError(
        ERROR_CODES.NoCredentials,
        'Add a Google OAuth client id in Settings before signing in.'
      )
      this.refreshState(error.message)
      throw error
    }

    this.setState({ status: 'signing-in', account: this.state.account, error: null })

    let server: Server | null = null
    try {
      const { server: httpServer, port } = await startLoopbackServer()
      server = httpServer

      const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`
      const client = new OAuth2Client({
        clientId: pair.clientId,
        clientSecret: pair.clientSecret || undefined,
        redirectUri
      })

      const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()
      const stateToken = randomBytes(24).toString('base64url')

      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: true,
        scope: [...GMAIL_SCOPES],
        code_challenge_method: CodeChallengeMethod.S256,
        code_challenge: codeChallenge,
        state: stateToken
      })

      log.info(`Opening consent screen on loopback port ${port}`)
      const waitForCode = awaitCallback(server, stateToken)
      await shell.openExternal(authUrl)

      const { code } = await waitForCode
      const { tokens } = await client.getToken({ code, codeVerifier })

      if (!tokens.refresh_token) {
        throw new MailStickerError(
          ERROR_CODES.AuthExpired,
          'Google did not return a refresh token. Remove Mail Sticker from your Google account permissions and try again.'
        )
      }

      client.setCredentials(tokens)
      const email = await fetchAccountEmail(client)

      this.credentials.saveSession(tokens.refresh_token, email)
      this.invalidateClient()
      log.info('Sign-in complete')
      return this.refreshState()
    } catch (error) {
      const appError = toAppError(error)
      log.error(`Sign-in failed: ${appError.message}`)
      this.refreshState(appError.message)
      throw error
    } finally {
      // Browsers fire a follow-up /favicon.ico request that nothing answers
      // once the handler is detached; drop those sockets rather than leak them.
      server?.close()
      server?.closeAllConnections()
    }
  }

  /* ------------------------------ Sign out ------------------------------- */

  async signOut(): Promise<AuthState> {
    const refreshToken = this.credentials.getRefreshToken()
    if (refreshToken) {
      const pair = this.credentials.getClientCredentials()
      if (pair) {
        try {
          const client = new OAuth2Client({
            clientId: pair.clientId,
            clientSecret: pair.clientSecret || undefined
          })
          await client.revokeToken(refreshToken)
          log.info('Revoked refresh token with Google')
        } catch (error) {
          // A token that is already invalid revokes with an error; not fatal.
          log.warn(`Token revocation failed: ${(error as Error).message}`)
        }
      }
    }

    this.credentials.clearSession()
    this.invalidateClient()
    return this.refreshState()
  }

  /* ---------------------------- Authed client ---------------------------- */

  /**
   * An OAuth2 client primed with the stored refresh token. google-auth-library
   * exchanges it for an access token on demand and refreshes it transparently.
   */
  getAuthenticatedClient(): OAuth2Client {
    if (this.client) return this.client

    const pair = this.credentials.getClientCredentials()
    if (!pair) {
      throw new MailStickerError(
        ERROR_CODES.NoCredentials,
        'No Google OAuth client configured.'
      )
    }

    const refreshToken = this.credentials.getRefreshToken()
    if (!refreshToken) {
      throw new MailStickerError(ERROR_CODES.NotSignedIn, 'Sign in with Google to see your mail.')
    }

    const client = new OAuth2Client({
      clientId: pair.clientId,
      clientSecret: pair.clientSecret || undefined
    })
    client.setCredentials({ refresh_token: refreshToken })
    client.on('tokens', (tokens) => {
      if (tokens.refresh_token) this.credentials.updateRefreshToken(tokens.refresh_token)
    })

    this.client = client
    return client
  }

  /**
   * Called by consumers when Gmail rejects our credentials. Drops the session
   * so the widget can prompt for a fresh sign-in.
   */
  handleInvalidGrant(message: string): void {
    log.warn(`Session invalidated: ${message}`)
    this.credentials.clearSession()
    this.invalidateClient()
    this.refreshState(message)
  }

  private invalidateClient(): void {
    this.client = null
  }
}

/* -------------------------------------------------------------------------- */
/*                             Loopback callback                              */
/* -------------------------------------------------------------------------- */

function startLoopbackServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo | null
      if (!address) {
        server.close()
        reject(new MailStickerError(ERROR_CODES.Unknown, 'Could not open a local callback port.'))
        return
      }
      server.removeListener('error', reject)
      resolve({ server, port: address.port })
    })
  })
}

function awaitCallback(server: Server, expectedState: string): Promise<CallbackResult> {
  return new Promise<CallbackResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new MailStickerError(ERROR_CODES.Unknown, 'Sign-in timed out. Please try again.'))
    }, OAUTH_TIMEOUT_MS)

    const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Not found')
        return
      }

      const error = url.searchParams.get('error')
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      if (error) {
        respond(res, renderCallbackPage('error', describeOAuthError(error)))
        cleanup()
        reject(new MailStickerError(ERROR_CODES.AuthExpired, describeOAuthError(error)))
        return
      }

      if (!state || state !== expectedState) {
        respond(res, renderCallbackPage('error', 'The sign-in response could not be verified.'))
        cleanup()
        reject(
          new MailStickerError(ERROR_CODES.Unknown, 'OAuth state mismatch — sign-in was rejected.')
        )
        return
      }

      if (!code) {
        respond(res, renderCallbackPage('error', 'Google did not return an authorization code.'))
        cleanup()
        reject(new MailStickerError(ERROR_CODES.Unknown, 'Missing authorization code.'))
        return
      }

      respond(res, renderCallbackPage('success', 'You can close this tab and go back to the widget.'))
      cleanup()
      resolve({ code })
    }

    function respond(res: ServerResponse, html: string): void {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      })
      res.end(html)
    }

    function cleanup(): void {
      clearTimeout(timer)
      server.off('request', onRequest)
    }

    server.on('request', onRequest)
  })
}

function describeOAuthError(error: string): string {
  switch (error) {
    case 'access_denied':
      return 'Access was denied. Mail Sticker needs permission to read your Gmail.'
    case 'admin_policy_enforced':
      return 'Your Google Workspace administrator blocked this app.'
    default:
      return `Google returned an error: ${error}`
  }
}

async function fetchAccountEmail(client: OAuth2Client): Promise<string> {
  const response = await client.request<{ emailAddress?: string }>({ url: PROFILE_ENDPOINT })
  const email = response.data?.emailAddress
  if (!email) {
    throw new MailStickerError(ERROR_CODES.Gmail, 'Could not read the Gmail account address.')
  }
  return email
}
