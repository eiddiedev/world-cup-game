import { describe, expect, it } from 'vitest'
import {
  MINI_CUP_SEMIFINALS,
  advanceMiniCupAfterMatch,
  buildMiniCupPlayerStates,
  createMiniCupRun,
  createMiniCupState,
  getMiniCupSemifinalOpponent,
  simulateMiniCupSemifinal,
} from './miniCup.js'
import { getTeamById } from '../data/teams.js'

describe('four-team mini cup', () => {
  it('uses the approved fixed semifinal bracket', () => {
    expect(MINI_CUP_SEMIFINALS).toEqual([
      ['france', 'spain'],
      ['argentina', 'england'],
    ])
    expect(getMiniCupSemifinalOpponent('france')).toBe('spain')
    expect(getMiniCupSemifinalOpponent('spain')).toBe('france')
    expect(getMiniCupSemifinalOpponent('argentina')).toBe('england')
    expect(getMiniCupSemifinalOpponent('england')).toBe('argentina')
  })

  it('keeps all 24 recruitment candidates for each of the four teams', () => {
    for (const teamId of ['spain', 'france', 'argentina', 'england']) {
      expect(getTeamById(teamId)?.players, teamId).toHaveLength(24)
    }
  })

  it('keeps the original coach recruitment and support flow', () => {
    const run = createMiniCupRun('spain', 'coach', null, 2026)
    expect(run.stage).toBe('recruitment')
    expect(run.purchasedPlayerIds).toEqual([])
    expect(run.currentOpponent).toBe('france')
  })

  it('simulates the other semifinal deterministically from the saved seed', () => {
    const pair = ['argentina', 'england']
    expect(simulateMiniCupSemifinal(pair, 2026)).toBe(simulateMiniCupSemifinal(pair, 2026))
    expect(['argentina', 'england']).toContain(simulateMiniCupSemifinal(pair, 2026))
  })

  it('advances a semifinal winner into the final and ends after the final', () => {
    const miniCup = createMiniCupState('spain', 2026)
    const semifinalRun = {
      teamId: 'spain',
      miniCup,
      lastMatchResult: { result: 'win' },
    }
    const finalRun = advanceMiniCupAfterMatch(semifinalRun)

    expect(finalRun.stage).toBe('lineup')
    expect(finalRun.miniCup.round).toBe('final')
    expect(finalRun.currentOpponent).toBe(miniCup.otherSemifinalWinner)

    const championRun = advanceMiniCupAfterMatch({
      ...finalRun,
      lastMatchResult: { result: 'win' },
    })
    expect(championRun.stage).toBe('ending')
    expect(championRun.miniCup.status).toBe('champion')
  })

  it('ends the run immediately after either knockout loss', () => {
    const eliminated = advanceMiniCupAfterMatch({
      teamId: 'england',
      miniCup: createMiniCupState('england', 7),
      lastMatchResult: { result: 'loss' },
    })

    expect(eliminated.stage).toBe('ending')
    expect(eliminated.miniCup.status).toBe('eliminated')
  })

  it('applies the selected support to real player match state', () => {
    const player = { id: 'starter-1', form: 84 }
    const run = {
      roster: [player],
      playerMatchStates: { [player.id]: { stamina: 91 } },
      miniCup: { selectedSupport: 'analytics' },
    }

    expect(buildMiniCupPlayerStates(run)[player.id]).toEqual({
      stamina: 91,
      form: 88,
    })
  })
})
