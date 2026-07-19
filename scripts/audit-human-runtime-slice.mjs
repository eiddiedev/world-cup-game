import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  HAPPYSEED_HUMAN_ACTIONS,
  HAPPYSEED_PLAYER_BONES,
  HAPPYSEED_PLAYER_SLOTS,
  HAPPYSEED_SLOT_TEXTURE_SIZES,
  getHappySeedHumanRecipes,
  validateHappySeedHumanRecipe,
} from '../src/utils/happySeedHumanPlayer.js'

const projectRoot = path.resolve(import.meta.dirname, '..')
const publicRoot = path.join(projectRoot, 'public')
const failures = []

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function sameList(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
}

function expectedPngSize(assetPath) {
  const filename = path.basename(assetPath, '.png')
  if (assetPath.includes('/pixel/numbers/')) return HAPPYSEED_SLOT_TEXTURE_SIZES.number
  if (assetPath.includes('/pixel/kits/') && filename === 'hand_left') {
    return HAPPYSEED_SLOT_TEXTURE_SIZES.glove_left
  }
  if (assetPath.includes('/pixel/kits/') && filename === 'hand_right') {
    return HAPPYSEED_SLOT_TEXTURE_SIZES.glove_right
  }
  return HAPPYSEED_SLOT_TEXTURE_SIZES[filename]
}

function readPngSize(buffer) {
  const signature = buffer.subarray(0, 8)
  assert(signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'PNG signature mismatch')
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
}

const skeletonPath = path.join(publicRoot, 'match-runtime-min', 'data', 'player.json')
const skeleton = JSON.parse(await readFile(skeletonPath, 'utf8'))
const skeletonBones = skeleton.bones.map((bone) => bone.name)
const skeletonSlots = skeleton.slots.map((slot) => slot.name)

assert(skeleton.skeleton?.spine === '2.1.27', `Expected Spine 2.1.27, received ${skeleton.skeleton?.spine}`)
assert(skeleton.skeleton?.width === 123.69 && skeleton.skeleton?.height === 202.3, 'Skeleton bounds changed')
assert(sameList(skeletonBones, HAPPYSEED_PLAYER_BONES), '17-bone contract no longer matches player.json')
assert(sameList(skeletonSlots, HAPPYSEED_PLAYER_SLOTS), '32-slot contract no longer matches player.json')

const requiredAnimations = new Set(HAPPYSEED_HUMAN_ACTIONS.flatMap((action) => action.runtimeAnimations))
for (const animation of requiredAnimations) {
  assert(Boolean(skeleton.animations?.[animation]), `Missing runtime animation: ${animation}`)
}

const manifestPath = path.join(publicRoot, 'pixel', 'human-runtime-slice-manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const recipes = getHappySeedHumanRecipes()
assert(manifest.profileCount === recipes.length, 'Manifest profile count mismatch')
assert(manifest.fileCount === manifest.files.length, 'Manifest file count mismatch')
assert(
  manifest.silhouette === 'imagegen-master-direct-slice',
  'Human silhouettes must be cut directly from the approved ImageGen master',
)
assert(
  manifest.artSource === '/docs/art-reference/happyseed-human-v3-production-paper-doll-master.png',
  'Human slice art-source provenance drift',
)

let measuredBytes = 0
for (const asset of manifest.files) {
  const absolutePath = path.join(publicRoot, asset.path.replace(/^\//, ''))
  const fileInfo = await stat(absolutePath)
  measuredBytes += fileInfo.size
  assert(fileInfo.size === asset.bytes, `Byte count mismatch: ${asset.path}`)

  if (asset.path.endsWith('.png')) {
    const expectedSize = expectedPngSize(asset.path)
    assert(Boolean(expectedSize), `Unknown slot texture: ${asset.path}`)
    if (expectedSize) {
      const actualSize = readPngSize(await readFile(absolutePath))
      assert(sameList(actualSize, expectedSize), `PNG dimensions mismatch: ${asset.path} (${actualSize.join('x')})`)
    }
  }
}
assert(measuredBytes === manifest.totalBytes, 'Manifest total byte count mismatch')

for (const recipe of recipes) {
  const validation = validateHappySeedHumanRecipe(recipe)
  assert(validation.valid, `Invalid generated recipe ${recipe.id}: ${validation.errors.join(', ')}`)
  const recipePath = path.join(publicRoot, 'pixel', 'recipes', recipe.teamId, `${recipe.id}.json`)
  const generatedRecipe = JSON.parse(await readFile(recipePath, 'utf8'))
  assert(JSON.stringify(generatedRecipe) === JSON.stringify(recipe), `Generated recipe drift: ${recipe.id}`)
}

if (failures.length) {
  console.error(`Human runtime slice audit failed (${failures.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log([
    'Human runtime slice audit passed.',
    `${skeletonBones.length} bones / ${skeletonSlots.length} slots`,
    `${recipes.length} profiles / ${HAPPYSEED_HUMAN_ACTIONS.length} actions`,
    `${manifest.fileCount} files / ${manifest.totalBytes} bytes (${manifest.totalKiB} KiB)`,
  ].join('\n'))
}
