import { spawnSync } from 'node:child_process'
import { getVariant } from '../config/variants.mjs'
import { prepareVariantPublic, projectRoot } from './lib/variant-build.mjs'

const variantId = process.argv[2] || 'compliant-full'
const port = process.argv[3] || '5176'
getVariant(variantId)
prepareVariantPublic(variantId)

const result = spawnSync('npx', ['vite', '--mode', 'compliant', '--port', port], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_VARIANT_ID: variantId,
    TARGETING_PUBLIC_DIR: `.variant-public/${variantId}`,
  },
})
process.exit(result.status ?? 1)
