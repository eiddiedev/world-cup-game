import { describe, expect, it, vi } from 'vitest'

import { DECISION_LIBRARY } from '../data/decisionLibrary.js'
import { renderCoachDecisionCommentary } from './coachDecisionEvent.js'
import {
  DECISION_RUNTIME_SCENE_TYPES,
  getDecisionRuntimeSceneType,
  validateDecisionRuntimeSceneCoverage,
} from './decisionRuntimeScene.js'
import { executeDecision } from './decisionSystem.js'
import { buildHappySeedRuntimeActorConfig } from './happySeedRuntimeActors.js'
import {
  createMatchVisualEventFromCoachDecision,
  validateMatchVisualEvent,
} from './matchVisualEvent.js'

const fullPositionLineup = [
  { id: 'fw-runtime-test', name: '测试前锋', position: 'FW', number: 9, tec: 91, spd: 92, phy: 84, def: 45, sta: 91, star: 4 },
  { id: 'mf-runtime-test', name: '测试中场', position: 'MF', number: 10, tec: 92, spd: 84, phy: 78, def: 82, sta: 91, star: 4 },
  { id: 'df-runtime-test', name: '测试后卫', position: 'DF', number: 4, tec: 75, spd: 84, phy: 91, def: 93, sta: 91, star: 4 },
  { id: 'gk-runtime-test', name: '测试门将', position: 'GK', number: 1, tec: 72, spd: 78, phy: 89, def: 93, sta: 91, star: 4 },
]

const gameState = {
  minute: 52,
  team: 'france',
  opponentName: '巴西',
  oppDefense: 77,
  teamAvgRating: 86,
  teamDifficulty: 3,
  scoreDiff: 0,
}

describe('53场景共用正式 Runtime 事件桥', () => {
  const actorSource = buildHappySeedRuntimeActorConfig()

  it('maps every local decision scenario to a supported scene family', () => {
    expect(DECISION_LIBRARY).toHaveLength(53)
    expect(validateDecisionRuntimeSceneCoverage(DECISION_LIBRARY)).toEqual({
      valid: true,
      covered: 53,
      total: 53,
      missing: [],
    })
    expect(new Set(DECISION_LIBRARY.map(getDecisionRuntimeSceneType)))
      .toEqual(new Set(DECISION_RUNTIME_SCENE_TYPES))
  })

  it.each(DECISION_LIBRARY.map((scenario, index) => [scenario.id, index]))(
    'builds %s with commentary, actors, ball path, camera and actions',
    (scenarioId, sequence) => {
      const scenario = DECISION_LIBRARY[sequence]
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const decision = executeDecision(scenario, fullPositionLineup, gameState)
      vi.restoreAllMocks()

      const event = decision.coachDecisionEvent
      expect(event).toBeTruthy()
      expect(event.sourceScenarioId).toBe(scenarioId)
      expect(event.type).toBe(getDecisionRuntimeSceneType(scenario))
      expect(event.animationPrelude.animationType).toBe(scenario.animationTag)
      expect(event.timeoutSeconds).toBeGreaterThanOrEqual(3)
      expect(event.timeoutSeconds).toBeLessThanOrEqual(6)

      for (const choice of decision.choices) {
        for (const outcome of new Set(choice.possible_outcomes)) {
          expect(renderCoachDecisionCommentary(event, { outcome, choice }))
            .toEqual(expect.any(String))
        }
      }

      const choice = decision.choices[0]
      const outcome = choice.possible_outcomes[0]
      const resultText = renderCoachDecisionCommentary(event, { outcome, choice })
      const visualEvent = createMatchVisualEventFromCoachDecision({
        coachDecisionEvent: event,
        result: { outcome, homeScoreChange: 0, awayScoreChange: 0 },
        resultText,
        actorSource,
        side: 'red',
        sequence: sequence + 1,
      })

      expect(visualEvent).toBeTruthy()
      expect(visualEvent.sourceScenarioId).toBe(scenarioId)
      expect(visualEvent.runtime).toMatchObject({
        cameraPreset: expect.any(String),
        sceneProfile: expect.any(String),
        actionProfile: expect.any(String),
        presentationOnly: true,
      })
      expect(visualEvent.ball.path[0]).toHaveLength(2)
      expect(visualEvent.ball.sourceRuntimeActorId)
        .toBe(visualEvent.actors[visualEvent.ball.sourceRole].runtimeActorId)
      expect(visualEvent.ball.targetRuntimeActorId)
        .toBe(visualEvent.actors[visualEvent.ball.targetRole].runtimeActorId)
      expect(validateMatchVisualEvent(visualEvent, actorSource))
        .toEqual({ valid: true, errors: [] })
    },
  )
})
