import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last line of defence for the renderer. A crashed widget that silently shows
 * nothing is worse than one that says what went wrong and offers a reload.
 */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the main-process log through electron-log's console hook.
    console.error('Renderer crashed:', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="sticker-surface w-full rounded-2xl p-4 text-center">
          <p className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">
            Something went wrong
          </p>
          <p className="mt-1 line-clamp-3 text-[11px] text-ink-500 dark:text-ink-400">
            {error.message}
          </p>
          <button
            type="button"
            data-no-drag
            onClick={() => window.location.reload()}
            className="mt-3 h-7 rounded-lg bg-brand-600 px-3 text-[11.5px] font-medium text-white hover:bg-brand-500"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
