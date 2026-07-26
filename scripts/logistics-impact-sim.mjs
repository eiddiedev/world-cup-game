#!/usr/bin/env node
/**
 * 四个直接效果后勤部门胜率贡献 Monte Carlo 模拟
 *
 * 模拟完整世界杯征程（3场小组赛 + 最多5场淘汰赛 = 8场），
 * 对比有/无各部门加成时的夺冠概率和场均胜率。
 *
 * 运行: node scripts/logistics-impact-sim.mjs [--rounds 5000]
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}
const ROUNDS = parseInt(getArg('rounds', '5000'), 10)

// ─── 导入项目模块 ─────────────────────────────────────────────────────────────
const { getLogisticsModifiers } = await import(join(ROOT, 'src/utils/logisticsEffects.js'))
const { resolveShootoutAttempt, pickAiKeeperZone, pickAiShooterZone } = await import(
  join(ROOT, 'src/utils/penaltyShootout.js')
)

// ─── 模拟参数 ─────────────────────────────────────────────────────────────────
const BASE_TEAM_RATING = 76       // 我方基础评分
const OPPONENT_RATINGS = [72, 75, 78, 74, 76, 80, 77, 82] // 8个对手评分（小组3+淘汰5）
const BASE_STAMINA = 82           // 初始体力
const STAMINA_DECAY_PER_MATCH = 14 // 每场体力消耗
const BASE_RECOVERY = 10          // 基础赛后恢复
const MORALE_START = 72           // 初始士气
const MORALE_WIN_BONUS = 6        // 赢球士气加成
const MORALE_LOSS_PENALTY = 10    // 输球士气惩罚
const MORALE_DRAW_PENALTY = 3     // 平局士气衰减

// ─── 工具 ─────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)) }

// ─── 胜率模型 ─────────────────────────────────────────────────────────────────
// 体力/士气通过影响"有效评分"来影响胜率
function computeWinProb(myRating, oppRating, avgStamina, avgMorale) {
  // 体力影响：满体力=无修正，50体力=-4分，30体力=-8分
  const staminaFactor = (avgStamina - 70) * 0.12
  // 士气影响：满士气=+3，低士气=-5
  const moraleFactor = (avgMorale - 65) * 0.10
  const effectiveRating = myRating + staminaFactor + moraleFactor
  const diff = effectiveRating - oppRating
  // Sigmoid 胜率
  return clamp(1 / (1 + Math.exp(-diff * 0.18)), 0.08, 0.92)
}

// ─── 单场模拟 ─────────────────────────────────────────────────────────────────
function simulateMatch(myRating, oppRating, stamina, morale, rng, isKnockout) {
  const winProb = computeWinProb(myRating, oppRating, stamina, morale)
  const drawProb = 0.22
  const roll = rng()

  let result
  if (roll < winProb) result = 'win'
  else if (roll < winProb + drawProb) result = 'draw'
  else result = 'loss'

  // 淘汰赛平局进入点球
  if (isKnockout && result === 'draw') {
    return 'penalty'
  }
  return result
}

// ─── 点球大战模拟 ─────────────────────────────────────────────────────────────
function simulatePenaltyShootout(stabilityBonus, rng) {
  // 5轮点球，我方射门 + 对手射门
  let myScore = 0, oppScore = 0
  for (let round = 0; round < 5; round++) {
    // 我方射门（stabilityBonus 降低打飞/被扑概率）
    const myAttempt = resolveShootoutAttempt({
      shooterZone: ['left-top', 'right-bottom', 'left-bottom', 'right-top', 'center-top'][round],
      keeperZone: pickAiKeeperZone(74, rng),
      shooterTec: 76,
      keeperDef: 74,
      stabilityBonus,
      random: rng,
    })
    if (myAttempt.scored) myScore++

    // 对手射门
    const oppPick = pickAiShooterZone(74, rng)
    const oppAttempt = resolveShootoutAttempt({
      shooterZone: oppPick.zone,
      keeperZone: pickAiKeeperZone(74, rng),
      overpowered: oppPick.overpowered,
      shooterTec: 74,
      keeperDef: 74,
      random: rng,
    })
    if (oppAttempt.scored) oppScore++
  }

  if (myScore !== oppScore) return myScore > oppScore ? 'win' : 'loss'
  // 突然死亡
  for (let i = 0; i < 10; i++) {
    const my = resolveShootoutAttempt({
      shooterZone: ['left-top', 'right-bottom'][i % 2],
      keeperZone: pickAiKeeperZone(74, rng),
      shooterTec: 76, keeperDef: 74, stabilityBonus, random: rng,
    })
    const opp = resolveShootoutAttempt({
      shooterZone: pickAiShooterZone(74, rng).zone,
      keeperZone: pickAiKeeperZone(74, rng),
      shooterTec: 74, keeperDef: 74, random: rng,
    })
    if (my.scored && !opp.scored) return 'win'
    if (!my.scored && opp.scored) return 'loss'
  }
  return rng() < 0.5 ? 'win' : 'loss'
}

// ─── 完整征程模拟 ─────────────────────────────────────────────────────────────
function simulateTournament(seed, logisticsLevels) {
  const rng = mulberry32(seed)
  const mods = getLogisticsModifiers(logisticsLevels)

  let stamina = BASE_STAMINA
  let morale = MORALE_START
  let wins = 0, draws = 0, losses = 0
  let champion = false

  // 应用营养团队开场体力加成
  stamina = clamp(stamina + mods.matchStartStaminaBonus, 0, 100)
  // 应用心理团队士气加成
  morale = clamp(morale + mods.moraleDecayReduction * 20, 0, 99)

  for (let matchIdx = 0; matchIdx < 8; matchIdx++) {
    const oppRating = OPPONENT_RATINGS[matchIdx]
    const isKnockout = matchIdx >= 3

    // 训练基地：randomFormBoost 随机1人状态提升 → 等效为微小评分加成
    const formBoost = mods.randomFormBoost ? 1.5 : 0
    const trainingBoost = mods.trainingEfficiency * 5 // 训练效率→评分加成
    const effectiveMyRating = BASE_TEAM_RATING + formBoost + trainingBoost

    let result = simulateMatch(effectiveMyRating, oppRating, stamina, morale, rng, isKnockout)

    // 点球大战
    if (result === 'penalty') {
      result = simulatePenaltyShootout(mods.penaltyStabilityBonus, rng)
    }

    if (result === 'win') {
      wins++
      morale = clamp(morale + MORALE_WIN_BONUS * (1 - mods.moraleDecayReduction * 0.5), 0, 99)
    } else if (result === 'draw') {
      draws++
      morale = clamp(morale - MORALE_DRAW_PENALTY * (1 - mods.moraleDecayReduction), 0, 99)
    } else {
      losses++
      morale = clamp(morale - MORALE_LOSS_PENALTY * (1 - mods.moraleDecayReduction), 0, 99)
      if (isKnockout) break // 淘汰赛输了就结束
    }

    // 小组赛3场后检查是否出线
    if (matchIdx === 2 && wins === 0) break // 0胜不出线（简化）

    // 赛后体力恢复
    const decay = STAMINA_DECAY_PER_MATCH * mods.staminaDecayMultiplier
    stamina = clamp(stamina - decay, 20, 100)
    const recovery = BASE_RECOVERY + mods.staminaRecoveryBonus
    stamina = clamp(stamina + recovery, 20, 100)

    // 医疗：伤病概率降低 → 等效为减少因伤缺阵带来的评分损失
    // 这里简化为：有医疗加成时，体力额外恢复一点（代表少伤病）
    if (mods.injuryProbMultiplier < 1) {
      stamina = clamp(stamina + (1 - mods.injuryProbMultiplier) * 3, 20, 100)
    }

    // 营养：连续比赛疲劳减免
    if (mods.fatigueReduction > 0 && matchIdx >= 3) {
      stamina = clamp(stamina + mods.fatigueReduction * 4, 20, 100)
    }

    // 打到决赛并获胜 = 冠军
    if (matchIdx === 7 && result === 'win') champion = true
  }

  return { wins, draws, losses, champion, totalMatches: wins + draws + losses }
}

// ─── 部门配置 ─────────────────────────────────────────────────────────────────
const DEPT_CONFIGS = {
  '无后勤(基线)': {},
  '医疗团队 Lv3': { medical: 3 },
  '营养团队 Lv3': { nutrition: 3 },
  '心理团队 Lv3': { psychology: 3 },
  '训练基地 Lv3': { training: 3 },
  '全部 Lv3': { medical: 3, nutrition: 3, psychology: 3, training: 3 },
}

// ─── 主模拟 ───────────────────────────────────────────────────────────────────
console.log(`\n╔═══════════════════════════════════════════════════════╗`)
console.log(`║   直接效果后勤部门胜率贡献模拟 — ${ROUNDS} 轮完整世界杯 ║`)
console.log(`╚═══════════════════════════════════════════════════════╝\n`)

const results = {}

for (const [label, levels] of Object.entries(DEPT_CONFIGS)) {
  let totalWins = 0, totalDraws = 0, totalLosses = 0
  let champions = 0, totalMatches = 0, penaltyWins = 0

  for (let i = 0; i < ROUNDS; i++) {
    const outcome = simulateTournament(i * 7919 + 42, levels)
    totalWins += outcome.wins
    totalDraws += outcome.draws
    totalLosses += outcome.losses
    totalMatches += outcome.totalMatches
    if (outcome.champion) champions++
  }

  const winRate = (totalWins / totalMatches * 100).toFixed(1)
  const champRate = (champions / ROUNDS * 100).toFixed(1)
  const avgWins = (totalWins / ROUNDS).toFixed(2)

  results[label] = { winRate, champRate, avgWins }

  console.log(`  ${label.padEnd(16)} | 场均胜率: ${winRate}% | 场均胜场: ${avgWins} | 夺冠率: ${champRate}%`)
}

// ─── 对比分析 ─────────────────────────────────────────────────────────────────
console.log('\n─── 各部门相对基线提升 ───\n')
const baseline = results['无后勤(基线)']
for (const [label, data] of Object.entries(results)) {
  if (label === '无后勤(基线)') continue
  const winDiff = (parseFloat(data.winRate) - parseFloat(baseline.winRate)).toFixed(1)
  const champDiff = (parseFloat(data.champRate) - parseFloat(baseline.champRate)).toFixed(1)
  console.log(`  ${label.padEnd(16)} | 胜率 ${winDiff > 0 ? '+' : ''}${winDiff}% | 夺冠率 ${champDiff > 0 ? '+' : ''}${champDiff}%`)
}

console.log('\n─── 结论 ───\n')
const allData = results['全部 Lv3']
const totalWinLift = (parseFloat(allData.winRate) - parseFloat(baseline.winRate)).toFixed(1)
const totalChampLift = (parseFloat(allData.champRate) - parseFloat(baseline.champRate)).toFixed(1)
console.log(`   four departments combined: 胜率 +${totalWinLift}%, 夺冠率 +${totalChampLift}%`)
console.log(`  基线夺冠率 ${baseline.champRate}% → 全满夺冠率 ${allData.champRate}%\n`)
