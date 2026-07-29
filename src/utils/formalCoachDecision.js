import { DECISION_LIBRARY, getScenarioById } from '../data/decisionLibrary.js'
import { getTeamById } from '../data/teams.js'
import {
  resolveChoiceResult,
  resolveMatchPenaltyChoice,
  executeDecision,
} from './decisionSystem.js'
import { renderCoachDecisionCommentary } from './coachDecisionEvent.js'
import { createMatchVisualEventFromCoachDecision } from './matchVisualEvent.js'
import { lockerRoomMoraleBonus } from './lockerRoomDecisions.js'

export const FORMAL_COACH_DECISION_SEQUENCE = Object.freeze([
  Object.freeze({ scenarioId: 'solo_run_penalty', minute: 18, label: '单刀' }),
  Object.freeze({ scenarioId: 'header_corner', minute: 31, label: '角球' }),
  Object.freeze({ scenarioId: 'freekick_dangerous', minute: 44, label: '危险任意球' }),
  Object.freeze({ scenarioId: 'penalty_area_foul_risk', minute: 63, label: '禁区犯规风险' }),
  Object.freeze({ scenarioId: 'match_penalty', minute: 78, label: '点球' }),
])

export const FORMAL_COACH_RUNTIME_V2_SEQUENCE = Object.freeze([
  FORMAL_COACH_DECISION_SEQUENCE.find((entry) => entry.scenarioId === 'freekick_dangerous'),
])

export const FORMAL_COACH_DECISION_CATALOG = Object.freeze(
  DECISION_LIBRARY.map((scenario, index) => Object.freeze({
    scenarioId: scenario.id,
    minute: Math.round(8 + (index * 80) / Math.max(1, DECISION_LIBRARY.length - 1)),
    label: scenario.trigger,
  })),
)

const NEGATIVE_RISK_WORDS = /红牌|点球|极高|最大|直接反击|几乎必丢|高风险|犯规/
const MODERATE_RISK_WORDS = /偏出|扑出|解围|丢球|失误|打飞|门将猜对|空间关闭/
const SHOT_OUTCOME = /goal|saved|miss|shot|header|freekick|volley|blocked|post|wide|over|placement|power|panenka|chip/

function mean(values, fallback = 70) {
  if (!values.length) return fallback
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
}

function activeDecisionLineup(actorSource, teamId, side) {
  const team = getTeamById(teamId)
  if (!team) throw new Error(`未知决策球队：${teamId}`)
  const playersById = new Map(team.players.map((player) => [player.id, player]))
  return (actorSource?.actors || [])
    .filter((actor) => actor.side === side && actor.state?.onPitch)
    .map((actor) => {
      const player = playersById.get(actor.playerId)
      if (!player) throw new Error(`决策 actor 缺少业务球员：${actor.playerId}`)
      return {
        ...player,
        position: actor.assignedPosition || player.position,
        sta: actor.state?.stamina ?? player.sta,
        stamina: actor.state?.stamina ?? player.stamina,
        runtimeActorId: actor.runtimeActorId,
        runtimeIndex: actor.runtimeIndex,
      }
    })
}

function decisionGameState({ actorSource, side, teamId, opponentTeamId, minute, authorityState }) {
  const opponentSide = side === 'red' ? 'blue' : 'red'
  const lineup = activeDecisionLineup(actorSource, teamId, side)
  const opponentLineup = activeDecisionLineup(actorSource, opponentTeamId, opponentSide)
  const team = getTeamById(teamId)
  const opponent = getTeamById(opponentTeamId)
  return {
    lineup,
    state: {
      minute,
      team: team.id,
      opponentName: opponent.name,
      oppDefense: Math.round(mean(opponentLineup.map((player) => player.def))),
      teamAvgRating: Math.round(mean(lineup.map((player) => player.rating))),
      teamDifficulty: 3,
      myScore: Number(authorityState?.score?.[side] || 0),
      oppScore: Number(authorityState?.score?.[opponentSide] || 0),
      scoreDiff: Number(authorityState?.score?.[side] || 0) - Number(authorityState?.score?.[opponentSide] || 0),
      myAttack: Math.round(mean(lineup.map((player) => player.tec))),
      myDefense: Math.round(mean(lineup.map((player) => player.def))),
      moraleBonus: lockerRoomMoraleBonus(
        (actorSource?.actors || []).filter((actor) => actor.side === side && actor.state?.onPitch),
      ),
      isKnockout: false,
      isExtraTime: false,
    },
  }
}

export function buildFormalCoachDecision({
  actorSource,
  sequenceIndex = 0,
  schedule = FORMAL_COACH_DECISION_SEQUENCE,
  side = 'red',
  teamId = 'france',
  opponentTeamId = 'brazil',
  scenarioId,
  minute,
  label,
  preferredPlayerId,
  authorityState,
} = {}) {
  const plan = scenarioId
    ? { scenarioId, minute: Number(minute) || 1, label: label || getScenarioById(scenarioId)?.trigger }
    : schedule[sequenceIndex]
  if (!plan) return null
  const scenario = getScenarioById(plan.scenarioId)
  if (!scenario) throw new Error(`未知正式决策场景：${plan.scenarioId}`)
  const { lineup, state } = decisionGameState({
    actorSource,
    side,
    teamId,
    opponentTeamId,
    minute: plan.minute,
    authorityState,
  })
  const decision = executeDecision(scenario, lineup, state, { preferredPlayerId })
  if (!decision.coachDecisionEvent) {
    throw new Error(`决策场景缺少 CoachDecisionEvent：${plan.scenarioId}`)
  }
  return {
    ...decision,
    id: decision.coachDecisionEvent.id,
    label: plan.label,
    sequenceIndex,
    sequenceNumber: sequenceIndex + 1,
    side,
    teamId,
    opponentTeamId,
    gameState: state,
  }
}

function riskRank(choice) {
  const risk = String(choice?.risk || '')
  if (NEGATIVE_RISK_WORDS.test(risk)) return 2
  if (MODERATE_RISK_WORDS.test(risk)) return 1
  return 0
}

export function findConservativeFormalCoachChoice(decision) {
  const choices = decision?.choices || []
  return [...choices].sort((left, right) => (
    riskRank(left) - riskRank(right)
    || Number(right.successProb || 0) - Number(left.successProb || 0)
    || choices.indexOf(left) - choices.indexOf(right)
  ))[0] || null
}

function createPreludeOutcome() {
  return {
    id: 'decision_pending',
    scoreDelta: { red: 0, blue: 0 },
    statsDelta: {},
    opponentStatsDelta: {},
  }
}

export function createFormalCoachDecisionPreludeVisualEvent(decision, actorSource) {
  const coachDecisionEvent = decision?.coachDecisionEvent
  if (!coachDecisionEvent) throw new Error('缺少 CoachDecisionEvent 前奏合同')
  const event = createMatchVisualEventFromCoachDecision({
    coachDecisionEvent,
    result: { outcome: 'decision_pending' },
    resultText: coachDecisionEvent.situation,
    actorSource,
    side: decision.side,
    sequence: (decision.sequenceIndex * 2) + 1,
  })
  if (!event) throw new Error(`决策前奏缺少视觉映射：${coachDecisionEvent.sourceScenarioId}`)
  return {
    ...event,
    id: `coach.${coachDecisionEvent.sourceScenarioId}.${decision.sequenceNumber}.prelude`,
    label: `${decision.label}铺垫`,
    outcome: createPreludeOutcome(),
    commentary: {
      prelude: coachDecisionEvent.situation,
      result: coachDecisionEvent.situation,
      outcomeLabel: '等待教练选择',
    },
    source: {
      ...event.source,
      phase: 'prelude',
      choiceId: null,
    },
  }
}

function decisionAuthorityDeltas(decision, result) {
  const outcome = String(result.outcome || '')
  const scenarioId = decision.coachDecisionEvent.sourceScenarioId
  const statsDelta = {}
  const opponentStatsDelta = {}
  const isShot = SHOT_OUTCOME.test(outcome)
  const isGoalFor = Number(result.homeScoreChange) > 0
  const isGoalAgainst = Number(result.awayScoreChange) > 0
  const isOnTarget = isGoalFor || /saved/.test(outcome)

  const attackingCornerScenario = /^(header_corner|second_ball_corner_attack|late_keeper_up_corner)$/.test(scenarioId)
  const defendingCornerScenario = /^(aerial_duel_corner_defending|opponent_short_corner_defense)$/.test(scenarioId)
  const attackingFreeKickScenario = /^(freekick_dangerous|indirect_freekick_box|set_piece_rebound_shot)$/.test(scenarioId)
  const defendingFreeKickScenario = /^(defend_dangerous_freekick|opponent_dangerous_freekick_wall)$/.test(scenarioId)

  if (attackingCornerScenario) statsDelta.corners = 1
  if (defendingCornerScenario) opponentStatsDelta.corners = 1
  if (attackingFreeKickScenario) statsDelta.freeKicks = 1
  if (defendingFreeKickScenario) opponentStatsDelta.freeKicks = 1
  if (/yellow/.test(outcome)) statsDelta.yellowCards = 1
  if (/red_card/.test(outcome)) statsDelta.redCards = 1
  if (/foul|yellow|red_card/.test(outcome)) statsDelta.fouls = 1

  if (/^(match_penalty|penalty_kick)$/.test(scenarioId)) statsDelta.penalties = 1
  if (scenarioId === 'penalty_area_foul_risk') {
    if (/yellow_card_penalty/.test(outcome)) {
      statsDelta.fouls = 1
      statsDelta.yellowCards = 1
      opponentStatsDelta.penalties = 1
    }
    if (/red_card_penalty/.test(outcome)) {
      statsDelta.fouls = 1
      statsDelta.redCards = 1
      opponentStatsDelta.penalties = 1
    }
    if (/freekick_against/.test(outcome)) statsDelta.fouls = 1
  }

  if (isShot && !isGoalAgainst) {
    statsDelta.shots = 1
    if (isOnTarget) statsDelta.shotsOnTarget = 1
  }
  if (isGoalFor) statsDelta.goals = 1
  if (isGoalAgainst) {
    opponentStatsDelta.shots = 1
    opponentStatsDelta.shotsOnTarget = 1
    opponentStatsDelta.goals = 1
  }
  return { statsDelta, opponentStatsDelta }
}

export function resolveFormalCoachDecisionRule(decision, choiceId, options = {}) {
  const choice = decision?.choices?.find((candidate) => candidate.id === choiceId)
  if (!choice) throw new Error(`未知教练选择：${choiceId}`)
  const keyPlayer = decision.keyPlayers?.default
  let result = decision.coachDecisionEvent.sourceScenarioId === 'match_penalty'
    ? resolveMatchPenaltyChoice(choice, keyPlayer, decision.gameState)
    : resolveChoiceResult(choice, keyPlayer, decision.gameState)
  if (options.outcomeOverride) {
    if (!choice.possible_outcomes?.includes(options.outcomeOverride)) {
      throw new Error(`结果 ${options.outcomeOverride} 不属于选择 ${choiceId}`)
    }
    result = {
      ...result,
      outcome: options.outcomeOverride,
      homeScoreChange: /^goal_/.test(options.outcomeOverride) ? 1 : 0,
      awayScoreChange: 0,
    }
  }
  const resultText = renderCoachDecisionCommentary(
    decision.coachDecisionEvent,
    { outcome: result.outcome, choice },
  ) || `${keyPlayer?.name || '队员'}执行${choice.label}。`
  return {
    decisionId: decision.id,
    choice,
    result,
    resultText,
    authorityDeltas: decisionAuthorityDeltas(decision, result),
  }
}

export function resolveFormalCoachDecision(decision, choiceId, actorSource) {
  const ruleResolution = resolveFormalCoachDecisionRule(decision, choiceId)
  const {
    choice,
    result,
    resultText,
    authorityDeltas,
  } = ruleResolution
  const keyPlayer = decision.keyPlayers?.default
  const event = createMatchVisualEventFromCoachDecision({
    coachDecisionEvent: decision.coachDecisionEvent,
    result,
    resultText,
    actorSource,
    side: decision.side,
    sequence: (decision.sequenceIndex * 2) + 2,
  })
  if (!event) {
    throw new Error(`决策结果缺少视觉映射：${decision.coachDecisionEvent.sourceScenarioId}`)
  }
  const visualEvent = {
    ...event,
    id: `coach.${decision.coachDecisionEvent.sourceScenarioId}.${decision.sequenceNumber}.${choice.id}.result`,
    label: `${decision.label}结果`,
    outcome: {
      id: result.outcome,
      scoreDelta: event.outcome.scoreDelta,
      ...authorityDeltas,
    },
    commentary: {
      prelude: `${keyPlayer?.name || '队员'}执行“${choice.label}”。`,
      result: resultText,
      outcomeLabel: result.outcome,
    },
    source: {
      ...event.source,
      phase: 'result',
      choiceId: choice.id,
    },
  }

  return {
    ...ruleResolution,
    visualEvent,
  }
}
