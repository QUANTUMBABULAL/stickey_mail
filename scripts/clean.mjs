/** Removes build output. `npm run clean` */
import { rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = ['out', 'release', 'node_modules/.tmp', 'node_modules/.vite']

for (const target of TARGETS) {
  rmSync(join(ROOT, target), { recursive: true, force: true })
  console.log(`removed ${target}`)
}
