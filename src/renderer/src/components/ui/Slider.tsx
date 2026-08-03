import { cn } from '@/lib/cn'

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  label: string
  onChange: (value: number) => void
  className?: string
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  label,
  onChange,
  className
}: SliderProps): React.JSX.Element {
  const percent = ((value - min) / (max - min)) * 100

  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{
        background: `linear-gradient(to right, var(--color-brand-500) ${percent}%, transparent ${percent}%)`
      }}
      className={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-900/12 dark:bg-white/15',
        '[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none',
        '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
        '[&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(15,23,42,0.4)]',
        '[&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-brand-500',
        className
      )}
    />
  )
}
