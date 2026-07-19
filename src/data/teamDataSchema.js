export const TEAM_DATA_SCHEMA_VERSION = 'team-roster-v2'

export const WORLD_CUP_TEAM_CAPACITY = 48

export const SAMPLE_TEAM_IDS = Object.freeze(['france', 'curacao'])

export const ROSTER_POOL_RULES = Object.freeze({
  minimum: 35,
  target: 38,
  maximum: 40,
  nationalSquadSize: 23,
  nationalSquadMinimums: Object.freeze({ GK: 2, DF: 6, MF: 6, FW: 3 }),
  positionTargets: Object.freeze({ GK: 4, DF: 12, MF: 12, FW: 10 }),
})

export const VISUAL_RECIPE_RULE = Object.freeze({
  version: 'pixel-player-recipe-v1',
  idPattern: 'pixel/recipes/{teamId}/{playerId}.json',
})

export const PLAYER_REQUIRED_FIELDS = Object.freeze([
  'id',
  'teamId',
  'name',
  'nickname',
  'number',
  'position',
  'secondaryPositions',
  'age',
  'height',
  'weight',
  'foot',
  'clubTag',
  'rating',
  'potential',
  'price',
  'status',
  'stamina',
  'morale',
  'form',
  'speed',
  'physical',
  'technique',
  'defense',
  'shooting',
  'passing',
  'dribbling',
  'setPiece',
  'penalty',
  'goalkeeper',
  'operationAttributes',
  'hiddenTraits',
  'visualRecipeId',
  'spriteRecipe',
  'portraitRecipe',
  'dataOrigin',
])

export const TEAM_REQUIRED_FIELDS = Object.freeze([
  'id',
  'name',
  'nameEn',
  'group',
  'budget',
  'defaultFormation',
  'styleTags',
  'gameModel',
  'players',
  'schemaVersion',
  'dataStage',
  'rosterConfig',
  'rosterSummary',
  'visualRecipeRule',
])

const VALID_POSITIONS = new Set(['GK', 'DF', 'MF', 'FW'])
const OPERATION_ATTRIBUTE_KEYS = [
  'ballControl',
  'turning',
  'sprint',
  'passing',
  'shooting',
  'tackling',
  'saving',
]

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function recipeSegment(value) {
  return encodeURIComponent(String(value || '').trim())
}

export function buildVisualRecipeId(teamId, playerId) {
  return `pixel/recipes/${recipeSegment(teamId)}/${recipeSegment(playerId)}.json`
}

export function buildTeamSchemaMetadata(team) {
  const players = team.players || []
  const sourcePlayers = players.filter(player => player.dataOrigin === 'source').length
  const placeholderPlayers = players.filter(player => player.dataOrigin === 'generated-placeholder').length

  return {
    schemaVersion: TEAM_DATA_SCHEMA_VERSION,
    tournamentTeamCapacity: WORLD_CUP_TEAM_CAPACITY,
    dataStage: SAMPLE_TEAM_IDS.includes(team.id) ? 'sample-complete' : 'playable-seed',
    rosterConfig: ROSTER_POOL_RULES,
    rosterSummary: {
      poolSize: players.length,
      sourcePlayers,
      placeholderPlayers,
      nationalSquadSize: ROSTER_POOL_RULES.nationalSquadSize,
    },
    visualRecipeRule: VISUAL_RECIPE_RULE,
  }
}

export function validatePlayerRecord(player, teamId) {
  const errors = PLAYER_REQUIRED_FIELDS
    .filter(field => !hasValue(player?.[field]))
    .map(field => `missing player.${field}`)

  if (!VALID_POSITIONS.has(player?.position)) errors.push(`invalid position ${player?.position}`)
  if (player?.teamId !== teamId) errors.push(`teamId ${player?.teamId} does not match ${teamId}`)
  if (!Array.isArray(player?.secondaryPositions)) errors.push('secondaryPositions must be an array')
  if (!Array.isArray(player?.hiddenTraits)) errors.push('hiddenTraits must be an array')
  if (player?.visualRecipeId !== buildVisualRecipeId(teamId, player?.id)) {
    errors.push('visualRecipeId does not match the deterministic recipe rule')
  }

  for (const key of OPERATION_ATTRIBUTE_KEYS) {
    const value = player?.operationAttributes?.[key]
    if (!Number.isFinite(value) || value < 0 || value > 99) {
      errors.push(`invalid operationAttributes.${key}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateTeamRecord(team) {
  const errors = TEAM_REQUIRED_FIELDS
    .filter(field => !hasValue(team?.[field]))
    .map(field => `missing team.${field}`)
  const players = team?.players || []

  if (team?.schemaVersion !== TEAM_DATA_SCHEMA_VERSION) errors.push('unsupported schemaVersion')
  if (!Array.isArray(team?.styleTags) || team.styleTags.length === 0) errors.push('styleTags must not be empty')
  if (players.length < ROSTER_POOL_RULES.minimum || players.length > ROSTER_POOL_RULES.maximum) {
    errors.push(`roster pool must contain ${ROSTER_POOL_RULES.minimum}-${ROSTER_POOL_RULES.maximum} players`)
  }

  const playerIds = players.map(player => player.id)
  if (new Set(playerIds).size !== playerIds.length) errors.push('player ids must be unique within a team')

  players.forEach((player) => {
    const validation = validatePlayerRecord(player, team?.id)
    validation.errors.forEach(error => errors.push(`${player?.id || 'unknown-player'}: ${error}`))
  })

  return {
    valid: errors.length === 0,
    errors,
    teamId: team?.id,
    poolSize: players.length,
  }
}

export function validateTeamCatalog(teamCatalog = []) {
  const errors = []
  const teamIds = teamCatalog.map(team => team.id)

  if (teamCatalog.length > WORLD_CUP_TEAM_CAPACITY) {
    errors.push(`team catalog exceeds ${WORLD_CUP_TEAM_CAPACITY} teams`)
  }
  if (new Set(teamIds).size !== teamIds.length) errors.push('team ids must be unique')

  teamCatalog.forEach((team) => {
    const validation = validateTeamRecord(team)
    validation.errors.forEach(error => errors.push(`${team.id}: ${error}`))
  })

  return {
    valid: errors.length === 0,
    errors,
    teamCount: teamCatalog.length,
    remainingCapacity: Math.max(0, WORLD_CUP_TEAM_CAPACITY - teamCatalog.length),
    completeTournament: errors.length === 0 && teamCatalog.length === WORLD_CUP_TEAM_CAPACITY,
  }
}
