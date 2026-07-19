import { buildRecommendedNationalSquad } from '../data/rosterRules.js'
import { getTeamDefaultFormation } from '../data/teamFormations.js'
import { getTeamById } from '../data/teams.js'
import { FORMATION_NAMES } from '../data/formationTactics.js'
import {
  adaptLineupToFormation,
  autoSelectLineupForFormation,
} from './lineupFormation.js'
import { HAPPYSEED_HUMAN_PART_SET_ID } from './happySeedHumanPlayer.js'

export const HAPPYSEED_RUNTIME_ACTOR_SCHEMA_VERSION = 'happyseed-runtime-actors-v1'
export const HAPPYSEED_RUNTIME_ACTOR_COUNT = 22
export const HAPPYSEED_FORMATION_TRANSITION_MS = 1600
export const HAPPYSEED_RUNTIME_PLAYER_DISPLAY_SCALE = 0.62

const SIDE_ORDER = ['red', 'blue']
const POSITION_ORDER = ['GK', 'DF', 'MF', 'FW']
const INELIGIBLE_STATUSES = new Set([
  'injured',
  'suspended',
  'unavailable',
  'red-carded',
  'substituted',
])

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function stableHash(value = '') {
  return [...String(value)].reduce(
    (hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0,
    17,
  )
}

function bodyProfileFor(player, assignedPosition) {
  if (assignedPosition === 'GK') return 'france-goalkeeper'
  return stableHash(player.id || player.playerId) % 2 === 0 ? 'france-outfield' : 'brazil-outfield'
}

function buildVisualAssets(teamId, player, assignedPosition, kitVariant) {
  const role = assignedPosition === 'GK' ? 'goalkeeper' : 'outfield'
  const bodyProfileId = bodyProfileFor(player, assignedPosition)
  const kitType = role === 'goalkeeper'
    ? (kitVariant === 'away' ? 'away-goalkeeper' : 'goalkeeper')
    : kitVariant
  const playerRoot = `/pixel/player/${HAPPYSEED_HUMAN_PART_SET_ID}/${bodyProfileId}`

  return {
    bodyProfileId,
    role,
    kitVariant,
    kitType,
    playerRoot,
    kitRoot: `/pixel/kits/${teamId}/${kitType}/${HAPPYSEED_HUMAN_PART_SET_ID}`,
    number: `/pixel/numbers/${HAPPYSEED_HUMAN_PART_SET_ID}/${player.number}.png`,
    headFront: `${playerRoot}/head_front.png`,
    headBack: `${playerRoot}/head_back.png`,
  }
}

function buildBusinessBinding(team, player, assignedPosition, kitVariant, status) {
  const position = assignedPosition || player.position || player.pos || 'MF'
  return {
    playerId: player.id,
    name: player.name,
    number: player.number,
    naturalPosition: player.position || player.pos || 'MF',
    assignedPosition: assignedPosition || null,
    isGoalkeeper: position === 'GK',
    teamId: team.id,
    teamName: team.name,
    partSetId: HAPPYSEED_HUMAN_PART_SET_ID,
    visualRecipeId: player.visualRecipeId,
    visual: buildVisualAssets(team.id, player, position, kitVariant),
    hiddenTraits: [...(player.hiddenTraits || [])],
    operationAttributes: { ...(player.operationAttributes || {}) },
    sourceStatus: player.status || 'available',
    state: {
      status,
      onPitch: status === 'active',
      stamina: clamp(player.stamina ?? player.sta ?? 80, 0, 100),
      yellowCards: 0,
      redCard: false,
      injured: false,
      substitutedOut: false,
    },
  }
}

function evenlySpacedRows(count) {
  if (count <= 1) return [4]
  return Array.from({ length: count }, (_, index) => (
    Math.round(1 + ((6 * index) / (count - 1)))
  ))
}

export function buildHappySeedRuntimeFormation(formation, lineup = []) {
  const spots = POSITION_ORDER.slice(1).flatMap((position) => {
    const slots = lineup.filter((slot) => slot.position === position)
    const column = position === 'DF' ? 3 : position === 'MF' ? 5 : 7
    return evenlySpacedRows(slots.length).map((row) => [
      column,
      row,
      position === 'DF' ? 'D' : position === 'MF' ? 'M' : 'A',
    ])
  })

  return {
    name: formation,
    spots,
  }
}

function normalizePlayerIds(values = []) {
  return new Set(values.map((value) => value?.id || value?.playerId || value).filter(Boolean))
}

function buildRuntimeSide({
  teamId,
  side,
  kitVariant,
  formation,
  squadPlayerIds,
  lineupPlayerIds,
}) {
  const team = getTeamById(teamId)
  if (!team) throw new Error(`未知球队：${teamId}`)

  const selectedFormation = formation || team.defaultFormation || getTeamDefaultFormation(team.id)
  const requestedSquadIds = normalizePlayerIds(squadPlayerIds)
  const requestedLineupIds = normalizePlayerIds(lineupPlayerIds)
  const selectablePool = team.players.filter((player) => (
    !INELIGIBLE_STATUSES.has(player.status)
    && (!requestedSquadIds.size || requestedSquadIds.has(player.id))
  ))
  const squad = requestedSquadIds.size >= 23
    ? selectablePool.slice(0, 23)
    : buildRecommendedNationalSquad(
      team.players.filter((player) => !INELIGIBLE_STATUSES.has(player.status)),
      team.budget,
      selectedFormation,
    )
  const requestedLineup = squad.filter((player) => requestedLineupIds.has(player.id))
  const lineup = autoSelectLineupForFormation(
    requestedLineup.length >= 11 ? requestedLineup : squad,
    selectedFormation,
  )
  const playersById = new Map(squad.map((player) => [player.id, player]))
  const lineupIds = new Set(lineup.map((slot) => slot.playerId))
  const sideOffset = side === 'blue' ? 11 : 0
  const actors = lineup.map((slot, localIndex) => {
    const player = playersById.get(slot.playerId)
    return {
      ...buildBusinessBinding(team, player, slot.position, kitVariant, 'active'),
      runtimeActorId: `${side}-${String(localIndex).padStart(2, '0')}`,
      runtimeIndex: sideOffset + localIndex,
      runtimeLocalIndex: localIndex,
      side,
      formationSlotId: slot.slotId,
    }
  })
  const bench = squad
    .filter((player) => !lineupIds.has(player.id))
    .map((player) => buildBusinessBinding(team, player, null, kitVariant, 'bench'))

  return {
    side,
    teamId: team.id,
    teamName: team.name,
    formation: selectedFormation,
    kitVariant,
    runtimeFormation: buildHappySeedRuntimeFormation(selectedFormation, lineup),
    squadPlayerIds: squad.map((player) => player.id),
    actors,
    bench,
    inactive: [],
    substitutionHistory: [],
    formationHistory: [],
    formationTransition: null,
  }
}

function synchronizeSides(config) {
  for (const side of SIDE_ORDER) {
    config.sides[side].actors = config.actors
      .filter((actor) => actor.side === side)
      .sort((left, right) => left.runtimeLocalIndex - right.runtimeLocalIndex)
  }
  return config
}

export function buildHappySeedRuntimeActorConfig(options = {}) {
  const red = buildRuntimeSide({
    teamId: options.red || 'france',
    side: 'red',
    kitVariant: 'home',
    formation: options.formations?.red?.name || options.redFormation,
    squadPlayerIds: options.redSquadPlayerIds,
    lineupPlayerIds: options.redLineupPlayerIds,
  })
  const blue = buildRuntimeSide({
    teamId: options.blue || 'brazil',
    side: 'blue',
    kitVariant: 'away',
    formation: options.formations?.blue?.name || options.blueFormation,
    squadPlayerIds: options.blueSquadPlayerIds,
    lineupPlayerIds: options.blueLineupPlayerIds,
  })

  return {
    schemaVersion: HAPPYSEED_RUNTIME_ACTOR_SCHEMA_VERSION,
    sourceSchemaVersion: 'team-roster-v2',
    runtime: 'happyseed-11v11-2.5d',
    networking: 'none',
    invariants: {
      authoritativeGameplayLayer: 'happyseed-runtime',
      scoreMutationAllowed: false,
      duplicateActivePlayersAllowed: false,
      reentryAfterSubstitutionAllowed: false,
      reentryAfterRedCardAllowed: false,
      actorTeleportAllowed: false,
    },
    formations: {
      red: red.runtimeFormation,
      blue: blue.runtimeFormation,
    },
    sides: { red, blue },
    actors: [...red.actors, ...blue.actors],
  }
}

function hasScoreKey(value) {
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, nested]) => (
    ['score', 'scores', 'scoreDelta'].includes(key) || hasScoreKey(nested)
  ))
}

export function validateHappySeedRuntimeActorConfig(config) {
  const errors = []
  const actors = config?.actors || []
  const actorIds = actors.map((actor) => actor.runtimeActorId)
  const runtimeIndices = actors.map((actor) => actor.runtimeIndex)
  const activePlayerIds = actors
    .filter((actor) => actor.state?.onPitch)
    .map((actor) => actor.playerId)

  if (config?.schemaVersion !== HAPPYSEED_RUNTIME_ACTOR_SCHEMA_VERSION) errors.push('schemaVersion')
  if (config?.networking !== 'none') errors.push('networking')
  if (hasScoreKey(config)) errors.push('score-boundary')
  if (actors.length !== HAPPYSEED_RUNTIME_ACTOR_COUNT) errors.push('actor-count')
  if (new Set(actorIds).size !== actors.length) errors.push('runtime-actor-id-duplicate')
  if (new Set(runtimeIndices).size !== actors.length) errors.push('runtime-index-duplicate')
  if (new Set(activePlayerIds).size !== activePlayerIds.length) errors.push('active-player-duplicate')

  for (const side of SIDE_ORDER) {
    const sideData = config?.sides?.[side]
    const sideActors = actors.filter((actor) => actor.side === side)
    const squadIds = [
      ...sideActors.map((actor) => actor.playerId),
      ...(sideData?.bench || []).map((player) => player.playerId),
      ...(sideData?.inactive || []).map((player) => player.playerId),
    ]
    const onPitch = sideActors.filter((actor) => actor.state?.onPitch)
    if (sideActors.length !== 11) errors.push(`${side}-actor-count`)
    if (onPitch.length > 11) errors.push(`${side}-on-pitch-count`)
    if (new Set(squadIds).size !== squadIds.length) errors.push(`${side}-squad-duplicate`)
    if (squadIds.length !== 23) errors.push(`${side}-squad-count`)
    if (sideActors.filter((actor) => actor.isGoalkeeper && actor.state?.onPitch).length > 1) {
      errors.push(`${side}-goalkeeper-count`)
    }
  }

  for (const actor of actors) {
    if (!actor.playerId) errors.push(`${actor.runtimeActorId}-playerId`)
    if (!Number.isInteger(actor.number) || actor.number < 1 || actor.number > 99) {
      errors.push(`${actor.runtimeActorId}-number`)
    }
    if (!actor.visualRecipeId) errors.push(`${actor.runtimeActorId}-visualRecipeId`)
    if (!actor.visual?.playerRoot?.startsWith('/pixel/player/')) {
      errors.push(`${actor.runtimeActorId}-playerRoot`)
    }
    if (!actor.visual?.kitRoot?.startsWith('/pixel/kits/')) {
      errors.push(`${actor.runtimeActorId}-kitRoot`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    mappedActorCount: actors.length,
    activeActorCount: activePlayerIds.length,
  }
}

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config))
}

export function patchHappySeedRuntimeActor(config, runtimeActorId, patch = {}) {
  const next = cloneConfig(config)
  const actor = next.actors.find((candidate) => candidate.runtimeActorId === runtimeActorId)
  if (!actor) return null

  if (patch.stamina != null) actor.state.stamina = clamp(patch.stamina, 0, 100)
  if (patch.staminaDelta != null) {
    actor.state.stamina = clamp(actor.state.stamina + Number(patch.staminaDelta), 0, 100)
  }
  if (patch.yellowCards != null) actor.state.yellowCards = clamp(patch.yellowCards, 0, 2)
  if (patch.yellowCard === true) {
    actor.state.yellowCards = clamp(actor.state.yellowCards + 1, 0, 2)
  }
  if (patch.injured != null) {
    actor.state.injured = Boolean(patch.injured)
    if (!actor.state.redCard && actor.state.status !== 'suspended' && !actor.state.substitutedOut) {
      actor.state.status = actor.state.injured ? 'injured' : 'active'
    }
  }
  if (patch.redCard === true || actor.state.yellowCards >= 2) {
    actor.state.redCard = true
    actor.state.status = 'red-carded'
    actor.state.onPitch = false
  }
  if (patch.status === 'suspended') {
    actor.state.status = 'suspended'
    actor.state.onPitch = false
  }

  return synchronizeSides(next)
}

function formationPlayer(actor) {
  return {
    id: actor.playerId,
    position: actor.naturalPosition || actor.assignedPosition || 'MF',
    secondaryPositions: actor.secondaryPositions || [],
    status: actor.state?.onPitch ? 'available' : actor.state?.status,
    stamina: actor.state?.stamina,
    sta: actor.state?.stamina,
    ...(actor.operationAttributes || {}),
  }
}

export function planHappySeedRuntimeFormationChange(actorSource, options = {}) {
  const side = options.side === 'blue' ? 'blue' : 'red'
  const formation = String(options.formation || '')
  if (!FORMATION_NAMES.includes(formation)) return null

  const active = (actorSource?.actors || [])
    .filter((actor) => actor.side === side && actor.state?.onPitch)
    .sort((left, right) => left.runtimeLocalIndex - right.runtimeLocalIndex)
  if (!active.length) return null

  const players = active.map(formationPlayer)
  const currentLineup = active.map((actor) => ({
    slotId: actor.formationSlotId,
    playerId: actor.playerId,
    position: actor.assignedPosition || actor.naturalPosition,
  }))
  const adapted = adaptLineupToFormation(currentLineup, players, formation)
  if (adapted.length !== active.length) return null

  const runtimeFormation = buildHappySeedRuntimeFormation(formation, adapted)
  let outfieldTargetIndex = 0
  const assignments = adapted.map((slot) => {
    const actor = active.find((candidate) => candidate.playerId === slot.playerId)
    if (!actor) return null
    const spot = slot.position === 'GK'
      ? [0, 4, 'GK']
      : runtimeFormation.spots[outfieldTargetIndex++]
    return {
      runtimeActorId: actor.runtimeActorId,
      playerId: actor.playerId,
      formationSlotId: slot.slotId,
      assignedPosition: slot.position,
      target: {
        column: spot[0],
        row: spot[1],
        role: spot[2],
      },
    }
  }).filter(Boolean)

  return {
    side,
    formation,
    previousFormation: actorSource?.sides?.[side]?.formation || null,
    runtimeFormation,
    assignments,
    transitionMs: HAPPYSEED_FORMATION_TRANSITION_MS,
    actorTeleportAllowed: false,
  }
}

export function applyHappySeedRuntimeFormationPlan(config, plan) {
  if (!plan?.formation || !plan?.assignments?.length) return null
  const next = cloneConfig(config)
  const sideData = next.sides?.[plan.side]
  if (!sideData) return null
  const assignments = new Map(plan.assignments.map((assignment) => [
    assignment.runtimeActorId,
    assignment,
  ]))

  next.actors.forEach((actor) => {
    const assignment = assignments.get(actor.runtimeActorId)
    if (!assignment) return
    actor.formationSlotId = assignment.formationSlotId
    actor.assignedPosition = assignment.assignedPosition
    actor.formationTarget = { ...assignment.target }
  })
  sideData.formation = plan.formation
  sideData.runtimeFormation = { ...plan.runtimeFormation }
  sideData.formationHistory.push({
    from: plan.previousFormation,
    to: plan.formation,
    actorTeleportAllowed: false,
  })
  sideData.formationTransition = {
    status: 'planned',
    formation: plan.formation,
    transitionMs: plan.transitionMs,
    actorTeleportAllowed: false,
  }
  next.formations[plan.side] = { ...plan.runtimeFormation }
  return synchronizeSides(next)
}

export function substituteHappySeedRuntimeActor(config, options = {}) {
  const next = cloneConfig(config)
  const side = options.side === 'blue' ? 'blue' : 'red'
  const sideData = next.sides[side]
  const outgoingIndex = next.actors.findIndex((actor) => (
    actor.side === side
    && (actor.runtimeActorId === options.runtimeActorId || actor.playerId === options.outPlayerId)
  ))
  const incomingIndex = sideData.bench.findIndex((player) => player.playerId === options.inPlayerId)
  if (outgoingIndex < 0 || incomingIndex < 0) return null

  const outgoing = next.actors[outgoingIndex]
  const incoming = sideData.bench[incomingIndex]
  if (!outgoing.state.onPitch || outgoing.state.redCard || outgoing.state.substitutedOut) return null
  if (incoming.state.status !== 'bench' || INELIGIBLE_STATUSES.has(incoming.sourceStatus)) return null
  if (outgoing.isGoalkeeper !== (incoming.naturalPosition === 'GK')) return null

  const inactiveOutgoing = {
    ...outgoing,
    state: {
      ...outgoing.state,
      status: 'substituted',
      onPitch: false,
      substitutedOut: true,
    },
  }
  const assignedPosition = outgoing.assignedPosition
  const promotedIncoming = {
    ...incoming,
    assignedPosition,
    isGoalkeeper: assignedPosition === 'GK',
    visual: buildVisualAssets(
      sideData.teamId,
      incoming,
      assignedPosition,
      sideData.kitVariant,
    ),
    state: {
      ...incoming.state,
      status: 'active',
      onPitch: true,
      stamina: clamp(options.stamina ?? 80, 0, 100),
      substitutedOut: false,
    },
    runtimeActorId: outgoing.runtimeActorId,
    runtimeIndex: outgoing.runtimeIndex,
    runtimeLocalIndex: outgoing.runtimeLocalIndex,
    side,
    formationSlotId: outgoing.formationSlotId,
  }

  next.actors[outgoingIndex] = promotedIncoming
  sideData.bench.splice(incomingIndex, 1)
  sideData.inactive.push(inactiveOutgoing)
  sideData.substitutionHistory.push({
    runtimeActorId: outgoing.runtimeActorId,
    outPlayerId: outgoing.playerId,
    inPlayerId: incoming.playerId,
  })
  return synchronizeSides(next)
}

export function getHappySeedRuntimeActorSnapshot(config) {
  const actors = config?.actors || []
  return {
    ready: false,
    schemaVersion: config?.schemaVersion || HAPPYSEED_RUNTIME_ACTOR_SCHEMA_VERSION,
    displayScale: HAPPYSEED_RUNTIME_PLAYER_DISPLAY_SCALE,
    upstreamDisplayScale: 0.5,
    effectiveLinearRatio: 1.5376,
    mappedActorCount: actors.length,
    activeActorCount: actors.filter((actor) => actor.state?.onPitch).length,
    uniquePlayerCount: new Set(actors.map((actor) => actor.playerId)).size,
    selectedRuntimeActorId: actors[0]?.runtimeActorId || null,
    actors,
    sides: config?.sides || {},
    invariants: config?.invariants || {},
  }
}
