import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import type { MailSnapshot } from '@shared/types'

export interface ContextMenuActions {
  refresh: () => void
  markRead: (messageId: string) => void
  openMessage: (messageId: string) => void
  openInbox: () => void
  openSettings: () => void
  signIn: () => void
  hideWidget: () => void
  quit: () => void
}

/** Right-click menu for the sticker. Items adapt to the current state. */
export function showWidgetContextMenu(
  window: BrowserWindow,
  snapshot: MailSnapshot,
  actions: ContextMenuActions
): void {
  const email = snapshot.email
  const signedIn = snapshot.status !== 'signed-out' && snapshot.status !== 'unconfigured'

  const template: MenuItemConstructorOptions[] = []

  if (!signedIn) {
    template.push({
      label: snapshot.status === 'unconfigured' ? 'Add Google credentials…' : 'Sign in with Google',
      click: () => (snapshot.status === 'unconfigured' ? actions.openSettings() : actions.signIn())
    })
  } else {
    template.push(
      {
        label: 'Open in Gmail',
        enabled: Boolean(email),
        click: () => email && actions.openMessage(email.id)
      },
      {
        label: 'Open inbox',
        click: () => actions.openInbox()
      },
      { type: 'separator' },
      {
        label: 'Refresh now',
        accelerator: 'F5',
        click: () => actions.refresh()
      },
      {
        label: 'Mark as read',
        enabled: Boolean(email),
        click: () => email && actions.markRead(email.id)
      }
    )
  }

  template.push(
    { type: 'separator' },
    { label: 'Settings…', click: () => actions.openSettings() },
    { label: 'Hide widget', click: () => actions.hideWidget() },
    { type: 'separator' },
    { label: 'Exit Mail Sticker', click: () => actions.quit() }
  )

  Menu.buildFromTemplate(template).popup({ window })
}
