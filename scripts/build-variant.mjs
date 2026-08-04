import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { getVariant } from '../config/variants.mjs'
import {
  artifactDirectoryFor,
  assertAsciiPackagePaths,
  assertNoShowcaseArtwork,
  assertNoRestrictedCompetitionIp,
  escapeRestrictedCoincidencesInBase64,
  gitInfo,
  prepareVariantPublic,
  projectRoot,
  walkFiles,
  writeBuildInfo,
  writeZip,
} from './lib/variant-build.mjs'
import { validateInteractivePackage } from './validate-interactive.mjs'

const variantId = process.argv[2]
if (!variantId) throw new Error('Usage: node scripts/build-variant.mjs <variant-id>')
const variant = getVariant(variantId)
const git = gitInfo()
const artifactRoot = process.env.TARGETING_RELEASE_DIR
  ? resolve(projectRoot, process.env.TARGETING_RELEASE_DIR)
  : artifactDirectoryFor(git)
const artifactPath = variant.package.enabled
  ? join(artifactRoot, variant.package.archiveName)
  : null
const { stagingRoot } = prepareVariantPublic(variantId)
if (artifactPath) mkdirSync(artifactRoot, { recursive: true })

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: projectRoot, stdio: 'inherit', ...options })
}

function buildFull() {
  const outputRoot = join(projectRoot, '.variant-build', variantId)
  rmSync(outputRoot, { recursive: true, force: true })
  run('npx', ['vite', 'build', '--mode', variantId === 'showcase-full' ? 'showcase' : 'compliant'], {
    env: {
      ...process.env,
      VITE_VARIANT_ID: variantId,
      TARGETING_PUBLIC_DIR: relative(projectRoot, stagingRoot),
      TARGETING_OUTPUT_DIR: relative(projectRoot, outputRoot),
    },
  })
  const buildInfo = writeBuildInfo(outputRoot, variantId)
  if (variant.artPack === 'compliant') assertNoShowcaseArtwork(outputRoot)
  if (variant.artPack === 'compliant') escapeRestrictedCoincidencesInBase64(outputRoot)
  if (variant.artPack === 'compliant') assertNoRestrictedCompetitionIp(outputRoot)
  return {
    variantId,
    outputRoot,
    packaged: false,
    files: walkFiles(outputRoot).length,
    buildInfo,
  }
}

function logicalInteractiveReport(outputRoot, zipBytes = null) {
  const paths = walkFiles(outputRoot).map(path => relative(outputRoot, path).split(sep).join('/'))
  const kitRoots = new Set(paths
    .filter(path => path.startsWith('pixel/kits/'))
    .map(path => path.split('/').slice(0, 3).join('/')))
  return {
    schemaVersion: 1,
    targetId: variantId,
    generatedAt: new Date().toISOString(),
    files: paths.length,
    uncompressedBytes: walkFiles(outputRoot).reduce((sum, path) => sum + statSync(path).size, 0),
    zipBytes,
    maxZipBytes: variant.package.maxZipBytes,
    logicalAssets: {
      flags: paths.filter(path => /^assets\/flags\/[^/]+\.png$/.test(path)).length,
      crests: paths.filter(path => /^assets\/crests\/[^/]+\.png$/.test(path)).length,
      kitRoots: [...kitRoots].sort(),
      selectableTeams: [...variant.playableTeamIds],
    },
    excludedFeatures: {
      codex: !variant.features.codex,
      standalonePenalty: !variant.features.standalonePenalty,
      formalMatchPenalties: !variant.features.formalMatchPenalties,
    },
  }
}

function buildInteractive() {
  const rawRoot = join(projectRoot, '.variant-build', `${variantId}-raw`)
  const outputRoot = join(projectRoot, '.variant-build', variantId)
  rmSync(rawRoot, { recursive: true, force: true })
  rmSync(outputRoot, { recursive: true, force: true })
  run('node', ['scripts/build-interactive.mjs'], {
    env: {
      ...process.env,
      VITE_VARIANT_ID: variantId,
      TARGETING_PUBLIC_ROOT: relative(projectRoot, stagingRoot),
      TARGETING_OUTPUT_ROOT: relative(projectRoot, rawRoot),
      TARGETING_RAW_ONLY: '1',
    },
  })
  writeBuildInfo(rawRoot, variantId)
  run('python3', [
    'scripts/compress-interactive-assets.py',
    '--source', rawRoot,
    '--output', outputRoot,
    '--profile', variant.package.compressionProfile,
  ])
  writeBuildInfo(outputRoot, variantId)
  assertAsciiPackagePaths(outputRoot)
  assertNoShowcaseArtwork(outputRoot)
  escapeRestrictedCoincidencesInBase64(outputRoot)
  assertNoRestrictedCompetitionIp(outputRoot)

  let zipBytes = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    writeFileSync(
      join(outputRoot, 'asset-report.json'),
      `${JSON.stringify(logicalInteractiveReport(outputRoot, zipBytes), null, 2)}\n`,
    )
    const nextBytes = writeZip(outputRoot, artifactPath)
    if (nextBytes === zipBytes) break
    zipBytes = nextBytes
  }
  if (zipBytes > variant.package.maxZipBytes) {
    throw new Error(`Interactive ZIP ${zipBytes} exceeds ${variant.package.maxZipBytes} bytes`)
  }

  const internalValidation = validateInteractivePackage(artifactPath, {
    maxBytes: variant.package.maxZipBytes,
  })
  if (internalValidation.errors.length) {
    throw new Error(`Interactive validation failed:\n- ${internalValidation.errors.join('\n- ')}`)
  }

  const officialValidator = process.env.H5_VALIDATOR
    || '/Users/a1234/.codex/skills/interact-creation/scripts/h5-validator'
  if (!existsSync(officialValidator)) {
    if (process.env.H5_VALIDATOR_OPTIONAL === '1') {
      console.warn(`Official h5-validator unavailable in CI: ${officialValidator}`)
    } else {
      throw new Error(`Required h5-validator not found: ${officialValidator}`)
    }
  } else {
    run('node', [officialValidator, '--required', 'index.html', '--max-size', String(variant.package.maxZipBytes), artifactPath])
  }
  return {
    variantId,
    artifactPath,
    zipBytes,
    files: walkFiles(outputRoot).length,
    internalValidation,
    buildInfo: JSON.parse(readFileSync(join(outputRoot, 'build-info.json'), 'utf8')),
  }
}

const result = variant.package.enabled ? buildInteractive() : buildFull()
const resultPath = artifactPath
  ? join(artifactRoot, 'targeting-2026-compliant-interactive.build-result.json')
  : join(result.outputRoot, 'build-result.json')
writeFileSync(
  resultPath,
  `${JSON.stringify(result, null, 2)}\n`,
)
console.log(JSON.stringify(result, null, 2))
