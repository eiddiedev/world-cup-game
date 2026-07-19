/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { LOCKER_ROOM_DECISIONS } from '../data/lockerRoomDecisions.js'
import {
  lockerRoomMoraleBonus,
  resolveLockerRoomChoice,
  selectLockerRoomScenario,
} from './lockerRoomDecisions.js'
import { buildHappySeedRuntimeActorConfig } from './happySeedRuntimeActors.js'

const actorSource = buildHappySeedRuntimeActorConfig()
const redOnPitch = actorSource.actors.filter((actor) => (
  actor.side === 'red' && actor.state?.onPitch
))

describe('locker room decisions', () => {
  it('ships 42 scenarios across the four phases with complete choice contracts', () => {
    expect(LOCKER_ROOM_DECISIONS).toHaveLength(42)
    for (const phase of ['prematch', 'halftime', 'extratime', 'shootout']) {
      expect(
        LOCKER_ROOM_DECISIONS.filter((scenario) => (
          (scenario.phases || [scenario.phase]).includes(phase)
        )).length,
        phase,
      ).toBeGreaterThanOrEqual(5)
    }
    for (const scenario of LOCKER_ROOM_DECISIONS) {
      expect(scenario.title, scenario.id).toBeTruthy()
      expect(scenario.situation, scenario.id).toBeTruthy()
      expect(scenario.choices.length, scenario.id).toBeGreaterThanOrEqual(2)
      for (const choice of scenario.choices) {
        expect(choice.label, `${scenario.id}/${choice.id}`).toBeTruthy()
        expect(choice.desc, `${scenario.id}/${choice.id}`).toBeTruthy()
        expect(choice.effects.length, `${scenario.id}/${choice.id}`).toBeGreaterThan(0)
        expect(choice.result, `${scenario.id}/${choice.id}`).toBeTruthy()
      }
    }
  })

  it('selects scenarios by phase (including shared ones), score condition and without repeats', () => {
    const leading = selectLockerRoomScenario({ phase: 'halftime', scoreDiff: 2 })
    expect((leading.phases || [leading.phase])).toContain('halftime')
    expect(['any', 'leading']).toContain(leading.condition)
    const trailing = selectLockerRoomScenario({ phase: 'halftime', scoreDiff: -2 })
    expect(['any', 'trailing']).toContain(trailing.condition)
    const excluded = selectLockerRoomScenario({
      phase: 'halftime',
      scoreDiff: 0,
      usedIds: LOCKER_ROOM_DECISIONS.filter((s) => (
        (s.phases || [s.phase]).includes('halftime')
      )).map((s) => s.id),
    })
    expect(excluded).toBeNull()
    // 混用场景在两个阶段都应可被选中
    const sharedIds = LOCKER_ROOM_DECISIONS
      .filter((s) => (s.phases || []).length > 1)
      .map((s) => s.id)
    expect(sharedIds.length).toBeGreaterThan(0)
    const prematchPool = Array.from({ length: 40 }, () => (
      selectLockerRoomScenario({ phase: 'prematch', scoreDiff: 0 })?.id
    ))
    const halftimePool = Array.from({ length: 40 }, () => (
      selectLockerRoomScenario({ phase: 'halftime', scoreDiff: 0 })?.id
    ))
    expect(prematchPool.some((id) => sharedIds.includes(id))).toBe(true)
    expect(halftimePool.some((id) => sharedIds.includes(id))).toBe(true)
  })

  it('applies choice effects to actor state with clamps and an auditable report', () => {
    const actors = redOnPitch.map((actor) => ({
      ...actor,
      state: { ...actor.state, morale: 70, form: 70, stamina: 80 },
    }))
    const scenario = LOCKER_ROOM_DECISIONS.find((item) => item.id === 'media_pressure')
    const report = resolveLockerRoomChoice(scenario, 'fuel', { actors, randomFn: () => 0 })
    expect(report.resultText).toContain('毫无胜算')
    expect(report.average.morale).toBeGreaterThan(0)
    expect(report.affected.length).toBeGreaterThan(0)
    for (const actor of actors) {
      expect(actor.state.morale).toBeGreaterThanOrEqual(0)
      expect(actor.state.morale).toBeLessThanOrEqual(99)
    }
    const everyMoraleUp = report.affected.every((entry) => entry.deltas.morale >= 0 || entry.deltas.form !== 0)
    expect(everyMoraleUp).toBe(true)
  })

  it('scopes primary effects to the highest-rated outfield player', () => {
    const actors = redOnPitch.map((actor) => ({
      ...actor,
      state: { ...actor.state, morale: 70, form: 70, stamina: 80 },
    }))
    const scenario = LOCKER_ROOM_DECISIONS.find((item) => item.id === 'trailing_star')
    const report = resolveLockerRoomChoice(scenario, 'trust', { actors, randomFn: () => 0 })
    const best = [...redOnPitch.filter((a) => !a.isGoalkeeper)]
      .sort((a, b) => b.rating - a.rating)[0]
    expect(report.affected[0].runtimeActorId).toBe(best.runtimeActorId)
    expect(report.affected[0].deltas.morale).toBeGreaterThan(0)
  })

  it('maps team morale and form into a bounded decision success bonus', () => {
    const neutral = redOnPitch.map((actor) => ({
      ...actor,
      state: { ...actor.state, morale: 70, form: 70 },
    }))
    expect(lockerRoomMoraleBonus(neutral)).toBe(0)
    const hyped = redOnPitch.map((actor) => ({
      ...actor,
      state: { ...actor.state, morale: 95, form: 95 },
    }))
    expect(lockerRoomMoraleBonus(hyped)).toBeCloseTo(0.07, 5)
    const down = redOnPitch.map((actor) => ({
      ...actor,
      state: { ...actor.state, morale: 10, form: 10 },
    }))
    expect(lockerRoomMoraleBonus(down)).toBeCloseTo(-0.07, 5)
    expect(Math.abs(lockerRoomMoraleBonus(redOnPitch))).toBeLessThanOrEqual(0.07)
  })
})
