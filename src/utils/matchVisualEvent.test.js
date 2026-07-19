import { describe, expect, it, vi } from 'vitest'
import { buildHappySeedRuntimeActorConfig } from './happySeedRuntimeActors.js'
import {
  MATCH_VISUAL_EVENT_TYPES,
  REPRESENTATIVE_MATCH_VISUAL_EVENT_TYPES,
  applyMatchVisualEventAuthority,
  buildRepresentativeMatchVisualEvents,
  createMatchVisualAuthorityState,
  createMatchVisualEvent,
  createMatchVisualEventFromCoachDecision,
  createMatchVisualEventQueue,
  validateMatchVisualEvent,
} from './matchVisualEvent.js'

describe('MatchVisualEvent V1', () => {
  const actorConfig = buildHappySeedRuntimeActorConfig()

  it('builds the five required representative event types in order', () => {
    const events = buildRepresentativeMatchVisualEvents(actorConfig)
    expect(events.map((event) => event.type)).toEqual(REPRESENTATIVE_MATCH_VISUAL_EVENT_TYPES)
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5])
  })

  it.each(MATCH_VISUAL_EVENT_TYPES)('binds %s to exact active business and runtime actors', (type) => {
    const event = createMatchVisualEvent({ type, actorSource: actorConfig })
    const validation = validateMatchVisualEvent(event, actorConfig)

    expect(validation).toEqual({ valid: true, errors: [] })
    expect(new Set(Object.values(event.actors).map((actor) => actor.runtimeActorId)).size).toBe(4)
    Object.values(event.actors).forEach((reference) => {
      const actor = actorConfig.actors.find((candidate) => (
        candidate.runtimeActorId === reference.runtimeActorId
      ))
      expect(actor.playerId).toBe(reference.playerId)
      expect(actor.state.onPitch).toBe(true)
    })
  })

  it('keeps the runtime presentation-only and forbids actor or ball teleporting', () => {
    const event = createMatchVisualEvent({ type: 'solo_run', actorSource: actorConfig })
    expect(event.authority).toMatchObject({
      owner: 'gameplay-layer',
      runtimeMayWriteScore: false,
      runtimeMayWriteCards: false,
    })
    expect(event.invariants).toMatchObject({
      actorTeleportAllowed: false,
      ballTeleportAllowed: false,
      networking: 'none',
    })
    expect(event.ball.motion).toBe('continuous-spline')
    expect(event.runtime.presentationOnly).toBe(true)
  })

  it('applies score, stats and result commentary once in the authority layer', () => {
    const solo = createMatchVisualEvent({ type: 'solo_run', actorSource: actorConfig })
    const first = applyMatchVisualEventAuthority(createMatchVisualAuthorityState(), solo)
    const duplicate = applyMatchVisualEventAuthority(first, solo)

    expect(first.score).toEqual({ red: 1, blue: 0 })
    expect(first.stats.red).toMatchObject({ shots: 1, shotsOnTarget: 1, goals: 1 })
    expect(first.commentary[0]).toMatchObject({ eventId: solo.id, minute: solo.minute })
    expect(duplicate).toBe(first)
  })

  it('serializes without callbacks or another hidden result source', () => {
    const event = createMatchVisualEvent({ type: 'corner', actorSource: actorConfig })
    const serialized = JSON.stringify(event)
    expect(serialized).toContain('ab-match-visual-event-completed')
    expect(serialized).not.toContain('function')
    expect(JSON.parse(serialized)).toEqual(event)
  })

  it('adapts an existing CoachDecisionEvent without reselecting its business player', () => {
    const primary = actorConfig.actors.find((actor) => (
      actor.side === 'red' && actor.assignedPosition === 'FW'
    ))
    const support = actorConfig.actors.find((actor) => (
      actor.side === 'red' && actor.assignedPosition === 'MF'
    ))
    const event = createMatchVisualEventFromCoachDecision({
      coachDecisionEvent: {
        id: 'coach.solo-shot.v1:france:38',
        sourceScenarioId: 'solo_run_penalty',
        minute: 38,
        situation: `${primary.name}形成单刀。`,
        keyPlayers: {
          primary: { id: primary.playerId },
          support: { id: support.playerId },
        },
      },
      result: { outcome: 'goal_chip', homeScoreChange: 1, awayScoreChange: 0 },
      resultText: `${primary.name}挑射破门。`,
      actorSource: actorConfig,
      side: 'red',
      sequence: 6,
    })

    expect(event).toMatchObject({
      type: 'solo_run',
      minute: 38,
      source: {
        kind: 'coach-decision-event',
        id: 'coach.solo-shot.v1:france:38',
        resultOutcome: 'goal_chip',
      },
      outcome: {
        id: 'goal_chip',
        scoreDelta: { red: 1, blue: 0 },
      },
      actors: {
        primary: { playerId: primary.playerId },
        support: { playerId: support.playerId },
      },
    })
    expect(validateMatchVisualEvent(event, actorConfig).valid).toBe(true)
  })

  it('plays queued events strictly one at a time and waits for completion', async () => {
    const events = buildRepresentativeMatchVisualEvents(actorConfig)
    const order = []
    let activeCount = 0
    const queue = createMatchVisualEventQueue({
      playEvent: vi.fn(async (event) => {
        activeCount += 1
        expect(activeCount).toBe(1)
        order.push(`start:${event.sequence}`)
        await Promise.resolve()
        order.push(`end:${event.sequence}`)
        activeCount -= 1
      }),
    })

    queue.enqueue(events)
    const result = await queue.drain()
    expect(order).toEqual(events.flatMap((event) => [
      `start:${event.sequence}`,
      `end:${event.sequence}`,
    ]))
    expect(result).toMatchObject({
      status: 'completed',
      activeEventId: null,
      completedEventIds: events.map((event) => event.id),
    })
  })

  it('rejects duplicate queue entries and records the failing event', async () => {
    const event = createMatchVisualEvent({ type: 'regular_attack', actorSource: actorConfig })
    const queue = createMatchVisualEventQueue({
      playEvent: async () => { throw new Error('runtime failed') },
    })
    queue.enqueue([event, event])
    expect(queue.getSnapshot().queued).toHaveLength(1)
    await expect(queue.drain()).rejects.toThrow('runtime failed')
    expect(queue.getSnapshot()).toMatchObject({
      status: 'failed',
      failedEventId: event.id,
      activeEventId: null,
    })
  })
})
