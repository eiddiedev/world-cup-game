import { describe, expect, it } from 'vitest'
import { teams } from '../data/teams.js'
import {
  getCriticalStartupAssets,
  getSelectedTeamPlayerAssets,
} from './startupAssets.js'

describe('startup asset priority', () => {
  it('preloads the title art and every playable team flag and crest', () => {
    const assets = getCriticalStartupAssets(teams)

    expect(teams.length).toBeGreaterThanOrEqual(4)
    expect(assets).toContain('/assets/背景图.png')
    expect(assets).toContain('/assets/logo.png')
    expect(assets).toContain('/assets/logo2.png')
    expect(assets).toContain('/assets/聘书.png?v=2')
    expect(assets).toContain('/assets/印章.png')
    expect(assets).toContain('/assets/金币.png')
    expect(assets).toContain('/assets/征召点.png')
    teams.forEach((team) => {
      expect(assets).toContain(team.logo)
      expect(assets).toContain(team.flag)
    })
    expect(assets).not.toContain('/assets/图鉴.png')
    expect(assets).not.toContain('/assets/fonts/zpix.ttf')
    teams.forEach((team) => {
      getSelectedTeamPlayerAssets(team).forEach((asset) => {
        expect(assets).not.toContain(asset)
      })
    })
    expect(assets.some((asset) => asset.includes('/assets/shootout/'))).toBe(false)
    expect(new Set(assets).size).toBe(assets.length)
  })

  it('keeps selected-player and removed legacy shootout art out of startup', () => {
    const selectedAssets = getSelectedTeamPlayerAssets(teams[0])

    expect(selectedAssets).toContain(teams[0].players[0].avatar)
    expect(getCriticalStartupAssets(teams).some((asset) => asset.includes('/assets/shootout/'))).toBe(false)
  })
})
