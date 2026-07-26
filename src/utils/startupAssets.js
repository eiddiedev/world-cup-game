export function getCriticalStartupAssets(teams = []) {
  return [...new Set([
    '/assets/背景图.png',
    '/assets/logo.png',
    '/assets/logo2.png',
    '/assets/图鉴.png',
    '/assets/征召点.png',
    '/assets/金币.png',
    '/assets/fonts/zpix.ttf',
    ...teams.flatMap((team) => [team.logo, team.flag]),
  ].filter(Boolean))]
}

export function getSecondaryTeamAssets(teams = []) {
  return [...new Set(teams.flatMap((team) => (
    (team.groupOpponents || []).map((opponent) => opponent.flag)
  )).filter(Boolean))]
}

