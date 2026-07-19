export const COMMERCIAL_FAIRNESS_RULES = Object.freeze({
  directScorePurchase: false,
  directWinPurchase: false,
  decisionProbabilityPurchase: false,
  refereeBiasPurchase: false,
  realPaymentEnabled: false,
  realAdSdkEnabled: false,
})

export const COMMERCIAL_ENTRY_POINTS = Object.freeze([
  {
    id: 'sponsor-boost',
    label: '赞助商加码',
    placement: '赛后结算页',
    timing: '基础奖励结算后',
    status: 'placeholder',
    futureReward: '少量球队基金、声望或球探券',
    guardrail: '不改变本场比分，不补发胜利。',
  },
  {
    id: 'brand-supply-station',
    label: '品牌补给站',
    placement: '首页 / 赛程页',
    timing: '两场比赛之间',
    status: 'placeholder',
    futureReward: '查看运动饮料、冰袋和训练器材库存',
    guardrail: '只处理赛前准备与恢复。',
  },
  {
    id: 'training-items',
    label: '训练道具',
    placement: '排兵布阵页',
    timing: '赛前确认阵容前',
    status: 'placeholder',
    futureReward: '消耗恢复类或训练类道具',
    guardrail: '只发出效果意图，不接决策成功率公式。',
  },
  {
    id: 'boot-equipment',
    label: '球鞋装备',
    placement: '球员详情 / 排兵布阵页',
    timing: '赛前装备',
    status: 'placeholder',
    futureReward: '装备球鞋或门将手套并记录标签',
    guardrail: '有使用上限和取舍，不售卖必胜属性。',
  },
  {
    id: 'post-match-rewards',
    label: '赛后奖励',
    placement: '赛后结算页',
    timing: '比赛结束后',
    status: 'placeholder',
    futureReward: '奖金、声望、道具掉落和恢复记录',
    guardrail: '奖励由已完成比赛产生，不反向改写结果。',
  },
])

export const COMMERCIAL_ITEMS = Object.freeze([
  {
    id: 'sports-drink',
    label: '运动饮料',
    category: 'recovery',
    useTiming: '赛前或两场之间',
    target: '单名球员',
    effectIntent: { type: 'restore_stamina', cap: 8 },
    tradeoff: '单场限用，恢复不超过状态上限。',
  },
  {
    id: 'ice-pack',
    label: '冰袋',
    category: 'recovery',
    useTiming: '赛后',
    target: '轻伤球员',
    effectIntent: { type: 'reduce_minor_injury_duration', cap: 1 },
    tradeoff: '不允许重伤球员立即复出。',
  },
  {
    id: 'football-boots',
    label: '球鞋',
    category: 'equipment',
    useTiming: '赛前装备',
    target: '单名非门将球员',
    effectIntent: { type: 'equipment_tag', tag: 'boots_readiness' },
    tradeoff: '未来效果必须包含体能或使用次数取舍。',
  },
  {
    id: 'goalkeeper-gloves',
    label: '门将手套',
    category: 'equipment',
    useTiming: '赛前装备',
    target: '门将',
    effectIntent: { type: 'equipment_tag', tag: 'keeper_focus' },
    tradeoff: '只提供门将准备标签，不保证扑救成功。',
  },
  {
    id: 'tactical-board',
    label: '战术板',
    category: 'tactics',
    useTiming: '赛前',
    target: '全队',
    effectIntent: { type: 'team_readiness_tag', tag: 'tactical_preparedness' },
    tradeoff: '只影响准备状态，不自动选择决策。',
  },
  {
    id: 'training-equipment',
    label: '训练器材',
    category: 'training',
    useTiming: '两场比赛之间',
    target: '训练组',
    effectIntent: { type: 'training_progress', tag: 'session_completed' },
    tradeoff: '训练需要消耗时间，并可能累积疲劳。',
  },
])

export function createInitialCommercializationState() {
  return {
    wallet: {
      teamFunds: 0,
      reputation: 0,
      scoutTickets: 0,
    },
    inventory: Object.fromEntries(COMMERCIAL_ITEMS.map(item => [item.id, 0])),
    equipment: {
      playerBoots: {},
      goalkeeperGloves: {},
    },
    sponsor: {
      activeOfferId: null,
      claimedOfferIds: [],
    },
    rewardLedger: [],
  }
}
