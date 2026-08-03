import { describe, expect, it } from 'vitest'
import { teams } from '../data/teams.js'
import {
  getCriticalStartupAssets,
  getPenaltyShootoutAssets,
  getSelectedTeamPlayerAssets,
} from './startupAssets.js'

describe('startup asset priority', () => {
  it('preloads the title art and every playable team flag and crest', () => {
    const assets = getCriticalStartupAssets(teams)

    expect(teams).toHaveLength(16)
    expect(assets).toContain('/assets/branding/home-background.png')
    expect(assets).toContain('/assets/branding/title-frame-1.png')
    expect(assets).toContain('/assets/branding/title-frame-2.png')
    expect(assets).toContain('/assets/聘书.png?v=2')
    expect(assets).toContain('/assets/branding/appointment-stamp.png')
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
    getPenaltyShootoutAssets().forEach((asset) => {
      expect(assets).not.toContain(asset)
    })
    expect(new Set(assets).size).toBe(assets.length)
  })

  it('keeps selected-player and shootout art out of the blocking startup list', () => {
    const selectedAssets = getSelectedTeamPlayerAssets(teams[0])
    const shootoutAssets = getPenaltyShootoutAssets()

    expect(selectedAssets).toContain(teams[0].players[0].avatar)
    expect(shootoutAssets).toHaveLength(18)
    expect(shootoutAssets).toContain('/assets/shootout/ball.png')
    expect(shootoutAssets).toContain('/assets/shootout/gk7.png')
    expect(shootoutAssets).toContain('/assets/shootout/p8.png')
  })
})
