/**
 * 后勤预算 & 赛事奖金系统
 *
 * 设计思路：
 * - 每支队伍有初始后勤预算（首局使用）
 * - 未花完的预算 + 赛事奖金 累积到下一局
 * - 高难度队伍可通过"少买→刷奖金→攒满"策略循环变强
 */

/**
 * 各队初始后勤预算（首局）
 * 与球队难度/实力挂钩：强队预算高，弱队预算低
 */
export const INITIAL_LOGISTICS_BUDGET = {
  france: 5000,
  brazil: 4800,
  argentina: 5000,
  portugal: 4500,
  germany: 4200,
  japan: 3800,
  norway: 3500,
  morocco: 3500,
  newzealand: 2500,
  curacao: 2000,
  spain: 5000,
  england: 4800,
  usa: 4000,
  canada: 3500,
  mexico: 3500,
  colombia: 3800,
  capeverde: 2500,
}

/**
 * 赛事奖金表
 */
export const PRIZE_MONEY = {
  groupWin: 300,       // 每场小组赛胜利
  groupDraw: 100,      // 每场小组赛平局
  round32: 400,        // 进入32强
  round16: 800,        // 进入16强
  quarterfinal: 1200,  // 进入8强
  semifinal: 2000,     // 进入4强（含季军争夺资格）
  thirdPlace: 2500,    // 季军
  finalist: 3000,      // 亚军
  champion: 5000,      // 冠军
}

/**
 * 计算本次征程获得的总奖金
 * @param {string} finalResult - 'champion'|'finalist'|'semifinal'|'quarterfinal'|'round16'|'round32'|'group'
 * @param {string[]} matchResults - 小组赛结果数组 ['win','draw','loss',...]
 * @param {boolean} isThirdPlace - 是否为季军（四强淘汰后赢季军赛）
 */
export function calculatePrizeMoney(finalResult, matchResults = [], isThirdPlace = false) {
  let total = 0

  // 小组赛赢球/平局奖金
  for (const r of matchResults) {
    if (r === 'win') total += PRIZE_MONEY.groupWin
    else if (r === 'draw') total += PRIZE_MONEY.groupDraw
  }

  // 阶段奖金
  const stagePrize = {
    champion: PRIZE_MONEY.champion,
    finalist: PRIZE_MONEY.finalist,
    semifinal: isThirdPlace ? PRIZE_MONEY.thirdPlace : PRIZE_MONEY.semifinal,
    quarterfinal: PRIZE_MONEY.quarterfinal,
    round16: PRIZE_MONEY.round16,
    round32: PRIZE_MONEY.round32,
    group: 0,
  }
  total += stagePrize[finalResult] || 0

  return total
}

/**
 * 获取某队当前可用的后勤预算
 * = 初始预算（首局）或 累积余额（后续局）+ 未花完部分
 * @param {string} teamId
 * @param {object} saveData - 完整存档
 * @returns {number}
 */
export function getAvailableLogisticsBudget(teamId, saveData) {
  const budgets = saveData.logisticsBudgets || {}
  // 如果已有累积记录，使用累积值
  if (budgets[teamId] != null) {
    return budgets[teamId]
  }
  // 首局使用初始预算
  return INITIAL_LOGISTICS_BUDGET[teamId] || 3000
}

/**
 * 结算后勤预算：将未花完的 + 奖金 写回存档
 * @param {string} teamId
 * @param {number} remainingBudget - 本局未花完的后勤预算
 * @param {number} prizeMoney - 本局获得的奖金
 * @param {object} saveData - 完整存档（会被修改）
 */
export function settleLogisticsBudget(teamId, remainingBudget, prizeMoney, saveData) {
  if (!saveData.logisticsBudgets) {
    saveData.logisticsBudgets = {}
  }
  saveData.logisticsBudgets[teamId] = remainingBudget + prizeMoney
}
