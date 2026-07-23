import { describe, expect, it } from 'vitest'
import { teams } from '../data/teams.js'
import { createNewRun } from './saveManager.js'
import { getNextRunAfterMatch } from './tournamentProgress.js'

describe('世界杯赛事级进度', () => {
  it('lets every playable team complete group play and all four knockout rounds', () => {
    expect(teams).toHaveLength(16)

    for (const team of teams) {
      let run = {
        ...createNewRun(team.id),
        stage: 'post-match',
        matchIndex: 0,
        matchResults: [],
      }

      for (let groupMatch = 0; groupMatch < 3; groupMatch += 1) {
        run = getNextRunAfterMatch({
          ...run,
          stage: 'post-match',
          lastMatchResult: { result: 'win' },
          matchResults: [...run.matchResults, 'win'],
        })
      }
      expect(run).toMatchObject({ stage: 'tournament', matchIndex: 3 })

      for (const round of ['r16', 'qf', 'sf', 'final']) {
        run = getNextRunAfterMatch({
          ...run,
          stage: 'post-match',
          knockoutRound: round,
          isKnockoutMatch: true,
          lastMatchResult: {
            result: 'win',
            shootout: round === 'qf'
              ? { winner: 'home', regulationScore: [1, 1], score: [5, 4] }
              : null,
          },
        })
      }
      expect(run).toMatchObject({
        stage: 'ending',
        knockoutRound: 'final',
        isKnockoutMatch: false,
        lastMatchResult: { result: 'win' },
      })
    }
  })

  it('recovers stamina between matches without clearing injury or suspension state', () => {
    const next = getNextRunAfterMatch({
      ...createNewRun('france'),
      stage: 'post-match',
      playerStatuses: { p1: 22, p2: 96 },
      playerMatchStates: {
        p1: { stamina: 22, morale: 61, form: 58 },
        p2: { stamina: 96, morale: 74, form: 79 },
      },
      injuredPlayers: ['p1'],
      suspendedPlayers: ['p2'],
      lastMatchResult: { result: 'draw' },
    })

    expect(next.playerStatuses).toEqual({ p1: 32, p2: 100 })
    expect(next.playerMatchStates.p1).toMatchObject({ stamina: 32, morale: 61, form: 58 })
    expect(next.injuredPlayers).toEqual(['p1'])
    expect(next.suspendedPlayers).toEqual(['p2'])
  })
})
