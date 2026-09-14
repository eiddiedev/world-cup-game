import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const vercelConfig = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'))

describe('Vercel deployment target', () => {
  it('publishes the compliant full web directory without invoking the interactive package target', () => {
    expect(vercelConfig.framework).toBe('vite')
    expect(vercelConfig.buildCommand).toBe('npm run build:compliant')
    expect(vercelConfig.outputDirectory).toBe('.variant-build/compliant-full')
    expect(vercelConfig.buildCommand).not.toMatch(/interactive|release/)
  })
})
