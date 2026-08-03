import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 shadow-sm shadow-brand-600/25',
  secondary:
    'bg-ink-900/6 text-ink-800 hover:bg-ink-900/10 dark:bg-white/8 dark:text-ink-50 dark:hover:bg-white/14',
  ghost:
    'text-ink-600 hover:bg-ink-900/6 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/10 dark:hover:text-white',
  danger:
    'bg-rose-600/10 text-rose-600 hover:bg-rose-600/18 dark:text-rose-300 dark:bg-rose-500/12 dark:hover:bg-rose-500/22'
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[11.5px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-xl'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      data-no-drag
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 12 : 14} /> : icon}
      {children}
    </button>
  )
}
