import { useEffect, useRef, useState } from 'react'
import type { EmailPreview } from '@shared/types'
import { api } from '@/lib/bridge'

const PULSE_DURATION_MS = 2000

/**
 * Turns the main process' "new mail" event into a short-lived flag that drives
 * the glow animation. Keyed by message id so a second arrival re-triggers it.
 */
export function useNewMailPulse(): { pulseKey: number; isPulsing: boolean } {
  const [pulseKey, setPulseKey] = useState(0)
  const [isPulsing, setIsPulsing] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const unsubscribe = api.mail.onNewMail((_email: EmailPreview) => {
      setPulseKey((key) => key + 1)
      setIsPulsing(true)

      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setIsPulsing(false)
      }, PULSE_DURATION_MS)
    })

    return () => {
      unsubscribe()
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  return { pulseKey, isPulsing }
}
