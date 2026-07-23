import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  HAPPYSEED_HUMAN_PART_SET_ID,
  buildHappySeedKitPalette,
} from '../src/utils/happySeedHumanPlayer.js'
import { opponentTeams } from '../src/data/opponentTeams.js'
import {
  drawKitPart,
  drawNumber,
  writePng,
} from './generate-human-runtime-slice.mjs'

const PLAYABLE_TEAM_IDS = [
  'france',
  'brazil',
  'argentina',
  'portugal',
  'germany',
  'japan',
  'norway',
  'morocco',
  'newzealand',
  'curacao',
  'spain',
  'england',
  'colombia',
  'usa',
  'canada',
  'mexico',
  'capeverde',
]
const TEAM_IDS = [...PLAYABLE_TEAM_IDS, ...opponentTeams.map(t => t.id)]
const KIT_VARIANTS = [
  { path: 'home', role: 'outfield', paletteVariant: 'home' },
  { path: 'away', role: 'outfield', paletteVariant: 'away' },
  { path: 'goalkeeper', role: 'goalkeeper', paletteVariant: 'home' },
  { path: 'away-goalkeeper', role: 'goalkeeper', paletteVariant: 'away' },
]
const OUTFIELD_PARTS = [
  'shirt_front',
  'shirt_back',
  'sleeve_left',
  'sleeve_right',
  'shorts',
  'shorts_leg',
  'socks',
  'shoes',
]

const projectRoot = path.resolve(import.meta.dirname, '..')
const manifest = []

for (const teamId of TEAM_IDS) {
  for (const variant of KIT_VARIANTS) {
    const palette = buildHappySeedKitPalette(
      teamId,
      variant.role,
      variant.paletteVariant,
    )
    const kitRoot = `pixel/kits/${teamId}/${variant.path}/${HAPPYSEED_HUMAN_PART_SET_ID}`
    for (const part of OUTFIELD_PARTS) {
      await writePng(`${kitRoot}/${part}.png`, drawKitPart(part, palette), manifest)
    }
    if (variant.role === 'goalkeeper') {
      await writePng(`${kitRoot}/hand_left.png`, drawKitPart('glove_left', palette), manifest)
      await writePng(`${kitRoot}/hand_right.png`, drawKitPart('glove_right', palette), manifest)
    }
  }
}

const numberPalette = {
  number: '#F8F2E2',
  numberStroke: '#17212B',
}
for (let number = 1; number <= 99; number += 1) {
  await writePng(
    `pixel/numbers/${HAPPYSEED_HUMAN_PART_SET_ID}/${number}.png`,
    drawNumber(number, numberPalette),
    manifest,
  )
}

const uniqueManifest = [...new Map(manifest.map((item) => [item.path, item])).values()]
const totalBytes = uniqueManifest.reduce((sum, item) => sum + item.bytes, 0)
const outputPath = path.join(projectRoot, 'public', 'pixel', 'runtime-actor-assets-manifest.json')
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({
  schemaVersion: 'happyseed-runtime-actor-assets-v1',
  generatedBy: 'scripts/generate-runtime-actor-assets.mjs',
  partSetId: HAPPYSEED_HUMAN_PART_SET_ID,
  teamCount: TEAM_IDS.length,
  kitVariantCount: KIT_VARIANTS.length,
  numberCount: 99,
  fileCount: uniqueManifest.length,
  totalBytes,
  totalKiB: Number((totalBytes / 1024).toFixed(2)),
  files: uniqueManifest,
}, null, 2)}\n`)

console.log(
  `Generated ${uniqueManifest.length} runtime actor assets (${(totalBytes / 1024).toFixed(2)} KiB).`,
)
