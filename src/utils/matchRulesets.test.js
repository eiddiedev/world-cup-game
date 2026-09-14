import { describe, expect, it } from 'vitest'
import {
  IRON_HIT_COOLDOWN_MS,
  applyIronTackleDamage,
  calculateIronTackleDamage,
  createIronHealthState,
  getMatchRulesetContract,
} from './matchRulesets.js'

describe('match rulesets', () => {
  it('turns off fouls, cards, penalties and offside only for iron football', () => {
    expect(getMatchRulesetContract('standard')).toMatchObject({
      offside: true,
      fouls: true,
      cards: true,
      penaltiesFromTackles: true,
    })
    expect(getMatchRulesetContract('iron')).toMatchObject({
      offside: false,
      fouls: false,
      cards: false,
      penaltiesFromTackles: false,
      hp: { initial: 100, damageMin: 10, damageMax: 38, cooldownMs: 800 },
    })
  })

  it('calculates deterministic 10-38 damage from relative speed and rear contact', () => {
    expect(calculateIronTackleDamage({ relativeSpeed: 0 })).toBe(10)
    expect(calculateIronTackleDamage({ relativeSpeed: 4 })).toBe(20)
    expect(calculateIronTackleDamage({ relativeSpeed: 4, fromBehind: true })).toBe(28)
    expect(calculateIronTackleDamage({ relativeSpeed: 99, fromBehind: true })).toBe(38)
  })

  it('ignores duplicate damage during the 800ms protection window', () => {
    const initial = createIronHealthState(['blue-9'])
    const first = applyIronTackleDamage(initial, {
      attackerRuntimeActorId: 'red-4',
      targetRuntimeActorId: 'blue-9',
      relativeSpeed: 8,
      atMs: 1000,
    })
    const duplicate = applyIronTackleDamage(first.state, {
      attackerRuntimeActorId: 'red-4',
      targetRuntimeActorId: 'blue-9',
      relativeSpeed: 8,
      atMs: 1000 + IRON_HIT_COOLDOWN_MS - 1,
    })
    expect(first.event).toMatchObject({ damage: 30, hp: 70, injured: false })
    expect(duplicate).toMatchObject({ applied: false, reason: 'hit-cooldown' })
    expect(duplicate.state.hpByRuntimeActorId['blue-9']).toBe(70)
  })

  it('marks a player injured exactly when hp reaches zero', () => {
    let state = createIronHealthState(['blue-9'])
    let atMs = 1000
    let result
    while (!state.injuredRuntimeActorIds.includes('blue-9')) {
      result = applyIronTackleDamage(state, {
        attackerRuntimeActorId: 'red-4',
        targetRuntimeActorId: 'blue-9',
        relativeSpeed: 99,
        fromBehind: true,
        atMs,
      })
      state = result.state
      atMs += IRON_HIT_COOLDOWN_MS
    }
    expect(result.event).toMatchObject({ type: 'injury', hp: 0, injured: true })
    expect(state.injuredRuntimeActorIds).toEqual(['blue-9'])
  })
})
