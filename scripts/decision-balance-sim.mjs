#!/usr/bin/env node

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

import { allPlayers } from '../src/data/players/index.js'
import { prepareTeamPlayers } from '../src/data/playerBalance.js'
import { DECISION_LIBRARY } from '../src/data/decisionLibrary.js'
import {
  executeDecision,
  outcomeConcedesPenalty,
  outcomeWinsPenalty,
  resolveChoiceResult,
  resolveDiveChoice,
  resolveMatchPenaltyChoice,
  resolveOpponentPenaltyChoice,
  selectScenario,
} from '../src/utils/decisionSystem.js'
import { calculateLineupRatings } from '../src/utils/lineupBalance.js'
import { getTeamDefaultFormation } from '../src/data/teamFormations.js'
import { FORMAL_MATCH_DECISION_TARGET_MINUTES } from '../src/utils/formalMatchSession.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const runs = Number.parseInt(getArg('runs', '300'), 10)
const teamIds = getArg('teams', 'france,brazil,curacao,newzealand').split(',')
const opponentBands = getArg('opponents', 'weak,medium,strong').split(',')

const OPPONENT_BANDS = {
  weak: { label: '弱队对手', attack: 62, defense: 62 },
  medium: { label: '中档对手', attack: 72, defense: 72 },
  strong: { label: '强队对手', attack: 84, defense: 84 },
}

const TEAM_META = {
  france: { id: 'france', name: '法国', difficulty: 1, budget: 2300 },
  brazil: { id: 'brazil', name: '巴西', difficulty: 1, budget: 2250 },
  argentina: { id: 'argentina', name: '阿根廷', difficulty: 2, budget: 2100 },
  portugal: { id: 'portugal', name: '葡萄牙', difficulty: 2, budget: 2050 },
  germany: { id: 'germany', name: '德国', difficulty: 3, budget: 1950 },
  japan: { id: 'japan', name: '日本', difficulty: 3, budget: 1850 },
  norway: { id: 'norway', name: '挪威', difficulty: 4, budget: 1700 },
  morocco: { id: 'morocco', name: '摩洛哥', difficulty: 4, budget: 1800 },
  newzealand: { id: 'newzealand', name: '新西兰', difficulty: 5, budget: 1280 },
  curacao: { id: 'curacao', name: '库拉索', difficulty: 5, budget: 1170 },
}

function getSimulationTeam(teamId) {
  const meta = TEAM_META[teamId]
  if (!meta) return null
  return {
    ...meta,
    players: prepareTeamPlayers(allPlayers[teamId] || [], teamId, meta.budget),
  }
}

function createSeededRandom(seedText) {
  let seed = 2166136261
  for (const char of seedText) {
    seed ^= char.charCodeAt(0)
    seed = Math.imul(seed, 16777619)
  }
  return () => {
    seed += 0x6D2B79F5
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function withRandom(randomFn, fn) {
  const originalRandom = Math.random
  Math.random = randomFn
  try {
    return fn()
  } finally {
    Math.random = originalRandom
  }
}

function pickLineup(team) {
  const players = [...(team.players || [])]
  const byPos = {
    GK: players.filter(player => player.position === 'GK').sort((a, b) => b.rating - a.rating),
    DF: players.filter(player => player.position === 'DF').sort((a, b) => b.rating - a.rating),
    MF: players.filter(player => player.position === 'MF').sort((a, b) => b.rating - a.rating),
    FW: players.filter(player => player.position === 'FW').sort((a, b) => b.rating - a.rating),
  }
  const lineup = [
    ...byPos.GK.slice(0, 1),
    ...byPos.DF.slice(0, 4),
    ...byPos.MF.slice(0, 3),
    ...byPos.FW.slice(0, 3),
  ]
  const remaining = players
    .filter(player => !lineup.some(selected => selected.id === player.id))
    .sort((a, b) => b.rating - a.rating)
  while (lineup.length < 11 && remaining.length) lineup.push(remaining.shift())
  return lineup.map(player => ({ ...player, pos: player.position }))
}

function getShotXG(outcome = '', successProb = 0.5) {
  if (outcome.includes('penalty')) return 0.76
  if (outcome.includes('long')) return 0.08
  if (outcome.includes('freekick')) return 0.12
  if (outcome.includes('header')) return 0.20
  if (outcome.includes('chip')) return 0.32
  if (outcome.includes('near') || outcome.includes('close') || outcome.includes('tap_in')) return 0.42
  return Math.min(0.48, Math.max(0.10, successProb * 0.48))
}

function chooseBestOption(decision) {
  return decision.choices
    .map(choice => {
      const deltas = choice.outcome_deltas || {}
      const riskPenalty = /红牌|点球|二黄|空门/.test(choice.risk || '') ? 0.08 : /犯规|吃牌|反击|受伤/.test(choice.risk || '') ? 0.04 : 0
      return {
        choice,
        score: (choice.successProb || 0.5) + (deltas.win_delta || 0) + (deltas.goal || 0) * 0.2 - (deltas.goal_against || 0) * 0.25 - riskPenalty,
      }
    })
    .sort((a, b) => b.score - a.score)[0]?.choice || decision.choices[0]
}

function applyResult(stats, result, scenarioId, outcome) {
  stats.successes += result.isSuccess ? 1 : 0
  stats.goals += result.homeScoreChange
  stats.goalsAgainst += result.awayScoreChange

  const opponentShot = outcome.startsWith('opponent_goal') || ['goal_against', 'counter_sealed', 'counter_golden_goal'].includes(outcome)
  const shot = !opponentShot && (
    result.homeScoreChange > 0
    || /saved|miss|over|wide|post|shot|header|freekick|volley|placement|power|panenka|chip|blocked/.test(outcome)
  )

  if (shot) {
    stats.shots++
    stats.xG += scenarioId === 'match_penalty' ? 0.76 : getShotXG(outcome, result.successProb)
  }
  if (opponentShot) {
    stats.oppShots++
    stats.oppXG += getShotXG(outcome, result.successProb)
  }
  if (outcome.includes('yellow')) stats.yellowCards++
  if (outcome.includes('red_card')) stats.redCards++
  if (outcome.includes('VAR') || scenarioId.includes('var') || scenarioId.includes('handball')) stats.varChecks++
}

function resolveDecision(choice, keyPlayer, gameState, scenarioId, randomFn) {
  if (scenarioId === 'penalty_area_dive' && choice.id === 'simulate_contact') {
    return resolveDiveChoice(choice, keyPlayer, gameState, randomFn)
  }
  if (scenarioId === 'match_penalty' || scenarioId === 'penalty_kick') {
    return resolveMatchPenaltyChoice(choice, keyPlayer, gameState, randomFn)
  }
  return resolveChoiceResult(choice, keyPlayer, gameState)
}

function simulateMatch(team, opponentBand, runIndex) {
  const random = createSeededRandom(`${team.id}-${opponentBand.label}-${runIndex}`)
  return withRandom(random, () => {
    let lineup = pickLineup(team)
    const formation = getTeamDefaultFormation(team.id)
    const lineupRatings = calculateLineupRatings(lineup, formation)
    const stats = {
      decisions: 0,
      successes: 0,
      goals: 0,
      goalsAgainst: 0,
      shots: 0,
      oppShots: 0,
      xG: 0,
      oppXG: 0,
      penaltiesWon: 0,
      penaltiesConceded: 0,
      yellowCards: 0,
      redCards: 0,
      varChecks: 0,
    }

    for (const minute of FORMAL_MATCH_DECISION_TARGET_MINUTES) {
      const gameState = {
        minute,
        myScore: stats.goals,
        oppScore: stats.goalsAgainst,
        scoreDiff: stats.goals - stats.goalsAgainst,
        myAttack: lineupRatings.attack,
        myDefense: Math.max(35, lineupRatings.defense - stats.redCards * 7),
        oppAttack: opponentBand.attack,
        oppDefense: opponentBand.defense,
        teamAvgRating: lineupRatings.overall,
        teamDifficulty: team.difficulty,
        isKnockout: minute >= 76,
        opponentName: opponentBand.label,
      }
      const scenario = selectScenario(minute, gameState)
      const decision = executeDecision(scenario, lineup, gameState)
      const choice = chooseBestOption(decision)
      const keyPlayer = decision.keyPlayers?.default || lineup[0]
      const result = resolveDecision(choice, keyPlayer, gameState, scenario.id, random)
      const outcome = result.outcome || ''

      stats.decisions++
      applyResult(stats, result, scenario.id, outcome)

      if (outcomeWinsPenalty(outcome)) {
        stats.penaltiesWon++
        const penalty = DECISION_LIBRARY.find(item => item.id === 'match_penalty')
        const penaltyDecision = executeDecision(penalty, lineup, gameState)
        const penaltyChoice = chooseBestOption(penaltyDecision)
        const penaltyResult = resolveMatchPenaltyChoice(penaltyChoice, penaltyDecision.keyPlayers?.default, gameState, random)
        applyResult(stats, penaltyResult, 'match_penalty', penaltyResult.outcome)
      }

      if (outcomeConcedesPenalty(outcome)) {
        stats.penaltiesConceded++
        const goalkeeper = lineup.find(player => player.position === 'GK') || lineup[0]
        const penaltyResult = resolveOpponentPenaltyChoice({ side: 'center' }, goalkeeper, gameState, random)
        applyResult(stats, penaltyResult, 'opponent_penalty_defense', penaltyResult.outcome)
      }

      if (outcome.includes('red_card') && keyPlayer?.id) {
        lineup = lineup.filter(player => player.id !== keyPlayer.id)
      }
    }

    return stats
  })
}

function average(records, key) {
  return records.reduce((sum, item) => sum + item[key], 0) / Math.max(1, records.length)
}

const rows = []

for (const teamId of teamIds) {
  const team = getSimulationTeam(teamId)
  if (!team) {
    console.error(`Unknown team: ${teamId}`)
    continue
  }

  for (const bandId of opponentBands) {
    const band = OPPONENT_BANDS[bandId]
    if (!band) continue
    const records = Array.from({ length: runs }, (_, index) => simulateMatch(team, band, index))
    rows.push({
      teamId,
      teamName: team.name,
      opponent: bandId,
      runs,
      decisions: average(records, 'decisions'),
      successRate: average(records, 'successes') / average(records, 'decisions'),
      goals: average(records, 'goals'),
      goalsAgainst: average(records, 'goalsAgainst'),
      xG: average(records, 'xG'),
      oppXG: average(records, 'oppXG'),
      penaltiesWon: average(records, 'penaltiesWon'),
      penaltiesConceded: average(records, 'penaltiesConceded'),
      yellowCards: average(records, 'yellowCards'),
      redCards: average(records, 'redCards'),
      varChecks: average(records, 'varChecks'),
    })
  }
}

const fmt = value => Number(value).toFixed(2)
console.log('\n决策系统 V2 平衡模拟')
console.log(`场景数: ${DECISION_LIBRARY.length} | 每组 ${runs} 场 | 球队: ${teamIds.join(', ')}`)
console.log('| 球队 | 对手 | 决策 | 成功率 | 进球 | 失球 | xG | opp xG | 点球得 | 点球送 | 黄牌 | 红牌 | VAR |')
console.log('|------|------|------|--------|------|------|----|--------|--------|--------|------|------|-----|')
for (const row of rows) {
  console.log(`| ${row.teamName} | ${row.opponent} | ${fmt(row.decisions)} | ${fmt(row.successRate * 100)}% | ${fmt(row.goals)} | ${fmt(row.goalsAgainst)} | ${fmt(row.xG)} | ${fmt(row.oppXG)} | ${fmt(row.penaltiesWon)} | ${fmt(row.penaltiesConceded)} | ${fmt(row.yellowCards)} | ${fmt(row.redCards)} | ${fmt(row.varChecks)} |`)
}

const today = new Date().toISOString().slice(0, 10)
const reportDir = join(ROOT, 'docs/balance')
mkdirSync(reportDir, { recursive: true })
let report = `# 决策系统 V2 平衡模拟 — ${today}\n\n`
report += `- 场景数: ${DECISION_LIBRARY.length}\n`
report += `- 每组模拟: ${runs} 场\n`
report += `- 球队: ${teamIds.join(', ')}\n`
report += `- 对手强度: ${opponentBands.join(', ')}\n\n`
report += '| 球队 | 对手 | 决策 | 成功率 | 进球 | 失球 | xG | opp xG | 点球得 | 点球送 | 黄牌 | 红牌 | VAR |\n'
report += '|------|------|------|--------|------|------|----|--------|--------|--------|------|------|-----|\n'
for (const row of rows) {
  report += `| ${row.teamName} | ${row.opponent} | ${fmt(row.decisions)} | ${fmt(row.successRate * 100)}% | ${fmt(row.goals)} | ${fmt(row.goalsAgainst)} | ${fmt(row.xG)} | ${fmt(row.oppXG)} | ${fmt(row.penaltiesWon)} | ${fmt(row.penaltiesConceded)} | ${fmt(row.yellowCards)} | ${fmt(row.redCards)} | ${fmt(row.varChecks)} |\n`
}

report += '\n## 自动检查\n\n'
for (const row of rows) {
  const strongTeam = ['france', 'brazil'].includes(row.teamId)
  const weakTeam = ['curacao', 'newzealand'].includes(row.teamId)
  if (strongTeam && row.opponent === 'weak') {
    report += `- ${row.teamName} vs weak: xG ${fmt(row.xG)}，目标为 1.2-3.4；${row.xG >= 1.2 && row.xG <= 3.4 ? '通过' : '需复查'}。\n`
  }
  if (weakTeam && row.opponent === 'strong') {
    report += `- ${row.teamName} vs strong: 成功率 ${fmt(row.successRate * 100)}%，目标为低于 58%；${row.successRate < 0.58 ? '通过' : '偏强'}。\n`
  }
}

const reportPath = join(reportDir, `${today}-decision-balance-report.md`)
writeFileSync(reportPath, report, 'utf-8')
console.log(`\n报告已写入: ${reportPath}`)
