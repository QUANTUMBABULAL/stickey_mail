import type { WebContents } from 'electron'
import type { Logger } from '../core/logger'

/**
 * Mirrors a renderer's console into the app log. Without this, a UI crash in a
 * frameless, devtools-less window is completely silent.
 */
export function attachRendererLogging(contents: WebContents, log: Logger, label: string): void {
  contents.on('console-message', (details) => {
    const location = details.sourceId ? ` (${details.sourceId}:${details.lineNumber})` : ''
    const line = `[${label}] ${details.message}${location}`
    if (details.level === 'error') log.error(line)
    else if (details.level === 'warning') log.warn(line)
    else log.debug(line)
  })

  contents.on('did-fail-load', (_event, code, description, url) => {
    log.error(`[${label}] failed to load (${code} ${description}) ${url}`)
  })

  contents.on('render-process-gone', (_event, gone) => {
    log.error(`[${label}] renderer process gone: ${gone.reason} (exit ${gone.exitCode})`)
  })

  contents.on('preload-error', (_event, preloadPath, error) => {
    log.error(`[${label}] preload failed (${preloadPath}): ${error.message}`)
  })

  contents.on('unresponsive', () => log.warn(`[${label}] renderer is unresponsive`))
}
