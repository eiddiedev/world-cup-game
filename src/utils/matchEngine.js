import { getOpponentMatchSetup } from './opponentTactics.js'

export function generateOpponentTeam(teamId, teamData, opponentStrength) {
  return getOpponentMatchSetup(
    teamData?.name || teamId,
    teamData,
    opponentStrength,
  ).lineup
}
