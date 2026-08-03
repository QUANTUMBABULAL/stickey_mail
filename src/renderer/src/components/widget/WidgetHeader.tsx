import { EyeOff, Mail, RefreshCw, Settings } from 'lucide-react'
import type { MailSnapshot } from '@shared/types'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/cn'
import { formatUnreadLabel } from '@/lib/format'
import type { WidgetSizeStyles } from '@/lib/widgetSizing'
import { api } from '@/lib/bridge'

interface WidgetHeaderProps {
  snapshot: MailSnapshot
  styles: WidgetSizeStyles
  isRefreshing: boolean
  onRefresh: () => void
}

export function WidgetHeader({
  snapshot,
  styles,
  isRefreshing,
  onRefresh
}: WidgetHeaderProps): React.JSX.Element {
  const hasUnread = snapshot.unreadCount > 0
  const signedIn = snapshot.status === 'ready' || snapshot.status === 'error'

  return (
    <header
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-ink-900/6 dark:border-white/8',
        styles.header
      )}
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-md',
          hasUnread
            ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
            : 'bg-ink-900/6 text-ink-500 dark:bg-white/8 dark:text-ink-400'
        )}
      >
        <Mail size={styles.icon} strokeWidth={2.2} />
      </span>

      <div className={cn('flex min-w-0 flex-1 items-center gap-1.5', styles.headerText)}>
        <span className="truncate font-semibold tracking-tight text-ink-800 dark:text-ink-50">
          Mail Sticker
        </span>
        {signedIn && (
          <>
            <span className="text-ink-400 dark:text-ink-500">·</span>
            <span
              className={cn(
                'truncate font-medium',
                hasUnread ? 'text-brand-600 dark:text-brand-300' : 'text-ink-500 dark:text-ink-400'
              )}
            >
              {formatUnreadLabel(snapshot.unreadCount)}
            </span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton
          label="Refresh"
          disabled={!signedIn || isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            size={styles.icon}
            strokeWidth={2.2}
            className={cn(isRefreshing && 'animate-spin')}
          />
        </IconButton>
        <IconButton label="Settings" onClick={() => api.widget.openSettings()}>
          <Settings size={styles.icon} strokeWidth={2.2} />
        </IconButton>
        <IconButton label="Hide widget" onClick={() => api.widget.hide()}>
          <EyeOff size={styles.icon} strokeWidth={2.2} />
        </IconButton>
      </div>
    </header>
  )
}
