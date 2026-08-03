import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectOption<T extends string | number> {
  value: T
  label: string
}

interface SelectProps<T extends string | number> {
  value: T
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className
}: SelectProps<T>): React.JSX.Element {
  const isNumeric = typeof value === 'number'

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <select
        aria-label={label}
        value={String(value)}
        onChange={(event) =>
          onChange((isNumeric ? Number(event.target.value) : event.target.value) as T)
        }
        className={cn(
          'h-8 w-full cursor-pointer appearance-none rounded-lg border border-ink-900/10 bg-white',
          'py-0 pr-7 pl-2.5 text-[12.5px] font-medium text-ink-800 outline-none',
          'hover:border-ink-900/20 focus:border-brand-500',
          'dark:border-white/10 dark:bg-white/6 dark:text-ink-100 dark:hover:border-white/20'
        )}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={2.2}
        aria-hidden
        className="pointer-events-none absolute right-2 text-ink-400 dark:text-ink-500"
      />
    </div>
  )
}
