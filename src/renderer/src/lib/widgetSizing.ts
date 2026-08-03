import type { WidgetSize } from '@shared/types'

export interface WidgetSizeStyles {
  card: string
  header: string
  headerText: string
  body: string
  avatar: string
  avatarText: string
  sender: string
  subject: string
  preview: string
  meta: string
  icon: number
}

/**
 * Type scale per widget size. Written out in full so Tailwind's scanner sees
 * every class literally.
 */
export const WIDGET_SIZE_STYLES: Record<WidgetSize, WidgetSizeStyles> = {
  small: {
    card: 'rounded-xl',
    header: 'h-8 px-2.5',
    headerText: 'text-[10.5px]',
    body: 'px-2.5 pb-2.5 gap-2',
    avatar: 'size-7 rounded-lg',
    avatarText: 'text-[10px]',
    sender: 'text-[11.5px]',
    subject: 'text-[12px]',
    preview: 'text-[10.5px] leading-[1.45]',
    meta: 'text-[9.5px]',
    icon: 12
  },
  medium: {
    card: 'rounded-2xl',
    header: 'h-9 px-3',
    headerText: 'text-[11px]',
    body: 'px-3 pb-3 gap-2.5',
    avatar: 'size-9 rounded-xl',
    avatarText: 'text-[11px]',
    sender: 'text-[12.5px]',
    subject: 'text-[13px]',
    preview: 'text-[11.5px] leading-[1.5]',
    meta: 'text-[10px]',
    icon: 13
  },
  large: {
    card: 'rounded-2xl',
    header: 'h-10 px-3.5',
    headerText: 'text-[11.5px]',
    body: 'px-3.5 pb-3.5 gap-3',
    avatar: 'size-10 rounded-xl',
    avatarText: 'text-[12px]',
    sender: 'text-[13.5px]',
    subject: 'text-[14px]',
    preview: 'text-[12.5px] leading-[1.5]',
    meta: 'text-[11px]',
    icon: 15
  }
}

export function sizeStyles(size: WidgetSize): WidgetSizeStyles {
  return WIDGET_SIZE_STYLES[size]
}
