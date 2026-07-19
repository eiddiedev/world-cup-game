import { describe, expect, it } from 'vitest'
import { buildHappySeedRuntimeActorConfig } from './happySeedRuntimeActors.js'
import {
  FORMAL_COACH_RUNTIME_V2_SEQUENCE,
  buildFormalCoachDecision,
  findConservativeFormalCoachChoice,
  resolveFormalCoachDecisionRule,
} from './formalCoachDecision.js'
import {
  DANGEROUS_FREE_KICK_OUTCOMES,
  buildDangerousFreeKickSceneScript,
  createDangerousFreeKickRuntimeMomentFixture,
  createDecisionDirectorV2StateMachine,
  isDangerousFreeKickRuntimeMomentEligible,
  validateDecisionSceneScriptV2,
} from './decisionSceneScriptV2.js'

describe('DecisionSceneScriptV2 危险任意球验收合同', () => {
  const actorSource = buildHappySeedRuntimeActorConfig()
  const decision = buildFormalCoachDecision({
    actorSource,
    sequenceIndex: 0,
    schedule: FORMAL_COACH_RUNTIME_V2_SEQUENCE,
  })
  const runtimeMoment = createDangerousFreeKickRuntimeMomentFixture(
    actorSource,
    decision,
  )
  const script = buildDangerousFreeKickSceneScript(
    decision,
    actorSource,
    runtimeMoment,
  )

  it('uses one explicit script with all 22 actors and three in-field trajectories', () => {
    expect(validateDecisionSceneScriptV2(script)).toEqual({ valid: true, errors: [] })
    expect(script.actorPositions).toHaveLength(22)
    expect(new Set(script.actorPositions.map((entry) => entry.runtimeActorId)).size).toBe(22)
    expect(script.choices.map((choice) => choice.visual.kind)).toEqual([
      'trajectory',
      'trajectory',
      'trajectory',
    ])
    expect(script.camera).toEqual({
      preserveCurrent: true,
      smoothFitRoutes: true,
      allowManualPanWhileChoosing: true,
    })
    expect(script.runtimeMoment.source).toBe('continuous-match')
  })

  it('starts every preview and outcome path at the authored foot-ball anchor', () => {
    expect(script.ball.normalized).toEqual(runtimeMoment.ball.normalized)
    for (const choice of script.choices) {
      expect(choice.visual.previewPath[0]).toEqual(script.ball.normalized)
      for (const outcome of Object.values(choice.outcomes)) {
        expect(outcome.path[0]).toEqual(script.ball.normalized)
      }
    }
  })

  it('only accepts a live red-team possession moment inside the dangerous zone', () => {
    expect(isDangerousFreeKickRuntimeMomentEligible(runtimeMoment)).toBe(true)
    expect(isDangerousFreeKickRuntimeMomentEligible({
      ...runtimeMoment,
      attackingSide: 'blue',
    })).toBe(false)
    expect(isDangerousFreeKickRuntimeMomentEligible({
      ...runtimeMoment,
      ball: { normalized: [0.2, 0.5, 0] },
    })).toBe(false)
    expect(() => buildDangerousFreeKickSceneScript(decision, actorSource, null))
      .toThrow(/真实危险区域瞬间/)
  })

  it('keeps complete description, risk and reward information on every field choice', () => {
    for (const choice of script.choices) {
      expect(choice.description.length).toBeGreaterThan(5)
      expect(choice.risk.length).toBeGreaterThan(5)
      expect(choice.reward.length).toBeGreaterThan(5)
    }
  })

  it('covers all 11 outcomes without a generic fallback and keeps cues monotonic', () => {
    const authored = script.choices.flatMap((choice) => Object.keys(choice.outcomes))
    const required = Object.values(DANGEROUS_FREE_KICK_OUTCOMES).flat()
    expect(authored.sort()).toEqual(required.sort())
    expect(authored).toHaveLength(11)
    for (const choice of script.choices) {
      for (const outcome of Object.values(choice.outcomes)) {
        const times = outcome.actions.map((action) => action.atMs)
        expect(times).toEqual([...times].sort((left, right) => left - right))
        expect(outcome.durationMs).toBeGreaterThan(Math.max(...times))
      }
    }
  })

  it('can directly exercise every authored outcome in development acceptance', () => {
    for (const choice of decision.choices) {
      for (const outcome of DANGEROUS_FREE_KICK_OUTCOMES[choice.id]) {
        expect(resolveFormalCoachDecisionRule(decision, choice.id, {
          outcomeOverride: outcome,
        }).result.outcome).toBe(outcome)
      }
    }
  })

  it('locks a choice once and makes settlement idempotent', () => {
    const machine = createDecisionDirectorV2StateMachine()
    machine.prepare(script.id)
    machine.openChoices()
    machine.execute('direct_freekick', 'goal_freekick')
    expect(() => machine.execute('freekick_cross', 'goal_header')).toThrow()
    expect(machine.settle().settleCount).toBe(1)
    expect(machine.settle().settleCount).toBe(1)
    machine.restore()
    expect(machine.finishRestore().phase).toBe('idle')
  })

  it('keeps a deterministic conservative choice available for timeout handling', () => {
    const conservative = findConservativeFormalCoachChoice(decision)
    expect(conservative).toBeTruthy()
    expect(decision.choices.some((choice) => choice.id === conservative.id)).toBe(true)
  })
})
