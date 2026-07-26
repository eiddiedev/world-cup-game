import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { HAPPYSEED_SLOT_TEXTURE_SIZES } from '../src/utils/happySeedHumanPlayer.js'
import { ALL_PLAYABLE_TEAM_IDS } from '../src/config/runtime.js'
import { opponentTeams } from '../src/data/opponentTeams.js'

const projectRoot = path.resolve(import.meta.dirname, '..')
const publicRoot = path.join(projectRoot, 'public')
const manifest = JSON.parse(await readFile(
  path.join(publicRoot, 'pixel', 'runtime-actor-assets-manifest.json'),
  'utf8',
))
const standaloneRuntimeSource = await readFile(
  path.join(publicRoot, 'match-runtime-min', 'standalone-match.js'),
  'utf8',
)
const failures = []
const expectedRuntimeTeamIds = new Set([
  ...ALL_PLAYABLE_TEAM_IDS,
  ...opponentTeams.map((team) => team.id),
])

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function expectedSize(assetPath) {
  const filename = path.basename(assetPath, '.png')
  if (assetPath.includes('/pixel/numbers/')) return HAPPYSEED_SLOT_TEXTURE_SIZES.number
  if (filename === 'hand_left') return HAPPYSEED_SLOT_TEXTURE_SIZES.glove_left
  if (filename === 'hand_right') return HAPPYSEED_SLOT_TEXTURE_SIZES.glove_right
  return HAPPYSEED_SLOT_TEXTURE_SIZES[filename]
}

function readPngSize(buffer) {
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
}

assert(manifest.schemaVersion === 'happyseed-runtime-actor-assets-v1', 'Schema version drift')
assert(
  manifest.teamCount === expectedRuntimeTeamIds.size,
  `Runtime assets must cover ${expectedRuntimeTeamIds.size} unique tournament teams`,
)
assert(manifest.kitVariantCount === 4, 'Each team needs home, away and two goalkeeper kits')
assert(manifest.numberCount === 99, 'Jersey number atlas must cover 1-99')
assert(manifest.fileCount === manifest.files.length, 'Manifest file count mismatch')
assert(
  manifest.silhouette === 'imagegen-master-direct-slice',
  'Runtime actor silhouettes must be cut from the approved ImageGen master',
)
assert(
  /if\s*\(\s*window\.__happySeedHumanSlicePreview\s*&&\s*!stadR\._humanSliceInit/.test(
    standaloneRuntimeSource,
  ),
  'Human skeleton preview must be isolated behind the explicit lab-preview flag',
)
assert(
  /physicalPlayerCount\s*===\s*22[\s\S]*rendererPlayerCount\s*===\s*22[\s\S]*actorMappingCount\s*===\s*22/.test(
    standaloneRuntimeSource,
  ),
  'Formal Runtime must audit 22 physical players, renderers and actor mappings',
)
assert(
  /states\.change\(Pitch\.states\.Kickoff,\s*restartingTeam\)/.test(
    standaloneRuntimeSource,
  ),
  'Decision goals must pass the restarting team into the native Kickoff state',
)
assert(
  /humanDisplayScale\s*=\s*\.62/.test(standaloneRuntimeSource),
  'Formal human players must use the calibrated 0.62 display scale',
)

let measuredBytes = 0
for (const asset of manifest.files) {
  const absolutePath = path.join(publicRoot, asset.path.replace(/^\//, ''))
  const fileInfo = await stat(absolutePath)
  const buffer = await readFile(absolutePath)
  const expected = expectedSize(asset.path)
  measuredBytes += fileInfo.size
  assert(fileInfo.size === asset.bytes, `Byte count mismatch: ${asset.path}`)
  assert(Boolean(expected), `Unknown actor texture: ${asset.path}`)
  if (expected) {
    const actual = readPngSize(buffer)
    assert(
      actual[0] === expected[0] && actual[1] === expected[1],
      `PNG dimensions mismatch: ${asset.path}`,
    )
  }
}

assert(measuredBytes === manifest.totalBytes, 'Manifest total byte count mismatch')
assert(manifest.totalBytes < 512 * 1024, 'Stage 4 actor asset pack must stay below 512 KiB')

if (failures.length) {
  console.error(`Runtime actor asset audit failed (${failures.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log([
    'Runtime actor asset audit passed.',
    `${manifest.teamCount} teams / ${manifest.kitVariantCount} kit variants / ${manifest.numberCount} numbers`,
    `${manifest.fileCount} files / ${manifest.totalBytes} bytes (${manifest.totalKiB} KiB)`,
  ].join('\n'))
}
