import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  HAPPYSEED_PIXEL_STADIUM_ID,
  getHappySeedPixelStadiumContract,
} from '../src/utils/happySeedPixelStadium.js'

const projectRoot = path.resolve(import.meta.dirname, '..')
const outputRoot = path.join(projectRoot, 'public', 'pixel', 'stadiums', HAPPYSEED_PIXEL_STADIUM_ID)
const masterAsset = { filename: 'stadium-day-master-v4.png', width: 4096, height: 2048 }

function pngSize(buffer) {
  const signature = buffer.subarray(0, 8)
  const expected = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!signature.equals(expected)) throw new Error('PNG signature mismatch')
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
}

const absolutePath = path.join(outputRoot, masterAsset.filename)
const buffer = await readFile(absolutePath)
const [width, height] = pngSize(buffer)
if (width !== masterAsset.width || height !== masterAsset.height) {
  throw new Error(`${masterAsset.filename} must be ${masterAsset.width}x${masterAsset.height}`)
}

const scenePath = path.join(outputRoot, 'scene.json')
await writeFile(scenePath, `${JSON.stringify(getHappySeedPixelStadiumContract(), null, 2)}\n`)

const files = [
  {
    path: `/pixel/stadiums/${HAPPYSEED_PIXEL_STADIUM_ID}/${masterAsset.filename}`,
    bytes: (await stat(absolutePath)).size,
    width,
    height,
    role: 'single-opaque-background',
  },
  {
    path: `/pixel/stadiums/${HAPPYSEED_PIXEL_STADIUM_ID}/scene.json`,
    bytes: (await stat(scenePath)).size,
    role: 'scene-contract',
  },
]
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0)
const manifest = {
  schemaVersion: 'happyseed-pixel-stadium-assets-v5',
  generatedBy: 'scripts/generate-pixel-stadium-slice.mjs',
  artPipeline: 'image-generation-single-master-background',
  projectionLock: {
    reference: 'animal-cup-international-runtime',
    sourceSize: [4096, 2048],
    sourcePitchBounds: [648, 611, 2800, 1057],
    tolerancePx: 0,
  },
  grassStripeDirection: 'perspective-goal-line-parallel',
  grassStripeVanishingPoint: [2048, -9000],
  grassStripeReferenceY: 611,
  legacyPitchFallback: false,
  stadiumId: HAPPYSEED_PIXEL_STADIUM_ID,
  opaqueBackgroundCount: 1,
  runtimePitchOverlay: false,
  goalPositionSource: 'stadium.json',
  fileCount: files.length,
  totalBytes,
  totalKiB: Number((totalBytes / 1024).toFixed(1)),
  files,
}

await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

// The HappySeed browser filesystem uses this generated directory index for
// synchronous readdir calls. Keep it aligned with the neutral bootstrap file
// so the removed legacy stadium.jpg can never be requested as a fallback.
const nativeStadiumRoot = path.join(
  projectRoot,
  'public',
  'match-runtime-min',
  'data',
  'stadiums',
  'international',
)
const runtimeDirlistPath = path.join(projectRoot, 'public', 'match-runtime-min', '__dirlist.json')
const runtimeDirlist = JSON.parse(await readFile(runtimeDirlistPath, 'utf8'))
runtimeDirlist['/data/stadiums/international'] = (await readdir(nativeStadiumRoot)).sort()
await writeFile(runtimeDirlistPath, `${JSON.stringify(runtimeDirlist)}\n`)

console.log(`Single-background stadium contract refreshed: ${files.length} files / ${manifest.totalKiB} KiB`)
