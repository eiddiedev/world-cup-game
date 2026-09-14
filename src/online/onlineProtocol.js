export const ONLINE_PROTOCOL_VERSION = 'happyseed-online-v1'
export const ONLINE_ROOM_CODE_PATTERN = /^\d{6}$/
export const ONLINE_RECONNECT_GRACE_MS = 20_000
export const ONLINE_MAX_CONNECTIONS = 200
export const ONLINE_MAX_ROOMS = 100
export const ONLINE_INPUT_HZ = 20
export const ONLINE_SNAPSHOT_HZ = 12
export const ONLINE_INTERPOLATION_MS = 100

export const ONLINE_MESSAGE = Object.freeze({
  CREATE_ROOM: 'room:create',
  JOIN_ROOM: 'room:join',
  RECONNECT: 'room:reconnect',
  SELECT_TEAM: 'room:select-team',
  LOCK_LINEUP: 'room:lock-lineup',
  READY: 'room:ready',
  INPUT: 'match:input',
  TACTICS: 'match:tactics',
  SUBSTITUTION_REQUEST: 'match:substitution-request',
  CONTROL: 'match:control',
  SNAPSHOT: 'match:snapshot',
  EVENT: 'match:event',
  PENALTY_CHOICE: 'match:penalty-choice',
  PENALTY_STATE: 'match:penalty-state',
  REMATCH: 'match:rematch',
  ROOM_STATE: 'room:state',
  MATCH_STARTED: 'match:started',
  MATCH_PAUSED: 'match:paused',
  MATCH_ABORTED: 'match:aborted',
  MATCH_ENDED: 'match:ended',
  ERROR: 'error',
  PING: 'ping',
  PONG: 'pong',
})

export const MATCH_RULESETS = Object.freeze(['standard', 'iron', 'penalty'])
export const MATCH_TACTICAL_STANCES = Object.freeze([
  'all-out-attack',
  'attack',
  'balanced',
  'defend',
  'park-bus',
])
export const ONLINE_KEY_EVENT_TYPES = Object.freeze([
  'goal',
  'offside_pending',
  'offside_called',
  'goal_disallowed',
  'indirect_free_kick',
  'injury',
  'substitution',
  'tactical-change',
  'period-change',
  'match-ended',
])

export function normalizeRuleset(value) {
  return MATCH_RULESETS.includes(value) ? value : 'standard'
}

export function normalizeRoomCode(value) {
  const code = String(value || '').replace(/\D/g, '').slice(0, 6)
  return ONLINE_ROOM_CODE_PATTERN.test(code) ? code : null
}

export function sanitizeInputFrame(frame = {}) {
  const axis = (value) => Math.max(-1, Math.min(1, Number(value) || 0))
  return {
    seq: Math.max(0, Math.floor(Number(frame.seq) || 0)),
    sentAt: Math.max(0, Number(frame.sentAt) || Date.now()),
    vx: axis(frame.vx),
    vy: axis(frame.vy),
    shoot: Boolean(frame.shoot),
    sprint: Boolean(frame.sprint),
    pass: Boolean(frame.pass),
    lob: Boolean(frame.lob),
    switchPlayer: Boolean(frame.switchPlayer),
    tackle: Boolean(frame.tackle),
  }
}

export function isValidLineupPayload(payload = {}) {
  const squad = [...new Set((payload.squadPlayerIds || []).filter(Boolean))]
  const lineup = [...new Set((payload.lineupPlayerIds || []).filter(Boolean))]
  return squad.length === 23
    && lineup.length === 11
    && lineup.every((playerId) => squad.includes(playerId))
    && typeof payload.formation === 'string'
}

export function sanitizeOnlineMatchCommand(type, payload = {}) {
  if (type === ONLINE_MESSAGE.TACTICS) {
    if (!MATCH_TACTICAL_STANCES.includes(payload.stance)) return null
    return { stance: payload.stance }
  }
  if (type === ONLINE_MESSAGE.SUBSTITUTION_REQUEST) {
    const swaps = (payload.swaps || []).slice(0, 5).map((swap) => ({
      outPlayerId: String(swap?.outPlayerId || ''),
      inPlayerId: String(swap?.inPlayerId || ''),
    })).filter((swap) => swap.outPlayerId && swap.inPlayerId && swap.outPlayerId !== swap.inPlayerId)
    const outgoing = new Set(swaps.map((swap) => swap.outPlayerId))
    const incoming = new Set(swaps.map((swap) => swap.inPlayerId))
    if (!swaps.length || swaps.length !== outgoing.size || swaps.length !== incoming.size) return null
    return { swaps }
  }
  if (type === ONLINE_MESSAGE.CONTROL) {
    return { paused: Boolean(payload.paused), reason: String(payload.reason || 'management-panel').slice(0, 40) }
  }
  return null
}

export function publicRoomState(room, ownToken = null) {
  if (!room) return null
  const publicSeat = (seat) => seat && ({
    seatId: seat.seatId,
    side: seat.side,
    connected: seat.connected,
    teamId: seat.teamId,
    formation: seat.formation,
    squadPlayerIds: [...(seat.squadPlayerIds || [])],
    lineupPlayerIds: [...(seat.lineupPlayerIds || [])],
    lineupLocked: Boolean(seat.lineupLocked),
    ready: Boolean(seat.ready),
    rematchRequested: Boolean(seat.rematchRequested),
  })
  return {
    protocolVersion: ONLINE_PROTOCOL_VERSION,
    code: room.code,
    status: room.status,
    ruleset: room.ruleset,
    revision: room.revision,
    host: publicSeat(room.seats.host),
    guest: publicSeat(room.seats.guest),
    match: room.match ? {
      id: room.match.id,
      startedAt: room.match.startedAt,
      pausedAt: room.match.pausedAt,
      snapshotSeq: room.match.snapshotSeq,
      endedAt: room.match.endedAt,
      result: room.match.result || null,
      penalty: room.match.penalty ? {
        attemptIndex: room.match.penalty.attemptIndex,
        submitted: {
          shooter: Boolean(room.match.penalty.choices?.shooter),
          keeper: Boolean(room.match.penalty.choices?.keeper),
        },
        shots: (room.match.penalty.shots || []).map((shot) => ({ ...shot })),
        winner: room.match.penalty.winner || null,
      } : null,
    } : null,
    reconnectToken: ownToken,
    abortReason: room.abortReason || null,
  }
}
