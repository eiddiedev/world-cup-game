import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { VARIANT_IDS, VARIANTS } from '../config/variants.mjs'
import {
  artifactDirectoryFor,
  gitInfo,
  projectRoot,
  validateArtPack,
} from './lib/variant-build.mjs'

const git = gitInfo()
if (git.branch !== 'main') throw new Error(`release:all requires main; current branch is ${git.branch}`)
if (git.dirty) throw new Error('release:all requires a clean worktree')
VARIANT_IDS.forEach(validateArtPack)

const artifactRoot = artifactDirectoryFor(git)
mkdirSync(artifactRoot, { recursive: true })
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  ...options,
})

run('npm', ['test', '--', '--run'])
run('npm', ['run', 'lint'])
for (const variantId of VARIANT_IDS) {
  run('node', ['scripts/build-variant.mjs', variantId], {
    env: {
      ...process.env,
      TARGETING_RELEASE_DIR: relative(projectRoot, artifactRoot),
    },
  })
}

const manifest = {
  schemaVersion: 1,
  sourceSha: git.sha,
  sourceBranch: git.branch,
  dirty: false,
  generatedAt: new Date().toISOString(),
  targets: VARIANT_IDS.map(variantId => VARIANTS[variantId].package.enabled
    ? {
      variantId,
      packaged: true,
      archive: VARIANTS[variantId].package.archiveName,
    }
    : {
      variantId,
      packaged: false,
      outputDirectory: `.variant-build/${variantId}`,
    }),
}
writeFileSync(join(artifactRoot, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Release complete: ${artifactRoot}`)
