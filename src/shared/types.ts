/**
 * Types shared by the main process, the preload bridge and the renderer.
 * This file must stay free of any Node/Electron/DOM imports so every process
 * can consume it.
 */

/* -------------------------------------------------------------------------- */
/*                                  Settings                                  */
/* -------------------------------------------------------------------------- */

export type ThemeMode = 'system' | 'dark' | 'light'
export type WidgetSize = 'small' | 'medium' | 'large'
export type CornerPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'custom'
export type BlurEffect = 'none' | 'acrylic' | 'mica'

export interface WidgetPosition {
  x: number
  y: number
}

export interface AppSettings {
  /** Colour scheme of the widget and the settings window. */
  theme: ThemeMode
  /** Preset widget footprint. */
  widgetSize: WidgetSize
  /** Window opacity, 0.35 – 1. */
  opacity: number
  /** Screen anchor. `custom` means "wherever the user dragged it". */
  corner: CornerPosition
  /** Last known top-left position in DIP screen coordinates. */
  position: WidgetPosition | null
  /** Gmail poll cadence in seconds. */
  pollIntervalSeconds: number
  /** Windows 11 backdrop material. `none` keeps the window fully transparent. */
  blurEffect: BlurEffect
  alwaysOnTop: boolean
  /** Owns the widget by a hidden window so it disappears from Alt+Tab. */
  hideFromAltTab: boolean
  /** Native toast when a new email lands. */
  showNotifications: boolean
  /** Render the body preview lines under the subject. */
  showBodyPreview: boolean
  /** How many preview lines to render (2 or 3). */
  bodyPreviewLines: number
  /** Start Mail Sticker when Windows starts. */
  launchAtLogin: boolean
  /** Persisted visibility so a hidden widget stays hidden across restarts. */
  widgetVisible: boolean
}

/* -------------------------------------------------------------------------- */
/*                                    Mail                                    */
/* -------------------------------------------------------------------------- */

export interface EmailSender {
  name: string
  email: string
}

export interface EmailPreview {
  id: string
  threadId: string
  sender: EmailSender
  subject: string
  /** Plain-text opening of the message body, already normalised. */
  preview: string
  /** Epoch milliseconds. */
  receivedAt: number
  unread: boolean
  hasAttachments: boolean
  isImportant: boolean
}

export type MailStatus =
  /** No OAuth client id/secret available yet. */
  | 'unconfigured'
  /** Credentials exist but no Google account is linked. */
  | 'signed-out'
  /** First fetch in flight. */
  | 'loading'
  /** Snapshot is valid (it may still hold `email: null`). */
  | 'ready'
  /** Last fetch failed; `error` is populated. */
  | 'error'

export interface AppError {
  code: string
  message: string
  retryable: boolean
}

export interface MailSnapshot {
  status: MailStatus
  /** Newest unread inbox message, or `null` when the inbox is clear. */
  email: EmailPreview | null
  unreadCount: number
  lastUpdatedAt: number | null
  error: AppError | null
  /** A refresh is currently running. */
  isFetching: boolean
  /** Email address of the linked account, when known. */
  account: string | null
}

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

export type AuthStatus = 'unconfigured' | 'signed-out' | 'signing-in' | 'signed-in'

export interface AccountInfo {
  email: string
  connectedAt: number
}

export interface AuthState {
  status: AuthStatus
  account: AccountInfo | null
  error: string | null
}

export type CredentialsSource = 'env' | 'stored' | 'none'

export interface CredentialsState {
  configured: boolean
  source: CredentialsSource
  /** Redacted client id, safe to render. */
  clientIdPreview: string | null
  /** Whether a client secret is present alongside the id. */
  hasSecret: boolean
  /** True when credentials come from the environment and cannot be edited. */
  readOnly: boolean
}

export interface CredentialsInput {
  clientId: string
  clientSecret: string
}

/* -------------------------------------------------------------------------- */
/*                                    App                                     */
/* -------------------------------------------------------------------------- */

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  isDev: boolean
  logFile: string
  userDataPath: string
}

export interface DragPoint {
  /** Pointer position in DIP screen coordinates (`PointerEvent.screenX/Y`). */
  x: number
  y: number
}

/* -------------------------------------------------------------------------- */
/*                              Preload bridge API                            */
/* -------------------------------------------------------------------------- */

export type Unsubscribe = () => void

export interface MailStickerApi {
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
    reset(): Promise<AppSettings>
    onChange(listener: (settings: AppSettings) => void): Unsubscribe
  }
  auth: {
    getState(): Promise<AuthState>
    signIn(): Promise<AuthState>
    signOut(): Promise<AuthState>
    onChange(listener: (state: AuthState) => void): Unsubscribe
    getCredentials(): Promise<CredentialsState>
    saveCredentials(input: CredentialsInput): Promise<CredentialsState>
    clearCredentials(): Promise<CredentialsState>
    onCredentialsChange(listener: (state: CredentialsState) => void): Unsubscribe
  }
  mail: {
    getSnapshot(): Promise<MailSnapshot>
    refresh(): Promise<MailSnapshot>
    markRead(messageId: string): Promise<MailSnapshot>
    openMessage(messageId: string): Promise<void>
    openInbox(): Promise<void>
    onUpdate(listener: (snapshot: MailSnapshot) => void): Unsubscribe
    onNewMail(listener: (email: EmailPreview) => void): Unsubscribe
  }
  widget: {
    dragStart(point: DragPoint): void
    dragMove(point: DragPoint): void
    dragEnd(): void
    hide(): void
    showContextMenu(): void
    openSettings(): void
  }
  window: {
    minimizeSettings(): void
    closeSettings(): void
  }
  app: {
    getInfo(): Promise<AppInfo>
    openLogFolder(): Promise<void>
    openExternal(url: string): Promise<void>
    quit(): void
  }
}
