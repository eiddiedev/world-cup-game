import { describe, expect, it } from 'vitest'
import { MemoryRoomStore } from './roomStore.js'
import { OnlineRoomManager } from './roomManager.js'
import { publicRoomState } from '../../src/online/onlineProtocol.js'

const lineup = (prefix = 'p') => ({
  squadPlayerIds: Array.from({ length: 23 }, (_, index) => `${prefix}-${index}`),
  lineupPlayerIds: Array.from({ length: 11 }, (_, index) => `${prefix}-${index}`),
  formation: '4-3-3',
})

async function readyRoom(options = {}) {
  const { ruleset = 'standard', ...managerOptions } = options
  const manager = new OnlineRoomManager({ store: new MemoryRoomStore(), ...managerOptions })
  await manager.connect()
  const created = await manager.createRoom('host-connection', ruleset)
  const joined = await manager.joinRoom('guest-connection', created.room.code)
  await manager.selectTeam('host-connection', 'france', ruleset)
  await manager.selectTeam('guest-connection', 'brazil')
  await manager.lockLineup('host-connection', lineup('red'))
  await manager.lockLineup('guest-connection', lineup('blue'))
  await manager.setReady('host-connection', true)
  const started = await manager.setReady('guest-connection', true)
  return { manager, created, joined, room: started.room }
}

describe('online room authority', () => {
  it('creates six-digit rooms, allows mirror teams and starts only after both lineups lock', async () => {
    const { room } = await readyRoom()
    expect(room.code).toMatch(/^\d{6}$/)
    expect(room.status).toBe('playing')
    expect(room.match.id).toBeTruthy()
    expect(room.seats.host.side).toBe('red')
    expect(room.seats.guest.side).toBe('blue')
  })

  it('rejects duplicate inputs and guest-forged authoritative snapshots', async () => {
    const { manager } = await readyRoom()
    await expect(manager.acceptInput('guest-connection', { seq: 2, vx: 2 }))
      .resolves.toMatchObject({ frame: { seq: 2, side: 'blue', vx: 1 } })
    await expect(manager.acceptInput('guest-connection', { seq: 2 }))
      .rejects.toMatchObject({ code: 'stale-input' })
    await expect(manager.acceptSnapshot('guest-connection', { seq: 1, score: [99, 0] }))
      .rejects.toMatchObject({ code: 'host-authority-required' })
    await expect(manager.acceptSnapshot('host-connection', { seq: 1, score: [1, 0] }))
      .resolves.toMatchObject({ snapshot: { seq: 1, score: [1, 0] } })
  })

  it('pauses for a disconnect, restores the exact seat and aborts after the grace window', async () => {
    const { manager, room, joined } = await readyRoom({ reconnectGraceMs: 20 })
    const disconnected = await manager.disconnect('guest-connection')
    expect(disconnected.room.status).toBe('paused')
    const restored = await manager.reconnect('guest-reconnected', room.code, joined.seat.token)
    expect(restored.room.status).toBe('playing')
    expect(restored.seat.side).toBe('blue')

    const secondDisconnect = await manager.disconnect('guest-reconnected')
    const expired = await manager.expireDisconnectedSeat(
      room.code,
      'guest',
      secondDisconnect.seat.disconnectedAt,
    )
    expect(expired.room.status).toBe('lobby')
    expect(expired.room.abortReason).toBe('guest-reconnect-timeout')
    expect(expired.room.match).toBeNull()
  })

  it('runs penalty rooms as alternating hidden choices with server-side results', async () => {
    const { manager, room } = await readyRoom({ ruleset: 'penalty', random: () => 0.5 })
    expect(room.match.penalty).toMatchObject({ attemptIndex: 0, shots: [], winner: null })

    await expect(manager.submitPenaltyChoice('guest-connection', {
      attemptIndex: 0,
      role: 'shooter',
      zone: 'right-top',
    })).rejects.toMatchObject({ code: 'invalid-penalty-role' })

    const waiting = await manager.submitPenaltyChoice('host-connection', {
      attemptIndex: 0,
      role: 'shooter',
      zone: 'left-top',
      power: 0.8,
    })
    expect(waiting.resolvedAttempt).toBeNull()
    expect(waiting.room.match.penalty.choices.shooter.zone).toBe('left-top')
    const publicWaitingState = publicRoomState(waiting.room)
    expect(publicWaitingState.match.penalty.submitted).toEqual({ shooter: true, keeper: false })
    expect(JSON.stringify(publicWaitingState)).not.toContain('left-top')

    const resolved = await manager.submitPenaltyChoice('guest-connection', {
      attemptIndex: 0,
      role: 'keeper',
      zone: 'right-bottom',
    })
    expect(resolved.resolvedAttempt).toMatchObject({
      attemptIndex: 0,
      team: 'home',
      shooterSeatId: 'host',
      keeperSeatId: 'guest',
      scored: true,
    })
    expect(resolved.room.match.penalty).toMatchObject({ attemptIndex: 1, winner: null })
    expect(resolved.room.match.penalty.shots).toHaveLength(1)
    expect(resolved.room.match.penalty.choices).toEqual({ shooter: null, keeper: null })
  })

  it('handles 120 rooms and 240 seats as the required 20 percent headroom test', async () => {
    const manager = new OnlineRoomManager({ store: new MemoryRoomStore(), maxRooms: 120 })
    await manager.connect()
    const rooms = []
    for (let index = 0; index < 120; index += 1) {
      const created = await manager.createRoom(`host-${index}`)
      await manager.joinRoom(`guest-${index}`, created.room.code)
      rooms.push(created.room.code)
    }
    expect(new Set(rooms).size).toBe(120)
    expect(manager.connectionSeats.size).toBe(240)
    await expect(manager.createRoom('overflow')).rejects.toMatchObject({ code: 'room-capacity' })
  })
})
