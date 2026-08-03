import type { EmailSender } from '@shared/types'
import { avatarGradient, senderInitials } from '@/lib/format'
import { cn } from '@/lib/cn'

interface AvatarProps {
  sender: EmailSender
  sizeClass: string
  textClass: string
}

/**
 * Initials avatar with a deterministic gradient. Remote profile images are
 * intentionally not fetched — the renderer makes no network requests at all.
 */
export function Avatar({ sender, sizeClass, textClass }: AvatarProps): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-linear-to-br font-semibold text-white',
        'shadow-sm ring-1 ring-white/15',
        avatarGradient(sender),
        sizeClass,
        textClass
      )}
    >
      {senderInitials(sender)}
    </div>
  )
}
