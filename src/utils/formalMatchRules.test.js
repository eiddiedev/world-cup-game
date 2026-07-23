import { describe, expect, it } from 'vitest'
import { buildHappySeedRuntimeActorConfig } from './happySeedRuntimeActors.js'
import {
  applyFormalMatchRuleIncident,
  buildFormalMatchRuleReport,
  settleRunMatchRules,
} from './formalMatchRules.js'

describe('formal match rules', () => {
  it('turns a second yellow card into a real actor removal', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const target = config.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const first = applyFormalMatchRuleIncident(config, {
      type: 'yellow-card',
      runtimeActorId: target.runtimeActorId,
      minute: 31,
    })
    const second = applyFormalMatchRuleIncident(first.actorConfig, {
      type: 'yellow-card',
      runtimeActorId: target.runtimeActorId,
      minute: 72,
    })

    expect(first.incident).toMatchObject({ secondYellow: false, removesActor: false })
    expect(second.incident).toMatchObject({ secondYellow: true, removesActor: true })
    expect(second.incident.state).toMatchObject({
      yellowCards: 2,
      redCard: true,
      status: 'red-carded',
      onPitch: false,
    })
  })

  it('keeps an injured actor on the pitch until a substitution is made', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const target = config.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const result = applyFormalMatchRuleIncident(config, {
      type: 'injury',
      playerId: target.playerId,
      minute: 55,
    })

    expect(result.incident.state).toMatchObject({
      injured: true,
      status: 'injured',
      onPitch: true,
    })
  })

  it('persists injuries, stamina and one-match red-card suspensions', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const target = config.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const injured = applyFormalMatchRuleIncident(config, {
      type: 'injury',
      playerId: target.playerId,
    })
    const redCarded = applyFormalMatchRuleIncident(injured.actorConfig, {
      type: 'red-card',
      playerId: target.playerId,
    })
    const report = buildFormalMatchRuleReport(redCarded.actorConfig, { matchId: 'group-1' })
    const settled = settleRunMatchRules({
      matchIndex: 1,
      suspendedPlayers: ['served-player'],
      suspensionMatches: { 'served-player': 1 },
    }, report)

    expect(settled.injuredPlayers).toContain(target.playerId)
    expect(settled.suspendedPlayers).toEqual([target.playerId])
    expect(settled.suspensionMatches[target.playerId]).toBe(1)
    expect(settled.suspensionMatches['served-player']).toBeUndefined()
    expect(settled.playerStatuses[target.playerId]).toBeGreaterThan(0)
    expect(settled.lastMatchRuleReport.matchId).toBe('group-1')
  })

  it('only persists the coached side and releases one-match absences after the served match', () => {
    const config = buildHappySeedRuntimeActorConfig()
    const home = config.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const away = config.actors.find((actor) => actor.side === 'blue' && !actor.isGoalkeeper)
    const actors = config.actors.map((actor) => (
      actor.playerId === home.playerId || actor.playerId === away.playerId
        ? { ...actor, state: { ...actor.state, injured: true } }
        : actor
    ))
    const firstReport = buildFormalMatchRuleReport({ ...config, actors }, { matchId: 'group-1' })
    const injured = settleRunMatchRules({}, firstReport)
    expect(injured.injuredPlayers).toEqual([home.playerId])
    expect(injured.playerMatchStates[away.playerId]).toBeUndefined()

    const served = settleRunMatchRules(injured, buildFormalMatchRuleReport(config, { matchId: 'group-2' }))
    expect(served.injuredPlayers).toEqual([])
    expect(served.injuryMatches).toEqual({})
  })
})
