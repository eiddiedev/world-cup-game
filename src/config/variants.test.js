import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_PLAYABLE_TEAM_IDS,
  VARIANTS,
} from '../../config/variants.mjs'
import { rasterDimensions, validateArtPack } from '../../scripts/lib/variant-build.mjs'

const root = resolve('.')
const rights = JSON.parse(readFileSync(resolve(root, 'config/art-rights.json'), 'utf8'))
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('variant build contracts', () => {
  it('exposes only the compliant full product target', () => {
    const compliant = VARIANTS['compliant-full']
    expect(Object.keys(VARIANTS)).toEqual(['compliant-full'])
    expect(compliant.playableTeamIds).toEqual(ALL_PLAYABLE_TEAM_IDS)
    expect(compliant.playableTeamIds).toHaveLength(16)
    expect(compliant.artPack).toBe('compliant')
    expect(compliant.brandingProfile).toBe('compliant')
    expect(compliant.package.enabled).toBe(false)
    expect(compliant.targetPlatform).toBe('douyin-mini-game')
    expect(compliant.features).toMatchObject({
      coachMode: false,
      playerMode: false,
      journeyMode: true,
      onlineMode: true,
      ironFootball: true,
      deterministicOffside: true,
      codex: true,
      standalonePenalty: true,
      formalMatchPenalties: true,
    })
    expect(compliant.matchView).toEqual({
      coachDefaultZoom: 1,
      coachMinZoom: 0.72,
      playerDefaultZoom: 1,
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
      return
    }
    expect(manifest.status).toBe('ready')
    expect(manifest.pendingItems).toEqual([])
    expect(() => validateArtPack('compliant-full')).not.toThrow()
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
