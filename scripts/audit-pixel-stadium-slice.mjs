import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  HAPPYSEED_PIXEL_STADIUM_ID,
  HAPPYSEED_STADIUM_CAMERA_PRESETS,
  HAPPYSEED_STADIUM_LAYERS,
  getHappySeedPixelStadiumContract,
  validateHappySeedPixelStadiumContract,
} from '../src/utils/happySeedPixelStadium.js'

const projectRoot = path.resolve(import.meta.dirname, '..')
const assetRoot = path.join(projectRoot, 'public', 'pixel', 'stadiums', HAPPYSEED_PIXEL_STADIUM_ID)
const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }
const sameList = (actual, expected) => actual.length === expected.length
  && actual.every((value, index) => value === expected[index])

function readPngSize(buffer) {
  const signature = buffer.subarray(0, 8)
  assert(signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'PNG signature mismatch')
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
}

const manifest = JSON.parse(await readFile(path.join(assetRoot, 'manifest.json'), 'utf8'))
const scene = JSON.parse(await readFile(path.join(assetRoot, 'scene.json'), 'utf8'))
const contract = getHappySeedPixelStadiumContract()
const validation = validateHappySeedPixelStadiumContract(scene)

assert(validation.valid, `Invalid scene contract: ${validation.errors.join(', ')}`)
assert(scene.id === contract.id, 'Scene id drift')
assert(scene.composition?.opaqueBackgroundCount === 1, 'Exactly one opaque background is required')
assert(scene.composition?.runtimePitchOverlay === false, 'Runtime pitch overlay must stay disabled')
assert(scene.composition?.reuseOriginalGoalSprites === true, 'Original goal sprites must be reused')
assert(scene.composition?.goalPositionSource === 'stadium.json', 'Goal positions must come from stadium.json')
assert(scene.invariants?.preserveGoalCollision === true, 'Goal collision must stay runtime-owned')
assert(scene.invariants?.preserveDynamicNet === true, 'Dynamic net must stay runtime-owned')
assert(scene.invariants?.networking === 'none', 'Stadium cannot require networking')
assert(sameList(scene.layers.map((layer) => layer.id), HAPPYSEED_STADIUM_LAYERS.map((layer) => layer.id)), 'Layer contract drift')
assert(sameList(scene.cameraPresets.map((preset) => preset.id), HAPPYSEED_STADIUM_CAMERA_PRESETS.map((preset) => preset.id)), 'Camera preset contract drift')
assert(manifest.opaqueBackgroundCount === 1, 'Manifest opaque background count drift')
assert(manifest.runtimePitchOverlay === false, 'Manifest runtime pitch overlay drift')
assert(manifest.goalPositionSource === 'stadium.json', 'Manifest goal source drift')
assert(manifest.files.filter((file) => file.role === 'single-opaque-background').length === 1, 'Manifest must contain one opaque background')

let measuredBytes = 0
for (const asset of manifest.files) {
  const absolutePath = path.join(assetRoot, path.basename(asset.path))
  const fileInfo = await stat(absolutePath)
  measuredBytes += fileInfo.size
  assert(fileInfo.size === asset.bytes, `Byte count mismatch: ${asset.path}`)
  if (asset.path.endsWith('.png')) {
    const dimensions = readPngSize(await readFile(absolutePath))
    assert(sameList(dimensions, [4096, 2048]), `Master background size drift: ${dimensions.join('x')}`)
  }
}
assert(measuredBytes === manifest.totalBytes, 'Manifest total byte count mismatch')
assert(manifest.totalBytes < 8 * 1024 * 1024, 'Stadium slice exceeds 8 MiB')
assert(JSON.stringify(manifest.projectionLock?.sourcePitchBounds) === JSON.stringify([648, 611, 2800, 1057]), 'Projection lock drift')
assert(manifest.projectionLock?.tolerancePx === 2, 'Projection tolerance drift')

if (failures.length) {
  console.error(`Pixel stadium slice audit failed (${failures.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log([
    'Pixel stadium slice audit passed.',
    '1 opaque background / 0 runtime pitch overlays / original goal geometry',
    `${manifest.fileCount} files / ${manifest.totalBytes} bytes (${manifest.totalKiB} KiB)`,
  ].join('\n'))
}
