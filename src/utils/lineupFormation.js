import { FORMATION_TACTICS } from '../data/formationTactics.js'

const POSITION_ORDER = ['GK', 'DF', 'MF', 'FW']
const UNAVAILABLE_STATUSES = new Set(['injured', 'suspended', 'unavailable', 'red-carded'])

const POSITION_COMPAT = {
  GK: { GK: 1.0, DF: 0.12, MF: 0.1, FW: 0.08 },
  DF: { GK: 0.08, DF: 1.0, MF: 0.58, FW: 0.28 },
  MF: { GK: 0.08, DF: 0.62, MF: 1.0, FW: 0.62 },
  FW: { GK: 0.05, DF: 0.24, MF: 0.58, FW: 1.0 },
}

function getNaturalPosition(player) {
  return player?.position || player?.pos || 'MF'
}

function getStat(player, primary, legacy, fallback) {
  return player?.[primary] ?? player?.[legacy] ?? fallback
}

function isPlayerSelectable(player) {
  return Boolean(player?.id) && !UNAVAILABLE_STATUSES.has(player.status)
}

function getPositionCompatibility(player, targetPosition) {
  const natural = getNaturalPosition(player)
  const secondary = player?.secondaryPositions || []
  const base = POSITION_COMPAT[natural]?.[targetPosition] ?? 0.42
  return secondary.includes(targetPosition) ? Math.max(base, 0.72) : base
}

export function getLineupRoleScore(player, targetPosition) {
  const compat = getPositionCompatibility(player, targetPosition)
  if (targetPosition === 'GK') {
    const defense = getStat(player, 'defense', 'def', 60)
    return (defense * 0.48 + getStat(player, 'goalkeeper', 'def', 60) * 0.32 + getStat(player, 'physical', 'phy', 60) * 0.20) * compat
  }
  if (targetPosition === 'DF') {
    return (getStat(player, 'defense', 'def', 60) * 0.45 + getStat(player, 'physical', 'phy', 60) * 0.20 + getStat(player, 'stamina', 'sta', 70) * 0.15 + (player.rating ?? 60) * 0.20) * compat
  }
  if (targetPosition === 'MF') {
    return (getStat(player, 'technique', 'tec', 60) * 0.34 + getStat(player, 'passing', 'tec', 60) * 0.18 + getStat(player, 'stamina', 'sta', 70) * 0.18 + (player.rating ?? 60) * 0.30) * compat
  }
  return (getStat(player, 'technique', 'tec', 60) * 0.30 + getStat(player, 'shooting', 'tec', 60) * 0.22 + getStat(player, 'speed', 'spd', 60) * 0.20 + (player.rating ?? 60) * 0.28) * compat
}

function sortForRole(players, targetPosition) {
  return [...players].sort((left, right) => {
    const scoreDiff = getLineupRoleScore(right, targetPosition) - getLineupRoleScore(left, targetPosition)
    return scoreDiff || (right.rating || 0) - (left.rating || 0) || String(left.id).localeCompare(String(right.id))
  })
}

function canFillFormationSlot(player, targetPosition) {
  return getNaturalPosition(player) === targetPosition || (player.secondaryPositions || []).includes(targetPosition)
}

function rankCandidatesForSlot(players, targetPosition) {
  const compatible = sortForRole(players.filter(player => canFillFormationSlot(player, targetPosition)), targetPosition)
  const compatibleIds = new Set(compatible.map(player => player.id))
  const emergencyFallbacks = sortForRole(
    players.filter(player => !compatibleIds.has(player.id)),
    targetPosition,
  )
  return [...compatible, ...emergencyFallbacks]
}

function normalizeCurrentSlots(lineup = [], playersById) {
  return lineup
    .map(slot => {
      const playerId = slot.playerId || slot.id
      const player = playersById.get(playerId)
      if (!isPlayerSelectable(player)) return null
      const position = slot.position || slot.pos || slot.slotId?.split('-')[0] || player.position
      return { slotId: slot.slotId || `${position}-0`, playerId, position }
    })
    .filter(Boolean)
}

export function autoSelectLineupForFormation(players = [], formation = '4-3-3') {
  const targetCounts = FORMATION_TACTICS[formation]?.counts
  if (!targetCounts) return []
  const usedPlayerIds = new Set()
  const lineup = []

  POSITION_ORDER.forEach(position => {
    const candidates = rankCandidatesForSlot(
      players.filter(player => isPlayerSelectable(player) && !usedPlayerIds.has(player.id)),
      position,
    )
    candidates.slice(0, targetCounts[position] || 0).forEach((player, index) => {
      usedPlayerIds.add(player.id)
      lineup.push({ slotId: `${position}-${index}`, playerId: player.id, position })
    })
  })

  return lineup.slice(0, 11)
}

export function adaptLineupToFormation(lineup = [], players = [], formation = '4-3-3') {
  const targetCounts = FORMATION_TACTICS[formation]?.counts
  if (!targetCounts) return lineup

  const playersById = new Map(players.map(player => [player.id, player]))
  const currentSlots = normalizeCurrentSlots(lineup, playersById)
  const usedPlayerIds = new Set()

  const adapted = POSITION_ORDER.flatMap(position => {
    const limit = targetCounts[position] || 0
    const currentLine = currentSlots
      .filter(slot => !usedPlayerIds.has(slot.playerId))
      .filter(slot => (slot.position || slot.slotId?.split('-')[0]) === position)
    const retainedIds = new Set(
      [...currentLine]
        .sort((left, right) => {
          if (position === 'GK') return 0
          const leftPlayer = playersById.get(left.playerId)
          const rightPlayer = playersById.get(right.playerId)
          return getLineupRoleScore(rightPlayer, position) - getLineupRoleScore(leftPlayer, position)
        })
        .slice(0, limit)
        .map(slot => slot.playerId),
    )

    const retained = currentLine
      .filter(slot => retainedIds.has(slot.playerId))
      .map((slot, index) => ({
        ...slot,
        slotId: `${position}-${index}`,
        position,
      }))

    retained.forEach(slot => usedPlayerIds.add(slot.playerId))
    return retained
  })

  POSITION_ORDER.forEach(position => {
    const limit = targetCounts[position] || 0
    const currentCount = adapted.filter(slot => slot.position === position).length
    if (currentCount >= limit) return

    const candidates = rankCandidatesForSlot(
      players.filter(player => isPlayerSelectable(player) && !usedPlayerIds.has(player.id)),
      position,
    )

    candidates.slice(0, limit - currentCount).forEach((player, offset) => {
      usedPlayerIds.add(player.id)
      adapted.push({
        slotId: `${position}-${currentCount + offset}`,
        playerId: player.id,
        position,
      })
    })
  })

  return POSITION_ORDER.flatMap(position => (
    adapted
      .filter(slot => slot.position === position)
      .slice(0, targetCounts[position] || 0)
      .map((slot, index) => ({ ...slot, slotId: `${position}-${index}` }))
  ))
}
