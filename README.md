# Mail Sticker

A tiny floating Gmail widget that lives on your Windows desktop like a sticky note.
It shows your newest unread email — sender, subject, the first lines of the body and
when it arrived — and updates itself automatically.

- **Always on top**, borderless, transparent, rounded, with a soft shadow
- Optional **Mica / Acrylic** backdrop on Windows 11
- **No taskbar button**, hidden from **Alt+Tab**, remembers where you put it
- Slides in, glows and cross-fades when new mail lands
- Single click opens the email, double click opens the inbox, right click opens a menu
- Tray icon for when you hide it

Everything Gmail-related happens in the Electron main process. The renderer never
touches the network, and your refresh token is encrypted with Windows DPAPI.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

The widget appears in the top-right corner and asks for Google credentials. Follow
[Google setup](#google-setup) below, paste the client ID/secret into
**Settings → Google API credentials** (or into a `.env` file), then click
**Sign in with Google**.

---

## Google setup

Mail Sticker talks to Gmail with your own OAuth client, so nothing is proxied through
a third party. It takes about three minutes to create one.

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create (or pick) a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen**
   - User type **External**
   - Add the scope `https://www.googleapis.com/auth/gmail.modify`
   - Add your own Google address under **Test users**
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Desktop app**
5. Copy the **Client ID** and **Client secret**.

Give them to the app either way:

**A — settings window (easiest).** Paste both into *Settings → Google API credentials*.
The secret is encrypted with `safeStorage` (Windows DPAPI) before it touches disk.

**B — environment file.** Copy `.env.example` to `.env` in the project root:

```
GOOGLE_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
```

Values found in the environment always win and are shown read-only in the UI. In an
installed build, a `.env` next to `Mail Sticker.exe` or inside
`%APPDATA%\mail-sticker\` is picked up too.

### Why `gmail.modify`?

It is the narrowest scope that allows both reading the inbox and removing the
`UNREAD` label ("Mark as read"). The account address is read from
`users.getProfile`, so no additional profile scope is requested.

### How sign-in works

The system browser handles consent (Google rejects embedded webviews) using the
loopback redirect flow with PKCE from RFC 8252: a throwaway HTTP server binds to
`127.0.0.1` on a random port, receives the authorization code, verifies the `state`
value and shuts down immediately. Only the refresh token is persisted, encrypted.

---

## Polling vs. push

Gmail push notifications require a Google Cloud Pub/Sub topic *and* a publicly
reachable HTTPS endpoint to receive webhooks. A desktop widget has neither, and
`users.watch` subscriptions expire after seven days. Mail Sticker polls instead, but
does it cheaply:

1. `users.getProfile` returns the mailbox `historyId` for **1 quota unit**. If it has
   not changed, the cycle stops there.
2. Only when it changes does the app fetch the unread count and the newest message.

At the default 15-second cadence a quiet mailbox costs roughly 6k quota units per
day, against a daily allowance in the billions. The interval is configurable
(5s – 5min) in Settings. Failures back off exponentially up to five minutes, and
polling pauses entirely while the machine is asleep or the session is locked.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Electron + Vite with hot reload |
| `npm run build` | Typecheck, then bundle main/preload/renderer into `out/` |
| `npm run typecheck` | TypeScript for the Node side and the web side |
| `npm run dist` | Build + NSIS installer into `release/<version>/` |
| `npm run dist:portable` | Build + single-file portable executable |
| `npm run pack` | Unpacked app directory only (no installer) |
| `npm run icons` | Regenerate every icon from `scripts/generate-icons.mjs` |
| `npm run clean` | Remove `out/`, `release/` and build caches |

---

## Project structure

```
mail-sticker/
├─ electron-builder.yml          Packaging + NSIS installer config
├─ electron.vite.config.ts       Three build targets: main, preload, renderer
├─ scripts/
│  ├─ generate-icons.mjs         Draws + encodes PNG/ICO with zero dependencies
│  └─ clean.mjs
├─ resources/                    Runtime assets (app + tray icons)
├─ build/                        Installer assets (icon.ico)
└─ src/
   ├─ shared/                    Types, IPC channel names, settings contract
   │  ├─ types.ts                Domain types + the preload API interface
   │  ├─ channels.ts
   │  ├─ settings.ts             Defaults, size presets, sanitiser
   │  └─ constants.ts            Scopes, Gmail URLs, error codes
   ├─ preload/
   │  └─ index.ts                contextBridge surface — the only way in
   ├─ main/
   │  ├─ index.ts                Entry: single instance, hardening, bootstrap
   │  ├─ app.ts                  Object graph + wiring between services/windows
   │  ├─ core/                   logger, config (.env), paths, errors, jsonStore
   │  ├─ store/                  settingsStore, credentialStore (DPAPI)
   │  ├─ services/               authService, gmailService, mailWatcher,
   │  │                          notificationService, trayService
   │  ├─ windows/                widgetWindow, settingsWindow, contextMenu
   │  ├─ ipc/registerIpc.ts      Validated IPC handlers
   │  └─ utils/                  mime parsing, geometry, renderer logging
   └─ renderer/
      ├─ widget.html             Widget entry (own CSP)
      ├─ settings.html           Settings entry
      └─ src/
         ├─ app/                 WidgetApp, SettingsApp
         ├─ components/          widget/, settings/, ui/ (reusable primitives)
         ├─ context/             SettingsContext, AuthContext
         ├─ hooks/               useMail (React Query), useWidgetDrag, …
         ├─ lib/                 bridge, format, queryClient, sizing
         └─ styles/index.css     Tailwind v4 theme + component layers
```

### How state flows

The main process is the single source of truth.

```
Gmail API ─► MailWatcher ─► MailSnapshot ─► broadcast ─► preload ─► React Query cache
                                                                       │
   settings.json ─► SettingsStore ─► broadcast ─► SettingsContext ─────┤
                                                                       ▼
                                                                   Widget UI
```

The renderer never fetches on its own: `useMail` seeds a React Query entry once and
then writes every `mail:updated` broadcast straight into the cache. Configuration and
auth state live in Context, mail state in React Query.

---

## Behaviour notes

**Transparency vs. Mica/Acrylic.** Windows cannot give a window both per-pixel
transparency and a DWM backdrop material. With *Transparent glass* (the default) the
window is truly transparent and the card paints its own rounded corners and shadow
inside a 16px gutter. Choosing *Acrylic* or *Mica* rebuilds the window as an opaque
one with a system backdrop; the gutter disappears and DWM rounds the corners. Both
paths are handled — the widget window is recreated when you switch.

**Alt+Tab.** `skipTaskbar` only removes the taskbar button. To leave the window
switcher as well, the sticker is owned by a hidden 1×1 window. Toggling this setting
also rebuilds the window.

**Dragging.** `-webkit-app-region: drag` swallows click events, which would break
single vs. double click. Instead the card streams screen coordinates over IPC and the
main process repositions the window; movement under 4px is still treated as a click.
Dropping within 48px of a corner re-anchors the widget to that corner, so it survives
a resolution change; anywhere else is remembered as a free position.

**Theme.** The chosen theme is pushed to `nativeTheme.themeSource`, so the Windows
backdrop tint, native menus and the widget agree with each other.

---

## Troubleshooting

**"Setup needed"** — no OAuth client is configured. See [Google setup](#google-setup).

**Sign-in says the app is blocked / unverified** — add your Google address under
*Test users* on the OAuth consent screen. An unverified external app only allows the
accounts listed there.

**"Google did not return a refresh token"** — Google issues one only on first consent.
Remove Mail Sticker at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
and sign in again.

**Widget is nowhere to be seen** — it may be hidden. Click the tray icon, or right
click it and choose *Show widget*.

**Logs** — `%APPDATA%\mail-sticker\logs\main.log`, also reachable from
*Settings → About → Logs*. Renderer console output and crashes are mirrored there.

**`EBUSY: resource busy or locked … Mail Sticker.exe` while packaging** — real-time
antivirus is holding the freshly extracted executable. Build to a path outside
`Desktop`/`Documents`, or add the project folder to your Defender exclusions:

```bash
npx electron-builder --win nsis --publish never -c.directories.output=C:/temp/ms-build
```

**Reset everything** — quit the app and delete `%APPDATA%\mail-sticker\`. That removes
settings and the stored Google session.

---

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on every window.
- The preload exposes a single API object; every IPC argument is validated in main.
- A restrictive CSP is set in both HTML entries; no remote origin is reachable and no
  avatar images are fetched (initials are generated locally).
- Navigation away from the app's own pages is blocked; links open in the system browser.
- All permission requests (camera, geolocation, …) are denied.
- The client secret and refresh token are encrypted with `safeStorage`. If the OS
  refuses to provide encryption the value is stored with an explicit `raw.v1:` marker
  and a warning is logged.
- `npm run dist` produces an unsigned installer. Ship a code-signing certificate via
  electron-builder's `win.certificateFile` for a distributable build.

---

## Requirements

- Windows 10 or 11 (Mica/Acrylic need Windows 11 22H2+)
- Node.js 20.11 or newer

Built with Electron 43, React 19, TypeScript 5.9, Tailwind CSS 4, TanStack Query 5,
Framer Motion and electron-vite.

> Renderer-only libraries (React, Tailwind, Query, Framer Motion, lucide) are
> `devDependencies` on purpose: Vite bundles them at build time, so keeping them out
> of `dependencies` keeps them out of the packaged `node_modules`.

## License

MIT
