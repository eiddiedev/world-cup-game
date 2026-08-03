export const IS_DOUYIN_MINIMAL = import.meta.env?.MODE === 'douyin-minimal'
export const IS_DOUYIN_DEMO = import.meta.env?.MODE === 'douyin' || IS_DOUYIN_MINIMAL

// 互动空间版保留四档难度的可选球队；其余球队只参与完整赛程。
export const DOUYIN_DEMO_TEAM_IDS = ['spain', 'england', 'norway', 'capeverde']

export const ALL_PLAYABLE_TEAM_IDS = [
  'spain',
  'argentina',
  'france',
  'england',
  'brazil',
  'portugal',
  'germany',
  'japan',
  'morocco',
  'norway',
  'colombia',
  'usa',
  'canada',
  'mexico',
  'capeverde',
  'curacao',
]

export function selectPlayableTeams(sourceTeams, demo = IS_DOUYIN_DEMO) {
  if (!demo) return sourceTeams
  const allowed = new Set(DOUYIN_DEMO_TEAM_IDS)
  return sourceTeams.filter(team => allowed.has(team.id))
}

export function getPlayableTeamIds(demo = IS_DOUYIN_DEMO) {
  return demo ? [...DOUYIN_DEMO_TEAM_IDS] : [...ALL_PLAYABLE_TEAM_IDS]
}

export function getStorageKey(demo = IS_DOUYIN_DEMO) {
  return demo ? 'targeting-2026-world-cup-save' : 'targeting-2026-save'
}
