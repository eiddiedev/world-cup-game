import { getPlayerMarketScore } from './playerBalance.js'
import { ROSTER_POOL_RULES } from './teamDataSchema.js'

export const NATIONAL_SQUAD_SIZE = ROSTER_POOL_RULES.nationalSquadSize

export const MIN_PURCHASE = ROSTER_POOL_RULES.minPurchase

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
    valid: count >= MIN_PURCHASE && spent <= budget && missing.length === 0,
    count,
    spent,
    remaining: budget - spent,
    positionCounts,
    missing,
  }
}

export function buildRecommendedNationalSquad(players = [], budget, _formation = '4-3-3') {
  const selected = []
  const selectedIds = new Set()
  const spent = () => selected.reduce((sum, p) => sum + (p.price || 0), 0)
  const addPlayer = (player) => {
    if (!player || selectedIds.has(player.id)) return false
    selected.push(player)
    selectedIds.add(player.id)
    return true
  }
  const addIfAffordable = (player) => {
    if (!player || selectedIds.has(player.id)) return false
    if (spent() + (player.price || 0) > budget) return false
    return addPlayer(player)
  }

  // 1. 先满足位置最低结构（最便宜优先，预算内）
  POSITION_ORDER.forEach(position => {
    sortCheapest(players.filter(player => player.position === position))
      .slice(0, NATIONAL_SQUAD_MINIMUMS[position])
      .forEach(addIfAffordable)
  })

  // 2. 补到至少 MIN_PURCHASE 人（最便宜优先，预算内）
  sortCheapest(players.filter(player => !selectedIds.has(player.id)))
    .forEach(player => {
      if (selected.length < MIN_PURCHASE) addIfAffordable(player)
    })

  // 3. 预算允许下继续补强（最多到候选池上限）
  let added = true
  while (added && selected.length < NATIONAL_SQUAD_SIZE) {
    added = false
    const candidate = sortBest(players.filter(player => !selectedIds.has(player.id)))
      .find(player => spent() + (player.price || 0) <= budget)
    if (candidate) {
      addPlayer(candidate)
      added = true
    }
  }

  return sortBest(selected)
}
