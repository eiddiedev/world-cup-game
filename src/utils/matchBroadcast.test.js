import { describe, expect, it } from 'vitest'
import {
  buildHappySeedRuntimeActorConfig,
  getHappySeedRuntimeActorSnapshot,
  substituteHappySeedRuntimeActor,
} from './happySeedRuntimeActors.js'
import {
  applyMatchVisualEventAuthority,
  buildRepresentativeMatchVisualEvents,
  createMatchVisualAuthorityState,
} from './matchVisualEvent.js'
import {
  buildBroadcastSubstitutionBoard,
  buildMatchBroadcastView,
} from './matchBroadcast.js'

describe('formal match broadcast view', () => {
  const actorConfig = buildHappySeedRuntimeActorConfig()
  const events = buildRepresentativeMatchVisualEvents(actorConfig)

  it('uses gameplay authority score and same-event statistics', () => {
    const authority = events.slice(0, 2).reduce(
      applyMatchVisualEventAuthority,
      createMatchVisualAuthorityState(),
    )
    const view = buildMatchBroadcastView({
      minute: 19,
      red: { name: '法国', score: 7, possession: 56, playerCount: 11 },
      blue: { name: '巴西', score: 5, possession: 44, playerCount: 11 },
    }, {
      authority,
      events,
      completedEventIds: events.slice(0, 2).map((event) => event.id),
      completedCount: 2,
      totalCount: 5,
      status: 'completed',
    })

    expect(view.teams.red.score).toBe(1)
    expect(view.teams.blue.score).toBe(0)
    expect(view.teams.red).toMatchObject({
      shots: 2,
      shotsOnTarget: 2,
      passesCompleted: 2,
      passesAttempted: 2,
      passAccuracy: 100,
    })
    expect(view.scoreAuthority).toBe('gameplay-layer')
  })

  it('shows the active prelude without exposing its result before completion', () => {
    const active = events[1]
    const view = buildMatchBroadcastView({}, {
      authority: applyMatchVisualEventAuthority(createMatchVisualAuthorityState(), active),
      events,
      activeEventId: active.id,
      completedEventIds: [],
      totalCount: 5,
      status: 'playing',
    })

    expect(view.commentary).toHaveLength(1)
    expect(view.commentary[0]).toMatchObject({
      eventId: active.id,
      tone: 'live',
      text: active.commentary.prelude,
    })
    expect(view.commentary[0].text).not.toBe(active.commentary.result)
  })

  it('keeps only the latest three completed event lines', () => {
    const view = buildMatchBroadcastView({}, {
      authority: events.reduce(applyMatchVisualEventAuthority, createMatchVisualAuthorityState()),
      events,
      completedEventIds: events.map((event) => event.id),
      completedCount: 5,
      totalCount: 5,
      status: 'completed',
    })

    expect(view.commentary.map((line) => line.eventId)).toEqual(
      events.slice(-3).map((event) => event.id),
    )
  })

  it('filters the bench to position-compatible mobile substitution choices', () => {
    const snapshot = getHappySeedRuntimeActorSnapshot(actorConfig)
    const goalkeeper = snapshot.actors.find((actor) => actor.side === 'red' && actor.isGoalkeeper)
    const board = buildBroadcastSubstitutionBoard(snapshot, {
      side: 'red',
      outPlayerId: goalkeeper.playerId,
    })

    expect(board.selectedOut.playerId).toBe(goalkeeper.playerId)
    expect(board.bench.length).toBeGreaterThan(0)
    expect(board.bench.every((player) => player.naturalPosition === 'GK')).toBe(true)
  })

  it('does not offer the substituted-out player for re-entry', () => {
    const outgoing = actorConfig.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const incoming = actorConfig.sides.red.bench.find((player) => player.naturalPosition !== 'GK')
    const changed = substituteHappySeedRuntimeActor(actorConfig, {
      side: 'red',
      outPlayerId: outgoing.playerId,
      inPlayerId: incoming.playerId,
    })
    const board = buildBroadcastSubstitutionBoard(
      getHappySeedRuntimeActorSnapshot(changed),
      { side: 'red' },
    )

    expect(board.active.some((player) => player.playerId === incoming.playerId)).toBe(true)
    expect(board.bench.some((player) => player.playerId === outgoing.playerId)).toBe(false)
    expect(board.substitutionsMade).toBe(1)
  })
})
