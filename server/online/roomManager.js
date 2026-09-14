import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { ALL_PLAYABLE_TEAM_IDS } from '../../config/variants.mjs'
import {
  MATCH_RULESETS,
  ONLINE_KEY_EVENT_TYPES,
  ONLINE_MAX_ROOMS,
  ONLINE_RECONNECT_GRACE_MS,
  isValidLineupPayload,
  normalizeRoomCode,
  normalizeRuleset,
  publicRoomState,
  sanitizeOnlineMatchCommand,
  sanitizeInputFrame,
} from '../../src/online/onlineProtocol.js'
import {
  PENALTY_ZONES,
  getShootoutWinner,
  resolveShootoutAttempt,
} from '../../src/utils/penaltyShootout.js'

const PLAYABLE_TEAMS = new Set(ALL_PLAYABLE_TEAM_IDS)
const KEY_EVENTS = new Set(ONLINE_KEY_EVENT_TYPES)
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value))
const PENALTY_ZONE_SET = new Set(PENALTY_ZONES)

function newPenaltyState() {
  return {
    attemptIndex: 0,
    choices: { shooter: null, keeper: null },
    shots: [],
    winner: null,
  }
}

function expectedPenaltyRole(attemptIndex, seatId) {
  const shooterSeatId = attemptIndex % 2 === 0 ? 'host' : 'guest'
  return seatId === shooterSeatId ? 'shooter' : 'keeper'
}

export class OnlineRoomError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'OnlineRoomError'
    this.code = code
  }
}

function newSeat(seatId) {
  return {
    seatId,
    side: seatId === 'host' ? 'red' : 'blue',
    token: randomBytes(24).toString('base64url'),
    connectionId: null,
    connected: false,
    disconnectedAt: null,
    teamId: null,
    formation: null,
    squadPlayerIds: [],
    lineupPlayerIds: [],
    lineupLocked: false,
    ready: false,
    lastInputSeq: -1,
    rematchRequested: false,
  }
}

export class OnlineRoomManager {
  constructor({
    store,
    maxRooms = ONLINE_MAX_ROOMS,
    reconnectGraceMs = ONLINE_RECONNECT_GRACE_MS,
    random = Math.random,
  } = {}) {
    if (!store) throw new Error('OnlineRoomManager requires a room store')
    this.store = store
    this.maxRooms = maxRooms
    this.reconnectGraceMs = reconnectGraceMs
    this.random = random
    this.rooms = new Map()
    this.connectionSeats = new Map()
  }

  async connect() { await this.store.connect() }
  async close() { await this.store.close() }

  async load(code) {
    if (this.rooms.has(code)) return this.rooms.get(code)
    const stored = await this.store.get(code)
    if (stored) this.rooms.set(code, stored)
    return stored
  }

  async persist(room) {
    room.updatedAt = Date.now()
    room.revision = Number(room.revision || 0) + 1
    this.rooms.set(room.code, room)
    await this.store.set(room.code, room)
    return room
  }

  async allocateCode() {
    if (await this.store.count() >= this.maxRooms) {
      throw new OnlineRoomError('room-capacity', '房间已满，请稍后重试')
    }
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
      if (!await this.load(code)) return code
    }
    throw new OnlineRoomError('room-code-exhausted', '暂时无法分配房间码')
  }

  bind(room, seat, connectionId) {
    const previous = seat.connectionId
    if (previous) this.connectionSeats.delete(previous)
    seat.connectionId = connectionId
    seat.connected = true
    seat.disconnectedAt = null
    this.connectionSeats.set(connectionId, { code: room.code, seatId: seat.seatId })
  }

  async createRoom(connectionId, ruleset = 'standard') {
    const code = await this.allocateCode()
    const host = newSeat('host')
    const room = {
      code,
      ruleset: normalizeRuleset(ruleset),
      status: 'lobby',
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      seats: { host, guest: null },
      match: null,
      lastSnapshot: null,
      abortReason: null,
    }
    this.bind(room, host, connectionId)
    await this.persist(room)
    return { room, seat: host, state: publicRoomState(room, host.token) }
  }

  async joinRoom(connectionId, rawCode) {
    const code = normalizeRoomCode(rawCode)
    if (!code) throw new OnlineRoomError('invalid-room-code', '请输入六位房间码')
    const room = await this.load(code)
    if (!room) throw new OnlineRoomError('room-not-found', '房间不存在或已过期')
    if (room.seats.guest) throw new OnlineRoomError('room-full', '房间已有两名玩家')
    const guest = newSeat('guest')
    room.seats.guest = guest
    this.bind(room, guest, connectionId)
    await this.persist(room)
    return { room, seat: guest, state: publicRoomState(room, guest.token) }
  }

  async reconnect(connectionId, rawCode, token) {
    const code = normalizeRoomCode(rawCode)
    const room = code && await this.load(code)
    if (!room) throw new OnlineRoomError('room-not-found', '原房间已经失效')
    const seat = Object.values(room.seats).find((candidate) => candidate?.token === token)
    if (!seat) throw new OnlineRoomError('invalid-reconnect-token', '重连令牌无效')
    if (seat.disconnectedAt && Date.now() - seat.disconnectedAt > this.reconnectGraceMs) {
      throw new OnlineRoomError('reconnect-expired', '20 秒重连时间已结束')
    }
    this.bind(room, seat, connectionId)
    if (room.status === 'paused' && room.seats.host?.connected && room.seats.guest?.connected) {
      room.status = 'playing'
      if (room.match) room.match.pausedAt = null
    }
    await this.persist(room)
    return { room, seat, state: publicRoomState(room, seat.token), snapshot: room.lastSnapshot }
  }

  getBinding(connectionId) { return this.connectionSeats.get(connectionId) || null }

  async roomForConnection(connectionId) {
    const binding = this.getBinding(connectionId)
    if (!binding) throw new OnlineRoomError('not-in-room', '当前连接尚未加入房间')
    const room = await this.load(binding.code)
    const seat = room?.seats?.[binding.seatId]
    if (!room || !seat || seat.connectionId !== connectionId) {
      throw new OnlineRoomError('stale-seat', '房间席位已经失效')
    }
    return { room, seat }
  }

  async selectTeam(connectionId, teamId, ruleset) {
    const { room, seat } = await this.roomForConnection(connectionId)
    if (room.status !== 'lobby') throw new OnlineRoomError('match-active', '比赛进行中不能重新选队')
    if (!PLAYABLE_TEAMS.has(teamId)) throw new OnlineRoomError('invalid-team', '球队不可用')
    seat.teamId = teamId
    seat.ready = false
    seat.lineupLocked = false
    if (seat.seatId === 'host' && MATCH_RULESETS.includes(ruleset)) room.ruleset = ruleset
    await this.persist(room)
    return { room, seat }
  }

  async lockLineup(connectionId, payload) {
    const { room, seat } = await this.roomForConnection(connectionId)
    if (room.status !== 'lobby') throw new OnlineRoomError('match-active', '比赛进行中不能修改阵容')
    if (!seat.teamId) throw new OnlineRoomError('team-required', '请先选择球队')
    if (!isValidLineupPayload(payload)) throw new OnlineRoomError('invalid-lineup', '需要锁定完整 23 人名单和 11 人首发')
    seat.squadPlayerIds = [...new Set(payload.squadPlayerIds)]
    seat.lineupPlayerIds = [...new Set(payload.lineupPlayerIds)]
    seat.formation = payload.formation
    seat.lineupLocked = true
    seat.ready = false
    await this.persist(room)
    return { room, seat }
  }

  async setReady(connectionId, ready = true) {
    const { room, seat } = await this.roomForConnection(connectionId)
    if (room.status !== 'lobby') throw new OnlineRoomError('match-active', '当前不在准备阶段')
    if (!seat.teamId || !seat.lineupLocked) throw new OnlineRoomError('lineup-required', '请先选队并锁定阵容')
    seat.ready = Boolean(ready)
    const bothReady = room.seats.host?.ready && room.seats.guest?.ready
      && room.seats.host.connected && room.seats.guest.connected
    if (bothReady) {
      room.status = 'playing'
      room.abortReason = null
      room.match = {
        id: randomUUID(),
        startedAt: Date.now(),
        pausedAt: null,
        snapshotSeq: -1,
        endedAt: null,
        result: null,
        penalty: room.ruleset === 'penalty' ? newPenaltyState() : null,
      }
    }
    await this.persist(room)
    return { room, seat, started: Boolean(bothReady) }
  }

  async acceptInput(connectionId, payload) {
    const { room, seat } = await this.roomForConnection(connectionId)
    if (room.status !== 'playing') throw new OnlineRoomError('match-not-playing', '比赛当前未运行')
    if (room.ruleset === 'penalty') throw new OnlineRoomError('invalid-match-mode', '点球大战不接收实时比赛输入')
    const frame = sanitizeInputFrame(payload)
    if (frame.seq <= seat.lastInputSeq) throw new OnlineRoomError('stale-input', '输入帧重复或乱序')
    seat.lastInputSeq = frame.seq
    await this.persist(room)
    return { room, seat, frame: { ...frame, side: seat.side } }
  }

  async acceptMatchCommand(connectionId, type, payload) {
    const { room, seat } = await this.roomForConnection(connectionId)
    if (room.status !== 'playing') throw new OnlineRoomError('match-not-playing', '比赛当前未运行')
    if (room.ruleset === 'penalty') throw new OnlineRoomError('invalid-match-mode', '点球大战不支持战术或换人指令')
    const command = sanitizeOnlineMatchCommand(type, payload)
    if (!command) throw new OnlineRoomError('invalid-match-command', '比赛调整指令不合法')
    return {
      room,
      seat,
      command: { ...command, side: seat.side, requestedBy: seat.seatId },
    }
  }

  async acceptSnapshot(connectionId, payload) {
    const { room, seat } = await this.roomForConnection(connectionId)
    if (seat.seatId !== 'host') throw new OnlineRoomError('host-authority-required', '只有房主可以发布权威快照')
    if (room.status !== 'playing' || !room.match) throw new OnlineRoomError('match-not-playing', '比赛当前未运行')
    if (room.ruleset === 'penalty') throw new OnlineRoomError('invalid-match-mode', '点球大战由房间服务结算')
    const seq = Math.max(0, Math.floor(Number(payload?.seq) || 0))
    if (seq <= room.match.snapshotSeq) throw new OnlineRoomError('stale-snapshot', '快照重复或乱序')
    room.match.snapshotSeq = seq
    room.lastSnapshot = { ...clone(payload), seq, receivedAt: Date.now() }
    await this.persist(room)
    return { room, seat, snapshot: room.lastSnapshot }
  }

  async submitPenaltyChoice(connectionId, payload = {}) {
    const { room, seat } = await this.roomForConnection(connectionId)
    if (room.status !== 'playing' || room.ruleset !== 'penalty' || !room.match?.penalty) {
      throw new OnlineRoomError('penalty-not-playing', '当前不是进行中的点球大战')
    }
    const penalty = room.match.penalty
    const attemptIndex = Math.max(0, Math.floor(Number(payload.attemptIndex) || 0))
    if (attemptIndex !== penalty.attemptIndex) {
      throw new OnlineRoomError('stale-penalty-choice', '这一轮点球已经结束')
    }
    const role = expectedPenaltyRole(attemptIndex, seat.seatId)
    if (payload.role !== role) {
      throw new OnlineRoomError('invalid-penalty-role', role === 'shooter' ? '本轮应由你主罚' : '本轮应由你扑救')
    }
    if (!PENALTY_ZONE_SET.has(payload.zone)) {
      throw new OnlineRoomError('invalid-penalty-zone', '点球方向无效')
    }
    if (penalty.choices[role]) {
      throw new OnlineRoomError('penalty-choice-locked', '本轮方向已经锁定')
    }

    penalty.choices[role] = {
      seatId: seat.seatId,
      zone: payload.zone,
      overpowered: role === 'shooter' && Boolean(payload.overpowered),
      power: role === 'shooter'
        ? Math.max(0, Math.min(1.5, Number(payload.power) || 0))
        : 0,
    }

    let resolvedAttempt = null
    if (penalty.choices.shooter && penalty.choices.keeper) {
      const shootingTeam = attemptIndex % 2 === 0 ? 'home' : 'away'
      const outcome = resolveShootoutAttempt({
        shooterZone: penalty.choices.shooter.zone,
        keeperZone: penalty.choices.keeper.zone,
        overpowered: penalty.choices.shooter.overpowered,
        random: this.random,
      })
      resolvedAttempt = {
        id: `${room.match.id}:penalty:${attemptIndex}`,
        attemptIndex,
        round: Math.floor(attemptIndex / 2) + 1,
        team: shootingTeam,
        shooterSeatId: penalty.choices.shooter.seatId,
        keeperSeatId: penalty.choices.keeper.seatId,
        shooterZone: penalty.choices.shooter.zone,
        keeperZone: penalty.choices.keeper.zone,
        overpowered: penalty.choices.shooter.overpowered,
        power: penalty.choices.shooter.power,
        ...outcome,
      }
      penalty.shots.push(resolvedAttempt)
      penalty.attemptIndex += 1
      penalty.choices = { shooter: null, keeper: null }
      penalty.winner = getShootoutWinner(penalty.shots)
      if (penalty.winner) {
        const homeScore = penalty.shots.filter((shot) => shot.team === 'home' && shot.scored).length
        const awayScore = penalty.shots.filter((shot) => shot.team === 'away' && shot.scored).length
        room.status = 'finished'
        room.match.endedAt = Date.now()
        room.match.result = {
          type: 'penalty',
          winner: penalty.winner,
          homeScore,
          awayScore,
        }
      }
    }
    await this.persist(room)
    return { room, seat, resolvedAttempt }
  }

  async acceptKeyEvent(connectionId, payload) {
    const { room, seat } = await this.roomForConnection(connectionId)
    if (seat.seatId !== 'host') throw new OnlineRoomError('host-authority-required', '只有房主可以发布比赛事件')
    if (!KEY_EVENTS.has(payload?.type)) throw new OnlineRoomError('invalid-key-event', '不支持的比赛事件')
    if (payload.type === 'match-ended') {
      room.status = 'finished'
      room.match.endedAt = Date.now()
      room.match.result = clone(payload.result || null)
    }
    await this.persist(room)
    return { room, seat, event: clone(payload) }
  }

  async requestRematch(connectionId) {
    const { room, seat } = await this.roomForConnection(connectionId)
    if (room.status !== 'finished' && room.status !== 'lobby') {
      throw new OnlineRoomError('rematch-unavailable', '当前不能再来一局')
    }
    seat.rematchRequested = true
    const accepted = room.seats.host?.rematchRequested && room.seats.guest?.rematchRequested
    if (accepted) this.resetMatch(room, null)
    await this.persist(room)
    return { room, seat, accepted }
  }

  resetMatch(room, reason) {
    room.status = 'lobby'
    room.match = null
    room.lastSnapshot = null
    room.abortReason = reason
    for (const seat of Object.values(room.seats)) {
      if (!seat) continue
      seat.ready = false
      seat.lastInputSeq = -1
      seat.rematchRequested = false
    }
  }

  async disconnect(connectionId) {
    const binding = this.connectionSeats.get(connectionId)
    this.connectionSeats.delete(connectionId)
    if (!binding) return null
    const room = await this.load(binding.code)
    const seat = room?.seats?.[binding.seatId]
    if (!room || !seat || seat.connectionId !== connectionId) return null
    seat.connected = false
    seat.connectionId = null
    seat.disconnectedAt = Date.now()
    if (room.status === 'playing') {
      room.status = 'paused'
      room.match.pausedAt = Date.now()
    }
    await this.persist(room)
    return { room, seat, expiresAt: seat.disconnectedAt + this.reconnectGraceMs }
  }

  async expireDisconnectedSeat(code, seatId, disconnectedAt) {
    const room = await this.load(code)
    const seat = room?.seats?.[seatId]
    if (!room || !seat || seat.connected || seat.disconnectedAt !== disconnectedAt) return null
    this.resetMatch(room, seatId === 'host' ? 'host-reconnect-timeout' : 'guest-reconnect-timeout')
    await this.persist(room)
    return { room, seat }
  }
}
