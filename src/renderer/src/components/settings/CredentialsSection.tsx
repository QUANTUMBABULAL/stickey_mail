import { useState } from 'react'
import { ExternalLink, KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Section } from '@/components/ui/Section'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/bridge'
import { cn } from '@/lib/cn'

const CONSOLE_URL = 'https://console.cloud.google.com/apis/credentials'

const inputClass = cn(
  'h-9 w-full rounded-lg border border-ink-900/10 bg-white px-2.5 text-[12.5px]',
  'text-ink-800 outline-none placeholder:text-ink-400',
  'focus:border-brand-500 dark:border-white/10 dark:bg-white/6 dark:text-ink-100'
)

export function CredentialsSection(): React.JSX.Element {
  const { credentials, isBusy, saveCredentials, clearCredentials } = useAuth()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const canSave = clientId.trim().length > 0 && !isBusy

  async function handleSave(): Promise<void> {
    await saveCredentials({ clientId, clientSecret })
    setClientId('')
    setClientSecret('')
    setIsEditing(false)
  }

  return (
    <Section
      title="Google API credentials"
      icon={<KeyRound size={14} strokeWidth={2.4} />}
      description="Create an OAuth client of type “Desktop app” with the Gmail API enabled. Values from a .env file take priority and are shown as read-only."
    >
      {credentials.configured && !isEditing ? (
        <Field
          label={credentials.source === 'env' ? 'Loaded from environment' : 'Stored on this device'}
          description={credentials.clientIdPreview ?? undefined}
        >
          <ShieldCheck size={16} strokeWidth={2.4} className="text-emerald-500" aria-hidden />
          {!credentials.readOnly && (
            <>
              <Button size="sm" onClick={() => setIsEditing(true)}>
                Replace
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 size={12} strokeWidth={2.4} />}
                loading={isBusy}
                onClick={() => void clearCredentials()}
              >
                Remove
              </Button>
            </>
          )}
        </Field>
      ) : (
        <>
          <Field
            label="Client ID"
            description="Ends with .apps.googleusercontent.com"
            stacked
          >
            <input
              className={inputClass}
              value={clientId}
              spellCheck={false}
              autoComplete="off"
              placeholder="1234567890-abcdef.apps.googleusercontent.com"
              onChange={(event) => setClientId(event.target.value)}
            />
          </Field>
          <Field
            label="Client secret"
            description="Stored encrypted with Windows DPAPI. Required for desktop OAuth clients."
            stacked
          >
            <input
              className={inputClass}
              value={clientSecret}
              type="password"
              spellCheck={false}
              autoComplete="off"
              placeholder="GOCSPX-…"
              onChange={(event) => setClientSecret(event.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between gap-2 px-3.5 py-3">
            <Button
              size="sm"
              variant="ghost"
              icon={<ExternalLink size={12} strokeWidth={2.4} />}
              onClick={() => void api.app.openExternal(CONSOLE_URL)}
            >
              Google Cloud console
            </Button>
            <div className="flex items-center gap-2">
              {credentials.configured && (
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                disabled={!canSave}
                loading={isBusy}
                onClick={() => void handleSave()}
              >
                Save credentials
              </Button>
            </div>
          </div>
        </>
      )}
    </Section>
  )
}
