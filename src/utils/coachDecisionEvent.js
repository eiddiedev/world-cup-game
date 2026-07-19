import { getCoachDecisionDefinition } from '../data/coachDecisionEvents.js'

/**
 * @typedef {Object} CoachDecisionEvent
 * @property {string} id
 * @property {string} type
 * @property {number} minute
 * @property {string} team
 * @property {Object} keyPlayers
 * @property {Array<Object>} options
 * @property {number} timeoutSeconds
 * @property {Object} successFormula
 * @property {Array<string>} riskTags
 * @property {Array<string>} rewardTags
 * @property {Object} animationPrelude
 * @property {Object} animationResult
 * @property {Object} commentaryTemplates
 * @property {string} postMatchReviewTag
 */

function normalizeTeam(team) {
  if (typeof team === 'string' && team) return team
  return team?.id || team?.name || 'my'
}

function normalizePlayer(player, role, team) {
  if (!player) return null
  return {
    role,
    id: player.id || null,
    name: player.name || '队员',
    number: player.number || null,
    position: player.position || player.pos || null,
    team,
  }
}

function normalizeOption(choice) {
  return {
    id: choice.id,
    label: choice.label,
    description: choice.desc,
    risk: choice.risk,
    reward: choice.reward,
    abilityWeights: (choice.weight_formula || []).map(({ attr, weight }) => ({ attr, weight })),
    successProbability: choice.successProb,
    possibleOutcomes: [...(choice.possible_outcomes || [])],
  }
}

function fillTemplate(template, event, choice) {
  const primary = event.keyPlayers.primary
  const support = event.keyPlayers.support
  return template
    .replace(/\{minute\}/g, String(event.minute))
    .replace(/\{player\}/g, primary?.name || '队员')
    .replace(/\{player2\}/g, support?.name || '队友')
    .replace(/\{opponent\}/g, event.opponent || '对方前锋')
    .replace(/\{choice\}/g, choice?.label || '当前选择')
}

export function renderCoachDecisionCommentary(event, { phase = 'result', outcome, choice } = {}) {
  if (!event?.commentaryTemplates) return null
  const templates = phase === 'prelude'
    ? event.commentaryTemplates.prelude
    : event.commentaryTemplates.results?.[outcome]
  if (!Array.isArray(templates) || templates.length === 0) return null
  const template = templates[Math.abs(event.minute || 0) % templates.length]
  return fillTemplate(template, event, choice)
}

export function getCoachDecisionAnimationResult(event, outcome) {
  if (!event?.animationResult || !outcome) return null
  return event.animationResult.outcomeTags?.[outcome] || {
    animationType: event.animationResult.animationType,
    outcome,
    eventTag: `${event.animationResult.eventTagPrefix}.${outcome}`,
  }
}

export function createCoachDecisionEvent({
  scenario,
  minute,
  team,
  opponent,
  keyPlayers = {},
  options = [],
  situation = '',
}) {
  const definition = getCoachDecisionDefinition(scenario?.id, scenario)
  if (!definition) return null

  const normalizedTeam = normalizeTeam(team)
  const normalizedOptions = options.map(normalizeOption)
  const outcomes = Array.from(new Set(
    normalizedOptions.flatMap(option => option.possibleOutcomes),
  ))
  const outcomeTags = Object.fromEntries(outcomes.map(outcome => [outcome, {
    animationType: definition.animationResult.animationType,
    outcome,
    eventTag: `${definition.animationResult.eventTagPrefix}.${outcome}`,
  }]))

  const event = {
    schemaVersion: 1,
    id: `${definition.id}:${normalizedTeam}:${Number(minute) || 0}`,
    type: definition.type,
    minute: Number(minute) || 0,
    team: normalizedTeam,
    opponent: opponent || '对方前锋',
    keyPlayers: {
      primary: normalizePlayer(keyPlayers.default, 'primary', normalizedTeam),
      support: normalizePlayer(keyPlayers.second, 'support', normalizedTeam),
    },
    options: normalizedOptions,
    timeoutSeconds: scenario.countdownSeconds || definition.timeoutSeconds,
    successFormula: {
      ...definition.successFormula,
      optionWeights: Object.fromEntries(normalizedOptions.map(option => [option.id, option.abilityWeights])),
    },
    riskTags: [...definition.riskTags],
    rewardTags: [...definition.rewardTags],
    animationPrelude: { ...definition.animationPrelude },
    animationResult: {
      ...definition.animationResult,
      outcomeTags,
    },
    commentaryTemplates: definition.commentaryTemplates,
    postMatchReviewTag: definition.postMatchReviewTag,
    sourceScenarioId: scenario.id,
    situation,
  }

  event.situation = renderCoachDecisionCommentary(event, { phase: 'prelude' }) || situation
  return event
}
