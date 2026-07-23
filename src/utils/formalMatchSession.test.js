import { describe, expect, it } from 'vitest'
import { DECISION_LIBRARY } from '../data/decisionLibrary.js'
import { buildHappySeedRuntimeActorConfig } from './happySeedRuntimeActors.js'
import {
  FORMAL_COACH_DECISION_CATALOG,
  buildFormalCoachDecision,
} from './formalCoachDecision.js'
import {
  createDangerousFreeKickRuntimeMomentFixture,
} from './decisionSceneScriptV2.js'
import {
  buildFormalDecisionSceneScriptV3,
  validateDecisionSceneScriptV3,
} from './decisionSceneScriptV3.js'
import { validateFormalDecisionSceneCatalogV3 } from './formalDecisionSceneCatalogV3.js'
import {
  FORMAL_MATCH_DECISION_TARGET_MINUTES,
  FORMAL_MATCH_REALTIME_MINUTES,
  FORMAL_MATCH_ROUTINE_COMMENTARY_BUDGET,
  advanceFormalMatchSession,
  buildFormalMatchSessionReport,
  createFormalMatchSession,
  deriveFormalRuntimeIncidents,
  finalizeFormalMatchSession,
  recordFormalRuntimeGoal,
  resolveFormalGoalVar,
  settleFormalDecisionInSession,
  startFormalExtraTime,
  startFormalMatchSession,
} from './formalMatchSession.js'

function runtimeMoment(actorSource) {
  const freeKickDecision = buildFormalCoachDecision({
    actorSource,
    scenarioId: 'freekick_dangerous',
    minute: 44,
  })
  return {
    ...createDangerousFreeKickRuntimeMomentFixture(actorSource, freeKickDecision),
    runtimeState: 'Match',
    ballOutOfPlay: false,
  }
}

function runtimeEvent(type, minute, extra = {}) {
  return {
    schemaVersion: 'match-runtime-event-v1',
    id: extra.id || `runtime.${minute}.${type}`,
    type,
    sourceEventId: extra.sourceEventId || null,
    frameId: minute * 60,
    matchTime: minute * 80,
    minute,
    side: extra.side || 'red',
    previousSide: extra.previousSide || null,
    actorRuntimeIds: extra.actorRuntimeIds || [],
    primaryRuntimeActorId: extra.primaryRuntimeActorId || null,
    secondaryRuntimeActorId: extra.secondaryRuntimeActorId || null,
    ball: { before: [0.5, 0.5, 0], after: [0.5, 0.5, 0] },
    runtimeStateBefore: 'Match',
    runtimeStateAfter: 'Match',
    detail: extra.detail || {},
  }
}

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

describe('FormalMatchSession 正式比赛权威链', () => {
  const actorSource = buildHappySeedRuntimeActorConfig()
  const moment = runtimeMoment(actorSource)

  it('audits all 53 scenarios and all 171 outcomes without fallback', () => {
    expect(validateFormalDecisionSceneCatalogV3()).toEqual(expect.objectContaining({
      valid: true,
      scenarioCount: 53,
      modeCounts: {
        'freeze-live': 30,
        'blackout-stage': 12,
        'freeze-incident': 8,
        'freeze-match-state': 3,
      },
    }))
  })

  it('builds a valid explicit director script for every decision and every outcome', () => {
    for (let index = 0; index < DECISION_LIBRARY.length; index += 1) {
      const plan = FORMAL_COACH_DECISION_CATALOG[index]
      const decision = buildFormalCoachDecision({
        actorSource,
        sequenceIndex: index,
        schedule: FORMAL_COACH_DECISION_CATALOG,
      })
      const script = buildFormalDecisionSceneScriptV3(
        decision,
        actorSource,
        moment,
        runtimeEvent('foul', 44, { sourceEventId: 'runtime.contact.1' }),
      )
      expect(validateDecisionSceneScriptV3(script, decision), plan.scenarioId).toEqual({
        valid: true,
        errors: [],
      })
      script.choices.forEach((choice, choiceIndex) => {
        expect(Object.keys(choice.outcomes).sort())
          .toEqual(Array.from(new Set(
            decision.choices[choiceIndex].possible_outcomes,
          )).sort())
      })
    }
  })

  it('opens ten match-aware decisions around the authored minute windows', () => {
    let session = startFormalMatchSession(createFormalMatchSession({
      teamName: '法国',
      opponentName: '巴西',
    }))
    const forcedScenarioIds = [
      'freekick_dangerous',
      'header_corner',
      'midfield_press_trigger',
      'penalty_area_foul_risk',
      'long_shot_opportunity',
      'throwin_attack',
      'indirect_freekick_box',
      'counter_attack_3v2',
      'midfield_second_ball',
      'half_space_through_run',
    ]

    const eventTypes = ['foul', 'corner', 'possession-change', 'touch', 'touch', 'throw-in', 'foul', 'possession-change', 'touch', 'pass']
    const eventSides = ['blue', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'red', 'red', 'red']

    FORMAL_MATCH_DECISION_TARGET_MINUTES.forEach((minute, index) => {
      const eligibleMoment = index === 3
        ? {
          ...moment,
          attackingSide: 'blue',
          ball: { normalized: [0.22, moment.ball.normalized[1], 0] },
        }
        : index === 2
          ? { ...moment, attackingSide: 'blue', ball: { normalized: [0.5, 0.5, 0] } }
          : moment
      const advanced = advanceFormalMatchSession(session, {
        snapshot: {
          minute,
          red: { possession: 52, shots: 1, passes: 8 },
          blue: { possession: 48, shots: 1, passes: 7 },
        },
        runtimeMoment: eligibleMoment,
        actorSource,
        forcedScenarioIds,
        runtimeEvents: [runtimeEvent(eventTypes[index], minute, {
          side: eventSides[index],
          sourceEventId: index === 0 ? 'runtime.10.tackle-contact' : null,
        })],
      })
      expect(advanced.decisionPlan?.scenarioId).toBe(forcedScenarioIds[index])
      session = advanced.session
      const decision = buildFormalCoachDecision({
        actorSource,
        sequenceIndex: index,
        scenarioId: advanced.decisionPlan.scenarioId,
        minute,
        preferredPlayerId: advanced.decisionPlan.preferredPlayerId,
      })
      session = settleFormalDecisionInSession(session, decision, {
        choice: decision.choices[0],
        result: {
          outcome: decision.choices[0].possible_outcomes[0],
          isSuccess: true,
          homeScoreChange: 0,
          awayScoreChange: 0,
        },
        resultText: `第${minute}分钟决策已完成`,
        authorityDeltas: { statsDelta: {}, opponentStatsDelta: {} },
      })
    })

    expect(session.decisions).toHaveLength(10)
    expect(session.commentary.at(-1)).toEqual(expect.objectContaining({
      minute: FORMAL_MATCH_DECISION_TARGET_MINUTES.at(-1),
      text: `第${FORMAL_MATCH_DECISION_TARGET_MINUTES.at(-1)}分钟决策已完成`,
    }))
  })

  it('turns a real attacking corner into the authored front-post/back-post/tactical choice immediately', () => {
    const advanced = advanceFormalMatchSession(startFormalMatchSession(createFormalMatchSession()), {
      snapshot: { minute: 4 },
      runtimeMoment: moment,
      actorSource,
      random: () => 0,
      runtimeEvents: [runtimeEvent('corner', 4, { side: 'red' })],
    })
    expect(advanced.decisionPlan).toEqual(expect.objectContaining({
      scenarioId: 'header_corner',
      sourceEvent: expect.objectContaining({ type: 'corner', side: 'red' }),
    }))
  })

  it('prioritizes attacking and defending box-entry decisions from the current field direction', () => {
    const redBoxMoment = {
      ...moment,
      attackingSide: 'red',
      attackDirection: 1,
      ball: { normalized: [0.81, 0.5, 0] },
      ballOutOfPlay: false,
    }
    const redAdvanced = advanceFormalMatchSession(startFormalMatchSession(createFormalMatchSession()), {
      snapshot: { minute: 6 },
      runtimeMoment: redBoxMoment,
      actorSource,
      random: () => 0,
      runtimeEvents: [runtimeEvent('touch', 6, { side: 'red' })],
    })
    expect(redAdvanced.decisionPlan?.scenarioId).toBe('solo_run_penalty')

    const blueBoxMoment = {
      ...moment,
      attackingSide: 'blue',
      attackDirection: -1,
      ball: { normalized: [0.19, 0.5, 0] },
      ballOutOfPlay: false,
    }
    const blueAdvanced = advanceFormalMatchSession(startFormalMatchSession(createFormalMatchSession()), {
      snapshot: { minute: 6 },
      runtimeMoment: blueBoxMoment,
      actorSource,
      random: () => 0,
      runtimeEvents: [runtimeEvent('touch', 6, { side: 'blue' })],
    })
    expect(blueAdvanced.decisionPlan?.scenarioId).toBe('penalty_area_foul_risk')
  })

  it('keeps the natural decision window mean around ten across 300 local matches', () => {
    const sourceTypes = [
      'touch', 'pass', 'shot', 'possession-change', 'tackle-contact',
      'corner', 'throw-in', 'goal-kick', 'goal', 'ball-out',
    ]
    const counts = []
    for (let matchIndex = 0; matchIndex < 300; matchIndex += 1) {
      let session = startFormalMatchSession(createFormalMatchSession({
        matchId: `simulation.${matchIndex}`,
      }))
      const random = seededRandom(matchIndex + 1)
      for (const targetMinute of FORMAL_MATCH_DECISION_TARGET_MINUTES) {
        for (let attempt = 0; attempt < 8 && session.status === 'running'; attempt += 1) {
          const minute = targetMinute + attempt
          const events = sourceTypes.map((type, eventIndex) => ({
            ...runtimeEvent(type, minute, { side: eventIndex % 2 ? 'blue' : 'red' }),
            id: `simulation.${matchIndex}.${targetMinute}.${attempt}.${type}`,
          }))
          const advanced = advanceFormalMatchSession(session, {
            snapshot: { minute },
            runtimeMoment: moment,
            actorSource,
            runtimeEvents: events,
            random,
          })
          session = advanced.session
          if (!advanced.decisionPlan) continue
          let decision
          try {
            decision = buildFormalCoachDecision({
              actorSource,
              scenarioId: advanced.decisionPlan.scenarioId,
              minute,
            })
          } catch (error) {
            throw new Error(`${advanced.decisionPlan.scenarioId}: ${error.message}`, { cause: error })
          }
          session = settleFormalDecisionInSession(session, decision, {
            choice: decision.choices[0],
            result: {
              outcome: decision.choices[0].possible_outcomes[0],
              isSuccess: true,
              homeScoreChange: 0,
              awayScoreChange: 0,
            },
            resultText: '模拟决策完成',
            authorityDeltas: { statsDelta: {}, opponentStatsDelta: {} },
          })
        }
      }
      counts.push(session.decisions.length)
    }
    const mean = counts.reduce((total, value) => total + value, 0) / counts.length
    expect(mean).toBeGreaterThanOrEqual(9.5)
    expect(mean).toBeLessThanOrEqual(10.5)
  })

  it('uses native Runtime goals and the same minute for score and commentary', () => {
    let session = startFormalMatchSession(createFormalMatchSession())
    session = { ...session, minute: 37 }
    const scorer = actorSource.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    session = recordFormalRuntimeGoal(session, {
      score: [1, 0],
      scorerRuntimeActorId: scorer.runtimeActorId,
    }, moment, actorSource)
    expect(session.score).toEqual({ red: 1, blue: 0 })
    expect(session.commentary.at(-1)).toEqual(expect.objectContaining({
      minute: 37,
      type: 'runtime-goal',
      tone: 'standard',
      text: expect.stringContaining(`${scorer.number}号${scorer.name}`),
    }))
    expect(recordFormalRuntimeGoal(session, { score: [1, 0] }, moment, actorSource).score)
      .toEqual({ red: 1, blue: 0 })
  })

  it('describes a goalkeeper touch that still crosses the line as a failed parry, not a save', () => {
    const scorer = actorSource.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const session = recordFormalRuntimeGoal(
      startFormalMatchSession(createFormalMatchSession()),
      {
        score: [1, 0],
        scorerRuntimeActorId: scorer.runtimeActorId,
        runtimeEventId: 'runtime.goal.keeper-touch',
        shotEventId: 'runtime.shot.keeper-touch',
        keeperTouch: true,
      },
      moment,
      actorSource,
    )
    expect(session.commentary.at(-1).text).toContain('门将碰到皮球，但没能阻止它入网')
    expect(session.commentary.at(-1).text).not.toContain('完成扑救')
  })

  it('counts a decision goal only once when the Runtime confirms the goal line', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'solo_run_penalty' })
    let session = {
      ...startFormalMatchSession(createFormalMatchSession()),
      status: 'decision',
      phase: 'executing',
      minute: 24,
      pendingDecisionId: 'decision.goal.once',
      pendingDecisionSourceEvent: runtimeEvent('shot', 24),
    }
    session = settleFormalDecisionInSession(session, decision, {
      choice: decision.choices[0],
      result: {
        outcome: 'goal_near_post',
        isSuccess: true,
        homeScoreChange: 1,
        awayScoreChange: 0,
      },
      resultText: '前锋完成射门，足球越过门线。',
      requiresRuntimeGoal: true,
      authorityDeltas: { statsDelta: {}, opponentStatsDelta: {} },
    })
    expect(session.score).toEqual({ red: 0, blue: 0 })
    expect(session.commentary).toHaveLength(0)
    session = recordFormalRuntimeGoal(session, {
      score: [1, 0],
      runtimeEventId: 'runtime.goal.decision.once',
      shotEventId: 'runtime.shot.decision.once',
      timestamp: 10000,
    }, moment, actorSource)
    expect(session.score).toEqual({ red: 1, blue: 0 })
    expect(session.commentary).toHaveLength(1)
    expect(session.commentary[0].text).toContain('比分更新为 1:0')
    expect(session.commentary[0].tone).toBe('highlight')
    expect(recordFormalRuntimeGoal(session, { score: [1, 0] }, moment, actorSource).score)
      .toEqual({ red: 1, blue: 0 })
    const duplicateCrossing = recordFormalRuntimeGoal(session, {
      score: [2, 0],
      runtimeEventId: 'runtime.goal.decision.duplicate-crossing',
      shotEventId: 'runtime.shot.decision.once',
      timestamp: 11200,
    }, moment, actorSource)
    expect(duplicateCrossing.score).toEqual({ red: 1, blue: 0 })
    expect(duplicateCrossing.nativeRuntimeScore).toEqual({ red: 1, blue: 0 })
    expect(duplicateCrossing.commentary).toHaveLength(1)
  })

  it('counts three distinct goals even when they arrive inside the old debounce window', () => {
    let session = startFormalMatchSession(createFormalMatchSession())
    ;[
      { score: [1, 0], runtimeEventId: 'runtime.goal.rapid.1', shotEventId: 'runtime.shot.rapid.1', timestamp: 10000 },
      { score: [2, 0], runtimeEventId: 'runtime.goal.rapid.2', shotEventId: 'runtime.shot.rapid.2', timestamp: 10600 },
      { score: [3, 0], runtimeEventId: 'runtime.goal.rapid.3', shotEventId: 'runtime.shot.rapid.3', timestamp: 11200 },
    ].forEach((goal) => {
      session = recordFormalRuntimeGoal(session, goal, moment, actorSource)
    })
    expect(session.score).toEqual({ red: 3, blue: 0 })
    expect(session.nativeRuntimeScore).toEqual({ red: 3, blue: 0 })
    expect(session.commentary.filter((line) => line.type === 'runtime-goal')).toHaveLength(3)
  })

  it('does not treat missing shot ids as proof that separate goals are duplicates', () => {
    let session = startFormalMatchSession(createFormalMatchSession())
    session = recordFormalRuntimeGoal(session, {
      score: [1, 0],
      runtimeEventId: 'runtime.goal.no-shot.1',
      timestamp: 20000,
    }, moment, actorSource)
    session = recordFormalRuntimeGoal(session, {
      score: [2, 0],
      runtimeEventId: 'runtime.goal.no-shot.2',
      timestamp: 20500,
    }, moment, actorSource)
    session = recordFormalRuntimeGoal(session, {
      score: [3, 0],
      runtimeEventId: 'runtime.goal.no-shot.3',
      timestamp: 21000,
    }, moment, actorSource)
    expect(session.score).toEqual({ red: 3, blue: 0 })
    expect(session.nativeRuntimeScore).toEqual({ red: 3, blue: 0 })
  })

  it('catches the formal score up when a unique Runtime goal reports a score jump', () => {
    const session = recordFormalRuntimeGoal(
      startFormalMatchSession(createFormalMatchSession()),
      {
        score: [3, 0],
        runtimeEventId: 'runtime.goal.reconcile.3',
        timestamp: 30000,
      },
      moment,
      actorSource,
    )
    expect(session.score).toEqual({ red: 3, blue: 0 })
    expect(session.nativeRuntimeScore).toEqual({ red: 3, blue: 0 })
    expect(session.commentary.at(-1).text).toContain('比分更新为 3:0')
  })

  it('gives a selected goal one sourced VAR review and an explicit result', () => {
    const goal = runtimeEvent('goal', 41, {
      detail: { forceVarReview: true, forceVarOutcome: 'valid', score: [1, 0] },
    })
    const incidents = deriveFormalRuntimeIncidents(goal)
    expect(incidents.map((event) => event.type)).toEqual(['var-review', 'var-result'])
    expect(incidents.every((event) => event.sourceEventId === goal.id)).toBe(true)
    expect(incidents.at(-1).detail).toMatchObject({
      outcome: 'valid',
      scoringSide: 'red',
    })
  })

  it('allows ordinary goals to stand without opening VAR', () => {
    const goal = runtimeEvent('goal', 40, {
      detail: { forceVarReview: false, score: [1, 0] },
    })
    expect(resolveFormalGoalVar(goal)).toMatchObject({
      reviewed: false,
      outcome: 'valid',
      reason: null,
    })
    expect(deriveFormalRuntimeIncidents(goal)).toEqual([])
  })

  it('reviews a stable minority of unforced goals instead of every goal', () => {
    const reviewed = Array.from({ length: 200 }, (_, index) => (
      deriveFormalRuntimeIncidents(runtimeEvent('goal', 20 + (index % 70), {
        id: `runtime.goal.var-sample.${index}`,
        detail: { score: [1, 0] },
      })).some((event) => event.type === 'var-review')
    )).filter(Boolean).length
    expect(reviewed).toBeGreaterThanOrEqual(40)
    expect(reviewed).toBeLessThanOrEqual(75)
  })

  it('keeps the VAR review visible before a separately delivered ruling', () => {
    const goal = runtimeEvent('goal', 41, {
      detail: { forceVarOutcome: 'valid', score: [1, 0] },
    })
    const [review, result] = deriveFormalRuntimeIncidents(goal)
    let session = startFormalMatchSession(createFormalMatchSession())
    session = { ...session, minute: 41 }
    session = recordFormalRuntimeGoal(session, {
      score: [1, 0],
      runtimeEventId: goal.id,
      timestamp: 41000,
    }, moment, actorSource)
    session = advanceFormalMatchSession(session, {
      snapshot: { minute: 41 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      deriveRuntimeIncidents: false,
      runtimeEvents: [goal, review],
    }).session

    expect(session.commentary.at(-1)).toMatchObject({
      type: 'var-review',
      sourceEventId: goal.id,
    })
    expect(session.commentary.some((line) => line.type === 'var-result')).toBe(false)

    session = advanceFormalMatchSession(session, {
      snapshot: { minute: 41 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      deriveRuntimeIncidents: false,
      runtimeEvents: [result],
    }).session
    expect(session.commentary.at(-1)).toMatchObject({
      type: 'var-result',
      sourceEventId: goal.id,
      text: expect.stringContaining('进球有效'),
    })
  })

  it('can disallow a goal but never invents offside for a penalty goal', () => {
    const penaltyGoal = runtimeEvent('goal', 52, {
      detail: {
        scenarioId: 'penalty_kick',
        forceVarOutcome: 'disallowed',
      },
    })
    expect(resolveFormalGoalVar(penaltyGoal)).toMatchObject({
      outcome: 'disallowed',
      reason: 'attacking-foul',
      penalty: true,
    })
  })

  it('rolls an invalid VAR goal back once and narrates the final ruling', () => {
    const goal = runtimeEvent('goal', 58, {
      detail: { forceVarOutcome: 'disallowed', score: [1, 0] },
    })
    let session = startFormalMatchSession(createFormalMatchSession())
    session = { ...session, minute: 58 }
    session = recordFormalRuntimeGoal(session, {
      score: [1, 0],
      runtimeEventId: goal.id,
      timestamp: 50000,
    }, moment, actorSource)
    const advanced = advanceFormalMatchSession(session, {
      snapshot: { minute: 58 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: [goal],
    })
    expect(advanced.session.score).toEqual({ red: 0, blue: 0 })
    expect(advanced.session.nativeRuntimeScore).toEqual({ red: 0, blue: 0 })
    expect(advanced.session.commentary.at(-1)).toMatchObject({
      type: 'var-result',
      tone: 'standard',
      text: expect.stringContaining('进球无效'),
    })
  })

  it('highlights VAR lines only when they belong to a coach-decision goal', () => {
    const regularGoal = runtimeEvent('goal', 42, {
      detail: { forceVarOutcome: 'valid', score: [1, 0] },
    })
    const decisionGoal = runtimeEvent('goal', 43, {
      detail: {
        decision: true,
        scenarioId: 'solo_run_penalty',
        forceVarOutcome: 'valid',
        score: [1, 0],
      },
    })
    const base = startFormalMatchSession(createFormalMatchSession())
    const regular = advanceFormalMatchSession(base, {
      snapshot: { minute: 42 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: [regularGoal],
    }).session
    const decision = advanceFormalMatchSession(base, {
      snapshot: { minute: 43 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: [decisionGoal],
    }).session

    expect(regular.commentary.filter((line) => line.type.startsWith('var-')))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'var-review', tone: 'standard' }),
        expect.objectContaining({ type: 'var-result', tone: 'standard' }),
      ]))
    expect(decision.commentary.filter((line) => line.type.startsWith('var-')))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'var-review', tone: 'highlight' }),
        expect.objectContaining({ type: 'var-result', tone: 'highlight' }),
      ]))
  })

  it('highlights injury and fatigue only when the actual actor state crosses the threshold', () => {
    const statefulActors = JSON.parse(JSON.stringify(actorSource))
    const actor = statefulActors.actors.find((candidate) => (
      candidate.side === 'red' && candidate.state?.onPitch
    ))
    actor.state.injured = true
    actor.state.stamina = 21
    const first = advanceFormalMatchSession(startFormalMatchSession(createFormalMatchSession()), {
      snapshot: { minute: 64 },
      runtimeMoment: moment,
      actorSource: statefulActors,
      decisionsEnabled: false,
      runtimeEvents: [],
    }).session
    const alerts = first.commentary.filter((line) => (
      ['player-unavailable', 'player-fatigue'].includes(line.type)
    ))
    expect(alerts).toHaveLength(2)
    expect(alerts.every((line) => line.tone === 'highlight')).toBe(true)
    expect(alerts.find((line) => line.type === 'player-fatigue')?.text).toContain('21')

    const second = advanceFormalMatchSession(first, {
      snapshot: { minute: 65 },
      runtimeMoment: moment,
      actorSource: statefulActors,
      decisionsEnabled: false,
      runtimeEvents: [],
    }).session
    expect(second.commentary.filter((line) => (
      ['player-unavailable', 'player-fatigue'].includes(line.type)
    ))).toHaveLength(2)
  })

  it('calls the opening kickoff the start of the match', () => {
    const advanced = advanceFormalMatchSession(startFormalMatchSession(createFormalMatchSession()), {
      snapshot: { minute: 0 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: [runtimeEvent('kickoff', 0, {
        side: 'blue',
        detail: { firstKickoff: true },
      })],
    })
    expect(advanced.session.commentary.at(-1).text).toContain('比赛正式开始')
  })

  it('merges a real restart into the preceding goal line without losing either source event', () => {
    let session = startFormalMatchSession(createFormalMatchSession())
    session = { ...session, minute: 37 }
    const scorer = actorSource.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    session = recordFormalRuntimeGoal(session, {
      score: [1, 0],
      scorerRuntimeActorId: scorer.runtimeActorId,
      runtimeEventId: 'runtime.37.goal',
    }, moment, actorSource)
    const advanced = advanceFormalMatchSession(session, {
      snapshot: { minute: 38 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: [runtimeEvent('kickoff', 38, { side: 'blue' })],
    })
    expect(advanced.session.commentary).toHaveLength(1)
    expect(advanced.session.commentary[0]).toEqual(expect.objectContaining({
      followupSourceEventId: 'runtime.38.kickoff',
      sourceEventIds: ['runtime.37.goal', 'runtime.38.kickoff'],
      text: expect.stringContaining('随后'),
    }))
  })

  it('aggregates a real shot burst and its resulting goal kick with full provenance', () => {
    const session = startFormalMatchSession(createFormalMatchSession())
    const advanced = advanceFormalMatchSession(session, {
      snapshot: { minute: 12 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: [
        runtimeEvent('shot', 10, { side: 'red' }),
        runtimeEvent('shot', 11, { side: 'red' }),
        runtimeEvent('goal-kick', 12, { side: 'blue' }),
      ],
    })
    expect(advanced.session.commentary).toHaveLength(1)
    expect(advanced.session.commentary[0]).toEqual(expect.objectContaining({
      eventCount: 2,
      restartSourceEventId: 'runtime.12.goal-kick',
      sourceEventIds: [
        'runtime.10.shot',
        'runtime.11.shot',
        'runtime.12.goal-kick',
      ],
      text: expect.stringMatching(/连续2次攻门.*门球/),
    }))
  })

  it('writes minor rules such as a throw-in violation without opening a decision', () => {
    const session = startFormalMatchSession(createFormalMatchSession())
    const advanced = advanceFormalMatchSession(session, {
      snapshot: { minute: 20 },
      runtimeMoment: {
        ...moment,
        runtimeState: 'ThrowIn',
        ballOutOfPlay: true,
      },
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: [runtimeEvent('throw-in-violation', 20, {
        sourceEventId: 'runtime.20.throw-in',
      })],
    })
    expect(advanced.decisionPlan).toBeNull()
    expect(advanced.session.commentary.at(-1)).toEqual(expect.objectContaining({
      minute: 20,
      type: 'throw-in-violation',
      text: expect.stringContaining('手抛球犯规'),
    }))
  })

  it('derives factual fouls only from real contacts and preserves source provenance', () => {
    const contact = Array.from({ length: 80 }, (_, index) => ({
      ...runtimeEvent('tackle-contact', 28, {
        side: 'blue',
        detail: { contact: 'slide-hit' },
      }),
      id: `runtime.28.tackle-contact.${index}`,
    })).find((candidate) => deriveFormalRuntimeIncidents(candidate).some((event) => event.type === 'foul'))
    const incidents = deriveFormalRuntimeIncidents(contact)
    expect(incidents.find((event) => event.type === 'foul')).toEqual(expect.objectContaining({
      sourceEventId: contact.id,
      side: 'blue',
      detail: expect.objectContaining({ awardedSide: 'red' }),
    }))
    expect(deriveFormalRuntimeIncidents(runtimeEvent('pass', 28))).toEqual([])

    const advanced = advanceFormalMatchSession(startFormalMatchSession(createFormalMatchSession()), {
      snapshot: { minute: 28 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: [contact],
    })
    expect(advanced.session.stats.blue.fouls).toBe(1)
    expect(advanced.session.commentary.some((line) => (
      line.type === 'foul' && line.sourceEventId === contact.id
    ))).toBe(true)
  })

  it('does not turn every tackle into a foul or every foul into a yellow card', () => {
    const samples = Array.from({ length: 1000 }, (_, index) => ({
      ...runtimeEvent('tackle-contact', 32, {
        side: index % 2 ? 'red' : 'blue',
        detail: { contact: 'slide-hit' },
      }),
      id: `discipline.sample.${index}`,
    })).map(deriveFormalRuntimeIncidents)
    const foulCount = samples.filter((events) => events.some((event) => event.type === 'foul')).length
    const yellowCount = samples.filter((events) => events.some((event) => (
      event.type === 'card' && event.detail?.color === 'yellow'
    ))).length
    const redCount = samples.filter((events) => events.some((event) => (
      event.type === 'card' && event.detail?.color === 'red'
    ))).length

    expect(foulCount).toBeGreaterThan(500)
    expect(foulCount).toBeLessThan(660)
    expect(yellowCount).toBeGreaterThan(35)
    expect(yellowCount).toBeLessThan(110)
    expect(redCount).toBeLessThan(15)
  })

  it('awards a penalty for a missed slide in the tackler own box', () => {
    const contact = runtimeEvent('tackle-contact', 34, {
      side: 'blue',
      detail: {
        contact: 'slide-hit',
        ballWon: false,
        missedBall: true,
        inOwnPenaltyArea: true,
      },
    })
    const incidents = deriveFormalRuntimeIncidents(contact)
    expect(incidents.map((event) => event.type)).toEqual(expect.arrayContaining(['foul', 'penalty']))
    expect(incidents.find((event) => event.type === 'penalty')?.detail?.awardedSide).toBe('red')
  })

  it('always turns a real penalty into a staged kick even after the planned decision slots', () => {
    const session = {
      ...startFormalMatchSession(createFormalMatchSession({
        teamName: '法国',
        opponentName: '巴西',
      })),
      minute: 72,
      nextDecisionSlot: FORMAL_MATCH_DECISION_TARGET_MINUTES.length,
      usedScenarioIds: ['penalty_kick', 'match_penalty'],
    }
    const penalty = runtimeEvent('penalty', 72, {
      side: 'blue',
      sourceEventId: 'runtime.72.tackle-contact',
      detail: { awardedSide: 'red' },
    })
    const advanced = advanceFormalMatchSession(session, {
      snapshot: { minute: 72 },
      runtimeMoment: moment,
      actorSource,
      runtimeEvents: [penalty],
      deriveRuntimeIncidents: false,
    })

    // 点球优先通道在 penalty_kick / match_penalty 两个点球场景里随机取一个
    expect(['penalty_kick', 'match_penalty']).toContain(advanced.decisionPlan?.scenarioId)
    expect(advanced.decisionPlan).toEqual(expect.objectContaining({
      sourceEvent: penalty,
    }))
    expect(advanced.session.commentary.at(-1)).toEqual(expect.objectContaining({
      sourceEventId: 'runtime.72.tackle-contact',
      type: 'penalty',
      text: expect.stringContaining('比赛将进入点球处理'),
    }))
  })

  it('accumulates yellow cards and dismisses the actor on the second yellow', () => {
    const actorId = actorSource.actors.find((actor) => actor.side === 'blue' && !actor.isGoalkeeper).runtimeActorId
    const cards = [12, 37].map((minute) => runtimeEvent('card', minute, {
      sourceEventId: `runtime.${minute}.foul`,
      side: 'blue',
      primaryRuntimeActorId: actorId,
      detail: { color: 'yellow' },
    }))
    const advanced = advanceFormalMatchSession(startFormalMatchSession(createFormalMatchSession()), {
      snapshot: { minute: 37 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: cards,
    })
    expect(advanced.session.disciplineByRuntimeActorId[actorId]).toEqual({
      yellowCards: 2,
      redCard: true,
    })
    expect(advanced.session.stats.blue).toMatchObject({ yellowCards: 2, redCards: 1 })
    expect(advanced.session.commentary.at(-1).text).toContain('两黄变一红')
  })

  it('caps routine possession and contact narration while preserving event provenance', () => {
    const session = startFormalMatchSession(createFormalMatchSession())
    const runtimeEvents = Array.from({ length: 6 }, (_, index) => ({ minute: index * 20, index })).flatMap(({ minute, index }) => [
      runtimeEvent('possession-change', minute, { side: index % 2 ? 'blue' : 'red' }),
      runtimeEvent('tackle-contact', minute, { side: index % 2 ? 'red' : 'blue' }),
    ])
    const advanced = advanceFormalMatchSession(session, {
      snapshot: { minute: 90 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents,
    })
    const routineLines = advanced.session.commentary.filter((line) => (
      ['possession-change', 'tackle-contact'].includes(line.type)
    ))
    expect(routineLines).toHaveLength(FORMAL_MATCH_ROUTINE_COMMENTARY_BUDGET)
    expect(routineLines.every((line) => Boolean(line.sourceEventId))).toBe(true)
  })

  it('keeps a three-minute product duration and writes a complete final report', () => {
    const finished = finalizeFormalMatchSession(startFormalMatchSession(
      createFormalMatchSession({ realtimeMinutes: FORMAL_MATCH_REALTIME_MINUTES }),
    ), '2026-07-14T08:00:00.000Z')
    const report = buildFormalMatchSessionReport(finished)
    expect(report.durationRealtimeMinutes).toBe(3)
    expect(report.completedAt).toBe('2026-07-14T08:00:00.000Z')
    expect(report.commentary.at(-1)).toEqual(expect.objectContaining({
      minute: 90,
      type: 'full-time',
    }))
  })

  it('keeps the actual stoppage minute on the full-time commentary', () => {
    const session = startFormalMatchSession(createFormalMatchSession())
    const finished = finalizeFormalMatchSession({ ...session, minute: 94 })
    expect(finished.minute).toBe(94)
    expect(finished.commentary.at(-1)).toEqual(expect.objectContaining({
      minute: 94,
      type: 'full-time',
    }))
  })

  it('labels extra-time stoppage and the 105-minute interval explicitly', () => {
    const session = startFormalExtraTime(startFormalMatchSession(createFormalMatchSession()))
    const advanced = advanceFormalMatchSession(session, {
      snapshot: { minute: 106 },
      runtimeMoment: moment,
      actorSource,
      decisionsEnabled: false,
      runtimeEvents: [
        runtimeEvent('period-change', 105, {
          id: 'runtime.et.stoppage',
          detail: { period: 'stoppage-time', half: 3, addedMinutes: 1 },
        }),
        runtimeEvent('period-change', 106, {
          id: 'runtime.et.interval',
          detail: { period: 'half-time', extraTime: true, addedMinutes: 1 },
        }),
      ],
    })
    expect(advanced.session.commentary.at(-2).text).toBe('加时赛上半场补时 1 分钟。')
    expect(advanced.session.commentary.at(-1).text).toContain('加时赛上半场结束')
  })

  it('marks extra time with a dedicated flag instead of the shared phase field', () => {
    const running = startFormalMatchSession(createFormalMatchSession())
    const extra = startFormalExtraTime(running)
    expect(extra.extraTime).toBe(true)
    expect(extra.phase).toBe('live')
    expect(startFormalExtraTime(extra)).toBe(extra)
    const decided = settleFormalDecisionInSession({
      ...extra,
      status: 'decision',
      pendingDecisionId: 'decision.et.demo',
    }, {
      coachDecisionEvent: { sourceScenarioId: 'long_shot_opportunity' },
    }, {
      choice: { id: 'demo', label: 'demo' },
      result: { outcome: 'demo', isSuccess: true },
      resultText: 'demo',
    })
    // 决策结算会把 phase 重置为 live，但 extraTime 标志必须保留
    expect(decided.phase).toBe('live')
    expect(decided.extraTime).toBe(true)
  })

  it('forces the shootout-prep decision when extra time stays level past 115', () => {
    let session = startFormalExtraTime(startFormalMatchSession(createFormalMatchSession()))
    session = {
      ...session,
      minute: 116,
      nextDecisionSlot: FORMAL_MATCH_DECISION_TARGET_MINUTES.length,
    }
    const advanced = advanceFormalMatchSession(session, {
      snapshot: { minute: 116 },
      runtimeMoment: moment,
      actorSource,
      random: () => 0.5,
      runtimeEvents: [runtimeEvent('touch', 116)],
    })
    expect(advanced.decisionPlan?.scenarioId).toBe('extra_time_penalty_shootout_prep')
  })
})
