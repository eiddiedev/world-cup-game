import { getFormalDecisionSceneContractV3 } from './formalDecisionSceneCatalogV3.js'

// 53 决策场景专项测试：按场景合同把 22 人和足球摆到语义正确的位置。
// 每个 trigger 给出球点（归一化）、持球方和持球人位置偏好；
// 红队向右进攻（x 增大），蓝队向左进攻（x 减小）。
const TRIGGER_STAGING = Object.freeze({
  'solo-breakaway': { side: 'red', ball: [0.78, 0.5], owner: 'FW' },
  'wide-cross-window': { side: 'red', ball: [0.72, 0.14], owner: 'FW' },
  'counter-overload': { side: 'red', ball: [0.55, 0.5], owner: 'MF' },
  'long-shot-window': { side: 'red', ball: [0.65, 0.5], owner: 'MF' },
  'through-run-window': { side: 'red', ball: [0.62, 0.45], owner: 'MF' },
  'box-tackle-window': { side: 'blue', ball: [0.22, 0.5], owner: 'FW' },
  'goalkeeper-one-on-one': { side: 'blue', ball: [0.18, 0.5], owner: 'FW' },
  'last-defender-duel': { side: 'blue', ball: [0.3, 0.3], owner: 'FW' },
  'midfield-press-window': { side: 'blue', ball: [0.5, 0.5], owner: 'MF' },
  'counter-contact-window': { side: 'blue', ball: [0.55, 0.5], owner: 'FW' },
  'offside-line-window': { side: 'blue', ball: [0.45, 0.5], owner: 'MF' },
  'last-ditch-shot': { side: 'blue', ball: [0.2, 0.5], owner: 'FW' },
  'keeper-in-hands': { side: 'red', ball: [0.05, 0.5], owner: 'GK', ballInHands: true },
  'midfield-loose-ball': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'box-scramble': { side: 'blue', ball: [0.2, 0.45], owner: 'FW' },
  'box-contact-attack': { side: 'red', ball: [0.8, 0.5], owner: 'FW' },
  'box-second-ball': { side: 'blue', ball: [0.24, 0.5], owner: 'MF' },
  'wing-overlap': { side: 'red', ball: [0.68, 0.18], owner: 'MF' },
  'cutback-window': { side: 'red', ball: [0.86, 0.15], owner: 'FW' },
  'half-space-run': { side: 'red', ball: [0.64, 0.38], owner: 'MF' },
  'defensive-turnover': { side: 'red', ball: [0.32, 0.5], owner: 'DF' },
  'high-press-window': { side: 'blue', ball: [0.88, 0.5], owner: 'DF' },
  'switch-play-window': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'fullback-recovery': { side: 'blue', ball: [0.35, 0.2], owner: 'FW' },
  'sweeper-window': { side: 'blue', ball: [0.22, 0.3], owner: 'MF' },
  'corner-second-ball': { side: 'red', ball: [0.78, 0.5], owner: 'MF' },
  'set-piece-rebound': { side: 'red', ball: [0.8, 0.5], owner: 'FW' },
  'penalty-rebound': { side: 'red', ball: [0.84, 0.5], owner: 'FW' },
  'booked-defender-duel': { side: 'blue', ball: [0.4, 0.5], owner: 'FW' },
  'wet-pitch-tackle': { side: 'blue', ball: [0.45, 0.5], owner: 'FW', weather: 'rain' },
  // blackout-stage：摆位由场景 staging 接管，这里只需保证持球方与球点合理
  'dangerous-free-kick': { side: 'red', ball: [0.68, 0.5], owner: 'MF' },
  'penalty-awarded': { side: 'red', ball: [0.885, 0.5], owner: 'FW' },
  'attacking-corner': { side: 'red', ball: [0.985, 0.035], owner: 'MF' },
  'defending-corner': { side: 'blue', ball: [0.015, 0.035], owner: 'MF' },
  'box-indirect-free-kick': { side: 'red', ball: [0.82, 0.5], owner: 'MF' },
  'shootout-round': { side: 'red', ball: [0.885, 0.5], owner: 'FW' },
  'attacking-throw-in': { side: 'red', ball: [0.6, 0.02], owner: 'MF' },
  'defending-dangerous-free-kick': { side: 'blue', ball: [0.32, 0.5], owner: 'MF' },
  'late-attacking-corner': { side: 'red', ball: [0.985, 0.035], owner: 'MF' },
  // 事故判罚 / 比赛状态：中场球即可，源事件与状态驱动
  'stamina-dead-ball': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'trailing-final-ten': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'leading-final-ten': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'extra-time-penalty-prep': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'goal-var-review': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'penalty-var-review': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'offside-goal-review': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'defensive-handball-review': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'attacking-handball-claim': { side: 'red', ball: [0.75, 0.5], owner: 'FW' },
  'injury-contact': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
  'yellow-card-dissent': { side: 'red', ball: [0.5, 0.5], owner: 'MF' },
})

function activeActors(actorSource, side) {
  return (actorSource?.actors || []).filter((actor) => (
    actor.side === side && actor.state?.onPitch
  ))
}

function pickOwner(candidates, ball, positionPref) {
  const rank = { FW: 0, MF: 1, DF: 2, GK: 3 }
  return [...candidates].sort((left, right) => {
    const leftRank = left.assignedPosition === positionPref ? -1 : rank[left.assignedPosition] ?? 4
    const rightRank = right.assignedPosition === positionPref ? -1 : rank[right.assignedPosition] ?? 4
    return leftRank - rightRank
  })[0] || candidates[0]
}

// 以球点为中心生成 22 人阵形：持球方整体压上，防守方在球与球门之间布防
function formationPositions(ball, attackingSide, redActors, blueActors) {
  const attackDir = attackingSide === 'red' ? 1 : -1
  const positions = new Map()
  const gkLine = (side) => (side === 'red'
    ? (attackDir === 1 ? 0.045 : 0.955)
    : (attackDir === 1 ? 0.955 : 0.045))
  const layoutSide = (actors, side) => {
    const isAttacking = side === attackingSide
    const goalkeeper = actors.find((actor) => actor.isGoalkeeper)
    const outfield = actors.filter((actor) => !actor.isGoalkeeper)
    if (goalkeeper) {
      positions.set(goalkeeper.runtimeActorId, [gkLine(side), 0.5])
    }
    outfield.forEach((actor, index) => {
      const row = Math.floor(index / 4)
      const col = index % 4
      if (isAttacking) {
        positions.set(actor.runtimeActorId, [
          Math.min(0.97, Math.max(0.03, ball[0] - attackDir * (0.16 - row * 0.09))),
          0.2 + col * 0.2 + (row % 2) * 0.08,
        ])
      } else {
        positions.set(actor.runtimeActorId, [
          Math.min(0.97, Math.max(0.03, ball[0] + attackDir * (0.07 + row * 0.09))),
          0.22 + col * 0.18 + (row % 2) * 0.07,
        ])
      }
    })
  }
  layoutSide(redActors, 'red')
  layoutSide(blueActors, 'blue')
  return positions
}

export function buildDecisionSceneTestMoment(scenarioId, actorSource) {
  const contract = getFormalDecisionSceneContractV3(scenarioId)
  if (!contract) throw new Error(`未知决策场景：${scenarioId}`)
  const staging = TRIGGER_STAGING[contract.triggerId]
    || { side: contract.attackingSide || 'red', ball: [0.5, 0.5], owner: 'MF' }
  const redActors = activeActors(actorSource, 'red')
  const blueActors = activeActors(actorSource, 'blue')
  const attackingActors = staging.side === 'red' ? redActors : blueActors
  const defendingActors = staging.side === 'red' ? blueActors : redActors
  const owner = pickOwner(attackingActors.filter((actor) => !actor.isGoalkeeper), staging.ball, staging.owner)
    || attackingActors[0]
  const positions = formationPositions(staging.ball, staging.side, redActors, blueActors)
  positions.set(owner.runtimeActorId, [
    Math.min(0.97, Math.max(0.03, staging.ball[0] + (staging.side === 'red' ? -1 : 1) * 0.012)),
    staging.ball[1],
  ])
  const redGoalkeeper = redActors.find((actor) => actor.isGoalkeeper)
  const blueGoalkeeper = blueActors.find((actor) => actor.isGoalkeeper)
  const defendingGoalkeeper = defendingActors.find((actor) => actor.isGoalkeeper)
  const attackingGoalkeeper = attackingActors.find((actor) => actor.isGoalkeeper)
  const defenders = defendingActors
    .filter((actor) => !actor.isGoalkeeper)
    .sort((left, right) => {
      const leftPos = positions.get(left.runtimeActorId) || [0.5, 0.5]
      const rightPos = positions.get(right.runtimeActorId) || [0.5, 0.5]
      return Math.hypot(leftPos[0] - staging.ball[0], leftPos[1] - staging.ball[1])
        - Math.hypot(rightPos[0] - staging.ball[0], rightPos[1] - staging.ball[1])
    })
  const support = attackingActors.find((actor) => (
    !actor.isGoalkeeper && actor.runtimeActorId !== owner.runtimeActorId
  )) || owner
  const attackDirection = staging.side === 'red' ? 1 : -1
  return {
    schemaVersion: 'runtime-decision-moment-v1',
    capturedAtMatchTime: 44,
    runtimeState: 'Match',
    ballOutOfPlay: false,
    attackingSide: staging.side,
    attackDirection,
    ownerRuntimeActorId: owner.runtimeActorId,
    ownerIsGoalkeeper: Boolean(staging.ballInHands),
    ballInHands: Boolean(staging.ballInHands),
    primaryRuntimeActorId: owner.runtimeActorId,
    supportRuntimeActorId: support.runtimeActorId,
    aerialTargetRuntimeActorId: support.runtimeActorId,
    goalkeeperRuntimeActorId: defendingGoalkeeper?.runtimeActorId || null,
    ownGoalkeeperRuntimeActorId: attackingGoalkeeper?.runtimeActorId || null,
    defenderRuntimeActorId: defenders[0]?.runtimeActorId || null,
    wallActorIds: defenders.slice(0, 4).map((actor) => actor.runtimeActorId),
    homeGoalkeeperRuntimeActorId: redGoalkeeper?.runtimeActorId || null,
    awayGoalkeeperRuntimeActorId: blueGoalkeeper?.runtimeActorId || null,
    goalAnchors: {
      attacking: [attackDirection > 0 ? 1 : 0, 0.5],
      own: [attackDirection > 0 ? 0 : 1, 0.5],
    },
    ball: { normalized: [...staging.ball, 0] },
    actorPositions: [...redActors, ...blueActors].map((actor) => ({
      runtimeActorId: actor.runtimeActorId,
      normalized: positions.get(actor.runtimeActorId) || [0.5, 0.5],
      facing: actor.side === 'red' ? 'right' : 'left',
    })),
    weather: staging.weather || 'clear',
    testStaging: {
      scenarioId,
      triggerId: contract.triggerId,
      ownerPrefPosition: staging.owner,
      ballInHands: Boolean(staging.ballInHands),
    },
  }
}

export function decisionSceneTestWeather(scenarioId) {
  const contract = getFormalDecisionSceneContractV3(scenarioId)
  const staging = contract && TRIGGER_STAGING[contract.triggerId]
  return staging?.weather || 'clear'
}
