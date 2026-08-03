import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from './lib/variant-build.mjs'

const generatedRoots = [
  '.variant-build',
  '.variant-public',
  'dist',
  'dist-douyin',
  'dist-douyin-minimal',
  'dist-labs',
  'deliverables',
  'release',
  'reports',
]

generatedRoots.forEach(relativePath => {
  const target = join(projectRoot, relativePath)
  rmSync(target, { recursive: true, force: true })
  console.log(`Removed ${relativePath}`)
})
