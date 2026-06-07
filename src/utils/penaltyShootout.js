export const PENALTY_DIRECTIONS = ['left', 'center', 'right']

export function pickPenaltyDirection(random = Math.random) {
  return PENALTY_DIRECTIONS[Math.min(2, Math.floor(random() * 3))]
}

export function resolveUserShootoutKick(direction, random = Math.random) {
  const keeperDirection = pickPenaltyDirection(random)
  const qualityRoll = random()
  const onTarget = qualityRoll < 0.92
  const saved = onTarget && keeperDirection === direction && qualityRoll > 0.34
  return {
    shooterDirection: direction,
    keeperDirection,
    scored: onTarget && !saved,
    saved,
    missed: !onTarget,
  }
}

export function resolveOpponentShootoutKick(keeperDirection, random = Math.random) {
  const shooterDirection = pickPenaltyDirection(random)
  const qualityRoll = random()
  const onTarget = qualityRoll < 0.90
  const saved = onTarget && keeperDirection === shooterDirection && qualityRoll > 0.28
  return {
    shooterDirection,
    keeperDirection,
    scored: onTarget && !saved,
    saved,
    missed: !onTarget,
  }
}

export function getShootoutWinner(shots = [], regulationRounds = 5) {
  const homeShots = shots.filter(shot => shot.team === 'home')
  const awayShots = shots.filter(shot => shot.team === 'away')
  const homeScore = homeShots.filter(shot => shot.scored).length
  const awayScore = awayShots.filter(shot => shot.scored).length
  const homeRemaining = Math.max(0, regulationRounds - homeShots.length)
  const awayRemaining = Math.max(0, regulationRounds - awayShots.length)

  if (homeShots.length < regulationRounds || awayShots.length < regulationRounds) {
    if (homeScore > awayScore + awayRemaining) return 'home'
    if (awayScore > homeScore + homeRemaining) return 'away'
    return null
  }

  if (homeShots.length === awayShots.length && homeScore !== awayScore) {
    return homeScore > awayScore ? 'home' : 'away'
  }
  return null
}
