import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot, validateArtPack } from './lib/variant-build.mjs'

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
  validateArtPack('compliant-full')
  validateArtPack('compliant-interactive')
  console.log('Compliant art pack is ready and valid for both compliant targets.')
}
