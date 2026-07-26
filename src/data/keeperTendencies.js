/**
 * 门将扑点习惯数据
 * 每个门将都有独特的扑救方向偏好，影响点球大战中 AI 门将的扑救选择。
 * 情报部门 Lv.2 可以揭示对手门将的扑点习惯。
 *
 * bias: 偏好方向 'left' | 'right' | 'center'
 * strength: 偏好强度 0~1（越高越容易被针对）
 * description: 情报面板展示文案
 */

const KEEPER_TENDENCIES = {
  // === 16支可玩球队 ===
  france: {
    bias: 'left',
    strength: 0.55,
    description: '习惯向左扑，右侧是突破口',
  },
  brazil: {
    bias: 'right',
    strength: 0.5,
    description: '偏好扑右侧，左侧射门得分率更高',
  },
  argentina: {
    bias: 'center',
    strength: 0.45,
    description: '喜欢站中路等球，打两侧死角更有效',
  },
  portugal: {
    bias: 'left',
    strength: 0.6,
    description: '强烈左扑倾向，右侧几乎空门',
  },
  germany: {
    bias: 'right',
    strength: 0.55,
    description: '习惯向右扑，左上角是最佳选择',
  },
  japan: {
    bias: 'left',
    strength: 0.4,
    description: '略微偏左，但判断力较好不易被针对',
  },
  norway: {
    bias: 'right',
    strength: 0.65,
    description: '非常依赖右扑，打左侧成功率极高',
  },
  morocco: {
    bias: 'center',
    strength: 0.5,
    description: '偏好留守中路，远角射门是最佳策略',
  },
  newzealand: {
    bias: 'left',
    strength: 0.7,
    description: '极度依赖左扑，右侧是明显弱点',
  },
  curacao: {
    bias: 'right',
    strength: 0.45,
    description: '略偏右扑，但反应速度快不易针对',
  },
  spain: {
    bias: 'left',
    strength: 0.5,
    description: '习惯左扑，右上死角是突破口',
  },
  england: {
    bias: 'right',
    strength: 0.55,
    description: '偏好右扑，左侧射门得分率较高',
  },
  usa: {
    bias: 'center',
    strength: 0.4,
    description: '倾向站中路，但覆盖面不错',
  },
  mexico: {
    bias: 'left',
    strength: 0.6,
    description: '明显左扑习惯，打右侧是明智选择',
  },
  canada: {
    bias: 'right',
    strength: 0.5,
    description: '偏好右扑，左侧有空当可利用',
  },
  capeverde: {
    bias: 'center',
    strength: 0.65,
    description: '非常依赖中路站位，两侧死角几乎必进',
  },

  // === 常见对手球队 ===
  netherlands: {
    bias: 'right',
    strength: 0.5,
    description: '偏好扑右侧，左上角是最佳目标',
  },
  belgium: {
    bias: 'left',
    strength: 0.55,
    description: '习惯向左扑，右侧射门得分率高',
  },
  croatia: {
    bias: 'right',
    strength: 0.6,
    description: '明显右扑倾向，左侧是突破口',
  },
  uruguay: {
    bias: 'center',
    strength: 0.55,
    description: '喜欢站中路，打两侧远角更有效',
  },
  senegal: {
    bias: 'left',
    strength: 0.5,
    description: '略偏左扑，右侧有一定空间',
  },
  norway_opp: {
    bias: 'right',
    strength: 0.65,
    description: '非常依赖右扑，打左侧成功率极高',
  },
  iraq: {
    bias: 'center',
    strength: 0.6,
    description: '偏好留守中路，两侧射门得分率高',
  },
  haiti: {
    bias: 'left',
    strength: 0.7,
    description: '极度依赖左扑，右侧几乎空门',
  },
  scotland: {
    bias: 'right',
    strength: 0.45,
    description: '略微偏右，但不太容易被针对',
  },
  austria: {
    bias: 'left',
    strength: 0.5,
    description: '习惯左扑，右上是理想射门方向',
  },
  algeria: {
    bias: 'right',
    strength: 0.55,
    description: '偏好右扑，左侧射门有较高得分率',
  },
  congo: {
    bias: 'center',
    strength: 0.5,
    description: '倾向中路站位，打远角是明智选择',
  },
  uzbekistan: {
    bias: 'left',
    strength: 0.6,
    description: '明显左扑习惯，右侧空当较大',
  },
  ivorycoast: {
    bias: 'right',
    strength: 0.5,
    description: '略偏右扑，左侧有一定突破空间',
  },
  ecuador: {
    bias: 'left',
    strength: 0.45,
    description: '轻微左扑倾向，不太容易被针对',
  },
  tunisia: {
    bias: 'center',
    strength: 0.65,
    description: '非常依赖中路，两侧死角得分率极高',
  },
  sweden: {
    bias: 'right',
    strength: 0.55,
    description: '习惯向右扑，左上角是最佳选择',
  },
  egypt: {
    bias: 'left',
    strength: 0.5,
    description: '偏好左扑，右侧射门是有效策略',
  },
  iran: {
    bias: 'center',
    strength: 0.55,
    description: '喜欢站中路等球，打两侧更有效',
  },
  saudi: {
    bias: 'right',
    strength: 0.6,
    description: '明显右扑倾向，左侧是明显弱点',
  },
  panama: {
    bias: 'left',
    strength: 0.65,
    description: '极度依赖左扑，右侧几乎必进',
  },
  ghana: {
    bias: 'right',
    strength: 0.5,
    description: '略偏右扑，左侧有空当可利用',
  },
  paraguay: {
    bias: 'center',
    strength: 0.5,
    description: '偏好中路站位，远角射门得分率高',
  },
  australia: {
    bias: 'left',
    strength: 0.55,
    description: '习惯左扑，右上死角是突破口',
  },
  turkey: {
    bias: 'right',
    strength: 0.5,
    description: '偏好右扑，左侧射门有一定威胁',
  },
  bosnia: {
    bias: 'left',
    strength: 0.45,
    description: '略微偏左，判断力尚可不易针对',
  },
  qatar: {
    bias: 'center',
    strength: 0.7,
    description: '极度依赖中路站位，两侧几乎必进',
  },
  switzerland: {
    bias: 'right',
    strength: 0.45,
    description: '轻微右扑倾向，覆盖面较好',
  },
  southafrica: {
    bias: 'left',
    strength: 0.6,
    description: '明显左扑习惯，右侧是最佳射门方向',
  },
  southkorea: {
    bias: 'right',
    strength: 0.5,
    description: '偏好右扑，左侧有一定空间',
  },
  czech: {
    bias: 'center',
    strength: 0.5,
    description: '倾向中路，但臂展长不易打远角',
  },
}

/**
 * 基于球队名称的确定性哈希（用于未定义倾向的球队）
 */
function hashTeamName(name) {
  let hash = 0
  const str = String(name || '')
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

const BIASES = ['left', 'right', 'center']
const BIAS_DESCRIPTIONS = {
  left: '习惯向左扑，右侧是突破口',
  right: '偏好扑右侧，左侧射门得分率更高',
  center: '喜欢站中路等球，打两侧死角更有效',
}

/**
 * 获取门将扑点倾向
 * @param {string} teamId - 球队 ID
 * @param {string} [teamName] - 球队名称（用于 fallback 哈希）
 * @returns {{ bias: string, strength: number, description: string }}
 */
export function getKeeperTendency(teamId, teamName) {
  // 优先查找精确匹配
  if (KEEPER_TENDENCIES[teamId]) return KEEPER_TENDENCIES[teamId]

  // 尝试用球队名称查找
  if (teamName && KEEPER_TENDENCIES[teamName]) return KEEPER_TENDENCIES[teamName]

  // 确定性 fallback：基于 teamId 哈希生成固定倾向
  const hash = hashTeamName(teamId || teamName || 'unknown')
  const bias = BIASES[hash % 3]
  const strength = 0.4 + (hash % 30) / 100 // 0.40 ~ 0.69
  return {
    bias,
    strength: Math.round(strength * 100) / 100,
    description: BIAS_DESCRIPTIONS[bias],
  }
}

/**
 * 获取倾向的中文方向描述（用于情报面板）
 */
export function getKeeperBiasLabel(bias) {
  const labels = { left: '左侧', right: '右侧', center: '中路' }
  return labels[bias] || '均衡'
}
