import { describe, expect, it } from 'vitest'
import { teams } from '../data/teams.js'
import { getCriticalStartupAssets } from './startupAssets.js'

describe('startup asset priority', () => {
  it('preloads the title art and every playable team flag and crest', () => {
    const assets = getCriticalStartupAssets(teams)

    expect(teams).toHaveLength(16)
    expect(assets).toContain('/assets/背景图.png')
    expect(assets).toContain('/assets/logo.png')
    expect(assets).toContain('/assets/logo2.png')
    teams.forEach((team) => {
      expect(assets).toContain(team.logo)
      expect(assets).toContain(team.flag)
    })
    expect(new Set(assets).size).toBe(assets.length)
  })
})
