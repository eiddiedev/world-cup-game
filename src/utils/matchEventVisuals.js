export const MATCH_EVENT_ASSETS = {
  goal: '/assets/比赛事件/进球.png',
  save: '/assets/比赛事件/扑出.png',
  redCard: '/assets/比赛事件/红牌.png',
  yellowCard: '/assets/比赛事件/黄牌.png',
  corner: '/assets/比赛事件/角球.png',
}

export function getGoalOverlayLayers() {
  return {
    image: true,
    text: true,
    backdrop: false,
  }
}

export function getMatchEventVisual(outcome = '', result = {}) {
  if (result.homeScoreChange > 0 || result.awayScoreChange > 0 || outcome.includes('goal')) {
    return { type: 'goal', src: MATCH_EVENT_ASSETS.goal, label: '进球' }
  }
  if (outcome.includes('save') || outcome.includes('saved') || outcome.includes('claim')) {
    return { type: 'save', src: MATCH_EVENT_ASSETS.save, label: '扑出' }
  }
  if (outcome.includes('red_card')) {
    return { type: 'redCard', src: MATCH_EVENT_ASSETS.redCard, label: '红牌' }
  }
  if (outcome.includes('yellow')) {
    return { type: 'yellowCard', src: MATCH_EVENT_ASSETS.yellowCard, label: '黄牌' }
  }
  if (outcome.includes('corner') || outcome.includes('deflected') || outcome.includes('cleared')) {
    return { type: 'corner', src: MATCH_EVENT_ASSETS.corner, label: '角球' }
  }
  return null
}
