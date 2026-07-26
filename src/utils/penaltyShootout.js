const PENALTY_DIRECTIONS = ['left', 'center', 'right']

function pickPenaltyDirection(random = Math.random) {
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

/* ------------------------------------------------------------------ */
/* 6-zone swipe shootout model                                         */
/* Zones: 'left-top' | 'center-top' | 'right-top' |                    */
/*        'left-bottom' | 'center-bottom' | 'right-bottom'             */
/* ------------------------------------------------------------------ */

export const PENALTY_ZONE_COLUMNS = ['left', 'center', 'right']
export const PENALTY_ZONE_ROWS = ['top', 'bottom']
export const PENALTY_ZONES = PENALTY_ZONE_ROWS.flatMap(row =>
  PENALTY_ZONE_COLUMNS.map(column => `${column}-${row}`))

export const AI_SHOOTER_BASE_MISS_RATE = 0.08

const clamp01 = value => Math.min(1, Math.max(0, value))

/**
 * AI shooter picks a target zone. High tec leans toward corners and the
 * top row; low tec plays it safe down the middle. Every AI kick carries
 * a base ~8% chance of being overpowered (flies off target).
 * Returns { zone, overpowered }.
 */
export function pickAiShooterZone(tec = 70, random = Math.random) {
  const skill = clamp01((tec - 40) / 60) // 40 -> 0, 100 -> 1
  const overpowered = random() < AI_SHOOTER_BASE_MISS_RATE + (1 - skill) * 0.06

  const centerChance = 0.55 - skill * 0.4 // low tec: 55% center, high tec: 15%
  const topChance = 0.25 + skill * 0.35 // low tec: 25% top, high tec: 60%

  const columnRoll = random()
  const column = columnRoll < centerChance
    ? 'center'
    : columnRoll < centerChance + (1 - centerChance) / 2
      ? 'left'
      : 'right'
  const row = random() < topChance ? 'top' : 'bottom'

  return { zone: `${column}-${row}`, overpowered }
}

/**
 * AI keeper picks a zone to dive to. Better keepers (high def) are a bit
 * more likely to commit to a corner instead of staying in the middle.
 * If a tendency is provided ({ bias, strength }), the keeper will favor
 * that direction with probability proportional to strength.
 * Returns a zone string.
 */
export function pickAiKeeperZone(def = 70, random = Math.random, tendency = null) {
  const skill = clamp01((def - 40) / 60)
  const baseCenterChance = 0.34 - skill * 0.14 // 34% -> 20% chance to hold center

  let column
  if (tendency && tendency.bias && tendency.strength > 0) {
    // 有扑点习惯：按 strength 概率偏向偏好方向
    const biasRoll = random()
    if (biasRoll < tendency.strength) {
      // 偏向偏好方向
      column = tendency.bias
    } else {
      // 剩余概率按正常逻辑分配
      const remaining = 1 - tendency.strength
      const centerChance = baseCenterChance * remaining
      const sideChance = (remaining - centerChance) / 2
      const roll = random() * remaining
      if (roll < centerChance) column = 'center'
      else if (roll < centerChance + sideChance) column = 'left'
      else column = 'right'
    }
  } else {
    // 无习惯：原始逻辑
    const columnRoll = random()
    column = columnRoll < baseCenterChance
      ? 'center'
      : columnRoll < baseCenterChance + (1 - baseCenterChance) / 2
        ? 'left'
        : 'right'
  }

  const row = random() < 0.42 ? 'top' : 'bottom'
  return `${column}-${row}`
}

/**
 * Resolve one 6-zone shootout attempt.
 * - overpowered: shot flies off target (missed).
 * - keeper in the same zone: saved (very weak keepers can spill it).
 * - otherwise: scored, unless the shot clips the post (low tec raises
 *   the post chance).
 * Returns { scored, saved, missed, post? }.
 */
export function resolveShootoutAttempt({
  shooterZone,
  keeperZone,
  overpowered = false,
  shooterTec = 70,
  keeperDef = 70,
  stabilityBonus = 0,
  random = Math.random,
} = {}) {
  if (overpowered || !PENALTY_ZONES.includes(shooterZone)) {
    return { scored: false, saved: false, missed: true }
  }

  if (keeperZone === shooterZone) {
    const spilled = keeperDef < 55 && random() < 0.15
    return spilled
      ? { scored: true, saved: false, missed: false }
      : { scored: false, saved: true, missed: false }
  }

  // stabilityBonus reduces post/miss chance (from psychology team)
  const basePostChance = Math.max(0.02, 0.1 - clamp01((shooterTec - 40) / 60) * 0.08)
  const postChance = Math.max(0.01, basePostChance * (1 - stabilityBonus))
  if (random() < postChance) {
    return { scored: false, saved: false, missed: true, post: true }
  }

  return { scored: true, saved: false, missed: false }
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
