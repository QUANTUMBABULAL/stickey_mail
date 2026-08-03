import type {
  AppSettings,
  BlurEffect,
  CornerPosition,
  ThemeMode,
  WidgetPosition,
  WidgetSize
} from './types'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  widgetSize: 'medium',
  opacity: 1,
  corner: 'top-right',
  position: null,
  pollIntervalSeconds: 15,
  blurEffect: 'none',
  alwaysOnTop: true,
  hideFromAltTab: true,
  showNotifications: true,
  showBodyPreview: true,
  bodyPreviewLines: 3,
  launchAtLogin: false,
  widgetVisible: true
}

/** Card footprint per size preset, in DIP. Shadow padding is added on top. */
export const WIDGET_SIZE_PRESETS: Record<WidgetSize, { width: number; height: number }> = {
  small: { width: 296, height: 148 },
  medium: { width: 344, height: 176 },
  large: { width: 400, height: 208 }
}

/**
 * Transparent gutter kept around the card so the CSS drop shadow has room to
 * render. Only applied when no Windows backdrop material is in use.
 */
export const WIDGET_SHADOW_PADDING = 16

/** Distance between the card and the screen edge for the corner presets. */
export const WIDGET_SCREEN_MARGIN = 24

export const POLL_INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 300] as const

export const MIN_OPACITY = 0.35
export const MAX_OPACITY = 1
export const MIN_POLL_INTERVAL = 5
export const MAX_POLL_INTERVAL = 3600

const THEME_MODES: readonly ThemeMode[] = ['system', 'dark', 'light']
const WIDGET_SIZES: readonly WidgetSize[] = ['small', 'medium', 'large']
const BLUR_EFFECTS: readonly BlurEffect[] = ['none', 'acrylic', 'mica']
const CORNERS: readonly CornerPosition[] = [
  'top-right',
  'top-left',
  'bottom-right',
  'bottom-left',
  'custom'
]

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function pickNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function pickPosition(value: unknown): WidgetPosition | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<WidgetPosition>
  if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') return null
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return null
  return { x: Math.round(candidate.x), y: Math.round(candidate.y) }
}

/**
 * Coerces anything (a corrupt settings file, an over-eager IPC caller) into a
 * valid settings object. Unknown keys are dropped.
 */
export function sanitizeSettings(
  raw: unknown,
  base: AppSettings = DEFAULT_SETTINGS
): AppSettings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppSettings>

  return {
    theme: pickEnum(input.theme, THEME_MODES, base.theme),
    widgetSize: pickEnum(input.widgetSize, WIDGET_SIZES, base.widgetSize),
    opacity: pickNumber(input.opacity, MIN_OPACITY, MAX_OPACITY, base.opacity),
    corner: pickEnum(input.corner, CORNERS, base.corner),
    position: 'position' in input ? pickPosition(input.position) : base.position,
    pollIntervalSeconds: Math.round(
      pickNumber(
        input.pollIntervalSeconds,
        MIN_POLL_INTERVAL,
        MAX_POLL_INTERVAL,
        base.pollIntervalSeconds
      )
    ),
    blurEffect: pickEnum(input.blurEffect, BLUR_EFFECTS, base.blurEffect),
    alwaysOnTop: pickBoolean(input.alwaysOnTop, base.alwaysOnTop),
    hideFromAltTab: pickBoolean(input.hideFromAltTab, base.hideFromAltTab),
    showNotifications: pickBoolean(input.showNotifications, base.showNotifications),
    showBodyPreview: pickBoolean(input.showBodyPreview, base.showBodyPreview),
    bodyPreviewLines: input.bodyPreviewLines === 2 ? 2 : 3,
    launchAtLogin: pickBoolean(input.launchAtLogin, base.launchAtLogin),
    widgetVisible: pickBoolean(input.widgetVisible, base.widgetVisible)
  }
}

/**
 * Settings that require the widget window to be torn down and rebuilt, because
 * they are only honoured by `new BrowserWindow(...)`.
 */
export const STRUCTURAL_SETTING_KEYS: readonly (keyof AppSettings)[] = [
  'blurEffect',
  'hideFromAltTab'
]

export function needsWindowRecreate(previous: AppSettings, next: AppSettings): boolean {
  return STRUCTURAL_SETTING_KEYS.some((key) => previous[key] !== next[key])
}

/** Outer window size for a given settings object, shadow gutter included. */
export function widgetWindowSize(settings: AppSettings): { width: number; height: number } {
  const preset = WIDGET_SIZE_PRESETS[settings.widgetSize]
  const gutter = settings.blurEffect === 'none' ? WIDGET_SHADOW_PADDING * 2 : 0
  return { width: preset.width + gutter, height: preset.height + gutter }
}
