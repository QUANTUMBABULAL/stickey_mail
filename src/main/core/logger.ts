import log from 'electron-log/main'
import type { LogFunctions } from 'electron-log'

export type Logger = LogFunctions

const VALID_LEVELS = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'] as const
type LogLevel = (typeof VALID_LEVELS)[number]

let initialized = false

/**
 * Wires up electron-log. Called once, as early as possible in the main process
 * so that renderer errors and unhandled rejections are captured too.
 */
export function initLogger(isDev: boolean): void {
  if (initialized) return
  initialized = true

  log.initialize()

  const envLevel = process.env.MAIL_STICKER_LOG_LEVEL as LogLevel | undefined
  const fileLevel: LogLevel =
    envLevel && VALID_LEVELS.includes(envLevel) ? envLevel : isDev ? 'debug' : 'info'

  log.transports.file.level = fileLevel
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}'
  log.transports.console.level = isDev ? 'debug' : 'warn'
  log.transports.console.format = '{h}:{i}:{s} {scope} › {text}'

  log.errorHandler.startCatching({ showDialog: false })
  log.eventLogger.startLogging()
}

export function createLogger(scope: string): Logger {
  return log.scope(scope)
}

export function getLogFilePath(): string {
  try {
    return log.transports.file.getFile().path
  } catch {
    return ''
  }
}

export const logger = createLogger('app')
