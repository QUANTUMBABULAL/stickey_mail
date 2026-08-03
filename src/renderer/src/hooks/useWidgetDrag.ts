import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { api } from '@/lib/bridge'

/** Movement past this many pixels counts as a drag, not a click. */
const DRAG_THRESHOLD = 4

export interface WidgetDragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  /** True when the pointer moved far enough that the gesture was a drag. */
  didDrag: () => boolean
}

/**
 * Moves the frameless window by streaming screen coordinates to the main
 * process.
 *
 * `-webkit-app-region: drag` is deliberately avoided: it swallows click events,
 * and the widget needs single-click and double-click to keep working while the
 * whole card stays draggable.
 */
export function useWidgetDrag(): WidgetDragHandlers {
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const originRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef<number | null>(null)
  const pendingRef = useRef<{ x: number; y: number } | null>(null)

  const flush = useCallback(() => {
    frameRef.current = null
    const point = pendingRef.current
    if (!point) return
    pendingRef.current = null
    api.widget.dragMove(point)
  }, [])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('[data-no-drag]')) return

      const element = event.currentTarget
      draggingRef.current = true
      movedRef.current = false
      originRef.current = { x: event.screenX, y: event.screenY }
      api.widget.dragStart({ x: event.screenX, y: event.screenY })

      // Pointer capture keeps events flowing even when the cursor outruns the
      // window while it is being repositioned.
      try {
        element.setPointerCapture(event.pointerId)
      } catch {
        /* capture is best-effort */
      }

      const onPointerMove = (moveEvent: PointerEvent): void => {
        if (!draggingRef.current) return

        if (!movedRef.current) {
          const distance = Math.hypot(
            moveEvent.screenX - originRef.current.x,
            moveEvent.screenY - originRef.current.y
          )
          if (distance < DRAG_THRESHOLD) return
          movedRef.current = true
        }

        pendingRef.current = { x: moveEvent.screenX, y: moveEvent.screenY }
        frameRef.current ??= window.requestAnimationFrame(flush)
      }

      const onPointerUp = (): void => {
        draggingRef.current = false
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current)
          frameRef.current = null
        }
        if (pendingRef.current) flush()
        api.widget.dragEnd()

        element.removeEventListener('pointermove', onPointerMove)
        element.removeEventListener('pointerup', onPointerUp)
        element.removeEventListener('pointercancel', onPointerUp)
        try {
          element.releasePointerCapture(event.pointerId)
        } catch {
          /* already released */
        }
      }

      element.addEventListener('pointermove', onPointerMove)
      element.addEventListener('pointerup', onPointerUp)
      element.addEventListener('pointercancel', onPointerUp)
    },
    [flush]
  )

  return { onPointerDown, didDrag: () => movedRef.current }
}
