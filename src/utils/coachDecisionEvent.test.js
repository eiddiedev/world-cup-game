import { describe, expect, it, vi } from 'vitest'

import { COACH_DECISION_EVENT_DEFINITIONS } from '../data/coachDecisionEvents.js'
import { DECISION_LIBRARY, getScenarioById } from '../data/decisionLibrary.js'
import {
  executeDecision,
  resolveChoiceResult,
} from './decisionSystem.js'
import {
  getCoachDecisionAnimationResult,
  renderCoachDecisionCommentary,
} from './coachDecisionEvent.js'
import { buildPostMatchInsights } from './postMatchInsights.js'

const REQUIRED_FIELDS = [
  'id',
  'type',
  'minute',
  'team',
  'keyPlayers',
  'options',
  'timeoutSeconds',
  'successFormula',
  'riskTags',
  'rewardTags',
  'animationPrelude',
  'animationResult',
  'commentaryTemplates',
  'postMatchReviewTag',
]

const strongLineup = [
  { id: 'fw-strong', name: '强力前锋', position: 'FW', number: 9, tec: 94, spd: 93, phy: 88, def: 42, sta: 92, star: 5 },
  { id: 'mf-strong', name: '定位球手', position: 'MF', number: 10, tec: 95, spd: 86, phy: 78, def: 70, sta: 91, star: 5 },
  { id: 'df-strong', name: '主力中卫', position: 'DF', number: 4, tec: 76, spd: 85, phy: 92, def: 94, sta: 90, star: 5 },
  { id: 'gk-strong', name: '主力门将', position: 'GK', number: 1, tec: 70, spd: 82, phy: 88, def: 92, sta: 90, star: 5 },
]

const weakLineup = strongLineup.map(player => ({
  ...player,
  id: `${player.id}-weak`,
  name: `替补${player.name}`,
  tec: 52,
  spd: 52,
  phy: 52,
  def: 52,
  sta: 55,
  star: 1,
}))

const gameState = {
  minute: 38,
  team: 'france',
  opponentName: '巴西',
  oppDefense: 76,
  teamAvgRating: 84,
  teamDifficulty: 3,
  scoreDiff: 0,
}

describe('CoachDecisionEvent phase one', () => {
  it('registers the representative event definitions used by MatchVisualEvent and the formal penalty choice', () => {
    expect(COACH_DECISION_EVENT_DEFINITIONS.map(item => item.sourceScenarioId)).toEqual([
      'penalty_area_cross',
      'solo_run_penalty',
      'header_corner',
      'freekick_dangerous',
      'penalty_area_foul_risk',
      'match_penalty',
    ])
  })

  it.each(COACH_DECISION_EVENT_DEFINITIONS)(
    'builds $type with the complete standard contract',
    definition => {
      const scenario = getScenarioById(definition.sourceScenarioId)
      const decision = executeDecision(scenario, strongLineup, gameState)
      const event = decision.coachDecisionEvent

      expect(event).toBeTruthy()
      REQUIRED_FIELDS.forEach(field => expect(event).toHaveProperty(field))
      expect(event.sourceScenarioId).toBe(definition.sourceScenarioId)
      expect(event.minute).toBe(38)
      expect(event.team).toBe('france')
      expect(event.options).toHaveLength(scenario.choices.length)
      expect(event.options.every(option => Number.isFinite(option.successProbability))).toBe(true)
      expect(event.successFormula.model).toBe('weighted-player-context-v1')
      expect(Object.keys(event.animationResult.outcomeTags).length).toBeGreaterThan(0)
      expect(decision.situation).not.toMatch(/\{[^}]+\}/)
    },
  )

  it('changes one-on-one probability with player ability and opponent context', () => {
    const scenario = getScenarioById('solo_run_penalty')
    const strongDecision = executeDecision(scenario, strongLineup, gameState)
    const weakDecision = executeDecision(scenario, weakLineup, {
      ...gameState,
      oppDefense: 88,
      teamAvgRating: 54,
      teamDifficulty: 5,
    })

    expect(strongDecision.choices[0].successProb).toBeGreaterThan(weakDecision.choices[0].successProb)
    expect(strongDecision.coachDecisionEvent.options[0].successProbability)
      .toBe(strongDecision.choices[0].successProb)
  })

  it('keeps every resolved outcome inside the choice possible_outcomes across the whole library', () => {
    const player = strongLineup[0]
    const iterations = 40
    for (const scenario of DECISION_LIBRARY) {
      for (const choice of scenario.choices) {
        for (let index = 0; index < iterations; index += 1) {
          const result = resolveChoiceResult(choice, player, gameState)
          expect(
            choice.possible_outcomes,
            `${scenario.id}/${choice.id} -> ${result.outcome}`,
          ).toContain(result.outcome)
        }
      }
    }
  })

  it('can resolve the same solo-shot choice to success or failure', () => {
    const choice = getScenarioById('solo_run_penalty').choices.find(item => item.id === 'far_post_shot')
    const player = strongLineup[0]

    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0)
    const scored = resolveChoiceResult(choice, player, gameState)
    vi.restoreAllMocks()

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0)
    const missed = resolveChoiceResult(choice, player, gameState)

    expect(scored).toMatchObject({ outcome: 'goal_chip', isSuccess: true, homeScoreChange: 1 })
    expect(missed.isSuccess).toBe(false)
    expect(missed.homeScoreChange).toBe(0)
  })

  it('records defensive goal outcomes on the opponent score authority', () => {
    const choice = getScenarioById('gk_one_on_one').choices[0]
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0)
    const result = resolveChoiceResult(choice, strongLineup[3], gameState)
    vi.restoreAllMocks()

    expect(result).toMatchObject({
      outcome: 'goal_chip_over',
      homeScoreChange: 0,
      awayScoreChange: 1,
    })
  })

  it('emits result animation and player-facing post-match copy without debug tags', () => {
    const decision = executeDecision(getScenarioById('freekick_dangerous'), strongLineup, gameState)
    const event = decision.coachDecisionEvent
    const animation = getCoachDecisionAnimationResult(event, 'goal_freekick')
    const commentary = renderCoachDecisionCommentary(event, { outcome: 'goal_freekick' })

    expect(event.animationPrelude).toMatchObject({
      animationType: 'attack_freekick',
      eventTag: 'coach.dangerous-free-kick.prelude',
    })
    expect(animation).toMatchObject({
      animationType: 'attack_freekick',
      outcome: 'goal_freekick',
      eventTag: 'coach.dangerous-free-kick.result.goal_freekick',
    })
    expect(commentary).toContain('弧线球')

    const insights = buildPostMatchInsights({
      homeScore: 1,
      awayScore: 0,
      decisions: [{
        minute: event.minute,
        situation: event.situation,
        choiceLabel: '直接射门',
        resultText: commentary,
        isSuccess: true,
        postMatchReviewTag: event.postMatchReviewTag,
        sourceEventId: 'runtime.freekick.61',
      }],
    }, '法国')
    expect(insights.decisionItems[0]).toContain('选择“直接射门”')
    expect(insights.decisionItems[0]).not.toContain('复盘:')
    expect(insights.decisionItems[0]).not.toContain('事件:')
  })
})
