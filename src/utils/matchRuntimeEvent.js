export const MATCH_RUNTIME_EVENT_V1_SCHEMA = 'match-runtime-event-v1'

export const MATCH_RUNTIME_EVENT_TYPES = Object.freeze([
  'touch',
  'pass',
  'shot',
  'possession-change',
  'tackle-contact',
  'save',
  'post-hit',
  'crossbar-hit',
  'corner',
  'throw-in',
  'goal-kick',
  'kickoff',
  'goal',
  'ball-out',
  'period-change',
  'foul',
  'offside',
  'card',
  'injury',
  'handball-review',
  'var-review',
  'var-result',
  'throw-in-violation',
  'penalty',
])

const DERIVED_TYPES = new Set([
  'foul',
  'offside',
  'card',
  'injury',
  'handball-review',
  'var-review',
  'var-result',
  'throw-in-violation',
  'penalty',
])

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0))
}

export function createMatchRuntimeEvent(payload = {}) {
  const event = {
    schemaVersion: MATCH_RUNTIME_EVENT_V1_SCHEMA,
    id: String(payload.id || ''),
    type: payload.type,
    sourceEventId: payload.sourceEventId || null,
    timestamp: Number(payload.timestamp || Date.now()),
    frameId: Math.max(0, Number(payload.frameId || 0)),
    matchTime: Math.max(0, Number(payload.matchTime || 0)),
    minute: clamp(payload.minute, 0, 120),
    side: payload.side === 'blue' ? 'blue' : payload.side === 'red' ? 'red' : null,
    previousSide: payload.previousSide === 'blue'
      ? 'blue'
      : payload.previousSide === 'red'
        ? 'red'
        : null,
    actorRuntimeIds: [...new Set((payload.actorRuntimeIds || []).filter(Boolean))],
    primaryRuntimeActorId: payload.primaryRuntimeActorId || null,
    secondaryRuntimeActorId: payload.secondaryRuntimeActorId || null,
    ball: {
      before: Array.isArray(payload.ball?.before) ? [...payload.ball.before] : null,
      after: Array.isArray(payload.ball?.after) ? [...payload.ball.after] : null,
    },
    runtimeStateBefore: payload.runtimeStateBefore || null,
    runtimeStateAfter: payload.runtimeStateAfter || null,
    detail: payload.detail && typeof payload.detail === 'object' ? { ...payload.detail } : {},
  }
  return event
}

export function validateMatchRuntimeEventV1(event) {
  const errors = []
  if (event?.schemaVersion !== MATCH_RUNTIME_EVENT_V1_SCHEMA) errors.push('schemaVersion')
  if (!event?.id) errors.push('id')
  if (!MATCH_RUNTIME_EVENT_TYPES.includes(event?.type)) errors.push('type')
  if (!Number.isFinite(event?.frameId)) errors.push('frameId')
  if (!Number.isFinite(event?.matchTime)) errors.push('matchTime')
  if (!Number.isFinite(event?.minute)) errors.push('minute')
  if (!event?.ball || (!Array.isArray(event.ball.before) && !Array.isArray(event.ball.after))) {
    errors.push('ball')
  }
  if (DERIVED_TYPES.has(event?.type) && !event?.sourceEventId) errors.push('sourceEventId')
  if (event?.sourceEventId === event?.id) errors.push('sourceEventId.self')
  return { valid: errors.length === 0, errors }
}

export function createDerivedMatchRuntimeEvent(sourceEvent, payload = {}) {
  if (!sourceEvent?.id) throw new Error('派生比赛事件缺少 sourceEvent')
  const event = createMatchRuntimeEvent({
    ...sourceEvent,
    ...payload,
    id: payload.id,
    type: payload.type,
    sourceEventId: sourceEvent.id,
    detail: { ...sourceEvent.detail, ...payload.detail },
  })
  const validation = validateMatchRuntimeEventV1(event)
  if (!validation.valid) {
    throw new Error(`MatchRuntimeEventV1 校验失败：${validation.errors.join(', ')}`)
  }
  return event
}

export function decisionReadingSeconds(decision) {
  const visibleText = (decision?.choices || []).map((choice) => [
    choice.label,
    choice.desc,
    choice.risk,
    choice.reward,
    choice.successHint,
  ].filter(Boolean).join('')).join('')
  return clamp(Math.ceil([...visibleText].length / 10) + 4, 15, 25)
}
