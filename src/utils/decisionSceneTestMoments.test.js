/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { DECISION_LIBRARY } from '../data/decisionLibrary.js'
import { buildHappySeedRuntimeActorConfig } from './happySeedRuntimeActors.js'
import { buildFormalCoachDecision } from './formalCoachDecision.js'
import { buildFormalDecisionSceneScriptV3 } from './decisionSceneScriptV3.js'
import {
  buildDecisionSceneTestMoment,
  decisionSceneTestWeather,
} from './decisionSceneTestMoments.js'

const actorSource = buildHappySeedRuntimeActorConfig()

describe('decision scene test moments', () => {
  it('stages every one of the 53 scenarios into a valid moment and a buildable script', () => {
    for (const scenario of DECISION_LIBRARY) {
      const moment = buildDecisionSceneTestMoment(scenario.id, actorSource)
      expect(moment.actorPositions, scenario.id).toHaveLength(22)
      expect(moment.ownerRuntimeActorId, scenario.id).toBeTruthy()
      expect(moment.ball.normalized[0], scenario.id).toBeGreaterThanOrEqual(0)
      expect(moment.ball.normalized[0], scenario.id).toBeLessThanOrEqual(1)
      expect(moment.ball.normalized[1], scenario.id).toBeGreaterThanOrEqual(0)
      expect(moment.ball.normalized[1], scenario.id).toBeLessThanOrEqual(1)
      const ownerEntry = moment.actorPositions.find((entry) => (
        entry.runtimeActorId === moment.ownerRuntimeActorId
      ))
      expect(ownerEntry, scenario.id).toBeTruthy()
      const decision = buildFormalCoachDecision({
        actorSource,
        scenarioId: scenario.id,
        minute: 44,
      })
      const script = buildFormalDecisionSceneScriptV3(decision, actorSource, moment, null)
      expect(script.choices.length, scenario.id).toBeGreaterThan(0)
    }
  })

  it('places defensive scenarios on the coached goal side and attackers on theirs', () => {
    const defensive = buildDecisionSceneTestMoment('penalty_area_foul_risk', actorSource)
    expect(defensive.attackingSide).toBe('blue')
    expect(defensive.ball.normalized[0]).toBeLessThanOrEqual(0.3)
    const attacking = buildDecisionSceneTestMoment('solo_run_penalty', actorSource)
    expect(attacking.attackingSide).toBe('red')
    expect(attacking.ball.normalized[0]).toBeGreaterThanOrEqual(0.7)
  })

  it('marks weather per scenario contract', () => {
    expect(decisionSceneTestWeather('weather_slippery_tackle')).toBe('rain')
    expect(decisionSceneTestWeather('penalty_kick')).toBe('clear')
  })

  it('keeps the keeper distribution scenario with the keeper holding the ball', () => {
    const moment = buildDecisionSceneTestMoment('keeper_distribution', actorSource)
    expect(moment.ballInHands).toBe(true)
    expect(moment.ownerIsGoalkeeper).toBe(true)
  })
})
