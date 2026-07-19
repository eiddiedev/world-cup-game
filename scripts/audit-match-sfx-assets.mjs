import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const audioRoot = path.join(projectRoot, 'public', 'match-runtime-min', 'happyseed', 'audio')
const manifest = JSON.parse(await readFile(path.join(audioRoot, 'manifest-v1.json'), 'utf8'))
const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }

assert(manifest.schemaVersion === 'match-sfx-assets-v1', 'Audio manifest schema drift')
assert(manifest.budgetBytes === 400 * 1024, 'Audio budget must remain 400 KiB')
assert(manifest.assets.length === manifest.fileCount, 'Audio manifest file count drift')
assert(manifest.offlineFallback === 'WebAudio transient synthesis', 'Offline audio fallback is required')

let measuredBytes = 0
for (const asset of manifest.assets) {
  const absolutePath = path.join(audioRoot, path.basename(asset.path))
  const fileInfo = await stat(absolutePath)
  const data = await readFile(absolutePath)
  const sha256 = createHash('sha256').update(data).digest('hex')
  measuredBytes += fileInfo.size
  assert(fileInfo.size === asset.bytes, `Byte count mismatch: ${asset.path}`)
  assert(sha256 === asset.sha256, `SHA-256 mismatch: ${asset.path}`)
  assert(asset.license === 'CC0 1.0', `Non-CC0 audio asset: ${asset.path}`)
  assert(/^https:\/\/freesound\.org\//.test(asset.source), `Missing Freesound source: ${asset.path}`)
}

assert(measuredBytes === manifest.totalBytes, 'Audio manifest total byte count drift')
assert(measuredBytes <= manifest.budgetBytes, 'Audio assets exceed 400 KiB')

if (failures.length) {
  console.error(`Match SFX asset audit failed (${failures.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log([
    'Match SFX asset audit passed.',
    `${manifest.fileCount} CC0 files / ${manifest.totalBytes} bytes`,
    `Budget remaining: ${manifest.budgetBytes - manifest.totalBytes} bytes`,
  ].join('\n'))
}
