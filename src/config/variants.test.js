import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_PLAYABLE_TEAM_IDS,
  INTERACTIVE_PLAYABLE_TEAM_IDS,
  VARIANTS,
} from '../../config/variants.mjs'
import { rasterDimensions, validateArtPack } from '../../scripts/lib/variant-build.mjs'

const root = resolve('.')
const rights = JSON.parse(readFileSync(resolve(root, 'config/art-rights.json'), 'utf8'))
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('variant build contracts', () => {
  it('keeps both full variants behaviorally identical', () => {
    const showcase = VARIANTS['showcase-full']
    const compliant = VARIANTS['compliant-full']
    expect(showcase.features).toEqual(compliant.features)
    expect(showcase.playableTeamIds).toEqual(compliant.playableTeamIds)
    expect(showcase.playableTeamIds).toHaveLength(16)
    expect(showcase.artPack).toBe('showcase')
    expect(compliant.artPack).toBe('compliant')
    expect(showcase.brandingProfile).toBe('showcase')
    expect(compliant.brandingProfile).toBe('compliant')
    expect(showcase.package.enabled).toBe(false)
    expect(compliant.package.enabled).toBe(false)
  })

  it('keeps all 16 teams in the interactive profile without widening its feature boundary', () => {
    const interactive = VARIANTS['compliant-interactive']
    expect(interactive.playableTeamIds).toEqual(ALL_PLAYABLE_TEAM_IDS)
    expect(interactive.playableTeamIds).toEqual(INTERACTIVE_PLAYABLE_TEAM_IDS)
    expect(ALL_PLAYABLE_TEAM_IDS).toHaveLength(16)
    expect(interactive.features).toMatchObject({
      coachMode: true,
      playerMode: true,
      codex: false,
      standalonePenalty: false,
      formalMatchPenalties: true,
    })
    expect(interactive.package.maxZipBytes).toBe(15 * 1024 * 1024)
    expect(interactive.package).toMatchObject({
      enabled: true,
      archiveName: 'targeting-2026-compliant-interactive.zip',
      compressionProfile: 'match-quality',
    })
    expect(Object.values(VARIANTS).filter(variant => variant.package.enabled).map(variant => variant.id))
      .toEqual(['compliant-interactive'])
    expect(interactive.matchView).toEqual({
      coachDefaultZoom: 0.68,
      coachMinZoom: 0.48,
      playerDefaultZoom: 1.16,
    })
  })

  it('tracks every initial protected slot with unique ASCII package paths', () => {
    expect(rights.entries.filter(entry => entry.kind === 'branding')).toHaveLength(6)
    expect(rights.entries.filter(entry => entry.kind === 'flag')).toHaveLength(48)
    expect(rights.entries.filter(entry => entry.kind === 'crest')).toHaveLength(16)
    expect(rights.entries).toHaveLength(70)
    expect(new Set(rights.entries.map(entry => entry.key)).size).toBe(70)
    expect(new Set(rights.entries.map(entry => entry.path)).size).toBe(70)
    rights.entries.forEach(entry => {
      expect(entry.path).toMatch(/^[\x20-\x7e]+$/)
      expect(existsSync(resolve(root, 'art-packs/showcase', entry.path))).toBe(true)
      expect(existsSync(resolve(root, 'public', entry.path))).toBe(false)
    })
  })

  it('keeps pending replacements fail-closed or accepts the approved pack without fallback', () => {
    const manifest = JSON.parse(readFileSync(
      resolve(root, 'art-packs/compliant/manifest.json'),
      'utf8',
    ))
    if (manifest.status === 'pending') {
      expect(manifest.pendingItems.length).toBeGreaterThan(0)
      const protectedKeys = new Set(rights.entries.map(entry => entry.key))
      manifest.pendingItems.forEach(key => expect(protectedKeys.has(key), key).toBe(true))
      expect(() => validateArtPack('compliant-full')).toThrow(/fail-closed/)
      expect(() => validateArtPack('compliant-interactive')).toThrow(/fail-closed/)
      return
    }
    expect(manifest.status).toBe('ready')
    expect(manifest.pendingItems).toEqual([])
    expect(() => validateArtPack('compliant-full')).not.toThrow()
    expect(() => validateArtPack('compliant-interactive')).not.toThrow()
    rights.entries
      .filter(entry => entry.compliantPolicy === 'exclude')
      .forEach(entry => {
        expect(existsSync(resolve(root, 'art-packs/compliant', entry.path))).toBe(false)
      })
  })

  it('keeps all 69 staged compliant replacement assets dimension-compatible and hash-distinct', () => {
    const completedKeys = new Set([
      'branding.titleFrame1',
      'branding.titleFrame2',
      'branding.trophy',
      'branding.homeBackground',
      'branding.lockerRoom',
      ...rights.entries.filter(entry => entry.kind === 'flag').map(entry => entry.key),
      ...ALL_PLAYABLE_TEAM_IDS.map(teamId => `crest.${teamId}`),
    ])
    const completedEntries = rights.entries.filter(entry => completedKeys.has(entry.key))
    expect(completedEntries).toHaveLength(69)
    completedEntries.forEach(entry => {
      const showcasePath = resolve(root, 'art-packs/showcase', entry.path)
      const compliantPath = resolve(root, 'art-packs/compliant', entry.path)
      expect(existsSync(compliantPath), entry.key).toBe(true)
      expect(rasterDimensions(compliantPath), entry.key).toEqual(rasterDimensions(showcasePath))
      expect(sha256(compliantPath), entry.key).not.toBe(sha256(showcasePath))
    })
  })
})
