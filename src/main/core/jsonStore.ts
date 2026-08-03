import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createLogger } from './logger'

const log = createLogger('store')

export interface JsonStoreOptions<T extends object> {
  filePath: string
  defaults: T
  /** Coerces file contents into a valid `T`. Runs on every load. */
  sanitize?: (raw: unknown, defaults: T) => T
  /** Milliseconds to coalesce writes. */
  writeDelayMs?: number
}

/**
 * Small, dependency-free, atomic JSON store on disk.
 *
 * Writes go to `<file>.tmp` and are then renamed over the target, so a crash
 * mid-write can never leave a half-written settings file behind. Reads that
 * fail are logged, the bad file is preserved as `<file>.corrupt` and defaults
 * are used instead.
 */
export class JsonStore<T extends object> {
  private readonly options: JsonStoreOptions<T>
  private data: T
  private writeTimer: NodeJS.Timeout | null = null
  private dirty = false

  constructor(options: JsonStoreOptions<T>) {
    this.options = options
    this.data = this.load()
  }

  get filePath(): string {
    return this.options.filePath
  }

  get(): T {
    return this.data
  }

  set(patch: Partial<T>): T {
    this.data = this.sanitize({ ...this.data, ...patch })
    this.schedulePersist()
    return this.data
  }

  replace(next: T): T {
    this.data = this.sanitize(next)
    this.schedulePersist()
    return this.data
  }

  reset(): T {
    this.data = this.sanitize({ ...this.options.defaults })
    this.schedulePersist()
    return this.data
  }

  /** Writes any pending changes immediately (used on quit). */
  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    if (!this.dirty) return
    this.persist()
  }

  private sanitize(value: unknown): T {
    return this.options.sanitize
      ? this.options.sanitize(value, this.options.defaults)
      : ({ ...this.options.defaults, ...(value as T) } as T)
  }

  private load(): T {
    const { filePath } = this.options
    if (!existsSync(filePath)) return this.sanitize({ ...this.options.defaults })

    try {
      // Strip a UTF-8 BOM: plenty of Windows editors add one, and JSON.parse
      // rejects it outright.
      const contents = readFileSync(filePath, 'utf8').replace(/^﻿/, '')
      const parsed: unknown = JSON.parse(contents)
      return this.sanitize(parsed)
    } catch (error) {
      log.error(`Unreadable store at ${filePath}: ${(error as Error).message}`)
      try {
        renameSync(filePath, `${filePath}.corrupt`)
      } catch {
        /* best effort — keep going with defaults */
      }
      return this.sanitize({ ...this.options.defaults })
    }
  }

  private schedulePersist(): void {
    this.dirty = true
    if (this.writeTimer) return
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      this.persist()
    }, this.options.writeDelayMs ?? 150)
    this.writeTimer.unref?.()
  }

  private persist(): void {
    const { filePath } = this.options
    const tempPath = `${filePath}.tmp`
    try {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(tempPath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8')
      renameSync(tempPath, filePath)
      this.dirty = false
    } catch (error) {
      log.error(`Failed to persist ${filePath}: ${(error as Error).message}`)
    }
  }
}
