#!/usr/bin/env node
/**
 * 情报系统有效性验证 — Monte Carlo 模拟
 *
 * 验证目标：
 *   1. 点球大战：朝门将弱点方向射门 vs 朝门将习惯方向射门，得分率差异
 *   2. 阵型克制：使用推荐克制阵型 vs 使用被克制阵型，胜率差异
 *   3. 弱点利用：针对对手最弱维度的战术 vs 无针对性战术，胜率差异
 *
 * 运行方式:
 *   node scripts/intel-validation-sim.mjs [--rounds 5000]
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ─── 参数 ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}
const ROUNDS = parseInt(getArg('rounds', '5000'), 10)

// ─── 导入项目模块 ─────────────────────────────────────────────────────────────
const { pickAiKeeperZone, resolveShootoutAttempt, PENALTY_ZONES } = await import(
  join(ROOT, 'src/utils/penaltyShootout.js')
)
const { getKeeperTendency, getKeeperBiasLabel } = await import(
  join(ROOT, 'src/data/keeperTendencies.js')
)
const { FORMATION_COUNTERS, FORMATION_TACTICS } = await import(
  join(ROOT, 'src/data/formationTactics.js')
)
const { calculateLineupRatings } = await import(
  join(ROOT, 'src/utils/lineupBalance.js')
)
const { getOpponentMatchSetup } = await import(
  join(ROOT, 'src/utils/opponentTactics.js')
)
const { computeMatchIntel } = await import(
  join(ROOT, 'src/utils/scoutIntel.js')
)

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
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

// ─── 测试 1: 点球扑点习惯有效性 ──────────────────────────────────────────────
function testPenaltyTendency() {
  console.log('\n═══ 测试 1: 门将扑点习惯 — 针对弱点射门 vs 盲射 ═══')
  console.log(`每队模拟 ${ROUNDS} 次点球\n`)

  const teams = [
    'france', 'brazil', 'argentina', 'portugal', 'germany', 'japan',
    'norway', 'morocco', 'colombia', 'curacao', 'spain', 'england',
    'usa', 'mexico', 'canada', 'capeverde',
    'netherlands', 'belgium', 'croatia', 'uruguay', 'senegal', 'iraq',
  ]

  let totalSmartScored = 0
  let totalBlindScored = 0
  let totalKicks = 0

  for (const teamId of teams) {
    const tendency = getKeeperTendency(teamId)
    const biasCol = tendency.bias // 门将偏好方向

    // 计算最佳射门方向（门将弱侧）
    const smartColumns = ['left', 'center', 'right'].filter(c => c !== biasCol)

    let smartScored = 0
    let blindScored = 0

    for (let i = 0; i < ROUNDS; i++) {
      const rng = mulberry32(i * 7919 + teamId.length * 104729)

      // 智能射门：朝门将弱侧
      const smartCol = smartColumns[i % smartColumns.length]
      const smartRow = rng() < 0.5 ? 'top' : 'bottom'
      const smartZone = `${smartCol}-${smartRow}`
      const keeperZoneSmart = pickAiKeeperZone(75, rng, tendency)
      const smartResult = resolveShootoutAttempt({
        shooterZone: smartZone,
        keeperZone: keeperZoneSmart,
        shooterTec: 78,
        keeperDef: 75,
        random: rng,
      })
      if (smartResult.scored) smartScored++

      // 盲射：随机方向（包含门将强侧）
      const rng2 = mulberry32(i * 6271 + teamId.length * 31337)
      const blindZone = PENALTY_ZONES[Math.floor(rng2() * 6)]
      const keeperZoneBlind = pickAiKeeperZone(75, rng2, tendency)
      const blindResult = resolveShootoutAttempt({
        shooterZone: blindZone,
        keeperZone: keeperZoneBlind,
        shooterTec: 78,
        keeperDef: 75,
        random: rng2,
      })
      if (blindResult.scored) blindScored++
    }

    totalSmartScored += smartScored
    totalBlindScored += blindScored
    totalKicks += ROUNDS

    const smartRate = (smartScored / ROUNDS * 100).toFixed(1)
    const blindRate = (blindScored / ROUNDS * 100).toFixed(1)
    const diff = (smartScored - blindScored) / ROUNDS * 100
    console.log(
      `  ${teamId.padEnd(14)} 扑${getKeeperBiasLabel(biasCol)}(${(tendency.strength * 100).toFixed(0)}%) ` +
      `| 针对: ${smartRate}% | 盲射: ${blindRate}% | 差值: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`
    )
  }

  const overallSmart = (totalSmartScored / totalKicks * 100).toFixed(1)
  const overallBlind = (totalBlindScored / totalKicks * 100).toFixed(1)
  const overallDiff = ((totalSmartScored - totalBlindScored) / totalKicks * 100).toFixed(1)
  console.log(`\n  ▶ 总计: 针对射门 ${overallSmart}% vs 盲射 ${overallBlind}% | 提升 +${overallDiff}%`)
  console.log(`  ▶ 结论: ${Number(overallDiff) > 0 ? '✓ 情报有效，针对弱点射门显著提高得分率' : '✗ 无效'}`)
  return Number(overallDiff) > 0
}

// ─── 测试 2: 阵型克制有效性 ──────────────────────────────────────────────────
function generateLineup(formation, baseRating, seed) {
  const counts = FORMATION_TACTICS[formation]?.counts || { GK: 1, DF: 4, MF: 3, FW: 3 }
  const rng = mulberry32(seed)
  const lineup = []
  let idx = 0
  for (const [pos, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      const rating = Math.round(baseRating + (rng() - 0.5) * 12)
      lineup.push({
        id: `sim-${seed}-${idx}`,
        position: pos,
        assignedPosition: pos,
        pos: pos,
        rating,
        spd: Math.round(rating + (rng() - 0.5) * 10),
        phy: Math.round(rating + (rng() - 0.5) * 10),
        tec: Math.round(rating + (rng() - 0.5) * 10),
        def: pos === 'GK' ? rating + 8 : pos === 'DF' ? rating + 5 : Math.round(rating - 5),
        sta: Math.round(rating + (rng() - 0.5) * 8),
        form: 80,
      })
      idx++
    }
  }
  return lineup
}

function simulateMatchOutcome(myRatings, oppRatings, rng) {
  // 基于三维评分的胜率模型
  const myAttack = myRatings.attack
  const myMidfield = myRatings.midfield
  const myDefense = myRatings.defense
  const oppAttack = oppRatings.attack
  const oppMidfield = oppRatings.midfield
  const oppDefense = oppRatings.defense

  // 进攻 vs 对手防守，中场争夺加权
  const myGoalPotential = myAttack * 0.6 + myMidfield * 0.4
  const oppGoalPotential = oppAttack * 0.6 + oppMidfield * 0.4
  const mySuppress = myDefense * 0.5 + myMidfield * 0.5
  const oppSuppress = oppDefense * 0.5 + oppMidfield * 0.5

  const myExpected = Math.max(0.3, (myGoalPotential / oppSuppress) * 1.4)
  const oppExpected = Math.max(0.3, (oppGoalPotential / mySuppress) * 1.4)

  // 泊松近似
  const myGoals = poissonSample(myExpected, rng)
  const oppGoals = poissonSample(oppExpected, rng)

  if (myGoals > oppGoals) return 'win'
  if (myGoals < oppGoals) return 'loss'
  return 'draw'
}

function poissonSample(lambda, rng) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > L)
  return k - 1
}

function testFormationCounter() {
  console.log('\n═══ 测试 2: 阵型克制建议 — 使用克制阵型 vs 使用被克制阵型 ═══')
  console.log(`每组模拟 ${ROUNDS} 场比赛\n`)

  let totalCounterWins = 0
  let totalCounterDraws = 0
  let totalBadWins = 0
  let totalBadDraws = 0
  let totalMatches = 0

  const formations = Object.keys(FORMATION_COUNTERS)

  for (const oppFormation of formations) {
    const counter = FORMATION_COUNTERS[oppFormation]
    const recommendedFormation = counter.weakTo
    // 选一个不克制对手的阵型作为对照
    const neutralFormations = formations.filter(
      f => f !== recommendedFormation && FORMATION_COUNTERS[f]?.weakTo !== oppFormation
    )
    const badFormation = neutralFormations[0] || '4-4-2'

    let counterWins = 0, counterDraws = 0
    let badWins = 0, badDraws = 0

    for (let i = 0; i < ROUNDS; i++) {
      const seed = i * 4217 + oppFormation.length * 7901
      const oppLineup = generateLineup(oppFormation, 75, seed)
      const oppRatings = calculateLineupRatings(oppLineup, oppFormation)

      // 使用克制阵型
      const counterLineup = generateLineup(recommendedFormation, 75, seed + 1000)
      const counterRatings = calculateLineupRatings(counterLineup, recommendedFormation)
      const rng1 = mulberry32(seed + 2000)
      const counterResult = simulateMatchOutcome(counterRatings, oppRatings, rng1)
      if (counterResult === 'win') counterWins++
      if (counterResult === 'draw') counterDraws++

      // 使用非克制阵型
      const badLineup = generateLineup(badFormation, 75, seed + 3000)
      const badRatings = calculateLineupRatings(badLineup, badFormation)
      const rng2 = mulberry32(seed + 4000)
      const badResult = simulateMatchOutcome(badRatings, oppRatings, rng2)
      if (badResult === 'win') badWins++
      if (badResult === 'draw') badDraws++
    }

    totalCounterWins += counterWins
    totalCounterDraws += counterDraws
    totalBadWins += badWins
    totalBadDraws += badDraws
    totalMatches += ROUNDS

    const counterWinRate = (counterWins / ROUNDS * 100).toFixed(1)
    const badWinRate = (badWins / ROUNDS * 100).toFixed(1)
    const diff = ((counterWins - badWins) / ROUNDS * 100).toFixed(1)
    console.log(
      `  对手${oppFormation.padEnd(7)} → 推荐${recommendedFormation.padEnd(7)} ` +
      `| 克制胜率: ${counterWinRate}% | 对照(${badFormation}): ${badWinRate}% | 差值: ${Number(diff) > 0 ? '+' : ''}${diff}%`
    )
  }

  const overallCounter = (totalCounterWins / totalMatches * 100).toFixed(1)
  const overallBad = (totalBadWins / totalMatches * 100).toFixed(1)
  const diff = ((totalCounterWins - totalBadWins) / totalMatches * 100).toFixed(1)
  console.log(`\n  ▶ 总计: 克制阵型胜率 ${overallCounter}% vs 非克制 ${overallBad}% | 提升 +${diff}%`)
  console.log(`  ▶ 结论: ${Number(diff) > 0 ? '✓ 阵型克制建议有效' : '✗ 无效'}`)
  return Number(diff) > 0
}

// ─── 测试 3: 弱点分析有效性 ──────────────────────────────────────────────────
function testWeaknessExploitation() {
  console.log('\n═══ 测试 3: 弱点分析 — 针对弱点调整 vs 不调整 ═══')
  console.log(`模拟 ${ROUNDS} 场，对比利用弱点信息选阵 vs 固定阵型\n`)

  const opponents = ['塞内加尔', '伊拉克', '荷兰', '比利时', '突尼斯', '巴拉圭', '澳大利亚', '克罗地亚']
  let smartWins = 0, smartDraws = 0
  let fixedWins = 0, fixedDraws = 0
  let total = 0

  for (const oppName of opponents) {
    let opponentSmartWins = 0
    let opponentFixedWins = 0
    const oppSetup = getOpponentMatchSetup(oppName, null, 'medium')
    const oppRatings = calculateLineupRatings(oppSetup.lineup, oppSetup.formation)

    // 获取情报建议
    const intel = computeMatchIntel({
      opponentSetup: oppSetup,
      opponentTeam: null,
      opponentTeamId: oppName,
      opponentStrength: 'medium',
      playerLineup: generateLineup('4-3-3', 75, 42),
      playerFormation: '4-3-3',
      intelLevel: 3,
      scoutLevel: 3,
    })

    const recommended = intel?.intel?.tacticalAdvice?.recommendedFormation || '4-3-3'

    for (let i = 0; i < ROUNDS; i++) {
      const seed = i * 3571 + oppName.length * 6271

      // 智能：使用情报推荐阵型
      const smartLineup = generateLineup(recommended, 75, seed)
      const smartRatings = calculateLineupRatings(smartLineup, recommended)
      const rng1 = mulberry32(seed + 5000)
      const smartResult = simulateMatchOutcome(smartRatings, oppRatings, rng1)
      if (smartResult === 'win') smartWins++
      if (smartResult === 'win') opponentSmartWins++
      if (smartResult === 'draw') smartDraws++

      // 固定：始终用 4-4-2（不参考情报）
      const fixedLineup = generateLineup('4-4-2', 75, seed + 8000)
      const fixedRatings = calculateLineupRatings(fixedLineup, '4-4-2')
      const rng2 = mulberry32(seed + 9000)
      const fixedResult = simulateMatchOutcome(fixedRatings, oppRatings, rng2)
      if (fixedResult === 'win') fixedWins++
      if (fixedResult === 'win') opponentFixedWins++
      if (fixedResult === 'draw') fixedDraws++

      total++
    }

    const sRate = (opponentSmartWins / ROUNDS * 100).toFixed(1)
    const fRate = (opponentFixedWins / ROUNDS * 100).toFixed(1)
    console.log(
      `  vs ${oppName.padEnd(6)}(${oppSetup.formation}) 推荐→${recommended.padEnd(7)} ` +
      `| 情报: ${sRate}% | 固定4-4-2: ${fRate}% | +${((opponentSmartWins - opponentFixedWins) / ROUNDS * 100).toFixed(1)}%`
    )
  }

  const sTotal = (smartWins / total * 100).toFixed(1)
  const fTotal = (fixedWins / total * 100).toFixed(1)
  const diff = ((smartWins - fixedWins) / total * 100).toFixed(1)
  console.log(`\n  ▶ 总计: 情报选阵胜率 ${sTotal}% vs 固定阵型 ${fTotal}% | 提升 +${diff}%`)
  console.log(`  ▶ 结论: ${Number(diff) > 0 ? '✓ 弱点分析+战术建议有效' : '✗ 无效'}`)
  return Number(diff) > 0
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────
console.log(`\n╔══════════════════════════════════════════════════╗`)
console.log(`║   情报系统有效性验证 — ${ROUNDS} 轮 Monte Carlo      ║`)
console.log(`╚══════════════════════════════════════════════════╝`)

const r1 = testPenaltyTendency()
const r2 = testFormationCounter()
const r3 = testWeaknessExploitation()

console.log('\n═══════════════════════════════════════════════════')
console.log('  最终结论:')
console.log(`    1. 门将扑点习惯情报: ${r1 ? '✓ 有效' : '✗ 无效'}`)
console.log(`    2. 阵型克制建议:     ${r2 ? '✓ 有效' : '✗ 无效'}`)
console.log(`    3. 弱点分析+选阵:    ${r3 ? '✓ 有效' : '✗ 无效'}`)
console.log(`    总评: ${r1 && r2 && r3 ? '✓ 全部通过，情报系统确实提高胜率' : '⚠ 部分未通过，需调整'}`)
console.log('═══════════════════════════════════════════════════\n')

process.exit(r1 && r2 && r3 ? 0 : 1)
