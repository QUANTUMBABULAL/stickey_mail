import { Settings2 } from 'lucide-react'
import { POLL_INTERVAL_OPTIONS } from '@shared/settings'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { Field, Section } from '@/components/ui/Section'
import { useSettings } from '@/context/SettingsContext'

function intervalLabel(seconds: number): string {
  if (seconds < 60) return `Every ${seconds} seconds`
  const minutes = Math.round(seconds / 60)
  return `Every ${minutes} minute${minutes === 1 ? '' : 's'}`
}

const INTERVAL_OPTIONS = POLL_INTERVAL_OPTIONS.map((seconds) => ({
  value: seconds,
  label: intervalLabel(seconds)
}))

export function BehaviorSection(): React.JSX.Element {
  const { settings, updateSettings } = useSettings()

  return (
    <Section title="Behaviour" icon={<Settings2 size={14} strokeWidth={2.4} />}>
      <Field
        label="Check for mail"
        description="Gmail is polled on this cadence; new mail appears as soon as the next check runs."
      >
        <Select
          label="Update interval"
          className="w-[160px]"
          value={settings.pollIntervalSeconds}
          options={INTERVAL_OPTIONS}
          onChange={(pollIntervalSeconds) => void updateSettings({ pollIntervalSeconds })}
        />
      </Field>

      <Field label="Always on top" description="Keep the sticker above every other window.">
        <Toggle
          label="Always on top"
          checked={settings.alwaysOnTop}
          onChange={(alwaysOnTop) => void updateSettings({ alwaysOnTop })}
        />
      </Field>

      <Field
        label="Hide from Alt+Tab"
        description="Keeps the sticker out of the window switcher. Restarts the widget window."
      >
        <Toggle
          label="Hide from Alt+Tab"
          checked={settings.hideFromAltTab}
          onChange={(hideFromAltTab) => void updateSettings({ hideFromAltTab })}
        />
      </Field>

      <Field label="Desktop notifications" description="Show a Windows toast when mail arrives.">
        <Toggle
          label="Desktop notifications"
          checked={settings.showNotifications}
          onChange={(showNotifications) => void updateSettings({ showNotifications })}
        />
      </Field>

      <Field label="Start with Windows" description="Launch Mail Sticker when you sign in.">
        <Toggle
          label="Start with Windows"
          checked={settings.launchAtLogin}
          onChange={(launchAtLogin) => void updateSettings({ launchAtLogin })}
        />
      </Field>

      <Field label="Show widget" description="Hide the sticker without quitting the app.">
        <Toggle
          label="Show widget"
          checked={settings.widgetVisible}
          onChange={(widgetVisible) => void updateSettings({ widgetVisible })}
        />
      </Field>
    </Section>
  )
}
