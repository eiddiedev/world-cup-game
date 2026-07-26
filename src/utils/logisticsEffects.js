/**
 * 后勤效果计算器
 * 根据当前 run 的 logisticsLevels 计算所有修正值
 */
import { LOGISTICS_DEPARTMENTS } from '../data/logisticsDepartments.js'

/**
 * 默认修正值（无任何后勤升级时）
 */
const DEFAULT_MODIFIERS = {
  injuryProbMultiplier: 1.0,       // 伤病概率乘数（<1 = 减少）
  injuryRecoveryBonus: 0,          // 伤病恢复加成
  staminaRecoveryBonus: 0,         // 赛后体力恢复加成
  matchStartStaminaBonus: 0,       // 开场体力加成
  moraleDecayReduction: 0,         // 士气衰减减免 (0~1)
  penaltyStabilityBonus: 0,        // 点球稳定性加成 (0~1)
  staminaDecayMultiplier: 1.0,     // 体能衰减乘数（<1 = 减少）
  fatigueReduction: 0,             // 连续比赛疲劳减免
  coreNoFatigue: false,            // 核心球员不进入疲劳
  playThroughInjury: false,        // 可带伤出战
  pressureImmunity: false,         // 决赛压力免疫
  intelLevel: 0,                   // 情报等级 0~3
  scoutLevel: 0,                   // 球探等级 0~3
  tacticalAdvice: false,           // 赛前战术建议
  tacticalPrediction: false,       // 对手战术预判
  trainingEfficiency: 0,           // 训练效率加成
  randomFormBoost: false,          // 随机1人状态提升
  trainingTheme: false,            // 可选训练主题
}

/**
 * 根据 logisticsLevels 计算综合修正值
 * @param {object} logisticsLevels - { [deptId]: level }
 * @returns {object} 修正值对象
 */
export function getLogisticsModifiers(logisticsLevels = {}) {
  const modifiers = { ...DEFAULT_MODIFIERS }

  for (const dept of LOGISTICS_DEPARTMENTS) {
    const level = logisticsLevels[dept.id] || 0
    if (level === 0) continue

    const levelData = dept.levels[level]
    if (!levelData || !levelData.effects) continue

    const fx = levelData.effects

    // 医疗
    if (fx.injuryProbReduction) {
      modifiers.injuryProbMultiplier = Math.max(0.3, 1 - fx.injuryProbReduction)
    }
    if (fx.injuryRecoveryBonus) {
      modifiers.injuryRecoveryBonus = Math.max(modifiers.injuryRecoveryBonus, fx.injuryRecoveryBonus)
    }
    if (fx.knockoutStaminaRecovery) {
      modifiers.staminaRecoveryBonus = Math.max(modifiers.staminaRecoveryBonus, fx.knockoutStaminaRecovery)
    }
    if (fx.staminaDecayReduction) {
      modifiers.staminaDecayMultiplier = Math.max(0.5, 1 - fx.staminaDecayReduction)
    }
    if (fx.playThroughInjury) {
      modifiers.playThroughInjury = true
    }

    // 营养
    if (fx.matchStartStaminaBonus) {
      modifiers.matchStartStaminaBonus = Math.max(modifiers.matchStartStaminaBonus, fx.matchStartStaminaBonus)
    }
    if (fx.fatigueReduction) {
      modifiers.fatigueReduction = Math.max(modifiers.fatigueReduction, fx.fatigueReduction)
    }
    if (fx.coreNoFatigue) {
      modifiers.coreNoFatigue = true
    }

    // 心理
    if (fx.moraleDecayReduction) {
      modifiers.moraleDecayReduction = Math.max(modifiers.moraleDecayReduction, fx.moraleDecayReduction)
    }
    if (fx.penaltyStabilityBonus) {
      modifiers.penaltyStabilityBonus = Math.max(modifiers.penaltyStabilityBonus, fx.penaltyStabilityBonus)
    }
    if (fx.pressureImmunity) {
      modifiers.pressureImmunity = true
    }

    // 数据分析
    if (fx.intelLevel != null) {
      modifiers.intelLevel = Math.max(modifiers.intelLevel, fx.intelLevel)
    }
    if (fx.tacticalAdvice) {
      modifiers.tacticalAdvice = true
    }

    // 训练
    if (fx.trainingEfficiency) {
      modifiers.trainingEfficiency = Math.max(modifiers.trainingEfficiency, fx.trainingEfficiency)
    }
    if (fx.randomFormBoost) {
      modifiers.randomFormBoost = true
    }
    if (fx.trainingTheme) {
      modifiers.trainingTheme = true
    }

    // 球探
    if (fx.scoutLevel != null) {
      modifiers.scoutLevel = Math.max(modifiers.scoutLevel, fx.scoutLevel)
    }
    if (fx.tacticalPrediction) {
      modifiers.tacticalPrediction = true
    }
  }

  return modifiers
}

/**
 * 获取情报面板数据（用于 TournamentScreen 展示）
 * @deprecated 请使用 computeMatchIntel 代替，该函数从真实数据计算情报
 * @param {object} modifiers - getLogisticsModifiers 的返回值
 * @param {object} opponent - 对手球队数据
 * @returns {object|null} 情报数据，null 表示无情报
 */
export function getIntelPanelData(modifiers, opponent) {
  if (!opponent || modifiers.intelLevel === 0) return null
  // 兼容层：返回简化结构，新代码应直接使用 computeMatchIntel
  return { level: modifiers.intelLevel, legacy: true }
}

// 推荐使用新版情报计算引擎
export { computeMatchIntel } from './scoutIntel.js'
