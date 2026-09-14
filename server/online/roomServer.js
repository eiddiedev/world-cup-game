import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { WebSocket, WebSocketServer } from 'ws'
import {
  ONLINE_MAX_CONNECTIONS,
  ONLINE_MESSAGE,
  ONLINE_PROTOCOL_VERSION,
  publicRoomState,
} from '../../src/online/onlineProtocol.js'
import { OnlineRoomError, OnlineRoomManager } from './roomManager.js'
import { createRoomStore } from './roomStore.js'

const MAX_MESSAGE_BYTES = 64 * 1024

export class OnlineRoomServer {
  constructor({ port = 8787, host = '0.0.0.0', store = createRoomStore(), maxConnections = ONLINE_MAX_CONNECTIONS } = {}) {
    this.port = port
    this.host = host
    this.maxConnections = maxConnections
    this.manager = new OnlineRoomManager({ store })
    this.connections = new Map()
    this.reconnectTimers = new Map()
    this.wss = null
  }

  async start() {
    await this.manager.connect()
    this.wss = new WebSocketServer({ port: this.port, host: this.host, maxPayload: MAX_MESSAGE_BYTES })
    this.wss.on('connection', (socket) => this.accept(socket))
    await new Promise((resolve, reject) => {
      this.wss.once('listening', resolve)
      this.wss.once('error', reject)
    })
    return this
  }

  async stop() {
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer)
    this.reconnectTimers.clear()
    for (const socket of this.connections.values()) socket.close(1001, 'server shutdown')
    await new Promise((resolve) => this.wss?.close(resolve))
    await this.manager.close()
  }

  send(socket, type, payload = {}) {
    if (socket?.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({ protocolVersion: ONLINE_PROTOCOL_VERSION, type, ...payload }))
    return true
  }

  roomSockets(room) {
    return Object.values(room.seats).map((seat) => this.connections.get(seat?.connectionId)).filter(Boolean)
  }

  broadcastState(room) {
    for (const seat of Object.values(room.seats)) {
      if (!seat) continue
      const socket = this.connections.get(seat.connectionId)
      this.send(socket, ONLINE_MESSAGE.ROOM_STATE, { room: publicRoomState(room, seat.token) })
    }
  }

  broadcast(room, type, payload = {}, exceptConnectionId = null) {
    for (const seat of Object.values(room.seats)) {
      if (!seat || seat.connectionId === exceptConnectionId) continue
      this.send(this.connections.get(seat.connectionId), type, payload)
    }
  }

  accept(socket) {
    if (this.connections.size >= this.maxConnections) {
      socket.close(1013, 'server capacity')
      return
    }
    const connectionId = randomUUID()
    this.connections.set(connectionId, socket)
    socket.isAlive = true
    socket.on('pong', () => { socket.isAlive = true })
    socket.on('message', (raw) => this.handle(connectionId, socket, raw))
    socket.on('close', () => this.handleClose(connectionId))
    socket.on('error', () => {})
    this.send(socket, ONLINE_MESSAGE.PONG, { connectionId })
  }

  async handle(connectionId, socket, raw) {
    let message
    try {
      message = JSON.parse(String(raw))
      if (message.protocolVersion && message.protocolVersion !== ONLINE_PROTOCOL_VERSION) {
        throw new OnlineRoomError('protocol-version', '联机协议版本不一致')
      }
      let result
      switch (message.type) {
        case ONLINE_MESSAGE.CREATE_ROOM:
          result = await this.manager.createRoom(connectionId, message.ruleset)
          this.send(socket, ONLINE_MESSAGE.ROOM_STATE, { room: result.state })
          return
        case ONLINE_MESSAGE.JOIN_ROOM:
          result = await this.manager.joinRoom(connectionId, message.code)
          this.broadcastState(result.room)
          return
        case ONLINE_MESSAGE.RECONNECT:
          result = await this.manager.reconnect(connectionId, message.code, message.reconnectToken)
          this.clearReconnectTimer(result.room.code, result.seat.seatId)
          this.send(socket, ONLINE_MESSAGE.ROOM_STATE, { room: result.state, snapshot: result.snapshot })
          this.broadcastState(result.room)
          return
        case ONLINE_MESSAGE.SELECT_TEAM:
          result = await this.manager.selectTeam(connectionId, message.teamId, message.ruleset)
          this.broadcastState(result.room)
          return
        case ONLINE_MESSAGE.LOCK_LINEUP:
          result = await this.manager.lockLineup(connectionId, message)
          this.broadcastState(result.room)
          return
        case ONLINE_MESSAGE.READY:
          result = await this.manager.setReady(connectionId, message.ready)
          this.broadcastState(result.room)
          if (result.started) this.broadcast(result.room, ONLINE_MESSAGE.MATCH_STARTED, { room: publicRoomState(result.room) })
          return
        case ONLINE_MESSAGE.INPUT:
          result = await this.manager.acceptInput(connectionId, message.frame)
          this.broadcast(result.room, ONLINE_MESSAGE.INPUT, { frame: result.frame }, connectionId)
          return
        case ONLINE_MESSAGE.TACTICS:
        case ONLINE_MESSAGE.SUBSTITUTION_REQUEST:
        case ONLINE_MESSAGE.CONTROL:
          result = await this.manager.acceptMatchCommand(connectionId, message.type, message)
          this.broadcast(result.room, message.type, result.command, connectionId)
          return
        case ONLINE_MESSAGE.SNAPSHOT:
          result = await this.manager.acceptSnapshot(connectionId, message.snapshot)
          this.broadcast(result.room, ONLINE_MESSAGE.SNAPSHOT, { snapshot: result.snapshot }, connectionId)
          return
        case ONLINE_MESSAGE.EVENT:
          result = await this.manager.acceptKeyEvent(connectionId, message.event)
          this.broadcast(result.room, ONLINE_MESSAGE.EVENT, { event: result.event }, connectionId)
          this.broadcastState(result.room)
          return
        case ONLINE_MESSAGE.PENALTY_CHOICE:
          result = await this.manager.submitPenaltyChoice(connectionId, message)
          this.broadcastState(result.room)
          this.broadcast(result.room, ONLINE_MESSAGE.PENALTY_STATE, {
            resolvedAttempt: result.resolvedAttempt,
          })
          return
        case ONLINE_MESSAGE.REMATCH:
          result = await this.manager.requestRematch(connectionId)
          this.broadcastState(result.room)
          return
        case ONLINE_MESSAGE.PING:
          this.send(socket, ONLINE_MESSAGE.PONG, { at: Date.now() })
          return
        default:
          throw new OnlineRoomError('unknown-message', '无法识别的联机消息')
      }
    } catch (error) {
      const code = error instanceof OnlineRoomError ? error.code : 'server-error'
      this.send(socket, ONLINE_MESSAGE.ERROR, { code, message: error.message || '联机服务异常' })
    }
  }

  timerKey(code, seatId) { return `${code}:${seatId}` }
  clearReconnectTimer(code, seatId) {
    const key = this.timerKey(code, seatId)
    clearTimeout(this.reconnectTimers.get(key))
    this.reconnectTimers.delete(key)
  }

  async handleClose(connectionId) {
    this.connections.delete(connectionId)
    const result = await this.manager.disconnect(connectionId)
    if (!result) return
    this.broadcast(result.room, ONLINE_MESSAGE.MATCH_PAUSED, {
      seatId: result.seat.seatId,
      expiresAt: result.expiresAt,
    })
    this.broadcastState(result.room)
    const key = this.timerKey(result.room.code, result.seat.seatId)
    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(key)
      const expired = await this.manager.expireDisconnectedSeat(
        result.room.code,
        result.seat.seatId,
        result.seat.disconnectedAt,
      )
      if (!expired) return
      this.broadcast(expired.room, ONLINE_MESSAGE.MATCH_ABORTED, {
        reason: expired.room.abortReason,
        room: publicRoomState(expired.room),
      })
      this.broadcastState(expired.room)
    }, Math.max(0, result.expiresAt - Date.now()))
    this.reconnectTimers.set(key, timer)
  }
}

async function main() {
  const server = new OnlineRoomServer({
    port: Number(process.env.PORT || 8787),
    host: process.env.HOST || '0.0.0.0',
  })
  await server.start()
  console.log(`[online-room-server] ws://${server.host}:${server.port}`)
  const shutdown = async () => {
    await server.stop()
    process.exit(0)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
