import { TEAM_DATA_SCHEMA_VERSION } from './teamDataSchema.js'

export const DATA_RUNTIME_CONSTRAINTS = {
  packageBudgetMb: {
    targetMin: 80,
    targetMax: 120,
    hardMax: 150,
    platformLimit: 200,
  },
  networking: {
    realtimePvp: false,
    websocket: false,
    onlinePvp: false,
    aiProvider: 'volcengine',
    allowedOnlineUses: ['pre-match-analysis', 'post-match-recap', 'ai-simulation-copy'],
  },
  runtimeModes: ['coach', 'player', 'penalty', 'aiSimulation'],
  sharedRuntimeAssets: ['pitch', 'paperDollPlayer', 'ball', 'teamKits', 'animationTimelines', 'teamData'],
}

export const TEAM_DATA_CONSUMERS = [
  'local-match-engine',
  'volcengine-ai-analysis',
  'coach-mode',
  'player-mode',
  'penalty-mode',
  'ai-simulation',
]

function summarizePositions(players = []) {
  return players.reduce((summary, player) => {
    const position = player.position || 'MF'
    summary[position] = (summary[position] || 0) + 1
    return summary
  }, { GK: 0, DF: 0, MF: 0, FW: 0 })
}

function compactPlayerForAi(player) {
  return {
    id: player.id,
    name: player.name,
    number: player.number,
    position: player.position,
    secondaryPositions: player.secondaryPositions || [],
    rating: player.rating,
    potential: player.potential,
    price: player.price,
    form: player.form,
    stamina: player.stamina,
    morale: player.morale,
    traits: player.hiddenTraits || [],
    visualRecipeId: player.visualRecipeId,
    operationAttributes: player.operationAttributes,
    matchEngineAttributes: {
      speed: player.speed,
      physical: player.physical,
      technique: player.technique,
      defense: player.defense,
      shooting: player.shooting,
      passing: player.passing,
      dribbling: player.dribbling,
      setPiece: player.setPiece,
      penalty: player.penalty,
      goalkeeper: player.goalkeeper,
    },
  }
}

export function buildTeamAiContext(team) {
  const players = team.players || []
  const topPlayers = [...players]
    .sort((left, right) => (right.rating || 0) - (left.rating || 0))
    .slice(0, 5)
    .map(compactPlayerForAi)

  return {
    schemaVersion: TEAM_DATA_SCHEMA_VERSION,
    constraints: DATA_RUNTIME_CONSTRAINTS,
    networking: DATA_RUNTIME_CONSTRAINTS.networking,
    dataConsumers: team.dataConsumers || TEAM_DATA_CONSUMERS,
    team: {
      id: team.id,
      name: team.name,
      nameEn: team.nameEn,
      difficulty: team.difficulty,
      budget: team.budget,
      defaultFormation: team.defaultFormation,
      styleTags: team.styleTags || [],
      gameModel: team.gameModel,
      dataStage: team.dataStage,
      rosterConfig: team.rosterConfig,
      visualRecipeRule: team.visualRecipeRule,
      skill: team.skill,
      skillEffect: team.skillEffect,
      goldenStar: team.goldenStar,
    },
    rosterSummary: {
      poolSize: players.length,
      positions: summarizePositions(players),
      averageRating: Math.round(players.reduce((sum, player) => sum + (player.rating || 0), 0) / Math.max(1, players.length)),
      topPlayers,
    },
    players: players.map(compactPlayerForAi),
  }
}
