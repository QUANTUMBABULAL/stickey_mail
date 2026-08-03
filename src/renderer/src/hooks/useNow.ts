import { useEffect, useState } from 'react'

/**
 * A clock that ticks slowly, so relative timestamps ("3m ago") stay honest
 * without re-rendering the widget every second.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}
