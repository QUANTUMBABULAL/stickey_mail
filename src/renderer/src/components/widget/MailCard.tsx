import { Paperclip, Star } from 'lucide-react'
import type { EmailPreview } from '@shared/types'
import { Avatar } from './Avatar'
import { cn } from '@/lib/cn'
import { formatExactTime, formatRelativeTime, previewLines } from '@/lib/format'
import type { WidgetSizeStyles } from '@/lib/widgetSizing'

interface MailCardProps {
  email: EmailPreview
  styles: WidgetSizeStyles
  showPreview: boolean
  previewLineCount: number
  now: number
}

/** The newest unread message: sender, subject, opening lines, time. */
export function MailCard({
  email,
  styles,
  showPreview,
  previewLineCount,
  now
}: MailCardProps): React.JSX.Element {
  const body = previewLines(email.preview, previewLineCount)

  return (
    // `my-auto` centres the row in the leftover space, so a one-line preview
    // and a three-line preview both sit balanced in the card.
    <div className={cn('my-auto flex min-h-0 items-start', styles.body)}>
      <Avatar sender={email.sender} sizeClass={styles.avatar} textClass={styles.avatarText} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate font-semibold text-ink-900 dark:text-ink-50',
              styles.sender
            )}
            title={email.sender.email || email.sender.name}
          >
            {email.sender.name || email.sender.email}
          </span>
          <time
            className={cn('shrink-0 tabular-nums text-ink-400 dark:text-ink-500', styles.meta)}
            title={formatExactTime(email.receivedAt)}
            dateTime={new Date(email.receivedAt).toISOString()}
          >
            {formatRelativeTime(email.receivedAt, now)}
          </time>
        </div>

        <div className="flex items-center gap-1.5">
          {email.unread && (
            <span
              aria-label="Unread"
              className="size-1.5 shrink-0 rounded-full bg-brand-500 shadow-[0_0_0_3px] shadow-brand-500/20"
            />
          )}
          <span
            className={cn(
              'min-w-0 flex-1 truncate font-medium text-ink-800 dark:text-ink-100',
              styles.subject
            )}
            title={email.subject}
          >
            {email.subject}
          </span>
          {email.isImportant && (
            <Star
              size={styles.icon - 1}
              strokeWidth={2.4}
              className="shrink-0 text-amber-500"
              aria-label="Important"
            />
          )}
          {email.hasAttachments && (
            <Paperclip
              size={styles.icon - 1}
              strokeWidth={2.2}
              className="shrink-0 text-ink-400 dark:text-ink-500"
              aria-label="Has attachments"
            />
          )}
        </div>

        {showPreview && body.length > 0 && (
          <p
            className={cn(
              'text-ink-500 dark:text-ink-400',
              previewLineCount === 2 ? 'line-clamp-2' : 'line-clamp-3',
              styles.preview
            )}
          >
            {body}
          </p>
        )}
      </div>
    </div>
  )
}
