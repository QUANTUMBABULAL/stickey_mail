import type { EmailSender } from '@shared/types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit'
})

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric'
})

/** Compact "time since" label, sized for a very small widget. */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const delta = now - timestamp

  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
  if (delta < 0) return 'now'
  if (delta < MINUTE) return 'now'
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`
  if (delta < 2 * DAY) return 'yesterday'
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`
  return dateFormatter.format(new Date(timestamp))
}

/** Full timestamp for tooltips. */
export function formatExactTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
  const date = new Date(timestamp)
  const isToday = new Date().toDateString() === date.toDateString()
  return isToday
    ? timeFormatter.format(date)
    : `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`
}

export function senderInitials(sender: EmailSender): string {
  const source = sender.name?.trim() || sender.email?.trim() || '?'
  const words = source
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-fuchsia-500 to-purple-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-emerald-600'
] as const

/** Deterministic avatar colour so the same sender always looks the same. */
export function avatarGradient(sender: EmailSender): string {
  const seed = sender.email || sender.name || ''
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

export function formatUnreadLabel(count: number): string {
  if (count <= 0) return 'No unread'
  if (count === 1) return '1 unread'
  if (count > 99) return '99+ unread'
  return `${count} unread`
}

/** Trims a preview to the number of visual lines the widget is set to show. */
export function previewLines(preview: string, maxLines: number): string {
  return preview
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(0, maxLines)
    .join(' ')
}
