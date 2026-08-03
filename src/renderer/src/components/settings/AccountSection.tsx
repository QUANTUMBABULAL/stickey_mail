import { CheckCircle2, LogIn, LogOut, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Section } from '@/components/ui/Section'
import { useAuth } from '@/context/AuthContext'

export function AccountSection(): React.JSX.Element {
  const { auth, credentials, isBusy, signIn, signOut } = useAuth()
  const signedIn = auth.status === 'signed-in'

  return (
    <Section
      title="Google account"
      icon={<UserRound size={14} strokeWidth={2.4} />}
      description={
        credentials.configured
          ? 'Mail Sticker reads only your inbox and can mark messages as read. Nothing leaves your machine.'
          : 'Add an OAuth client below before connecting an account.'
      }
    >
      <Field
        label={signedIn ? (auth.account?.email ?? 'Connected') : 'Not connected'}
        description={
          signedIn
            ? `Connected ${new Date(auth.account?.connectedAt ?? Date.now()).toLocaleDateString()}`
            : 'Sign in to start watching your inbox.'
        }
      >
        {signedIn ? (
          <>
            <CheckCircle2 size={16} strokeWidth={2.4} className="text-emerald-500" aria-hidden />
            <Button
              variant="danger"
              size="sm"
              loading={isBusy}
              icon={<LogOut size={12} strokeWidth={2.4} />}
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={!credentials.configured}
            loading={isBusy}
            icon={<LogIn size={12} strokeWidth={2.4} />}
            onClick={() => void signIn()}
          >
            Sign in with Google
          </Button>
        )}
      </Field>
    </Section>
  )
}
