export const FORMATION_TACTICS = {
  '4-3-3': {
    style: '偏进攻',
    summary: '三前锋拉开宽度，中场负责快速把球送到边路。',
    suitableFor: '适合速度型边锋、主动压迫和持续制造射门。',
    counts: { GK: 1, DF: 4, MF: 3, FW: 3 },
  },
  '4-4-2': {
    style: '攻守平衡',
    summary: '两条四人线结构清晰，双前锋互相支援。',
    suitableFor: '适合阵容均衡、强调边路传中与双前锋配合。',
    counts: { GK: 1, DF: 4, MF: 4, FW: 2 },
  },
  '4-2-3-1': {
    style: '稳守反击',
    summary: '双后腰保护防线，三名攻击中场围绕单箭头活动。',
    suitableFor: '适合拥有强力前腰，想兼顾控球与防守稳定性的球队。',
    counts: { GK: 1, DF: 4, MF: 5, FW: 1 },
  },
  '4-3-2-1': {
    style: '中路进攻',
    summary: '中场人数密集，两名影锋在单前锋身后寻找空当。',
    suitableFor: '适合技术型中场和擅长短传渗透的球队。',
    counts: { GK: 1, DF: 4, MF: 5, FW: 1 },
  },
  '3-5-2': {
    style: '控球压上',
    summary: '五人中场控制比赛，翼卫需要覆盖整条边路。',
    suitableFor: '适合中场储备深、翼卫体能优秀并希望掌控球权的球队。',
    counts: { GK: 1, DF: 3, MF: 5, FW: 2 },
  },
  '3-4-3': {
    style: '强攻',
    summary: '三前锋和双翼持续压上，以进攻人数换取禁区压力。',
    suitableFor: '适合必须追分或前场个人能力明显占优的球队。',
    counts: { GK: 1, DF: 3, MF: 4, FW: 3 },
  },
  '3-4-2-1': {
    style: '机动压迫',
    summary: '三中卫负责出球，两名攻击中场在单前锋身后自由换位。',
    suitableFor: '适合翼卫能力强、前场擅长小范围配合和快速压迫的球队。',
    counts: { GK: 1, DF: 3, MF: 6, FW: 1 },
  },
  '5-3-2': {
    style: '偏防守',
    summary: '五后卫收紧禁区，抢断后由双前锋直接发动反击。',
    suitableFor: '适合面对强敌、保护领先和依靠快速反击。',
    counts: { GK: 1, DF: 5, MF: 3, FW: 2 },
  },
  '5-4-1': {
    style: '铁桶阵',
    summary: '五后卫加四中场极致收缩，单前锋等待反击机会。',
    suitableFor: '适合实力悬殊时死守平局、依靠定位球和反击偷分。',
    counts: { GK: 1, DF: 5, MF: 4, FW: 1 },
  },
  '4-1-4-1': {
    style: '中场压迫',
    summary: '单后腰保护中路，前方四名中场保持横向覆盖。',
    suitableFor: '适合高位逼抢、争夺二点球和限制对方中场核心。',
    counts: { GK: 1, DF: 4, MF: 5, FW: 1 },
  },
}

export const FORMATION_NAMES = Object.keys(FORMATION_TACTICS)

/**
 * 阵型克制关系表
 * weakTo: 该阵型被哪种阵型克制
 * reason: 克制原因（基于真实足球战术逻辑）
 */
export const FORMATION_COUNTERS = {
  '5-3-2': { weakTo: '4-3-3', reason: '三前锋拉开宽度可拉扯五后卫防线，边路空间暴露' },
  '5-4-1': { weakTo: '3-4-3', reason: '三前锋加翼卫持续压上，铁桶阵难以兼顾宽度和纵深' },
  '4-3-3': { weakTo: '4-2-3-1', reason: '双后腰可截断三前锋的边路供给，前腰压制单后腰' },
  '4-4-2': { weakTo: '3-5-2', reason: '五中场人数优势可压制平行四人中场，控制球权' },
  '4-2-3-1': { weakTo: '4-4-2', reason: '双前锋可拉扯双后腰的防守注意力，前腰失去保护' },
  '4-3-2-1': { weakTo: '4-1-4-1', reason: '四中场横向覆盖可封锁中路渗透通道，单后腰保护纵深' },
  '3-5-2': { weakTo: '4-3-3', reason: '三前锋可利用翼卫压上后的身后空间打反击' },
  '3-4-3': { weakTo: '5-3-2', reason: '五后卫收缩禁区可化解三前锋冲击，反击打翼卫身后' },
  '3-4-2-1': { weakTo: '4-4-2', reason: '平行中场宽度优势可压制三中卫出球路线' },
  '4-1-4-1': { weakTo: '4-3-2-1', reason: '双影锋可在单后腰两侧制造人数优势，撕裂中场压迫线' },
}

/**
 * 阵型战术行为模式（基于 style 分类）
 * 用于情报部门 L3 战术预判
 */
export const FORMATION_BEHAVIOR = {
  defensive: {
    formations: ['5-3-2', '5-4-1'],
    whenWinning: '全队收缩至本方半场，保留1-2名速度点等待反击',
    whenLosing: '换上前锋增加进攻人数，但防线身后空间会暴露',
    keyThreat: '定位球和快速反击是主要得分手段',
  },
  attacking: {
    formations: ['4-3-3', '3-4-3'],
    whenWinning: '维持前场压迫，继续控制比赛节奏',
    whenLosing: '进一步压上，后卫线提至中圈附近，身后空间极大',
    keyThreat: '持续的高位压迫和边路冲击',
  },
  balanced: {
    formations: ['4-4-2', '4-2-3-1', '4-3-2-1', '4-1-4-1'],
    whenWinning: '阵型整体后移5-10米，转为稳守反击模式',
    whenLosing: '中场前压支援前锋，但中场与防线间会出现空当',
    keyThreat: '攻守转换瞬间的速度和中路渗透',
  },
  possession: {
    formations: ['3-5-2', '3-4-2-1'],
    whenWinning: '用传控消耗时间，翼卫控制边路宽度',
    whenLosing: '翼卫变为边锋全力压上，三中卫面对反击压力增大',
    keyThreat: '中场人数优势带来的持续控球和渗透',
  },
}

/**
 * 根据阵型获取其行为模式分类
 */
export function getFormationBehavior(formation) {
  for (const behavior of Object.values(FORMATION_BEHAVIOR)) {
    if (behavior.formations.includes(formation)) return behavior
  }
  return FORMATION_BEHAVIOR.balanced
}
