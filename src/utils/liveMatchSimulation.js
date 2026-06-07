export const MATCH_SPEEDS = [1, 3, 6]

export function getNextMatchSpeed(currentSpeed = 1) {
  const index = MATCH_SPEEDS.indexOf(currentSpeed)
  return MATCH_SPEEDS[(index + 1) % MATCH_SPEEDS.length]
}

export function getBallAttachmentPoint(player, direction = 1) {
  if (!player) return { x: 50, y: 50 }
  return {
    x: player.x + (direction >= 0 ? 1.35 : -1.35),
    y: player.y + 1.1,
  }
}

export function getDecisionBridge(currentOwnerName, targetName, playerPositions = {}) {
  const current = playerPositions[currentOwnerName]
  const target = playerPositions[targetName]
  if (!target) return { type: 'none', targetName: null }
  if (!current || currentOwnerName === targetName) {
    return { type: 'carry', targetName }
  }
  return {
    type: current.team === target.team ? 'pass' : 'turnover',
    fromName: currentOwnerName,
    targetName,
  }
}
