/**
 * 比赛模拟引擎
 * 基于球员属性和阵型计算比赛结果
 */
import { getOpponentMatchSetup } from './opponentTactics.js'

// 阵型系数配置
export const formations = {
  '4-3-3': { attack: 1.15, defense: 0.95, midfield: 1.0 },
  '4-4-2': { attack: 1.0, defense: 1.0, midfield: 1.1 },
  '4-2-3-1': { attack: 1.05, defense: 1.05, midfield: 1.15 },
  '4-3-2-1': { attack: 1.1, defense: 0.95, midfield: 1.2 },
  '3-5-2': { attack: 1.05, defense: 0.9, midfield: 1.25 },
  '3-4-3': { attack: 1.25, defense: 0.8, midfield: 1.05 },
  '3-4-2-1': { attack: 1.12, defense: 0.92, midfield: 1.16 },
  '5-3-2': { attack: 0.9, defense: 1.2, midfield: 1.0 },
  '4-1-4-1': { attack: 1.0, defense: 1.1, midfield: 1.1 },
  '4-4-1-1': { attack: 1.05, defense: 1.0, midfield: 1.1 },
}

/**
 * 计算球员实际属性（考虑状态）
 */
export function getEffectiveAttribute(baseValue, status) {
  return Math.round(baseValue * (status / 100))
}

/**
 * 计算球队平均属性
 */
export function getTeamAverageAttribute(players, attr, statusMap) {
  if (players.length === 0) return 50
  const total = players.reduce((sum, p) => {
    const status = statusMap[p.id] || 80
    return sum + getEffectiveAttribute(p[attr], status)
  }, 0)
  return total / players.length
}

/**
 * 计算门将扑救率
 */
function getGoalkeeperSaveRate(gk, status) {
  if (!gk) return 0.3
  const def = getEffectiveAttribute(gk.def, status)
  const phy = getEffectiveAttribute(gk.phy, status)
  return Math.min(0.8, (def * 0.6 + phy * 0.4) / 200)
}

/**
 * 计算突破成功率
 */
function getBreakthroughSuccessRate(attackerSpd, defenderDef, formationAttack) {
  const base = (attackerSpd * 0.7) / (attackerSpd * 0.7 + defenderDef * 0.3)
  return Math.min(0.9, base * formationAttack)
}

/**
 * 计算射门命中率
 */
function getShotAccuracy(tec, phy, gkSaveRate, star, isGolden, goldenBonus) {
  const base = (tec * 0.6 + phy * 0.4) / 200
  const starBonus = star * 0.05
  const bonus = isGolden ? goldenBonus : 0
  const accuracy = base + starBonus + bonus
  return Math.min(0.95, accuracy * (1 - gkSaveRate))
}

/**
 * 计算传球精准度
 */
function getPassAccuracy(tec, status, formationMidfield) {
  const effectiveTec = getEffectiveAttribute(tec, status)
  const base = effectiveTec / 100
  return Math.min(0.95, base * formationMidfield)
}

/**
 * 计算对抗胜率
 */
export function getDuelWinRate(phy, opponentPhy, status, opponentStatus) {
  const effectivePhy = getEffectiveAttribute(phy, status)
  const effectiveOpponentPhy = getEffectiveAttribute(opponentPhy, opponentStatus)
  return effectivePhy / (effectivePhy + effectiveOpponentPhy)
}

/**
 * 生成随机状态值 (60-100)
 */
export function generateStatus() {
  return Math.floor(Math.random() * 41) + 60
}

/**
 * 应用疲劳累积
 */
export function applyFatigue(status, consecutiveGames) {
  const fatiguePenalty = consecutiveGames * 5
  return Math.max(30, status - fatiguePenalty)
}

/**
 * 获取状态颜色
 */
export function getStatusColor(status) {
  if (status > 80) return 'green'
  if (status >= 60) return 'yellow'
  return 'red'
}

/**
 * 模拟一次关键时刻
 */
export function simulateKeyMoment(attackingTeam, defendingTeam, formation, statusMap, choice) {
  const form = formations[formation] || formations['4-3-3']

  // 获取关键球员
  const attackers = attackingTeam.filter(p => p.position !== 'GK')
  const defenders = defendingTeam.filter(p => p.position !== 'GK')
  const gk = defendingTeam.find(p => p.position === 'GK')

  if (attackers.length === 0 || defenders.length === 0) {
    return { success: false, event: '无效进攻' }
  }

  // 随机选择参与球员
  const attacker = attackers[Math.floor(Math.random() * attackers.length)]
  const defender = defenders[Math.floor(Math.random() * defenders.length)]

  const attackerStatus = statusMap[attacker.id] || 80
  const defenderStatus = statusMap[defender.id] || 80
  const gkStatus = gk ? (statusMap[gk.id] || 80) : 80

  let successRate
  let eventText

  switch (choice) {
    case 'attack': // 继续突破
      successRate = getBreakthroughSuccessRate(
        getEffectiveAttribute(attacker.spd, attackerStatus),
        getEffectiveAttribute(defender.def, defenderStatus),
        form.attack
      )
      eventText = successRate > 0.5
        ? `${attacker.name}突破成功！`
        : `${attacker.name}被${defender.name}断球`
      break

    case 'shoot': { // 内切射门
      const gkSaveRate = getGoalkeeperSaveRate(gk, gkStatus)
      successRate = getShotAccuracy(
        attacker.tec,
        attacker.phy,
        gkSaveRate,
        attacker.star,
        attacker.isGolden,
        0.15
      )
      eventText = successRate > 0.4
        ? `${attacker.name}射门！`
        : `${attacker.name}射门被${gk?.name || '门将'}扑出`
      break
    }

    case 'pass': // 回传组织
      successRate = getPassAccuracy(
        attacker.tec,
        attackerStatus,
        form.midfield
      )
      eventText = successRate > 0.6
        ? `${attacker.name}精准传球，组织进攻`
        : `${attacker.name}传球失误`
      break

    case 'long': // 长传转移
      successRate = getPassAccuracy(
        attacker.tec,
        attackerStatus,
        form.midfield
      ) * 0.8 // 长传难度更高
      eventText = successRate > 0.5
        ? `${attacker.name}长传转移，拉开空间`
        : `${attacker.name}长传出界`
      break

    default:
      successRate = 0.5
      eventText = '比赛继续'
  }

  // 金卡隐藏属性加成
  if (attacker.isGolden) {
    successRate = Math.min(0.95, successRate + 0.1)
  }

  const success = Math.random() < successRate

  // 如果是射门且成功，判断是否进球
  let isGoal = false
  if (choice === 'shoot' && success) {
    const goalChance = successRate * 0.6 // 射门成功后有60%概率进球
    isGoal = Math.random() < goalChance
    if (isGoal) {
      eventText = `⚽ ${attacker.name}进球！！`
    }
  }

  return {
    success,
    isGoal,
    event: eventText,
    player: attacker.name,
  }
}

/**
 * 模拟一场比赛
 */
export function simulateMatch(homeTeam, awayTeam, homeFormation, awayFormation, homeStatusMap, awayStatusMap) {
  const events = []
  let homeScore = 0
  let awayScore = 0

  // 模拟90分钟，每15分钟可能触发一次关键时刻
  for (let minute = 0; minute <= 90; minute += 15) {
    if (minute === 0) continue

    // 50%概率触发关键时刻
    if (Math.random() > 0.5) {
      // 随机选择进攻方
      const isHomeAttack = Math.random() > 0.5
      const attackingTeam = isHomeAttack ? homeTeam : awayTeam
      const defendingTeam = isHomeAttack ? awayTeam : homeTeam
      const formation = isHomeAttack ? homeFormation : awayFormation
      const statusMap = isHomeAttack ? homeStatusMap : awayStatusMap

      // 随机选择战术
      const choices = ['attack', 'shoot', 'pass', 'long']
      const choice = choices[Math.floor(Math.random() * choices.length)]

      const result = simulateKeyMoment(attackingTeam, defendingTeam, formation, statusMap, choice)

      events.push({
        minute,
        text: result.event,
        isGoal: result.isGoal,
      })

      if (result.isGoal) {
        if (isHomeAttack) {
          homeScore++
        } else {
          awayScore++
        }
      }
    }
  }

  // 确保至少有一个事件
  if (events.length === 0) {
    events.push({ minute: 45, text: '上半场结束，双方0-0', isGoal: false })
    events.push({ minute: 90, text: '比赛结束，双方0-0', isGoal: false })
  }

  // 添加比赛开始和结束事件
  events.unshift({ minute: 0, text: '比赛开始！', isGoal: false })
  events.push({ minute: 90, text: '比赛结束', isGoal: false })

  return {
    homeScore,
    awayScore,
    events,
  }
}

/**
 * 生成AI对手阵容（简化版）
 * 根据 opponentStrength 调整属性范围，拉大强弱差距
 */
export function generateOpponentTeam(teamId, teamData, opponentStrength) {
  return getOpponentMatchSetup(teamData?.name || teamId, teamData, opponentStrength).lineup
}
