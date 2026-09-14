const RESTART_EXEMPTIONS = new Set(['corner', 'throw-in', 'goal-kick'])
const INVOLVEMENT_TYPES = new Set(['touch', 'challenge', 'obstruct-goalkeeper', 'rebound'])
const POSITION_EPSILON = 1e-6

function normalizedX(value) {
  return Math.max(0, Math.min(1, Number(value) || 0))
}

function event(type, state, detail = {}) {
  return {
    type,
    sourceEventId: state.sourceEventId,
    attackingSide: state.attackingSide,
    offencePosition: state.offencePosition,
    ...detail,
  }
}

export function createOffsideState() {
  return {
    schemaVersion: 'offside-state-v1',
    status: 'idle',
    sourceEventId: null,
    frozenFrame: null,
    attackingSide: null,
    attackDirection: 1,
    offsideLine: null,
    candidatePlayerIds: [],
    offencePlayerId: null,
    involvementType: null,
    offencePosition: null,
    delayed: false,
    scoreRollbackToken: null,
    scoreRollbackApplied: false,
    events: [],
  }
}

function secondLastDefenderLine(defenders, attackDirection) {
  if (defenders.length < 2) return attackDirection > 0 ? 1 : 0
  return [...defenders]
    .map((player) => normalizedX(player.x))
    .sort((left, right) => attackDirection > 0 ? right - left : left - right)[1]
}

export function freezeOffsideFrame(payload = {}) {
  const base = createOffsideState()
  const restartType = String(payload.restartType || 'open-play')
  if (RESTART_EXEMPTIONS.has(restartType)) {
    return { ...base, status: 'exempt', sourceEventId: payload.sourceEventId || null }
  }
  const attackingSide = payload.attackingSide === 'blue' ? 'blue' : 'red'
  const defendingSide = attackingSide === 'red' ? 'blue' : 'red'
  const attackDirection = Number(payload.attackDirection) < 0 ? -1 : 1
  const ballX = normalizedX(payload.ball?.x ?? payload.ballX)
  const players = (payload.players || []).map((player) => ({
    ...player,
    x: normalizedX(player.x),
    y: normalizedX(player.y),
  }))
  const defenders = players.filter((player) => player.side === defendingSide)
  const offsideLine = secondLastDefenderLine(defenders, attackDirection)
  const passerId = payload.passerPlayerId || null
  const candidates = players.filter((player) => {
    if (player.side !== attackingSide || player.playerId === passerId) return false
    const inOpponentHalf = attackDirection > 0
      ? player.x > 0.5 + POSITION_EPSILON
      : player.x < 0.5 - POSITION_EPSILON
    const aheadOfBall = attackDirection * (player.x - ballX) > POSITION_EPSILON
    const beyondSecondLast = attackDirection * (player.x - offsideLine) > POSITION_EPSILON
    return inOpponentHalf && aheadOfBall && beyondSecondLast
  })
  return {
    ...base,
    status: candidates.length ? 'watching' : 'onside',
    sourceEventId: payload.sourceEventId || null,
    frozenFrame: {
      frameId: payload.frameId ?? null,
      ball: { x: ballX, y: normalizedX(payload.ball?.y ?? payload.ballY) },
      players,
      restartType,
    },
    attackingSide,
    attackDirection,
    offsideLine,
    candidatePlayerIds: candidates.map((player) => player.playerId),
  }
}

export function isOffsideDangerArea({ x, ballX, attackDirection = 1, pitchLength = 105 } = {}) {
  const dangerDepth = (16.5 + 8) / Math.max(90, Number(pitchLength) || 105)
  const furthestX = attackDirection > 0
    ? Math.max(normalizedX(x), normalizedX(ballX))
    : Math.min(normalizedX(x), normalizedX(ballX))
  return attackDirection > 0 ? furthestX >= 1 - dangerDepth : furthestX <= dangerDepth
}

export function registerOffsideInvolvement(state, involvement = {}) {
  if (!state || state.status !== 'watching') return state
  const playerId = involvement.playerId || involvement.runtimeActorId
  const involvementType = INVOLVEMENT_TYPES.has(involvement.type) ? involvement.type : null
  if (!involvementType || !state.candidatePlayerIds.includes(playerId)) return state
  const offencePosition = {
    x: normalizedX(involvement.x),
    y: normalizedX(involvement.y),
  }
  const delayed = involvement.delayed ?? isOffsideDangerArea({
    x: offencePosition.x,
    ballX: involvement.ballX,
    attackDirection: state.attackDirection,
    pitchLength: involvement.pitchLength,
  })
  const next = {
    ...state,
    status: delayed ? 'delayed' : 'called',
    offencePlayerId: playerId,
    involvementType,
    offencePosition,
    delayed,
  }
  next.events = delayed
    ? [...state.events, event('offside_pending', next, { playerId, involvementType })]
    : [
      ...state.events,
      event('offside_called', next, { playerId, involvementType }),
      event('indirect_free_kick', next, { awardedSide: state.attackingSide === 'red' ? 'blue' : 'red' }),
    ]
  return next
}

export function registerDefenderPlay(state, { kind } = {}) {
  if (!state || !['watching', 'delayed'].includes(state.status)) return state
  if (kind === 'deliberate-play' || kind === 'controlled-possession') {
    return { ...createOffsideState(), status: 'cleared' }
  }
  // Ordinary deflections and deliberate saves do not reset an offside position.
  return state
}

export function resolveDelayedOffside(state, terminal = {}) {
  if (!state || state.status !== 'delayed') return state
  const goal = terminal.type === 'goal'
  const rollbackToken = goal
    ? (state.scoreRollbackToken || `offside-rollback:${terminal.goalEventId || state.sourceEventId}`)
    : state.scoreRollbackToken
  const applyRollback = goal && !state.scoreRollbackApplied
  const next = {
    ...state,
    status: 'called',
    scoreRollbackToken: rollbackToken,
    scoreRollbackApplied: state.scoreRollbackApplied || applyRollback,
  }
  const newEvents = []
  if (goal && applyRollback) {
    newEvents.push(event('goal_disallowed', next, {
      goalEventId: terminal.goalEventId || null,
      scoringSide: terminal.scoringSide || state.attackingSide,
      rollbackToken,
    }))
  }
  newEvents.push(event('offside_called', next, {
    playerId: state.offencePlayerId,
    involvementType: state.involvementType,
    delayedFrom: terminal.type || 'attack-ended',
  }))
  newEvents.push(event('indirect_free_kick', next, {
    awardedSide: state.attackingSide === 'red' ? 'blue' : 'red',
  }))
  return { ...next, events: [...state.events, ...newEvents] }
}

export function consumeOffsideEvents(state) {
  if (!state?.events?.length) return { state, events: [] }
  return { state: { ...state, events: [] }, events: [...state.events] }
}
