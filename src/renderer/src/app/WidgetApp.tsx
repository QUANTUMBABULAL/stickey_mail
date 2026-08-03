import { useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { WIDGET_SHADOW_PADDING } from '@shared/settings'
import { MailCard } from '@/components/widget/MailCard'
import { WidgetHeader } from '@/components/widget/WidgetHeader'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
  UnconfiguredState
} from '@/components/widget/StatusStates'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { useMail } from '@/hooks/useMail'
import { useNewMailPulse } from '@/hooks/useNewMailPulse'
import { useNow } from '@/hooks/useNow'
import { useWidgetDrag } from '@/hooks/useWidgetDrag'
import { api } from '@/lib/bridge'
import { cn } from '@/lib/cn'
import { sizeStyles } from '@/lib/widgetSizing'

/** Window between the two clicks of a double click. */
const DOUBLE_CLICK_DELAY = 230

export function WidgetApp(): React.JSX.Element {
  const { settings } = useSettings()
  const { auth, signIn, isBusy } = useAuth()
  const mail = useMail()
  const { pulseKey, isPulsing } = useNewMailPulse()
  const now = useNow()
  const drag = useWidgetDrag()
  const prefersReducedMotion = useReducedMotion() ?? false

  const styles = sizeStyles(settings.widgetSize)
  const snapshot = mail.snapshot
  const clickTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (clickTimer.current !== null) window.clearTimeout(clickTimer.current)
    }
  }, [])

  const openNewest = useCallback(() => {
    if (snapshot.email) mail.openMessage(snapshot.email.id)
    else mail.openInbox()
  }, [mail, snapshot.email])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (drag.didDrag()) return
      if ((event.target as HTMLElement).closest('[data-no-drag]')) return
      if (clickTimer.current !== null) return

      // Hold the single-click action briefly so a double click can cancel it.
      clickTimer.current = window.setTimeout(() => {
        clickTimer.current = null
        openNewest()
      }, DOUBLE_CLICK_DELAY)
    },
    [drag, openNewest]
  )

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest('[data-no-drag]')) return
      if (clickTimer.current !== null) {
        window.clearTimeout(clickTimer.current)
        clickTimer.current = null
      }
      mail.openInbox()
    },
    [mail]
  )

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    api.widget.showContextMenu()
  }, [])

  const gutter = settings.blurEffect === 'none' ? WIDGET_SHADOW_PADDING : 0
  const contentKey = `${snapshot.status}:${snapshot.email?.id ?? 'none'}`

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 }

  return (
    <div className="h-full w-full" style={{ padding: gutter }}>
      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, x: 28, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={transition}
        onPointerDown={drag.onPointerDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title={snapshot.email ? 'Click to open · double-click for inbox' : undefined}
        className={cn(
          'sticker-surface relative flex h-full w-full flex-col overflow-hidden',
          styles.card
        )}
      >
        <WidgetHeader
          snapshot={snapshot}
          styles={styles}
          isRefreshing={snapshot.isFetching || mail.isRefreshing}
          onRefresh={mail.refresh}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={contentKey}
            initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <WidgetContent
              onOpenSettings={() => api.widget.openSettings()}
              onSignIn={() => void signIn()}
              isSigningIn={isBusy || auth.status === 'signing-in'}
              mail={mail}
              now={now}
              styles={styles}
              showPreview={settings.showBodyPreview}
              previewLineCount={settings.bodyPreviewLines}
            />
          </motion.div>
        </AnimatePresence>

        {/* New-mail flourish: a glowing ring plus a single sheen sweep. */}
        {isPulsing && !prefersReducedMotion && (
          <div key={pulseKey} className="pointer-events-none absolute inset-0 overflow-hidden">
            <span
              className={cn(
                'animate-sticker-glow absolute inset-0 rounded-[inherit]',
                'ring-2 ring-brand-400/70 shadow-[0_0_28px_4px] shadow-brand-500/45'
              )}
            />
            <span className="animate-sticker-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-transparent via-white/22 to-transparent" />
          </div>
        )}
      </motion.section>
    </div>
  )
}

interface WidgetContentProps {
  mail: ReturnType<typeof useMail>
  styles: ReturnType<typeof sizeStyles>
  now: number
  showPreview: boolean
  previewLineCount: number
  isSigningIn: boolean
  onSignIn: () => void
  onOpenSettings: () => void
}

function WidgetContent({
  mail,
  styles,
  now,
  showPreview,
  previewLineCount,
  isSigningIn,
  onSignIn,
  onOpenSettings
}: WidgetContentProps): React.JSX.Element {
  const { snapshot } = mail

  switch (snapshot.status) {
    case 'unconfigured':
      return <UnconfiguredState styles={styles} onOpenSettings={onOpenSettings} />

    case 'signed-out':
      return <SignInState styles={styles} onSignIn={onSignIn} isBusy={isSigningIn} />

    case 'error':
      return snapshot.error ? (
        <ErrorState
          styles={styles}
          error={snapshot.error}
          onRetry={mail.refresh}
          onSignIn={onSignIn}
          isRetrying={mail.isRefreshing}
        />
      ) : (
        <LoadingState styles={styles} />
      )

    case 'loading':
      return <LoadingState styles={styles} />

    case 'ready':
    default:
      return snapshot.email ? (
        <MailCard
          email={snapshot.email}
          styles={styles}
          showPreview={showPreview}
          previewLineCount={previewLineCount}
          now={now}
        />
      ) : (
        <EmptyState styles={styles} />
      )
  }
}
