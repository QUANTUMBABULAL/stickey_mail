import { EventEmitter } from 'node:events'
import { DEFAULT_SETTINGS, sanitizeSettings } from '@shared/settings'
import type { AppSettings } from '@shared/types'
import { JsonStore } from '../core/jsonStore'
import { createLogger } from '../core/logger'
import { SETTINGS_FILE, userDataPath } from '../core/paths'

const log = createLogger('settings')

export interface SettingsChange {
  settings: AppSettings
  previous: AppSettings
  changedKeys: (keyof AppSettings)[]
}

type Events = {
  change: [SettingsChange]
}

/** Persisted user preferences plus change notifications. */
export class SettingsStore extends EventEmitter<Events> {
  private readonly store: JsonStore<AppSettings>

  constructor() {
    super()
    this.store = new JsonStore<AppSettings>({
      filePath: userDataPath(SETTINGS_FILE),
      defaults: DEFAULT_SETTINGS,
      sanitize: (raw, defaults) => sanitizeSettings(raw, defaults)
    })
    log.info(`Settings loaded from ${this.store.filePath}`)
  }

  get(): AppSettings {
    return this.store.get()
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const previous = this.store.get()
    const merged = sanitizeSettings({ ...previous, ...patch }, previous)
    const changedKeys = diffKeys(previous, merged)

    if (changedKeys.length === 0) return previous

    const settings = this.store.replace(merged)
    log.debug(`Settings changed: ${changedKeys.join(', ')}`)
    this.emit('change', { settings, previous, changedKeys })
    return settings
  }

  reset(): AppSettings {
    const previous = this.store.get()
    // Position and visibility are physical state, not preferences — keep them.
    const settings = this.store.replace(
      sanitizeSettings({
        ...DEFAULT_SETTINGS,
        position: previous.position,
        corner: previous.corner,
        widgetVisible: previous.widgetVisible
      })
    )
    const changedKeys = diffKeys(previous, settings)
    if (changedKeys.length > 0) this.emit('change', { settings, previous, changedKeys })
    return settings
  }

  flush(): void {
    this.store.flush()
  }
}

function diffKeys(a: AppSettings, b: AppSettings): (keyof AppSettings)[] {
  const keys = Object.keys(b) as (keyof AppSettings)[]
  return keys.filter((key) => {
    const left = a[key]
    const right = b[key]
    if (key === 'position') return JSON.stringify(left) !== JSON.stringify(right)
    return left !== right
  })
}
