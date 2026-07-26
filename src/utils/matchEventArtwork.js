export const MATCH_EVENT_ARTWORK = Object.freeze({
  save: Object.freeze({ src: '/assets/比赛事件/扑出.png', label: '关键扑救', headline: '门将完成关键扑救！', holdMs: 3000 }),
  corner: Object.freeze({ src: '/assets/比赛事件/角球.png', label: '角球', headline: '角球机会，双方争抢落点。' }),
  goal: Object.freeze({ src: '/assets/比赛事件/进球.png', label: '进球', headline: '皮球越过门线，进球！', holdMs: 3200 }),
  'runtime-goal': Object.freeze({ src: '/assets/比赛事件/进球.png', label: '进球', headline: '皮球越过门线，进球！', holdMs: 3200 }),
  'ab-goal': Object.freeze({ src: '/assets/比赛事件/进球.png', label: '进球', headline: '皮球越过门线，进球！', holdMs: 3200 }),
  'var-review': Object.freeze({ src: '/assets/比赛事件/VAR.png', label: '检查 VAR 中', headline: 'VAR 正在检查刚才的进球。', holdMs: 2800 }),
  'var-review:penalty': Object.freeze({ src: '/assets/比赛事件/VAR.png', label: '检查 VAR 中', headline: 'VAR 正在检查禁区内犯规。', holdMs: 2800 }),
  'var-result:valid': Object.freeze({ src: '/assets/比赛事件/VAR-GOAL.png', label: 'GOAL', headline: 'VAR 确认：进球有效！', holdMs: 3000 }),
  'var-result:disallowed': Object.freeze({ src: '/assets/比赛事件/VAR-NO-GOAL.png', label: 'NO GOAL', headline: 'VAR 确认：进球无效。', holdMs: 3000 }),
  'var-result:penalty-awarded': Object.freeze({ src: null, label: '确认点球', headline: 'VAR 确认：判罚点球！', holdMs: 3000 }),
  'var-result:no-penalty': Object.freeze({ src: null, label: '没有点球', headline: 'VAR 确认：没有点球。', holdMs: 3000 }),
  'card:yellow': Object.freeze({ src: '/assets/比赛事件/黄牌.png', label: '黄牌', headline: '裁判出示黄牌。', holdMs: 2100 }),
  'card:red': Object.freeze({ src: '/assets/比赛事件/红牌.png', label: '红牌', headline: '裁判出示红牌！', holdMs: 2100 }),
})

export function getMatchEventArtwork(event) {
  if (!event?.id || !event?.type) return null
  const cardColor = event.type === 'card' ? String(event.detail?.color || 'yellow') : null
  let artworkKey = event.type
  if (cardColor) {
    artworkKey = `card:${cardColor}`
  } else if (event.type === 'var-result') {
    const reviewType = event.detail?.reviewType
    if (reviewType === 'penalty') {
      artworkKey = event.detail?.outcome === 'penalty-awarded'
        ? 'var-result:penalty-awarded'
        : 'var-result:no-penalty'
    } else {
      artworkKey = event.detail?.outcome === 'disallowed'
        ? 'var-result:disallowed'
        : 'var-result:valid'
    }
  } else if (event.type === 'var-review') {
    artworkKey = event.detail?.reviewType === 'penalty'
      ? 'var-review:penalty'
      : 'var-review'
  }
  const definition = MATCH_EVENT_ARTWORK[artworkKey]
  if (!definition) return null
  return {
    ...definition,
    eventType: event.type,
    eventId: event.id,
    minute: Math.max(0, Math.min(120, Number(event.minute) || 0)),
  }
}
