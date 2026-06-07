export function getMatchBench(fullRoster = [], currentLineup = [], unavailableIds = []) {
  const onField = new Set(currentLineup.map(player => player.id))
  const unavailable = new Set(unavailableIds)
  return fullRoster.filter(player => !onField.has(player.id) && !unavailable.has(player.id))
}

export function swapMatchPlayer(currentLineup = [], benchPlayer, outPlayer) {
  if (!benchPlayer?.id || !outPlayer?.id) return null
  if (benchPlayer.id === outPlayer.id) return null
  if (currentLineup.some(player => player.id === benchPlayer.id)) return null
  if (!currentLineup.some(player => player.id === outPlayer.id)) return null

  const outgoingSlot = outPlayer.pos || outPlayer.position
  const nextLineup = currentLineup.map(player => (
    player.id === outPlayer.id
      ? { ...benchPlayer, pos: outgoingSlot, position: outgoingSlot }
      : player
  ))
  return new Set(nextLineup.map(player => player.id)).size === nextLineup.length
    ? nextLineup
    : null
}
