#!/usr/bin/env node
/**
 * 剑指美加墨 — 全链路算法平衡 Monte Carlo 仿真
 *
 * 覆盖：10 支球队全对阵 + 世界杯赛制锦标赛。
 * 测量：场均进球/角球/点球/黄牌/红牌、场均决策数、决策进球占比、
 *       强弱/强强胜率、冠军分布、用户选择质量对结果的影响。
 *
 * 用法：
 *   node scripts/full-balance-sim.mjs --runs 2000
 *   node scripts/full-balance-sim.mjs --runs 2000 --seed 7 --json
 */

import { DECISION_LIBRARY } from '../src/data/decisionLibrary.js'
import { teams as TEAMS } from '../src/data/teams.js'
import {
  executeDecision,
  resolveChoiceResult,
  resolveMatchPenaltyChoice,
} from '../src/utils/decisionSystem.js'

// ─── 可调参数（校准目标见文件尾部输出） ─────────────────────────────────────
const P = {
  nativeBaseGoals: 0.8,       // 原生（模拟对战）场均进球基准/队
  strengthK: 0.5,             // 攻防差对进球期望的指数系数（公式内除以 10）
  gkSaveBase: 0.0,            // 门将强度对进球期望的额外抑制
  decisionsBase: 5,           // 每场保底决策窗口数
  decisionExtraP: 0.4,        // 额外自然决策概率（4 次二项试验）
  attackScenarioShare: 0.72,  // 进攻类场景占比
  defenseScenarioShare: 0.24, // 防守类场景占比
  nativeCorners: 0.75,        // 原生场均角球/队
  nativePenaltyP: 0.12,       // 原生场均点球概率/队
  nativeYellow: 1.45,         // 原生场均黄牌/队
  nativeRedP: 0.08,           // 原生场均红牌概率/队
  stanceAttackMult: 1.15,     // 压上：进攻倍率
  stanceAttackDefMult: 0.90,  // 压上：防守倍率
  stanceDefendMult: 1.12,     // 落位：防守倍率
  stanceDefendAtkMult: 0.92,  // 落位：进攻倍率
  subBoost: 1.03,             // 换人后下半程进攻恢复
  noSubFade: 0.94,            // 不换人下半程进攻衰减
  wrongLineupMult: 0.85,      // 错误阵容战力倍率
}

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}
const RUNS = parseInt(getArg('runs', '2000'), 10)
const SEED = parseInt(getArg('seed', '42'), 10)
const AS_JSON = args.includes('--json')

// 可复现随机数
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let rand = mulberry32(SEED)
const random = () => rand()
// decisionSystem 内部用 Math.random，仿真期替换
const realRandom = Math.random
Math.random = random
process.on('exit', () => { Math.random = realRandom })

function poisson(lambda) {
  const l = Math.exp(-lambda)
  let k = 0, p = 1
  do { k += 1; p *= random() } while (p > l)
  return k - 1
}
const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// ─── 球队强度 ────────────────────────────────────────────────────────────────
function bestLineup(players) {
  const gk = [...players].filter((p) => p.position === 'GK').sort((a, b) => b.def - a.def)[0]
  const outfield = [...players].filter((p) => p.position !== 'GK').sort((a, b) => b.rating - a.rating)
  const picked = []
  const need = { DF: 4, MF: 4, FW: 2 }
  for (const player of outfield) {
    if (need[player.position] > 0 && picked.length < 10) {
      need[player.position] -= 1
      picked.push(player)
    }
  }
  for (const player of outfield) {
    if (picked.length >= 10) break
    if (!picked.includes(player)) picked.push(player)
  }
  return gk ? [gk, ...picked] : picked
}

const teamModels = {}
for (const team of TEAMS) {
  const lineup = bestLineup(team.players)
  const outfield = lineup.filter((p) => p.position !== 'GK')
  teamModels[team.id] = {
    id: team.id,
    name: team.name,
    lineup,
    tacticalEfficiency: Number(team.tacticalEfficiency) || 1,
    attack: mean(outfield.map((p) => p.tec)) * (Number(team.tacticalEfficiency) || 1),
    defense: (mean(outfield.map((p) => p.def)) * 0.7 + (lineup[0]?.def || 70) * 0.3)
      * (Number(team.tacticalEfficiency) || 1),
    rating: mean(lineup.map((p) => p.rating)),
    avgStar: mean(lineup.map((p) => p.star || 3)),
  }
}
const sortedByRating = Object.values(teamModels).sort((a, b) => b.rating - a.rating)
const tierOf = (id) => {
  const index = sortedByRating.findIndex((t) => t.id === id)
  return index < 3 ? 'top' : index < 7 ? 'mid' : 'bottom'
}

// ─── 决策场景分类 ────────────────────────────────────────────────────────────
const ATTACK_SCENARIOS = new Set([
  'solo_run_penalty', 'penalty_area_cross', 'counter_attack_3v2', 'freekick_dangerous',
  'penalty_kick', 'long_shot_opportunity', 'header_corner', 'through_ball_chance',
  'indirect_freekick_box', 'match_penalty', 'throwin_attack', 'box_second_ball_chaos',
  'penalty_shootout_round', 'wing_overlap_cross', 'central_cutback_press',
  'half_space_through_run', 'low_block_counter_launch', 'midfield_switch_play',
  'second_ball_corner_attack', 'set_piece_rebound_shot', 'penalty_rebound_followup',
  'late_keeper_up_corner', 'penalty_area_dive', 'midfield_second_ball', 'handball_penalty_claim',
])
const DEFENSE_SCENARIOS = new Set([
  'penalty_area_foul_risk', 'gk_one_on_one', 'last_defender_tackle', 'midfield_press_trigger',
  'tactical_foul_counter', 'aerial_duel_corner_defending', 'offside_trap', 'defender_last_ditch',
  'defend_dangerous_freekick', 'box_scramble_clearance', 'high_press_trap',
  'fullback_recovery_run', 'keeper_sweeper_claim', 'opponent_dangerous_freekick_wall',
  'opponent_short_corner_defense', 'second_yellow_warning', 'weather_slippery_tackle',
])
const attackScenarios = DECISION_LIBRARY.filter((s) => ATTACK_SCENARIOS.has(s.id))
const defenseScenarios = DECISION_LIBRARY.filter((s) => DEFENSE_SCENARIOS.has(s.id))
const otherScenarios = DECISION_LIBRARY.filter((s) => !ATTACK_SCENARIOS.has(s.id) && !DEFENSE_SCENARIOS.has(s.id))

const SHOT_OUTCOME = /goal|saved|miss|shot|header|freekick|volley|blocked|post|wide|over|placement|power|panenka|chip/

function pickScenario() {
  const roll = random()
  if (roll < P.attackScenarioShare) return attackScenarios[Math.floor(random() * attackScenarios.length)]
  if (roll < P.attackScenarioShare + P.defenseScenarioShare) return defenseScenarios[Math.floor(random() * defenseScenarios.length)]
  return otherScenarios[Math.floor(random() * otherScenarios.length)]
}

function gameStateFor(red, blue, minute, score) {
  return {
    minute,
    team: red.id,
    opponentName: blue.name,
    oppDefense: Math.round(blue.defense),
    teamAvgRating: Math.round(red.rating),
    teamDifficulty: 3,
    myScore: score.red,
    oppScore: score.blue,
    scoreDiff: score.red - score.blue,
    myAttack: Math.round(red.attack),
    myDefense: Math.round(red.defense),
    isKnockout: false,
    isExtraTime: false,
  }
}

// 用户策略：optimal 选成功率最高，balanced 按概率加权，worst 选最低
function pickChoice(choices, strategy) {
  if (strategy === 'optimal') return [...choices].sort((a, b) => b.successProb - a.successProb)[0]
  if (strategy === 'worst') return [...choices].sort((a, b) => a.successProb - b.successProb)[0]
  const total = choices.reduce((s, c) => s + Math.max(0.05, c.successProb), 0)
  let roll = random() * total
  for (const choice of choices) {
    roll -= Math.max(0.05, choice.successProb)
    if (roll <= 0) return choice
  }
  return choices[0]
}

function runDecision({ scenario, red, blue, minute, score, strategy }) {
  const state = gameStateFor(red, blue, minute, score)
  const decision = executeDecision(scenario, red.lineup, state)
  const choice = pickChoice(decision.choices, strategy)
  const keyPlayer = decision.keyPlayers?.default
  const result = scenario.id === 'match_penalty'
    ? resolveMatchPenaltyChoice(choice, keyPlayer, state)
    : resolveChoiceResult(choice, keyPlayer, state)
  // 复刻 decisionAuthorityDeltas 的统计口径
  const stats = { shots: 0, shotsOnTarget: 0, goals: 0, corners: 0, penalties: 0, yellowCards: 0, redCards: 0, fouls: 0 }
  const opp = { shots: 0, shotsOnTarget: 0, goals: 0, corners: 0, penalties: 0, yellowCards: 0, redCards: 0, fouls: 0 }
  const outcome = String(result.outcome || '')
  const scenarioId = scenario.id
  const isShot = SHOT_OUTCOME.test(outcome)
  if (/^(header_corner|second_ball_corner_attack|late_keeper_up_corner)$/.test(scenarioId)) stats.corners = 1
  if (/^(aerial_duel_corner_defending|opponent_short_corner_defense)$/.test(scenarioId)) opp.corners = 1
  if (/yellow/.test(outcome)) stats.yellowCards = 1
  if (/red_card/.test(outcome)) stats.redCards = 1
  if (/foul|yellow|red_card/.test(outcome)) stats.fouls = 1
  if (/^(match_penalty|penalty_kick)$/.test(scenarioId)) stats.penalties = 1
  if (scenarioId === 'penalty_area_foul_risk') {
    if (/yellow_card_penalty/.test(outcome)) { stats.fouls = 1; stats.yellowCards = 1; opp.penalties = 1 }
    if (/red_card_penalty/.test(outcome)) { stats.fouls = 1; stats.redCards = 1; opp.penalties = 1 }
    if (/freekick_against/.test(outcome)) stats.fouls = 1
  }
  if (isShot && !(result.awayScoreChange > 0)) {
    stats.shots = 1
    if ((result.homeScoreChange > 0) || /saved/.test(outcome)) stats.shotsOnTarget = 1
  }
  if (result.homeScoreChange > 0) stats.goals = 1
  if (result.awayScoreChange > 0) {
    opp.shots = 1; opp.shotsOnTarget = 1; opp.goals = 1
  }
  return { stats, opp, result, choice, scenario }
}

// ─── 单场仿真 ────────────────────────────────────────────────────────────────
function simMatch(redId, blueId, options = {}) {
  const red = { ...teamModels[redId] }
  const blue = { ...teamModels[blueId] }
  const strategy = options.strategy || 'balanced'
  const stance = options.stance || 'balanced'
  const subs = options.subs !== false
  const wrongLineup = options.wrongLineup || false

  let redAtk = red.attack, redDef = red.defense
  let blueAtk = blue.attack, blueDef = blue.defense
  if (wrongLineup === 'red') { redAtk *= P.wrongLineupMult; redDef *= P.wrongLineupMult }
  if (stance === 'attack') { redAtk *= P.stanceAttackMult; redDef *= P.stanceAttackDefMult }
  if (stance === 'defend') { redAtk *= P.stanceDefendAtkMult; redDef *= P.stanceDefendMult }
  if (subs) { redAtk *= P.subBoost } else { redAtk *= P.noSubFade }

  const score = { red: 0, blue: 0 }
  const total = {
    decisions: 0, decisionGoals: 0, decisionShots: 0, decisionShotsOnTarget: 0,
    corners: 0, penalties: 0, yellowCards: 0, redCards: 0, fouls: 0,
    oppCorners: 0, oppPenalties: 0, oppYellowCards: 0, oppRedCards: 0, oppGoals: 0,
    choiceSuccess: [],
  }

  // 原生进球（模拟对战层）
  const lambdaRed = P.nativeBaseGoals * clamp(0.3, 3.0, Math.exp((redAtk - blueDef) * P.strengthK / 10))
  const lambdaBlue = P.nativeBaseGoals * clamp(0.3, 3.0, Math.exp((blueAtk - redDef) * P.strengthK / 10))
  score.red += poisson(lambdaRed)
  score.blue += poisson(lambdaBlue)

  // 原生其它事件
  total.corners += poisson(P.nativeCorners)
  total.oppCorners += poisson(P.nativeCorners)
  if (random() < P.nativePenaltyP) total.penalties += 1
  if (random() < P.nativePenaltyP) total.oppPenalties += 1
  total.yellowCards += poisson(P.nativeYellow)
  total.oppYellowCards += poisson(P.nativeYellow)
  if (random() < P.nativeRedP) total.redCards += 1
  if (random() < P.nativeRedP) total.oppRedCards += 1

  // 决策层（用户模式：仅红队决策；中立模式：双方各决策一次，用于 AI 对阵）
  const minutes = [12, 26, 41, 57, 72, 83, 88]
  const runDecisionPhase = (attacking, defending, attackingSide) => {
    const decisionCount = P.decisionsBase + [0, 0, 0, 0].filter(() => random() < P.decisionExtraP).length
    for (let index = 0; index < decisionCount; index += 1) {
      const scenario = pickScenario()
      const minute = minutes[index] || 88
      const phaseScore = attackingSide === 'red'
        ? score
        : { red: score.blue, blue: score.red }
      const { stats, opp, result, choice } = runDecision({
        scenario, red: attacking, blue: defending, minute, score: phaseScore, strategy,
      })
      total.decisions += attackingSide === 'red' ? 1 : 0
      total.choiceSuccess.push(choice.successProb)
      const atkGoal = result.homeScoreChange
      const defGoal = result.awayScoreChange
      if (attackingSide === 'red') {
        score.red += atkGoal
        score.blue += defGoal
        total.decisionGoals += atkGoal
        total.oppGoals += defGoal
      } else {
        score.blue += atkGoal
        score.red += defGoal
        total.oppGoals += atkGoal
        total.decisionGoals += defGoal
      }
      const atkBucket = attackingSide === 'red' ? total : total
      const defBucket = attackingSide === 'red' ? total : total
      for (const key of Object.keys(stats)) {
        if (key === 'goals') continue
        const mapped = attackingSide === 'red' ? key : `opp${key[0].toUpperCase()}${key.slice(1)}`
        atkBucket[mapped] = (atkBucket[mapped] || 0) + stats[key]
      }
      for (const key of Object.keys(opp)) {
        if (key === 'goals') continue
        const mapped = attackingSide === 'red' ? `opp${key[0].toUpperCase()}${key.slice(1)}` : key
        defBucket[mapped] = (defBucket[mapped] || 0) + opp[key]
      }
      if (attackingSide === 'red') {
        total.decisionShots += stats.shots
        total.decisionShotsOnTarget += stats.shotsOnTarget
      }
    }
  }
  runDecisionPhase(teamModels[redId], teamModels[blueId], 'red')
  if (options.neutral) runDecisionPhase(teamModels[blueId], teamModels[redId], 'blue')
  return { score, total }
}

// ─── 聚合与输出 ──────────────────────────────────────────────────────────────
function summarize(matches) {
  const goals = matches.map((m) => m.score.red + m.score.blue)
  const decisions = matches.map((m) => m.total.decisions)
  const decisionGoals = matches.map((m) => m.total.decisionGoals + m.total.oppGoals)
  const corners = matches.map((m) => m.total.corners + m.total.oppCorners)
  const penalties = matches.map((m) => m.total.penalties + m.total.oppPenalties)
  const yellow = matches.map((m) => m.total.yellowCards + m.total.oppYellowCards)
  const red = matches.map((m) => m.total.redCards + m.total.oppRedCards)
  const std = (values) => {
    const m = mean(values)
    return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
  }
  return {
    matches: matches.length,
    goalsPerMatch: mean(goals), goalsStd: std(goals),
    decisionsPerMatch: mean(decisions),
    decisionGoalsPerMatch: mean(decisionGoals),
    decisionGoalShare: mean(decisionGoals) / Math.max(0.001, mean(goals)),
    cornersPerMatch: mean(corners),
    penaltiesPerMatch: mean(penalties),
    yellowPerMatch: mean(yellow),
    redPerMatch: mean(red),
  }
}

const allMatches = []
const matchupRecords = {}
for (const redId of Object.keys(teamModels)) {
  for (const blueId of Object.keys(teamModels)) {
    if (redId === blueId) continue
    const records = []
    for (let run = 0; run < RUNS; run += 1) {
      const match = simMatch(redId, blueId, { strategy: 'balanced' })
      records.push(match)
      allMatches.push(match)
    }
    const wins = records.filter((m) => m.score.red > m.score.blue).length
    const draws = records.filter((m) => m.score.red === m.score.blue).length
    matchupRecords[`${redId} vs ${blueId}`] = {
      win: wins / RUNS, draw: draws / RUNS, loss: 1 - (wins + draws) / RUNS,
      goals: mean(records.map((m) => m.score.red + m.score.blue)),
    }
  }
}

// 分层胜率
const tiers = [['top', 'bottom'], ['top', 'mid'], ['top', 'top'], ['bottom', 'bottom'], ['mid', 'bottom']]
const tierSummary = {}
for (const [a, b] of tiers) {
  const key = `${a} vs ${b}`
  const bucket = Object.entries(matchupRecords)
    .filter(([pair]) => tierOf(pair.split(' vs ')[0]) === a && tierOf(pair.split(' vs ')[1]) === b)
  tierSummary[key] = {
    win: mean(bucket.map(([, r]) => r.win)),
    draw: mean(bucket.map(([, r]) => r.draw)),
    loss: mean(bucket.map(([, r]) => r.loss)),
  }
}

// 锦标赛（世界杯赛制：两组各 5 队单循环，前二进四强）
// coachedId 作为玩家执教队参与全部其比赛（用户模式决策），其余比赛为中立模式。
// 淘汰赛点球大战按实力加权（ELO），不再 50/50。
function shootoutWinProb(x, y) {
  const diff = teamModels[x].rating - teamModels[y].rating
  return clamp(0.3, 0.7, 1 / (1 + Math.pow(10, -diff / 12)))
}
function simTournament(coachedId = null) {
  const ids = Object.keys(teamModels)
  const groupA = ids.slice(0, 5)
  const groupB = ids.slice(5, 10)
  const playPairing = (x, y) => {
    if (x === coachedId) return simMatch(x, y, { strategy: 'balanced' })
    if (y === coachedId) {
      const swapped = simMatch(y, x, { strategy: 'balanced' })
      return { score: { red: swapped.score.blue, blue: swapped.score.red }, total: swapped.total }
    }
    return simMatch(x, y, { strategy: 'balanced', neutral: true })
  }
  const playGroup = (group) => {
    const table = Object.fromEntries(group.map((id) => [id, { pts: 0, gd: 0 }]))
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const match = playPairing(group[i], group[j])
        table[group[i]].gd += match.score.red - match.score.blue
        table[group[j]].gd += match.score.blue - match.score.red
        if (match.score.red > match.score.blue) table[group[i]].pts += 3
        else if (match.score.red < match.score.blue) table[group[j]].pts += 3
        else { table[group[i]].pts += 1; table[group[j]].pts += 1 }
      }
    }
    return Object.entries(table).sort((a, b) => b[1].pts - a[1].pts || b[1].gd - a[1].gd).map(([id]) => id)
  }
  const [a1, a2] = playGroup(groupA)
  const [b1, b2] = playGroup(groupB)
  const knockout = (x, y) => {
    const match = playPairing(x, y)
    if (match.score.red !== match.score.blue) return match.score.red > match.score.blue ? x : y
    return random() < shootoutWinProb(x, y) ? x : y
  }
  const final = [knockout(a1, b2), knockout(b1, a2)]
  return knockout(final[0], final[1])
}
const coachedChampionships = {}
const TOURNAMENTS_PER_TEAM = Math.max(300, Math.floor(RUNS / 4))
for (const coachedId of Object.keys(teamModels)) {
  let wins = 0
  for (let t = 0; t < TOURNAMENTS_PER_TEAM; t += 1) {
    if (simTournament(coachedId) === coachedId) wins += 1
  }
  coachedChampionships[coachedId] = wins / TOURNAMENTS_PER_TEAM
}

// 用户影响力对照（法国 vs 巴西：最优 vs 随机 vs 最差选择；战术；换人；阵容）
function influenceRuns(simOptions) {
  const records = []
  for (let run = 0; run < RUNS; run += 1) records.push(simMatch('france', 'brazil', simOptions))
  return {
    win: records.filter((m) => m.score.red > m.score.blue).length / RUNS,
    goalsFor: mean(records.map((m) => m.score.red)),
    decisionGoals: mean(records.map((m) => m.total.decisionGoals)),
  }
}
const influence = {
  optimalChoices: influenceRuns({ strategy: 'optimal' }),
  balancedChoices: influenceRuns({ strategy: 'balanced' }),
  worstChoices: influenceRuns({ strategy: 'worst' }),
  attackStance: influenceRuns({ strategy: 'balanced', stance: 'attack' }),
  defendStance: influenceRuns({ strategy: 'balanced', stance: 'defend' }),
  noSubs: influenceRuns({ strategy: 'balanced', subs: false }),
  wrongLineup: influenceRuns({ strategy: 'balanced', wrongLineup: 'red' }),
}

const report = {
  config: { runsPerPairing: RUNS, tournamentsPerTeam: TOURNAMENTS_PER_TEAM, seed: SEED, params: P },
  overall: summarize(allMatches),
  tierSummary,
  coachedChampionships: Object.fromEntries(
    Object.entries(coachedChampionships)
      .sort((a, b) => b[1] - a[1])
      .map(([id, pct]) => [id, { pct, tier: tierOf(id) }]),
  ),
  influence,
  teamRatings: Object.fromEntries(sortedByRating.map((t) => [t.id, { rating: Number(t.rating.toFixed(1)), attack: Number(t.attack.toFixed(1)), defense: Number(t.defense.toFixed(1)), tier: tierOf(t.id) }])),
}

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const pct = (v) => `${(v * 100).toFixed(1)}%`
  const num = (v) => v.toFixed(2)
  console.log('═'.repeat(68))
  console.log(`全链路平衡仿真 · 每对阵 ${RUNS} 场 × 90 对阵 = ${allMatches.length} 场 · 每队执教 ${TOURNAMENTS_PER_TEAM} 届锦标赛`)
  console.log('═'.repeat(68))
  console.log(`场均进球        ${num(report.overall.goalsPerMatch)} ± ${num(report.overall.goalsStd)}   (目标 ~3.0)`)
  console.log(`场均角球        ${num(report.overall.cornersPerMatch)}          (目标 ~2.0)`)
  console.log(`场均点球        ${num(report.overall.penaltiesPerMatch)}          (目标 ~0.5)`)
  console.log(`场均黄牌        ${num(report.overall.yellowPerMatch)}          (目标 ~3.0)`)
  console.log(`场均红牌        ${num(report.overall.redPerMatch)}          (目标 ~0.2)`)
  console.log(`场均决策        ${num(report.overall.decisionsPerMatch)}          (目标 ≥5.0)`)
  console.log(`决策进球/场     ${num(report.overall.decisionGoalsPerMatch)} · 占总进球 ${pct(report.overall.decisionGoalShare)} (目标 25-35%)`)
  console.log('─'.repeat(68))
  console.log('分层胜率 (胜/平/负):')
  for (const [key, value] of Object.entries(tierSummary)) {
    console.log(`  ${key.padEnd(16)} ${pct(value.win)} / ${pct(value.draw)} / ${pct(value.loss)}`)
  }
  console.log('─'.repeat(68))
  console.log('执教夺冠概率（该队作为玩家执教队）:')
  for (const [id, value] of Object.entries(report.coachedChampionships)) {
    console.log(`  ${teamModels[id].name.padEnd(6)} ${pct(value.pct).padStart(7)}  (${value.tier})`)
  }
  console.log('─'.repeat(68))
  console.log('用户影响力 (法国 vs 巴西):')
  console.log(`  最优选择   胜率 ${pct(influence.optimalChoices.win)} · 场均进 ${num(influence.optimalChoices.goalsFor)} · 决策进 ${num(influence.optimalChoices.decisionGoals)}`)
  console.log(`  随机选择   胜率 ${pct(influence.balancedChoices.win)} · 场均进 ${num(influence.balancedChoices.goalsFor)} · 决策进 ${num(influence.balancedChoices.decisionGoals)}`)
  console.log(`  最差选择   胜率 ${pct(influence.worstChoices.win)} · 场均进 ${num(influence.worstChoices.goalsFor)} · 决策进 ${num(influence.worstChoices.decisionGoals)}`)
  console.log(`  压上战术   胜率 ${pct(influence.attackStance.win)} · 场均进 ${num(influence.attackStance.goalsFor)}`)
  console.log(`  落位防守   胜率 ${pct(influence.defendStance.win)} · 场均进 ${num(influence.defendStance.goalsFor)}`)
  console.log(`  不换人     胜率 ${pct(influence.noSubs.win)} · 场均进 ${num(influence.noSubs.goalsFor)}`)
  console.log(`  错误阵容   胜率 ${pct(influence.wrongLineup.win)} · 场均进 ${num(influence.wrongLineup.goalsFor)}`)
}
