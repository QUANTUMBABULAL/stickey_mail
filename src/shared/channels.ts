/** Every IPC channel name used by the app, in one place. */
export const IpcChannel = {
  // renderer -> main (invoke)
  SettingsGet: 'settings:get',
  SettingsUpdate: 'settings:update',
  SettingsReset: 'settings:reset',

  AuthGetState: 'auth:get-state',
  AuthSignIn: 'auth:sign-in',
  AuthSignOut: 'auth:sign-out',
  AuthGetCredentials: 'auth:get-credentials',
  AuthSaveCredentials: 'auth:save-credentials',
  AuthClearCredentials: 'auth:clear-credentials',

  MailGetSnapshot: 'mail:get-snapshot',
  MailRefresh: 'mail:refresh',
  MailMarkRead: 'mail:mark-read',
  MailOpenMessage: 'mail:open-message',
  MailOpenInbox: 'mail:open-inbox',

  AppGetInfo: 'app:get-info',
  AppOpenLogFolder: 'app:open-log-folder',
  AppOpenExternal: 'app:open-external',

  // renderer -> main (fire and forget)
  WidgetDragStart: 'widget:drag-start',
  WidgetDragMove: 'widget:drag-move',
  WidgetDragEnd: 'widget:drag-end',
  WidgetHide: 'widget:hide',
  WidgetContextMenu: 'widget:context-menu',
  WidgetOpenSettings: 'widget:open-settings',
  WindowMinimizeSettings: 'window:minimize-settings',
  WindowCloseSettings: 'window:close-settings',
  AppQuit: 'app:quit',

  // main -> renderer (broadcast)
  SettingsChanged: 'settings:changed',
  AuthStateChanged: 'auth:state-changed',
  AuthCredentialsChanged: 'auth:credentials-changed',
  MailUpdated: 'mail:updated',
  MailNewMessage: 'mail:new-message'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]
