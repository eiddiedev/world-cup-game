import { describe, expect, it } from 'vitest'
import {
  freezeOffsideFrame,
  registerDefenderPlay,
  registerOffsideInvolvement,
  resolveDelayedOffside,
} from './offsideEngine.js'

const basePlayers = [
  { playerId: 'r1', side: 'red', x: 0.62, y: 0.5 },
  { playerId: 'r2', side: 'red', x: 0.9, y: 0.4 },
  { playerId: 'r3', side: 'red', x: 0.45, y: 0.6 },
  { playerId: 'b1', side: 'blue', x: 0.95, y: 0.5, isGoalkeeper: true },
  { playerId: 'b2', side: 'blue', x: 0.8, y: 0.4 },
  { playerId: 'b3', side: 'blue', x: 0.7, y: 0.6 },
]

function freeze(overrides = {}) {
  return freezeOffsideFrame({
    sourceEventId: 'pass-1',
    frameId: 12,
    passerPlayerId: 'r1',
    attackingSide: 'red',
    attackDirection: 1,
    ball: { x: 0.62, y: 0.5 },
    players: basePlayers,
    ...overrides,
  })
}

describe('deterministic offside engine', () => {
  it('keeps level, behind-ball and own-half attackers onside', () => {
    const state = freeze({
      players: [
        ...basePlayers.filter((player) => !['r2', 'r3'].includes(player.playerId)),
        { playerId: 'level', side: 'red', x: 0.8, y: 0.2 },
        { playerId: 'behind-ball', side: 'red', x: 0.61, y: 0.5 },
        { playerId: 'own-half', side: 'red', x: 0.49, y: 0.7 },
      ],
    })
    expect(state.candidatePlayerIds).toEqual([])
    expect(state.status).toBe('onside')
  })

  it('calls the actual participant even when that player was not the intended receiver', () => {
    const state = freeze()
    expect(state.candidatePlayerIds).toContain('r2')
    const called = registerOffsideInvolvement(state, {
      playerId: 'r2',
      type: 'touch',
      x: 0.74,
      y: 0.4,
      ballX: 0.74,
      delayed: false,
    })
    expect(called.events.map((item) => item.type)).toEqual([
      'offside_called',
      'indirect_free_kick',
    ])
  })

  it('treats goalkeeper obstruction and rebound benefit as involvement', () => {
    const obstructed = registerOffsideInvolvement(freeze(), {
      playerId: 'r2', type: 'obstruct-goalkeeper', x: 0.9, y: 0.5, ballX: 0.88,
    })
    const rebound = registerOffsideInvolvement(freeze(), {
      playerId: 'r2', type: 'rebound', x: 0.9, y: 0.5, ballX: 0.9,
    })
    expect(obstructed.status).toBe('delayed')
    expect(rebound.status).toBe('delayed')
  })

  it('does not clear for a deflection or save, but clears for controlled deliberate play', () => {
    const watching = freeze()
    expect(registerDefenderPlay(watching, { kind: 'deflection' })).toBe(watching)
    expect(registerDefenderPlay(watching, { kind: 'save' })).toBe(watching)
    expect(registerDefenderPlay(watching, { kind: 'deliberate-play' }).status).toBe('cleared')
  })

  it.each(['corner', 'throw-in', 'goal-kick'])('exempts direct reception from a %s', (restartType) => {
    const state = freeze({ restartType })
    expect(state).toMatchObject({ status: 'exempt', candidatePlayerIds: [] })
  })

  it('delays in the danger area, disallows a goal, and applies score rollback once', () => {
    const pending = registerOffsideInvolvement(freeze(), {
      playerId: 'r2', type: 'touch', x: 0.9, y: 0.4, ballX: 0.9,
    })
    expect(pending.events.at(-1).type).toBe('offside_pending')
    const resolved = resolveDelayedOffside(pending, {
      type: 'goal', goalEventId: 'goal-1', scoringSide: 'red',
    })
    expect(resolved.events.slice(-3).map((item) => item.type)).toEqual([
      'goal_disallowed',
      'offside_called',
      'indirect_free_kick',
    ])
    expect(resolved.scoreRollbackApplied).toBe(true)
    const duplicate = resolveDelayedOffside(resolved, {
      type: 'goal', goalEventId: 'goal-1', scoringSide: 'red',
    })
    expect(duplicate).toBe(resolved)
    expect(duplicate.events.filter((item) => item.type === 'goal_disallowed')).toHaveLength(1)
  })
})
