import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: number
  className?: string
}

export function Spinner({ size = 14, className }: SpinnerProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn('animate-spin', className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
