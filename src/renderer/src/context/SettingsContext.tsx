import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { AppSettings } from '@shared/types'
import { api } from '@/lib/bridge'

interface SettingsContextValue {
  settings: AppSettings
  /** False until the first read from the main process resolves. */
  isReady: boolean
  resolvedTheme: 'dark' | 'light'
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  resetSettings: () => Promise<void>
  error: string | null
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Mirrors the main process' settings store into React and applies the theme to
 * the document. The main process stays the single source of truth: updates are
 * sent over IPC and come back through the change event.
 */
export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isReady, setIsReady] = useState(false)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    api.settings
      .get()
      .then((value) => {
        if (!active) return
        setSettings(value)
        setIsReady(true)
      })
      .catch((cause: Error) => {
        if (!active) return
        setError(cause.message)
        setIsReady(true)
      })

    const unsubscribe = api.settings.onChange((value) => {
      if (active) setSettings(value)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: 'dark' | 'light' =
    settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.dataset.material = String(settings.blurEffect !== 'none')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme, settings.blurEffect])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    // Optimistic so sliders feel immediate; the broadcast confirms it.
    setSettings((current) => ({ ...current, ...patch }))
    try {
      const next = await api.settings.update(patch)
      setSettings(next)
      setError(null)
    } catch (cause) {
      setError((cause as Error).message)
      const actual = await api.settings.get()
      setSettings(actual)
    }
  }, [])

  const resetSettings = useCallback(async () => {
    const next = await api.settings.reset()
    setSettings(next)
  }, [])

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, isReady, resolvedTheme, updateSettings, resetSettings, error }),
    [settings, isReady, resolvedTheme, updateSettings, resetSettings, error]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>')
  return context
}
