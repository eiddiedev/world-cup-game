import {
  DECISION_RUNTIME_SCENE_TYPES,
  getDecisionRuntimeSceneType,
} from './decisionRuntimeScene.js'

export const MATCH_VISUAL_EVENT_SCHEMA_VERSION = 'match-visual-event-v1'

export const REPRESENTATIVE_MATCH_VISUAL_EVENT_TYPES = Object.freeze([
  'regular_attack',
  'solo_run',
  'corner',
  'dangerous_free_kick',
  'penalty_area_foul',
])

export const MATCH_VISUAL_EVENT_TYPES = DECISION_RUNTIME_SCENE_TYPES

const EMPTY_OUTCOME = Object.freeze({
  id: 'phase_complete',
  scoreDelta: { red: 0, blue: 0 },
  statsDelta: {},
})

export const MATCH_VISUAL_EVENT_DEFINITIONS = Object.freeze({
  regular_attack: {
    label: '常规进攻',
    sourceScenarioId: 'penalty_area_cross',
    primaryPosition: 'MF',
    supportPosition: 'FW',
    cameraPreset: 'normal',
    durationMs: 1800,
    nativeRestart: null,
    sceneProfile: 'open-play',
    actionProfile: 'pass-shot',
    targetRole: 'support',
    path: [[0.36, 0.52], [0.55, 0.44], [0.76, 0.50]],
    outcome: {
      id: 'shot_saved',
      scoreDelta: { red: 0, blue: 0 },
      statsDelta: {
        passes: 2,
        passesCompleted: 2,
        passesAttempted: 2,
        shots: 1,
        shotsOnTarget: 1,
      },
    },
  },
  solo_run: {
    label: '单刀',
    sourceScenarioId: 'solo_run_penalty',
    primaryPosition: 'FW',
    supportPosition: 'MF',
    cameraPreset: 'goal',
    durationMs: 2100,
    nativeRestart: null,
    sceneProfile: 'breakaway',
    actionProfile: 'shot',
    path: [[0.70, 0.50], [0.82, 0.50], [0.94, 0.50]],
    outcome: {
      id: 'goal',
      scoreDelta: { red: 1, blue: 0 },
      statsDelta: { shots: 1, shotsOnTarget: 1, goals: 1 },
    },
  },
  corner: {
    label: '角球',
    sourceScenarioId: 'header_corner',
    primaryPosition: 'MF',
    supportPosition: 'FW',
    cameraPreset: 'corner',
    durationMs: 2200,
    nativeRestart: 'corner',
    sceneProfile: 'attacking-corner',
    actionProfile: 'cross-header',
    targetRole: 'support',
    path: [[0.96, 0.08], [0.84, 0.31], [0.83, 0.50]],
    outcome: {
      id: 'header_wide',
      scoreDelta: { red: 0, blue: 0 },
      statsDelta: { corners: 1, shots: 1 },
    },
  },
  dangerous_free_kick: {
    label: '危险任意球',
    sourceScenarioId: 'freekick_dangerous',
    primaryPosition: 'MF',
    supportPosition: 'FW',
    cameraPreset: 'goal',
    durationMs: 2200,
    nativeRestart: null,
    sceneProfile: 'attacking-free-kick',
    actionProfile: 'free-kick-shot',
    path: [[0.72, 0.50], [0.80, 0.36], [0.90, 0.50]],
    outcome: {
      id: 'wall_block',
      scoreDelta: { red: 0, blue: 0 },
      statsDelta: { freeKicks: 1, shots: 1 },
    },
  },
  penalty_area_foul: {
    label: '禁区犯规 / 点球',
    sourceScenarioId: 'penalty_area_foul_risk',
    primaryPosition: 'FW',
    supportPosition: 'MF',
    cameraPreset: 'penalty',
    durationMs: 2400,
    nativeRestart: null,
    sceneProfile: 'box-duel',
    actionProfile: 'defensive-duel',
    defenderPosition: 'FW',
    sourceRole: 'defender',
    targetRole: 'primary',
    path: [[0.22, 0.50], [0.13, 0.48], [0.08, 0.50]],
    outcome: {
      id: 'penalty_awarded',
      scoreDelta: { red: 0, blue: 0 },
      statsDelta: { foulsWon: 1, penalties: 1 },
      opponentStatsDelta: { fouls: 1, yellowCards: 1 },
    },
  },
  counter_attack: {
    label: '快速反击',
    sourceScenarioId: 'counter_attack_3v2',
    primaryPosition: 'MF',
    supportPosition: 'FW',
    defenderPosition: 'DF',
    cameraPreset: 'normal',
    durationMs: 2300,
    nativeRestart: null,
    sceneProfile: 'counter-attack',
    actionProfile: 'pass-shot',
    targetRole: 'support',
    path: [[0.24, 0.56], [0.52, 0.42], [0.86, 0.50]],
    outcome: EMPTY_OUTCOME,
  },
  penalty_kick: {
    label: '点球',
    sourceScenarioId: 'match_penalty',
    primaryPosition: 'FW',
    supportPosition: 'MF',
    defenderPosition: 'DF',
    cameraPreset: 'penalty',
    durationMs: 2400,
    nativeRestart: null,
    sceneProfile: 'penalty-kick',
    actionProfile: 'penalty-shot',
    path: [[0.885, 0.50], [0.94, 0.46], [0.985, 0.46]],
    outcome: EMPTY_OUTCOME,
  },
  long_shot: {
    label: '远射',
    sourceScenarioId: 'long_shot_opportunity',
    primaryPosition: 'MF',
    supportPosition: 'FW',
    defenderPosition: 'DF',
    cameraPreset: 'goal',
    durationMs: 2100,
    nativeRestart: null,
    sceneProfile: 'long-shot',
    actionProfile: 'shot',
    path: [[0.62, 0.48], [0.78, 0.38], [0.96, 0.48]],
    outcome: EMPTY_OUTCOME,
  },
  through_ball: {
    label: '直塞前插',
    sourceScenarioId: 'through_ball_chance',
    primaryPosition: 'MF',
    supportPosition: 'FW',
    defenderPosition: 'DF',
    cameraPreset: 'normal',
    durationMs: 2200,
    nativeRestart: null,
    sceneProfile: 'through-ball',
    actionProfile: 'pass-shot',
    targetRole: 'support',
    path: [[0.48, 0.57], [0.68, 0.43], [0.88, 0.48]],
    outcome: EMPTY_OUTCOME,
  },
  goalkeeper_action: {
    label: '门将处理',
    sourceScenarioId: 'gk_one_on_one',
    primaryPosition: 'GK',
    supportPosition: 'DF',
    defenderPosition: 'FW',
    cameraPreset: 'goal',
    durationMs: 2200,
    nativeRestart: null,
    sceneProfile: 'goalkeeper-action',
    actionProfile: 'goalkeeper-distribution',
    targetRole: 'support',
    path: [[0.12, 0.50], [0.22, 0.44], [0.39, 0.38]],
    outcome: EMPTY_OUTCOME,
  },
  defensive_duel: {
    label: '最后防守',
    sourceScenarioId: 'last_defender_tackle',
    primaryPosition: 'DF',
    supportPosition: 'GK',
    defenderPosition: 'FW',
    cameraPreset: 'goal',
    durationMs: 2200,
    nativeRestart: null,
    sceneProfile: 'defensive-duel',
    actionProfile: 'defensive-duel',
    sourceRole: 'defender',
    targetRole: 'primary',
    path: [[0.22, 0.48], [0.13, 0.47], [0.05, 0.50]],
    outcome: EMPTY_OUTCOME,
  },
  midfield_battle: {
    label: '中场争夺',
    sourceScenarioId: 'midfield_press_trigger',
    primaryPosition: 'MF',
    supportPosition: 'FW',
    defenderPosition: 'MF',
    cameraPreset: 'normal',
    durationMs: 1900,
    nativeRestart: null,
    sceneProfile: 'midfield-battle',
    actionProfile: 'press-duel',
    targetRole: 'support',
    path: [[0.46, 0.54], [0.52, 0.46], [0.59, 0.52]],
    outcome: EMPTY_OUTCOME,
  },
  tactical_foul: {
    label: '战术犯规',
    sourceScenarioId: 'tactical_foul_counter',
    primaryPosition: 'MF',
    supportPosition: 'DF',
    defenderPosition: 'FW',
    cameraPreset: 'normal',
    durationMs: 2000,
    nativeRestart: null,
    sceneProfile: 'midfield-battle',
    actionProfile: 'tactical-duel',
    sourceRole: 'defender',
    targetRole: 'primary',
    path: [[0.56, 0.52], [0.49, 0.48], [0.42, 0.50]],
    outcome: EMPTY_OUTCOME,
  },
  defending_corner: {
    label: '防守角球',
    sourceScenarioId: 'aerial_duel_corner_defending',
    primaryPosition: 'DF',
    supportPosition: 'GK',
    defenderPosition: 'FW',
    cameraPreset: 'corner',
    durationMs: 2200,
    nativeRestart: 'corner',
    sceneProfile: 'defending-corner',
    actionProfile: 'defensive-header',
    sourceRole: 'defender',
    targetRole: 'primary',
    path: [[0.04, 0.10], [0.15, 0.31], [0.17, 0.50]],
    outcome: EMPTY_OUTCOME,
  },
  offside_trap: {
    label: '越位线',
    sourceScenarioId: 'offside_trap',
    primaryPosition: 'DF',
    supportPosition: 'DF',
    defenderPosition: 'FW',
    cameraPreset: 'normal',
    durationMs: 1900,
    nativeRestart: null,
    sceneProfile: 'offside-line',
    actionProfile: 'line-step',
    sourceRole: 'defender',
    targetRole: 'primary',
    path: [[0.34, 0.50], [0.28, 0.44], [0.18, 0.42]],
    outcome: EMPTY_OUTCOME,
  },
  substitution: {
    label: '换人与体能',
    sourceScenarioId: 'stamina_collapse_sub',
    primaryPosition: 'MF',
    supportPosition: 'MF',
    defenderPosition: 'MF',
    cameraPreset: 'normal',
    durationMs: 1900,
    nativeRestart: null,
    sceneProfile: 'touchline-pause',
    actionProfile: 'pause',
    targetRole: 'support',
    path: [[0.48, 0.88], [0.51, 0.88]],
    outcome: EMPTY_OUTCOME,
  },
  tactical_shape: {
    label: '阵型调整',
    sourceScenarioId: 'trailing_last_ten',
    primaryPosition: 'MF',
    supportPosition: 'FW',
    defenderPosition: 'DF',
    cameraPreset: 'normal',
    durationMs: 2000,
    nativeRestart: null,
    sceneProfile: 'tactical-shape',
    actionProfile: 'pass',
    targetRole: 'support',
    path: [[0.42, 0.52], [0.55, 0.38], [0.66, 0.48]],
    outcome: EMPTY_OUTCOME,
  },
  tactical_pause: {
    label: '战术准备',
    sourceScenarioId: 'extra_time_penalty_shootout_prep',
    primaryPosition: 'FW',
    supportPosition: 'MF',
    defenderPosition: 'DF',
    cameraPreset: 'normal',
    durationMs: 1800,
    nativeRestart: null,
    sceneProfile: 'center-pause',
    actionProfile: 'pause',
    targetRole: 'support',
    path: [[0.50, 0.50], [0.52, 0.50]],
    outcome: EMPTY_OUTCOME,
  },
  var_review: {
    label: 'VAR复核',
    sourceScenarioId: 'var_penalty_review',
    primaryPosition: 'FW',
    supportPosition: 'MF',
    defenderPosition: 'DF',
    cameraPreset: 'penalty',
    durationMs: 2100,
    nativeRestart: null,
    sceneProfile: 'review-pause',
    actionProfile: 'appeal',
    targetRole: 'defender',
    path: [[0.78, 0.52], [0.80, 0.52]],
    outcome: EMPTY_OUTCOME,
  },
  defending_free_kick: {
    label: '防守任意球',
    sourceScenarioId: 'defend_dangerous_freekick',
    primaryPosition: 'GK',
    supportPosition: 'DF',
    defenderPosition: 'MF',
    cameraPreset: 'goal',
    durationMs: 2200,
    nativeRestart: null,
    sceneProfile: 'defending-free-kick',
    actionProfile: 'defensive-wall',
    sourceRole: 'defender',
    targetRole: 'primary',
    path: [[0.28, 0.50], [0.17, 0.37], [0.05, 0.48]],
    outcome: EMPTY_OUTCOME,
  },
  box_scramble: {
    label: '禁区混战',
    sourceScenarioId: 'box_second_ball_chaos',
    primaryPosition: 'DF',
    supportPosition: 'GK',
    defenderPosition: 'FW',
    cameraPreset: 'penalty',
    durationMs: 2100,
    nativeRestart: null,
    sceneProfile: 'box-scramble',
    actionProfile: 'clearance',
    targetRole: 'defender',
    path: [[0.16, 0.53], [0.23, 0.42], [0.39, 0.31]],
    outcome: EMPTY_OUTCOME,
  },
})

const POSITION_ORDER = ['GK', 'DF', 'MF', 'FW']

function findActor(actors, side, position, excludedIds = []) {
  const excluded = new Set(excludedIds)
  return actors.find((actor) => (
    actor.side === side
    && actor.state?.onPitch
    && !excluded.has(actor.runtimeActorId)
    && actor.assignedPosition === position
  )) || actors.find((actor) => (
    actor.side === side
    && actor.state?.onPitch
    && !excluded.has(actor.runtimeActorId)
    && actor.assignedPosition !== 'GK'
  ))
}

function findActorByPlayerId(actors, side, playerId, excludedIds = []) {
  if (!playerId) return null
  const excluded = new Set(excludedIds)
  return actors.find((actor) => (
    actor.side === side
    && actor.playerId === playerId
    && actor.state?.onPitch
    && !excluded.has(actor.runtimeActorId)
  )) || null
}

function actorRef(actor, role) {
  if (!actor) return null
  return {
    role,
    runtimeActorId: actor.runtimeActorId,
    runtimeIndex: actor.runtimeIndex,
    playerId: actor.playerId,
    name: actor.name,
    number: actor.number,
    teamId: actor.teamId,
    side: actor.side,
    position: actor.assignedPosition,
  }
}

function mirrorPath(path, side) {
  if (side === 'red') return path.map(([x, y]) => [x, y])
  return path.map(([x, y]) => [Number((1 - x).toFixed(3)), y])
}

function commentaryFor(type, actors, outcome) {
  const primary = `#${actors.primary.number} ${actors.primary.name}`
  const support = `#${actors.support.number} ${actors.support.name}`
  const lines = {
    regular_attack: [`${primary}向前推进，${support}正在拉开接应角度。`, `${primary}完成传递后形成射门，门将将球挡出。`],
    solo_run: [`${primary}甩开最后一名后卫，单独面对门将。`, `${primary}冷静完成单刀，权威结果记录为进球。`],
    corner: [`${primary}站到角旗区，${support}进入禁区争顶。`, `${support}抢到落点，头球稍稍偏出。`],
    dangerous_free_kick: [`${primary}站在危险任意球前，${support}埋伏在人墙侧后方。`, `${primary}直接攻门，皮球被人墙挡下。`],
    penalty_area_foul: [`${primary}突入禁区，防守球员贴身上抢。`, `${primary}被放倒，权威结果判定点球并出示黄牌。`],
    counter_attack: [`${primary}带球发动快速反击，${support}沿空当高速前插。`, `${primary}与${support}完成反击回合，权威结果已经记录。`],
    penalty_kick: [`${primary}把球摆上点球点，门将站在球门线上。`, `${primary}完成主罚，点球结果已经记录。`],
    long_shot: [`${primary}在禁区外获得起脚空间。`, `${primary}完成远射，门将与球门给出最终结果。`],
    through_ball: [`${primary}观察到防线身后的空当，${support}开始前插。`, `${primary}送出直塞，${support}完成这次纵向进攻。`],
    goalkeeper_action: [`${primary}在禁区内判断来球，准备主动处理。`, `${primary}完成门将回合，球权归属已经确定。`],
    defensive_duel: [`${primary}成为球门前最后一道防线。`, `${primary}完成一对一防守，裁判与比赛结果已经确认。`],
    midfield_battle: [`${primary}靠近持球队员，中场压迫开始。`, `${primary}完成中场对抗，球队随即调整攻守。`],
    tactical_foul: [`${primary}追近反击持球队员，必须立刻作出选择。`, `${primary}完成战术对抗，裁判作出判定。`],
    defending_corner: [`${primary}与${support}组织禁区内的角球防守。`, `${primary}完成第一落点争夺，角球回合结束。`],
    offside_trap: [`${primary}指挥防线同步前压。`, `${primary}完成造越位回合，边裁给出判定。`],
    substitution: [`${primary}来到边线附近，教练组评估体能与换人。`, `${primary}对应的人员调整结果已经记录。`],
    tactical_shape: [`${primary}持球等待全队移动，${support}调整纵深。`, `${primary}完成战术组织，阵型进入新的比赛状态。`],
    tactical_pause: [`${primary}在死球阶段等待教练的战术安排。`, `${primary}完成准备，比赛即将恢复。`],
    var_review: [`${primary}留在事发区域，裁判正在进行VAR复核。`, `${primary}等待结束，VAR结论已经记录。`],
    defending_free_kick: [`${primary}指挥人墙与门前站位。`, `${primary}完成任意球防守回合，结果已经确认。`],
    box_scramble: [`${primary}面对禁区内的二点球混战。`, `${primary}完成紧急处理，禁区局面暂时解除。`],
  }
  const selected = lines[type] || [
    `${primary}进入关键比赛回合，${support}提供接应。`,
    `${primary}完成处理，权威比赛结果已经记录。`,
  ]
  return {
    prelude: selected[0],
    result: selected[1],
    outcomeLabel: outcome.id,
  }
}

export function createMatchVisualEvent({
  type,
  actorSource,
  side = 'red',
  sequence = 1,
  minute = 12,
  outcome,
  actorPlayerIds = {},
  commentary,
} = {}) {
  const definition = MATCH_VISUAL_EVENT_DEFINITIONS[type]
  if (!definition) throw new Error(`未知 MatchVisualEvent 类型：${type}`)
  const actors = actorSource?.actors || []
  const opponentSide = side === 'red' ? 'blue' : 'red'
  const primary = findActorByPlayerId(
    actors,
    side,
    actorPlayerIds.primary,
  ) || findActor(actors, side, definition.primaryPosition)
  const support = findActorByPlayerId(
    actors,
    side,
    actorPlayerIds.support,
    [primary?.runtimeActorId],
  ) || findActor(
    actors,
    side,
    definition.supportPosition,
    [primary?.runtimeActorId],
  )
  const defender = findActor(actors, opponentSide, definition.defenderPosition || 'DF')
  const goalkeeper = findActor(actors, opponentSide, 'GK')
  if (!primary || !support || !defender || !goalkeeper) {
    throw new Error(`MatchVisualEvent ${type} 缺少可用 actor`)
  }

  const resolvedOutcome = {
    ...definition.outcome,
    ...(outcome || {}),
    scoreDelta: {
      ...definition.outcome.scoreDelta,
      ...(outcome?.scoreDelta || {}),
    },
    statsDelta: {
      ...definition.outcome.statsDelta,
      ...(outcome?.statsDelta || {}),
    },
    opponentStatsDelta: {
      ...(definition.outcome.opponentStatsDelta || {}),
      ...(outcome?.opponentStatsDelta || {}),
    },
  }
  const eventActors = {
    primary: actorRef(primary, 'primary'),
    support: actorRef(support, 'support'),
    defender: actorRef(defender, 'defender'),
    goalkeeper: actorRef(goalkeeper, 'goalkeeper'),
  }
  const sourceRole = definition.sourceRole || 'primary'
  const targetRole = definition.targetRole || 'goalkeeper'

  return {
    schemaVersion: MATCH_VISUAL_EVENT_SCHEMA_VERSION,
    id: `visual.${type}.${side}.${String(sequence).padStart(2, '0')}`,
    sequence,
    minute,
    type,
    label: definition.label,
    side,
    sourceScenarioId: definition.sourceScenarioId,
    actors: eventActors,
    ball: {
      coordinateSpace: 'normalized-pitch',
      motion: 'continuous-spline',
      snapToCoordinates: false,
      path: mirrorPath(definition.path, side),
      sourceRole,
      targetRole,
      sourceRuntimeActorId: eventActors[sourceRole].runtimeActorId,
      targetRuntimeActorId: eventActors[targetRole].runtimeActorId,
    },
    runtime: {
      cameraPreset: definition.cameraPreset,
      durationMs: definition.durationMs,
      nativeRestart: definition.nativeRestart,
      sceneProfile: definition.sceneProfile,
      actionProfile: definition.actionProfile,
      presentationOnly: true,
    },
    outcome: resolvedOutcome,
    commentary: (() => {
      const fallback = commentaryFor(type, eventActors, resolvedOutcome)
      return {
        ...fallback,
        prelude: commentary?.prelude || fallback.prelude,
        result: commentary?.result || fallback.result,
      }
    })(),
    completion: {
      eventName: 'ab-match-visual-event-completed',
      mustCompleteBeforeNext: true,
    },
    authority: {
      owner: 'gameplay-layer',
      runtimeMayWriteScore: false,
      runtimeMayWriteCards: false,
      runtimeMayWriteInjuries: false,
      runtimeMayWriteSubstitutions: false,
    },
    invariants: {
      actorTeleportAllowed: false,
      ballTeleportAllowed: false,
      duplicatePlaybackAllowed: false,
      networking: 'none',
    },
  }
}

export function createMatchVisualEventFromCoachDecision({
  coachDecisionEvent,
  result,
  resultText,
  actorSource,
  side = 'red',
  sequence = 1,
} = {}) {
  const sourceScenarioId = coachDecisionEvent?.sourceScenarioId
  const type = getDecisionRuntimeSceneType(coachDecisionEvent)
  if (!type) return null
  const homeScoreChange = Number(result?.homeScoreChange) || 0
  const awayScoreChange = Number(result?.awayScoreChange) || 0
  let event = createMatchVisualEvent({
    type,
    actorSource,
    side,
    sequence,
    minute: coachDecisionEvent.minute,
    actorPlayerIds: {
      primary: coachDecisionEvent.keyPlayers?.primary?.id,
      support: coachDecisionEvent.keyPlayers?.support?.id,
    },
    outcome: {
      id: result?.outcome || 'pending',
      scoreDelta: side === 'red'
        ? { red: homeScoreChange, blue: awayScoreChange }
        : { red: awayScoreChange, blue: homeScoreChange },
    },
    commentary: {
      prelude: coachDecisionEvent.situation,
      result: resultText,
    },
  })
  if (['gk_one_on_one', 'keeper_sweeper_claim'].includes(sourceScenarioId)) {
    event = {
      ...event,
      ball: {
        ...event.ball,
        path: mirrorPath([[0.24, 0.50], [0.12, 0.48], [0.07, 0.50]], side),
        sourceRole: 'defender',
        targetRole: 'primary',
        sourceRuntimeActorId: event.actors.defender.runtimeActorId,
        targetRuntimeActorId: event.actors.primary.runtimeActorId,
      },
      runtime: {
        ...event.runtime,
        sceneProfile: 'goalkeeper-save',
        actionProfile: 'goalkeeper-claim',
      },
    }
  }
  if (sourceScenarioId === 'penalty_area_dive') {
    event = {
      ...event,
      ball: {
        ...event.ball,
        path: mirrorPath([[0.77, 0.50], [0.84, 0.48], [0.88, 0.50]], side),
        sourceRole: 'primary',
        targetRole: 'goalkeeper',
        sourceRuntimeActorId: event.actors.primary.runtimeActorId,
        targetRuntimeActorId: event.actors.goalkeeper.runtimeActorId,
      },
      runtime: {
        ...event.runtime,
        sceneProfile: 'box-duel',
        actionProfile: 'tackle-fall',
      },
    }
  }
  return {
    ...event,
    sourceScenarioId,
    source: {
      kind: 'coach-decision-event',
      id: coachDecisionEvent.id,
      sourceScenarioId,
      resultOutcome: result?.outcome || null,
    },
  }
}

export function buildRepresentativeMatchVisualEvents(actorSource, options = {}) {
  const side = options.side === 'blue' ? 'blue' : 'red'
  const startMinute = Number(options.startMinute) || 12
  return REPRESENTATIVE_MATCH_VISUAL_EVENT_TYPES.map((type, index) => createMatchVisualEvent({
    type,
    actorSource,
    side,
    sequence: index + 1,
    minute: startMinute + (index * 7),
  }))
}

export function validateMatchVisualEvent(event, actorSource) {
  const errors = []
  const availableActors = new Map((actorSource?.actors || []).map((actor) => [
    actor.runtimeActorId,
    actor,
  ]))
  if (event?.schemaVersion !== MATCH_VISUAL_EVENT_SCHEMA_VERSION) errors.push('schemaVersion')
  if (!MATCH_VISUAL_EVENT_TYPES.includes(event?.type)) errors.push('type')
  if (!event?.id) errors.push('id')
  if (!Number.isInteger(event?.sequence) || event.sequence < 1) errors.push('sequence')
  if (!Number.isFinite(event?.minute) || event.minute < 0) errors.push('minute')
  if (event?.authority?.runtimeMayWriteScore !== false) errors.push('authority.score')
  if (event?.invariants?.actorTeleportAllowed !== false) errors.push('actor-teleport')
  if (event?.invariants?.ballTeleportAllowed !== false) errors.push('ball-teleport')
  if (event?.invariants?.networking !== 'none') errors.push('networking')
  if (event?.completion?.mustCompleteBeforeNext !== true) errors.push('completion-order')
  if (!Number.isFinite(event?.runtime?.durationMs) || event.runtime.durationMs < 250) {
    errors.push('duration')
  }

  const actorRefs = Object.values(event?.actors || {})
  for (const reference of actorRefs) {
    const actor = availableActors.get(reference?.runtimeActorId)
    if (!actor || actor.playerId !== reference.playerId || !actor.state?.onPitch) {
      errors.push(`actor.${reference?.role || 'unknown'}`)
    }
  }
  if (new Set(actorRefs.map((reference) => reference?.runtimeActorId)).size !== actorRefs.length) {
    errors.push('actor-duplicate')
  }

  const path = event?.ball?.path || []
  if (path.length < 2) errors.push('ball.path')
  if (path.some((point) => (
    !Array.isArray(point)
    || point.length !== 2
    || point.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  ))) errors.push('ball.path-range')
  if (event?.ball?.sourceRuntimeActorId !== event?.actors?.[event?.ball?.sourceRole]?.runtimeActorId) {
    errors.push('ball.source-role')
  }
  if (event?.ball?.targetRuntimeActorId !== event?.actors?.[event?.ball?.targetRole]?.runtimeActorId) {
    errors.push('ball.target-role')
  }
  for (const side of ['red', 'blue']) {
    if (!Number.isFinite(event?.outcome?.scoreDelta?.[side])) errors.push(`scoreDelta.${side}`)
  }
  if (!event?.commentary?.prelude || !event?.commentary?.result) errors.push('commentary')

  return { valid: errors.length === 0, errors }
}

export function createMatchVisualAuthorityState() {
  return {
    score: { red: 0, blue: 0 },
    stats: { red: {}, blue: {} },
    commentary: [],
    consumedEventIds: [],
  }
}

export function applyMatchVisualEventAuthority(state, event) {
  if (state.consumedEventIds.includes(event.id)) return state
  const next = JSON.parse(JSON.stringify(state))
  const sideStats = next.stats[event.side] || (next.stats[event.side] = {})
  const opponentSide = event.side === 'red' ? 'blue' : 'red'
  const opponentStats = next.stats[opponentSide] || (next.stats[opponentSide] = {})
  next.score.red += event.outcome.scoreDelta.red
  next.score.blue += event.outcome.scoreDelta.blue
  for (const [key, value] of Object.entries(event.outcome.statsDelta || {})) {
    sideStats[key] = (sideStats[key] || 0) + value
  }
  for (const [key, value] of Object.entries(event.outcome.opponentStatsDelta || {})) {
    opponentStats[key] = (opponentStats[key] || 0) + value
  }
  next.commentary.push({
    eventId: event.id,
    minute: event.minute,
    text: event.commentary.result,
  })
  next.consumedEventIds.push(event.id)
  return next
}

export function createMatchVisualEventQueue({ playEvent, onTransition } = {}) {
  if (typeof playEvent !== 'function') throw new Error('playEvent callback is required')
  const state = {
    status: 'idle',
    queued: [],
    activeEventId: null,
    completedEventIds: [],
    failedEventId: null,
  }
  let runningPromise = null

  const snapshot = () => JSON.parse(JSON.stringify(state))
  const notify = (event) => onTransition?.(snapshot(), event)

  const drain = async () => {
    if (runningPromise) return runningPromise
    runningPromise = (async () => {
      while (state.queued.length > 0) {
        const event = state.queued.shift()
        state.status = 'playing'
        state.activeEventId = event.id
        notify(event)
        try {
          await playEvent(event)
        } catch (error) {
          state.status = 'failed'
          state.failedEventId = event.id
          state.activeEventId = null
          notify(event)
          throw error
        }
        state.completedEventIds.push(event.id)
        state.activeEventId = null
        state.status = state.queued.length ? 'queued' : 'completed'
        notify(event)
      }
      return snapshot()
    })()
    try {
      return await runningPromise
    } finally {
      runningPromise = null
    }
  }

  return {
    enqueue(events) {
      const nextEvents = Array.isArray(events) ? events : [events]
      const knownIds = new Set([
        ...state.queued.map((event) => event.id),
        ...state.completedEventIds,
        state.activeEventId,
      ].filter(Boolean))
      for (const event of nextEvents) {
        if (!event?.id || knownIds.has(event.id)) continue
        state.queued.push(event)
        knownIds.add(event.id)
      }
      if (state.queued.length && state.status !== 'playing') state.status = 'queued'
      notify(null)
      return snapshot()
    },
    drain,
    getSnapshot: snapshot,
  }
}

export function getMatchVisualEventPositionOrder() {
  return [...POSITION_ORDER]
}
