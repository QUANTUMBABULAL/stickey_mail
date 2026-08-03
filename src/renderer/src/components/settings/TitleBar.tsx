import { Minus, X } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { api } from '@/lib/bridge'

/** Custom title bar — the settings window is frameless like the widget. */
export function TitleBar(): React.JSX.Element {
  return (
    <header className="drag-region flex h-11 shrink-0 items-center gap-2 border-b border-ink-900/8 px-3 dark:border-white/8">
      <span className="grid size-6 place-items-center rounded-lg bg-linear-to-br from-brand-500 to-accent-500 text-[11px] font-bold text-white shadow-sm">
        M
      </span>
      <h1 className="flex-1 text-[13px] font-semibold text-ink-800 dark:text-ink-50">
        Mail Sticker Settings
      </h1>
      <IconButton label="Minimize" onClick={() => api.window.minimizeSettings()}>
        <Minus size={15} strokeWidth={2.2} />
      </IconButton>
      <IconButton
        label="Close"
        className="hover:bg-rose-500/90! hover:text-white!"
        onClick={() => api.window.closeSettings()}
      >
        <X size={15} strokeWidth={2.2} />
      </IconButton>
    </header>
  )
}
