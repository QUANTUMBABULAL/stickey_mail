import { useQuery } from '@tanstack/react-query'
import { FileText, Info, Power, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Section } from '@/components/ui/Section'
import { useSettings } from '@/context/SettingsContext'
import { api } from '@/lib/bridge'
import { queryKeys } from '@/lib/queryClient'

export function AboutSection(): React.JSX.Element {
  const { resetSettings } = useSettings()
  const { data: info } = useQuery({
    queryKey: queryKeys.appInfo,
    queryFn: () => api.app.getInfo()
  })

  return (
    <Section title="About" icon={<Info size={14} strokeWidth={2.4} />}>
      <Field
        label={`Mail Sticker ${info?.version ?? ''}`.trim()}
        description={
          info
            ? `Electron ${info.electron} · Chromium ${info.chrome} · Node ${info.node}`
            : 'Loading build information…'
        }
      >
        <Button
          size="sm"
          variant="ghost"
          icon={<FileText size={12} strokeWidth={2.4} />}
          onClick={() => void api.app.openLogFolder()}
        >
          Logs
        </Button>
      </Field>

      <Field label="Reset preferences" description="Restores every setting to its default.">
        <Button
          size="sm"
          icon={<RotateCcw size={12} strokeWidth={2.4} />}
          onClick={() => void resetSettings()}
        >
          Reset
        </Button>
      </Field>

      <Field label="Quit Mail Sticker" description="Closes the widget and the tray icon.">
        <Button
          size="sm"
          variant="danger"
          icon={<Power size={12} strokeWidth={2.4} />}
          onClick={() => api.app.quit()}
        >
          Quit
        </Button>
      </Field>
    </Section>
  )
}
