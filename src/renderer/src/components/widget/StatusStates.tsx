import { AlertTriangle, CheckCircle2, KeyRound, LogIn } from 'lucide-react'
import type { AppError } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import type { WidgetSizeStyles } from '@/lib/widgetSizing'

interface StateProps {
  styles: WidgetSizeStyles
}

function StateShell({
  styles,
  children
}: StateProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center text-center',
        styles.body
      )}
    >
      {children}
    </div>
  )
}

/** Inbox has no unread mail. */
export function EmptyState({ styles }: StateProps): React.JSX.Element {
  return (
    <StateShell styles={styles}>
      <CheckCircle2
        size={styles.icon + 9}
        strokeWidth={2}
        className="mb-1.5 text-emerald-500"
        aria-hidden
      />
      <p className={cn('font-semibold text-ink-800 dark:text-ink-100', styles.subject)}>
        You&rsquo;re all caught up.
      </p>
      <p className={cn('mt-0.5 text-ink-400 dark:text-ink-500', styles.meta)}>
        Nothing unread in your inbox.
      </p>
    </StateShell>
  )
}

export function LoadingState({ styles }: StateProps): React.JSX.Element {
  return (
    <StateShell styles={styles}>
      <Spinner size={styles.icon + 6} className="mb-2 text-brand-500" />
      <p className={cn('text-ink-500 dark:text-ink-400', styles.meta)}>Checking your inbox…</p>
    </StateShell>
  )
}

interface SignInStateProps extends StateProps {
  onSignIn: () => void
  isBusy: boolean
}

export function SignInState({ styles, onSignIn, isBusy }: SignInStateProps): React.JSX.Element {
  return (
    <StateShell styles={styles}>
      <p className={cn('font-semibold text-ink-800 dark:text-ink-100', styles.subject)}>
        Connect your Gmail
      </p>
      <p className={cn('mt-0.5 mb-2.5 text-ink-400 dark:text-ink-500', styles.meta)}>
        {isBusy ? 'Finish signing in in your browser…' : 'Sign in to see your newest unread email.'}
      </p>
      <Button
        variant="primary"
        size="sm"
        loading={isBusy}
        icon={<LogIn size={12} strokeWidth={2.4} />}
        onClick={onSignIn}
      >
        Sign in with Google
      </Button>
    </StateShell>
  )
}

interface UnconfiguredStateProps extends StateProps {
  onOpenSettings: () => void
}

export function UnconfiguredState({
  styles,
  onOpenSettings
}: UnconfiguredStateProps): React.JSX.Element {
  return (
    <StateShell styles={styles}>
      <KeyRound
        size={styles.icon + 8}
        strokeWidth={2}
        className="mb-1.5 text-amber-500"
        aria-hidden
      />
      <p className={cn('font-semibold text-ink-800 dark:text-ink-100', styles.subject)}>
        Setup needed
      </p>
      <p className={cn('mt-0.5 mb-2.5 text-ink-400 dark:text-ink-500', styles.meta)}>
        Add a Google OAuth client to get started.
      </p>
      <Button variant="secondary" size="sm" onClick={onOpenSettings}>
        Open settings
      </Button>
    </StateShell>
  )
}

interface ErrorStateProps extends StateProps {
  error: AppError
  onRetry: () => void
  onSignIn: () => void
  isRetrying: boolean
}

export function ErrorState({
  styles,
  error,
  onRetry,
  onSignIn,
  isRetrying
}: ErrorStateProps): React.JSX.Element {
  const needsSignIn = error.code === 'auth-expired' || error.code === 'not-signed-in'

  return (
    <StateShell styles={styles}>
      <AlertTriangle
        size={styles.icon + 7}
        strokeWidth={2}
        className="mb-1.5 text-amber-500"
        aria-hidden
      />
      <p
        className={cn('line-clamp-2 px-1 text-ink-600 dark:text-ink-300', styles.meta)}
        title={error.message}
      >
        {error.message}
      </p>
      <Button
        variant="secondary"
        size="sm"
        className="mt-2"
        loading={isRetrying}
        onClick={needsSignIn ? onSignIn : onRetry}
      >
        {needsSignIn ? 'Sign in again' : 'Try again'}
      </Button>
    </StateShell>
  )
}
