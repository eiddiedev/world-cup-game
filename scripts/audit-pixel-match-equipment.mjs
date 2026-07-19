import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const publicRoot = path.join(projectRoot, 'public')
const assetRoot = path.join(
  publicRoot,
  'pixel',
  'runtime-equipment',
  'happyseed-equipment-v6',
)
const manifest = JSON.parse(await readFile(path.join(assetRoot, 'manifest.json'), 'utf8'))
const runtimeAdapter = await readFile(
  path.join(publicRoot, 'match-runtime-min', 'happyseed', 'runtime-v2.js'),
  'utf8',
)
const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }

function readPngSize(buffer) {
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
}

assert(manifest.schemaVersion === 'happyseed-runtime-equipment-assets-v6', 'Schema version drift')
assert(
  manifest.integration?.pixelGrid?.ball?.join('x') === '64x32',
  'Ball UV must use the authored 64x32 pixel grid',
)
assert(manifest.integration?.pixelGrid?.goalBlock === 4, 'Goal atlas must use 4px hard blocks')
assert(manifest.integration?.pixelGrid?.ballOutput?.join('x') === '12x12', 'Ball output must be pixelated at 12x12')
assert(manifest.integration?.pixelGrid?.netScreen === 4, 'Dynamic net must snap to the 4px screen grid')
assert(
  manifest.integration?.netTopologyStride?.side?.join('x') === '1x3'
    && manifest.integration?.netTopologyStride?.top?.join('x') === '1x2',
  'Dynamic net must use the authored distance-readable topology strides',
)
assert(manifest.integration?.netLineBlock === 4, 'Dynamic net must use touching 4px steps')
assert(manifest.integration?.netShadowSource === 'same-runtime-endpoints', 'Net and shadow must share endpoints')
assert(manifest.integration?.netShadowAlpha <= 0.12, 'Net shadow must remain light')
assert(manifest.integration?.netShadowOffset === 4, 'Net shadow must use the authored 4px offset')
assert(manifest.fileCount === 2 && manifest.files.length === 2, 'Exactly two equipment textures are required')
assert(manifest.integration?.ballGeometry === 'original-runtime-sphere', 'Ball geometry must remain Runtime-owned')
assert(manifest.integration?.goalPlacement === 'stadium.json', 'Goal placement must remain stadium.json-owned')
assert(manifest.integration?.goalCollision === 'original-runtime', 'Goal collision must remain Runtime-owned')
assert(manifest.integration?.dynamicNet === 'original-runtime', 'Dynamic net must remain Runtime-owned')
assert(/installPixelBallTexture/.test(runtimeAdapter), 'Runtime adapter does not install the pixel ball UV')
assert(/installPixelGoalAtlas/.test(runtimeAdapter), 'Runtime adapter does not install the pixel goal/net atlas')
assert(/installPixelDynamicNets/.test(runtimeAdapter), 'Runtime adapter does not install pixel dynamic-net rendering')
assert(
  /pixelDynamicNetDepthMode:\s*"aggregate-front-edge"/.test(runtimeAdapter),
  'Aggregate pixel net must preserve front-edge depth sorting',
)
assert(
  /frontWorldY\s*\*\s*Generic\.PIXELS_Y/.test(runtimeAdapter),
  'Aggregate pixel net depth must follow the deforming Runtime net points',
)
assert(/pixelBallOutputApplied/.test(runtimeAdapter), 'Runtime adapter does not pixelate the final ball sphere output')

let totalBytes = 0
for (const asset of manifest.files) {
  const absolutePath = path.join(publicRoot, asset.path.replace(/^\//, ''))
  const fileInfo = await stat(absolutePath)
  const buffer = await readFile(absolutePath)
  const digest = createHash('sha256').update(buffer).digest('hex')
  const dimensions = readPngSize(buffer)
  totalBytes += fileInfo.size
  assert(fileInfo.size === asset.bytes, `Byte count mismatch: ${asset.path}`)
  assert(digest === asset.sha256, `SHA-256 mismatch: ${asset.path}`)
  assert(
    dimensions[0] === asset.dimensions[0] && dimensions[1] === asset.dimensions[1],
    `PNG dimensions mismatch: ${asset.path}`,
  )
}
assert(totalBytes === manifest.totalBytes, 'Manifest total byte count mismatch')
assert(totalBytes < 400 * 1024, 'Pixel equipment pack exceeds 400 KiB')

if (failures.length) {
  console.error(`Pixel match equipment audit failed (${failures.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log([
    'Pixel match equipment audit passed.',
    'original ball geometry / original goal collision / original dynamic net',
    `${manifest.fileCount} files / ${manifest.totalBytes} bytes (${manifest.totalKiB} KiB)`,
  ].join('\n'))
}
