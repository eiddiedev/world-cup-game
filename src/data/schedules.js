/**
 * 世界杯赛程数据
 * 基于真实2026世界杯分组
 */

export const TEAM_SCHEDULES = {
  france: {
    group: 'I',
    groupStage: [
      { round: 1, date: '6月15日', opponent: '伊拉克', opponentStrength: 'weak' },
      { round: 2, date: '6月21日', opponent: '塞内加尔', opponentStrength: 'medium' },
      { round: 3, date: '6月26日', opponent: '挪威', opponentStrength: 'medium' },
    ],
  },
  brazil: {
    group: 'C',
    groupStage: [
      { round: 1, date: '6月13日', opponent: '摩洛哥', opponentStrength: 'strong' },
      { round: 2, date: '6月19日', opponent: '海地', opponentStrength: 'weak' },
      { round: 3, date: '6月24日', opponent: '苏格兰', opponentStrength: 'medium' },
    ],
  },
  argentina: {
    group: 'J',
    groupStage: [
      { round: 1, date: '6月16日', opponent: '约旦', opponentStrength: 'weak' },
      { round: 2, date: '6月22日', opponent: '奥地利', opponentStrength: 'medium' },
      { round: 3, date: '6月27日', opponent: '阿尔及利亚', opponentStrength: 'medium' },
    ],
  },
  portugal: {
    group: 'K',
    groupStage: [
      { round: 1, date: '6月15日', opponent: '刚果民主共和国', opponentStrength: 'weak' },
      { round: 2, date: '6月21日', opponent: '乌兹别克斯坦', opponentStrength: 'medium' },
      { round: 3, date: '6月27日', opponent: '哥伦比亚', opponentStrength: 'strong' },
    ],
  },
  germany: {
    group: 'E',
    groupStage: [
      { round: 1, date: '6月14日', opponent: '库拉索', opponentStrength: 'weak' },
      { round: 2, date: '6月20日', opponent: '科特迪瓦', opponentStrength: 'medium' },
      { round: 3, date: '6月25日', opponent: '厄瓜多尔', opponentStrength: 'medium' },
    ],
  },
  japan: {
    group: 'F',
    groupStage: [
      { round: 1, date: '6月14日', opponent: '荷兰', opponentStrength: 'strong' },
      { round: 2, date: '6月20日', opponent: '突尼斯', opponentStrength: 'medium' },
      { round: 3, date: '6月25日', opponent: '瑞典', opponentStrength: 'medium' },
    ],
  },
  norway: {
    group: 'I',
    groupStage: [
      { round: 1, date: '6月15日', opponent: '塞内加尔', opponentStrength: 'medium' },
      { round: 2, date: '6月21日', opponent: '伊拉克', opponentStrength: 'weak' },
      { round: 3, date: '6月26日', opponent: '法国', opponentStrength: 'strong' },
    ],
  },
  morocco: {
    group: 'C',
    groupStage: [
      { round: 1, date: '6月13日', opponent: '巴西', opponentStrength: 'strong' },
      { round: 2, date: '6月19日', opponent: '苏格兰', opponentStrength: 'medium' },
      { round: 3, date: '6月24日', opponent: '海地', opponentStrength: 'weak' },
    ],
  },
  newzealand: {
    group: 'G',
    groupStage: [
      { round: 1, date: '6月13日', opponent: '埃及', opponentStrength: 'medium' },
      { round: 2, date: '6月19日', opponent: '伊朗', opponentStrength: 'medium' },
      { round: 3, date: '6月25日', opponent: '比利时', opponentStrength: 'strong' },
    ],
  },
  curacao: {
    group: 'E',
    groupStage: [
      { round: 1, date: '6月14日', opponent: '德国', opponentStrength: 'strong' },
      { round: 2, date: '6月20日', opponent: '厄瓜多尔', opponentStrength: 'medium' },
      { round: 3, date: '6月25日', opponent: '科特迪瓦', opponentStrength: 'medium' },
    ],
  },
}

export const KNOCKOUT_ROUNDS = [
  { id: 'r16', name: '16强', matchCount: 8 },
  { id: 'qf', name: '8强', matchCount: 4 },
  { id: 'sf', name: '4强', matchCount: 2 },
  { id: 'final', name: '决赛', matchCount: 1 },
]

/**
 * 获取球队赛程
 */
export function getTeamSchedule(teamId) {
  return TEAM_SCHEDULES[teamId] || null
}

/**
 * 根据对手强度生成对手实力系数
 */
export function getOpponentStrengthMultiplier(strength) {
  switch (strength) {
    case 'weak': return 0.7
    case 'medium': return 0.85
    case 'strong': return 1.0
    default: return 0.85
  }
}
