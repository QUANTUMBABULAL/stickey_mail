import { cn } from '@/lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors duration-200',
        'disabled:pointer-events-none disabled:opacity-50',
        checked ? 'bg-brand-600' : 'bg-ink-900/15 dark:bg-white/15'
      )}
    >
      <span
        className={cn(
          'inline-block size-[16px] rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
        )}
      />
    </button>
  )
}
