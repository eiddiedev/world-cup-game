import { spawnSync } from 'node:child_process'
import { getVariant } from '../config/variants.mjs'
import { prepareVariantPublic, projectRoot } from './lib/variant-build.mjs'

const variantId = process.argv[2] || 'showcase-full'
const port = process.argv[3] || '5175'
getVariant(variantId)
prepareVariantPublic(variantId)

const result = spawnSync('npx', ['vite', '--mode', variantId === 'showcase-full' ? 'showcase' : variantId === 'compliant-full' ? 'compliant' : 'interactive', '--port', port], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_VARIANT_ID: variantId,
    TARGETING_PUBLIC_DIR: `.variant-public/${variantId}`,
  },
})
process.exit(result.status ?? 1)
