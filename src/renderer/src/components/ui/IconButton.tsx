import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  active?: boolean
}

/** Small ghost button used in the widget header and the settings title bar. */
export function IconButton({
  label,
  children,
  active = false,
  className,
  ...rest
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      data-no-drag
      title={label}
      aria-label={label}
      className={cn(
        'grid place-items-center rounded-md p-1 transition-colors duration-150',
        'text-ink-500 hover:text-ink-900 hover:bg-ink-900/8',
        'dark:text-ink-400 dark:hover:text-ink-50 dark:hover:bg-white/10',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'text-brand-600 dark:text-brand-300',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
