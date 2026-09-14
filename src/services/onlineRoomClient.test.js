import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ONLINE_MESSAGE, ONLINE_PROTOCOL_VERSION } from '../online/onlineProtocol.js'
import { OnlineRoomClient, interpolateOnlineSnapshots } from './onlineRoomClient.js'

class FakeSocket {
  static OPEN = 1
  constructor() {
    this.readyState = FakeSocket.OPEN
    this.listeners = {}
    this.sent = []
    queueMicrotask(() => this.listeners.open?.forEach((listener) => listener({})))
  }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener) }
  send(payload) { this.sent.push(JSON.parse(payload)) }
  close() { this.listeners.close?.forEach((listener) => listener({})) }
  receive(message) { this.listeners.message?.forEach((listener) => listener({ data: JSON.stringify(message) })) }
}

describe('online room client', () => {
  beforeEach(() => {
    const values = new Map()
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    })
  })

  it('throttles input to 20 Hz and snapshots to 12 Hz', async () => {
    let at = 1000
    const client = new OnlineRoomClient({ url: 'ws://test', WebSocketImpl: FakeSocket, now: () => at })
    await client.connect()
    expect(client.sendInput({ vx: 2 })).toBe(true)
    expect(client.sendInput({ vx: 0 })).toBe(false)
    at += 50
    expect(client.sendInput({ vx: -2 })).toBe(true)
    expect(client.socket.sent.at(-1)).toMatchObject({
      type: ONLINE_MESSAGE.INPUT,
      frame: { seq: 2, vx: -1 },
    })
    expect(client.sendAuthoritativeSnapshot({ score: [0, 0] })).toBe(true)
    at += 50
    expect(client.sendAuthoritativeSnapshot({ score: [1, 0] })).toBe(false)
    at += 34
    expect(client.sendAuthoritativeSnapshot({ score: [1, 0] })).toBe(true)
  })

  it('keeps a 100 ms interpolation buffer instead of recalculating outcomes', () => {
    const result = interpolateOnlineSnapshots(
      { receivedAt: 1000, ball: [0, 0, 0], actors: [{ id: 'p', position: [0, 0] }] },
      { receivedAt: 1100, ball: [1, 1, 0], actors: [{ id: 'p', position: [1, 0] }], score: [1, 0] },
      1050,
    )
    expect(result.ball).toEqual([0.5, 0.5, 0])
    expect(result.actors[0].position).toEqual([0.5, 0])
    expect(result.score).toEqual([1, 0])
  })

  it('accepts only versioned room messages', async () => {
    const client = new OnlineRoomClient({ url: 'ws://test', WebSocketImpl: FakeSocket })
    await client.connect()
    client.socket.receive({ protocolVersion: 'wrong', type: ONLINE_MESSAGE.ROOM_STATE, room: { code: '111111' } })
    expect(client.room).toBeNull()
    client.socket.receive({ protocolVersion: ONLINE_PROTOCOL_VERSION, type: ONLINE_MESSAGE.ROOM_STATE, room: { code: '222222' } })
    expect(client.room.code).toBe('222222')
  })
})
