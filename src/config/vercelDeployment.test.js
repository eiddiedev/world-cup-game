import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const vercelConfig = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'))

describe('Vercel deployment target', () => {
  it('publishes the showcase web directory without invoking a packaged target', () => {
    expect(vercelConfig.framework).toBe('vite')
    expect(vercelConfig.buildCommand).toBe('npm run build:showcase')
    expect(vercelConfig.outputDirectory).toBe('.variant-build/showcase-full')
    expect(vercelConfig.buildCommand).not.toMatch(/compliant|interactive|release/)
  })
})
