const POSITION_COMPAT = {
  GK: { GK: 1.0, DF: 0.18, MF: 0.15, FW: 0.12 },
  DF: { GK: 0.25, DF: 1.0, MF: 0.62, FW: 0.42 },
  MF: { GK: 0.18, DF: 0.55, MF: 1.0, FW: 0.68 },
  FW: { GK: 0.12, DF: 0.35, MF: 0.62, FW: 1.0 },
}

const FORMATION_PROFILE = {
  '4-3-3': { attack: 1.15, defense: 0.95, midfield: 1.0, expectedDF: 4 },
  '4-4-2': { attack: 1.0, defense: 1.0, midfield: 1.1, expectedDF: 4 },
  '4-2-3-1': { attack: 1.08, defense: 1.05, midfield: 1.05, expectedDF: 4 },
  '4-3-2-1': { attack: 1.1, defense: 1.0, midfield: 1.0, expectedDF: 4 },
  '3-5-2': { attack: 1.05, defense: 0.88, midfield: 1.15, expectedDF: 3 },
  '3-4-3': { attack: 1.25, defense: 0.8, midfield: 1.05, expectedDF: 3 },
  '3-4-2-1': { attack: 1.12, defense: 0.92, midfield: 1.16, expectedDF: 3 },
  '5-3-2': { attack: 0.9, defense: 1.25, midfield: 0.95, expectedDF: 5 },
  '4-1-4-1': { attack: 1.0, defense: 1.1, midfield: 1.08, expectedDF: 4 },
  '4-4-1-1': { attack: 1.05, defense: 1.0, midfield: 1.1, expectedDF: 4 },
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function getAssignedPosition(player) {
  return player?.pos || player?.assignedPosition || player?.slotPosition || player?.position || 'MF'
}

function getNaturalPosition(player) {
  return player?.position || player?.pos || 'MF'
}

function getPositionCompatibility(player, assignedPosition) {
  const natural = getNaturalPosition(player)
  return POSITION_COMPAT[natural]?.[assignedPosition] ?? 0.45
}

export function getEffectiveRating(player, assignedPosition = getAssignedPosition(player)) {
  return Math.round((player?.rating || 70) * getPositionCompatibility(player, assignedPosition))
}

function roleScore(player, role) {
  const compat = getPositionCompatibility(player, role)
  if (role === 'GK') {
    return ((player.def || 70) * 0.55 + (player.phy || 70) * 0.25 + (player.spd || 70) * 0.20) * compat
  }
  if (role === 'DF') {
    return ((player.def || 70) * 0.58 + (player.phy || 70) * 0.22 + (player.spd || 70) * 0.12 + (player.sta || 70) * 0.08) * compat
  }
  if (role === 'MF') {
    return ((player.tec || 70) * 0.45 + (player.def || 70) * 0.25 + (player.sta || 70) * 0.20 + (player.spd || 70) * 0.10) * compat
  }
  return ((player.tec || 70) * 0.45 + (player.spd || 70) * 0.30 + (player.phy || 70) * 0.15 + (player.sta || 70) * 0.10) * compat
}

function average(values, fallback = 55) {
  if (!values.length) return fallback
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function calculateLineupRatings(lineup = [], formation = '4-3-3') {
  const profile = FORMATION_PROFILE[formation] || FORMATION_PROFILE['4-3-3']
  const assigned = {
    GK: lineup.filter(player => getAssignedPosition(player) === 'GK'),
    DF: lineup.filter(player => getAssignedPosition(player) === 'DF'),
    MF: lineup.filter(player => getAssignedPosition(player) === 'MF'),
    FW: lineup.filter(player => getAssignedPosition(player) === 'FW'),
  }
  const naturalCounts = lineup.reduce((counts, player) => {
    const pos = getNaturalPosition(player)
    counts[pos] = (counts[pos] || 0) + 1
    return counts
  }, {})
  const outOfPosition = lineup.filter(player => getAssignedPosition(player) !== getNaturalPosition(player))
  const naturalDefendersInDefense = assigned.DF.filter(player => getNaturalPosition(player) === 'DF').length
  const expectedDF = profile.expectedDF || assigned.DF.length || 4
  const defenderCoverage = clamp(naturalDefendersInDefense / Math.max(1, expectedDF), 0, 1)
  const gkNatural = assigned.GK.some(player => getNaturalPosition(player) === 'GK')
  const dfWrongCount = assigned.DF.length - naturalDefendersInDefense

  const forwardUnit = average(assigned.FW.map(player => roleScore(player, 'FW')), 45)
  const midfieldUnit = average(assigned.MF.map(player => roleScore(player, 'MF')), 42)
  const defenseUnit = average(assigned.DF.map(player => roleScore(player, 'DF')), 35)
  const goalkeeperUnit = average(assigned.GK.map(player => roleScore(player, 'GK')), 35)
  const attackRaw = forwardUnit * 0.72 + midfieldUnit * 0.28
  const midfieldRaw = midfieldUnit * 0.68 + defenseUnit * 0.17 + forwardUnit * 0.15
  const defenseBase = defenseUnit * 0.68 + goalkeeperUnit * 0.18 + midfieldUnit * 0.14

  const structuralIntegrity = clamp(
    0.42 + defenderCoverage * 0.38 + (gkNatural ? 0.16 : -0.22) - dfWrongCount * 0.07 - outOfPosition.length * 0.025,
    0.18,
    1.04,
  )

  const attack = clamp(Math.round(attackRaw * profile.attack), 25, 99)
  const midfield = clamp(Math.round(midfieldRaw * profile.midfield), 25, 99)
  const defense = clamp(Math.round(defenseBase * profile.defense * structuralIntegrity), 18, 99)
  const overall = Math.round((attack * 0.32 + midfield * 0.26 + defense * 0.42))

  return {
    overall,
    attack,
    midfield,
    defense,
    defensiveIntegrity: Math.round(structuralIntegrity * 100) / 100,
    defenderCoverage: Math.round(defenderCoverage * 100) / 100,
    outOfPositionCount: outOfPosition.length,
    dfWrongCount,
    naturalCounts,
    expectedDF,
    naturalDefendersInDefense,
    hasNaturalGoalkeeper: gkNatural,
  }
}

export function calculateOpponentAttackRating(players = []) {
  const outfield = players.filter(player => getNaturalPosition(player) !== 'GK')
  return Math.round(average(outfield.map(player => (
    (player.tec || 70) * 0.36 + (player.spd || 70) * 0.28 + (player.phy || 70) * 0.18 + (player.sta || 70) * 0.18
  )), 70))
}

export function calculateOpponentPressure({
  myLineup = [],
  opponentLineup = [],
  formation = '4-3-3',
  teamDifficulty,
}) {
  const lineupRatings = calculateLineupRatings(myLineup, formation)
  const opponentAttack = calculateOpponentAttackRating(opponentLineup)
  const gap = opponentAttack - lineupRatings.defense
  const structuralRisk = 1 - lineupRatings.defensiveIntegrity
  const coverageRisk = 1 - lineupRatings.defenderCoverage
  const difficultyPressure = teamDifficulty
    ? Math.max(0, teamDifficulty - 3) * 0.07
    : 0
  const stableBackLineFactor = lineupRatings.defenderCoverage >= 0.95 && lineupRatings.hasNaturalGoalkeeper ? 0.92 : 1
  const chance = clamp(
    (0.25 + gap * 0.004 + structuralRisk * 0.15 + coverageRisk * 0.05 + lineupRatings.outOfPositionCount * 0.009 + difficultyPressure) * stableBackLineFactor,
    0.05,
    0.42,
  )
  const goalChance = clamp(
    (0.16 + gap * 0.0038 + structuralRisk * 0.15 + coverageRisk * 0.04 + lineupRatings.dfWrongCount * 0.018 + difficultyPressure * 0.8) * stableBackLineFactor,
    0.04,
    0.42,
  )
  return {
    chance: Math.round(chance * 1000) / 1000,
    goalChance: Math.round(goalChance * 1000) / 1000,
    opponentAttack,
    lineupRatings,
  }
}
