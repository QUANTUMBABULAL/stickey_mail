import { screen } from 'electron'
import {
  WIDGET_SCREEN_MARGIN,
  WIDGET_SHADOW_PADDING,
  clamp,
  widgetWindowSize
} from '@shared/settings'
import type { AppSettings, WidgetPosition } from '@shared/types'

export interface Size {
  width: number
  height: number
}

/**
 * Distance from the work-area edge to the *window* origin. The window carries a
 * transparent gutter for its drop shadow, so the visible card still lands
 * `WIDGET_SCREEN_MARGIN` away from the screen edge.
 */
function edgeOffset(settings: AppSettings): number {
  const gutter = settings.blurEffect === 'none' ? WIDGET_SHADOW_PADDING : 0
  return Math.max(0, WIDGET_SCREEN_MARGIN - gutter)
}

function displayForPoint(position: WidgetPosition, size: Size): Electron.Display {
  const center = {
    x: Math.round(position.x + size.width / 2),
    y: Math.round(position.y + size.height / 2)
  }
  return screen.getDisplayNearestPoint(center)
}

/** Keeps the window fully inside the usable area of the display it sits on. */
export function clampToWorkArea(position: WidgetPosition, size: Size): WidgetPosition {
  const { workArea } = displayForPoint(position, size)
  return {
    x: Math.round(clamp(position.x, workArea.x, workArea.x + Math.max(0, workArea.width - size.width))),
    y: Math.round(
      clamp(position.y, workArea.y, workArea.y + Math.max(0, workArea.height - size.height))
    )
  }
}

/** Resolves the settings' corner/position pair into concrete screen coordinates. */
export function computeWidgetPosition(settings: AppSettings, size?: Size): WidgetPosition {
  const windowSize = size ?? widgetWindowSize(settings)

  if (settings.corner === 'custom' && settings.position) {
    return clampToWorkArea(settings.position, windowSize)
  }

  const { workArea } = screen.getPrimaryDisplay()
  const offset = edgeOffset(settings)
  const left = workArea.x + offset
  const top = workArea.y + offset
  const right = workArea.x + workArea.width - windowSize.width - offset
  const bottom = workArea.y + workArea.height - windowSize.height - offset

  switch (settings.corner) {
    case 'top-left':
      return { x: Math.round(left), y: Math.round(top) }
    case 'bottom-left':
      return { x: Math.round(left), y: Math.round(bottom) }
    case 'bottom-right':
      return { x: Math.round(right), y: Math.round(bottom) }
    case 'top-right':
    default:
      return { x: Math.round(right), y: Math.round(top) }
  }
}

const CORNER_SNAP_DISTANCE = 48

const CORNERS: AppSettings['corner'][] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

/**
 * After a drag, decides whether the widget landed close enough to a corner to
 * stay anchored there (so it survives a resolution change), or whether the user
 * genuinely wants it at a free position.
 */
export function resolveDroppedPosition(
  position: WidgetPosition,
  settings: AppSettings,
  size: Size
): Pick<AppSettings, 'corner' | 'position'> {
  const primary = screen.getPrimaryDisplay()
  const onPrimary = displayForPoint(position, size).id === primary.id

  if (onPrimary) {
    for (const corner of CORNERS) {
      const anchor = computeWidgetPosition({ ...settings, corner, position: null }, size)
      const distance = Math.hypot(anchor.x - position.x, anchor.y - position.y)
      if (distance <= CORNER_SNAP_DISTANCE) return { corner, position: anchor }
    }
  }

  return { corner: 'custom', position }
}
