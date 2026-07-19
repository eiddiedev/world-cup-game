export const AI_ENHANCEMENT_SCENES = Object.freeze({
  PRE_MATCH_SCOUT: 'pre_match_scout',
  OPPONENT_TACTICS_SIMULATION: 'opponent_tactics_simulation',
  DYNAMIC_COMMENTARY: 'dynamic_commentary',
  COACH_ADVICE: 'coach_advice',
  POST_MATCH_REVIEW: 'post_match_review',
  GENERATED_CHALLENGE: 'generated_challenge',
})

export const AI_SCENE_DEFINITIONS = Object.freeze([
  {
    scene: AI_ENHANCEMENT_SCENES.PRE_MATCH_SCOUT,
    label: 'AI 赛前球探报告',
    shortLabel: '球探报告',
    placement: '排兵布阵页',
    timing: '赛前',
    description: '整理对手风格、强侧与需要重点盯防的区域。',
    fallbackStrategy: '球队标签 + 阵型信息 + 本地球探模板',
  },
  {
    scene: AI_ENHANCEMENT_SCENES.OPPONENT_TACTICS_SIMULATION,
    label: 'AI 对手战术模拟',
    shortLabel: '战术模拟',
    placement: '排兵布阵页',
    timing: '赛前',
    description: '预测对手开局、落后和领先时的战术倾向。',
    fallbackStrategy: '对手阵型 + 战术标签 + 本地情境规则',
  },
  {
    scene: AI_ENHANCEMENT_SCENES.DYNAMIC_COMMENTARY,
    label: 'AI 动态解说',
    shortLabel: '动态解说',
    placement: '比赛播报栏',
    timing: '比赛中',
    description: '消费已有比赛事件文本，生成不阻塞比赛的补充播报。',
    fallbackStrategy: 'recentEvents + 本地播报模板',
  },
  {
    scene: AI_ENHANCEMENT_SCENES.COACH_ADVICE,
    label: 'AI 教练建议',
    shortLabel: '教练建议',
    placement: '排兵布阵页',
    timing: '赛前 / 中场',
    description: '给出轮换、体能和阵型风险提示，只提供建议。',
    fallbackStrategy: '阵容状态 + 阵型评分 + 本地建议规则',
  },
  {
    scene: AI_ENHANCEMENT_SCENES.POST_MATCH_REVIEW,
    label: 'AI 赛后复盘',
    shortLabel: '赛后复盘',
    placement: '赛后结算页',
    timing: '赛后',
    description: '总结比分、数据与关键决策，解释下一场准备重点。',
    fallbackStrategy: '比赛统计 + 关键决策 + 本地复盘模板',
  },
  {
    scene: AI_ENHANCEMENT_SCENES.GENERATED_CHALLENGE,
    label: 'AI 生成挑战赛',
    shortLabel: '生成挑战',
    placement: '赛程页 / 每日挑战',
    timing: '赛外',
    description: '组合单机挑战规则与目标，不生成实时对战房间。',
    fallbackStrategy: '球队强度 + 本地挑战规则池 + 固定种子',
  },
])

export const VOLCENGINE_AI_PLACEHOLDER = Object.freeze({
  provider: 'volcengine-ark',
  status: 'not_connected',
  transport: 'HTTPS request/response',
  realtimeNetworking: false,
  browserSecretAllowed: false,
  endpointEnv: 'VITE_VOLCENGINE_AI_PROXY_URL',
  phaseTwoAdapter: 'src/services/volcengineAiAdapter.js',
})

const SCENE_VALUES = new Set(Object.values(AI_ENHANCEMENT_SCENES))

function normalizeRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}
}

function normalizeEvents(value) {
  if (!Array.isArray(value)) return []
  return value.slice(-12).map((event) => {
    if (event && typeof event === 'object') return { ...event }
    return { text: String(event) }
  })
}

/**
 * @typedef {Object} AiEnhancementRequest
 * @property {string} scene
 * @property {Object} matchSnapshot
 * @property {Object} playerTeam
 * @property {Object} opponentTeam
 * @property {Array<Object>} recentEvents
 * @property {string} locale
 */

/**
 * Build the only request shape that a future AI provider may receive.
 * This factory is local-only and performs no network work.
 *
 * @param {Partial<AiEnhancementRequest>} input
 * @returns {AiEnhancementRequest}
 */
export function createAiEnhancementRequest(input = {}) {
  if (!SCENE_VALUES.has(input.scene)) {
    throw new Error(`Unsupported AI enhancement scene: ${input.scene || 'missing'}`)
  }

  return {
    scene: input.scene,
    matchSnapshot: normalizeRecord(input.matchSnapshot),
    playerTeam: normalizeRecord(input.playerTeam),
    opponentTeam: normalizeRecord(input.opponentTeam),
    recentEvents: normalizeEvents(input.recentEvents),
    locale: typeof input.locale === 'string' && input.locale ? input.locale : 'zh-CN',
  }
}

export function createInitialAiEnhancementState() {
  return {
    provider: VOLCENGINE_AI_PLACEHOLDER.provider,
    providerStatus: VOLCENGINE_AI_PLACEHOLDER.status,
    fallbackEnabled: true,
    lastScene: null,
    cachedResponses: {},
  }
}
