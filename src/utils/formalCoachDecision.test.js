import { describe, expect, it, vi } from 'vitest'
import { buildHappySeedRuntimeActorConfig } from './happySeedRuntimeActors.js'
import { validateMatchVisualEvent } from './matchVisualEvent.js'
import { DECISION_LIBRARY } from '../data/decisionLibrary.js'
import {
  FORMAL_COACH_DECISION_CATALOG,
  FORMAL_COACH_DECISION_SEQUENCE,
  buildFormalCoachDecision,
  createFormalCoachDecisionPreludeVisualEvent,
  findConservativeFormalCoachChoice,
  resolveFormalCoachDecision,
  resolveFormalCoachDecisionRule,
} from './formalCoachDecision.js'

describe('正式比赛页教练限时决策闭环', () => {
  const actorSource = buildHappySeedRuntimeActorConfig()

  it('locks the first five coach decisions in the required playable order', () => {
    expect(FORMAL_COACH_DECISION_SEQUENCE.map((item) => item.scenarioId)).toEqual([
      'solo_run_penalty',
      'header_corner',
      'freekick_dangerous',
      'penalty_area_foul_risk',
      'match_penalty',
    ])
    expect(FORMAL_COACH_DECISION_SEQUENCE.map((item) => item.minute)).toEqual([
      18, 31, 44, 63, 78,
    ])
  })

  it('exposes all 53 local scenarios as a direct Runtime acceptance catalog', () => {
    expect(FORMAL_COACH_DECISION_CATALOG).toHaveLength(53)
    expect(new Set(FORMAL_COACH_DECISION_CATALOG.map(item => item.scenarioId)).size).toBe(53)
    expect(FORMAL_COACH_DECISION_CATALOG[0].minute).toBe(8)
    expect(FORMAL_COACH_DECISION_CATALOG.at(-1).minute).toBe(88)

    const decision = buildFormalCoachDecision({
      actorSource,
      sequenceIndex: 24,
      schedule: FORMAL_COACH_DECISION_CATALOG,
    })
    const prelude = createFormalCoachDecisionPreludeVisualEvent(decision, actorSource)
    expect(decision.sequenceNumber).toBe(25)
    expect(decision.coachDecisionEvent.sourceScenarioId)
      .toBe(FORMAL_COACH_DECISION_CATALOG[24].scenarioId)
    expect(validateMatchVisualEvent(prelude, actorSource)).toEqual({ valid: true, errors: [] })
  })

  it('resolves all 171 outcome ids through explicit truthful Chinese commentary', () => {
    const uniqueOutcomes = new Set()
    let branchCount = 0
    for (const scenario of DECISION_LIBRARY) {
      const decision = buildFormalCoachDecision({ actorSource, scenarioId: scenario.id, minute: 44 })
      for (const choice of decision.choices) {
        for (const outcome of new Set(choice.possible_outcomes)) {
          uniqueOutcomes.add(outcome)
          branchCount += 1
          const resolution = resolveFormalCoachDecisionRule(decision, choice.id, {
            outcomeOverride: outcome,
          })
          expect(resolution.resultText, `${scenario.id}/${choice.id}/${outcome}`).toBeTruthy()
          expect(resolution.resultText, `${scenario.id}/${choice.id}/${outcome}`)
            .not.toContain('场上局面随之更新')
        }
      }
    }
    expect(uniqueOutcomes.size).toBe(171)
    expect(branchCount).toBe(400)
  })

  it('keeps referee, containment and VAR result wording tied to the selected outcome', () => {
    const samples = [
      ['last_defender_tackle', 'jockey_to_corner', 'forced_corner', '形成角球'],
      ['var_penalty_review', 'surround_referee', 'yellow_card_dissent', '没有点球'],
      ['var_offside_goal', 'hold_celebration', 'no_change', '进球无效'],
      ['yellow_card_dissent_control', 'captain_calm_team', 'shape_held', '保持防守结构'],
    ]
    for (const [scenarioId, choiceId, outcome, expected] of samples) {
      const decision = buildFormalCoachDecision({ actorSource, scenarioId, minute: 44 })
      expect(resolveFormalCoachDecisionRule(decision, choiceId, {
        outcomeOverride: outcome,
      }).resultText).toContain(expected)
    }
  })

  it.each(FORMAL_COACH_DECISION_SEQUENCE.map((plan, index) => [plan, index]))(
    'builds one planned scene from active business players and a local-only CoachDecisionEvent',
    (_plan, sequenceIndex) => {
      const decision = buildFormalCoachDecision({ actorSource, sequenceIndex })

      expect(decision.coachDecisionEvent).toMatchObject({
        sourceScenarioId: _plan.scenarioId,
        minute: _plan.minute,
        team: 'france',
      })
      expect(decision.choices).toHaveLength(3)
      expect(decision.choices.every((choice) => Number.isFinite(choice.successProb))).toBe(true)
      expect(decision.keyPlayers.default.id).toBeTruthy()
      expect(actorSource.actors.some((actor) => (
        actor.playerId === decision.keyPlayers.default.id && actor.state.onPitch
      ))).toBe(true)
    },
  )

  it('plays the prelude as presentation-only with zero score and stat authority', () => {
    const decision = buildFormalCoachDecision({ actorSource, sequenceIndex: 0 })
    const event = createFormalCoachDecisionPreludeVisualEvent(decision, actorSource)

    expect(validateMatchVisualEvent(event, actorSource)).toEqual({ valid: true, errors: [] })
    expect(event.source).toMatchObject({ phase: 'prelude', choiceId: null })
    expect(event.outcome).toEqual({
      id: 'decision_pending',
      scoreDelta: { red: 0, blue: 0 },
      statsDelta: {},
      opponentStatsDelta: {},
    })
  })

  it('auto-selects the lowest-risk option when the countdown expires', () => {
    const decision = buildFormalCoachDecision({ actorSource, sequenceIndex: 3 })
    expect(findConservativeFormalCoachChoice(decision)?.id).toBe('contain_delay')
  })

  it('resolves one choice into one result visual event and one authority payload', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const decision = buildFormalCoachDecision({ actorSource, sequenceIndex: 0 })
    const resolution = resolveFormalCoachDecision(
      decision,
      decision.choices[0].id,
      actorSource,
    )
    vi.restoreAllMocks()

    expect(resolution.result.homeScoreChange).toBe(1)
    expect(resolution.visualEvent.source).toMatchObject({
      phase: 'result',
      choiceId: decision.choices[0].id,
    })
    expect(resolution.visualEvent.outcome.scoreDelta).toEqual({ red: 1, blue: 0 })
    expect(resolution.visualEvent.outcome.statsDelta).toMatchObject({
      shots: 1,
      shotsOnTarget: 1,
      goals: 1,
    })
    expect(validateMatchVisualEvent(resolution.visualEvent, actorSource))
      .toEqual({ valid: true, errors: [] })
  })

  it('tracks a match penalty as a shot and penalty without networking', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const decision = buildFormalCoachDecision({ actorSource, sequenceIndex: 4 })
    const resolution = resolveFormalCoachDecision(
      decision,
      decision.choices[0].id,
      actorSource,
    )
    vi.restoreAllMocks()

    expect(decision.coachDecisionEvent).toMatchObject({
      type: 'penalty_kick',
    })
    expect(decision.coachDecisionEvent.timeoutSeconds).toBeGreaterThanOrEqual(3)
    expect(decision.coachDecisionEvent.timeoutSeconds).toBeLessThanOrEqual(6)
    expect(resolution.visualEvent.outcome.statsDelta).toMatchObject({
      penalties: 1,
      shots: 1,
      shotsOnTarget: 1,
    })
    expect(resolution.visualEvent.invariants.networking).toBe('none')
  })
})
