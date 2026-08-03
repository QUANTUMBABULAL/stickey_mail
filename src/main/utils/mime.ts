import type { gmail_v1 } from '@googleapis/gmail'
import { PREVIEW_MAX_CHARS } from '@shared/constants'
import type { EmailSender } from '@shared/types'

type MessagePart = gmail_v1.Schema$MessagePart

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  deg: '°'
}

export function decodeBase64Url(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1] === 'x' || entity[1] === 'X'
      const code = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10)
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code)
        } catch {
          return match
        }
      }
      return match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** Very small HTML-to-text pass, enough for a 3-line preview. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|head|noscript)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ' ')
  )
}

function headerValue(part: MessagePart | undefined, name: string): string {
  const header = part?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())
  return header?.value ?? ''
}

function decodeWithCharset(buffer: Buffer, contentType: string): string {
  const match = /charset="?([\w-]+)"?/i.exec(contentType)
  const charset = (match?.[1] ?? 'utf-8').toLowerCase()
  if (charset === 'utf-8' || charset === 'utf8' || charset === 'us-ascii' || charset === 'ascii') {
    return buffer.toString('utf8')
  }
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buffer)
  } catch {
    return buffer.toString('utf8')
  }
}

interface FoundPart {
  text: string
  isHtml: boolean
}

/**
 * Depth-first search for renderable body content. text/plain always wins over
 * text/html; attachments and inline images are skipped.
 */
function findBody(part: MessagePart | undefined, depth = 0): FoundPart | null {
  if (!part || depth > 12) return null

  const mimeType = (part.mimeType ?? '').toLowerCase()
  const isAttachment = Boolean(part.filename)

  if (!isAttachment && part.body?.data && (mimeType === 'text/plain' || mimeType === 'text/html')) {
    const buffer = decodeBase64Url(part.body.data)
    return {
      text: decodeWithCharset(buffer, headerValue(part, 'Content-Type') || mimeType),
      isHtml: mimeType === 'text/html'
    }
  }

  if (!part.parts?.length) return null

  let htmlFallback: FoundPart | null = null
  for (const child of part.parts) {
    const found = findBody(child, depth + 1)
    if (!found) continue
    if (!found.isHtml) return found
    htmlFallback ??= found
  }
  return htmlFallback
}

/** Collapses whitespace, drops quoted replies and trims to a preview length. */
export function normalizePreview(raw: string, maxChars = PREVIEW_MAX_CHARS): string {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    // Drop quoted history, signature separators and tracking-pixel leftovers.
    .filter((line) => line.length > 0 && !/^(>|--\s*$|_{4,}|-{4,}|\|)/.test(line))

  const text = lines.join('\n').trim()
  if (text.length <= maxChars) return text
  const cut = text.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Best available plain-text preview for a message. */
export function extractPreview(message: gmail_v1.Schema$Message): string {
  const found = findBody(message.payload ?? undefined)
  if (found) {
    const text = normalizePreview(found.isHtml ? htmlToText(found.text) : found.text)
    if (text) return text
  }
  return normalizePreview(decodeEntities(message.snippet ?? ''))
}

/** Parses `"Jane Cooper" <jane@acme.com>` into its parts. */
export function parseSender(value: string): EmailSender {
  const raw = (value ?? '').trim()
  if (!raw) return { name: 'Unknown sender', email: '' }

  const angled = /^(.*?)<([^>]+)>\s*$/.exec(raw)
  if (angled) {
    const email = angled[2].trim()
    const name = decodeEntities(stripQuotes(angled[1].trim()))
    return { name: name || email.split('@')[0] || email, email }
  }

  if (raw.includes('@')) {
    const email = stripQuotes(raw)
    return { name: email.split('@')[0] || email, email }
  }

  return { name: stripQuotes(raw), email: '' }
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '').trim()
}

export function getHeader(message: gmail_v1.Schema$Message, name: string): string {
  return headerValue(message.payload ?? undefined, name)
}

export function hasAttachments(part: MessagePart | undefined, depth = 0): boolean {
  if (!part || depth > 12) return false
  if (part.filename && part.body?.attachmentId) {
    const disposition = headerValue(part, 'Content-Disposition').toLowerCase()
    if (!disposition.startsWith('inline')) return true
  }
  return (part.parts ?? []).some((child) => hasAttachments(child, depth + 1))
}

/** Prefers the RFC 2822 Date header, falling back to Gmail's internalDate. */
export function resolveReceivedAt(message: gmail_v1.Schema$Message): number {
  const internal = Number.parseInt(message.internalDate ?? '', 10)
  if (Number.isFinite(internal) && internal > 0) return internal

  const parsed = Date.parse(getHeader(message, 'Date'))
  return Number.isFinite(parsed) ? parsed : Date.now()
}
