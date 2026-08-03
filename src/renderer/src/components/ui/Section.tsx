import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SectionProps {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({
  title,
  description,
  icon,
  children,
  className
}: SectionProps): React.JSX.Element {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2 px-1">
        {icon && <span className="text-brand-500 dark:text-brand-400">{icon}</span>}
        <h2 className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase dark:text-ink-400">
          {title}
        </h2>
      </div>
      {description && (
        <p className="px-1 text-[12px] leading-relaxed text-ink-500 dark:text-ink-400">
          {description}
        </p>
      )}
      <div
        className={cn(
          'divide-y divide-ink-900/6 overflow-hidden rounded-2xl border border-ink-900/8 bg-white',
          'dark:divide-white/6 dark:border-white/8 dark:bg-white/4'
        )}
      >
        {children}
      </div>
    </section>
  )
}

interface FieldProps {
  label: string
  description?: string
  children: ReactNode
  /** Stack the control under the label instead of beside it. */
  stacked?: boolean
}

export function Field({
  label,
  description,
  children,
  stacked = false
}: FieldProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex gap-3 px-3.5 py-3',
        stacked ? 'flex-col items-stretch' : 'flex-row items-center justify-between'
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-medium text-ink-800 dark:text-ink-100">{label}</span>
        {description && (
          <span className="text-[11.5px] leading-snug text-ink-500 dark:text-ink-400">
            {description}
          </span>
        )}
      </div>
      <div className={cn('flex shrink-0 items-center gap-2', stacked && 'w-full')}>{children}</div>
    </div>
  )
}
