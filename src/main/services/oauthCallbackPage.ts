import { APP_NAME } from '@shared/constants'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The page Google's redirect lands on. Fully self-contained — the loopback
 * server never serves anything else, and nothing is fetched from the network.
 */
export function renderCallbackPage(kind: 'success' | 'error', message: string): string {
  const accent = kind === 'success' ? '#6366f1' : '#ef4444'
  const title = kind === 'success' ? `Connected to ${APP_NAME}` : 'Sign-in failed'
  const glyph = kind === 'success' ? '&#10003;' : '&#33;'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
        background: #0b0f1a;
        color: #e5e7eb;
        padding: 24px;
      }
      .card {
        width: min(420px, 100%);
        padding: 40px 32px;
        border-radius: 20px;
        text-align: center;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
      }
      .badge {
        width: 64px; height: 64px;
        margin: 0 auto 20px;
        border-radius: 20px;
        display: grid; place-items: center;
        font-size: 30px; font-weight: 700; color: #fff;
        background: ${accent};
        box-shadow: 0 10px 30px ${accent}55;
      }
      h1 { margin: 0 0 10px; font-size: 21px; font-weight: 650; letter-spacing: -0.01em; }
      p { margin: 0; font-size: 14px; line-height: 1.6; color: #9ca3af; }
      .hint { margin-top: 22px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge">${glyph}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p class="hint">This window was served locally by ${escapeHtml(APP_NAME)} and can be closed.</p>
    </main>
  </body>
</html>`
}
