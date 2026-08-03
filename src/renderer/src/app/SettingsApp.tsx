import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, X } from 'lucide-react'
import { AboutSection } from '@/components/settings/AboutSection'
import { AccountSection } from '@/components/settings/AccountSection'
import { AppearanceSection } from '@/components/settings/AppearanceSection'
import { BehaviorSection } from '@/components/settings/BehaviorSection'
import { CredentialsSection } from '@/components/settings/CredentialsSection'
import { TitleBar } from '@/components/settings/TitleBar'
import { IconButton } from '@/components/ui/IconButton'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'

export function SettingsApp(): React.JSX.Element {
  const { isReady } = useSettings()
  const { error, dismissError } = useAuth()

  return (
    <div className="settings-surface flex h-full w-full flex-col">
      <TitleBar />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <AlertCircle
                size={15}
                strokeWidth={2.4}
                className="mt-px shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              <p className="flex-1 text-[12px] leading-snug text-amber-800 dark:text-amber-200">
                {error}
              </p>
              <IconButton label="Dismiss" onClick={dismissError}>
                <X size={13} strokeWidth={2.4} />
              </IconButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3 pb-6">
        {isReady ? (
          <>
            <AccountSection />
            <CredentialsSection />
            <AppearanceSection />
            <BehaviorSection />
            <AboutSection />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[12.5px] text-ink-500">
            Loading settings…
          </div>
        )}
      </main>
    </div>
  )
}
