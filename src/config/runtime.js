export const IS_DOUYIN_DEMO = import.meta.env?.MODE === 'douyin'

export const DOUYIN_DEMO_TEAM_IDS = ['france', 'curacao']

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
  return demo ? 'targeting-2026-douyin-demo-save' : 'targeting-2026-save'
}
