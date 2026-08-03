/// <reference types="vite/client" />

import type { MailStickerApi } from '@shared/types'

declare global {
  interface Window {
    /** Injected by the preload script (see `src/preload/index.ts`). */
    mailSticker: MailStickerApi
  }
}

export {}
