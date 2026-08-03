import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_PLAYABLE_TEAM_IDS,
  INTERACTIVE_PLAYABLE_TEAM_IDS,
  VARIANTS,
} from '../../config/variants.mjs'

const root = resolve('.')
const rights = JSON.parse(readFileSync(resolve(root, 'config/art-rights.json'), 'utf8'))

describe('variant build contracts', () => {
  it('keeps both full variants behaviorally identical', () => {
    const showcase = VARIANTS['showcase-full']
    const compliant = VARIANTS['compliant-full']
    expect(showcase.features).toEqual(compliant.features)
    expect(showcase.playableTeamIds).toEqual(compliant.playableTeamIds)
    expect(showcase.playableTeamIds).toHaveLength(16)
    expect(showcase.artPack).toBe('showcase')
    expect(compliant.artPack).toBe('compliant')
  })

  it('locks the interactive profile to four teams and the intended feature boundary', () => {
    const interactive = VARIANTS['compliant-interactive']
    expect(interactive.playableTeamIds).toEqual(['spain', 'england', 'norway', 'capeverde'])
    expect(interactive.playableTeamIds).toEqual(INTERACTIVE_PLAYABLE_TEAM_IDS)
    expect(ALL_PLAYABLE_TEAM_IDS).toHaveLength(16)
    expect(interactive.features).toMatchObject({
      coachMode: true,
      playerMode: true,
      codex: false,
      standalonePenalty: false,
      formalMatchPenalties: true,
    })
    expect(interactive.package.maxZipBytes).toBe(8 * 1024 * 1024)
    expect(interactive.matchView).toEqual({ coachDefaultZoom: 0.68, coachMinZoom: 0.48 })
  })

  it('tracks every initial protected slot with unique ASCII package paths', () => {
    expect(rights.entries.filter(entry => entry.kind === 'branding')).toHaveLength(3)
    expect(rights.entries.filter(entry => entry.kind === 'flag')).toHaveLength(48)
    expect(rights.entries.filter(entry => entry.kind === 'crest')).toHaveLength(16)
    expect(rights.entries).toHaveLength(67)
    expect(new Set(rights.entries.map(entry => entry.key)).size).toBe(67)
    expect(new Set(rights.entries.map(entry => entry.path)).size).toBe(67)
    rights.entries.forEach(entry => {
      expect(entry.path).toMatch(/^[\x20-\x7e]+$/)
      expect(existsSync(resolve(root, 'art-packs/showcase', entry.path))).toBe(true)
      expect(existsSync(resolve(root, 'public', entry.path))).toBe(false)
    })
  })

  it('keeps the compliant pack pending instead of silently falling back', () => {
    const manifest = JSON.parse(readFileSync(
      resolve(root, 'art-packs/compliant/manifest.json'),
      'utf8',
    ))
    expect(manifest.status).toBe('pending')
    rights.entries.forEach(entry => {
      expect(existsSync(resolve(root, 'art-packs/compliant', entry.path))).toBe(false)
    })
  })
})
