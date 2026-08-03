import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentOption<T extends string | number> {
  value: T
  label: string
  icon?: ReactNode
  title?: string
}

interface SegmentedControlProps<T extends string | number> {
  value: T
  options: readonly SegmentOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl bg-ink-900/6 p-0.5 dark:bg-white/8',
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-7 items-center justify-center gap-1.5 rounded-[10px] px-2.5',
              'text-[12px] font-medium transition-colors duration-150',
              selected
                ? 'bg-white text-ink-900 shadow-sm dark:bg-white/16 dark:text-white'
                : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100'
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
