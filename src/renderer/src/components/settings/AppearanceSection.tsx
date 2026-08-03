import {
  AlignEndHorizontal,
  Monitor,
  Moon,
  Palette,
  Sun
} from 'lucide-react'
import { MAX_OPACITY, MIN_OPACITY } from '@shared/settings'
import type { BlurEffect, CornerPosition, ThemeMode, WidgetSize } from '@shared/types'
import { SegmentedControl, type SegmentOption } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Slider } from '@/components/ui/Slider'
import { Toggle } from '@/components/ui/Toggle'
import { Field, Section } from '@/components/ui/Section'
import { useSettings } from '@/context/SettingsContext'

const THEME_OPTIONS: readonly SegmentOption<ThemeMode>[] = [
  { value: 'system', label: 'Auto', icon: <Monitor size={13} strokeWidth={2.2} /> },
  { value: 'light', label: 'Light', icon: <Sun size={13} strokeWidth={2.2} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={13} strokeWidth={2.2} /> }
]

const SIZE_OPTIONS: readonly SegmentOption<WidgetSize>[] = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' }
]

const CORNER_OPTIONS: readonly { value: CornerPosition; label: string }[] = [
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'custom', label: 'Where I left it' }
]

const BLUR_OPTIONS: readonly { value: BlurEffect; label: string }[] = [
  { value: 'none', label: 'Transparent glass' },
  { value: 'acrylic', label: 'Acrylic (Windows 11)' },
  { value: 'mica', label: 'Mica (Windows 11)' }
]

const PREVIEW_LINE_OPTIONS = [
  { value: 2, label: '2 lines' },
  { value: 3, label: '3 lines' }
] as const

export function AppearanceSection(): React.JSX.Element {
  const { settings, updateSettings } = useSettings()

  return (
    <Section title="Appearance" icon={<Palette size={14} strokeWidth={2.4} />}>
      <Field label="Theme" description="Auto follows your Windows colour mode.">
        <SegmentedControl
          label="Theme"
          value={settings.theme}
          options={THEME_OPTIONS}
          onChange={(theme) => void updateSettings({ theme })}
        />
      </Field>

      <Field label="Widget size">
        <SegmentedControl
          label="Widget size"
          value={settings.widgetSize}
          options={SIZE_OPTIONS}
          onChange={(widgetSize) => void updateSettings({ widgetSize })}
        />
      </Field>

      <Field label="Opacity" description={`${Math.round(settings.opacity * 100)}%`} stacked>
        <Slider
          label="Opacity"
          min={MIN_OPACITY}
          max={MAX_OPACITY}
          step={0.05}
          value={settings.opacity}
          onChange={(opacity) => void updateSettings({ opacity })}
        />
      </Field>

      <Field
        label="Corner"
        description="Where the sticker parks itself on the primary monitor."
      >
        <Select
          label="Corner"
          className="w-[150px]"
          value={settings.corner}
          options={CORNER_OPTIONS}
          onChange={(corner) => void updateSettings({ corner })}
        />
      </Field>

      <Field
        label="Background"
        description="Acrylic and Mica blur the actual desktop, but need Windows 11."
      >
        <Select
          label="Background"
          className="w-[180px]"
          value={settings.blurEffect}
          options={BLUR_OPTIONS}
          onChange={(blurEffect) => void updateSettings({ blurEffect })}
        />
      </Field>

      <Field
        label="Body preview"
        description="Show the opening lines of the email under the subject."
      >
        <Toggle
          label="Body preview"
          checked={settings.showBodyPreview}
          onChange={(showBodyPreview) => void updateSettings({ showBodyPreview })}
        />
      </Field>

      <Field label="Preview length" description="How many lines of body text to show.">
        <SegmentedControl
          label="Preview length"
          value={settings.bodyPreviewLines}
          options={PREVIEW_LINE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            icon: <AlignEndHorizontal size={12} strokeWidth={2.2} />
          }))}
          onChange={(bodyPreviewLines) => void updateSettings({ bodyPreviewLines })}
        />
      </Field>
    </Section>
  )
}
