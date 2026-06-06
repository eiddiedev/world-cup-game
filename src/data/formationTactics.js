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
  '4-1-4-1': {
    style: '中场压迫',
    summary: '单后腰保护中路，前方四名中场保持横向覆盖。',
    suitableFor: '适合高位逼抢、争夺二点球和限制对方中场核心。',
    counts: { GK: 1, DF: 4, MF: 5, FW: 1 },
  },
  '4-4-1-1': {
    style: '快速反击',
    summary: '影锋连接中场与前锋，防守时保持紧凑的四人线。',
    suitableFor: '适合拥有全能二前锋、希望快速由守转攻的球队。',
    counts: { GK: 1, DF: 4, MF: 4, FW: 2 },
  },
}

export const FORMATION_NAMES = Object.keys(FORMATION_TACTICS)
