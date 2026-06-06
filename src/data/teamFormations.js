export const TEAM_DEFAULT_FORMATIONS = {
  france: '4-3-3',
  brazil: '4-2-3-1',
  argentina: '4-3-3',
  portugal: '4-2-3-1',
  germany: '4-2-3-1',
  japan: '3-4-2-1',
  norway: '4-3-3',
  morocco: '4-3-3',
  newzealand: '4-3-3',
  curacao: '4-3-3',
}

const TEAM_NAME_TO_ID = {
  法国: 'france',
  巴西: 'brazil',
  阿根廷: 'argentina',
  葡萄牙: 'portugal',
  德国: 'germany',
  日本: 'japan',
  挪威: 'norway',
  摩洛哥: 'morocco',
  新西兰: 'newzealand',
  库拉索: 'curacao',
}

export function getTeamDefaultFormation(teamIdOrName) {
  const teamId = TEAM_NAME_TO_ID[teamIdOrName] || teamIdOrName
  return TEAM_DEFAULT_FORMATIONS[teamId] || '4-3-3'
}

export function hasTeamDefaultFormation(teamIdOrName) {
  const teamId = TEAM_NAME_TO_ID[teamIdOrName] || teamIdOrName
  return Object.prototype.hasOwnProperty.call(TEAM_DEFAULT_FORMATIONS, teamId)
}
