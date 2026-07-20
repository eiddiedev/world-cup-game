#!/usr/bin/env node
/**
 * 决策触发分布仿真 —— 直接驱动真实调度管线
 *
 * 与正式比赛共用同一条链路：
 *   advanceFormalMatchSession → selectPriorityFormalDecisionScenario
 *   → selectDecisionScenario → isFormalDecisionMomentEligibleV3
 * 用符合真实比赛节奏的运行时时刻（球位/进攻方向/天气/持球人）
 * 和事件流（传球/触球/对抗/射门/扑救/角球/界外球/门球/进球…）
 * 统计 53 个场景：
 *   - triggered：真实被调度出来的次数（每场每场景最多 1 次，与线上一致）
 *   - matchPct：至少触发过 1 次的比赛占比
 *   - eligibleTicks：满足触发门槛的分钟刻数（区分"门槛永远不满足"与"有资格但落选"）
 *
 * 用法：
 *   node scripts/decision-trigger-sim.mjs --matches 5000 --seed 42
 *   node scripts/decision-trigger-sim.mjs --matches 5000 --rain-prob 0.25
 */

import { DECISION_LIBRARY } from '../src/data/decisionLibrary.js'
import {
  createFormalMatchSession,
  startFormalMatchSession,
  advanceFormalMatchSession,
  settleFormalDecisionInSession,
  recordFormalRuntimeGoal,
  deriveFormalRuntimeIncidents,
  FORMAL_MATCH_DECISION_TARGET_MINUTES,
} from '../src/utils/formalMatchSession.js'
import { isFormalDecisionMomentEligibleV3 } from '../src/utils/decisionSceneScriptV3.js'
import { buildHappySeedRuntimeActorConfig } from '../src/utils/happySeedRuntimeActors.js'

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}
const MATCHES = parseInt(getArg('matches', '5000'), 10)
const SEED = parseInt(getArg('seed', '42'), 10)
// 当前线上天气恒为 clear；--rain-prob 用于评估引入雨天后雨天场景的可达性
const RAIN_PROB = parseFloat(getArg('rain-prob', '0'))

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(SEED)
const clamp01 = (v) => Math.min(1, Math.max(0, v))

const actorConfig = buildHappySeedRuntimeActorConfig()
const actors = actorConfig.actors
const redGk = actors.find((a) => a.side === 'red' && a.isGoalkeeper)
const blueGk = actors.find((a) => a.side === 'blue' && a.isGoalkeeper)
const redField = actors.filter((a) => a.side === 'red' && !a.isGoalkeeper)
const blueField = actors.filter((a) => a.side === 'blue' && !a.isGoalkeeper)
const pick = (list) => list[Math.floor(rng() * list.length)]

// ─── 比赛节奏合成 ────────────────────────────────────────────────────────────
// 球位推进度分布：中场为主，进攻三区次之，禁区/底线最少（贴近真实比赛时间占比）
function sampleProgress() {
  const r = rng()
  if (r < 0.16) return 0.08 + rng() * 0.22
  if (r < 0.62) return 0.30 + rng() * 0.40
  if (r < 0.88) return 0.70 + rng() * 0.15
  return 0.85 + rng() * 0.13
}

function sampleActorPositions(moment) {
  // 只有门将与清道夫场景（sweeper-window）真正读取位置；其余角色只需存在
  const entries = []
  const direction = moment.attackDirection
  for (const actor of actors) {
    if (actor.isGoalkeeper) {
      const isHome = actor.runtimeActorId === moment.homeGoalkeeperRuntimeActorId
      // 红方门将大多数时候在小禁区附近，少数情况出击（满足 sweeper 窗口）
      const advanced = isHome && moment.attackingSide === 'blue' && rng() < 0.06
      const baseX = actor.side === 'red' ? 0.045 : 0.955
      entries.push({
        runtimeActorId: actor.runtimeActorId,
        normalized: [
          advanced
            ? clamp01(baseX + (actor.side === 'red' ? 1 : -1) * (0.09 + rng() * 0.06))
            : baseX,
          0.42 + rng() * 0.16,
          0,
        ],
      })
      continue
    }
    const sideSign = actor.side === 'red' ? 1 : -1
    const spread = actor.side === moment.attackingSide ? 0.45 : -0.25
    entries.push({
      runtimeActorId: actor.runtimeActorId,
      normalized: [
        clamp01(0.5 + sideSign * direction * (spread * (rng() - 0.5) * 2) * 0.5),
        0.08 + rng() * 0.84,
        0,
      ],
    })
  }
  return entries
}

let eventSequence = 0
function makeEvent(type, side, minute, detail = {}) {
  eventSequence += 1
  const point = [0.5, 0.5, 0]
  return {
    schemaVersion: 'match-runtime-event-v1',
    id: `sim.${eventSequence}.${type}`,
    type,
    side,
    minute,
    frameId: minute * 60,
    matchTime: minute * 60,
    ball: { before: point, after: point },
    primaryRuntimeActorId: side === 'blue' ? pick(blueField).runtimeActorId : pick(redField).runtimeActorId,
    detail,
  }
}

function buildMinuteEvents(minute, attackingSide, progress, state) {
  const events = []
  const defending = attackingSide === 'red' ? 'blue' : 'red'
  const inBox = progress >= 0.8
  // 常规传触：每分钟 2-4 次
  const touches = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < touches; i += 1) {
    events.push(makeEvent(rng() < 0.6 ? 'pass' : 'touch', attackingSide, minute))
  }
  if (rng() < 0.4) events.push(makeEvent('possession-change', defending, minute))
  if (rng() < 0.5) {
    events.push(makeEvent('tackle-contact', defending, minute, {
      contact: rng() < 0.7 ? 'slide-trap' : 'slide-hit',
      missedBall: rng() < 0.3,
      ballWon: rng() < 0.55,
      inOwnPenaltyArea: inBox,
    }))
  }
  if (rng() < 0.24) {
    events.push(makeEvent('shot', attackingSide, minute, {
      inAttackingPenaltyArea: inBox,
    }))
  }
  if (rng() < 0.055) events.push(makeEvent('save', defending, minute, { saveKind: 'keeper-control' }))
  if (rng() < 0.10) events.push(makeEvent('corner', attackingSide, minute))
  if (rng() < 0.35) events.push(makeEvent('throw-in', rng() < 0.5 ? 'red' : 'blue', minute))
  if (rng() < 0.08) events.push(makeEvent('goal-kick', defending, minute))
  if (rng() < 0.15) events.push(makeEvent('ball-out', defending, minute))
  if (rng() < 0.012) events.push(makeEvent(rng() < 0.5 ? 'post-hit' : 'crossbar-hit', attackingSide, minute))
  if (rng() < 0.033) {
    events.push(makeEvent('goal', attackingSide, minute))
    state.pendingGoal = attackingSide
  }
  return events
}

function buildMoment(minute, attackingSide, progress, weather, keeperHold) {
  const attackDirection = attackingSide === 'red' ? 1 : -1
  const x = attackingSide === 'red' ? progress : 1 - progress
  const owner = keeperHold
    ? redGk
    : attackingSide === 'red' ? pick(redField) : pick(blueField)
  const moment = {
    schemaVersion: 'runtime-decision-moment-v1',
    capturedAtMatchTime: minute * 60,
    runtimeState: 'Match',
    ballOutOfPlay: false,
    attackingSide,
    attackDirection,
    ownerRuntimeActorId: owner.runtimeActorId,
    ownerIsGoalkeeper: Boolean(keeperHold),
    ballInHands: Boolean(keeperHold),
    weather,
    homeGoalkeeperRuntimeActorId: redGk.runtimeActorId,
    awayGoalkeeperRuntimeActorId: blueGk.runtimeActorId,
    ball: { normalized: [clamp01(x), 0.06 + rng() * 0.88, 0] },
    actorPositions: [],
  }
  moment.actorPositions = sampleActorPositions(moment)
  return moment
}

// ─── 单场仿真 ────────────────────────────────────────────────────────────────
function simMatch(matchIndex) {
  const weather = rng() < RAIN_PROB ? 'rain' : 'clear'
  let session = startFormalMatchSession(createFormalMatchSession({
    matchId: `sim-${SEED}-${matchIndex}`,
    teamId: 'france',
    opponentTeamId: 'brazil',
    teamName: '法国',
    opponentName: '巴西',
  }))
  const score = { red: 0, blue: 0 }
  const state = { pendingGoal: null }
  const triggered = []
  const eligibleTicks = Object.fromEntries(DECISION_LIBRARY.map((s) => [s.id, 0]))

  for (let minute = 1; minute <= 93; minute += 1) {
    const attackingSide = rng() < 0.5 ? 'red' : 'blue'
    const progress = sampleProgress()
    // 扑救后门将持球时刻（keeper_distribution 窗口）
    const keeperHold = rng() < 0.03
    const moment = buildMoment(minute, attackingSide, progress, weather, keeperHold)
    const rawEvents = buildMinuteEvents(minute, attackingSide, progress, state)
    const events = [
      ...rawEvents,
      ...rawEvents.flatMap((event) => deriveFormalRuntimeIncidents(event)),
    ]
    if (state.pendingGoal) {
      score[state.pendingGoal] += 1
      session = recordFormalRuntimeGoal(session, {
        score: [score.red, score.blue],
        timestamp: Date.now() + matchIndex * 1000 + minute,
      }, moment, actorConfig)
      state.pendingGoal = null
    }

    // 逐场景资格统计（与 selectDecisionScenario 同一套判定，但不消费名额）
    for (const scenario of DECISION_LIBRARY) {
      const [minimum, maximum] = scenario.minute_range || [1, 90]
      if (minute < minimum || minute > Math.min(90, maximum)) continue
      const hit = events.some((event) => (
        isFormalDecisionMomentEligibleV3(scenario.id, moment, event, session)
      ))
      if (hit) eligibleTicks[scenario.id] += 1
    }

    const advanced = advanceFormalMatchSession(session, {
      snapshot: {
        minute,
        red: { possession: 50, shots: 0, passes: 0 },
        blue: { possession: 50, shots: 0, passes: 0 },
      },
      runtimeMoment: moment,
      actorSource: actorConfig,
      decisionsEnabled: true,
      runtimeEvents: events,
      deriveRuntimeIncidents: false,
      random: rng,
    })
    session = advanced.session
    if (advanced.decisionPlan) {
      triggered.push(advanced.decisionPlan.scenarioId)
      session = settleFormalDecisionInSession(session, {
        coachDecisionEvent: { sourceScenarioId: advanced.decisionPlan.scenarioId },
      }, {
        choice: { id: 'stub', label: 'stub' },
        result: { outcome: 'stub', isSuccess: true },
        resultText: 'stub',
      })
    }
  }
  return { triggered, eligibleTicks, decisions: session.decisions.length, score }
}

// ─── 聚合 ────────────────────────────────────────────────────────────────────
const triggerCount = Object.fromEntries(DECISION_LIBRARY.map((s) => [s.id, 0]))
const matchCount = Object.fromEntries(DECISION_LIBRARY.map((s) => [s.id, 0]))
const eligibleTotal = Object.fromEntries(DECISION_LIBRARY.map((s) => [s.id, 0]))
let totalDecisions = 0

for (let match = 0; match < MATCHES; match += 1) {
  const { triggered, eligibleTicks, decisions } = simMatch(match)
  totalDecisions += decisions
  for (const id of new Set(triggered)) matchCount[id] += 1
  for (const id of triggered) triggerCount[id] += 1
  for (const id of Object.keys(eligibleTicks)) eligibleTotal[id] += eligibleTicks[id]
}

const rows = DECISION_LIBRARY.map((s) => ({
  id: s.id,
  triggered: triggerCount[s.id],
  matchPct: (matchCount[s.id] / MATCHES) * 100,
  eligibleTicks: eligibleTotal[s.id],
})).sort((a, b) => a.triggered - b.triggered || a.eligibleTicks - b.eligibleTicks)

console.log('═'.repeat(78))
console.log(`决策触发分布仿真 · ${MATCHES} 场比赛 · 平均决策 ${(totalDecisions / MATCHES).toFixed(2)} 个/场 · 目标分钟槽 [${FORMAL_MATCH_DECISION_TARGET_MINUTES.join(', ')}] · 雨天概率 ${RAIN_PROB}`)
console.log('═'.repeat(78))
console.log(`${'场景'.padEnd(34)} ${'触发'.padStart(6)} ${'比赛%'.padStart(8)} ${'有资格刻'.padStart(10)}`)
console.log('─'.repeat(78))
for (const row of rows) {
  const dead = row.triggered === 0 ? (row.eligibleTicks === 0 ? '  ← 从未有资格' : '  ← 有资格但从未触发') : ''
  console.log(`${row.id.padEnd(34)} ${String(row.triggered).padStart(6)} ${row.matchPct.toFixed(1).padStart(7)}% ${String(row.eligibleTicks).padStart(10)}${dead}`)
}
console.log('─'.repeat(78))
const never = rows.filter((r) => r.triggered === 0)
const rare = rows.filter((r) => r.triggered > 0 && r.matchPct < 5)
console.log(`从未触发 ${never.length} 个 · 触发率<5% ${rare.length} 个 · 触发率<20% ${rows.filter((r) => r.matchPct < 20).length} 个`)
