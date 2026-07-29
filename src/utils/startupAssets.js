const STARTUP_INTERFACE_ASSETS = [
  '/assets/背景图.png',
  '/assets/logo.png',
  '/assets/logo2.png',
  '/assets/聘书.png?v=2',
  '/assets/印章.png',
  '/assets/征召点.png',
  '/assets/金币.png',
  '/assets/锁.png',
  '/assets/属性/速度.png',
  '/assets/属性/身体.png',
  '/assets/属性/技术.png',
  '/assets/属性/防守.png',
  '/assets/属性/体能.png',
  '/assets/属性/状态.png',
]

export function getCriticalStartupAssets(teams = []) {
  return [...new Set([
    ...STARTUP_INTERFACE_ASSETS,
    ...teams.flatMap((team) => [team.logo, team.flag]),
  ].filter(Boolean))]
}

export function getSecondaryTeamAssets(teams = []) {
  return [...new Set(teams.flatMap((team) => (
    (team.groupOpponents || []).map((opponent) => opponent.flag)
  )).filter(Boolean))]
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

/**
 * 点球大战资源体积较大，只能在核心比赛资源和已选球队资源之后软加载。
 */
export function getPenaltyShootoutAssets() {
  return [
    '/assets/shootout/ball.png',
    '/assets/shootout/bg1.png',
    '/assets/shootout/bg2.png',
    ...Array.from({ length: 7 }, (_, index) => `/assets/shootout/gk${index + 1}.png`),
    ...Array.from({ length: 8 }, (_, index) => `/assets/shootout/p${index + 1}.png`),
  ]
}
