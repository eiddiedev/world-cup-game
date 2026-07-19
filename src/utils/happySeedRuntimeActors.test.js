import { describe, expect, it } from 'vitest'
import {
  HAPPYSEED_RUNTIME_ACTOR_COUNT,
  applyHappySeedRuntimeFormationPlan,
  buildHappySeedRuntimeActorConfig,
  patchHappySeedRuntimeActor,
  planHappySeedRuntimeFormationChange,
  substituteHappySeedRuntimeActor,
  validateHappySeedRuntimeActorConfig,
} from './happySeedRuntimeActors.js'

describe('HappySeed Runtime 业务球员映射', () => {
  it('maps two 23-player squads onto 22 unique runtime actor slots', () => {
    const config = buildHappySeedRuntimeActorConfig({ red: 'france', blue: 'brazil' })
    const validation = validateHappySeedRuntimeActorConfig(config)

    expect(validation).toMatchObject({
      valid: true,
      mappedActorCount: HAPPYSEED_RUNTIME_ACTOR_COUNT,
      activeActorCount: HAPPYSEED_RUNTIME_ACTOR_COUNT,
    })
    expect(config.sides.red.actors).toHaveLength(11)
    expect(config.sides.blue.actors).toHaveLength(11)
    expect(config.sides.red.bench).toHaveLength(12)
    expect(config.sides.blue.bench).toHaveLength(12)
    expect(new Set(config.actors.map((actor) => actor.playerId)).size).toBe(22)
    expect(config.formations.red.name).toBe('4-3-3')
    expect(config.formations.blue.name).toBe('4-2-3-1')
    expect(config.formations.blue.spots.every(([column, row]) => (
      Number.isInteger(column) && Number.isInteger(row)
    ))).toBe(true)
  })

  it('carries exact jersey, position, kit, recipe and hidden-trait bindings', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const redKeeper = config.actors[0]
    const blueOutfield = config.actors.find((actor) => (
      actor.side === 'blue' && !actor.isGoalkeeper
    ))

    expect(redKeeper).toMatchObject({
      runtimeActorId: 'red-00',
      runtimeIndex: 0,
      assignedPosition: 'GK',
      isGoalkeeper: true,
      teamId: 'france',
    })
    expect(redKeeper.visual.kitType).toBe('goalkeeper')
    expect(redKeeper.visual.number).toContain(`/${redKeeper.number}.png`)
    expect(redKeeper.visualRecipeId).toBeTruthy()
    expect(Array.isArray(redKeeper.hiddenTraits)).toBe(true)
    expect(blueOutfield.visual.kitType).toBe('away')
    expect(blueOutfield.visual.kitVariant).toBe('away')
  })

  it('patches stamina, cards and injury on one exact actor without a score field', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const target = config.actors.find((actor) => !actor.isGoalkeeper)
    const injured = patchHappySeedRuntimeActor(config, target.runtimeActorId, {
      stamina: 27,
      yellowCards: 1,
      injured: true,
    })

    expect(injured.actors.find((actor) => actor.runtimeActorId === target.runtimeActorId).state)
      .toMatchObject({ stamina: 27, yellowCards: 1, injured: true, status: 'injured' })
    expect(JSON.stringify(injured)).not.toContain('"score":')
    expect(config.actors.find((actor) => actor.runtimeActorId === target.runtimeActorId).state)
      .toMatchObject({ injured: false, yellowCards: 0 })
  })

  it('removes a red-carded actor from the active count and never restores it', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const target = config.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const redCarded = patchHappySeedRuntimeActor(config, target.runtimeActorId, { redCard: true })
    const actor = redCarded.actors.find((candidate) => candidate.runtimeActorId === target.runtimeActorId)

    expect(actor.state).toMatchObject({
      status: 'red-carded',
      onPitch: false,
      redCard: true,
    })
    expect(validateHappySeedRuntimeActorConfig(redCarded)).toMatchObject({
      valid: true,
      activeActorCount: 21,
    })
  })

  it('substitutes into the same runtime slot and blocks every re-entry path', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const outgoing = config.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const incoming = config.sides.red.bench.find((player) => player.naturalPosition !== 'GK')
    const substituted = substituteHappySeedRuntimeActor(config, {
      side: 'red',
      outPlayerId: outgoing.playerId,
      inPlayerId: incoming.playerId,
    })
    const replacement = substituted.actors.find((actor) => (
      actor.runtimeActorId === outgoing.runtimeActorId
    ))

    expect(replacement).toMatchObject({
      playerId: incoming.playerId,
      runtimeActorId: outgoing.runtimeActorId,
      runtimeIndex: outgoing.runtimeIndex,
      assignedPosition: outgoing.assignedPosition,
    })
    expect(substituted.sides.red.inactive[0].state).toMatchObject({
      status: 'substituted',
      onPitch: false,
      substitutedOut: true,
    })
    expect(substituted.sides.red.bench.some((player) => player.playerId === outgoing.playerId)).toBe(false)
    expect(substituteHappySeedRuntimeActor(substituted, {
      side: 'red',
      outPlayerId: replacement.playerId,
      inPlayerId: outgoing.playerId,
    })).toBeNull()
    expect(validateHappySeedRuntimeActorConfig(substituted).valid).toBe(true)
  })

  it('prevents a goalkeeper and outfield player from crossing runtime roles', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const goalkeeper = config.actors.find((actor) => actor.side === 'red' && actor.isGoalkeeper)
    const outfieldBench = config.sides.red.bench.find((player) => player.naturalPosition !== 'GK')

    expect(substituteHappySeedRuntimeActor(config, {
      side: 'red',
      outPlayerId: goalkeeper.playerId,
      inPlayerId: outfieldBench.playerId,
    })).toBeNull()
  })

  it('plans a formation change without teleporting or replacing runtime slots', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const plan = planHappySeedRuntimeFormationChange(config, {
      side: 'red',
      formation: '3-5-2',
    })
    const changed = applyHappySeedRuntimeFormationPlan(config, plan)

    expect(plan).toMatchObject({
      side: 'red',
      formation: '3-5-2',
      previousFormation: '4-3-3',
      actorTeleportAllowed: false,
    })
    expect(plan.assignments).toHaveLength(11)
    expect(changed.sides.red.formation).toBe('3-5-2')
    expect(changed.formations.red.name).toBe('3-5-2')
    expect(changed.sides.red.formationHistory.at(-1)).toMatchObject({
      from: '4-3-3',
      to: '3-5-2',
      actorTeleportAllowed: false,
    })
    expect(changed.actors.map((actor) => actor.runtimeActorId))
      .toEqual(config.actors.map((actor) => actor.runtimeActorId))
  })

  it('reflows the remaining ten actors after a red card', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const target = config.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const redCarded = patchHappySeedRuntimeActor(config, target.runtimeActorId, { redCard: true })
    const plan = planHappySeedRuntimeFormationChange(redCarded, {
      side: 'red',
      formation: '4-4-2',
    })

    expect(plan.assignments).toHaveLength(10)
    expect(plan.assignments.some((assignment) => assignment.playerId === target.playerId)).toBe(false)
  })
})
