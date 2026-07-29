import React, { useMemo } from 'react'
import { teams } from '../data/teams.js'
import LegacyPenaltyShootout from './LegacyPenaltyShootout.jsx'

function buildShootoutLineup(team) {
  const players = team?.players || []
  const goalkeeper = players
    .filter(player => player.position === 'GK')
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))[0]
  const outfield = players
    .filter(player => player.position !== 'GK')
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 10)

  return [goalkeeper, ...outfield].filter(Boolean)
}

export default function PenaltyModeScreen({ navigateTo, showToast }) {
  const homeTeam = teams.find(team => team.id === 'france') || teams[0]
  const awayTeam = teams.find(team => team.id === 'brazil') || teams[1] || teams[0]
  const homeLineup = useMemo(() => buildShootoutLineup(homeTeam), [homeTeam])
  const awayLineup = useMemo(() => buildShootoutLineup(awayTeam), [awayTeam])

  return (
    <LegacyPenaltyShootout
      homeTeam={homeTeam.name}
      awayTeam={awayTeam.name}
      homeTeamId={homeTeam.id}
      awayTeamId={awayTeam.id}
      homeLineup={homeLineup}
      awayLineup={awayLineup}
      homeFormation={homeTeam.defaultFormation || '4-3-3'}
      awayFormation={awayTeam.defaultFormation || '4-3-3'}
      onExit={() => navigateTo('home')}
      onComplete={(winner) => {
        showToast(winner === 'home' ? `${homeTeam.name}赢得点球大战！` : `${awayTeam.name}赢得点球大战！`)
      }}
    />
  )
}
