import { FORMATION_TACTICS } from '../data/formationTactics.js'

const POSITION_ORDER = ['GK', 'DF', 'MF', 'FW']

export function adaptLineupToFormation(lineup = [], players = [], formation = '4-3-3') {
  const targetCounts = FORMATION_TACTICS[formation]?.counts
  if (!targetCounts) return lineup

  const playersById = new Map(players.map(player => [player.id, player]))

  return POSITION_ORDER.flatMap(position => {
    const limit = targetCounts[position] || 0
    const currentLine = lineup.filter(
      slot => (slot.position || slot.slotId?.split('-')[0]) === position,
    )
    const retainedIds = new Set(
      [...currentLine]
        .sort((left, right) => {
        const leftRating = playersById.get(left.playerId)?.rating || 0
        const rightRating = playersById.get(right.playerId)?.rating || 0
        return rightRating - leftRating
      })
      .slice(0, limit)
        .map(slot => slot.playerId),
    )

    return currentLine
      .filter(slot => retainedIds.has(slot.playerId))
      .map((slot, index) => ({
        ...slot,
        slotId: `${position}-${index}`,
        position,
      }))
  })
}
