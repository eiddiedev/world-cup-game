import { buildRecommendedNationalSquad, MIN_PURCHASE, NATIONAL_SQUAD_SIZE } from '../data/rosterRules.js'
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

// ---------------------------------------------------------------------------
// 5 head variant IDs (matching apply_paper_doll_master.py HEAD_PRESETS)
// ---------------------------------------------------------------------------
const HEAD_VARIANT_IDS = [
  'head-euro-dark',     // 0: light skin + dark hair
  'head-nordic-blonde', // 1: light skin + blonde hair
  'head-asian-black',   // 2: medium skin + black hair
  'head-mixed-curly',   // 3: medium-dark skin + curly hair
  'head-dark-black',    // 4: dark skin + black hair
]

// Gold/Silver card players → correct skin tone (head variant index)
// Based on real-world ethnicity of each star player
// Keys are player.id values from data files
const STAR_SKIN_TONE_MAP = {
  // --- Gold cards ---
  'argentina_潘帕球王': 0,       // Messi - white
  'brazil_桑巴魔术': 3,          // Neymar - mixed/medium-dark
  'canada_枫叶闪电': 4,          // A. Davies - dark
  'capeverde_蓝鲨门神': 4,       // Vozinha - dark
  'colombia_咖啡飞翼': 3,        // L. Díaz - medium-dark
  'curacao_海岛门神': 4,         // Room - dark
  'england_三狮重炮': 0,         // Kane - white
  'france_高卢闪电': 4,          // Mbappé - dark
  'germany_战车门神': 0,         // Neuer - white
  'japan_蓝武左刃': 2,           // Kubo - east asian
  'mexico_绿鹰中锋': 2,          // Quiñones - medium
  'morocco_沙漠飞翼': 3,         // Hakimi - medium-dark
  'norway_北海魔人': 1,          // Haaland - nordic blonde
  'portugal_葡国战神': 0,        // Ronaldo - light
  'spain_红潮司令': 0,           // Rodri - light
  'usa_星条飞翼': 0,             // Pulisic - white
  // --- Silver cards ---
  'argentina_潘帕门神': 0,       // E. Martínez - white
  'argentina_蓝白节拍': 0,       // Mac Allister - white
  'argentina_蛛网猎手': 0,       // Álvarez - white
  'brazil_桑巴节拍': 0,          // B. Guimarães - white
  'brazil_桑巴飞刃': 4,          // Vinícius Jr - dark
  'brazil_桑巴猎豹': 3,          // Martinelli - mixed
  'canada_枫叶铁塔': 0,          // Cornelius - white
  'canada_枫叶新星': 3,          // Saliba - medium-dark (Haitian)
  'canada_枫叶猎手': 4,          // J. David - dark
  'capeverde_蓝鲨铁腰': 4,       // K. Pina - dark
  'capeverde_蓝鲨队长': 4,       // R. Mendes - dark
  'colombia_咖啡门神': 2,        // Vargas - medium
  'colombia_咖啡魔杖': 0,        // James - light
  'curacao_海岛节拍': 4,         // J. Bacuna - dark
  'curacao_海岛司令': 4,         // L. Bacuna - dark
  'england_三狮门神': 0,         // Pickford - white
  'england_三狮帝星': 3,         // Bellingham - mixed
  'england_三狮飞翼': 4,         // Saka - dark
  'france_双翼魔术': 4,          // Dembélé - dark
  'france_高卢画师': 3,          // Olise - mixed-dark
  'germany_德意铁轴': 0,         // Kimmich - white
  'germany_日耳魔术': 3,         // Musiala - mixed
  'germany_莱茵画师': 0,         // Wirtz - white
  'japan_蓝武门神': 2,           // Suzuki - east asian
  'japan_蓝武强弓': 2,           // Dōan - east asian
  'japan_蓝武棋手': 2,           // Kamada - east asian
  'mexico_绿鹰铁腰': 2,          // Edson Álvarez - medium
  'mexico_绿鹰支点': 2,          // R. Jiménez - medium
  'mexico_绿鹰飞翼': 2,          // Alvarado - medium
  'morocco_北非门神': 3,         // Bono - medium-dark
  'morocco_北非中枢': 3,         // Saibari - medium-dark
  'morocco_北非魔术': 0,         // Brahim Díaz - light
  'norway_北海铁壁': 1,          // Nyland - nordic
  'norway_北海司令': 1,          // Ødegaard - nordic
  'portugal_葡国门神': 0,        // Diogo Costa - light
  'portugal_葡国司令': 0,        // B. Fernandes - light
  'portugal_葡国节拍': 0,        // Vitinha - light
  'spain_红潮门神': 0,           // Unai Simón - light
  'spain_红潮新墙': 0,           // Cubarsí - light
  'spain_红潮神童': 3,           // Yamal - mixed (Moroccan heritage)
  'usa_星条快翼': 4,             // Robinson - dark
  'usa_星条铁腰': 3,             // McKennie - mixed
}

function bodyProfileFor(player) {
  const playerId = player.id || player.playerId || ''
  // Gold/silver stars: use their correct skin tone
  if (playerId in STAR_SKIN_TONE_MAP) {
    return HEAD_VARIANT_IDS[STAR_SKIN_TONE_MAP[playerId]]
  }
  // If player data has explicit skinTone field
  if (player.skinTone) {
    const toneMap = { light: 0, 'light-blonde': 1, medium: 2, 'medium-dark': 3, dark: 4 }
    const idx = toneMap[player.skinTone]
    if (idx !== undefined) return HEAD_VARIANT_IDS[idx]
  }
  // Others: hash-based random among 5 variants
  return HEAD_VARIANT_IDS[stableHash(playerId) % HEAD_VARIANT_IDS.length]
}

function buildVisualAssets(teamId, player, assignedPosition, kitVariant) {
  const role = assignedPosition === 'GK' ? 'goalkeeper' : 'outfield'
  const bodyProfileId = bodyProfileFor(player)
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
      morale: clamp(player.morale ?? 70, 0, 99),
      form: clamp(player.form ?? 70, 0, 99),
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

/**
 * 国家队技能 → operationAttributes / state 修正映射
 * 仅对 red 侧（玩家队）生效
 */
const TEAM_SKILL_MODIFIERS = {
  france:     { all: { ballControl: 10, passing: 10 } },
  brazil:     { all: { ballControl: 8, turning: 8 }, staminaPenalty: 10 },
  argentina:  { all: { shooting: 12, passing: 8 } },
  portugal:   { goldenStar: { shooting: 12, passing: 10, ballControl: 8 } },
  germany:    { staminaBonus: 20 },
  japan:      { all: { ballControl: 8, passing: 8 }, staminaPenalty: 12 },
  norway:     { topPhysical: { shooting: 15, ballControl: 8 } },
  morocco:    { all: { tackling: 10, sprint: 8 } },
  newzealand: { penaltyBonus: 30 },
  spain:      { all: { passing: 12, ballControl: 10 } },
  england:    { all: { shooting: 8, tackling: 6 }, moraleBonus: 10 },
  colombia:   { all: { ballControl: 10, turning: 8 } },
  usa:        { all: { sprint: 8, tackling: 6 }, staminaBonus: 10 },
  canada:     { all: { sprint: 12, turning: 6 } },
  mexico:     { all: { sprint: 8, shooting: 6 }, staminaBonus: 8 },
  capeverde:  { all: { tackling: 10, saving: 8 } },
  curacao:    { all: { saving: 12, tackling: 6 } },
}

function applyTeamSkillModifiers(actors, teamId) {
  const skill = TEAM_SKILL_MODIFIERS[teamId]
  if (!skill) return actors
  // 找出 goldenStar / topPhysical 目标
  const team = getTeamById(teamId)
  const goldenStarName = team?.goldenStar || ''
  let topPhysicalId = null
  if (skill.topPhysical) {
    let maxPhy = 0
    actors.forEach((a) => {
      const phy = a.operationAttributes?.tackling || 0
      if (phy > maxPhy) { maxPhy = phy; topPhysicalId = a.playerId }
    })
  }
  return actors.map((actor) => {
    const attrs = { ...actor.operationAttributes }
    if (skill.all) {
      for (const [key, val] of Object.entries(skill.all)) {
        attrs[key] = Math.min(99, (attrs[key] || 50) + val)
      }
    }
    if (skill.goldenStar && actor.name === goldenStarName) {
      for (const [key, val] of Object.entries(skill.goldenStar)) {
        attrs[key] = Math.min(99, (attrs[key] || 50) + val)
      }
    }
    if (skill.topPhysical && actor.playerId === topPhysicalId) {
      for (const [key, val] of Object.entries(skill.topPhysical)) {
        attrs[key] = Math.min(99, (attrs[key] || 50) + val)
      }
    }
    let stamina = actor.state.stamina
    if (skill.staminaBonus) stamina = Math.min(100, stamina + skill.staminaBonus)
    if (skill.staminaPenalty) stamina = Math.max(0, stamina - skill.staminaPenalty)
    let morale = actor.state.morale
    if (skill.moraleBonus) morale = Math.min(99, morale + skill.moraleBonus)
    return { ...actor, operationAttributes: attrs, state: { ...actor.state, stamina, morale } }
  })
}

function buildRuntimeSide({
  teamId,
  side,
  kitVariant,
  formation,
  squadPlayerIds,
  lineupPlayerIds,
  playerStateById = {},
  unavailablePlayerIds = [],
  matchStartStaminaBonus = 0,
  moraleDecayReduction = 0,
}) {
  const team = getTeamById(teamId)
  if (!team) throw new Error(`未知球队：${teamId}`)

  const selectedFormation = formation || team.defaultFormation || getTeamDefaultFormation(team.id)
  const requestedSquadIds = normalizePlayerIds(squadPlayerIds)
  const requestedLineupIds = normalizePlayerIds(lineupPlayerIds)
  const unavailableIds = normalizePlayerIds(unavailablePlayerIds)
  const selectablePool = team.players.filter((player) => (
    !INELIGIBLE_STATUSES.has(player.status)
    && (!requestedSquadIds.size || requestedSquadIds.has(player.id))
  ))
  const squad = requestedSquadIds.size >= MIN_PURCHASE
    ? selectablePool.slice(0, NATIONAL_SQUAD_SIZE)
    : buildRecommendedNationalSquad(
      team.players.filter((player) => !INELIGIBLE_STATUSES.has(player.status)),
      team.budget,
      selectedFormation,
    )
  const eligibleSquad = squad.filter((player) => !unavailableIds.has(player.id))
  const requestedLineup = eligibleSquad.filter((player) => requestedLineupIds.has(player.id))
  const lineup = autoSelectLineupForFormation(
    requestedLineup.length >= 11 ? requestedLineup : eligibleSquad,
    selectedFormation,
  )
  const playersById = new Map(squad.map((player) => [player.id, player]))
  const lineupIds = new Set(lineup.map((slot) => slot.playerId))
  const sideOffset = side === 'blue' ? 11 : 0
  const actors = lineup.map((slot, localIndex) => {
    const player = playersById.get(slot.playerId)
    const persisted = playerStateById[player.id] || {}
    return {
      ...buildBusinessBinding(team, player, slot.position, kitVariant, 'active'),
      runtimeActorId: `${side}-${String(localIndex).padStart(2, '0')}`,
      runtimeIndex: sideOffset + localIndex,
      runtimeLocalIndex: localIndex,
      side,
      formationSlotId: slot.slotId,
      state: {
        ...buildBusinessBinding(team, player, slot.position, kitVariant, 'active').state,
        stamina: clamp(persisted.stamina ?? player.stamina ?? player.sta ?? 80, 0, 100),
        morale: clamp(persisted.morale ?? player.morale ?? 70, 0, 99),
        form: clamp(persisted.form ?? player.form ?? 70, 0, 99),
      },
    }
  })
  const bench = squad
    .filter((player) => !lineupIds.has(player.id))
    .map((player) => {
      const binding = buildBusinessBinding(team, player, null, kitVariant, 'bench')
      const persisted = playerStateById[player.id] || {}
      binding.state.stamina = clamp(persisted.stamina ?? binding.state.stamina, 0, 100)
      binding.state.morale = clamp(persisted.morale ?? binding.state.morale, 0, 99)
      binding.state.form = clamp(persisted.form ?? binding.state.form, 0, 99)
      if (unavailableIds.has(player.id)) {
        binding.state.status = persisted.status || (persisted.injured ? 'injured' : 'suspended')
        binding.state.injured = binding.state.status === 'injured'
        binding.sourceStatus = binding.state.status
      }
      return binding
    })

  let finalActors = actors
  // 仅对 red 侧应用后勤修正 + 国家队技能
  if (side === 'red') {
    finalActors = finalActors.map((actor) => {
      let stamina = actor.state.stamina
      let morale = actor.state.morale
      if (matchStartStaminaBonus) stamina = clamp(stamina + matchStartStaminaBonus, 0, 100)
      if (moraleDecayReduction) morale = clamp(morale + moraleDecayReduction * 20, 0, 99)
      return { ...actor, state: { ...actor.state, stamina, morale } }
    })
    finalActors = applyTeamSkillModifiers(finalActors, teamId)
  }

  return {
    side,
    teamId: team.id,
    teamName: team.name,
    formation: selectedFormation,
    kitVariant,
    runtimeFormation: buildHappySeedRuntimeFormation(selectedFormation, lineup),
    squadPlayerIds: squad.map((player) => player.id),
    actors: finalActors,
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
    playerStateById: options.redPlayerStateById,
    unavailablePlayerIds: options.redUnavailablePlayerIds,
    matchStartStaminaBonus: options.matchStartStaminaBonus || 0,
    moraleDecayReduction: options.moraleDecayReduction || 0,
  })
  const blue = buildRuntimeSide({
    teamId: options.blue || 'brazil',
    side: 'blue',
    kitVariant: 'away',
    formation: options.formations?.blue?.name || options.blueFormation,
    squadPlayerIds: options.blueSquadPlayerIds,
    lineupPlayerIds: options.blueLineupPlayerIds,
    playerStateById: options.bluePlayerStateById,
    unavailablePlayerIds: options.blueUnavailablePlayerIds,
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
    if (squadIds.length < MIN_PURCHASE || squadIds.length > NATIONAL_SQUAD_SIZE) errors.push(`${side}-squad-count`)
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
  if (patch.morale != null) actor.state.morale = clamp(patch.morale, 0, 99)
  if (patch.moraleDelta != null) {
    actor.state.morale = clamp((actor.state.morale ?? 70) + Number(patch.moraleDelta), 0, 99)
  }
  if (patch.form != null) actor.state.form = clamp(patch.form, 0, 99)
  if (patch.formDelta != null) {
    actor.state.form = clamp((actor.state.form ?? 70) + Number(patch.formDelta), 0, 99)
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
