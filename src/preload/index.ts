import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel } from '@shared/channels'
import type {
  AppInfo,
  AppSettings,
  AuthState,
  CredentialsInput,
  CredentialsState,
  DragPoint,
  EmailPreview,
  MailSnapshot,
  MailStickerApi,
  Unsubscribe
} from '@shared/types'

/** Wraps `ipcRenderer.on` into a subscription with a disposer. */
function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.off(channel, handler)
  }
}

const api: MailStickerApi = {
  settings: {
    get: () => ipcRenderer.invoke(IpcChannel.SettingsGet) as Promise<AppSettings>,
    update: (patch) => ipcRenderer.invoke(IpcChannel.SettingsUpdate, patch) as Promise<AppSettings>,
    reset: () => ipcRenderer.invoke(IpcChannel.SettingsReset) as Promise<AppSettings>,
    onChange: (listener) => subscribe<AppSettings>(IpcChannel.SettingsChanged, listener)
  },
  auth: {
    getState: () => ipcRenderer.invoke(IpcChannel.AuthGetState) as Promise<AuthState>,
    signIn: () => ipcRenderer.invoke(IpcChannel.AuthSignIn) as Promise<AuthState>,
    signOut: () => ipcRenderer.invoke(IpcChannel.AuthSignOut) as Promise<AuthState>,
    onChange: (listener) => subscribe<AuthState>(IpcChannel.AuthStateChanged, listener),
    getCredentials: () =>
      ipcRenderer.invoke(IpcChannel.AuthGetCredentials) as Promise<CredentialsState>,
    saveCredentials: (input: CredentialsInput) =>
      ipcRenderer.invoke(IpcChannel.AuthSaveCredentials, input) as Promise<CredentialsState>,
    clearCredentials: () =>
      ipcRenderer.invoke(IpcChannel.AuthClearCredentials) as Promise<CredentialsState>,
    onCredentialsChange: (listener) =>
      subscribe<CredentialsState>(IpcChannel.AuthCredentialsChanged, listener)
  },
  mail: {
    getSnapshot: () => ipcRenderer.invoke(IpcChannel.MailGetSnapshot) as Promise<MailSnapshot>,
    refresh: () => ipcRenderer.invoke(IpcChannel.MailRefresh) as Promise<MailSnapshot>,
    markRead: (messageId) =>
      ipcRenderer.invoke(IpcChannel.MailMarkRead, messageId) as Promise<MailSnapshot>,
    openMessage: (messageId) =>
      ipcRenderer.invoke(IpcChannel.MailOpenMessage, messageId) as Promise<void>,
    openInbox: () => ipcRenderer.invoke(IpcChannel.MailOpenInbox) as Promise<void>,
    onUpdate: (listener) => subscribe<MailSnapshot>(IpcChannel.MailUpdated, listener),
    onNewMail: (listener) => subscribe<EmailPreview>(IpcChannel.MailNewMessage, listener)
  },
  widget: {
    dragStart: (point: DragPoint) => ipcRenderer.send(IpcChannel.WidgetDragStart, point),
    dragMove: (point: DragPoint) => ipcRenderer.send(IpcChannel.WidgetDragMove, point),
    dragEnd: () => ipcRenderer.send(IpcChannel.WidgetDragEnd),
    hide: () => ipcRenderer.send(IpcChannel.WidgetHide),
    showContextMenu: () => ipcRenderer.send(IpcChannel.WidgetContextMenu),
    openSettings: () => ipcRenderer.send(IpcChannel.WidgetOpenSettings)
  },
  window: {
    minimizeSettings: () => ipcRenderer.send(IpcChannel.WindowMinimizeSettings),
    closeSettings: () => ipcRenderer.send(IpcChannel.WindowCloseSettings)
  },
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannel.AppGetInfo) as Promise<AppInfo>,
    openLogFolder: () => ipcRenderer.invoke(IpcChannel.AppOpenLogFolder) as Promise<void>,
    openExternal: (url) => ipcRenderer.invoke(IpcChannel.AppOpenExternal, url) as Promise<void>,
    quit: () => ipcRenderer.send(IpcChannel.AppQuit)
  }
}

// contextIsolation is on, so this is the only surface the renderer can reach.
contextBridge.exposeInMainWorld('mailSticker', api)
