/**
 * 六大后勤部门定义
 * 每个部门 0~3 级，升级需消耗后勤预算
 */
export const LOGISTICS_DEPARTMENTS = [
  {
    id: 'medical',
    name: '医疗团队',
    icon: '/assets/后勤/医疗团队.png',
    description: '保护球队稳定性，降低伤病、加速恢复',
    levels: [
      { level: 0, name: '无专业医疗', cost: 0, effects: {}, desc: '受伤概率正常，疲劳恢复慢' },
      { level: 1, name: '普通医疗组', cost: 800, effects: { injuryRecoveryBonus: 0.2 }, desc: '轻伤恢复速度+20%' },
      { level: 2, name: '专业医疗中心', cost: 1500, effects: { injuryProbReduction: 0.15, knockoutStaminaRecovery: 5 }, desc: '伤病概率-15%，淘汰赛恢复+5体力' },
      { level: 3, name: '世界级医疗团队', cost: 2500, effects: { injuryProbReduction: 0.3, playThroughInjury: true, staminaDecayReduction: 0.1 }, desc: '伤病概率-30%，可带伤出战，体能衰减-10%' },
    ],
  },
  {
    id: 'nutrition',
    name: '营养团队',
    icon: '/assets/后勤/营养团队.png',
    description: '保证球员状态，让核心保持最佳',
    levels: [
      { level: 0, name: '正常饮食', cost: 0, effects: {}, desc: '无额外加成' },
      { level: 1, name: '专业营养师', cost: 700, effects: { matchStartStaminaBonus: 5 }, desc: '比赛开始全队体力+5' },
      { level: 2, name: '运动营养中心', cost: 1400, effects: { matchStartStaminaBonus: 5, fatigueReduction: 0.15 }, desc: '开场体力+5，连续比赛疲劳降低15%' },
      { level: 3, name: '顶级营养保障', cost: 2200, effects: { matchStartStaminaBonus: 8, fatigueReduction: 0.25, coreNoFatigue: true }, desc: '开场体力+8，核心球员不进入疲劳' },
    ],
  },
  {
    id: 'psychology',
    name: '心理团队',
    icon: '/assets/后勤/心理团队.png',
    description: '关键时刻发挥，淘汰赛核心保障',
    levels: [
      { level: 0, name: '无心理支持', cost: 0, effects: {}, desc: '压力正常影响发挥' },
      { level: 1, name: '心理辅导师', cost: 600, effects: { moraleDecayReduction: 0.2 }, desc: '落后时士气下降减少20%' },
      { level: 2, name: '运动心理中心', cost: 1200, effects: { moraleDecayReduction: 0.3, penaltyStabilityBonus: 0.15 }, desc: '士气下降-30%，点球稳定性+15%' },
      { level: 3, name: '世界级心理团队', cost: 2000, effects: { moraleDecayReduction: 0.5, penaltyStabilityBonus: 0.25, pressureImmunity: true }, desc: '士气下降-50%，点球+25%，决赛压力免疫' },
    ],
  },
  {
    id: 'analytics',
    name: '数据分析中心',
    icon: '/assets/后勤/数据分析中心.png',
    description: '给玩家信息优势，知己知彼',
    levels: [
      { level: 0, name: '基础信息', cost: 0, effects: { intelLevel: 0 }, desc: '只有基础阵容' },
      { level: 1, name: '基础分析组', cost: 600, effects: { intelLevel: 1 }, desc: '显示对手优势属性评级' },
      { level: 2, name: '高级分析中心', cost: 1300, effects: { intelLevel: 2 }, desc: '显示危险球员+对手弱点' },
      { level: 3, name: 'AI战术分析', cost: 2200, effects: { intelLevel: 3, tacticalAdvice: true }, desc: '赛前战术建议+完整情报' },
    ],
  },
  {
    id: 'training',
    name: '训练基地',
    icon: '/assets/后勤/训练基地.png',
    description: '短期调整，赛前针对性训练',
    levels: [
      { level: 0, name: '普通训练场', cost: 0, effects: {}, desc: '无额外训练加成' },
      { level: 1, name: '专业训练基地', cost: 700, effects: { trainingEfficiency: 0.1 }, desc: '训练效率+10%' },
      { level: 2, name: '高科技训练中心', cost: 1400, effects: { trainingEfficiency: 0.1, randomFormBoost: true }, desc: '效率+10%，随机1人状态提升' },
      { level: 3, name: '世界级训练设施', cost: 2300, effects: { trainingEfficiency: 0.15, randomFormBoost: true, trainingTheme: true }, desc: '效率+15%，可选训练主题（攻/防/定位球）' },
    ],
  },
  {
    id: 'scouting',
    name: '情报部门',
    icon: '/assets/后勤/情报部门.png',
    description: '提前发现赛程信息，预判对手',
    levels: [
      { level: 0, name: '无球探', cost: 0, effects: { scoutLevel: 0 }, desc: '无额外情报' },
      { level: 1, name: '基础球探', cost: 500, effects: { scoutLevel: 1 }, desc: '下场对手近期表现趋势' },
      { level: 2, name: '专业球探网络', cost: 1100, effects: { scoutLevel: 2 }, desc: '门将扑点能力+对手惯用阵型' },
      { level: 3, name: '全球情报网', cost: 1800, effects: { scoutLevel: 3, tacticalPrediction: true }, desc: '对手战术倾向预判+完整档案' },
    ],
  },
]

/**
 * 获取部门当前等级数据
 */
export function getDepartmentLevelData(deptId, currentLevel) {
  const dept = LOGISTICS_DEPARTMENTS.find(d => d.id === deptId)
  if (!dept) return null
  return dept.levels[currentLevel] || dept.levels[0]
}

/**
 * 获取升级到下一级的费用
 */
export function getUpgradeCost(deptId, currentLevel) {
  const dept = LOGISTICS_DEPARTMENTS.find(d => d.id === deptId)
  if (!dept) return Infinity
  const nextLevel = dept.levels[currentLevel + 1]
  return nextLevel ? nextLevel.cost : Infinity
}

/**
 * 获取部门最大等级
 */
export function getMaxLevel(deptId) {
  const dept = LOGISTICS_DEPARTMENTS.find(d => d.id === deptId)
  return dept ? dept.levels.length - 1 : 0
}
