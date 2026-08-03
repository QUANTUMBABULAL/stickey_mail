import type { MailStickerApi } from '@shared/types'

/**
 * Single access point to the preload bridge.
 *
 * Throws loudly rather than silently no-op'ing: if this is missing the preload
 * failed to load and nothing in the app can work.
 */
export function bridge(): MailStickerApi {
  const api = window.mailSticker
  if (!api) {
    throw new Error('Mail Sticker bridge unavailable — the preload script did not load.')
  }
  return api
}

export const api: MailStickerApi = new Proxy({} as MailStickerApi, {
  get(_target, property: keyof MailStickerApi) {
    return bridge()[property]
  }
})
