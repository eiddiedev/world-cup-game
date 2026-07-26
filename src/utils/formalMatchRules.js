import { patchHappySeedRuntimeActor } from './happySeedRuntimeActors.js'
import { getLogisticsModifiers } from './logisticsEffects.js'

export const FORMAL_MATCH_RULES_SCHEMA_VERSION = 'formal-match-rules-v1'

export const FORMAL_MATCH_RULE_INCIDENT_TYPES = Object.freeze([
  'fatigue',
  'injury',
  'yellow-card',
  'red-card',
  'suspension',
])

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)))
}

function actorsFromSource(actorSource = {}) {
  const candidates = [
    ...(actorSource.actors || []),
    ...Object.values(actorSource.sides || {}).flatMap((side) => [
      ...(side?.bench || []),
      ...(side?.inactive || []),
    ]),
  ]
  const byPlayerId = new Map()
  candidates.forEach((actor) => {
    if (!actor?.playerId) return
    const previous = byPlayerId.get(actor.playerId)
    if (!previous || actor.state?.onPitch || actor.state?.redCard || actor.state?.injured) {
      byPlayerId.set(actor.playerId, actor)
    }
  })
  return [...byPlayerId.values()]
}

function actorPatchForIncident(actor, incident) {
  switch (incident.type) {
    case 'fatigue':
      return { staminaDelta: Number(incident.staminaDelta) || 0 }
    case 'injury':
      return { injured: incident.injured !== false }
    case 'yellow-card':
      return { yellowCard: true }
    case 'red-card':
      return { redCard: true }
    case 'suspension':
      return { status: 'suspended' }
    default:
      return null
  }
}

export function applyFormalMatchRuleIncident(actorConfig, incident = {}) {
  if (!FORMAL_MATCH_RULE_INCIDENT_TYPES.includes(incident.type)) return null
  const actor = (actorConfig?.actors || []).find((candidate) => (
    candidate.runtimeActorId === incident.runtimeActorId
    || candidate.playerId === incident.playerId
  ))
  if (!actor) return null
  const patch = actorPatchForIncident(actor, incident)
  if (!patch) return null
  const nextConfig = patchHappySeedRuntimeActor(
    actorConfig,
    actor.runtimeActorId,
    patch,
  )
  const updated = nextConfig?.actors?.find((candidate) => (
    candidate.runtimeActorId === actor.runtimeActorId
  ))
  if (!updated) return null

  return {
    actorConfig: nextConfig,
    incident: {
      schemaVersion: FORMAL_MATCH_RULES_SCHEMA_VERSION,
      type: incident.type,
      minute: Math.max(0, Number(incident.minute) || 0),
      side: updated.side,
      playerId: updated.playerId,
      runtimeActorId: updated.runtimeActorId,
      playerName: updated.name,
      secondYellow: incident.type === 'yellow-card' && updated.state.yellowCards >= 2,
      removesActor: updated.state.onPitch === false,
      state: { ...updated.state },
    },
  }
}

export function buildFormalMatchRuleReport(actorSource, options = {}) {
  const actors = actorsFromSource(actorSource)
  const playerStates = Object.fromEntries(actors.map((actor) => [actor.playerId, {
    name: actor.name,
    number: actor.number,
    stamina: Number(actor.state?.stamina ?? 80),
    status: actor.state?.status || 'available',
    side: actor.side,
    onPitch: Boolean(actor.state?.onPitch),
    injured: Boolean(actor.state?.injured),
    morale: Number(actor.state?.morale ?? 70),
    form: Number(actor.state?.form ?? 70),
    yellowCards: Number(actor.state?.yellowCards || 0),
    redCard: Boolean(actor.state?.redCard),
    substitutedOut: Boolean(actor.state?.substitutedOut),
    staminaBefore: Number(
      options.previousPlayerStates?.[actor.playerId]?.stamina
      ?? options.previousPlayerStatuses?.[actor.playerId]
      ?? actor.operationAttributes?.sta
      ?? 80,
    ),
  }]))

  return {
    schemaVersion: FORMAL_MATCH_RULES_SCHEMA_VERSION,
    matchId: options.matchId || `match-${Number(options.matchIndex) || 0}`,
    completedAt: options.completedAt || null,
    playerStates,
    injuredPlayerIds: actors
      .filter((actor) => actor.state?.injured)
      .map((actor) => actor.playerId),
    redCardedPlayerIds: actors
      .filter((actor) => actor.state?.redCard || actor.state?.status === 'red-carded')
      .map((actor) => actor.playerId),
    formationHistory: Object.fromEntries(Object.entries(actorSource?.sides || {}).map(
      ([side, sideData]) => [side, [...(sideData?.formationHistory || [])]],
    )),
    substitutionHistory: Object.fromEntries(Object.entries(actorSource?.sides || {}).map(
      ([side, sideData]) => [side, [...(sideData?.substitutionHistory || [])]],
    )),
    tactics: Object.fromEntries(Object.entries(actorSource?.sides || {}).map(
      ([side, sideData]) => [side, {
        stance: sideData?.tacticalStance || 'balanced',
        effects: sideData?.tacticalEffects || null,
      }],
    )),
  }
}

export function settleRunMatchRules(currentRun = {}, report = {}, options = {}) {
  const homePlayerIds = new Set(Object.entries(report.playerStates || {})
    .filter(([, state]) => state.side === 'red')
    .map(([playerId]) => playerId))
  const currentSuspensions = {
    ...(currentRun.suspensionMatches || {}),
  }
  ;(currentRun.suspendedPlayers || []).forEach((playerId) => {
    if (!currentSuspensions[playerId]) currentSuspensions[playerId] = 1
  })
  const nextSuspensions = Object.fromEntries(
    Object.entries(currentSuspensions)
      .map(([playerId, matches]) => [playerId, Math.max(0, Number(matches) - 1)])
      .filter(([, matches]) => matches > 0),
  )
  unique(report.redCardedPlayerIds).filter((playerId) => homePlayerIds.has(playerId)).forEach((playerId) => {
    nextSuspensions[playerId] = Math.max(nextSuspensions[playerId] || 0, 1)
  })

  // 后勤医疗部门：伤病概率减免
  const logisticsLevels = options.logisticsLevels || currentRun.logisticsLevels || {}
  const modifiers = getLogisticsModifiers(logisticsLevels)

  const currentInjuries = { ...(currentRun.injuryMatches || {}) }
  ;(currentRun.injuredPlayers || []).forEach((playerId) => {
    if (!currentInjuries[playerId]) currentInjuries[playerId] = 1
  })
  const nextInjuries = Object.fromEntries(
    Object.entries(currentInjuries)
      .map(([playerId, matches]) => [playerId, Math.max(0, Number(matches) - 1)])
      .filter(([, matches]) => matches > 0),
  )
  unique(report.injuredPlayerIds).filter((playerId) => homePlayerIds.has(playerId)).forEach((playerId) => {
    // 如果 injuryProbMultiplier < 1，有概率免除伤病
    if (modifiers.injuryProbMultiplier < 1 && Math.random() > modifiers.injuryProbMultiplier) {
      return // 免除本次伤病
    }
    const stamina = Number(report.playerStates?.[playerId]?.stamina ?? 50)
    nextInjuries[playerId] = Math.max(nextInjuries[playerId] || 0, stamina <= 20 ? 2 : 1)
  })

  const playerMatchStates = {
    ...(currentRun.playerMatchStates || {}),
    ...Object.fromEntries(Object.entries(report.playerStates || {})
      .filter(([, state]) => state.side === 'red')),
  }
  const playerStatuses = {
    ...(currentRun.playerStatuses || {}),
  }
  Object.entries(report.playerStates || {}).filter(([, state]) => state.side === 'red').forEach(([playerId, state]) => {
    playerStatuses[playerId] = Math.max(0, Math.min(100, Number(state.stamina ?? 80)))
  })
  const normalizedReport = {
    schemaVersion: report.schemaVersion || FORMAL_MATCH_RULES_SCHEMA_VERSION,
    matchId: report.matchId || `match-${Number(currentRun.matchIndex) || 0}`,
    completedAt: report.completedAt || null,
    playerStates: report.playerStates || {},
    injuredPlayerIds: unique(report.injuredPlayerIds).filter((playerId) => homePlayerIds.has(playerId)),
    redCardedPlayerIds: unique(report.redCardedPlayerIds).filter((playerId) => homePlayerIds.has(playerId)),
    formationHistory: report.formationHistory || {},
    substitutionHistory: report.substitutionHistory || {},
    tactics: report.tactics || {},
  }

  return {
    ...currentRun,
    playerStatuses,
    playerMatchStates,
    injuredPlayers: Object.keys(nextInjuries),
    injuryMatches: nextInjuries,
    suspendedPlayers: Object.keys(nextSuspensions),
    suspensionMatches: nextSuspensions,
    lastMatchRuleReport: normalizedReport,
    matchRuleHistory: [
      ...(currentRun.matchRuleHistory || []),
      normalizedReport,
    ].slice(-20),
  }
}
