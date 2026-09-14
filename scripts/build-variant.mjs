import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { getVariant } from '../config/variants.mjs'
import {
  assertNoShowcaseArtwork,
  assertNoRestrictedCompetitionIp,
  escapeRestrictedCoincidencesInBase64,
  prepareVariantPublic,
  projectRoot,
  walkFiles,
  writeBuildInfo,
} from './lib/variant-build.mjs'

const variantId = process.argv[2]
if (!variantId) throw new Error('Usage: node scripts/build-variant.mjs <variant-id>')
getVariant(variantId)
const { stagingRoot } = prepareVariantPublic(variantId)

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: projectRoot, stdio: 'inherit', ...options })
}

const outputRoot = join(projectRoot, '.variant-build', variantId)
rmSync(outputRoot, { recursive: true, force: true })
run('npx', ['vite', 'build', '--mode', 'compliant'], {
  env: {
    ...process.env,
    VITE_VARIANT_ID: variantId,
    TARGETING_PUBLIC_DIR: relative(projectRoot, stagingRoot),
    TARGETING_OUTPUT_DIR: relative(projectRoot, outputRoot),
  },
})
const buildInfo = writeBuildInfo(outputRoot, variantId)
assertNoShowcaseArtwork(outputRoot)
escapeRestrictedCoincidencesInBase64(outputRoot)
assertNoRestrictedCompetitionIp(outputRoot)
const result = {
  variantId,
  outputRoot,
  packaged: false,
  files: walkFiles(outputRoot).length,
  buildInfo,
}
const resultPath = join(outputRoot, 'build-result.json')
writeFileSync(
  resultPath,
  `${JSON.stringify(result, null, 2)}\n`,
)
console.log(JSON.stringify(result, null, 2))
