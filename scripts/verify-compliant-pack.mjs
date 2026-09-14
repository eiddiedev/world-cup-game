import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot, validateArtPack, walkFiles } from './lib/variant-build.mjs'

const manifest = JSON.parse(readFileSync(
  join(projectRoot, 'art-packs/compliant/manifest.json'),
  'utf8',
))

if (manifest.status === 'pending') {
  let failedClosed = false
  try {
    validateArtPack('compliant-full')
  } catch (error) {
    failedClosed = /fail-closed/.test(String(error?.message || error))
  }
  if (!failedClosed) throw new Error('Pending compliant pack did not fail closed')
  console.log('Compliant art pack is pending; fail-closed contract verified.')
} else {
  const { variant } = validateArtPack('compliant-full')
  if (variant.platform !== 'web' || variant.targetPlatform !== 'douyin-mini-game') {
    throw new Error('Maintained target must truthfully identify the web baseline and Douyin destination')
  }

  const outputRoot = join(projectRoot, '.variant-build', 'compliant-full')
  if (existsSync(outputRoot)) {
    const files = walkFiles(outputRoot)
    const relativeNames = files.map((path) => path.slice(outputRoot.length + 1))
    const obsolete = relativeNames.filter((name) => (
      /stadium-day-master-v[123]\.png$/.test(name)
      || name.endsWith('/stadium.jpg')
    ))
    if (obsolete.length) throw new Error(`Obsolete stadium assets leaked into build: ${obsolete.join(', ')}`)
    const finalPitch = join(
      outputRoot,
      'pixel/stadiums/international-championship-day-v1/stadium-day-master-v4.png',
    )
    if (!existsSync(finalPitch)) throw new Error('Final perspective vertical pitch is missing from build')

    const dirlist = JSON.parse(readFileSync(
      join(outputRoot, 'match-runtime-min/__dirlist.json'),
      'utf8',
    ))
    const stadiumFiles = dirlist['/data/stadiums/international'] || []
    if (!stadiumFiles.includes('bootstrap.png') || stadiumFiles.includes('stadium.jpg')) {
      throw new Error('Runtime directory index can still discover the legacy stadium')
    }

    const totalBytes = files.reduce((sum, path) => sum + statSync(path).size, 0)
    const totalMiB = totalBytes / (1024 * 1024)
    if (totalMiB > 150) throw new Error(`Compliant H5 baseline exceeds 150 MiB: ${totalMiB.toFixed(1)} MiB`)
    console.log(`Compliant H5 baseline verified: ${files.length} files / ${totalMiB.toFixed(1)} MiB.`)
  }
  console.log('Art pack is valid. This remains a web baseline, not a native Douyin submission package.')
}
