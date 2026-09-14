import {
  ONLINE_INPUT_HZ,
  ONLINE_INTERPOLATION_MS,
  ONLINE_MESSAGE,
  ONLINE_PROTOCOL_VERSION,
  ONLINE_RECONNECT_GRACE_MS,
  ONLINE_SNAPSHOT_HZ,
  sanitizeInputFrame,
} from '../online/onlineProtocol.js'

const SESSION_KEY = 'happyseed-online-room-v1'

function defaultSocketUrl() {
  const configured = import.meta.env?.VITE_MATCH_WS_URL
  if (configured) return configured
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    return `ws://${window.location.hostname || '127.0.0.1'}:8787`
  }
  return ''
}

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}

function saveSession(value) {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Session storage can be unavailable in privacy-restricted webviews.
  }
}

function lerp(left, right, amount) {
  return Number(left || 0) + (Number(right || 0) - Number(left || 0)) * amount
}

function interpolateEntities(previous = [], next = [], amount) {
  const previousById = new Map(previous.map((entity) => [entity.runtimeActorId || entity.id, entity]))
  return next.map((entity) => {
    const id = entity.runtimeActorId || entity.id
    const before = previousById.get(id)
    if (!before || !Array.isArray(before.position) || !Array.isArray(entity.position)) return entity
    return {
      ...entity,
      position: entity.position.map((value, index) => lerp(before.position[index], value, amount)),
    }
  })
}

export function interpolateOnlineSnapshots(previous, next, renderAt) {
  if (!previous) return next || null
  if (!next) return previous
  const start = Number(previous.receivedAt || previous.sentAt || 0)
  const end = Number(next.receivedAt || next.sentAt || start + 1)
  const amount = Math.max(0, Math.min(1, (renderAt - start) / Math.max(1, end - start)))
  return {
    ...next,
    interpolation: amount,
    ball: Array.isArray(previous.ball) && Array.isArray(next.ball)
      ? next.ball.map((value, index) => lerp(previous.ball[index], value, amount))
      : next.ball,
    actors: interpolateEntities(previous.actors, next.actors, amount),
  }
}

export class OnlineRoomClient {
  constructor({ url = defaultSocketUrl(), WebSocketImpl = globalThis.WebSocket, now = () => Date.now() } = {}) {
    this.url = url
    this.WebSocketImpl = WebSocketImpl
    this.now = now
    this.socket = null
    this.listeners = new Set()
    this.room = null
    this.connectionState = 'idle'
    this.lastError = null
    this.inputSeq = 0
    this.snapshotSeq = 0
    this.lastInputAt = 0
    this.lastSnapshotAt = 0
    this.snapshotBuffer = []
    this.reconnectStartedAt = 0
    this.reconnectTimer = null
    this.intentionalClose = false
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.listeners.delete(listener)
  }

  emit(event = null) {
    const snapshot = this.getSnapshot()
    this.listeners.forEach((listener) => listener(snapshot, event))
  }

  getSnapshot() {
    const session = loadSession()
    const ownSeat = this.room && session?.seatId && this.room.host?.seatId === session.seatId
      ? this.room.host
      : this.room && session?.seatId && this.room.guest?.seatId === session.seatId
        ? this.room.guest
        : null
    return {
      connectionState: this.connectionState,
      configured: Boolean(this.url),
      room: this.room,
      ownSeat,
      seatId: session?.seatId || ownSeat?.seatId || null,
      reconnectToken: session?.reconnectToken || null,
      lastError: this.lastError,
    }
  }

  connect() {
    if (!this.url) return Promise.reject(new Error('尚未配置 VITE_MATCH_WS_URL'))
    if (!this.WebSocketImpl) return Promise.reject(new Error('当前环境不支持 WebSocket'))
    if (this.socket?.readyState === this.WebSocketImpl.OPEN) return Promise.resolve()
    if (this.connectionState === 'connecting') {
      return new Promise((resolve, reject) => {
        const unsubscribe = this.subscribe((snapshot) => {
          if (snapshot.connectionState === 'open') { unsubscribe(); resolve() }
          if (snapshot.connectionState === 'error') { unsubscribe(); reject(snapshot.lastError) }
        })
      })
    }
    this.intentionalClose = false
    this.connectionState = 'connecting'
    this.emit()
    return new Promise((resolve, reject) => {
      const socket = new this.WebSocketImpl(this.url)
      this.socket = socket
      socket.addEventListener('open', () => {
        this.connectionState = 'open'
        this.lastError = null
        this.reconnectStartedAt = 0
        this.emit({ type: 'connection:open' })
        const session = loadSession()
        if (session?.code && session?.reconnectToken) {
          this.send(ONLINE_MESSAGE.RECONNECT, session)
        }
        resolve()
      }, { once: true })
      socket.addEventListener('message', (event) => this.handleMessage(event.data))
      socket.addEventListener('close', () => this.handleClose())
      socket.addEventListener('error', () => {
        const error = new Error('无法连接联机服务')
        this.lastError = error
        this.connectionState = 'error'
        this.emit({ type: ONLINE_MESSAGE.ERROR, error })
        reject(error)
      }, { once: true })
    })
  }

  close({ forgetRoom = false } = {}) {
    this.intentionalClose = true
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.socket?.close(1000, 'client close')
    this.socket = null
    this.connectionState = 'closed'
    if (forgetRoom) {
      this.room = null
      saveSession(null)
    }
    this.emit({ type: 'connection:closed' })
  }

  handleClose() {
    this.socket = null
    if (this.intentionalClose) return
    this.connectionState = 'reconnecting'
    if (!this.reconnectStartedAt) this.reconnectStartedAt = this.now()
    this.emit({ type: 'connection:reconnecting' })
    if (this.now() - this.reconnectStartedAt >= ONLINE_RECONNECT_GRACE_MS) {
      this.connectionState = 'error'
      this.lastError = new Error('20 秒重连时间已结束')
      this.emit({ type: ONLINE_MESSAGE.ERROR, error: this.lastError })
      return
    }
    this.reconnectTimer = setTimeout(() => this.connect().catch(() => {}), 600)
  }

  handleMessage(raw) {
    let message
    try { message = JSON.parse(String(raw)) }
    catch { return }
    if (message.protocolVersion !== ONLINE_PROTOCOL_VERSION) return
    if (message.type === ONLINE_MESSAGE.ROOM_STATE || message.room) {
      this.room = message.room || this.room
      const session = loadSession() || {}
      const reconnectToken = this.room?.reconnectToken || session.reconnectToken
      const seatId = this.room?.host?.side === session.side
        ? 'host'
        : this.room?.guest?.side === session.side ? 'guest' : session.seatId
      if (this.room?.code && reconnectToken) {
        saveSession({ code: this.room.code, reconnectToken, seatId, side: session.side })
      }
    }
    if (message.type === ONLINE_MESSAGE.SNAPSHOT && message.snapshot) {
      this.snapshotBuffer.push(message.snapshot)
      this.snapshotBuffer = this.snapshotBuffer
        .sort((left, right) => left.seq - right.seq)
        .slice(-4)
    }
    if (message.type === ONLINE_MESSAGE.ERROR) {
      this.lastError = Object.assign(new Error(message.message), { code: message.code })
    }
    this.emit(message)
  }

  send(type, payload = {}) {
    if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) return false
    this.socket.send(JSON.stringify({ protocolVersion: ONLINE_PROTOCOL_VERSION, type, ...payload }))
    return true
  }

  async createRoom(ruleset = 'standard') {
    await this.connect()
    saveSession({ side: 'red', seatId: 'host' })
    return this.send(ONLINE_MESSAGE.CREATE_ROOM, { ruleset })
  }

  async joinRoom(code) {
    await this.connect()
    saveSession({ side: 'blue', seatId: 'guest' })
    return this.send(ONLINE_MESSAGE.JOIN_ROOM, { code })
  }

  selectTeam(teamId, ruleset) { return this.send(ONLINE_MESSAGE.SELECT_TEAM, { teamId, ruleset }) }
  lockLineup(squadPlayerIds, lineupPlayerIds, formation) {
    return this.send(ONLINE_MESSAGE.LOCK_LINEUP, { squadPlayerIds, lineupPlayerIds, formation })
  }
  setReady(ready = true) { return this.send(ONLINE_MESSAGE.READY, { ready }) }
  requestRematch() { return this.send(ONLINE_MESSAGE.REMATCH) }
  setTacticalStance(stance) { return this.send(ONLINE_MESSAGE.TACTICS, { stance }) }
  requestSubstitutions(swaps) {
    return this.send(ONLINE_MESSAGE.SUBSTITUTION_REQUEST, { swaps })
  }
  submitPenaltyChoice(choice) {
    return this.send(ONLINE_MESSAGE.PENALTY_CHOICE, choice)
  }
  setManagementPaused(paused, reason = 'management-panel') {
    return this.send(ONLINE_MESSAGE.CONTROL, { paused, reason })
  }

  sendInput(input) {
    const at = this.now()
    if (at - this.lastInputAt < 1000 / ONLINE_INPUT_HZ) return false
    this.lastInputAt = at
    const frame = sanitizeInputFrame({ ...input, seq: ++this.inputSeq, sentAt: at })
    return this.send(ONLINE_MESSAGE.INPUT, { frame })
  }

  sendAuthoritativeSnapshot(snapshot) {
    const at = this.now()
    if (at - this.lastSnapshotAt < 1000 / ONLINE_SNAPSHOT_HZ) return false
    this.lastSnapshotAt = at
    return this.send(ONLINE_MESSAGE.SNAPSHOT, {
      snapshot: { ...snapshot, seq: ++this.snapshotSeq, sentAt: at },
    })
  }

  sendAuthoritativeEvent(event) { return this.send(ONLINE_MESSAGE.EVENT, { event }) }

  getInterpolatedSnapshot(at = this.now() - ONLINE_INTERPOLATION_MS) {
    const eligible = this.snapshotBuffer.filter((snapshot) => Number(snapshot.receivedAt || snapshot.sentAt) <= at)
    const previous = eligible.at(-1) || this.snapshotBuffer[0]
    const next = this.snapshotBuffer.find((snapshot) => Number(snapshot.receivedAt || snapshot.sentAt) >= at)
      || this.snapshotBuffer.at(-1)
    return interpolateOnlineSnapshots(previous, next, at)
  }
}

export const onlineRoomClient = new OnlineRoomClient()
