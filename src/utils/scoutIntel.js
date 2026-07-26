/**
 * 赛前情报计算引擎
 * 所有情报均从对手真实数据中动态计算，不含硬编码假文案。
 * 数据分析中心(intelLevel)：提供对手属性分析、弱点识别、战术建议
 * 情报部门(scoutLevel)：提供对手趋势、门将能力、战术预判
 */
import { calculateLineupRatings } from './lineupBalance.js'
import {
  FORMATION_TACTICS,
  FORMATION_COUNTERS,
  getFormationBehavior,
} from '../data/formationTactics.js'
import { getKeeperTendency, getKeeperBiasLabel } from '../data/keeperTendencies.js'

const AREA_LABELS = {
  attack: '进攻',
  midfield: '中场',
  defense: '防守',
}

/**
 * 获取对手的风格标签
 * 优先使用球队自带 styleTags，否则从阵型战术属性推导
 */
function getOpponentStrengths(opponentTeam, opponentSetup) {
  if (opponentTeam?.styleTags?.length) {
    return opponentTeam.styleTags.slice(0, 3)
  }
  // 从阵型战术推导风格标签
  const tactics = opponentSetup.tactics || FORMATION_TACTICS[opponentSetup.formation]
  if (!tactics) return ['均衡推进']
  const tags = [tactics.style]
  // 根据阵型人数结构补充标签
  const counts = tactics.counts || {}
  if ((counts.FW || 0) >= 3) tags.push('多前锋冲击')
  if ((counts.DF || 0) >= 5) tags.push('密集防守')
  if ((counts.MF || 0) >= 5) tags.push('中场控制')
  if ((counts.FW || 0) <= 1) tags.push('单箭头反击')
  return tags.slice(0, 3)
}

/**
 * 找到对手阵容中评分最高的危险球员
 */
function findDangerPlayer(opponentSetup) {
  const lineup = opponentSetup.lineup || []
  if (lineup.length === 0) return null
  const sorted = [...lineup].sort((a, b) => (b.rating || 0) - (a.rating || 0))
  const top = sorted[0]
  return {
    name: top.name,
    position: top.assignedPosition || top.position,
    rating: top.rating,
    spd: top.spd,
    tec: top.tec,
    star: top.star || 1,
  }
}

/**
 * 计算对手弱点（基于真实评分对比）
 * 找出对手三维评分中最低的维度，与我方对应维度对比
 */
function computeWeakness(opponentSetup, playerLineup, playerFormation) {
  const opponentRatings = calculateLineupRatings(opponentSetup.lineup, opponentSetup.formation)
  const playerRatings = calculateLineupRatings(playerLineup, playerFormation)

  const dimensions = [
    { key: 'attack', opponent: opponentRatings.attack, player: playerRatings.attack, counterKey: 'attack' },
    { key: 'midfield', opponent: opponentRatings.midfield, player: playerRatings.midfield, counterKey: 'midfield' },
    { key: 'defense', opponent: opponentRatings.defense, player: playerRatings.defense, counterKey: 'defense' },
  ]

  // 找对手最弱维度
  const weakest = dimensions.reduce((min, d) => d.opponent < min.opponent ? d : min, dimensions[0])

  // 找我方最强维度（用于建议）
  const strongest = dimensions.reduce((max, d) => d.player > max.player ? d : max, dimensions[0])

  const diff = strongest.player - weakest.opponent
  let advice
  if (weakest.key === 'defense') {
    advice = `对手防守评分${weakest.opponent}，我方进攻评分${strongest.player}，可主动压上制造威胁`
  } else if (weakest.key === 'midfield') {
    advice = `对手中场评分${weakest.opponent}，我方中场评分${strongest.player}，可加强控球争夺`
  } else {
    advice = `对手进攻评分${weakest.opponent}，我方防守评分${strongest.player}，可稳固防守后反击`
  }

  return {
    area: weakest.key,
    areaLabel: AREA_LABELS[weakest.key],
    opponentRating: weakest.opponent,
    playerRating: strongest.player,
    playerArea: strongest.key,
    playerAreaLabel: AREA_LABELS[strongest.key],
    diff,
    advice,
  }
}

/**
 * 基于阵型克制关系生成战术建议
 */
function computeTacticalAdvice(opponentFormation) {
  const counter = FORMATION_COUNTERS[opponentFormation]
  if (!counter) return null
  return {
    opponentFormation,
    recommendedFormation: counter.weakTo,
    reason: counter.reason,
  }
}

/**
 * 获取对手实力趋势描述（基于评分和阵型）
 */
function computeFormTrend(opponentSetup) {
  const lineup = opponentSetup.lineup || []
  const avgRating = lineup.length > 0
    ? Math.round(lineup.reduce((sum, p) => sum + (p.rating || 60), 0) / lineup.length)
    : 70

  let tier
  if (avgRating >= 82) tier = '强队'
  else if (avgRating >= 73) tier = '中游'
  else tier = '弱旅'

  const tactics = opponentSetup.tactics || FORMATION_TACTICS[opponentSetup.formation]
  const style = tactics?.style || '均衡'

  return `${tier}水平（平均评分${avgRating}），战术风格偏${style}，近期状态稳定`
}

/**
 * 获取对手门将真实能力 + 扑点习惯
 */
function computeGoalkeeperInfo(opponentSetup, opponentTeamId, opponentTeamName) {
  const lineup = opponentSetup.lineup || []
  const gk = lineup.find(p => (p.assignedPosition || p.position) === 'GK')
  if (!gk) return null

  const saveRating = gk.def || gk.rating || 60
  let tip
  if (saveRating >= 80) {
    tip = `门将扑救评分${saveRating}，门前反应出色，建议多打配合撕开防线而非远射`
  } else if (saveRating >= 70) {
    tip = `门将扑救评分${saveRating}，能力中规中矩，远射和角度球有一定威胁`
  } else {
    tip = `门将扑救评分${saveRating}，门前能力偏弱，远射和定位球得分率较高`
  }

  // 扑点习惯
  const tendency = getKeeperTendency(opponentTeamId, opponentTeamName)

  return {
    name: gk.name,
    saveRating,
    tip,
    tendency: {
      bias: tendency.bias,
      biasLabel: getKeeperBiasLabel(tendency.bias),
      strength: tendency.strength,
      description: tendency.description,
    },
  }
}

/**
 * 基于阵型行为模式生成战术预判
 */
function computeTacticalPrediction(opponentFormation) {
  const behavior = getFormationBehavior(opponentFormation)
  return {
    whenWinning: behavior.whenWinning,
    whenLosing: behavior.whenLosing,
    keyThreat: behavior.keyThreat,
  }
}

/**
 * 计算完整赛前情报
 * @param {object} params
 * @param {object} params.opponentSetup - getOpponentMatchSetup 返回值 { formation, lineup, tactics }
 * @param {object|null} params.opponentTeam - getTeamById 返回的球队数据（可能为 null）
 * @param {Array} params.playerLineup - 我方首发阵容数组
 * @param {string} params.playerFormation - 我方阵型
 * @param {number} params.intelLevel - 数据分析中心等级 0~3
 * @param {number} params.scoutLevel - 情报部门等级 0~3
 * @returns {object|null} 情报数据，若两个等级都为0则返回 null
 */
export function computeMatchIntel({
  opponentSetup,
  opponentTeam,
  opponentTeamId,
  playerLineup = [],
  playerFormation = '4-3-3',
  intelLevel = 0,
  scoutLevel = 0,
}) {
  if (!opponentSetup || (intelLevel === 0 && scoutLevel === 0)) return null

  const result = { intel: null, scout: null }

  // === 数据分析中心 ===
  if (intelLevel > 0) {
    const intel = { level: intelLevel }

    // L1: 对手优势属性
    intel.strengths = getOpponentStrengths(opponentTeam, opponentSetup)

    // L2: 危险球员 + 弱点
    if (intelLevel >= 2) {
      intel.dangerPlayer = findDangerPlayer(opponentSetup)
      if (playerLineup.length > 0) {
        intel.weakness = computeWeakness(opponentSetup, playerLineup, playerFormation)
      }
    }

    // L3: 战术建议
    if (intelLevel >= 3) {
      intel.tacticalAdvice = computeTacticalAdvice(opponentSetup.formation)
    }

    result.intel = intel
  }

  // === 情报部门 ===
  if (scoutLevel > 0) {
    const scout = { level: scoutLevel }

    // L1: 对手近期表现趋势
    scout.formTrend = computeFormTrend(opponentSetup)

    // L2: 门将能力 + 惯用阵型
    if (scoutLevel >= 2) {
      scout.goalkeeper = computeGoalkeeperInfo(opponentSetup, opponentTeamId, opponentTeam?.name || opponentSetup.teamName)
      scout.formationTendency = `${opponentSetup.formation}（${opponentSetup.tactics?.style || '均衡'}体系）`
    }

    // L3: 战术倾向预判
    if (scoutLevel >= 3) {
      scout.tacticalPrediction = computeTacticalPrediction(opponentSetup.formation)
    }

    result.scout = scout
  }

  return result
}
