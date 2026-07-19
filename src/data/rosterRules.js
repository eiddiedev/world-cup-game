import { FORMATION_TACTICS } from './formationTactics.js'
import { getPlayerMarketScore } from './playerBalance.js'
import { ROSTER_POOL_RULES } from './teamDataSchema.js'

export const NATIONAL_SQUAD_SIZE = ROSTER_POOL_RULES.nationalSquadSize

export const NATIONAL_SQUAD_MINIMUMS = ROSTER_POOL_RULES.nationalSquadMinimums

const POSITION_ORDER = ['GK', 'DF', 'MF', 'FW']

function countByPosition(players = []) {
  return POSITION_ORDER.reduce((counts, position) => {
    counts[position] = players.filter(player => player.position === position).length
    return counts
  }, {})
}

function getRecruitmentScore(player) {
  const market = getPlayerMarketScore(player)
  const form = player.form ?? 80
  const potential = player.potential ?? player.rating ?? 70
  const goldenBonus = player.isGolden ? 5 : 0
  return market * 0.82 + form * 0.08 + potential * 0.06 + goldenBonus
}

function getRecommendedMinimums(formation) {
  const formationCounts = FORMATION_TACTICS[formation]?.counts || FORMATION_TACTICS['4-3-3'].counts
  return {
    GK: NATIONAL_SQUAD_MINIMUMS.GK,
    DF: Math.max(NATIONAL_SQUAD_MINIMUMS.DF, formationCounts.DF + 2),
    MF: Math.max(NATIONAL_SQUAD_MINIMUMS.MF, formationCounts.MF + 2),
    FW: Math.max(NATIONAL_SQUAD_MINIMUMS.FW, formationCounts.FW + 1),
  }
}

function sortBest(players) {
  return [...players].sort((left, right) => {
    const scoreDiff = getRecruitmentScore(right) - getRecruitmentScore(left)
    return scoreDiff || (right.rating || 0) - (left.rating || 0) || (left.price || 0) - (right.price || 0)
  })
}

function sortCheapest(players) {
  return [...players].sort((left, right) => {
    const priceDiff = (left.price || 0) - (right.price || 0)
    return priceDiff || getRecruitmentScore(right) - getRecruitmentScore(left)
  })
}

export function validateNationalSquad(players = [], budget = Infinity) {
  const count = players.length
  const spent = players.reduce((sum, player) => sum + (player.price || 0), 0)
  const positionCounts = countByPosition(players)
  const missing = Object.entries(NATIONAL_SQUAD_MINIMUMS)
    .filter(([position, minimum]) => (positionCounts[position] || 0) < minimum)
    .map(([position, minimum]) => `${position}${minimum}`)

  return {
    valid: count === NATIONAL_SQUAD_SIZE && spent <= budget && missing.length === 0,
    count,
    spent,
    remaining: budget - spent,
    positionCounts,
    missing,
  }
}

export function buildRecommendedNationalSquad(players = [], budget, formation = '4-3-3') {
  const selected = []
  const selectedIds = new Set()
  const recommendedMinimums = getRecommendedMinimums(formation)

  const addPlayer = (player) => {
    if (!player || selectedIds.has(player.id)) return false
    selected.push(player)
    selectedIds.add(player.id)
    return true
  }

  POSITION_ORDER.forEach(position => {
    sortCheapest(players.filter(player => player.position === position))
      .slice(0, recommendedMinimums[position])
      .forEach(addPlayer)
  })

  sortCheapest(players.filter(player => !selectedIds.has(player.id)))
    .forEach(player => {
      if (selected.length < NATIONAL_SQUAD_SIZE) addPlayer(player)
    })

  let spent = selected.reduce((sum, player) => sum + (player.price || 0), 0)
  if (spent > budget) {
    return sortCheapest(players).slice(0, NATIONAL_SQUAD_SIZE)
  }

  let upgraded = true
  while (upgraded) {
    upgraded = false
    for (let index = 0; index < selected.length; index += 1) {
      const current = selected[index]
      const better = sortBest(players)
        .find(candidate => {
          if (selectedIds.has(candidate.id)) return false
          if (candidate.position !== current.position) return false
          if (getRecruitmentScore(candidate) <= getRecruitmentScore(current)) return false
          return spent - (current.price || 0) + (candidate.price || 0) <= budget
        })
      if (better) {
        selectedIds.delete(current.id)
        selectedIds.add(better.id)
        selected[index] = better
        spent = spent - (current.price || 0) + (better.price || 0)
        upgraded = true
      }
    }
  }

  return sortBest(selected).slice(0, NATIONAL_SQUAD_SIZE)
}
