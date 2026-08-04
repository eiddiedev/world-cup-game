import { DECISION_LIBRARY } from '../data/decisionLibrary.js'
import {
  FORMAL_DECISION_SCENE_CATALOG_V3,
} from './formalDecisionSceneCatalogV3.js'
import {
  getRuntimeAttackProgressV3,
  isFormalDecisionMomentEligibleV3,
} from './decisionSceneScriptV3.js'
import { createDerivedMatchRuntimeEvent } from './matchRuntimeEvent.js'
import { CURRENT_VARIANT } from '../config/runtime.js'

export const FORMAL_MATCH_SESSION_SCHEMA = 'formal-match-session-v1'
export const FORMAL_MATCH_REALTIME_MINUTES = CURRENT_VARIANT.formalMatchRealtimeMinutes
export const FORMAL_MATCH_TARGET_DECISIONS = 10
export const FORMAL_MATCH_ROUTINE_COMMENTARY_BUDGET = 5
export const FORMAL_MATCH_DECISION_TARGET_MINUTES = Object.freeze([8, 16, 24, 32, 41, 50, 58, 66, 74, 83])
// 高价值时刻（角球/深度进攻/单刀）优先场景按类别概率抢占决策槽：
// 角球决策是定位球核心玩法（场均 ~3 次）；点球决策保持稀有（场均 ~0.5 次）
export const FORMAL_PRIORITY_DECISION_TAKE_RATE = Object.freeze({
  corner: 0.75,
  penalty: 0.08,
  default: 0.10,
})
// 非点球/伤病的优先场景每场最多占用 5 个决策，其余决策槽留给大池，保证多元
export const FORMAL_MATCH_PRIORITY_DECISION_CAP = 5
// 拥有优先通道（角球/深度进攻/点球）的场景不再进入大池：
// 它们只在自己的真实比赛时刻出现，大池曝光机会留给其余 37 个场景
const PRIORITY_CHANNEL_SCENARIO_IDS = new Set([
  'header_corner',
  'late_keeper_up_corner',
  'aerial_duel_corner_defending',
  'opponent_short_corner_defense',
  'penalty_kick',
  'match_penalty',
  'penalty_area_cross',
  'wing_overlap_cross',
  'solo_run_penalty',
  'through_ball_chance',
  'central_cutback_press',
  'penalty_area_foul_risk',
  'gk_one_on_one',
  'last_defender_tackle',
  'injury_play_on',
])
export const FORMAL_GOAL_VAR_REVIEW_RATE = 0.28
export const FORMAL_GOAL_VAR_DISALLOW_RATE = 0.12
export const FORMAL_MATCH_BALANCE_TARGETS = Object.freeze({
  totalGoals: Object.freeze([3.5, 4.5]),
  opponentGoals: Object.freeze([0.6, 1.2]),
  redCards: Object.freeze([0.15, 0.25]),
  penalties: Object.freeze([0.5, 0.9]),
  fouls: Object.freeze([20, 28]),
  yellowCards: Object.freeze([2, 5]),
  corners: Object.freeze([6, 12]),
  saves: Object.freeze([3, 8]),
})

const PENALTY_GOAL_SCENARIOS = new Set([
  'penalty_kick',
  'match_penalty',
  'penalty_shootout_round',
])

function emptySideStats() {
  return {
    shots: 0,
    shotsOnTarget: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    corners: 0,
    saves: 0,
    offsides: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    penalties: 0,
  }
}

function cloneSession(session) {
  return {
    ...session,
    score: { ...session.score },
    nativeRuntimeScore: { ...session.nativeRuntimeScore },
    stats: {
      red: { ...session.stats.red },
      blue: { ...session.stats.blue },
    },
    commentary: [...session.commentary],
    incidents: [...session.incidents],
    decisions: [...session.decisions],
    usedScenarioIds: [...session.usedScenarioIds],
    processedRuntimeEventIds: [...(session.processedRuntimeEventIds || [])],
    passChain: { ...(session.passChain || { red: 0, blue: 0 }) },
    disciplineByRuntimeActorId: { ...(session.disciplineByRuntimeActorId || {}) },
    playerAlertKeys: [...(session.playerAlertKeys || [])],
  }
}

function makeLine(session, payload) {
  return {
    id: payload.id || `${session.matchId}.${payload.type}.${session.eventSequence + 1}`,
    eventId: payload.eventId || null,
    sourceEventId: payload.sourceEventId || payload.eventId || null,
    minute: Math.max(0, Math.min(120, Number(payload.minute ?? session.minute) || 0)),
    type: payload.type,
    tone: payload.tone || 'standard',
    text: payload.text,
  }
}

function appendEvent(session, payload) {
  const next = cloneSession(session)
  const line = makeLine(next, payload)
  next.eventSequence += 1
  next.commentary.push(line)
  next.commentary = next.commentary.slice(-80)
  if (payload.routine) next.routineCommentaryCount = Number(next.routineCommentaryCount || 0) + 1
  if (payload.incident !== false) next.incidents.push(line)
  return next
}

function actorForRuntimeId(actorSource, runtimeActorId) {
  return (actorSource?.actors || []).find((actor) => actor.runtimeActorId === runtimeActorId)
}

function scorerLabel(session, side, detail, actorSource) {
  const scorer = (actorSource?.actors || []).find((actor) => (
    (detail.scorerRuntimeActorId && actor.runtimeActorId === detail.scorerRuntimeActorId)
    || (detail.scorerRuntimeEntityId != null
      && actor.runtimeEntityId === detail.scorerRuntimeEntityId)
  ))
  if (scorer?.side === side) {
    return `${scorer.teamName || (side === 'red' ? session.teamName : session.opponentName)}`
      + `${scorer.number}号${scorer.name}`
  }
  return side === 'red' ? `${session.teamName}球员` : `${session.opponentName}球员`
}

function applyStatsDelta(session, side, delta = {}) {
  const next = cloneSession(session)
  const target = next.stats[side === 'blue' ? 'blue' : 'red']
  Object.entries(delta).forEach(([key, value]) => {
    target[key] = Number(target[key] || 0) + Number(value || 0)
  })
  return next
}

function nearestRedPlayerId(actorSource, runtimeMoment) {
  const positionMap = new Map((runtimeMoment?.actorPositions || []).map((entry) => [
    entry.runtimeActorId,
    entry.normalized,
  ]))
  const ball = runtimeMoment?.ball?.normalized || [0.5, 0.5]
  return (actorSource?.actors || [])
    .filter((actor) => actor.side === 'red' && actor.state?.onPitch && !actor.isGoalkeeper)
    .map((actor) => ({ actor, point: positionMap.get(actor.runtimeActorId) }))
    .filter((entry) => Array.isArray(entry.point))
    .sort((left, right) => (
      Math.hypot(left.point[0] - ball[0], left.point[1] - ball[1])
      - Math.hypot(right.point[0] - ball[0], right.point[1] - ball[1])
    ))[0]?.actor?.playerId || null
}

function redGoalkeeperPlayerId(actorSource) {
  return (actorSource?.actors || []).find((actor) => (
    actor.side === 'red' && actor.isGoalkeeper && actor.state?.onPitch
  ))?.playerId || null
}

function stableRoll(seed, salt = '') {
  const input = `${seed || ''}:${salt}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

export function resolveFormalGoalVar(sourceEvent) {
  if (sourceEvent?.type !== 'goal' || !sourceEvent.id) return null
  const detail = sourceEvent.detail || {}
  const penalty = detail.penalty === true || PENALTY_GOAL_SCENARIOS.has(detail.scenarioId)
  const forcedOutcome = detail.forceVarOutcome
  const reviewed = forcedOutcome != null
    || detail.forceVarReview === true
    || (
      detail.forceVarReview !== false
      && stableRoll(sourceEvent.id, 'var-review') < FORMAL_GOAL_VAR_REVIEW_RATE
    )
  const disallowed = reviewed && (
    forcedOutcome === 'disallowed'
    || (
      forcedOutcome !== 'valid'
      && stableRoll(sourceEvent.id, 'var-disallowed') < FORMAL_GOAL_VAR_DISALLOW_RATE
    )
  )
  const reason = !disallowed
    ? null
    : penalty || stableRoll(sourceEvent.id, 'var-reason') >= 0.58
      ? 'attacking-foul'
      : 'offside'
  return {
    reviewed,
    outcome: disallowed ? 'disallowed' : 'valid',
    reason,
    penalty,
    scoringSide: sourceEvent.side === 'blue' ? 'blue' : 'red',
  }
}

export function deriveFormalRuntimeIncidents(sourceEvent) {
  if (!sourceEvent?.id) return []
  const incidents = []
  const push = (type, detail = {}) => incidents.push(createDerivedMatchRuntimeEvent(sourceEvent, {
    id: `${sourceEvent.id}.${type}`,
    type,
    detail,
  }))
  if (sourceEvent.type === 'tackle-contact') {
    if (sourceEvent.detail?.suppressRuleDerivation === true) return incidents
    const contact = sourceEvent.detail?.contact
    const missedBallInOwnBox = contact === 'slide-hit'
      && sourceEvent.detail?.missedBall === true
      && sourceEvent.detail?.inOwnPenaltyArea === true
    const foulChance = contact === 'slide-trap' ? 0.14 : contact === 'slide-hit' ? 0.58 : 0
    const isFoul = missedBallInOwnBox || stableRoll(sourceEvent.id, 'foul') < foulChance
    if (!isFoul) return incidents
    const severity = stableRoll(sourceEvent.id, 'severity')
    push('foul', {
      awardedSide: sourceEvent.side === 'red' ? 'blue' : 'red',
      contact,
      severity,
      ballWon: sourceEvent.detail?.ballWon === true,
      missedBall: sourceEvent.detail?.missedBall === true,
      inOwnPenaltyArea: sourceEvent.detail?.inOwnPenaltyArea === true,
    })
    if (severity >= 0.82) push('card', { color: severity >= 0.98 ? 'red' : 'yellow' })
    if (stableRoll(sourceEvent.id, 'injury') < 0.045) push('injury', { severity })
    if (missedBallInOwnBox) {
      push('penalty', { awardedSide: sourceEvent.side === 'red' ? 'blue' : 'red' })
    }
  }
  if (sourceEvent.type === 'shot' && stableRoll(sourceEvent.id, 'handball') < 0.055) {
    push('handball-review', {
      inPenaltyArea: sourceEvent.detail?.inAttackingPenaltyArea === true,
    })
  }
  if (sourceEvent.type === 'goal') {
    const resolution = resolveFormalGoalVar(sourceEvent)
    if (resolution?.reviewed) {
      push('var-review', resolution)
      push('var-result', resolution)
    }
  }
  if (sourceEvent.type === 'throw-in' && stableRoll(sourceEvent.id, 'throw-violation') < 0.035) {
    push('throw-in-violation', { awardedSide: sourceEvent.side === 'red' ? 'blue' : 'red' })
  }
  return incidents
}

// 大池抽取权重：按“资格频率 × 权重 ≈ 常数”校准，让 53 个场景的场均触发期望趋于均衡。
// 资格窗口宽（几乎随时可选）的场景用低权重，资格窗口窄（稀有时刻）的场景用高权重。
const DECISION_SCENARIO_RARITY_WEIGHTS = Object.freeze({
  // —— 稀有时刻场景：资格窗口极窄，大幅提高曝光 ——
  extra_time_penalty_shootout_prep: 12,
  penalty_shootout_round: 12,
  weather_slippery_tackle: 12,
  late_keeper_up_corner: 6,
  keeper_sweeper_claim: 10,
  penalty_rebound_followup: 10,
  keeper_distribution: 10,
  indirect_freekick_box: 5,
  defend_dangerous_freekick: 5,
  opponent_dangerous_freekick_wall: 5,
  freekick_dangerous: 4,
  var_offside_goal: 4,
  var_goal_review: 6,
  var_penalty_review: 4,
  handball_penalty_claim: 4,
  defensive_line_handball_var: 4,
  injury_play_on: 4,
  defender_last_ditch: 3,
  penalty_area_dive: 3,
  box_scramble_clearance: 2.5,
  second_yellow_warning: 2.5,
  set_piece_rebound_shot: 2,
  central_cutback_press: 2,
  through_ball_chance: 2,
  low_block_counter_launch: 2,
  second_ball_corner_attack: 2,
  trailing_last_ten: 2,
  leading_protect: 2,
  yellow_card_dissent_control: 2,
  aerial_duel_corner_defending: 2,
  opponent_short_corner_defense: 2,
  tactical_foul_counter: 2,
  stamina_collapse_sub: 2,
  // —— 中频场景 ——
  counter_attack_3v2: 1.5,
  high_press_trap: 1.5,
  offside_trap: 1.5,
  midfield_switch_play: 1.5,
  half_space_through_run: 1.5,
  midfield_press_trigger: 1.5,
  fullback_recovery_run: 1.5,
  long_shot_opportunity: 1.5,
  box_second_ball_chaos: 1.5,
  throwin_attack: 1.5,
  // —— 高频场景：资格窗口宽，压低权重保证多元 ——
  match_penalty: 1,
  penalty_kick: 1,
  header_corner: 1,
  penalty_area_foul_risk: 1,
  solo_run_penalty: 1,
  last_defender_tackle: 1,
  gk_one_on_one: 0.6,
  wing_overlap_cross: 0.6,
  penalty_area_cross: 0.5,
  midfield_second_ball: 0.3,
})

function selectDecisionScenario(session, runtimeMoment, sourceEvents, options = {}) {
  const forcedScenarioId = options.forcedScenarioIds?.[session.nextDecisionSlot]
  if (forcedScenarioId && FORMAL_DECISION_SCENE_CATALOG_V3[forcedScenarioId]) {
    const sourceEvent = sourceEvents.find((event) => (
      isFormalDecisionMomentEligibleV3(forcedScenarioId, runtimeMoment, event, session)
    ))
    if (!sourceEvent) return null
    const scenario = DECISION_LIBRARY.find((candidate) => candidate.id === forcedScenarioId)
    return scenario ? { scenario, sourceEvent } : null
  }
  if (forcedScenarioId) return null
  const minuteCap = session.extraTime ? 120 : 90
  const eligible = DECISION_LIBRARY.flatMap((scenario) => {
    if (session.usedScenarioIds.includes(scenario.id)) return []
    if (PRIORITY_CHANNEL_SCENARIO_IDS.has(scenario.id)) return []
    const [minimum, maximum] = scenario.minute_range || [1, 90]
    if (session.minute < minimum || session.minute > Math.min(minuteCap, maximum)) return []
    const sourceEvent = sourceEvents.find((event) => (
      isFormalDecisionMomentEligibleV3(scenario.id, runtimeMoment, event, session)
    ))
    return sourceEvent ? [{ scenario, sourceEvent }] : []
  })
  if (!eligible.length) return null
  const random = options.random || Math.random
  const weights = eligible.map((entry) => DECISION_SCENARIO_RARITY_WEIGHTS[entry.scenario.id] || 1)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = random() * totalWeight
  for (let index = 0; index < eligible.length; index += 1) {
    roll -= weights[index]
    if (roll <= 0) return eligible[index]
  }
  return eligible[eligible.length - 1]
}

function findEligibleScenario(session, runtimeMoment, sourceEvent, scenarioIds, options = {}) {
  const eligible = []
  const minuteCap = session.extraTime ? 120 : 90
  for (const scenarioId of scenarioIds) {
    if (!options.allowRepeat && session.usedScenarioIds.includes(scenarioId)) continue
    const scenario = DECISION_LIBRARY.find((candidate) => candidate.id === scenarioId)
    if (!scenario) continue
    const [minimum, maximum] = scenario.minute_range || [1, 90]
    if (session.minute < minimum || session.minute > Math.min(minuteCap, maximum)) continue
    if (isFormalDecisionMomentEligibleV3(scenarioId, runtimeMoment, sourceEvent, session)) {
      eligible.push({ scenario, sourceEvent, priority: true })
    }
  }
  if (!eligible.length) return null
  // 同组候选里随机取一个，而不是永远取列表第一个（避免啄序垄断）
  const random = options.random || Math.random
  return eligible[Math.min(eligible.length - 1, Math.floor(random() * eligible.length))]
}

/**
 * High-value moments choose their authored scene before the general 53-scene pool.
 * This keeps the decision causally attached to the field event instead of merely
 * finding any catalog entry which happens to be eligible on the same frame.
 */
export function selectPriorityFormalDecisionScenario(session, runtimeMoment, sourceEvents, options = {}) {
  for (const sourceEvent of sourceEvents) {
    if (sourceEvent.type === 'corner') {
      const selected = findEligibleScenario(
        session,
        runtimeMoment,
        sourceEvent,
        sourceEvent.side === 'red'
          ? ['late_keeper_up_corner', 'header_corner']
          : ['aerial_duel_corner_defending', 'opponent_short_corner_defense'],
        options,
      )
      if (selected) return selected
    }
    if (sourceEvent.type === 'penalty') {
      const selected = findEligibleScenario(
        session,
        runtimeMoment,
        sourceEvent,
        sourceEvent.detail?.awardedSide === 'red'
          ? ['penalty_kick', 'match_penalty']
          : ['opponent_dangerous_freekick_wall'],
        { ...options, allowRepeat: true },
      )
      if (selected) return selected
    }
    // 真实伤病与点球同理：稀有且必须立即处理，不受采纳率与上限限制
    if (sourceEvent.type === 'injury') {
      const selected = findEligibleScenario(
        session,
        runtimeMoment,
        sourceEvent,
        ['injury_play_on'],
        options,
      )
      if (selected) return selected
    }
  }

  const progress = getRuntimeAttackProgressV3(runtimeMoment)
  if (progress < 0.72) return null
  const liveEvents = sourceEvents.filter((event) => (
    ['touch', 'pass', 'possession-change', 'tackle-contact'].includes(event.type)
  ))
  for (const sourceEvent of liveEvents) {
    if (runtimeMoment.attackingSide === 'red') {
      const wide = runtimeMoment.ball.normalized[1] <= 0.32
        || runtimeMoment.ball.normalized[1] >= 0.68
      const selected = findEligibleScenario(
        session,
        runtimeMoment,
        sourceEvent,
        wide
          ? ['penalty_area_cross', 'wing_overlap_cross', 'central_cutback_press', 'solo_run_penalty']
          : ['solo_run_penalty', 'through_ball_chance'],
        options,
      )
      if (selected) return selected
    }
    if (runtimeMoment.attackingSide === 'blue') {
      const selected = findEligibleScenario(
        session,
        runtimeMoment,
        sourceEvent,
        ['penalty_area_foul_risk', 'gk_one_on_one', 'last_defender_tackle'],
        options,
      )
      if (selected) return selected
    }
  }
  return null
}

function actorLabel(actorSource, runtimeActorId, fallback = '球员') {
  const actor = actorForRuntimeId(actorSource, runtimeActorId)
  return actor ? `${actor.teamName || (actor.side === 'red' ? '本方' : '对方')}${actor.number}号${actor.name}` : fallback
}

function commentaryForRuntimeEvent(session, event, actorSource) {
  const actor = actorLabel(actorSource, event.primaryRuntimeActorId)
  const sideName = event.side === 'blue' ? session.opponentName : session.teamName
  const ballX = Number(event.ball?.after?.[0] ?? 0.5)
  const attackingThird = event.side === 'blue' ? ballX < 0.32 : ballX > 0.68
  // Highlighting is semantic, not a synonym for "important". The bright strip is
  // reserved for coach-decision consequences and actionable player-state alerts.
  // Ordinary match facts (including a routine VAR check) keep the normal backdrop.
  const eventTone = event.detail?.decision === true ? 'highlight' : 'standard'
  const saveText = event.detail?.saveKind === 'held'
    ? `${actor}完成扑救并稳稳控制住皮球。`
    : `${actor}把这次真实射门扑出危险区域。`
  const lines = {
    shot: { type: 'shot', tone: 'standard', text: `${actor}完成射门，足球正在飞向球门。` },
    save: { type: 'save', tone: 'standard', text: saveText },
    'post-hit': { type: 'post-hit', tone: 'standard', text: '足球击中门柱，皮球仍在运动，等待最终结果。' },
    'crossbar-hit': { type: 'crossbar-hit', tone: 'standard', text: '足球重重砸在横梁上，皮球仍在运动，等待最终结果。' },
    corner: { type: 'corner', tone: 'standard', text: `${sideName}赢得角球，双方开始争抢禁区落点。` },
    'throw-in': { type: 'throw-in', text: `${sideName}获得界外球，球员已经在边线外准备手抛球。` },
    'goal-kick': { type: 'goal-kick', text: `${sideName}获得门球，门将从后场重新组织。` },
    'tackle-contact': { type: 'tackle-contact', tone: 'standard', text: `${actor}与对手发生真实身体接触，足球仍在当前区域。` },
    kickoff: {
      type: 'kickoff',
      tone: 'standard',
      text: event.detail?.firstKickoff
        ? `${sideName}在中圈开球，比赛正式开始。`
        : `${sideName}在中圈开球，比赛继续。`,
    },
    'period-change': {
      type: 'period-change',
      tone: 'standard',
      text: event.detail?.period === 'stoppage-time'
        ? `${event.detail?.half === 4
          ? '加时赛下半场'
          : event.detail?.half === 3
            ? '加时赛上半场'
            : event.detail?.half === 2
              ? '下半场'
              : '上半场'}补时 ${Number(event.detail?.addedMinutes || 1)} 分钟。`
        : event.detail?.period === 'half-time'
          ? event.detail?.extraTime
            ? '加时赛上半场结束。双方交换场地，加时赛下半场将从中圈重新开球。'
            : '上半场结束。双方交换场地，下半场将从中圈重新开球。'
          : '全场比赛时间结束，裁判准备吹响终场哨。',
    },
    'throw-in-violation': { type: 'throw-in-violation', tone: 'standard', text: `${actor}手抛球犯规，裁判依据这次真实界外球交换球权。` },
    foul: { type: 'foul', tone: 'standard', text: `${actor}在这次真实接触中犯规，裁判鸣哨判罚。` },
    card: {
      type: 'card',
      tone: eventTone,
      text: event.detail?.secondYellow
        ? `${actor}吃到本场第二张黄牌，两黄变一红被罚下。`
        : `${actor}因刚才的犯规被出示${event.detail?.color === 'red' ? '红牌' : '黄牌'}。`,
    },
    injury: { type: 'injury', tone: eventTone, text: `${actor}在刚才的对抗后倒地，队医正在观察伤情。` },
    penalty: {
      type: 'penalty',
      tone: eventTone,
      text: `${event.detail?.awardedSide === 'blue' ? session.opponentName : session.teamName}获得点球，裁判指向点球点，比赛将进入点球处理。`,
    },
    offside: { type: 'offside', tone: 'standard', text: `${actor}在进攻传球时越位，进球或推进无效。` },
    'handball-review': { type: 'handball-review', tone: eventTone, text: '射门击中防守球员，裁判正在核对是否手球。' },
    'var-review': { type: 'var-review', tone: eventTone, text: 'VAR 正在复核刚才的真实进球过程。' },
    'var-result': {
      type: 'var-result',
      tone: eventTone,
      text: event.detail?.reviewType === 'penalty'
        ? event.detail?.outcome === 'penalty-awarded'
          ? 'VAR 复核结束：犯规发生在禁区内，裁判判罚点球。'
          : 'VAR 复核结束：没有点球，比赛按场上状态继续。'
        : event.detail?.outcome === 'valid'
        ? 'VAR 复核结束：进球有效，比分成立。'
        : event.detail?.reason === 'offside'
          ? 'VAR 复核结束：进攻球员越位在先，进球无效。'
          : 'VAR 复核结束：进攻犯规在先，进球无效。',
    },
  }
  if (event.type === 'possession-change') {
    return {
      type: 'possession-change',
      tone: 'standard',
      text: attackingThird
        ? `${actor}在前场夺回球权，立刻形成推进机会。`
        : `${actor}完成球权转换，${sideName}开始组织下一次推进。`,
    }
  }
  return lines[event.type] || null
}

function applyRuntimeEvents(session, runtimeEvents, actorSource, options = {}) {
  let next = cloneSession(session)
  const accepted = []
  const sourceBoundEvents = options.deriveIncidents === false
    ? [...(runtimeEvents || [])]
    : (runtimeEvents || []).flatMap((event) => [
      event,
      ...deriveFormalRuntimeIncidents(event),
    ])
  for (const event of sourceBoundEvents) {
    if (!event?.id || next.processedRuntimeEventIds.includes(event.id)) continue
    next.processedRuntimeEventIds.push(event.id)
    next.processedRuntimeEventIds = next.processedRuntimeEventIds.slice(-600)
    accepted.push(event)
    const side = event.side === 'blue' ? 'blue' : 'red'
    if (event.type === 'shot') next = applyStatsDelta(next, side, { shots: 1 })
    if (event.type === 'save') next = applyStatsDelta(next, side, { saves: 1 })
    if (event.type === 'corner') next = applyStatsDelta(next, side, { corners: 1 })
    if (event.type === 'foul') next = applyStatsDelta(next, side, { fouls: 1 })
    if (event.type === 'offside') next = applyStatsDelta(next, side, { offsides: 1 })
    if (event.type === 'var-result' && event.detail?.outcome === 'disallowed') {
      if (event.detail?.decision === true) next.pendingGoalDecision = null
      if (event.detail?.reason === 'offside') {
        next = applyStatsDelta(next, event.detail?.scoringSide || side, { offsides: 1 })
      }
      if (
        next.lastRuntimeGoal?.runtimeEventId === event.sourceEventId
        && next.lastRuntimeGoal?.disallowed !== true
      ) {
        const scoringSide = event.detail?.scoringSide === 'blue' ? 'blue' : 'red'
        next.score[scoringSide] = Math.max(0, next.score[scoringSide] - 1)
        next.nativeRuntimeScore[scoringSide] = Math.max(
          0,
          next.nativeRuntimeScore[scoringSide] - 1,
        )
        next.lastRuntimeGoal = { ...next.lastRuntimeGoal, disallowed: true }
      }
    }
    if (event.type === 'card') {
      const actorId = event.primaryRuntimeActorId
      const previous = actorId
        ? next.disciplineByRuntimeActorId[actorId] || { yellowCards: 0, redCard: false }
        : { yellowCards: 0, redCard: false }
      if (event.detail?.color === 'red') {
        if (actorId) next.disciplineByRuntimeActorId[actorId] = { ...previous, redCard: true }
        next = applyStatsDelta(next, side, { redCards: 1 })
      } else {
        const yellowCards = Math.min(2, Number(previous.yellowCards || 0) + 1)
        const secondYellow = yellowCards >= 2 && !previous.redCard
        if (actorId) {
          next.disciplineByRuntimeActorId[actorId] = {
            yellowCards,
            redCard: previous.redCard || secondYellow,
          }
        }
        if (secondYellow) event.detail = { ...event.detail, secondYellow: true, dismissed: true }
        next = applyStatsDelta(next, side, secondYellow
          ? { yellowCards: 1, redCards: 1 }
          : { yellowCards: 1 })
      }
    }
    if (event.type === 'penalty') {
      next = applyStatsDelta(next, event.detail?.awardedSide || (side === 'red' ? 'blue' : 'red'), {
        penalties: 1,
      })
    }
    if (event.type === 'pass') {
      const side = event.side === 'blue' ? 'blue' : 'red'
      next.passChain[side] = Number(next.passChain[side] || 0) + 1
      next.passChain[side === 'red' ? 'blue' : 'red'] = 0
      if (next.passChain[side] >= 3 && event.minute - Number(next.lastRoutineCommentaryMinute ?? -9) >= 9) {
        const actor = actorLabel(actorSource, event.primaryRuntimeActorId)
        if (next.routineCommentaryCount >= FORMAL_MATCH_ROUTINE_COMMENTARY_BUDGET) continue
        next = appendEvent(next, {
          eventId: event.id,
          sourceEventId: event.id,
          minute: event.minute,
          type: 'pass-chain',
          text: `${actor}完成这一段连续传递，${side === 'red' ? session.teamName : session.opponentName}保持球权并向前推进。`,
          routine: true,
        })
        next.lastRoutineCommentaryMinute = event.minute
        next.passChain[side] = 0
      }
      continue
    }
    if (event.type === 'possession-change') {
      next.passChain = { red: 0, blue: 0 }
      if (event.minute - Number(next.lastPossessionCommentaryMinute ?? -10) < 10) continue
      next.lastPossessionCommentaryMinute = event.minute
    }
    if (event.type === 'tackle-contact') {
      if (event.minute - Number(next.lastContactCommentaryMinute ?? -12) < 12) continue
      next.lastContactCommentaryMinute = event.minute
    }
    if (event.type === 'kickoff') {
      const mergeIndex = next.commentary.findLastIndex((line, index) => (
        index >= next.commentary.length - 4
        && ['runtime-goal', 'period-change'].includes(line.type)
        && !line.followupSourceEventId
        && Number(event.minute) - Number(line.minute) <= 2
      ))
      if (mergeIndex >= 0) {
        const previous = next.commentary[mergeIndex]
        const sideName = event.side === 'blue' ? next.opponentName : next.teamName
        const sourceEventIds = Array.from(new Set([
          ...(previous.sourceEventIds || [previous.sourceEventId]).filter(Boolean),
          event.id,
        ]))
        const merged = {
          ...previous,
          sourceEventIds,
          followupSourceEventId: event.id,
          text: `${previous.text} 随后${sideName}在中圈开球，比赛继续。`,
        }
        next.commentary = next.commentary.map((line, index) => (index === mergeIndex ? merged : line))
        next.incidents = next.incidents.map((line) => (line.id === merged.id ? merged : line))
        continue
      }
    }
    if (event.type === 'goal-kick') {
      const mergeIndex = next.commentary.findLastIndex((line, index) => (
        index >= next.commentary.length - 4
        && line.type === 'shot'
        && !line.restartSourceEventId
        && Number(event.minute) - Number(line.minute) <= 2
      ))
      if (mergeIndex >= 0) {
        const previous = next.commentary[mergeIndex]
        const sideName = event.side === 'blue' ? next.opponentName : next.teamName
        const merged = {
          ...previous,
          sourceEventIds: Array.from(new Set([
            ...(previous.sourceEventIds || [previous.sourceEventId]).filter(Boolean),
            event.id,
          ])),
          restartSourceEventId: event.id,
          text: `${previous.text} 足球随后出界，${sideName}获得门球并从后场重新组织。`,
        }
        next.commentary = next.commentary.map((line, index) => (index === mergeIndex ? merged : line))
        next.incidents = next.incidents.map((line) => (line.id === merged.id ? merged : line))
        continue
      }
    }
    if (['touch', 'ball-out', 'goal'].includes(event.type)) continue
    const line = commentaryForRuntimeEvent(next, event, actorSource)
    if (!line) continue
    if (event.type === 'shot') {
      const previous = next.commentary.at(-1)
      if (previous?.type === 'shot' && Number(event.minute) - Number(previous.minute) <= 3) {
        const sideName = event.side === 'blue' ? next.opponentName : next.teamName
        const actor = actorLabel(actorSource, event.primaryRuntimeActorId)
        const merged = {
          ...previous,
          minute: event.minute,
          eventCount: Number(previous.eventCount || 1) + 1,
          sourceEventIds: Array.from(new Set([
            ...(previous.sourceEventIds || [previous.sourceEventId]).filter(Boolean),
            event.id,
          ])),
          followupSourceEventId: event.id,
          text: `${sideName}形成连续${Number(previous.eventCount || 1) + 1}次攻门，最新一次由${actor}完成，足球正在飞向球门。`,
        }
        next.commentary = [...next.commentary.slice(0, -1), merged]
        next.incidents = next.incidents.map((item) => (item.id === merged.id ? merged : item))
        continue
      }
    }
    const routine = ['possession-change', 'tackle-contact'].includes(event.type)
    if (routine && next.routineCommentaryCount >= FORMAL_MATCH_ROUTINE_COMMENTARY_BUDGET) continue
    next = appendEvent(next, {
      ...line,
      eventId: event.id,
      sourceEventId: event.sourceEventId || event.id,
      minute: event.minute,
      routine,
    })
  }
  return { session: next, accepted }
}

export function createFormalMatchSession(options = {}) {
  const teamName = options.teamName || '本方'
  const opponentName = options.opponentName || '对方'
  return {
    schemaVersion: FORMAL_MATCH_SESSION_SCHEMA,
    matchId: options.matchId || `formal-${Date.now()}`,
    status: 'ready',
    phase: 'pregame',
    minute: 0,
    realtimeMinutes: Number(options.realtimeMinutes) || FORMAL_MATCH_REALTIME_MINUTES,
    teamId: options.teamId || 'france',
    opponentTeamId: options.opponentTeamId || 'brazil',
    teamName,
    opponentName,
    score: { red: 0, blue: 0 },
    nativeRuntimeScore: { red: 0, blue: 0 },
    stats: { red: emptySideStats(), blue: emptySideStats() },
    runtime: {
      possession: { red: 50, blue: 50 },
      shots: { red: 0, blue: 0 },
      passes: { red: 0, blue: 0 },
    },
    commentary: [],
    incidents: [],
    decisions: [],
    usedScenarioIds: [],
    processedRuntimeEventIds: [],
    passChain: { red: 0, blue: 0 },
    disciplineByRuntimeActorId: {},
    playerAlertKeys: [],
    routineCommentaryCount: 0,
    targetDecisionCount: FORMAL_MATCH_TARGET_DECISIONS,
    nextDecisionSlot: 0,
    priorityDecisionCount: 0,
    extraTime: false,
    extraTimeDecisionUsed: false,
    pendingDecisionId: null,
    pendingDecisionSourceEvent: null,
    pendingGoalDecision: null,
    lastRuntimeGoal: null,
    lastRoutineCommentaryMinute: -9,
    lastPossessionCommentaryMinute: -10,
    lastContactCommentaryMinute: -12,
    lastDecisionMinute: -20,
    opportunityAttempts: 0,
    lastRuntimeState: null,
    eventSequence: 0,
    completedAt: null,
  }
}

export function appendFormalActorStateAlerts(session, actorSource) {
  let next = cloneSession(session)
  for (const actor of actorSource?.actors || []) {
    if (
      !actor?.runtimeActorId
      || actor.state?.onPitch !== true
      || actor.state?.substitutedOut
      || actor.state?.redCard
    ) continue
    const name = `${actor.teamName || (actor.side === 'blue' ? next.opponentName : next.teamName)}`
      + `${actor.number}号${actor.name}`
    if (actor.state?.injured === true) {
      const key = `${actor.runtimeActorId}:injured-unavailable`
      if (!next.playerAlertKeys.includes(key)) {
        next.playerAlertKeys.push(key)
        next = appendEvent(next, {
          eventId: key,
          sourceEventId: key,
          minute: next.minute,
          type: 'player-unavailable',
          tone: 'highlight',
          text: `${name}受伤，已经无法坚持比赛，请尽快调整。`,
        })
      }
    }
    const stamina = Number(actor.state?.stamina)
    if (Number.isFinite(stamina) && stamina <= 25) {
      const key = `${actor.runtimeActorId}:severe-fatigue`
      if (!next.playerAlertKeys.includes(key)) {
        next.playerAlertKeys.push(key)
        next = appendEvent(next, {
          eventId: key,
          sourceEventId: key,
          minute: next.minute,
          type: 'player-fatigue',
          tone: 'highlight',
          text: `${name}当前体力降至 ${Math.round(stamina)}，已进入严重疲劳状态。`,
        })
      }
    }
  }
  return next
}

export function startFormalMatchSession(session) {
  if (session.status !== 'ready') return session
  return { ...session, status: 'running', phase: 'live' }
}

// 90 分钟战平进入加时赛：extraTime 标志置位，比赛继续到 120 分钟。
// 不复用 session.phase（决策流会把 phase 改回 live，会冲掉加时状态）
export function startFormalExtraTime(session) {
  if (!['running', 'decision'].includes(session.status)) return session
  if (session.extraTime) return session
  const next = cloneSession(session)
  next.status = 'running'
  next.phase = 'live'
  next.extraTime = true
  return next
}

export function advanceFormalMatchSession(session, payload = {}) {
  if (!['running', 'decision'].includes(session.status)) {
    return { session, decisionPlan: null }
  }
  const snapshot = payload.snapshot || {}
  const runtimeMoment = payload.runtimeMoment
  let next = cloneSession(session)
  next.minute = Math.max(next.minute, Math.min(120, Number(snapshot.minute) || 0))
  next.runtime = {
    possession: {
      red: Number(snapshot.red?.possession ?? next.runtime.possession.red),
      blue: Number(snapshot.blue?.possession ?? next.runtime.possession.blue),
    },
    shots: {
      red: Number(snapshot.red?.shots || 0),
      blue: Number(snapshot.blue?.shots || 0),
    },
    passes: {
      red: Number(snapshot.red?.passes || 0),
      blue: Number(snapshot.blue?.passes || 0),
    },
  }
  const appliedEvents = applyRuntimeEvents(
    next,
    payload.runtimeEvents || [],
    payload.actorSource,
    { deriveIncidents: payload.deriveRuntimeIncidents !== false },
  )
  next = appendFormalActorStateAlerts(appliedEvents.session, payload.actorSource)
  next.lastRuntimeState = runtimeMoment?.runtimeState || next.lastRuntimeState

  if (next.status !== 'running' || !runtimeMoment) {
    return { session: next, decisionPlan: null }
  }
  if (payload.decisionsEnabled === false) {
    // 点球/伤病事件不能丢失：当决策 UI 尚未回到 idle 时，暂存到 session 等下一轮拾取
    const mandatoryEvent = (appliedEvents.accepted || []).find((ev) => (
      ['penalty', 'injury'].includes(ev.type)
    ))
    if (mandatoryEvent && !next.pendingPrioritySourceEvent) {
      next.pendingPrioritySourceEvent = mandatoryEvent
    }
    return { session: next, decisionPlan: null }
  }
  const sourceEvents = appliedEvents.accepted
  // 拾取上一轮因 decisionsEnabled=false 而暂存的点球/伤病事件
  if (next.pendingPrioritySourceEvent) {
    const pending = next.pendingPrioritySourceEvent
    next.pendingPrioritySourceEvent = null
    if (!sourceEvents.some((ev) => ev.id === pending.id)) {
      sourceEvents.unshift(pending)
    }
  }
  if (!sourceEvents.length) return { session: next, decisionPlan: null }
  const targetMinute = FORMAL_MATCH_DECISION_TARGET_MINUTES[next.nextDecisionSlot]
  let priorityCandidate = payload.forcedScenarioIds?.[next.nextDecisionSlot]
    ? null
    : selectPriorityFormalDecisionScenario(next, runtimeMoment, sourceEvents, {
      random: payload.random,
    })
  // 非点球/伤病优先决策达到每场上限后，把机会让给大池（点球、真实伤病与补时门将上抢例外：不可吞没）
  const mandatoryPriority = ['penalty', 'injury'].includes(priorityCandidate?.sourceEvent?.type)
    || priorityCandidate?.scenario?.id === 'late_keeper_up_corner'
  if (
    priorityCandidate
    && !mandatoryPriority
    && Number(next.priorityDecisionCount || 0) >= FORMAL_MATCH_PRIORITY_DECISION_CAP
  ) {
    priorityCandidate = null
  }
  // 真正的点球/伤病不能因概率被吞掉；其余优先场景按类别采纳率与大池竞争，保证场景多元
  const priorityTakeRate = priorityCandidate?.sourceEvent?.type === 'corner'
    ? FORMAL_PRIORITY_DECISION_TAKE_RATE.corner
    : priorityCandidate?.sourceEvent?.type === 'penalty'
      ? FORMAL_PRIORITY_DECISION_TAKE_RATE.penalty
      : FORMAL_PRIORITY_DECISION_TAKE_RATE.default
  const prioritySelected = priorityCandidate && (
    mandatoryPriority
    || (payload.random || Math.random)() < priorityTakeRate
  )
    ? priorityCandidate
    : null
  // A genuine penalty or injury cannot disappear merely because the planned
  // coaching windows have already been used. It may add one exceptional
  // staged decision; other opportunities still respect the normal budget.
  // 加时赛：115 分钟后仍平局，强制补一个"点球大战布置"决策
  const extraTimePrepForced = Boolean(
    next.extraTime
    && next.minute >= 115
    && next.score.red === next.score.blue
    && !next.usedScenarioIds.includes('extra_time_penalty_shootout_prep')
  )
  const extraTimeSlotOpen = Boolean(next.extraTime && next.minute >= 112 && !next.extraTimeDecisionUsed)
  if (
    targetMinute == null
    && !extraTimeSlotOpen
    && !['penalty', 'injury'].includes(prioritySelected?.sourceEvent?.type)
    && prioritySelected?.scenario?.id !== 'late_keeper_up_corner'
  ) {
    return { session: next, decisionPlan: null }
  }
  if (!prioritySelected && next.minute < targetMinute) {
    return { session: next, decisionPlan: null }
  }
  let selected = prioritySelected
  if (!selected && extraTimePrepForced && sourceEvents.length) {
    selected = findEligibleScenario(
      next,
      runtimeMoment,
      sourceEvents[0],
      ['extra_time_penalty_shootout_prep'],
      { random: payload.random },
    )
  }
  if (!selected) {
    selected = selectDecisionScenario(next, runtimeMoment, sourceEvents, payload)
  }
  if (!selected) return { session: next, decisionPlan: null }
  next.opportunityAttempts += 1
  const chance = prioritySelected || extraTimePrepForced || payload.forcedScenarioIds?.[next.nextDecisionSlot]
    ? 1
    : Math.min(1, Number(payload.naturalDecisionChance ?? (0.65 + next.opportunityAttempts * 0.18)))
  const random = payload.random || Math.random
  if (random() > chance) return { session: next, decisionPlan: null }
  const { scenario, sourceEvent } = selected
  const owner = actorForRuntimeId(payload.actorSource, runtimeMoment.ownerRuntimeActorId)
  const sceneContract = FORMAL_DECISION_SCENE_CATALOG_V3[scenario.id]
  const preferredPlayerId = sceneContract?.primaryRole === 'homeGoalkeeper'
    ? redGoalkeeperPlayerId(payload.actorSource)
    : owner?.side === 'red' && !owner.isGoalkeeper
      ? owner.playerId
      : nearestRedPlayerId(payload.actorSource, runtimeMoment)
  const sequenceIndex = next.nextDecisionSlot
  const decisionId = `${next.matchId}.decision.${sequenceIndex + 1}.${scenario.id}`
  next.status = 'decision'
  next.phase = 'staging'
  next.pendingDecisionId = decisionId
  next.pendingDecisionSourceEvent = sourceEvent
  next.nextDecisionSlot += 1
  next.lastDecisionMinute = next.minute
  next.opportunityAttempts = 0
  next.usedScenarioIds.push(scenario.id)
  if (extraTimeSlotOpen) next.extraTimeDecisionUsed = true
  if (prioritySelected && !['penalty', 'injury'].includes(sourceEvent?.type)) {
    next.priorityDecisionCount = Number(next.priorityDecisionCount || 0) + 1
  }

  return {
    session: next,
    decisionPlan: {
      id: decisionId,
      scenarioId: scenario.id,
      minute: next.minute,
      label: scenario.trigger,
      sequenceIndex,
      preferredPlayerId,
      sourceEvent,
    },
  }
}

export function settleFormalDecisionInSession(session, decision, resolution) {
  if (session.pendingDecisionId == null || session.status !== 'decision') return session
  let next = cloneSession(session)
  const result = resolution.result || {}
  next = applyStatsDelta(next, 'red', resolution.authorityDeltas?.statsDelta)
  next = applyStatsDelta(next, 'blue', resolution.authorityDeltas?.opponentStatsDelta)
  const record = {
    id: session.pendingDecisionId,
    minute: session.minute,
    scenarioId: decision.coachDecisionEvent.sourceScenarioId,
    choiceId: resolution.choice.id,
    choiceLabel: resolution.choice.label,
    situation: decision.situation || decision.coachDecisionEvent?.situation || decision.label,
    outcome: result.outcome,
    resultText: resolution.resultText,
    isSuccess: Boolean(result.isSuccess),
    coachDecisionEvent: decision.coachDecisionEvent,
    sourceEventId: session.pendingDecisionSourceEvent?.id || null,
    riskLevel: resolution.choice.riskLevel || resolution.choice.risk || null,
    replayTags: resolution.choice.replayTags || [],
    postMatchReviewTag: resolution.choice.postMatchReviewTag || null,
    requiresRuntimeGoal: Boolean(resolution.requiresRuntimeGoal),
  }
  next.decisions.push(record)
  if (resolution.requiresRuntimeGoal) {
    next.pendingGoalDecision = {
      id: record.id,
      side: Number(result.awayScoreChange || 0) > 0 ? 'blue' : 'red',
      sourceEventId: record.sourceEventId,
      resultText: resolution.resultText,
      scenarioId: record.scenarioId,
    }
  } else {
    next = appendEvent(next, {
      eventId: record.id,
      sourceEventId: record.sourceEventId,
      minute: session.minute,
      type: 'decision-result',
      tone: 'highlight',
      text: resolution.resultText,
    })
  }
  next.status = 'running'
  next.phase = 'live'
  next.pendingDecisionId = null
  next.pendingDecisionSourceEvent = null
  return next
}

export function abortFormalDecisionInSession(session) {
  if (session.status !== 'decision' || !session.pendingDecisionId) return session
  const next = cloneSession(session)
  next.status = 'running'
  next.phase = 'live'
  next.pendingDecisionId = null
  next.pendingDecisionSourceEvent = null
  next.nextDecisionSlot = Math.max(0, next.nextDecisionSlot - 1)
  next.usedScenarioIds = next.usedScenarioIds.slice(0, -1)
  return next
}

export function recordFormalRuntimeGoal(session, detail = {}, runtimeMoment, actorSource) {
  if (!['running', 'decision'].includes(session.status)) return session
  const score = Array.isArray(detail.score) ? detail.score : [0, 0]
  const nativeRed = Number(score[0] || 0)
  const nativeBlue = Number(score[1] || 0)
  const goalTimestamp = Number(detail.timestamp || Date.now())
  const shotEventId = detail.shotEventId || null
  const runtimeEventId = detail.runtimeEventId || null
  const lastRuntimeGoal = session.lastRuntimeGoal
  const elapsedSinceLastGoal = goalTimestamp - Number(lastRuntimeGoal?.timestamp || 0)
  const duplicateGoal = Boolean(
    lastRuntimeGoal
    && (
      (runtimeEventId && runtimeEventId === lastRuntimeGoal.runtimeEventId)
      || (
        shotEventId
        && shotEventId === lastRuntimeGoal.shotEventId
        && elapsedSinceLastGoal >= 0
        && elapsedSinceLastGoal < 2500
      )
    )
  )
  if (duplicateGoal) return session
  const redDelta = Math.max(0, nativeRed - session.nativeRuntimeScore.red)
  const blueDelta = Math.max(0, nativeBlue - session.nativeRuntimeScore.blue)
  if (!redDelta && !blueDelta) return session
  let next = cloneSession(session)
  next.nativeRuntimeScore = { red: nativeRed, blue: nativeBlue }
  next.lastRuntimeGoal = {
    timestamp: goalTimestamp,
    shotEventId,
    runtimeEventId,
    disallowed: false,
  }
  next.score.red += redDelta
  next.score.blue += blueDelta
  const side = redDelta ? 'red' : 'blue'
  const scorer = scorerLabel(session, side, detail, actorSource)
  const pendingDecision = next.pendingGoalDecision?.side === side
    ? next.pendingGoalDecision
    : null
  if (pendingDecision) next.pendingGoalDecision = null
  const goalDelta = side === 'red' ? redDelta : blueDelta
  const keeperTouchText = detail.keeperTouch
    ? '门将碰到皮球，但没能阻止它入网。'
    : ''
  next = applyStatsDelta(next, side, { shots: goalDelta, shotsOnTarget: goalDelta })
  next = appendEvent(next, {
    eventId: detail.runtimeEventId || null,
    sourceEventId: detail.runtimeEventId || null,
    minute: session.minute,
    type: 'runtime-goal',
    tone: pendingDecision ? 'highlight' : 'standard',
    text: pendingDecision
      ? `${pendingDecision.resultText}${keeperTouchText} 比分更新为 ${next.score.red}:${next.score.blue}。`
      : `${keeperTouchText || '球已越过门线！'}${scorer}完成破门，比分更新为 ${next.score.red}:${next.score.blue}。`,
  })
  return next
}

export function recordFormalSubstitution(session, outgoing, incoming) {
  return appendEvent(session, {
    minute: session.minute,
    type: 'substitution',
    text: `换人调整：${incoming.name}替下${outgoing.name}，Runtime 场上身份已同步。`,
  })
}

export function finalizeFormalMatchSession(
  session,
  completedAt = new Date().toISOString(),
  sourceEventId = null,
) {
  if (session.status === 'ended') return session
  const finalMinute = Math.max(90, Math.min(120, Math.round(Number(session.minute) || 90)))
  const finished = appendEvent({
    ...session,
    status: 'ended',
    phase: 'full-time',
    minute: finalMinute,
    completedAt,
  }, {
    eventId: sourceEventId,
    sourceEventId,
    minute: finalMinute,
    type: 'full-time',
    tone: 'live',
    text: `终场哨响，全场比分 ${session.score.red}:${session.score.blue}。`,
  })
  return finished
}

function mergedStats(session, side) {
  const authored = session.stats[side]
  const runtimeShots = session.runtime.shots[side]
  const runtimePasses = session.runtime.passes[side]
  return {
    ...authored,
    shots: Math.max(authored.shots, runtimeShots),
    shotsOnTarget: Math.min(
      Math.max(authored.shots, runtimeShots),
      Math.max(authored.shotsOnTarget, Math.round(runtimeShots * 0.56)),
    ),
    passesAttempted: Math.max(authored.passesAttempted, runtimePasses),
    passesCompleted: Math.max(authored.passesCompleted, Math.round(runtimePasses * 0.82)),
  }
}

export function buildFormalMatchSessionReport(session) {
  const red = mergedStats(session, 'red')
  const blue = mergedStats(session, 'blue')
  const result = session.score.red > session.score.blue
    ? 'win'
    : session.score.red < session.score.blue ? 'loss' : 'draw'
  return {
    schemaVersion: FORMAL_MATCH_SESSION_SCHEMA,
    matchId: session.matchId,
    completedAt: session.completedAt,
    homeScore: session.score.red,
    awayScore: session.score.blue,
    teamName: session.teamName,
    opponent: session.opponentName,
    result,
    durationRealtimeMinutes: session.realtimeMinutes,
    decisionCount: session.decisions.length,
    decisions: session.decisions,
    incidents: session.incidents,
    commentary: session.commentary,
    stats: {
      myShots: red.shots,
      oppShots: blue.shots,
      myShotsOnTarget: red.shotsOnTarget,
      oppShotsOnTarget: blue.shotsOnTarget,
      myXG: Number((red.shots * 0.14 + session.score.red * 0.32).toFixed(2)),
      oppXG: Number((blue.shots * 0.14 + session.score.blue * 0.32).toFixed(2)),
      possession: session.runtime.possession.red,
      fouls: red.fouls,
      yellowCards: red.yellowCards,
      redCards: red.redCards,
      penalties: red.penalties,
      corners: red.corners,
    },
    sides: { red, blue },
    balanceTargets: FORMAL_MATCH_BALANCE_TARGETS,
  }
}
