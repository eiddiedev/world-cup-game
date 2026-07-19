import {
  FORMAL_DECISION_SCENE_CATALOG,
  FORMAL_OUTCOME_VISUAL_TERMINALS,
} from './formalDecisionSceneCatalog.js'

export const DECISION_SCENE_SCRIPT_V2_SCHEMA = 'decision-scene-script-v2'
export const DECISION_DIRECTOR_V2_PHASES = Object.freeze([
  'idle',
  'staging',
  'choosing',
  'executing',
  'settled',
  'restoring',
])

export const DANGEROUS_FREE_KICK_OUTCOMES = Object.freeze({
  direct_freekick: Object.freeze([
    'goal_freekick',
    'saved_freekick',
    'hit_wall',
    'miss_over',
  ]),
  freekick_cross: Object.freeze([
    'goal_header',
    'saved_header',
    'cleared_header',
    'counter_risk',
  ]),
  short_freekick: Object.freeze([
    'goal_reorganized',
    'shot_blocked',
    'possession_kept',
  ]),
})

const CANONICAL_FREE_KICK_ORIGIN = Object.freeze([0.72, 0.5, 0])

export const DANGEROUS_FREE_KICK_TRIGGER_ZONE = Object.freeze({
  minX: 0.54,
  maxX: 0.84,
  minY: 0.12,
  maxY: 0.88,
})

const FREE_KICK_CHOICE_VISUALS = Object.freeze({
  direct_freekick: Object.freeze({
    label: '直接射门',
    kind: 'trajectory',
    labelAnchor: [0.865, 0.31],
    previewPath: [
      CANONICAL_FREE_KICK_ORIGIN,
      [0.79, 0.39, 0.85],
      [0.91, 0.36, 1.15],
      [0.982, 0.43, 0.2],
    ],
  }),
  freekick_cross: Object.freeze({
    label: '传中争顶',
    kind: 'trajectory',
    labelAnchor: [0.885, 0.66],
    previewPath: [
      CANONICAL_FREE_KICK_ORIGIN,
      [0.79, 0.7, 1.35],
      [0.9, 0.67, 1.75],
      [0.945, 0.58, 0.35],
    ],
  }),
  short_freekick: Object.freeze({
    label: '短传重组',
    kind: 'trajectory',
    labelAnchor: [0.69, 0.7],
    previewPath: [
      CANONICAL_FREE_KICK_ORIGIN,
      [0.7, 0.58, 0.18],
      [0.66, 0.63, 0.25],
      [0.64, 0.68, 0],
    ],
  }),
})

const FREE_KICK_EXECUTIONS = Object.freeze({
  direct_freekick: Object.freeze({
    goal_freekick: Object.freeze({
      terminal: 'goal',
      durationMs: 1450,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.8, 0.38, 0.9], [0.92, 0.36, 1.15], [0.988, 0.43, 0.18]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 980, role: 'goalkeeper', animation: 'jump' }],
    }),
    saved_freekick: Object.freeze({
      terminal: 'goalkeeper',
      durationMs: 1400,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.8, 0.38, 0.9], [0.91, 0.41, 1.05], [0.962, 0.47, 0.32]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 880, role: 'goalkeeper', animation: 'jump' }, { atMs: 1240, role: 'goalkeeper', animation: 'hands_in_front' }],
    }),
    hit_wall: Object.freeze({
      terminal: 'wall',
      durationMs: 1050,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.755, 0.43, 0.62], [0.79, 0.45, 0.72], [0.812, 0.48, 0.35]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 600, role: 'wall', animation: 'jump' }],
    }),
    miss_over: Object.freeze({
      terminal: 'out',
      durationMs: 1350,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.8, 0.36, 1.05], [0.92, 0.3, 1.55], [0.995, 0.31, 1.2]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 920, role: 'goalkeeper', animation: 'jump' }],
    }),
  }),
  freekick_cross: Object.freeze({
    goal_header: Object.freeze({
      terminal: 'goal',
      durationMs: 1650,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.8, 0.72, 1.45], [0.91, 0.65, 1.7], [0.988, 0.46, 0.22]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 1040, role: 'aerialTarget', animation: 'jump' }, { atMs: 1260, role: 'goalkeeper', animation: 'jump' }],
    }),
    saved_header: Object.freeze({
      terminal: 'goalkeeper',
      durationMs: 1580,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.8, 0.72, 1.45], [0.9, 0.63, 1.65], [0.962, 0.5, 0.28]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 1000, role: 'aerialTarget', animation: 'jump' }, { atMs: 1180, role: 'goalkeeper', animation: 'jump' }, { atMs: 1410, role: 'goalkeeper', animation: 'hands_in_front' }],
    }),
    cleared_header: Object.freeze({
      terminal: 'clearance',
      durationMs: 1520,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.8, 0.72, 1.45], [0.89, 0.66, 1.55], [0.79, 0.76, 0.35]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 1020, role: 'wall', animation: 'jump' }],
    }),
    counter_risk: Object.freeze({
      terminal: 'defender',
      durationMs: 1480,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.8, 0.72, 1.35], [0.88, 0.67, 1.45], [0.86, 0.6, 0.18]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 1040, role: 'wall', animation: 'jump' }],
    }),
  }),
  short_freekick: Object.freeze({
    goal_reorganized: Object.freeze({
      terminal: 'goal',
      durationMs: 1800,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.69, 0.61, 0.2], [0.79, 0.42, 0.8], [0.988, 0.44, 0.18]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 720, role: 'support', animation: 'shoot' }, { atMs: 1320, role: 'goalkeeper', animation: 'jump' }],
    }),
    shot_blocked: Object.freeze({
      terminal: 'wall',
      durationMs: 1450,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.69, 0.61, 0.2], [0.77, 0.48, 0.55], [0.825, 0.48, 0.25]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }, { atMs: 700, role: 'support', animation: 'shoot' }, { atMs: 1120, role: 'wall', animation: 'jump' }],
    }),
    possession_kept: Object.freeze({
      terminal: 'support',
      durationMs: 900,
      path: [CANONICAL_FREE_KICK_ORIGIN, [0.7, 0.58, 0.18], [0.66, 0.64, 0.22], [0.64, 0.68, 0]],
      actions: [{ atMs: 0, role: 'primary', animation: 'shoot' }],
    }),
  }),
})

function positionRank(actor) {
  const order = ['GK', 'DF', 'MF', 'FW']
  return order.indexOf(actor.assignedPosition || actor.naturalPosition || 'MF')
}

function activeActors(actorSource, side) {
  return (actorSource?.actors || [])
    .filter((actor) => actor.side === side && actor.state?.onPitch)
    .sort((left, right) => positionRank(left) - positionRank(right) || left.runtimeIndex - right.runtimeIndex)
}

function actorByPlayerId(actors, playerId) {
  return actors.find((actor) => actor.playerId === playerId)
}

function actorReference(actor, role) {
  if (!actor) throw new Error(`危险任意球缺少 ${role} actor`)
  return {
    role,
    playerId: actor.playerId,
    runtimeActorId: actor.runtimeActorId,
    name: actor.name,
    number: actor.number,
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0))
}

function normalizedPosition(runtimeMoment, runtimeActorId, fallback = [0.5, 0.5]) {
  const entry = runtimeMoment.actorPositions.find((candidate) => (
    candidate.runtimeActorId === runtimeActorId
  ))
  return entry?.normalized || fallback
}

function remapCanonicalPath(canonicalPath, origin, terminal) {
  const canonicalStart = canonicalPath[0]
  const canonicalEnd = canonicalPath.at(-1)
  const canonicalDx = canonicalEnd[0] - canonicalStart[0]
  const canonicalDy = canonicalEnd[1] - canonicalStart[1]
  const targetDx = terminal[0] - origin[0]
  const targetDy = terminal[1] - origin[1]

  return canonicalPath.map((point, index) => {
    if (index === 0) return [...origin]
    if (index === canonicalPath.length - 1) return [...terminal]
    const progress = Math.abs(canonicalDx) > 0.001
      ? (point[0] - canonicalStart[0]) / canonicalDx
      : index / (canonicalPath.length - 1)
    const canonicalCenterY = canonicalStart[1] + canonicalDy * progress
    const curveOffsetY = point[1] - canonicalCenterY
    return [
      clamp(origin[0] + targetDx * progress, 0.02, 1.04),
      clamp(origin[1] + targetDy * progress + curveOffsetY, 0.04, 0.96),
      point[2] || 0,
    ]
  })
}

function labelAnchorFor(choiceId, path) {
  const point = path[2]
  const offsetY = choiceId === 'direct_freekick'
    ? -0.075
    : choiceId === 'freekick_cross'
      ? 0.085
      : 0.075
  return [clamp(point[0], 0.08, 0.94), clamp(point[1] + offsetY, 0.08, 0.92)]
}

function terminalForOutcome({
  outcome,
  origin,
  goal,
  goalkeeper,
  wall,
  defender,
  support,
}) {
  if (outcome.terminal === 'goal') return goal
  if (outcome.terminal === 'goalkeeper') return [...goalkeeper, 0.28]
  if (outcome.terminal === 'wall') return [...wall, 0.34]
  if (outcome.terminal === 'clearance' || outcome.terminal === 'defender') {
    return [...defender, 0.3]
  }
  if (outcome.terminal === 'support') return [...support, 0]
  if (outcome.terminal === 'out') {
    return [1.015, clamp(goal[1] + (origin[1] > 0.5 ? -0.14 : 0.14), 0.2, 0.8), 1.2]
  }
  return goal
}

function completeChoiceCopy(choice, primaryName) {
  const interpolate = (value) => String(value || '').replaceAll('{player}', primaryName)
  return {
    description: interpolate(choice.desc),
    risk: interpolate(choice.risk),
    reward: interpolate(choice.reward),
    successHint: choice.successHint,
  }
}

export function isDangerousFreeKickRuntimeMomentEligible(runtimeMoment) {
  const ball = runtimeMoment?.ball?.normalized
  const zone = DANGEROUS_FREE_KICK_TRIGGER_ZONE
  return Boolean(
    runtimeMoment?.attackingSide === 'red'
    && runtimeMoment?.ownerRuntimeActorId
    && Array.isArray(ball)
    && ball[0] >= zone.minX
    && ball[0] <= zone.maxX
    && ball[1] >= zone.minY
    && ball[1] <= zone.maxY
  )
}

export function createDangerousFreeKickRuntimeMomentFixture(actorSource, decision) {
  const redActors = activeActors(actorSource, 'red')
  const blueActors = activeActors(actorSource, 'blue')
  const primary = actorByPlayerId(
    redActors,
    decision?.coachDecisionEvent?.keyPlayers?.primary?.id,
  ) || redActors.find((actor) => actor.assignedPosition === 'MF') || redActors[0]
  const support = redActors.find((actor) => actor !== primary && actor.assignedPosition === 'MF')
    || redActors.find((actor) => actor !== primary)
  const aerialTarget = redActors.find((actor) => actor !== primary && actor.assignedPosition === 'FW')
    || support
  const goalkeeper = blueActors.find((actor) => actor.isGoalkeeper)
  const defenders = blueActors.filter((actor) => !actor.isGoalkeeper)
  const actorPositions = [...redActors, ...blueActors].map((actor, index) => ({
    runtimeActorId: actor.runtimeActorId,
    normalized: actor.side === 'red'
      ? [0.2 + (index % 6) * 0.1, 0.18 + (index % 5) * 0.16]
      : [0.58 + (index % 5) * 0.075, 0.16 + (index % 6) * 0.14],
    facing: actor.side === 'red' ? 'right' : 'left',
  }))
  const primaryPosition = actorPositions.find((entry) => (
    entry.runtimeActorId === primary.runtimeActorId
  ))
  primaryPosition.normalized = [0.68, 0.5]
  return {
    schemaVersion: 'runtime-decision-moment-v1',
    capturedAtMatchTime: 44,
    attackingSide: 'red',
    ownerRuntimeActorId: primary.runtimeActorId,
    primaryRuntimeActorId: primary.runtimeActorId,
    supportRuntimeActorId: support.runtimeActorId,
    aerialTargetRuntimeActorId: aerialTarget.runtimeActorId,
    goalkeeperRuntimeActorId: goalkeeper.runtimeActorId,
    defenderRuntimeActorId: defenders[0].runtimeActorId,
    wallActorIds: defenders.slice(0, 4).map((actor) => actor.runtimeActorId),
    ball: { normalized: [0.68, 0.5, 0] },
    actorPositions,
  }
}

export function buildDangerousFreeKickSceneScript(decision, actorSource, runtimeMoment) {
  if (decision?.coachDecisionEvent?.sourceScenarioId !== 'freekick_dangerous') {
    throw new Error('DecisionSceneScriptV2 当前只接受 freekick_dangerous')
  }
  if (!isDangerousFreeKickRuntimeMomentEligible(runtimeMoment)) {
    throw new Error('危险任意球必须来自连续比赛中的真实危险区域瞬间')
  }
  const side = decision.side === 'blue' ? 'blue' : 'red'
  if (side !== 'red') throw new Error('危险任意球 V2 样板当前只支持红队进攻')
  const redActors = activeActors(actorSource, 'red')
  const blueActors = activeActors(actorSource, 'blue')
  const byRuntimeId = (actors, runtimeActorId) => actors.find((actor) => (
    actor.runtimeActorId === runtimeActorId
  ))
  const primaryActor = byRuntimeId(redActors, runtimeMoment.primaryRuntimeActorId)
  const supportActor = byRuntimeId(redActors, runtimeMoment.supportRuntimeActorId)
  const aerialTargetActor = byRuntimeId(redActors, runtimeMoment.aerialTargetRuntimeActorId)
  const goalkeeperActor = byRuntimeId(blueActors, runtimeMoment.goalkeeperRuntimeActorId)
  const defenderActor = byRuntimeId(blueActors, runtimeMoment.defenderRuntimeActorId)
  const actors = {
    primary: actorReference(primaryActor, 'primary'),
    support: actorReference(supportActor, 'support'),
    aerialTarget: actorReference(aerialTargetActor, 'aerialTarget'),
    goalkeeper: actorReference(goalkeeperActor, 'goalkeeper'),
    defender: actorReference(defenderActor, 'defender'),
  }
  const origin = [...runtimeMoment.ball.normalized]
  const supportPosition = normalizedPosition(runtimeMoment, actors.support.runtimeActorId)
  const aerialTargetPosition = normalizedPosition(runtimeMoment, actors.aerialTarget.runtimeActorId)
  const goalkeeperPosition = normalizedPosition(runtimeMoment, actors.goalkeeper.runtimeActorId, [0.97, 0.5])
  const defenderPosition = normalizedPosition(runtimeMoment, actors.defender.runtimeActorId, [0.84, 0.5])
  const wallPosition = normalizedPosition(runtimeMoment, runtimeMoment.wallActorIds[0], defenderPosition)
  const goal = [0.992, clamp(0.5 + (0.5 - origin[1]) * 0.2, 0.42, 0.58), 0.18]
  const previewTargets = {
    direct_freekick: goal,
    freekick_cross: [
      Math.max(origin[0] + 0.08, aerialTargetPosition[0]),
      aerialTargetPosition[1],
      0.32,
    ],
    short_freekick: [...supportPosition, 0],
  }
  const choices = decision.choices.map((choice) => {
    const visual = FREE_KICK_CHOICE_VISUALS[choice.id]
    const outcomes = FREE_KICK_EXECUTIONS[choice.id]
    if (!visual || !outcomes) throw new Error(`危险任意球缺少显式脚本：${choice.id}`)
    const previewPath = remapCanonicalPath(
      visual.previewPath,
      origin,
      previewTargets[choice.id],
    )
    const executionOutcomes = Object.fromEntries(Object.entries(outcomes).map(([
      outcomeId,
      outcome,
    ]) => {
      const terminal = terminalForOutcome({
        outcome,
        origin,
        goal,
        goalkeeper: goalkeeperPosition,
        wall: wallPosition,
        defender: defenderPosition,
        support: supportPosition,
      })
      return [outcomeId, {
        ...outcome,
        path: remapCanonicalPath(outcome.path, origin, terminal),
      }]
    }))
    return {
      id: choice.id,
      label: visual.label,
      ...completeChoiceCopy(choice, actors.primary.name),
      visual: {
        ...visual,
        labelAnchor: labelAnchorFor(choice.id, previewPath),
        previewPath,
      },
      outcomes: executionOutcomes,
    }
  })

  return {
    schemaVersion: DECISION_SCENE_SCRIPT_V2_SCHEMA,
    id: `decision-scene.freekick.${decision.id}`,
    scenarioId: 'freekick_dangerous',
    minute: decision.coachDecisionEvent.minute,
    side,
    actors,
    actorPositions: runtimeMoment.actorPositions.map((entry) => ({
      runtimeActorId: entry.runtimeActorId,
      normalized: [...entry.normalized],
      facing: entry.facing,
    })),
    wallActorIds: [...runtimeMoment.wallActorIds],
    ball: {
      sourceRuntimeActorId: actors.primary.runtimeActorId,
      normalized: origin,
      anchor: 'root-footline',
    },
    camera: {
      preserveCurrent: true,
      smoothFitRoutes: true,
      allowManualPanWhileChoosing: true,
    },
    runtimeMoment: {
      schemaVersion: runtimeMoment.schemaVersion,
      capturedAtMatchTime: runtimeMoment.capturedAtMatchTime,
      source: 'continuous-match',
    },
    timeline: {
      selectionFeedbackMs: 150,
      settledHoldMs: 1000,
    },
    choices,
    invariants: {
      networking: 'none',
      resultTextInference: false,
      authorityOwner: 'gameplay-layer',
    },
  }
}

function runtimePositionMap(runtimeMoment) {
  return new Map((runtimeMoment?.actorPositions || []).map((entry) => [
    entry.runtimeActorId,
    entry.normalized,
  ]))
}

function nearestActor(actors, positions, point, excludedIds = new Set()) {
  return actors
    .filter((actor) => !excludedIds.has(actor.runtimeActorId))
    .map((actor) => ({ actor, position: positions.get(actor.runtimeActorId) }))
    .filter((entry) => Array.isArray(entry.position))
    .sort((left, right) => (
      Math.hypot(left.position[0] - point[0], left.position[1] - point[1])
      - Math.hypot(right.position[0] - point[0], right.position[1] - point[1])
    ))[0]?.actor || null
}

function generalChoicePreviewTarget(contract, origin, index, count, roles, positions) {
  const spread = count <= 1 ? 0 : (index / (count - 1)) - 0.5
  if (contract.display === 'actor') {
    const actor = index === 0 ? roles.primary : index === 1 ? roles.support : roles.homeGoalkeeper
    const actorPosition = positions.get(actor.runtimeActorId) || origin
    return [actorPosition[0], actorPosition[1], 0]
  }
  if (contract.possession === 'blue') {
    return [
      clamp(origin[0] - 0.16, 0.03, 0.96),
      clamp(origin[1] + spread * 0.34, 0.08, 0.92),
      contract.display === 'zone' ? 0.32 : 0.18,
    ]
  }
  return [
    clamp(origin[0] + 0.18, 0.04, 0.97),
    clamp(origin[1] + spread * 0.34, 0.08, 0.92),
    contract.display === 'zone' ? 0.32 : 0.18,
  ]
}

function generalBezier(origin, target, index, count, height = 0.34) {
  const direction = target[0] >= origin[0] ? 1 : -1
  const spread = count <= 1 ? 0 : (index / (count - 1)) - 0.5
  const dx = Math.max(0.05, Math.abs(target[0] - origin[0]))
  return [
    [...origin],
    [
      clamp(origin[0] + direction * dx * 0.34, 0.02, 1.02),
      clamp(origin[1] + spread * 0.12, 0.03, 0.97),
      height,
    ],
    [
      clamp(origin[0] + direction * dx * 0.72, 0.02, 1.02),
      clamp(target[1] - spread * 0.08, 0.03, 0.97),
      Math.max(height, Number(target[2] || 0)),
    ],
    [...target],
  ]
}

function generalOutcomeTarget(terminal, origin, roles, positions) {
  const pointFor = (actor, fallback) => {
    const point = positions.get(actor?.runtimeActorId)
    return Array.isArray(point) ? [point[0], point[1], 0.2] : fallback
  }
  if (terminal === 'goal-for') return [0.995, clamp(0.5 + (0.5 - origin[1]) * 0.16, 0.42, 0.58), 0.18]
  if (terminal === 'goal-against') return [0.005, clamp(0.5 + (0.5 - origin[1]) * 0.16, 0.42, 0.58), 0.18]
  if (terminal === 'away-goalkeeper') return pointFor(roles.awayGoalkeeper, [0.97, 0.5, 0.24])
  if (terminal === 'home-goalkeeper') return pointFor(roles.homeGoalkeeper, [0.03, 0.5, 0.24])
  if (terminal === 'blocker') return pointFor(roles.blocker, [0.72, 0.5, 0.28])
  if (terminal === 'support') return pointFor(roles.support, [0.62, 0.62, 0])
  if (terminal === 'opponent-transition') return pointFor(roles.opponent, [0.48, 0.5, 0])
  if (terminal === 'out') {
    const direction = origin[0] >= 0.5 ? 1.025 : -0.025
    return [direction, clamp(origin[1] + (origin[1] > 0.5 ? 0.18 : -0.18), 0.03, 0.97), 0.8]
  }
  return [origin[0], origin[1], 0]
}

function outcomeActions(contract, terminal, durationMs) {
  const actions = [{ atMs: 0, role: 'primary', animation: contract.primaryAction }]
  if (terminal === 'away-goalkeeper') {
    actions.push({ atMs: Math.round(durationMs * 0.62), role: 'awayGoalkeeper', animation: 'jump' })
    actions.push({ atMs: Math.round(durationMs * 0.84), role: 'awayGoalkeeper', animation: 'hands_in_front' })
  } else if (terminal === 'home-goalkeeper') {
    actions.push({ atMs: Math.round(durationMs * 0.62), role: 'homeGoalkeeper', animation: 'jump' })
    actions.push({ atMs: Math.round(durationMs * 0.84), role: 'homeGoalkeeper', animation: 'hands_in_front' })
  } else if (terminal === 'blocker') {
    actions.push({ atMs: Math.round(durationMs * 0.64), role: 'blocker', animation: 'jump' })
  }
  return actions
}

/**
 * 53 个正式场景共用同一个导演 schema，但每个 scenario 和每个 outcome
 * 都必须先存在于显式目录中。这里不读取结果文案，也不使用正则猜测球路。
 */
export function buildFormalDecisionSceneScript(decision, actorSource, runtimeMoment) {
  const scenarioId = decision?.coachDecisionEvent?.sourceScenarioId
  if (scenarioId === 'freekick_dangerous') {
    return buildDangerousFreeKickSceneScript(decision, actorSource, runtimeMoment)
  }
  const contract = FORMAL_DECISION_SCENE_CATALOG[scenarioId]
  if (!contract) throw new Error(`正式决策缺少显式场景合同：${scenarioId}`)
  if (!runtimeMoment?.ownerRuntimeActorId || !runtimeMoment?.actorPositions?.length) {
    throw new Error(`${scenarioId} 必须来自连续比赛中的真实 Runtime 瞬间`)
  }

  const redActors = activeActors(actorSource, 'red')
  const blueActors = activeActors(actorSource, 'blue')
  const allActors = [...redActors, ...blueActors]
  const positions = runtimePositionMap(runtimeMoment)
  const origin = [...runtimeMoment.ball.normalized]
  const owner = allActors.find((actor) => actor.runtimeActorId === runtimeMoment.ownerRuntimeActorId)
  const requestedPrimary = actorByPlayerId(
    redActors,
    decision?.coachDecisionEvent?.keyPlayers?.primary?.id,
  )
  const primary = requestedPrimary
    || nearestActor(redActors, positions, origin)
    || redActors[0]
  const support = nearestActor(
    redActors,
    positions,
    positions.get(primary.runtimeActorId) || origin,
    new Set([primary.runtimeActorId]),
  ) || redActors.find((actor) => actor !== primary)
  const homeGoalkeeper = redActors.find((actor) => actor.isGoalkeeper) || redActors[0]
  const awayGoalkeeper = blueActors.find((actor) => actor.isGoalkeeper) || blueActors[0]
  const defendingActors = contract.possession === 'blue' ? redActors : blueActors
  const blocker = nearestActor(
    defendingActors.filter((actor) => !actor.isGoalkeeper),
    positions,
    origin,
  ) || defendingActors[0]
  const opponent = owner?.side === 'blue'
    ? owner
    : nearestActor(blueActors, positions, origin) || blueActors[0]
  const roles = {
    primary,
    support,
    homeGoalkeeper,
    awayGoalkeeper,
    blocker,
    opponent,
  }
  const actors = Object.fromEntries(Object.entries(roles).map(([role, actor]) => [
    role,
    actorReference(actor, role),
  ]))
  const wallActorIds = defendingActors
    .filter((actor) => !actor.isGoalkeeper)
    .map((actor) => ({
      actor,
      point: positions.get(actor.runtimeActorId) || [0.5, 0.5],
    }))
    .sort((left, right) => (
      Math.hypot(left.point[0] - origin[0], left.point[1] - origin[1])
      - Math.hypot(right.point[0] - origin[0], right.point[1] - origin[1])
    ))
    .slice(0, 4)
    .map((entry) => entry.actor.runtimeActorId)

  const choices = decision.choices.map((choice, index) => {
    const previewTarget = generalChoicePreviewTarget(
      contract,
      origin,
      index,
      decision.choices.length,
      roles,
      positions,
    )
    const previewPath = generalBezier(origin, previewTarget, index, decision.choices.length)
    const outcomes = Object.fromEntries((choice.possible_outcomes || []).map((outcomeId) => {
      const terminal = FORMAL_OUTCOME_VISUAL_TERMINALS[outcomeId]
      if (!terminal) throw new Error(`${scenarioId}/${choice.id} 缺少显式结果球路：${outcomeId}`)
      const durationMs = terminal === 'hold' ? 900 : terminal === 'out' ? 1250 : 1450
      const target = generalOutcomeTarget(terminal, origin, roles, positions)
      return [outcomeId, {
        terminal,
        durationMs,
        path: generalBezier(origin, target, index, decision.choices.length, terminal.includes('goal') ? 0.68 : 0.34),
        actions: outcomeActions(contract, terminal, durationMs),
      }]
    }))
    return {
      id: choice.id,
      label: choice.label,
      ...completeChoiceCopy(choice, actors.primary.name),
      visual: {
        kind: contract.display,
        labelAnchor: labelAnchorFor(choice.id, previewPath),
        previewPath,
      },
      outcomes,
    }
  })

  return {
    schemaVersion: DECISION_SCENE_SCRIPT_V2_SCHEMA,
    id: `decision-scene.${scenarioId}.${decision.id}`,
    scenarioId,
    minute: decision.coachDecisionEvent.minute,
    side: 'red',
    actors,
    actorPositions: runtimeMoment.actorPositions.map((entry) => ({
      runtimeActorId: entry.runtimeActorId,
      normalized: [...entry.normalized],
      facing: entry.facing,
    })),
    wallActorIds,
    ball: {
      sourceRuntimeActorId: owner.runtimeActorId,
      normalized: origin,
      anchor: 'root-footline',
    },
    camera: {
      preserveCurrent: true,
      smoothFitRoutes: true,
      allowManualPanWhileChoosing: true,
    },
    runtimeMoment: {
      schemaVersion: runtimeMoment.schemaVersion,
      capturedAtMatchTime: runtimeMoment.capturedAtMatchTime,
      source: 'continuous-match',
    },
    timeline: {
      selectionFeedbackMs: 150,
      settledHoldMs: 1000,
    },
    choices,
    invariants: {
      networking: 'none',
      resultTextInference: false,
      authorityOwner: 'formal-match-session',
    },
  }
}

export function validateDecisionSceneScriptV2(script) {
  const errors = []
  if (script?.schemaVersion !== DECISION_SCENE_SCRIPT_V2_SCHEMA) errors.push('schemaVersion')
  const isDangerousFreeKick = script?.scenarioId === 'freekick_dangerous'
  if (!FORMAL_DECISION_SCENE_CATALOG[script?.scenarioId]) errors.push('scenarioId')
  if (!script?.choices?.length) errors.push('choices')
  if ((script?.actorPositions?.length || 0) < 18) errors.push('actorPositions')
  if (new Set(script?.actorPositions?.map((entry) => entry.runtimeActorId)).size !== script?.actorPositions?.length) errors.push('actorPositions.unique')
  if ((script?.wallActorIds?.length || 0) < 1 || script.wallActorIds.length > 4) errors.push('wallActorIds')
  if (script?.ball?.anchor !== 'root-footline') errors.push('ball.anchor')
  if (script?.camera?.preserveCurrent !== true) errors.push('camera.preserveCurrent')
  if (script?.camera?.smoothFitRoutes !== true) errors.push('camera.smoothFitRoutes')
  if (script?.runtimeMoment?.source !== 'continuous-match') errors.push('runtimeMoment.source')
  if (script?.timeline?.selectionFeedbackMs !== 150) errors.push('timeline.selectionFeedbackMs')
  if (Number(script?.timeline?.settledHoldMs) < 800) errors.push('timeline.settledHoldMs')
  if (script?.invariants?.resultTextInference !== false) errors.push('invariants.resultTextInference')

  for (const choice of script?.choices || []) {
    const expectedOutcomes = isDangerousFreeKick
      ? DANGEROUS_FREE_KICK_OUTCOMES[choice.id] || []
      : Object.keys(choice.outcomes || {})
    if (!['trajectory', 'zone', 'actor'].includes(choice.visual?.kind)) errors.push(`${choice.id}.visual.kind`)
    if (choice.visual?.previewPath?.length !== 4) errors.push(`${choice.id}.visual.previewPath`)
    if (JSON.stringify(choice.visual?.previewPath?.[0]) !== JSON.stringify(script.ball.normalized)) {
      errors.push(`${choice.id}.visual.origin`)
    }
    const actualOutcomes = Object.keys(choice.outcomes || {})
    if (!actualOutcomes.length || JSON.stringify(actualOutcomes.sort()) !== JSON.stringify([...expectedOutcomes].sort())) {
      errors.push(`${choice.id}.outcomes`)
    }
    for (const outcome of Object.values(choice.outcomes || {})) {
      if (outcome.path?.length !== 4) errors.push(`${choice.id}.outcome.path`)
      if (JSON.stringify(outcome.path?.[0]) !== JSON.stringify(script.ball.normalized)) {
        errors.push(`${choice.id}.outcome.origin`)
      }
      const cueTimes = (outcome.actions || []).map((action) => action.atMs)
      if (cueTimes.some((time, index) => index > 0 && time < cueTimes[index - 1])) {
        errors.push(`${choice.id}.actions.order`)
      }
    }
  }
  return { valid: errors.length === 0, errors }
}

export function createDecisionDirectorV2StateMachine() {
  let state = {
    phase: 'idle',
    sceneId: null,
    choiceId: null,
    outcome: null,
    settleCount: 0,
  }

  const snapshot = () => ({ ...state })
  const requirePhase = (phase) => {
    if (state.phase !== phase) {
      throw new Error(`DecisionDirectorV2 期望 ${phase}，当前为 ${state.phase}`)
    }
  }

  return {
    prepare(sceneId) {
      requirePhase('idle')
      state = { ...state, phase: 'staging', sceneId, choiceId: null, outcome: null }
      return snapshot()
    },
    openChoices() {
      requirePhase('staging')
      state = { ...state, phase: 'choosing' }
      return snapshot()
    },
    execute(choiceId, outcome) {
      requirePhase('choosing')
      state = { ...state, phase: 'executing', choiceId, outcome }
      return snapshot()
    },
    settle() {
      if (state.phase === 'settled') return snapshot()
      requirePhase('executing')
      state = { ...state, phase: 'settled', settleCount: state.settleCount + 1 }
      return snapshot()
    },
    restore() {
      requirePhase('settled')
      state = { ...state, phase: 'restoring' }
      return snapshot()
    },
    finishRestore() {
      requirePhase('restoring')
      state = { ...state, phase: 'idle', sceneId: null, choiceId: null, outcome: null }
      return snapshot()
    },
    cancel() {
      state = { ...state, phase: 'idle', sceneId: null, choiceId: null, outcome: null }
      return snapshot()
    },
    getSnapshot: snapshot,
  }
}
