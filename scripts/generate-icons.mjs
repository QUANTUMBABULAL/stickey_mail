/**
 * Generates every icon the app and the installer need, with no image
 * dependencies: shapes are rasterised into RGBA buffers here, encoded as PNG
 * with zlib, and packed into a Windows .ico.
 *
 * Outputs
 *   resources/icon.png        256px  – window + notification icon
 *   resources/tray.png         32px  – tray, idle
 *   resources/tray-unread.png  32px  – tray, unread badge
 *   build/icon.png            512px  – electron-builder fallback source
 *   build/icon.ico                   – NSIS installer + exe icon
 *
 * Run with `npm run icons` (also wired to postinstall).
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* -------------------------------------------------------------------------- */
/*                              Tiny raster engine                            */
/* -------------------------------------------------------------------------- */

const SUPERSAMPLE = 4

/** Signed distance from a point to a rounded rectangle. Negative = inside. */
function sdRoundedRect(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius)
  const qy = Math.abs(py - cy) - (halfH - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - radius
}

/** Signed distance from a point to a line segment. */
function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const lengthSq = abx * abx + aby * aby || 1
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lengthSq))
  return Math.hypot(apx - abx * t, apy - aby * t)
}

function mix(a, b, t) {
  return a + (b - a) * t
}

function blend(target, index, r, g, b, alpha) {
  if (alpha <= 0) return
  const inverse = 1 - alpha
  target[index] = Math.round(r * alpha + target[index] * inverse)
  target[index + 1] = Math.round(g * alpha + target[index + 1] * inverse)
  target[index + 2] = Math.round(b * alpha + target[index + 2] * inverse)
  target[index + 3] = Math.round(255 * alpha + target[index + 3] * inverse)
}

/**
 * Renders the Mail Sticker mark: a rounded indigo→violet tile with a white
 * envelope, optionally badged with a red dot for unread mail.
 */
function renderIcon(size, { badge = false, padding = 0 } = {}) {
  const pixels = Buffer.alloc(size * size * 4, 0)
  const step = 1 / SUPERSAMPLE
  const offset = step / 2

  const box = size - padding * 2
  const cx = size / 2
  const cy = size / 2
  const half = box / 2
  const tileRadius = box * 0.24

  // Envelope geometry, relative to the tile.
  const envW = box * 0.58
  const envH = box * 0.42
  const envRadius = box * 0.06
  const envHalfW = envW / 2
  const envHalfH = envH / 2
  const stroke = Math.max(size * 0.028, 1.15)

  const badgeR = badge ? box * 0.19 : 0
  const badgeCx = cx + half - badgeR * 0.95
  const badgeCy = cy - half + badgeR * 0.95

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let tileA = 0
      let envA = 0
      let flapA = 0
      let badgeA = 0
      let gradientSum = 0

      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const px = x + sx * step + offset
          const py = y + sy * step + offset

          if (sdRoundedRect(px, py, cx, cy, half, half, tileRadius) <= 0) {
            tileA += 1
            gradientSum += (px + py) / (size * 2)
          }

          // Envelope outline (a rounded rect ring).
          const dEnv = sdRoundedRect(px, py, cx, cy, envHalfW, envHalfH, envRadius)
          if (Math.abs(dEnv) <= stroke * 0.62) envA += 1

          // The flap: two segments from the top corners to the centre.
          if (dEnv <= 0) {
            const topLeftX = cx - envHalfW + envRadius * 0.35
            const topRightX = cx + envHalfW - envRadius * 0.35
            const topY = cy - envHalfH + envRadius * 0.35
            const apexY = cy + envHalfH * 0.22
            const dFlap = Math.min(
              sdSegment(px, py, topLeftX, topY, cx, apexY),
              sdSegment(px, py, topRightX, topY, cx, apexY)
            )
            if (dFlap <= stroke * 0.62) flapA += 1
          }

          if (badge && Math.hypot(px - badgeCx, py - badgeCy) <= badgeR) badgeA += 1
        }
      }

      const samples = SUPERSAMPLE * SUPERSAMPLE
      const index = (y * size + x) * 4

      if (tileA > 0) {
        const t = Math.min(1, Math.max(0, gradientSum / tileA))
        blend(
          pixels,
          index,
          Math.round(mix(0x63, 0x8b, t)),
          Math.round(mix(0x66, 0x5c, t)),
          Math.round(mix(0xf1, 0xf6, t)),
          tileA / samples
        )
      }

      const inkAlpha = Math.min(1, (envA + flapA) / samples)
      if (inkAlpha > 0) blend(pixels, index, 255, 255, 255, inkAlpha)

      if (badgeA > 0) {
        blend(pixels, index, 0xf4, 0x3f, 0x5e, badgeA / samples)
      }
    }
  }

  return pixels
}

/* -------------------------------------------------------------------------- */
/*                                PNG encoding                                */
/* -------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  header[10] = 0
  header[11] = 0
  header[12] = 0

  // One filter byte (0 = none) in front of every scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

/* -------------------------------------------------------------------------- */
/*                                ICO encoding                                */
/* -------------------------------------------------------------------------- */

/** 32-bit BGRA DIB entry (bottom-up) plus the 1-bit AND mask Windows expects. */
function encodeDib(size, rgba) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8) // XOR + AND masks stacked
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16) // BI_RGB

  const xor = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    const sourceRow = (size - 1 - y) * size * 4
    for (let x = 0; x < size; x += 1) {
      const from = sourceRow + x * 4
      const to = (y * size + x) * 4
      xor[to] = rgba[from + 2]
      xor[to + 1] = rgba[from + 1]
      xor[to + 2] = rgba[from]
      xor[to + 3] = rgba[from + 3]
    }
  }

  const maskRowBytes = Math.ceil(size / 32) * 4
  const and = Buffer.alloc(maskRowBytes * size, 0)

  header.writeUInt32LE(xor.length + and.length, 20)
  return Buffer.concat([header, xor, and])
}

function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(16 * images.length)
  let offset = header.length + directory.length
  const payloads = []

  images.forEach((image, index) => {
    const at = index * 16
    directory[at] = image.size >= 256 ? 0 : image.size
    directory[at + 1] = image.size >= 256 ? 0 : image.size
    directory[at + 2] = 0 // palette
    directory[at + 3] = 0
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(image.data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += image.data.length
    payloads.push(image.data)
  })

  return Buffer.concat([header, directory, ...payloads])
}

/* -------------------------------------------------------------------------- */
/*                                   Output                                   */
/* -------------------------------------------------------------------------- */

function write(relativePath, buffer) {
  const target = join(ROOT, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, buffer)
  console.log(`  ${relativePath.padEnd(30)} ${(buffer.length / 1024).toFixed(1)} KB`)
}

function main() {
  console.log('Generating Mail Sticker icons…')

  write('resources/icon.png', encodePng(256, renderIcon(256)))
  write('build/icon.png', encodePng(512, renderIcon(512)))

  // Tray icons keep a little padding so they are not clipped in the tray.
  write('resources/tray.png', encodePng(32, renderIcon(32, { padding: 1 })))
  write('resources/tray-unread.png', encodePng(32, renderIcon(32, { padding: 1, badge: true })))

  // Windows prefers uncompressed DIB entries for the small sizes and accepts
  // PNG payloads for 128px and above.
  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const entries = icoSizes.map((size) => {
    const rgba = renderIcon(size, { padding: size >= 128 ? 0 : 1 })
    return {
      size,
      data: size >= 128 ? encodePng(size, rgba) : encodeDib(size, rgba)
    }
  })
  write('build/icon.ico', encodeIco(entries))

  console.log('Done.')
}

main()
