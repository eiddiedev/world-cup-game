import {
  FORMAL_DECISION_SCENE_CATALOG_V3,
  FORMAL_OUTCOME_TERMINALS_V3,
  getFormalDecisionSceneContractV3,
} from './formalDecisionSceneCatalogV3.js'

export const DECISION_SCENE_SCRIPT_V3_SCHEMA = 'decision-scene-script-v3'
export const DECISION_DIRECTOR_V3_PHASES = Object.freeze([
  'idle', 'staging', 'choosing', 'executing', 'settled', 'restoring',
])
const BALL_ONLY_TERMINALS = new Set([
  'goal-for', 'goal-against', 'away-goalkeeper', 'home-goalkeeper',
])
const TACKLE_DUEL_INTENTS = new Set([
  'slide-contact',
  'last-man-tackle',
  'shot-block',
  'tactical-contact',
  'touchline-slide',
])
// 空中传球意图：这类传球的攻门收尾是争顶（跳起），不是脚踢
const AERIAL_PASS_INTENTS = new Set([
  'cross-high',
  'corner-near',
  'corner-far',
  'dink-far-post',
  'throw-long',
  'free-kick-cross',
  'keeper-long',
  'switch-wide',
])
// spine 动画表没有 pass，所有踢摆类出球统一用 shoot；
// 界外球用原生 throw；不存在的动画会被播放层静默跳过，必须只用表内动画
const SPINE_SAFE_ACTIONS = new Set([
  'shoot', 'slide', 'dribble', 'sprint', 'idle', 'waving',
  'jump', 'hands_in_front', 'throw', 'run', 'fall_forward',
])
const WON_DUEL_TERMINALS = new Set(['blocker', 'opponent-transition'])
// 吊射类意图的出球仰角（弧度），其余按低平球处理
const LIVE_SHOT_ELEVATION_BY_INTENT = Object.freeze({
  'chip-goalkeeper': 0.55,
  'penalty-panenka': 0.55,
  'free-kick-near': 0.32,
  'opponent-free-kick': 0.3,
})
const LIVE_SHOT_TERMINALS = new Set([
  'goal-for', 'goal-against', 'away-goalkeeper', 'home-goalkeeper', 'out',
])

function ballActionAnimation(affordance) {
  if (affordance?.intent === 'throw-long') return 'throw'
  return 'shoot'
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0))
}

function actorPositionMap(runtimeMoment) {
  return new Map((runtimeMoment?.actorPositions || []).map((entry) => [
    entry.runtimeActorId,
    entry.normalized,
  ]))
}

function activeActors(actorSource, side) {
  return (actorSource?.actors || []).filter((actor) => (
    actor.side === side && actor.state?.onPitch
  ))
}

function nearestActor(actors, positions, point, excluded = new Set()) {
  return actors
    .filter((actor) => !excluded.has(actor.runtimeActorId))
    .map((actor) => ({ actor, point: positions.get(actor.runtimeActorId) }))
    .filter((entry) => Array.isArray(entry.point))
    .sort((left, right) => (
      Math.hypot(left.point[0] - point[0], left.point[1] - point[1])
      - Math.hypot(right.point[0] - point[0], right.point[1] - point[1])
    ))[0]?.actor || null
}

function actorReference(actor, role) {
  if (!actor) throw new Error(`DecisionSceneScriptV3 缺少 ${role} actor`)
  return {
    role,
    playerId: actor.playerId,
    runtimeActorId: actor.runtimeActorId,
    name: actor.name,
    number: actor.number,
    side: actor.side,
  }
}

function point3(point, z = 0) {
  return [clamp(point?.[0]), clamp(point?.[1]), Number(point?.[2] ?? z)]
}

function curve(origin, target, height = 0.28, bend = 0) {
  const dx = target[0] - origin[0]
  const dy = target[1] - origin[1]
  const perpendicularX = -dy * bend
  const perpendicularY = dx * bend
  return [
    point3(origin),
    [clamp(origin[0] + dx * 0.34 + perpendicularX), clamp(origin[1] + dy * 0.34 + perpendicularY), height],
    [clamp(origin[0] + dx * 0.72 + perpendicularX), clamp(origin[1] + dy * 0.72 + perpendicularY), Math.max(height, Number(target[2] || 0))],
    point3(target),
  ]
}

// 球速按飞行距离推算：射门约 0.24 归一化/秒（≈25m/s），传球约 0.15（≈16m/s），
// 贝塞尔路径近似取直线 1.1 倍，避免远射和短传一个速度
function flightDurationMs(from, to, kind) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) * 1.1
  const speed = kind === 'shot' ? 0.24 : 0.15
  return clamp(
    Math.round((length / speed) * 1000 / 40) * 40,
    kind === 'shot' ? 640 : 760,
    kind === 'shot' ? 1500 : 2400,
  )
}

// 原生踢球计划：把剧本瞄点换算成引擎物理单位（场地 35×22.667，质量 1，滚动摩擦 5，重力 9.81）。
// 低平球用摩擦公式反推出球力量（到达门线仍保留目标速度）；
// 吊射用抛体公式（与引擎 Lob 状态同源）：power = sqrt(dist * g / sin(2θ))。
const PITCH_WORLD_WIDTH = 35
const PITCH_WORLD_HEIGHT = 22.6667
const BALL_GROUND_FRICTION = 5
const BALL_GRAVITY = 9.81

function buildLiveShotPlan({ path, terminal, intent, shooterRuntimeActorId, keeperRuntimeActorId, origin }) {
  const aim = point3(path.at(-1))
  const dx = (aim[0] - origin[0]) * PITCH_WORLD_WIDTH
  const dy = (aim[1] - origin[1]) * PITCH_WORLD_HEIGHT
  const dist = Math.max(0.5, Math.hypot(dx, dy))
  const elevate = LIVE_SHOT_ELEVATION_BY_INTENT[intent]
    ?? (aim[2] >= 0.5 ? 0.35 : 0.07)
  const arrivalSpeed = ['goal-for', 'goal-against'].includes(terminal)
    ? 7.5
    : ['home-goalkeeper', 'away-goalkeeper'].includes(terminal) ? 3.2 : 7
  const power = elevate >= 0.2
    ? Math.sqrt(dist * BALL_GRAVITY / Math.sin(2 * elevate))
    : Math.sqrt(arrivalSpeed * arrivalSpeed + 2 * BALL_GROUND_FRICTION * dist)
  return {
    shooterRuntimeActorId,
    keeperRuntimeActorId,
    terminal,
    aim,
    elevate,
    power: Number(power.toFixed(2)),
    maxFlightMs: clamp(Math.round(dist / 4 * 1000) + 1200, 1800, 3200),
  }
}

function buildRoles(decision, actorSource, runtimeMoment) {
  const red = activeActors(actorSource, 'red')
  const blue = activeActors(actorSource, 'blue')
  const all = [...red, ...blue]
  const positions = actorPositionMap(runtimeMoment)
  const origin = runtimeMoment.ball.normalized
  const attackDirection = Number(runtimeMoment.attackDirection)
    || (runtimeMoment.attackingSide === 'blue' ? -1 : 1)
  const homeAttackDirection = runtimeMoment.attackingSide === 'blue'
    ? -attackDirection
    : attackDirection
  const owner = all.find((actor) => actor.runtimeActorId === runtimeMoment.ownerRuntimeActorId)
  const requested = red.find((actor) => (
    actor.playerId === decision?.coachDecisionEvent?.keyPlayers?.primary?.id
  ))
  const primary = requested || nearestActor(red.filter((actor) => !actor.isGoalkeeper), positions, origin) || red[0]
  // 接应者必须是真正站在接应区域（持球人斜后方、靠近弧顶一侧）的球员，
  // 而不是紧挨持球人的队友，否则"回传弧顶"会把球交给并不在弧顶的人
  const supportZone = [
    clamp(origin[0] - homeAttackDirection * 0.09),
    clamp(0.5 + (origin[1] - 0.5) * 0.5),
  ]
  const support = nearestActor(red.filter((actor) => !actor.isGoalkeeper), positions, supportZone, new Set([primary.runtimeActorId])) || red.filter((actor) => !actor.isGoalkeeper && actor !== primary)[0] || red[1]
  const opponent = owner?.side === 'blue'
    ? owner
    : nearestActor(blue.filter((actor) => !actor.isGoalkeeper), positions, origin) || blue[1]
  const blocker = nearestActor(blue.filter((actor) => !actor.isGoalkeeper), positions, origin) || opponent
  const homeGoalkeeper = red.find((actor) => actor.isGoalkeeper) || red[0]
  const awayGoalkeeper = blue.find((actor) => actor.isGoalkeeper) || blue[0]
  const homeAttackGoal = homeAttackDirection < 0 ? [0.008, 0.5] : [0.992, 0.5]
  const awayAttackGoal = homeAttackDirection < 0 ? [0.992, 0.5] : [0.008, 0.5]
  const aerialTarget = nearestActor(
    red.filter((actor) => !actor.isGoalkeeper),
    positions,
    homeAttackGoal,
    new Set([primary.runtimeActorId]),
  ) || support
  const awaySupportZone = [
    clamp(origin[0] + homeAttackDirection * 0.09),
    clamp(0.5 + (origin[1] - 0.5) * 0.5),
  ]
  const awaySupport = nearestActor(
    blue.filter((actor) => !actor.isGoalkeeper),
    positions,
    awaySupportZone,
    new Set([opponent.runtimeActorId]),
  ) || blue.find((actor) => !actor.isGoalkeeper && actor !== opponent) || opponent
  const awayAerialTarget = nearestActor(
    blue.filter((actor) => !actor.isGoalkeeper),
    positions,
    awayAttackGoal,
    new Set([opponent.runtimeActorId]),
  ) || awaySupport
  const setPieceTaker = runtimeMoment.attackingSide === 'blue' ? opponent : primary
  const setPieceTarget = runtimeMoment.attackingSide === 'blue' ? awayAerialTarget : aerialTarget
  const setPieceCandidates = runtimeMoment.attackingSide === 'blue' ? blue : red
  const setPieceShortSupport = nearestActor(
    setPieceCandidates.filter((actor) => !actor.isGoalkeeper),
    positions,
    origin,
    new Set([setPieceTaker.runtimeActorId, setPieceTarget.runtimeActorId]),
  ) || (runtimeMoment.attackingSide === 'blue' ? awaySupport : support)
  const setPieceDefender = runtimeMoment.attackingSide === 'blue' ? primary : blocker
  const captain = red.find((actor) => !actor.isGoalkeeper) || primary
  return {
    positions,
    groups: {
      homeOutfield: red.filter((actor) => !actor.isGoalkeeper),
      awayOutfield: blue.filter((actor) => !actor.isGoalkeeper),
    },
    raw: {
      primary, support, opponent, blocker, homeGoalkeeper, awayGoalkeeper,
      aerialTarget, awaySupport, awayAerialTarget, setPieceTaker,
      setPieceTarget, setPieceShortSupport, setPieceDefender, captain, owner,
    },
    actors: {
      primary: actorReference(primary, 'primary'),
      support: actorReference(support, 'support'),
      opponent: actorReference(opponent, 'opponent'),
      blocker: actorReference(blocker, 'blocker'),
      homeGoalkeeper: actorReference(homeGoalkeeper, 'homeGoalkeeper'),
      awayGoalkeeper: actorReference(awayGoalkeeper, 'awayGoalkeeper'),
      aerialTarget: actorReference(aerialTarget, 'aerialTarget'),
      awaySupport: actorReference(awaySupport, 'awaySupport'),
      awayAerialTarget: actorReference(awayAerialTarget, 'awayAerialTarget'),
      setPieceTaker: actorReference(setPieceTaker, 'setPieceTaker'),
      setPieceTarget: actorReference(setPieceTarget, 'setPieceTarget'),
      setPieceShortSupport: actorReference(setPieceShortSupport, 'setPieceShortSupport'),
      setPieceDefender: actorReference(setPieceDefender, 'setPieceDefender'),
      captain: actorReference(captain, 'captain'),
    },
  }
}

function geometryContext(runtimeMoment, roles) {
  const origin = point3(runtimeMoment.ball.normalized)
  const attackDirection = Number(runtimeMoment.attackDirection)
    || (runtimeMoment.attackingSide === 'blue' ? -1 : 1)
  const homeDirection = runtimeMoment.attackingSide === 'blue' ? -attackDirection : attackDirection
  const awayDirection = -homeDirection
  const homeAttackGoalX = homeDirection > 0 ? 1 : 0
  const homeDefendGoalX = homeDirection > 0 ? 0 : 1
  const homeAttackGoalLineX = homeDirection > 0 ? 0.995 : 0.005
  const homeDefendGoalLineX = homeDirection > 0 ? 0.005 : 0.995
  const goalX = runtimeMoment.attackingSide === 'blue' ? homeDefendGoalLineX : homeAttackGoalLineX
  const ownGoalX = runtimeMoment.attackingSide === 'blue' ? homeAttackGoalLineX : homeDefendGoalLineX
  // 真实门柱归一化区间为 [0.4353, 0.5647]（GOAL_WIDTH 2.9333 / PITCH_HEIGHT 22.667），
  // 瞄点必须收在柱内，否则球会打在门柱外或门框外。
  const nearY = origin[1] < 0.5 ? 0.455 : 0.545
  const farY = origin[1] < 0.5 ? 0.545 : 0.455
  const actorPoint = (role, fallback) => point3(
    roles.positions.get(roles.actors[role]?.runtimeActorId) || fallback,
  )
  const homeSupport = actorPoint('support', [clamp(origin[0] - homeDirection * 0.09), clamp(0.5 + (origin[1] - 0.5) * 0.5)])
  const awaySupport = actorPoint('awaySupport', [clamp(origin[0] - awayDirection * 0.09), clamp(0.5 + (origin[1] - 0.5) * 0.5)])
  const homeAerial = actorPoint('aerialTarget', [clamp(homeAttackGoalX - homeDirection * 0.07), farY])
  const awayAerial = actorPoint('awayAerialTarget', [clamp(homeDefendGoalX - awayDirection * 0.07), farY])
  const goalTargetX = runtimeMoment.attackingSide === 'blue' ? homeDefendGoalX : homeAttackGoalX
  const context = {
    origin,
    attackingSide: runtimeMoment.attackingSide,
    direction: attackDirection,
    goal: [goalX, 0.5, 0.16],
    ownGoal: [ownGoalX, 0.5, 0.16],
    homeDirection,
    awayDirection,
    homeAttackGoal: [homeAttackGoalX, 0.5, 0.16],
    homeDefendGoal: [homeDefendGoalX, 0.5, 0.16],
    nearPost: [goalTargetX, nearY, 0.16],
    farPost: [goalTargetX, farY, 0.16],
    support: runtimeMoment.attackingSide === 'blue' ? awaySupport : homeSupport,
    homeSupport,
    awaySupport,
    opponent: actorPoint('opponent', [clamp(origin[0] + attackDirection * 0.04), origin[1]]),
    blocker: actorPoint('blocker', [clamp(origin[0] + attackDirection * 0.05), origin[1]]),
    aerial: runtimeMoment.attackingSide === 'blue' ? awayAerial : homeAerial,
    homeAerial,
    awayAerial,
    homeGoalkeeper: actorPoint('homeGoalkeeper', [homeDefendGoalLineX, 0.5]),
    awayGoalkeeper: actorPoint('awayGoalkeeper', [homeAttackGoalLineX, 0.5]),
    primary: actorPoint('primary', origin),
    setPieceTaker: actorPoint('setPieceTaker', origin),
    setPieceTarget: actorPoint('setPieceTarget', runtimeMoment.attackingSide === 'blue' ? awayAerial : homeAerial),
    setPieceShortSupport: actorPoint('setPieceShortSupport', runtimeMoment.attackingSide === 'blue' ? awaySupport : homeSupport),
    captain: actorPoint('captain', origin),
  }
  return context
}

function contextForBallSide(context, side) {
  if (!['home', 'away'].includes(side)) {
    throw new Error(`DecisionSceneScriptV3 ball-path 缺少明确 side：${side || 'unknown'}`)
  }
  const direction = side === 'home' ? context.homeDirection : context.awayDirection
  const goal = side === 'home' ? context.homeAttackGoal : context.homeDefendGoal
  const ownGoal = side === 'home' ? context.homeDefendGoal : context.homeAttackGoal
  const support = side === 'home' ? context.homeSupport : context.awaySupport
  const aerial = side === 'home' ? context.homeAerial : context.awayAerial
  const nearY = context.origin[1] < 0.5 ? 0.455 : 0.545
  const farY = context.origin[1] < 0.5 ? 0.545 : 0.455
  return {
    ...context,
    direction,
    goal,
    ownGoal,
    support,
    aerial,
    nearPost: [goal[0], nearY, 0.16],
    farPost: [goal[0], farY, 0.16],
  }
}

const BALL_INTENTS = Object.freeze({
  'shoot-near-post': ['nearPost', 0.28, 0.04],
  'shoot-far-post': ['farPost', 0.34, -0.04],
  'chip-goalkeeper': ['goal', 1.15, 0],
  'pass-support': ['support', 0.12, 0],
  'cross-low': ['aerial', 0.22, 0.03],
  'cross-high': ['aerial', 1.25, -0.03],
  cutback: ['support', 0.16, -0.04],
  'one-two': ['support', 0.16, 0.04],
  'switch-wide': ['aerial', 0.58, 0.08],
  'free-kick-near': ['nearPost', 1.02, 0.05],
  'free-kick-cross': ['aerial', 1.35, -0.05],
  'penalty-power': ['goal', 0.28, 0],
  'penalty-placement': ['farPost', 0.18, 0],
  'penalty-panenka': ['goal', 1.12, 0],
  'penalty-left': ['leftGoal', 0.2, 0],
  'penalty-right': ['rightGoal', 0.2, 0],
  'penalty-center': ['goal', 0.25, 0],
  'corner-near': ['nearPost', 1.1, 0.04],
  'corner-far': ['farPost', 1.35, -0.04],
  'through-run': ['aerialLead', 0.18, 0],
  'one-two-shot': ['nearPost', 0.42, 0.04],
  'recycle-midfield': ['recycle', 0.12, 0],
  'dink-far-post': ['farPost', 1.08, -0.04],
  'throw-long': ['aerial', 0.95, 0],
  'keeper-short': ['support', 0.12, 0],
  'keeper-long': ['aerialLead', 1.05, 0.04],
  'first-touch-forward': ['forward', 0.12, 0],
  'clearance-wide': ['clearance', 0.75, 0.08],
  'counter-release': ['aerialLead', 0.7, -0.04],
  'pass-overlap': ['support', 0.16, 0],
  'volley-goal': ['farPost', 0.32, 0],
  'opponent-shot': ['goal', 0.3, 0],
  'opponent-cross': ['aerial', 1.05, 0.03],
  'opponent-through': ['goal', 0.12, 0],
  'opponent-free-kick': ['goal', 1.02, 0.04],
})

const BALL_RUNTIME_EVENT_TYPES = Object.freeze({
  'shoot-near-post': 'shot',
  'shoot-far-post': 'shot',
  'chip-goalkeeper': 'shot',
  'pass-support': 'pass',
  'cross-low': 'pass',
  'cross-high': 'pass',
  cutback: 'pass',
  'one-two': 'pass',
  'switch-wide': 'pass',
  'free-kick-near': 'shot',
  'free-kick-cross': 'pass',
  'penalty-power': 'shot',
  'penalty-placement': 'shot',
  'penalty-panenka': 'shot',
  'penalty-left': 'shot',
  'penalty-right': 'shot',
  'penalty-center': 'shot',
  'corner-near': 'pass',
  'corner-far': 'pass',
  'through-run': 'pass',
  'one-two-shot': 'shot',
  'recycle-midfield': 'pass',
  'dink-far-post': 'pass',
  'throw-long': 'pass',
  'keeper-short': 'pass',
  'keeper-long': 'pass',
  'first-touch-forward': 'pass',
  'clearance-wide': 'pass',
  'counter-release': 'pass',
  'pass-overlap': 'pass',
  'volley-goal': 'shot',
  'opponent-shot': 'shot',
  'opponent-cross': 'pass',
  'opponent-through': 'pass',
  'opponent-free-kick': 'shot',
})

function ballTarget(key, context) {
  if (key === 'leftGoal') return [context.goal[0], 0.455, 0.16]
  if (key === 'rightGoal') return [context.goal[0], 0.545, 0.16]
  if (key === 'aerialLead') return [
    clamp(context.aerial[0] + context.direction * 0.045),
    context.aerial[1],
    0.12,
  ]
  if (key === 'recycle') return [
    clamp(context.origin[0] - context.direction * 0.12),
    clamp(context.origin[1] + (context.origin[1] < 0.5 ? 0.12 : -0.12)),
    0,
  ]
  if (key === 'forward') return [
    clamp(context.origin[0] + context.direction * 0.11),
    context.origin[1],
    0,
  ]
  if (key === 'clearance') return [
    clamp(context.origin[0] + context.direction * 0.24),
    context.origin[1] < 0.5 ? 0.04 : 0.96,
    0.5,
  ]
  return context[key]
}

const RUN_INTENTS = Object.freeze({
  'carry-goal': 'goal',
  'support-overlap': 'support-forward',
  'wide-overlap': 'wide-forward',
  'carry-forward': 'forward',
  'show-touchline': 'touchline',
  'carry-to-corner': 'opponent-touchline',
  'keeper-rush': 'origin',
  'press-carrier': 'opponent',
  'recovery-run': 'opponent-inside',
  'support-run': 'aerialLead',
  'keeper-claim': 'origin',
  'cut-inside': 'inside-forward',
  'track-runner': 'opponent-forward',
  'keeper-shift': 'goal-shift',
  'press-short-corner': 'origin',
  'rebound-run': 'origin',
  'shadow-pass-lane': 'support',
  'keeper-to-box': 'aerial',
})

function runTarget(key, context) {
  if (key === 'goal') return [clamp(context.goal[0] - context.direction * 0.08), context.goal[1], 0]
  if (key === 'support-forward') return [clamp(context.support[0] + context.direction * 0.1), context.support[1], 0]
  if (key === 'wide-forward') return [clamp(context.support[0] + context.direction * 0.12), context.support[1] < 0.5 ? 0.08 : 0.92, 0]
  if (key === 'forward') return [clamp(context.primary[0] + context.direction * 0.12), context.primary[1], 0]
  if (key === 'touchline') return [clamp(context.primary[0] + context.direction * 0.06), context.origin[1] < 0.5 ? 0.04 : 0.96, 0]
  if (key === 'opponent-touchline') return [
    clamp(context.opponent[0] + context.direction * 0.07),
    context.origin[1] < 0.5 ? 0.025 : 0.975,
    0,
  ]
  if (key === 'origin') return context.origin
  if (key === 'opponent') return context.opponent
  if (key === 'opponent-inside') return [context.opponent[0], clamp(0.5 + (context.opponent[1] - 0.5) * 0.55), 0]
  if (key === 'aerialLead') return [clamp(context.aerial[0] + context.direction * 0.05), context.aerial[1], 0]
  if (key === 'inside-forward') return [clamp(context.primary[0] + context.direction * 0.1), clamp(0.5 + (context.primary[1] - 0.5) * 0.45), 0]
  if (key === 'opponent-forward') return [clamp(context.opponent[0] + context.direction * 0.06), context.opponent[1], 0]
  if (key === 'goal-shift') return [context.ownGoal[0], context.origin[1] < 0.5 ? 0.46 : 0.54, 0]
  if (key === 'support') return context.support
  if (key === 'aerial') return context.aerial
  return context.origin
}

const ACTOR_ROLE_BY_INTENT = Object.freeze({
  'scorer-calm': 'primary',
  'captain-referee': 'captain',
  'keeper-hold': 'homeGoalkeeper',
  'shield-turn': 'primary',
  'defender-explain': 'primary',
  'team-appeal': 'captain',
  'substitution-out': 'primary',
  'fatigued-player': 'primary',
  'injured-player': 'primary',
  'captain-calm-team': 'captain',
  'throw-feint': 'primary',
})

const ZONE_CENTER_BY_INTENT = Object.freeze({
  'hold-possession': 'origin',
  'contain-channel': 'opponent',
  'press-trap': 'opponent',
  'six-yard-zone': 'ownGoal',
  'keeper-line': 'ownGoal',
  'block-angle': 'opponent',
  'goal-line-block': 'ownGoal',
  'sideline-trap': 'opponent',
  'rebound-cutback': 'support',
})

function formationPoints(intent, context) {
  const d = context.direction
  const x = clamp(context.origin[0] - d * 0.06)
  const lines = {
    'mid-block': [[x, 0.22, 0], [x, 0.5, 0], [x, 0.78, 0]],
    'step-offside-line': [[clamp(context.opponent[0] - d * 0.03), 0.18, 0], [clamp(context.opponent[0] - d * 0.03), 0.82, 0]],
    'all-out-attack': [[clamp(x + d * 0.16), 0.2, 0], [clamp(x + d * 0.22), 0.5, 0], [clamp(x + d * 0.16), 0.8, 0]],
    'structured-pressure': [[clamp(x + d * 0.1), 0.24, 0], [clamp(x + d * 0.14), 0.5, 0], [clamp(x + d * 0.1), 0.76, 0]],
    'hold-shape': [[x, 0.2, 0], [x, 0.5, 0], [x, 0.8, 0]],
    'possession-shell': [[x, 0.28, 0], [clamp(x - d * 0.08), 0.5, 0], [x, 0.72, 0]],
    'continued-press': [[clamp(x + d * 0.12), 0.22, 0], [clamp(x + d * 0.18), 0.5, 0], [clamp(x + d * 0.12), 0.78, 0]],
    'last-attack': [[clamp(x + d * 0.2), 0.2, 0], [clamp(x + d * 0.24), 0.5, 0], [clamp(x + d * 0.2), 0.8, 0]],
    'penalty-conserve': [[clamp(x - d * 0.04), 0.22, 0], [clamp(x - d * 0.08), 0.5, 0], [clamp(x - d * 0.04), 0.78, 0]],
    'restart-shape': [[x, 0.22, 0], [x, 0.5, 0], [x, 0.78, 0]],
    'offside-review-line': [[context.opponent[0], 0.14, 0], [context.opponent[0], 0.86, 0]],
    'tall-wall': [[clamp(context.origin[0] - d * 0.05), 0.42, 0], [clamp(context.origin[0] - d * 0.05), 0.58, 0]],
    'wall-jump': [[clamp(context.origin[0] - d * 0.05), 0.4, 0], [clamp(context.origin[0] - d * 0.05), 0.6, 0]],
    'short-triangle': [context.primary, context.support, [clamp(context.origin[0] - d * 0.07), clamp(context.origin[1] - 0.1), 0], context.primary],
  }
  const points = lines[intent]
  if (!points) throw new Error(`DecisionSceneScriptV3 缺少 formation intent：${intent}`)
  return points.map((point) => point3(point))
}

function resolveAffordance(definition, context, roles) {
  if (definition.kind === 'ball-path') {
    const spec = BALL_INTENTS[definition.intent]
    if (!spec) throw new Error(`DecisionSceneScriptV3 缺少 ball intent：${definition.intent}`)
    const runtimeEventType = BALL_RUNTIME_EVENT_TYPES[definition.intent]
    if (!runtimeEventType) throw new Error(`DecisionSceneScriptV3 缺少 ball event：${definition.intent}`)
    const ballContext = contextForBallSide(context, definition.side)
    if (!roles.actors[definition.role]) {
      throw new Error(`DecisionSceneScriptV3 ball-path 缺少执行角色：${definition.role || 'unknown'}`)
    }
    const explicitActorPoint = definition.targetRole
      ? roles.positions.get(roles.actors[definition.targetRole]?.runtimeActorId)
      : null
    const explicitStartActorPoint = definition.startRole
      ? roles.positions.get(roles.actors[definition.startRole]?.runtimeActorId)
      : null
    const explicitTarget = definition.targetRole
      ? ballContext[definition.targetRole]
        || (Array.isArray(explicitActorPoint) ? point3(explicitActorPoint) : null)
      : null
    if (definition.targetRole && !Array.isArray(explicitTarget)) {
      throw new Error(`DecisionSceneScriptV3 ball-path 缺少目标角色：${definition.targetRole}`)
    }
    if (definition.startRole && !Array.isArray(explicitStartActorPoint)) {
      throw new Error(`DecisionSceneScriptV3 ball-path 缺少起点角色：${definition.startRole}`)
    }
    return {
      ...definition,
      runtimeEventType,
      points: curve(
        explicitStartActorPoint || context.origin,
        explicitTarget || ballTarget(spec[0], ballContext),
        spec[1],
        spec[2],
      ),
    }
  }
  if (definition.kind === 'run-lane') {
    const targetKey = RUN_INTENTS[definition.intent]
    if (!targetKey) throw new Error(`DecisionSceneScriptV3 缺少 run intent：${definition.intent}`)
    const role = definition.role
    if (!roles.actors[role]) throw new Error(`DecisionSceneScriptV3 run-lane 缺少执行角色：${role || 'unknown'}`)
    const start = context[role] || context.primary
    return {
      ...definition,
      role,
      carriesBall: ['carry-goal', 'carry-forward', 'cut-inside', 'carry-to-corner'].includes(definition.intent),
      points: curve(start, runTarget(targetKey, context), 0.04, 0),
    }
  }
  if (definition.kind === 'duel-vector') {
    const role = definition.role || 'primary'
    if (!roles.actors[role]) {
      throw new Error(`DecisionSceneScriptV3 duel-vector 缺少执行角色：${role}`)
    }
    const start = definition.intent === 'mark-aerial-target' || definition.intent === 'mark-far-post'
      ? context[role] || context.primary
      : context[role] || context.primary
    const target = definition.intent === 'mark-aerial-target'
      ? context.aerial
      : definition.intent === 'mark-far-post'
        ? context.farPost
        : context.opponent
    return { ...definition, role, points: [point3(start), point3(target)] }
  }
  if (definition.kind === 'zone') {
    const centerKey = ZONE_CENTER_BY_INTENT[definition.intent]
    if (!centerKey) throw new Error(`DecisionSceneScriptV3 缺少 zone intent：${definition.intent}`)
    const center = context[centerKey]
    return { ...definition, center: point3(center), radius: definition.intent.includes('goal-line') ? [0.055, 0.18] : [0.075, 0.12] }
  }
  if (definition.kind === 'actor') {
    const role = definition.role || ACTOR_ROLE_BY_INTENT[definition.intent]
    if (!role) throw new Error(`DecisionSceneScriptV3 缺少 actor intent：${definition.intent}`)
    return {
      ...definition,
      role,
      runtimeActorId: roles.actors[role].runtimeActorId,
      center: point3(context[role] || context.primary),
      radius: [0.035, 0.06],
    }
  }
  if (definition.kind === 'formation') {
    return { ...definition, points: formationPoints(definition.intent, context) }
  }
  throw new Error(`DecisionSceneScriptV3 不支持 affordance：${definition.kind}`)
}

function curvePoint(points, progress) {
  const t = clamp(progress)
  const u = 1 - t
  return [0, 1, 2].map((axis) => (
    u * u * u * Number(points[0]?.[axis] || 0)
    + 3 * u * u * t * Number(points[1]?.[axis] || 0)
    + 3 * u * t * t * Number(points[2]?.[axis] || 0)
    + t * t * t * Number(points[3]?.[axis] || 0)
  ))
}

function coordinateChoiceAffordances(affordances, context) {
  const ballPath = affordances.find((affordance) => affordance.kind === 'ball-path')
  const keeperRun = affordances.find((affordance) => (
    affordance.kind === 'run-lane'
    && affordance.role === 'homeGoalkeeper'
    && ['keeper-rush', 'keeper-claim'].includes(affordance.intent)
  ))
  if (!ballPath || !keeperRun) return affordances
  const intercept = point3(curvePoint(ballPath.points, 0.46))
  intercept[2] = 0
  keeperRun.points = curve(context.homeGoalkeeper, intercept, 0.035, 0)
  keeperRun.claimPoint = intercept
  ballPath.claimPoint = intercept
  return affordances
}

function labelAnchor(affordances, context) {
  const first = affordances[0]
  if (first.center) return [first.center[0], clamp(first.center[1] + 0.11)]
  const points = first.points || []
  const point = points[Math.max(0, points.length - 2)] || context.origin
  return [clamp(point[0]), clamp(point[1] + (point[1] < 0.55 ? -0.08 : 0.08), 0.07, 0.93)]
}

function outcomeTarget(terminal, context, ballSide, affordances) {
  const coordinatedClaim = affordances.find((affordance) => (
    affordance.role === 'homeGoalkeeper' && Array.isArray(affordance.claimPoint)
  ))?.claimPoint
  if (terminal === 'goal-for' || terminal === 'goal-against') {
    const goal = terminal === 'goal-for' ? context.homeAttackGoal : context.homeDefendGoal
    const finalBallAction = affordances.filter((affordance) => affordance.kind === 'ball-path').at(-1)
    // 直接射门分支沿用该选择自己的瞄点（近/远角、左右侧），不再统一收敛到正中心
    if (finalBallAction?.runtimeEventType === 'shot') {
      return point3(finalBallAction.points.at(-1))
    }
    // 传球收尾攻门：空中球找远离接应者的远门柱，地面球打近门柱
    const receiverY = Number(finalBallAction?.points?.at(-1)?.[1] ?? context.origin[1])
    const aerial = AERIAL_PASS_INTENTS.has(finalBallAction?.intent)
    const aimY = aerial
      ? (receiverY < 0.5 ? 0.545 : 0.455)
      : (receiverY < 0.5 ? 0.455 : 0.545)
    return [goal[0], aimY, aerial ? 0.3 : 0.12]
  }
  if (terminal === 'away-goalkeeper') return context.awayGoalkeeper
  if (terminal === 'home-goalkeeper') return coordinatedClaim || context.homeGoalkeeper
  if (terminal === 'blocker') return ballSide === 'away' ? context.primary : context.blocker
  if (terminal === 'support') return ballSide === 'away' ? context.awaySupport : context.homeSupport
  if (terminal === 'opponent-transition') return ballSide === 'away' ? context.primary : context.opponent
  if (terminal === 'away-corner-out') return [
    context.homeAttackGoal[0] > 0.5 ? 1.02 : -0.02,
    context.origin[1] < 0.5 ? 0.02 : 0.98,
    0.32,
  ]
  if (terminal === 'home-corner-out') return [
    context.homeDefendGoal[0] > 0.5 ? 1.02 : -0.02,
    context.origin[1] < 0.5 ? 0.02 : 0.98,
    0.32,
  ]
  if (terminal === 'out') {
    const direction = ballSide === 'away' ? context.awayDirection : context.homeDirection
    return [direction > 0 ? 1.02 : -0.02, context.origin[1] < 0.5 ? 0.02 : 0.98, 0.7]
  }
  return context.origin
}

function outcomeContinuation(terminal, context, roles, ballSide, affordances = []) {
  const duelRole = affordances.find((affordance) => affordance.kind === 'duel-vector')?.role
  const role = terminal === 'away-goalkeeper'
    ? 'awayGoalkeeper'
    : terminal === 'home-goalkeeper'
      ? 'homeGoalkeeper'
      : terminal === 'blocker'
        ? duelRole || (ballSide === 'away' ? 'primary' : 'blocker')
        : terminal === 'support'
          ? ballSide === 'away' ? 'awaySupport' : 'support'
          : terminal === 'opponent-transition'
            ? ballSide === 'away' ? 'primary' : 'opponent'
            : null
  return role ? {
    type: 'actor-possession',
    role,
    runtimeActorId: roles.actors[role].runtimeActorId,
  } : { type: 'loose-ball', role: null, runtimeActorId: null }
}

function outcomePath(basePath, target, terminal, context, ballSide) {
  if (!basePath) return null
  if (['hold', 'support'].includes(terminal)) return basePath.map((point) => [...point])
  const destination = terminal === 'out'
    ? [
      (ballSide === 'away' ? context.awayDirection : context.homeDirection) > 0 ? 1.02 : -0.02,
      clamp(basePath.at(-1)?.[1] ?? target[1], 0.02, 0.98),
      Math.max(0.28, Number(basePath.at(-1)?.[2] || 0)),
    ]
    : target
  return [
    [...basePath[0]],
    [...basePath[1]],
    [
      clamp(basePath[2][0] * 0.62 + destination[0] * 0.38),
      clamp(basePath[2][1] * 0.62 + destination[1] * 0.38),
      Math.max(Number(basePath[2][2] || 0), Number(destination[2] || 0)),
    ],
    point3(destination),
  ]
}

function receiverRoleForBallAction(ballAction) {
  if (!ballAction) return null
  if (!ballAction.targetRole) {
    throw new Error(`DecisionSceneScriptV3 传球缺少显式接应角色：${ballAction.intent}`)
  }
  return ballAction.targetRole
}

function outcomeActions(affordances, terminal, durationMs, executesBallPath = true) {
  const ballAction = affordances.find((affordance) => (
    affordance.kind === 'ball-path' && affordance.runtimeEventType === 'shot'
  )) || affordances.find((affordance) => affordance.kind === 'ball-path')
  const actions = []
  const add = (atMs, role, animation) => {
    if (actions.some((action) => action.atMs === atMs && action.role === role && action.animation === animation)) return
    actions.push({ atMs, role, animation })
  }
  affordances.forEach((affordance) => {
    if (affordance.kind === 'ball-path') {
      if (!executesBallPath) return
      add(0, affordance.role || 'primary', ballActionAnimation(affordance))
    } else if (affordance.kind === 'duel-vector') {
      add(0, affordance.role || 'primary', 'slide')
    } else if (affordance.kind === 'run-lane') {
      if (!ballAction || affordance.role !== ballAction.role) {
        add(0, affordance.role || 'primary', affordance.carriesBall ? 'dribble' : 'sprint')
      }
    } else if (affordance.kind === 'actor') {
      add(0, affordance.role || 'primary', 'waving')
      if (affordance.intent === 'team-appeal') {
        add(90, 'primary', 'waving')
        add(180, 'support', 'waving')
      }
    } else if (affordance.kind === 'formation') {
      add(0, 'primary', 'sprint')
    } else if (affordance.kind === 'zone') {
      add(0, affordance.intent === 'keeper-line' ? 'homeGoalkeeper' : 'primary', 'idle')
    }
  })
  if (terminal === 'away-goalkeeper') {
    add(Math.round(durationMs * 0.62), 'awayGoalkeeper', 'jump')
    add(Math.round(durationMs * 0.84), 'awayGoalkeeper', 'hands_in_front')
  }
  if (terminal === 'home-goalkeeper') {
    add(Math.round(durationMs * 0.62), 'homeGoalkeeper', 'jump')
    add(Math.round(durationMs * 0.84), 'homeGoalkeeper', 'hands_in_front')
  }
  if (terminal === 'blocker') {
    add(Math.round(durationMs * 0.58), 'blocker', 'jump')
  }
  if (['goal-for', 'goal-against'].includes(terminal) && ballAction?.runtimeEventType === 'pass') {
    const receiverRole = receiverRoleForBallAction(ballAction)
    add(Math.round(durationMs * 0.58), receiverRole, AERIAL_PASS_INTENTS.has(ballAction.intent) ? 'jump' : 'shoot')
  }
  return actions.sort((left, right) => left.atMs - right.atMs)
}

function outcomeCommentaryText(terminal, path, roles, sourceRole, choiceLabel, affordances) {
  if (!path) return `${choiceLabel}已经执行，比赛从当前场上位置继续。`
  const source = roles.actors[sourceRole] || roles.actors.primary
  const sourceName = source?.side === 'blue' ? `对方${source.name}` : source?.name || '球员'
  const ballAction = affordances.find((affordance) => affordance.kind === 'ball-path')
  const isPass = ballAction?.runtimeEventType === 'pass'
  if (terminal === 'home-goalkeeper') {
    return isPass
      ? `${sourceName}送出来球，${roles.actors.homeGoalkeeper.name}及时出击将球控制。`
      : `${sourceName}完成打门，${roles.actors.homeGoalkeeper.name}做出扑救并控制住皮球。`
  }
  if (terminal === 'away-goalkeeper') {
    return isPass
      ? `${sourceName}送出来球，对方门将及时出击将球控制。`
      : `${sourceName}完成打门，对方门将做出扑救并控制住皮球。`
  }
  if (terminal === 'goal-for' || terminal === 'goal-against') {
    return isPass
      ? `${sourceName}送出传球，接应球员完成攻门，足球越过门线。`
      : `${sourceName}完成射门，足球越过门线。`
  }
  if (terminal === 'blocker') return isPass
    ? `${sourceName}送出来球，足球被防守球员封堵。`
    : `${sourceName}完成打门，足球被防守球员封堵。`
  if (terminal === 'out') return `${sourceName}处理来球，足球最终出了边界。`
  if (terminal === 'support') return `${sourceName}把球送到接应队友脚下。`
  if (terminal === 'opponent-transition') return `${sourceName}的处理被对方截下，球权发生转换。`
  return `${sourceName}完成${choiceLabel}，比赛从足球终点继续。`
}

function stageLayout(contract, runtimeMoment, roles, context) {
  if (contract.mode !== 'blackout-stage') return null
  const trigger = contract.triggerId
  const origin = [...context.origin]
  const staged = []
  let stagedWallActorIds = []
  const set = (role, point, facing) => {
    const runtimeActorId = roles.actors[role].runtimeActorId
    const position = {
      runtimeActorId,
      normalized: point3(point).slice(0, 2),
      facing,
    }
    const existing = staged.findIndex((entry) => entry.runtimeActorId === runtimeActorId)
    if (existing >= 0) staged[existing] = position
    else staged.push(position)
  }
  const attackingRight = context.direction > 0
  const towardGoal = attackingRight ? 'right' : 'left'
  const awayFromGoal = attackingRight ? 'left' : 'right'
  if (trigger.includes('penalty') || trigger === 'shootout-round') {
    origin[0] = attackingRight ? 0.885 : 0.115
    origin[1] = 0.5
    set('setPieceTaker', [origin[0] - context.direction * 0.025, 0.5], towardGoal)
    set(runtimeMoment.attackingSide === 'blue' ? 'homeGoalkeeper' : 'awayGoalkeeper', [context.goal[0], 0.5], awayFromGoal)
    set(runtimeMoment.attackingSide === 'blue' ? 'awaySupport' : 'support', [origin[0] - context.direction * 0.16, 0.36], towardGoal)
    set('setPieceDefender', [origin[0] - context.direction * 0.16, 0.64], awayFromGoal)
  } else if (trigger.includes('corner')) {
    origin[0] = attackingRight ? 0.985 : 0.015
    origin[1] = context.origin[1] < 0.5 ? 0.035 : 0.965
    set('setPieceTaker', [origin[0] - context.direction * 0.015, origin[1]], towardGoal)
    set('setPieceTarget', [context.goal[0] - context.direction * 0.065, context.farPost[1]], towardGoal)
    set('support', [context.goal[0] - context.direction * 0.11, context.nearPost[1]], towardGoal)
    set('setPieceDefender', [context.goal[0] - context.direction * 0.075, 0.5], awayFromGoal)
    set('setPieceShortSupport', [origin[0] - context.direction * 0.055, origin[1] < 0.5 ? 0.1 : 0.9], towardGoal)
  } else if (trigger.includes('throw-in')) {
    origin[1] = context.origin[1] < 0.5 ? 0.02 : 0.98
    set('primary', [origin[0], origin[1]], towardGoal)
    set('support', [clamp(origin[0] + context.direction * 0.06), origin[1] < 0.5 ? 0.08 : 0.92], towardGoal)
  } else {
    set('setPieceTaker', [origin[0] - context.direction * 0.018, origin[1]], towardGoal)
    const wallX = clamp(origin[0] + context.direction * 0.08)
    const wallCandidates = runtimeMoment.attackingSide === 'blue'
      ? roles.groups.homeOutfield
      : roles.groups.awayOutfield
    const wallIds = [...wallCandidates]
      .sort((left, right) => {
        const leftPoint = roles.positions.get(left.runtimeActorId) || origin
        const rightPoint = roles.positions.get(right.runtimeActorId) || origin
        return Math.hypot(leftPoint[0] - origin[0], leftPoint[1] - origin[1])
          - Math.hypot(rightPoint[0] - origin[0], rightPoint[1] - origin[1])
      })
      .map((actor) => actor.runtimeActorId)
    stagedWallActorIds = wallIds.slice(0, 4)
    stagedWallActorIds.forEach((runtimeActorId, index) => staged.push({
      runtimeActorId,
      normalized: [wallX, clamp(0.44 + index * 0.04)],
      facing: awayFromGoal,
    }))
    set('setPieceTarget', [context.goal[0] - context.direction * 0.075, context.farPost[1]], towardGoal)
    set(runtimeMoment.attackingSide === 'blue' ? 'awaySupport' : 'support', [context.goal[0] - context.direction * 0.12, context.nearPost[1]], towardGoal)
    set('setPieceShortSupport', [clamp(origin[0] - context.direction * 0.08), clamp(origin[1] + 0.12)], towardGoal)
  }
  return { ball: point3(origin), actorPositions: staged, wallActorIds: stagedWallActorIds }
}

function copyChoice(choice, primaryName, supportName) {
  const interpolate = (value) => String(value || '')
    .replaceAll('{player}', primaryName)
    .replaceAll('{player2}', supportName || primaryName)
  return {
    description: interpolate(choice.desc),
    risk: interpolate(choice.risk),
    reward: interpolate(choice.reward),
    successHint: interpolate(choice.successHint),
  }
}

export function buildFormalDecisionSceneScriptV3(decision, actorSource, runtimeMoment, sourceEvent = null) {
  const scenarioId = decision?.coachDecisionEvent?.sourceScenarioId
  const contract = getFormalDecisionSceneContractV3(scenarioId)
  if (!contract) throw new Error(`正式决策缺少 V3 场景合同：${scenarioId}`)
  if (!runtimeMoment?.ownerRuntimeActorId || (runtimeMoment.actorPositions?.length || 0) < 18) {
    throw new Error(`${scenarioId} 必须来自连续比赛中的真实 Runtime 瞬间`)
  }
  const stagedSideChanges = contract.attackingSide
    && contract.mode === 'blackout-stage'
    && contract.attackingSide !== runtimeMoment.attackingSide
  // blackout-stage 场景强制 attackingSide 时，必须根据球的实际位置推算 attackDirection，
  // 否则 runtime 缓存的方向可能与球位不同步，导致球路射向己方球门。
  // 角球/界外球/点球/点球大战除外：它们的球会被重新摆位，方向由 runtime 或合同提供。
  const isEdgeSetPiece = contract.triggerId?.includes('corner') || contract.triggerId?.includes('throw-in')
  const isPenaltySetPiece = contract.triggerId?.includes('penalty') || contract.triggerId === 'shootout-round'
  const forcedDirection = contract.attackingSide && contract.mode === 'blackout-stage'
    && !isEdgeSetPiece && !isPenaltySetPiece
    ? (Number(runtimeMoment.ball?.normalized?.[0] || 0.5) < 0.5 ? -1 : 1)
    : null
  const sceneMoment = contract.attackingSide && contract.mode === 'blackout-stage'
    ? {
      ...runtimeMoment,
      attackingSide: contract.attackingSide,
      attackDirection: forcedDirection
        || (stagedSideChanges
          ? -Number(runtimeMoment.attackDirection || 1)
          : Number(runtimeMoment.attackDirection || (contract.attackingSide === 'blue' ? -1 : 1))),
    }
    : runtimeMoment
  let roles = buildRoles(decision, actorSource, sceneMoment)
  let context = geometryContext(sceneMoment, roles)
  const staging = stageLayout(contract, sceneMoment, roles, context)
  if (staging) {
    const stagedPositions = new Map(roles.positions)
    staging.actorPositions.forEach((entry) => stagedPositions.set(entry.runtimeActorId, entry.normalized))
    roles = { ...roles, positions: stagedPositions }
    context = geometryContext({
      ...sceneMoment,
      ball: { ...sceneMoment.ball, normalized: staging.ball },
    }, roles)
  }
  const sourceRuntimeActorId = staging
    ? roles.actors.setPieceTaker.runtimeActorId
    : runtimeMoment.ownerRuntimeActorId
  const choices = decision.choices.map((choice) => {
    const definitions = contract.choices[choice.id]
    if (!definitions?.length) throw new Error(`${scenarioId}/${choice.id} 缺少显式 V3 affordance`)
    const affordances = coordinateChoiceAffordances(
      definitions.map((definition) => resolveAffordance(definition, context, roles)),
      context,
    )
    // 如果最后一个 ball-path 的 targetRole 同时有 run-lane，球路终点应跟随跑位终点，
    // 否则球飞向球员原始位置而球员已跑开，球可能被附近的对方门将拿到。
    // 仅修改最后一个 ball-path，避免破坏多段传球链的连续性。
    const runLanes = affordances.filter((a) => a.kind === 'run-lane')
    if (runLanes.length) {
      const ballPaths = affordances.filter((a) => a.kind === 'ball-path')
      const lastBall = ballPaths[ballPaths.length - 1]
      if (lastBall && lastBall.targetRole) {
        const matchingRun = runLanes.find((r) => r.role === lastBall.targetRole)
        if (matchingRun && matchingRun.points?.length === 4) {
          const runEnd = matchingRun.points[3]
          const start = lastBall.points[0]
          const dx = runEnd[0] - start[0]
          const dy = runEnd[1] - start[1]
          lastBall.points[2] = [clamp(start[0] + dx * 0.72), clamp(start[1] + dy * 0.72), Math.max(lastBall.points[2][2], runEnd[2] || 0)]
          lastBall.points[3] = [...runEnd]
        }
      }
    }
    const ballAffordances = affordances.filter((affordance) => affordance.kind === 'ball-path')
    const ballAffordance = ballAffordances[0]
    const runAffordances = affordances.filter((affordance) => affordance.kind === 'run-lane')
    const isShotChoice = ballAffordance?.runtimeEventType === 'shot'
    const carryAffordance = !ballAffordance
      ? runAffordances.find((affordance) => affordance.carriesBall) || null
      : null
    const ballSide = ballAffordance?.side
      || (carryAffordance && roles.actors[carryAffordance.role].side === 'blue' ? 'away' : 'home')
    const choiceSourceRole = ballAffordance?.role || carryAffordance?.role || 'primary'
    const choiceSourceRuntimeActorId = roles.actors[choiceSourceRole].runtimeActorId
    const outcomes = Object.fromEntries((choice.possible_outcomes || []).map((outcomeId) => {
      const terminal = contract.outcomeTerminalOverrides?.[choice.id]?.[outcomeId]
        || FORMAL_OUTCOME_TERMINALS_V3[outcomeId]
      if (!terminal) throw new Error(`${scenarioId}/${choice.id}/${outcomeId} 缺少显式 outcome terminal`)
      const responseContract = contract.outcomeBallResponses?.[choice.id]
      const responseBallAffordance = responseContract?.terminals?.includes(terminal)
        ? resolveAffordance(responseContract.affordance, context, roles)
        : null
      const executionBallAffordance = ballAffordance || responseBallAffordance
      const executionAffordances = responseBallAffordance
        ? [...affordances, responseBallAffordance]
        : affordances
      const outcomeBallSide = executionBallAffordance?.side || ballSide
      const outcomeSourceRole = executionBallAffordance?.role || choiceSourceRole
      const target = outcomeTarget(terminal, context, outcomeBallSide, executionAffordances)
      const ballOnlyOutcome = BALL_ONLY_TERMINALS.has(terminal)
        && (Boolean(executionBallAffordance) || Boolean(carryAffordance))
      const carryThenShot = Boolean(carryAffordance && ballOnlyOutcome)
      const passThenShot = Boolean(
        executionBallAffordance?.runtimeEventType === 'pass'
        && ['goal-for', 'goal-against'].includes(terminal)
      )
      const sequenceBallAffordances = responseBallAffordance
        ? [responseBallAffordance]
        : ballAffordances
      const multiPassThenShot = Boolean(passThenShot && sequenceBallAffordances.length > 1)
      const movesBall = Boolean(executionBallAffordance) || Boolean(carryAffordance) || ballOnlyOutcome
      const carryEnd = carryAffordance?.points?.at(-1)
      // 带球后射门：射门段必须从带球终点发出。若直接沿用响应球路的原始点列，
      // 球会在出球瞬间从持球人初始位置起飞（逼入底线变成原地直接射门）
      // 当带球终点在边线/底线极端位置时，不能直接射门，必须先回传到禁区中央再射
      const carryAtExtreme = carryEnd && (
        carryEnd[1] < 0.12 || carryEnd[1] > 0.88
        || (carryEnd[0] > 0.92 || carryEnd[0] < 0.08)
      )
      const cutbackPoint = carryAtExtreme && ['goal-for', 'goal-against'].includes(terminal)
        ? point3([
          clamp(context.homeAttackGoal[0] - context.homeDirection * 0.12),
          0.5,
          0,
        ])
        : null
      const selectedPath = carryThenShot
        ? (cutbackPoint ? curve(carryEnd, cutbackPoint, 0.12) : curve(carryEnd, target, 0.34))
        : executionBallAffordance?.points
        || carryAffordance?.points
        || (ballOnlyOutcome ? curve(context.origin, target, 0.16) : null)
      const finalPassAffordance = sequenceBallAffordances.at(-1) || executionBallAffordance
      const receivingShooterRole = passThenShot ? receiverRoleForBallAction(finalPassAffordance) : null
      const finalOutcomeSourceRole = receivingShooterRole || outcomeSourceRole
      const outcomeSourceRuntimeActorId = roles.actors[finalOutcomeSourceRole].runtimeActorId
      let receiverPoint = receivingShooterRole
        ? point3(finalPassAffordance.points.at(-1))
        : null
      // 传球后射门起点必须在合理射门距离内：如果接球点距球门太远（进攻进度<0.65），
      // 强制前移到禁区前沿，避免中场超远射破门的不合理表现。
      // 仅对多段传球序列生效（单段传中/回传的接球人已在禁区内）
      if (receiverPoint && ['goal-for', 'goal-against'].includes(terminal)
        && sequenceBallAffordances.length > 1) {
        const goalX = terminal === 'goal-for' ? context.homeAttackGoal[0] : context.homeDefendGoal[0]
        const shotDist = Math.abs(receiverPoint[0] - goalX)
        if (shotDist > 0.35) {
          receiverPoint = point3([
            clamp(goalX - (terminal === 'goal-for' ? context.homeDirection : context.awayDirection) * 0.14),
            clamp(receiverPoint[1], 0.35, 0.65),
            0,
          ])
        }
      }
      const suppressUnrealizedShot = terminal === 'hold'
        && executionBallAffordance?.runtimeEventType === 'shot'
      const passPath = passThenShot
        ? sequenceBallAffordances[0].points
        : null
      // 底线回传射门：path 为回传后的射门段，selectedPath 为回传段
      const cutbackShotPath = cutbackPoint
        ? curve(cutbackPoint, target, terminal.includes('goal') ? 0.3 : 0.2)
        : null
      const path = passThenShot
        ? curve(receiverPoint, target, terminal.includes('goal') ? 0.3 : 0.2)
        : cutbackShotPath
          ? cutbackShotPath
          : movesBall && !suppressUnrealizedShot
            ? outcomePath(selectedPath, target, terminal, context, outcomeBallSide)
            : null
      const tackleAffordance = affordances.find((affordance) => (
        affordance.kind === 'duel-vector' && TACKLE_DUEL_INTENTS.has(affordance.intent)
      ))
      const ownerRole = Object.keys(roles.actors).find((role) => (
        roles.actors[role].runtimeActorId === runtimeMoment.ownerRuntimeActorId
      )) || 'opponent'
      const duelWon = Boolean(tackleAffordance && WON_DUEL_TERMINALS.has(terminal) && !carryAffordance)
      const duelRunDistance = tackleAffordance
        ? Math.hypot(
          tackleAffordance.points[1][0] - tackleAffordance.points[0][0],
          tackleAffordance.points[1][1] - tackleAffordance.points[0][1],
        )
        : 0
      // 对抗时长按铲球者跑动距离推算（冲刺约 0.09 归一化/秒，55% 时发生接触）
      const duelDurationMs = tackleAffordance
        ? clamp(Math.round(duelRunDistance / 0.09 / 0.55) * 50, 900, 2200)
        : null
      const contactMs = tackleAffordance ? Math.round((duelDurationMs || 1200) * 0.55) : null
      // 球速按飞行距离推算：射门约 0.24 归一化/秒，传球约 0.15
      const ballFlightDurationMs = path && executionBallAffordance
        ? flightDurationMs(path[0], path.at(-1), executionBallAffordance.runtimeEventType)
        : null
      // 传球/带球后的收尾射门段同样按距离推算，近距离抢点不再慢速平移
      const passFinishDurationMs = passThenShot
        ? flightDurationMs(receiverPoint, target, 'shot')
        : null
      const carryFinishDurationMs = carryThenShot
        ? (cutbackPoint
          ? flightDurationMs(cutbackPoint, target, 'shot')
          : flightDurationMs(carryEnd, target, 'shot'))
        : null
      const cutbackPassMs = cutbackPoint ? 680 : 0
      const durationMs = carryThenShot || passThenShot
        ? passThenShot
          ? sequenceBallAffordances.length * 760 + passFinishDurationMs
          : 1080 + cutbackPassMs + carryFinishDurationMs
        : duelDurationMs
          || ballFlightDurationMs
          || (terminal === 'hold' ? 1050 : 1320)
      const shotAtMs = carryThenShot
        ? 1080 + cutbackPassMs
        : passThenShot ? sequenceBallAffordances.length * 760 : null
      let pathSegments = passThenShot
        ? (() => {
          const segs = sequenceBallAffordances.map((affordance) => [...affordance.points.map((p) => [...p])])
          // 如果射门起点被钳位，最后一段传球的终点也要对齐到钳位后的位置
          const clampedReceiver = receiverPoint
          const lastSeg = segs[segs.length - 1]
          if (lastSeg && clampedReceiver) {
            const origEnd = finalPassAffordance.points.at(-1)
            if (Math.abs(origEnd[0] - clampedReceiver[0]) > 0.01
              || Math.abs(origEnd[1] - clampedReceiver[1]) > 0.01) {
              lastSeg[3] = [...clampedReceiver]
            }
          }
          segs.push(path)
          return segs
        })()
        : cutbackPoint && carryThenShot
          ? [selectedPath, path]
          : null
      let segmentEndTimes = pathSegments
        ? pathSegments.map((_, index) => {
          if (cutbackPoint && carryThenShot) {
            return index === 0 ? 1080 + cutbackPassMs : durationMs
          }
          return index < pathSegments.length - 1
            ? (index + 1) * 760
            : durationMs
        })
        : null
      let duelReleaseBallAtMs = null
      if (duelWon && !path) {
        // 赢下的对抗：球在接触瞬间从持球人脚下被铲走，停在铲球点前方
        const carrierPoint = point3(
          roles.positions.get(roles.actors[ownerRole]?.runtimeActorId) || context.origin,
        )
        const lungeX = tackleAffordance.points[1][0] - tackleAffordance.points[0][0]
        const lungeY = tackleAffordance.points[1][1] - tackleAffordance.points[0][1]
        const loosePoint = [
          clamp(tackleAffordance.points[1][0] + lungeX * 0.18),
          clamp(tackleAffordance.points[1][1] + lungeY * 0.18),
          0,
        ]
        pathSegments = [curve(context.origin, carrierPoint, 0.02), curve(carrierPoint, loosePoint, 0.04)]
        segmentEndTimes = [contactMs, durationMs]
        duelReleaseBallAtMs = contactMs
      }
      const outcomePathFinal = passThenShot ? path : pathSegments ? pathSegments.at(-1) : path
      const actions = outcomeActions(
        executionAffordances,
        terminal,
        durationMs,
        Boolean(outcomePathFinal) || !executionBallAffordance,
      )
      if (carryThenShot) {
        // 收尾射门动作必须落在带球者身上：runAffordance 优先取非带球跑位，
        // 双跑位场景（如逼入底线）会把射门动作错挂到防守人身上
        actions.push({ atMs: shotAtMs, role: carryAffordance.role || 'primary', animation: 'shoot' })
        actions.sort((left, right) => left.atMs - right.atMs)
      }
      if (passThenShot) {
        for (let index = 1; index < sequenceBallAffordances.length; index += 1) {
          const affordance = sequenceBallAffordances[index]
          const action = actions.find((candidate) => (
            candidate.role === affordance.role
            && candidate.atMs === 0
            && candidate.animation === ballActionAnimation(affordance)
          ))
          if (action) action.atMs = index * 760
        }
        const finishAnimation = AERIAL_PASS_INTENTS.has(finalPassAffordance?.intent) ? 'jump' : 'shoot'
        const genericFinishAt = Math.round(durationMs * 0.58)
        const retained = actions.filter((action) => !(
          action.role === receivingShooterRole
          && action.atMs === genericFinishAt
          && (action.animation === 'shoot' || action.animation === 'jump')
        ))
        retained.push({
          atMs: shotAtMs,
          role: receivingShooterRole,
          animation: finishAnimation,
        })
        actions.splice(0, actions.length, ...retained.sort((left, right) => left.atMs - right.atMs))
      }
      if (tackleAffordance && (
        WON_DUEL_TERMINALS.has(terminal) || /foul|penalty/.test(outcomeId)
      )) {
        // 被铲/被侵犯的持球人在接触瞬间倒地
        actions.push({ atMs: contactMs, role: ownerRole, animation: 'fall_forward' })
        actions.sort((left, right) => left.atMs - right.atMs)
      }
      const actorMotions = runAffordances.filter((affordance) => (
        (!isShotChoice || affordance.role !== ballAffordance?.role)
        && !(ballOnlyOutcome && !carryThenShot
          && roles.actors[affordance.role].runtimeActorId === choiceSourceRuntimeActorId)
      )).map((affordance) => ({
        role: affordance.role,
        runtimeActorId: roles.actors[affordance.role].runtimeActorId,
        points: affordance.points,
        carriesBall: Boolean(affordance.carriesBall),
      }))
      if (tackleAffordance) {
        // 铲球者真实冲向持球人，而不是在原地播铲球动画
        const tacklerRole = tackleAffordance.role || 'primary'
        const tacklerId = roles.actors[tacklerRole].runtimeActorId
        if (!actorMotions.some((motion) => motion.runtimeActorId === tacklerId)) {
          actorMotions.push({
            role: tacklerRole,
            runtimeActorId: tacklerId,
            points: curve(tackleAffordance.points[0], tackleAffordance.points[1], 0.03, 0),
            carriesBall: false,
          })
        }
      }
      const keeperOutcomeRole = ['home-goalkeeper', 'away-goalkeeper'].includes(terminal)
        ? (terminal === 'home-goalkeeper' ? 'homeGoalkeeper' : 'awayGoalkeeper')
        : ['goal-for', 'goal-against'].includes(terminal) && path
          ? (terminal === 'goal-for' ? 'awayGoalkeeper' : 'homeGoalkeeper')
          : null
      if (keeperOutcomeRole && path) {
        // 门将真实移动：扑救奔向球路一侧；被进的球则扑向相反一侧（被晃过）
        const keeperActor = roles.actors[keeperOutcomeRole]
        const keeperId = keeperActor.runtimeActorId
        if (!actorMotions.some((motion) => motion.runtimeActorId === keeperId)) {
          // 门将扑救始终从球门线出发，不使用运行时位置（可能因出击/清道夫而远离球门）
          const keeperGoalLineX = keeperOutcomeRole === 'homeGoalkeeper'
            ? context.homeDefendGoal[0]
            : context.homeAttackGoal[0]
          const keeperPos = [keeperGoalLineX, 0.5, 0]
          const stepOut = keeperGoalLineX > 0.5 ? -0.014 : 0.014
          const aimY = path.at(-1)[1]
          const diveY = ['home-goalkeeper', 'away-goalkeeper'].includes(terminal)
            ? aimY
            : clamp(0.5 + (0.5 - aimY) * 0.7, 0.34, 0.66)
          actorMotions.push({
            role: keeperOutcomeRole,
            runtimeActorId: keeperId,
            points: curve(
              keeperPos,
              [clamp(keeperGoalLineX + stepOut, 0.01, 0.99), clamp(diveY, 0.34, 0.66), 0],
              0.02,
              0,
            ),
            carriesBall: false,
          })
        }
      }
      // semantic-action 决策生成真实跑位：formation/zone/actor/duel 不再原地晃动
      const isSemanticAction = !ballOnlyOutcome && !carryAffordance && !passThenShot
      if (isSemanticAction && actorMotions.length === 0) {
        const formationAffordance = affordances.find((a) => a.kind === 'formation')
        const zoneAffordance = affordances.find((a) => a.kind === 'zone')
        const actorAffordance = affordances.find((a) => a.kind === 'actor')
        const duelAffordance = affordances.find((a) => a.kind === 'duel-vector')
        if (formationAffordance && formationAffordance.points?.length) {
          // 全队向目标阵型点跑位：按最近距离匹配，最多 5 人可见位移
          const homeOutfield = roles.groups.homeOutfield || []
          const targets = formationAffordance.points
          const assigned = new Set()
          const motions = []
          for (const target of targets) {
            let best = null
            let bestDist = Infinity
            for (const actor of homeOutfield) {
              if (assigned.has(actor.runtimeActorId)) continue
              const pos = roles.positions.get(actor.runtimeActorId)
              if (!pos) continue
              const dist = Math.hypot(pos[0] - target[0], pos[1] - target[1])
              if (dist < bestDist) { bestDist = dist; best = actor }
            }
            if (best && bestDist > 0.015) {
              assigned.add(best.runtimeActorId)
              const pos = roles.positions.get(best.runtimeActorId)
              motions.push({
                role: 'primary',
                runtimeActorId: best.runtimeActorId,
                points: curve([pos[0], pos[1], 0], target, 0.03, 0),
                carriesBall: false,
              })
            }
            if (motions.length >= 5) break
          }
          actorMotions.push(...motions)
        } else if (zoneAffordance) {
          // 防守区域：主角 + 最近 2 名队友向区域中心收拢
          const zoneRole = zoneAffordance.intent === 'keeper-line' ? 'homeGoalkeeper' : 'primary'
          const zoneActor = roles.actors[zoneRole]
          // 门将始终使用球门线位置，不使用运行时位置（可能因出击/清道夫而远离球门）
          const zoneActorPos = zoneAffordance.intent === 'keeper-line'
            ? [context.homeDefendGoal[0], 0.5, 0]
            : (roles.positions.get(zoneActor.runtimeActorId) || context[zoneRole])
          const zoneCenter = zoneAffordance.center
          if (Math.hypot(zoneActorPos[0] - zoneCenter[0], zoneActorPos[1] - zoneCenter[1]) > 0.01) {
            actorMotions.push({
              role: zoneRole,
              runtimeActorId: zoneActor.runtimeActorId,
              points: curve([zoneActorPos[0], zoneActorPos[1], 0], zoneCenter, 0.025, 0),
              carriesBall: false,
            })
          }
          const homeOutfield = roles.groups.homeOutfield || []
          const nearby = homeOutfield
            .filter((a) => a.runtimeActorId !== zoneActor.runtimeActorId)
            .map((a) => ({ actor: a, pos: roles.positions.get(a.runtimeActorId) }))
            .filter((entry) => entry.pos)
            .sort((a, b) => (
              Math.hypot(a.pos[0] - zoneCenter[0], a.pos[1] - zoneCenter[1])
              - Math.hypot(b.pos[0] - zoneCenter[0], b.pos[1] - zoneCenter[1])
            ))
            .slice(0, 2)
          for (const entry of nearby) {
            const shrink = 0.35
            const target = [
              clamp(entry.pos[0] + (zoneCenter[0] - entry.pos[0]) * shrink),
              clamp(entry.pos[1] + (zoneCenter[1] - entry.pos[1]) * shrink),
              0,
            ]
            actorMotions.push({
              role: 'primary',
              runtimeActorId: entry.actor.runtimeActorId,
              points: curve([entry.pos[0], entry.pos[1], 0], target, 0.02, 0),
              carriesBall: false,
            })
          }
        } else if (actorAffordance) {
          // 主角向球/裁判方向前移 2-4% 归一化距离
          const actorRole = actorAffordance.role || 'primary'
          const actorRef = roles.actors[actorRole]
          const actorPos = roles.positions.get(actorRef.runtimeActorId) || context[actorRole]
          const dx = context.origin[0] - actorPos[0]
          const dy = context.origin[1] - actorPos[1]
          const dist = Math.hypot(dx, dy) || 1
          const step = clamp(0.03, 0.015, 0.045)
          actorMotions.push({
            role: actorRole,
            runtimeActorId: actorRef.runtimeActorId,
            points: curve(
              [actorPos[0], actorPos[1], 0],
              [clamp(actorPos[0] + dx / dist * step), clamp(actorPos[1] + dy / dist * step), 0],
              0.015, 0,
            ),
            carriesBall: false,
          })
        } else if (duelAffordance && !tackleAffordance) {
          // 非铲球对抗：防守者逼近持球人
          const duelRole = duelAffordance.role || 'primary'
          const duelActor = roles.actors[duelRole]
          const duelStart = duelAffordance.points[0]
          const duelEnd = duelAffordance.points[1]
          actorMotions.push({
            role: duelRole,
            runtimeActorId: duelActor.runtimeActorId,
            points: curve(duelStart, duelEnd, 0.03, 0),
            carriesBall: false,
          })
        }
      }
      const legacyActorMotion = actorMotions.find((motion) => motion.carriesBall)
        || actorMotions[0]
      const secondaryRuntimeEvents = [
        ...(receivingShooterRole ? [{
          atMs: Math.round(durationMs * 0.58),
          type: 'shot',
          role: receivingShooterRole,
          runtimeActorId: roles.actors[receivingShooterRole].runtimeActorId,
        }] : []),
        ...(tackleAffordance ? [{
          atMs: contactMs,
          type: 'tackle-contact',
          role: tackleAffordance.role || 'primary',
          runtimeActorId: roles.actors[tackleAffordance.role || 'primary'].runtimeActorId,
          detail: {
            contact: 'decision-duel',
            suppressRuleDerivation: true,
            outcome: outcomeId,
          },
        }] : []),
      ].sort((left, right) => left.atMs - right.atMs)
      const executionMode = multiPassThenShot
        ? 'pass-sequence-then-shot'
        : passThenShot ? 'pass-then-shot'
        : carryThenShot
        ? 'carry-then-shot'
        : ballOnlyOutcome ? 'ball-only-shot' : carryAffordance ? 'ball-carry' : 'semantic-action'
      const liveShotsDisabled = typeof window !== 'undefined'
        && new URLSearchParams(window.location.search).get('liveShots') === '0'
      // 直接射门（含点球/直接任意球/远射）走引擎原生踢球物理；
      // 传球链、带球和对抗仍由剧本驱动，可用 ?liveShots=0 回退
      const liveShot = executionMode === 'ball-only-shot'
        && executionBallAffordance?.runtimeEventType === 'shot'
        && LIVE_SHOT_TERMINALS.has(terminal)
        && outcomePathFinal
        && !liveShotsDisabled
        ? buildLiveShotPlan({
          path: outcomePathFinal,
          terminal,
          intent: executionBallAffordance.intent,
          shooterRuntimeActorId: outcomeSourceRuntimeActorId,
          keeperRuntimeActorId: (outcomeBallSide === 'away'
            ? roles.actors.homeGoalkeeper
            : roles.actors.awayGoalkeeper).runtimeActorId,
          origin: context.origin,
        })
        : null
      return [outcomeId, {
        terminal,
        durationMs,
        executionMode,
        sourceRole: finalOutcomeSourceRole,
        sourceRuntimeActorId: outcomeSourceRuntimeActorId,
        initialSourceRole: choiceSourceRole,
        initialSourceRuntimeActorId: choiceSourceRuntimeActorId,
        ballSide: outcomeBallSide,
        runtimeBallEventType: passThenShot
          ? 'pass'
          : carryThenShot || executionBallAffordance?.runtimeEventType === 'shot' ? 'shot'
          : executionBallAffordance?.runtimeEventType || null,
        secondaryRuntimeEvents: [
          ...secondaryRuntimeEvents.filter((event) => event.type !== 'shot'),
          ...(passThenShot ? sequenceBallAffordances.slice(1).map((affordance, index) => ({
            atMs: (index + 1) * 760,
            type: 'pass',
            role: affordance.role,
            runtimeActorId: roles.actors[affordance.role].runtimeActorId,
          })) : []),
          ...(receivingShooterRole ? [{
            atMs: shotAtMs,
            type: 'shot',
            role: receivingShooterRole,
            runtimeActorId: roles.actors[receivingShooterRole].runtimeActorId,
          }] : []),
        ].sort((left, right) => left.atMs - right.atMs),
        releaseBallAtMs: duelReleaseBallAtMs ?? (
          carryThenShot ? (cutbackPoint ? 1080 : shotAtMs) : outcomePathFinal && !carryAffordance ? 0 : null
        ),
        path: outcomePathFinal,
        passPath,
        pathSegments,
        segmentEndTimes,
        carryPath: carryThenShot ? carryAffordance.points : null,
        shotAtMs,
        carriesBall: Boolean(carryAffordance),
        actorMotion: legacyActorMotion || null,
        actorMotions,
        actions,
        continuation: outcomeContinuation(
          terminal,
          context,
          roles,
          outcomeBallSide,
          executionAffordances,
        ),
        commentaryCue: `settled:${outcomeId}`,
        commentaryText: outcomeCommentaryText(
          terminal,
          path,
          roles,
          outcomeSourceRole,
          choice.label,
          executionAffordances,
        ),
        // A drawn carry/run lane is not proof of a shot or pass. Only an authored
        // ball action may narrate the generic runtime fact; movement-only choices
        // keep their exact authored rule result (for example "逼出角球").
        feedbackMode: executionBallAffordance ? 'runtime-fact' : 'rule-result',
        runtimeEffect: contract.outcomeEffects?.[choice.id]?.[outcomeId]
          || contract.choiceEffects?.[choice.id] || null,
        requiresRuntimeGoal: Boolean(path && ['goal-for', 'goal-against'].includes(terminal)),
        scoringSide: path && terminal === 'goal-for'
          ? 'red'
          : path && terminal === 'goal-against' ? 'blue' : null,
        liveShot,
      }]
    }))
    return {
      id: choice.id,
      label: choice.label,
      ...copyChoice(choice, roles.actors.primary.name, roles.actors.support.name),
      affordances,
      sourceRole: choiceSourceRole,
      sourceRuntimeActorId: choiceSourceRuntimeActorId,
      ballSide,
      runtimeBallEventType: ballAffordance?.runtimeEventType || null,
      runtimeEffect: contract.choiceEffects?.[choice.id] || null,
      executionMode: isShotChoice ? 'ball-only-shot' : carryAffordance ? 'ball-carry' : 'semantic-action',
      labelAnchor: labelAnchor(affordances, context),
      outcomes,
    }
  })
  const script = {
    schemaVersion: DECISION_SCENE_SCRIPT_V3_SCHEMA,
    id: `decision-scene-v3.${scenarioId}.${decision.id}`,
    scenarioId,
    minute: decision.coachDecisionEvent.minute,
    side: 'red',
    mode: contract.mode,
    triggerId: contract.triggerId,
    sourceEvent: sourceEvent ? {
      id: sourceEvent.id,
      type: sourceEvent.type,
      sourceEventId: sourceEvent.sourceEventId || null,
      side: sourceEvent.side || null,
    } : null,
    actors: roles.actors,
    actorPositions: sceneMoment.actorPositions.map((entry) => ({
      runtimeActorId: entry.runtimeActorId,
      normalized: [...entry.normalized],
      facing: entry.facing,
    })),
    stagedActorPositions: staging?.actorPositions || [],
    wallActorIds: [...(staging?.wallActorIds || runtimeMoment.wallActorIds || [])],
    ball: {
      sourceRuntimeActorId,
      normalized: staging?.ball || point3(runtimeMoment.ball.normalized),
      anchor: 'runtime-current-ball',
    },
    fieldAnchors: {
      homeAttackDirection: context.homeDirection,
      homeAttackGoal: [...context.homeAttackGoal],
      homeDefendGoal: [...context.homeDefendGoal],
    },
    transition: {
      mode: contract.mode,
      fadeOutMs: contract.mode === 'blackout-stage' ? 120 : 0,
      fadeInMs: contract.mode === 'blackout-stage' ? 180 : 0,
    },
    camera: {
      preserveCurrent: contract.mode !== 'blackout-stage',
      allowManualPanWhileChoosing: true,
    },
    continuation: {
      completed: 'from-outcome-terminal',
      cancelled: 'restore-snapshot',
    },
    runtimeMoment: {
      schemaVersion: runtimeMoment.schemaVersion,
      capturedAtMatchTime: runtimeMoment.capturedAtMatchTime,
      source: 'continuous-match',
    },
    timeline: { selectionFeedbackMs: 150, settledHoldMs: 800 },
    safeChoiceId: contract.safeChoiceId,
    choices,
    invariants: {
      networking: 'none',
      resultTextInference: false,
      authorityOwner: 'formal-match-session',
      normalCompletionRestoresBall: false,
    },
  }
  const validation = validateDecisionSceneScriptV3(script, decision)
  if (!validation.valid) {
    throw new Error(`DecisionSceneScriptV3 校验失败：${validation.errors.join(', ')}`)
  }
  return script
}

export function validateDecisionSceneScriptV3(script, decision = null) {
  const errors = []
  const contract = FORMAL_DECISION_SCENE_CATALOG_V3[script?.scenarioId]
  if (script?.schemaVersion !== DECISION_SCENE_SCRIPT_V3_SCHEMA) errors.push('schemaVersion')
  if (!contract) errors.push('scenarioId')
  if (script?.mode !== contract?.mode) errors.push('mode')
  if ((script?.actorPositions?.length || 0) < 18) errors.push('actorPositions')
  if (script?.runtimeMoment?.source !== 'continuous-match') errors.push('runtimeMoment.source')
  if (script?.continuation?.completed !== 'from-outcome-terminal') errors.push('continuation.completed')
  if (script?.continuation?.cancelled !== 'restore-snapshot') errors.push('continuation.cancelled')
  if (script?.invariants?.normalCompletionRestoresBall !== false) errors.push('normalCompletionRestoresBall')
  if (![-1, 1].includes(script?.fieldAnchors?.homeAttackDirection)) errors.push('fieldAnchors.homeAttackDirection')
  if (script?.fieldAnchors?.homeAttackGoal?.length !== 3) errors.push('fieldAnchors.homeAttackGoal')
  if (script?.fieldAnchors?.homeDefendGoal?.length !== 3) errors.push('fieldAnchors.homeDefendGoal')
  if (script?.timeline?.selectionFeedbackMs !== 150) errors.push('timeline.selectionFeedbackMs')
  if (Number(script?.timeline?.settledHoldMs) < 800) errors.push('timeline.settledHoldMs')
  if (contract?.mode === 'blackout-stage' && !script?.stagedActorPositions?.length) errors.push('stagedActorPositions')
  if (contract?.mode !== 'blackout-stage' && script?.stagedActorPositions?.length) errors.push('liveActorRelocation')
  if (!script?.choices?.length) errors.push('choices')
  for (const choice of script?.choices || []) {
    const declared = contract?.choices?.[choice.id]
    if (!declared?.length || choice.affordances?.length !== declared.length) errors.push(`${choice.id}.affordances`)
    const ballAffordances = (choice.affordances || []).filter((affordance) => (
      affordance.kind === 'ball-path'
    ))
    for (const affordance of choice.affordances || []) {
      if (affordance.kind === 'ball-path' && !['pass', 'shot'].includes(affordance.runtimeEventType)) {
        errors.push(`${choice.id}.runtimeBallEventType`)
      }
      if (affordance.kind === 'ball-path') {
        if (!['home', 'away'].includes(affordance.side)) errors.push(`${choice.id}.ball-side`)
        if (!script.actors?.[affordance.role]) errors.push(`${choice.id}.ball-role`)
        if (affordance.points?.length !== 4) errors.push(`${choice.id}.ball-path`)
        const ballIndex = ballAffordances.indexOf(affordance)
        let expectedStart = ballIndex > 0
          ? ballAffordances[ballIndex - 1].points?.at(-1)
          : script.ball.normalized
        if (ballIndex === 0 && affordance.startRole && script.actors?.[affordance.startRole]) {
          const startActorId = script.actors[affordance.startRole].runtimeActorId
          const stagedPos = (script.stagedActorPositions || [])
            .find((p) => p.runtimeActorId === startActorId)
          const livePos = (script.actorPositions || [])
            .find((p) => p.runtimeActorId === startActorId)
          expectedStart = stagedPos?.normalized || livePos?.normalized || expectedStart
        }
        const startMatch = affordance.startRole
          ? (Math.abs((affordance.points?.[0]?.[0] || 0) - (expectedStart?.[0] || 0)) < 0.001
            && Math.abs((affordance.points?.[0]?.[1] || 0) - (expectedStart?.[1] || 0)) < 0.001)
          : JSON.stringify(affordance.points?.[0]) === JSON.stringify(expectedStart)
        if (!startMatch) {
          errors.push(`${choice.id}.ball-origin`)
        }
      }
      if (affordance.kind === 'run-lane' && !script.actors?.[affordance.role]) {
        errors.push(`${choice.id}.run-role`)
      }
    }
    const expectedOutcomes = decision?.choices?.find((candidate) => candidate.id === choice.id)?.possible_outcomes || []
    const actualOutcomes = Object.keys(choice.outcomes || {})
    if (expectedOutcomes.length && JSON.stringify([...new Set(expectedOutcomes)].sort()) !== JSON.stringify(actualOutcomes.sort())) {
      errors.push(`${choice.id}.outcomes`)
    }
    for (const outcome of Object.values(choice.outcomes || {})) {
      if (!outcome.sourceRuntimeActorId || !script.actors?.[outcome.sourceRole]) {
        errors.push(`${choice.id}.outcome.sourceActor`)
      }
      if (outcome.path && outcome.path.length !== 4) errors.push(`${choice.id}.outcome.path`)
      if (outcome.passPath && outcome.passPath.length !== 4) errors.push(`${choice.id}.outcome.passPath`)
      if (['pass-then-shot', 'pass-sequence-then-shot'].includes(outcome.executionMode)) {
        if (
          !outcome.passPath
          || !outcome.path
          || !Number.isFinite(outcome.shotAtMs)
          || !outcome.pathSegments?.length
          || outcome.pathSegments.length !== outcome.segmentEndTimes?.length
        ) {
          errors.push(`${choice.id}.outcome.passThenShot`)
        } else {
          if (JSON.stringify(outcome.passPath) !== JSON.stringify(outcome.pathSegments[0])) {
            errors.push(`${choice.id}.outcome.passFirstSegment`)
          }
          for (let index = 1; index < outcome.pathSegments.length; index += 1) {
            if (JSON.stringify(outcome.pathSegments[index - 1].at(-1))
              !== JSON.stringify(outcome.pathSegments[index][0])) {
              errors.push(`${choice.id}.outcome.passShotJoin`)
            }
          }
          if (JSON.stringify(outcome.pathSegments.at(-1)) !== JSON.stringify(outcome.path)) {
            errors.push(`${choice.id}.outcome.passFinalSegment`)
          }
        }
        if (outcome.runtimeBallEventType !== 'pass'
          || !outcome.secondaryRuntimeEvents?.some((event) => event.type === 'shot')) {
          errors.push(`${choice.id}.outcome.passShotEvents`)
        }
      }
      if (BALL_ONLY_TERMINALS.has(outcome.terminal) && outcome.path) {
        if (![
          'ball-only-shot',
          'carry-then-shot',
          'pass-then-shot',
          'pass-sequence-then-shot',
        ].includes(outcome.executionMode)) {
          errors.push(`${choice.id}.outcome.executionMode`)
        }
        if (outcome.executionMode === 'ball-only-shot' && outcome.carriesBall) {
          errors.push(`${choice.id}.outcome.carriesBall`)
        }
        if (outcome.executionMode === 'ball-only-shot'
          && outcome.actorMotion?.runtimeActorId === outcome.sourceRuntimeActorId) {
          errors.push(`${choice.id}.outcome.actorMotion.sourceActor`)
        }
        if (outcome.executionMode === 'carry-then-shot') {
          if (!outcome.carriesBall || !outcome.carryPath || !Number.isFinite(outcome.shotAtMs)) {
            errors.push(`${choice.id}.outcome.carryThenShot`)
          }
          const actorEnd = outcome.actorMotion?.points?.at(-1)
          const ballEnd = outcome.path?.at(-1)
          if (!actorEnd || !ballEnd || Math.hypot(actorEnd[0] - ballEnd[0], actorEnd[1] - ballEnd[1]) < 0.04) {
            errors.push(`${choice.id}.outcome.actorStopsBeforeGoal`)
          }
          // 底线回传射门：pathSegments 必须连续且第一段从带球终点发出
          if (outcome.pathSegments?.length) {
            if (outcome.pathSegments.length !== outcome.segmentEndTimes?.length) {
              errors.push(`${choice.id}.outcome.cutbackSegments`)
            }
            const cEnd = outcome.carryPath?.at(-1)
            if (cEnd && outcome.pathSegments[0]) {
              if (Math.abs(outcome.pathSegments[0][0][0] - cEnd[0]) > 1e-6
                || Math.abs(outcome.pathSegments[0][0][1] - cEnd[1]) > 1e-6) {
                errors.push(`${choice.id}.outcome.cutbackOrigin`)
              }
            }
            for (let si = 1; si < (outcome.pathSegments?.length || 0); si += 1) {
              if (JSON.stringify(outcome.pathSegments[si - 1].at(-1))
                !== JSON.stringify(outcome.pathSegments[si][0])) {
                errors.push(`${choice.id}.outcome.cutbackJoin`)
              }
            }
            if (JSON.stringify(outcome.pathSegments.at(-1)) !== JSON.stringify(outcome.path)) {
              errors.push(`${choice.id}.outcome.cutbackFinal`)
            }
          }
        }
      }
      if (!outcome.commentaryText) errors.push(`${choice.id}.outcome.commentaryText`)
      if (!['runtime-fact', 'rule-result'].includes(outcome.feedbackMode)) {
        errors.push(`${choice.id}.outcome.feedbackMode`)
      }
      if (outcome.requiresRuntimeGoal) {
        const expectedScoringSide = outcome.terminal === 'goal-for' ? 'red' : 'blue'
        if (outcome.scoringSide !== expectedScoringSide) {
          errors.push(`${choice.id}.outcome.scoringSide`)
        }
      } else if (outcome.scoringSide != null) {
        errors.push(`${choice.id}.outcome.unexpectedScoringSide`)
      }
      const cueTimes = (outcome.actions || []).map((action) => action.atMs)
      if (cueTimes.some((time, index) => index > 0 && time < cueTimes[index - 1])) errors.push(`${choice.id}.actions.order`)
      for (const action of outcome.actions || []) {
        if (!SPINE_SAFE_ACTIONS.has(action.animation)) errors.push(`${choice.id}.outcome.actionAnimation`)
      }
      for (const runtimeEvent of outcome.secondaryRuntimeEvents || []) {
        if (!['pass', 'shot', 'tackle-contact'].includes(runtimeEvent.type)
          || !script.actors?.[runtimeEvent.role]
          || runtimeEvent.atMs <= 0
          || runtimeEvent.atMs >= outcome.durationMs) {
          errors.push(`${choice.id}.secondaryRuntimeEvent`)
        }
      }
    }
  }
  return { valid: errors.length === 0, errors }
}

function momentAttackDirection(moment) {
  return Number(moment?.attackDirection) || (moment?.attackingSide === 'blue' ? -1 : 1)
}

function attackProgress(moment, point = moment?.ball?.normalized) {
  const x = Number(point?.[0] || 0)
  return momentAttackDirection(moment) > 0 ? x : 1 - x
}

export function getRuntimeAttackProgressV3(moment, point = moment?.ball?.normalized) {
  return attackProgress(moment, point)
}

function eventIs(event, types) {
  return types.includes(event?.type)
}

function momentActorPoint(moment, runtimeActorId) {
  return moment?.actorPositions?.find((entry) => entry.runtimeActorId === runtimeActorId)?.normalized || null
}

function isSweeperClaimWindow(moment, event) {
  if (moment.attackingSide !== 'blue' || !eventIs(event, ['pass', 'touch', 'possession-change'])) return false
  const ball = moment.ball.normalized
  const progress = attackProgress(moment)
  if (progress < 0.68 || progress > 0.9 || ball[1] < 0.2 || ball[1] > 0.8) return false
  const goalkeeper = momentActorPoint(moment, moment.homeGoalkeeperRuntimeActorId)
  if (!goalkeeper) return false
  const goalkeeperProgress = attackProgress(moment, goalkeeper)
  const goalkeeperDistance = Math.hypot(goalkeeper[0] - ball[0], goalkeeper[1] - ball[1])
  const defendingGoalLineX = momentAttackDirection(moment) > 0 ? 1 : 0
  const goalkeeperAdvance = Math.abs(goalkeeper[0] - defendingGoalLineX)
  return goalkeeperProgress > progress && goalkeeperDistance <= 0.24 && goalkeeperAdvance >= 0.055
}

const TRIGGER_PREDICATES = Object.freeze({
  'solo-breakaway': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.72 && m.ball.normalized[1] >= 0.28 && m.ball.normalized[1] <= 0.72 && eventIs(e, ['touch', 'pass', 'possession-change']),
  'wide-cross-window': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.62 && (m.ball.normalized[1] <= 0.32 || m.ball.normalized[1] >= 0.68) && eventIs(e, ['touch', 'pass']),
  'counter-overload': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.35 && attackProgress(m) <= 0.72 && eventIs(e, ['possession-change', 'pass', 'touch']),
  'long-shot-window': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.52 && attackProgress(m) <= 0.78 && eventIs(e, ['touch', 'pass']),
  'through-run-window': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.48 && attackProgress(m) <= 0.78 && eventIs(e, ['pass', 'touch']),
  'box-tackle-window': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.74 && eventIs(e, ['touch', 'possession-change']),
  'goalkeeper-one-on-one': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.77 && m.ball.normalized[1] >= 0.24 && m.ball.normalized[1] <= 0.76 && eventIs(e, ['touch', 'pass']),
  'last-defender-duel': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.8 && eventIs(e, ['touch', 'pass', 'possession-change']),
  'midfield-press-window': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.3 && attackProgress(m) <= 0.72 && eventIs(e, ['touch', 'pass', 'possession-change']),
  'counter-contact-window': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.3 && attackProgress(m) <= 0.7 && eventIs(e, ['possession-change', 'touch', 'pass']),
  'offside-line-window': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.48 && eventIs(e, ['pass', 'touch']),
  'last-ditch-shot': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.76 && eventIs(e, ['touch']),
  'keeper-in-hands': (m, e) => Boolean(m.ownerIsGoalkeeper && m.ballInHands && m.attackingSide === 'red' && eventIs(e, ['touch', 'save'])),
  'midfield-loose-ball': (m, e) => attackProgress(m) >= 0.32 && attackProgress(m) <= 0.68 && eventIs(e, ['touch', 'possession-change']),
  'box-scramble': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.77 && eventIs(e, ['shot', 'touch', 'possession-change']),
  'box-contact-attack': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.76 && e?.type === 'tackle-contact',
  'box-second-ball': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.72 && eventIs(e, ['touch', 'possession-change']),
  'wing-overlap': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.55 && (m.ball.normalized[1] <= 0.3 || m.ball.normalized[1] >= 0.7) && eventIs(e, ['touch', 'pass']),
  'cutback-window': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.82 && (m.ball.normalized[1] <= 0.32 || m.ball.normalized[1] >= 0.68) && eventIs(e, ['touch', 'pass']),
  'half-space-run': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.5 && attackProgress(m) <= 0.8 && eventIs(e, ['touch', 'pass']),
  'defensive-turnover': (m, e) => m.attackingSide === 'red' && attackProgress(m) <= 0.42 && e?.type === 'possession-change',
  'high-press-window': (m, e) => m.attackingSide === 'blue' && attackProgress(m) <= 0.45 && eventIs(e, ['touch', 'pass']),
  'switch-play-window': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.35 && attackProgress(m) <= 0.68 && eventIs(e, ['touch', 'pass']),
  'fullback-recovery': (m, e) => m.attackingSide === 'blue' && attackProgress(m) >= 0.56 && (m.ball.normalized[1] <= 0.3 || m.ball.normalized[1] >= 0.7) && eventIs(e, ['pass', 'touch', 'possession-change']),
  'sweeper-window': isSweeperClaimWindow,
  'corner-second-ball': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.72 && eventIs(e, ['touch', 'possession-change', 'shot']),
  'set-piece-rebound': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.72 && eventIs(e, ['post-hit', 'crossbar-hit', 'save', 'touch']),
  'penalty-rebound': (m, e) => m.attackingSide === 'red' && attackProgress(m) >= 0.82 && e?.type === 'save',
  'booked-defender-duel': (m, e, s) => m.attackingSide === 'blue' && attackProgress(m) >= 0.55 && eventIs(e, ['touch'])
    // 语义门：本方确实已有黄牌在身才有"再吃牌就下场"的抉择
    && (!s || Number(s.stats?.red?.yellowCards || 0) >= 1),
  'wet-pitch-tackle': (m, e) => Boolean(
    m.weather === 'rain'
    && m.attackingSide === 'blue'
    && attackProgress(m) >= 0.5
    && eventIs(e, ['touch', 'pass', 'possession-change'])
  ),
})

export function isFormalDecisionMomentEligibleV3(scenarioId, runtimeMoment, sourceEvent = null, session = null) {
  const contract = getFormalDecisionSceneContractV3(scenarioId)
  if (!contract || !runtimeMoment?.ball?.normalized || runtimeMoment.ballOutOfPlay && contract.mode === 'freeze-live') return false
  if (contract.sourceEventTypes?.length && !contract.sourceEventTypes.includes(sourceEvent?.type)) return false
  if (contract.sourceEventSide && sourceEvent?.side !== contract.sourceEventSide) return false
  if (contract.requiresPenaltyArea) {
    const inPenaltyArea = sourceEvent?.detail?.inPenaltyArea === true
      || sourceEvent?.detail?.inAttackingPenaltyArea === true
      || sourceEvent?.detail?.inOwnPenaltyArea === true
      || sourceEvent?.type === 'penalty'
    if (!inPenaltyArea) return false
  }
  if (contract.mode === 'blackout-stage' || contract.mode === 'freeze-incident') {
    if (!sourceEvent?.id && contract.triggerId !== 'stamina-dead-ball') return false
  }
  if (contract.mode === 'freeze-match-state') {
    if (contract.triggerId === 'trailing-final-ten') return Number(session?.minute || 0) >= 80 && session.score.red < session.score.blue
    if (contract.triggerId === 'leading-final-ten') return Number(session?.minute || 0) >= 80 && session.score.red > session.score.blue
    return Boolean(session?.extraTime) && session.score.red === session.score.blue
  }
  if (contract.mode !== 'freeze-live') {
    // 语义门：补时门将上抢只在比分落后时出现（领先/平局不会孤注一掷）
    if (contract.triggerId === 'late-attacking-corner' && session) {
      return Number(session.score?.red || 0) < Number(session.score?.blue || 0)
    }
    return true
  }
  const predicate = TRIGGER_PREDICATES[contract.triggerId]
  if (!predicate) throw new Error(`${scenarioId} 缺少 V3 trigger predicate：${contract.triggerId}`)
  return Boolean(predicate(runtimeMoment, sourceEvent, session))
}
