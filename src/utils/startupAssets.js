const STARTUP_INTERFACE_ASSETS = [
  '/assets/背景图.png',
  '/assets/logo.png',
  '/assets/logo2.png',
  '/assets/聘书.png?v=2',
  '/assets/印章.png',
  '/assets/征召点.png',
  '/assets/金币.png',
]

export function getCriticalStartupAssets(teams = []) {
  return [...new Set([
    ...STARTUP_INTERFACE_ASSETS,
    ...teams.flatMap((team) => [team.logo, team.flag]),
  ].filter(Boolean))]
}

/**
 * 球队被选中后才加载该队的大图和球员头像，避免首屏同时请求 16 队名单。
 */
export function getSelectedTeamPlayerAssets(team) {
  if (!team) return []
  return [...new Set([
    team.hero,
    ...(team.players || []).map((player) => player.avatar),
  ].filter(Boolean))]
}
