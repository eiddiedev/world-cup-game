import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { ONLINE_MESSAGE, ONLINE_PROTOCOL_VERSION } from '../../src/online/onlineProtocol.js'
import { MemoryRoomStore } from './roomStore.js'
import { OnlineRoomServer } from './roomServer.js'

const lineup = (prefix) => ({
  squadPlayerIds: Array.from({ length: 23 }, (_, index) => `${prefix}-${index}`),
  lineupPlayerIds: Array.from({ length: 11 }, (_, index) => `${prefix}-${index}`),
  formation: '4-3-3',
})

function waitForMessage(socket, predicate, timeoutMs = 2_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage)
      reject(new Error('Timed out waiting for WebSocket message'))
    }, timeoutMs)
    function onMessage(raw) {
      const message = JSON.parse(String(raw))
      if (!predicate(message)) return
      clearTimeout(timer)
      socket.off('message', onMessage)
      resolve(message)
    }
    socket.on('message', onMessage)
  })
}

function send(socket, type, payload = {}) {
  socket.send(JSON.stringify({ protocolVersion: ONLINE_PROTOCOL_VERSION, type, ...payload }))
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

describe('online WebSocket room server', () => {
  let server
  const sockets = []

  afterEach(async () => {
    sockets.forEach((socket) => socket.close())
    if (server) await server.stop()
  })

  it('runs create, join, ready, host snapshot and guest-forgery rejection end to end', async () => {
    server = new OnlineRoomServer({
      host: '127.0.0.1',
      port: 0,
      store: new MemoryRoomStore(),
    })
    await server.start()
    const port = server.wss.address().port
    const host = await connect(`ws://127.0.0.1:${port}`)
    const guest = await connect(`ws://127.0.0.1:${port}`)
    sockets.push(host, guest)

    const createdMessage = waitForMessage(host, (message) => (
      message.type === ONLINE_MESSAGE.ROOM_STATE && message.room?.host
    ))
    send(host, ONLINE_MESSAGE.CREATE_ROOM, { ruleset: 'iron' })
    const created = await createdMessage
    expect(created.room.code).toMatch(/^\d{6}$/)
    expect(created.room.ruleset).toBe('iron')
    expect(created.room.reconnectToken).toBeTruthy()

    const joinedMessage = waitForMessage(guest, (message) => (
      message.type === ONLINE_MESSAGE.ROOM_STATE && message.room?.guest
    ))
    send(guest, ONLINE_MESSAGE.JOIN_ROOM, { code: created.room.code })
    const joined = await joinedMessage
    expect(joined.room.guest.side).toBe('blue')

    let stateMessage = waitForMessage(host, (message) => message.room?.host?.teamId === 'france')
    send(host, ONLINE_MESSAGE.SELECT_TEAM, { teamId: 'france', ruleset: 'iron' })
    await stateMessage
    stateMessage = waitForMessage(guest, (message) => message.room?.guest?.teamId === 'brazil')
    send(guest, ONLINE_MESSAGE.SELECT_TEAM, { teamId: 'brazil' })
    await stateMessage

    stateMessage = waitForMessage(host, (message) => message.room?.host?.lineupLocked === true)
    send(host, ONLINE_MESSAGE.LOCK_LINEUP, lineup('red'))
    await stateMessage
    stateMessage = waitForMessage(guest, (message) => message.room?.guest?.lineupLocked === true)
    send(guest, ONLINE_MESSAGE.LOCK_LINEUP, lineup('blue'))
    await stateMessage

    stateMessage = waitForMessage(host, (message) => message.room?.host?.ready === true)
    send(host, ONLINE_MESSAGE.READY, { ready: true })
    await stateMessage
    const matchStarted = waitForMessage(host, (message) => message.type === ONLINE_MESSAGE.MATCH_STARTED)
    send(guest, ONLINE_MESSAGE.READY, { ready: true })
    expect((await matchStarted).room.status).toBe('playing')

    const forgeryRejected = waitForMessage(guest, (message) => (
      message.type === ONLINE_MESSAGE.ERROR && message.code === 'host-authority-required'
    ))
    send(guest, ONLINE_MESSAGE.SNAPSHOT, { snapshot: { seq: 1, score: { red: 99, blue: 0 } } })
    await expect(forgeryRejected).resolves.toMatchObject({ code: 'host-authority-required' })

    const authoritativeSnapshot = waitForMessage(guest, (message) => (
      message.type === ONLINE_MESSAGE.SNAPSHOT && message.snapshot?.seq === 1
    ))
    send(host, ONLINE_MESSAGE.SNAPSHOT, {
      snapshot: { seq: 1, score: { red: 1, blue: 0 }, actors: [], ball: [0.5, 0.5, 0] },
    })
    await expect(authoritativeSnapshot).resolves.toMatchObject({
      snapshot: { score: { red: 1, blue: 0 } },
    })
  })

  it('keeps penalty choices hidden until both clients submit and then broadcasts one result', async () => {
    server = new OnlineRoomServer({
      host: '127.0.0.1',
      port: 0,
      store: new MemoryRoomStore(),
    })
    await server.start()
    const port = server.wss.address().port
    const host = await connect(`ws://127.0.0.1:${port}`)
    const guest = await connect(`ws://127.0.0.1:${port}`)
    sockets.push(host, guest)

    let stateMessage = waitForMessage(host, (message) => message.room?.ruleset === 'penalty')
    send(host, ONLINE_MESSAGE.CREATE_ROOM, { ruleset: 'penalty' })
    const created = await stateMessage
    stateMessage = waitForMessage(guest, (message) => message.room?.guest)
    send(guest, ONLINE_MESSAGE.JOIN_ROOM, { code: created.room.code })
    await stateMessage

    stateMessage = waitForMessage(host, (message) => message.room?.host?.teamId === 'france')
    send(host, ONLINE_MESSAGE.SELECT_TEAM, { teamId: 'france', ruleset: 'penalty' })
    await stateMessage
    stateMessage = waitForMessage(guest, (message) => message.room?.guest?.teamId === 'brazil')
    send(guest, ONLINE_MESSAGE.SELECT_TEAM, { teamId: 'brazil' })
    await stateMessage
    stateMessage = waitForMessage(host, (message) => message.room?.host?.lineupLocked)
    send(host, ONLINE_MESSAGE.LOCK_LINEUP, lineup('red'))
    await stateMessage
    stateMessage = waitForMessage(guest, (message) => message.room?.guest?.lineupLocked)
    send(guest, ONLINE_MESSAGE.LOCK_LINEUP, lineup('blue'))
    await stateMessage
    stateMessage = waitForMessage(host, (message) => message.room?.host?.ready)
    send(host, ONLINE_MESSAGE.READY, { ready: true })
    await stateMessage
    const startedMessage = waitForMessage(host, (message) => message.type === ONLINE_MESSAGE.MATCH_STARTED)
    send(guest, ONLINE_MESSAGE.READY, { ready: true })
    const started = await startedMessage
    expect(started.room.match.penalty).toMatchObject({ attemptIndex: 0, shots: [] })

    const hiddenChoice = waitForMessage(guest, (message) => (
      message.type === ONLINE_MESSAGE.PENALTY_STATE && message.resolvedAttempt === null
    ))
    send(host, ONLINE_MESSAGE.PENALTY_CHOICE, {
      attemptIndex: 0,
      role: 'shooter',
      zone: 'left-top',
      power: 0.7,
    })
    expect(await hiddenChoice).not.toHaveProperty('shooterZone')

    const resolvedChoice = waitForMessage(host, (message) => (
      message.type === ONLINE_MESSAGE.PENALTY_STATE && message.resolvedAttempt?.attemptIndex === 0
    ))
    send(guest, ONLINE_MESSAGE.PENALTY_CHOICE, {
      attemptIndex: 0,
      role: 'keeper',
      zone: 'right-bottom',
    })
    await expect(resolvedChoice).resolves.toMatchObject({
      resolvedAttempt: {
        attemptIndex: 0,
        team: 'home',
        shooterZone: 'left-top',
        keeperZone: 'right-bottom',
      },
    })
  })
})
