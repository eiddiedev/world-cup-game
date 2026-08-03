import { describe, expect, it } from 'vitest'
import { DECISION_LIBRARY } from '../data/decisionLibrary.js'
import {
  FORMAL_DECISION_MODE_COUNTS_V3,
  FORMAL_DECISION_SCENE_CATALOG_V3,
  validateFormalDecisionSceneCatalogV3,
} from './formalDecisionSceneCatalogV3.js'
import { buildFormalCoachDecision } from './formalCoachDecision.js'
import { buildHappySeedRuntimeActorConfig } from './happySeedRuntimeActors.js'
import { createDangerousFreeKickRuntimeMomentFixture } from './decisionSceneScriptV2.js'
import {
  buildFormalDecisionSceneScriptV3,
  isFormalDecisionMomentEligibleV3,
  validateDecisionSceneScriptV3,
} from './decisionSceneScriptV3.js'

function fixture() {
  const actorSource = buildHappySeedRuntimeActorConfig()
  const seed = buildFormalCoachDecision({
    actorSource,
    scenarioId: 'freekick_dangerous',
    minute: 44,
  })
  const runtimeMoment = {
    ...createDangerousFreeKickRuntimeMomentFixture(actorSource, seed),
    runtimeState: 'Match',
    ballOutOfPlay: false,
    ownerIsGoalkeeper: false,
    weather: 'clear',
  }
  return { actorSource, runtimeMoment }
}

const sourceEvent = {
  id: 'runtime.contact.1.foul',
  type: 'foul',
  sourceEventId: 'runtime.contact.1',
}

describe('DecisionSceneScriptV3', () => {
  const { actorSource, runtimeMoment } = fixture()

  it('locks the 53 scenes to 30/12/8/3 explicit director modes', () => {
    expect(validateFormalDecisionSceneCatalogV3()).toEqual({
      valid: true,
      scenarioCount: 53,
      outcomeCount: 171,
      modeCounts: FORMAL_DECISION_MODE_COUNTS_V3,
      errors: [],
    })
    expect(FORMAL_DECISION_MODE_COUNTS_V3).toEqual({
      'freeze-live': 30,
      'blackout-stage': 12,
      'freeze-incident': 8,
      'freeze-match-state': 3,
    })
  })

  it('builds every scenario and every authored outcome without a production fallback', () => {
    const outcomeIds = new Set()
    for (const scenario of DECISION_LIBRARY) {
      const decision = buildFormalCoachDecision({
        actorSource,
        scenarioId: scenario.id,
        minute: 44,
      })
      const script = buildFormalDecisionSceneScriptV3(
        decision,
        actorSource,
        runtimeMoment,
        sourceEvent,
      )
      if (script.mode === 'blackout-stage') {
        const taker = script.actors.setPieceTaker
        const stagedTaker = script.stagedActorPositions.find((entry) => (
          entry.runtimeActorId === taker.runtimeActorId
        ))
        expect(taker.side, `${scenario.id}/set-piece-side`)
          .toBe(FORMAL_DECISION_SCENE_CATALOG_V3[scenario.id].attackingSide || 'red')
        expect(stagedTaker, `${scenario.id}/set-piece-taker`).toBeTruthy()
        expect(Math.hypot(
          stagedTaker.normalized[0] - script.ball.normalized[0],
          stagedTaker.normalized[1] - script.ball.normalized[1],
        ), `${scenario.id}/set-piece-ball-anchor`).toBeLessThan(0.04)
      }
      expect(validateDecisionSceneScriptV3(script, decision), scenario.id).toEqual({
        valid: true,
        errors: [],
      })
      for (const choice of script.choices) {
        Object.keys(choice.outcomes).forEach((outcomeId) => outcomeIds.add(outcomeId))
        expect(Object.keys(choice.outcomes).length).toBeGreaterThan(0)
      }
    }
    expect(outcomeIds.size).toBe(171)
  })

  it('never relocates live actors and only stages set pieces under blackout', () => {
    const liveDecision = buildFormalCoachDecision({ actorSource, scenarioId: 'solo_run_penalty' })
    const live = buildFormalDecisionSceneScriptV3(liveDecision, actorSource, runtimeMoment, {
      id: 'runtime.touch.1', type: 'touch',
    })
    const stagedDecision = buildFormalCoachDecision({ actorSource, scenarioId: 'freekick_dangerous' })
    const staged = buildFormalDecisionSceneScriptV3(
      stagedDecision,
      actorSource,
      runtimeMoment,
      sourceEvent,
    )
    expect(live.stagedActorPositions).toEqual([])
    expect(live.transition.fadeOutMs).toBe(0)
    expect(staged.stagedActorPositions.length).toBeGreaterThan(0)
    expect(staged.transition).toMatchObject({ fadeOutMs: 120, fadeInMs: 180 })
  })

  it('keeps an opponent corner with the opponent taker while the coached side defends', () => {
    const decision = buildFormalCoachDecision({
      actorSource,
      scenarioId: 'aerial_duel_corner_defending',
      minute: 31,
    })
    const blueOwner = actorSource.actors.find((actor) => actor.side === 'blue' && !actor.isGoalkeeper)
    const script = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'blue',
      attackDirection: -1,
      ownerRuntimeActorId: blueOwner.runtimeActorId,
      ball: { normalized: [0.015, 0.035, 0] },
    }, { id: 'runtime.corner.blue', type: 'corner', side: 'blue' })
    const taker = script.actors.setPieceTaker
    const stagedTaker = script.stagedActorPositions.find((actor) => (
      actor.runtimeActorId === taker.runtimeActorId
    ))

    expect(taker.side).toBe('blue')
    expect(script.ball.sourceRuntimeActorId).toBe(taker.runtimeActorId)
    expect(stagedTaker.normalized[0]).toBeLessThan(0.04)
    expect(script.actors.primary.side).toBe('red')
    expect(script.stagedActorPositions.find((actor) => (
      actor.runtimeActorId === script.actors.primary.runtimeActorId
    ))?.normalized).not.toEqual(stagedTaker.normalized)
  })

  it('keeps both attacking and defending corners on the source event corner from staging through execution', () => {
    const blueOwner = actorSource.actors.find((actor) => actor.side === 'blue' && !actor.isGoalkeeper)
    const defendingDecision = buildFormalCoachDecision({
      actorSource,
      scenarioId: 'aerial_duel_corner_defending',
    })
    const defending = buildFormalDecisionSceneScriptV3(defendingDecision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'red',
      attackDirection: 1,
      ball: { normalized: [0.985, 0.035, 0] },
    }, { id: 'runtime.corner.blue.direction', type: 'corner', side: 'blue' })
    expect(defending.ball.normalized[0]).toBeLessThan(0.03)
    for (const choice of defending.choices) {
      const path = choice.affordances.find((item) => item.kind === 'ball-path').points
      expect(path[0]).toEqual(defending.ball.normalized)
      expect(path.at(-1)[0]).toBeLessThan(0.14)
      Object.values(choice.outcomes).filter((outcome) => outcome.path).forEach((outcome) => {
        expect((outcome.passPath || outcome.path)[0]).toEqual(defending.ball.normalized)
      })
    }

    const attackingDecision = buildFormalCoachDecision({ actorSource, scenarioId: 'header_corner' })
    const attacking = buildFormalDecisionSceneScriptV3(attackingDecision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'blue',
      attackDirection: -1,
      ownerRuntimeActorId: blueOwner.runtimeActorId,
      ball: { normalized: [0.015, 0.965, 0] },
    }, { id: 'runtime.corner.red.direction', type: 'corner', side: 'red' })
    expect(attacking.ball.normalized[0]).toBeGreaterThan(0.97)
    for (const choice of attacking.choices) {
      const path = choice.affordances.find((item) => item.kind === 'ball-path').points
      expect(path[0]).toEqual(attacking.ball.normalized)
      expect(path.at(-1)[0]).toBeGreaterThan(0.84)
    }
  })

  it('reuses the formal match penalty scene for a blue-side shootout kick', () => {
    const blueShooter = actorSource.actors.find((actor) => (
      actor.side === 'blue' && !actor.isGoalkeeper
    ))
    const decision = {
      ...buildFormalCoachDecision({
        actorSource,
        scenarioId: 'match_penalty',
        side: 'blue',
        teamId: 'brazil',
        opponentTeamId: 'france',
        preferredPlayerId: blueShooter.playerId,
      }),
      runtimeContext: 'shootout',
    }
    const script = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'blue',
      attackDirection: 1,
      ownerRuntimeActorId: blueShooter.runtimeActorId,
    }, { id: 'shootout.blue.penalty', type: 'penalty', side: 'red' })

    expect(script.scenarioId).toBe('match_penalty')
    expect(script.runtimeContext).toBe('shootout')
    expect(script.timeline).toEqual({ selectionFeedbackMs: 100, settledHoldMs: 180 })
    expect(script.actors.setPieceTaker.side).toBe('blue')
    expect(script.actors.homeGoalkeeper.side).toBe('red')
    expect(script.choices.map((choice) => choice.id)).toEqual([
      'penalty_left',
      'penalty_right',
      'penalty_center',
    ])
    for (const choice of script.choices) {
      expect(choice.ballSide).toBe('away')
      const liveOutcomes = Object.values(choice.outcomes).filter((outcome) => outcome.liveShot)
      expect(liveOutcomes.length).toBeGreaterThan(0)
      liveOutcomes.forEach((outcome) => {
        expect(outcome.liveShot.shooterRuntimeActorId).toBe(script.actors.setPieceTaker.runtimeActorId)
        expect(outcome.liveShot.keeperRuntimeActorId).toBe(script.actors.homeGoalkeeper.runtimeActorId)
      })
    }
    const panenka = script.choices.find((choice) => choice.id === 'penalty_center')
    expect(panenka.outcomes.goal_panenka.liveShot.power)
      .toBeGreaterThan(panenka.outcomes.saved_panenka.liveShot.power)
    const stagedKeeper = script.stagedActorPositions.find((entry) => (
      entry.runtimeActorId === script.actors.homeGoalkeeper.runtimeActorId
    ))
    expect(stagedKeeper.normalized[0]).toBeLessThan(0.985)
    expect(stagedKeeper.normalized[0]).toBeGreaterThan(0.96)
  })

  it('computes near post from the current ball and mirrors with attack direction', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'solo_run_penalty' })
    const right = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'red',
      ball: { normalized: [0.78, 0.34, 0] },
    }, { id: 'runtime.touch.red', type: 'touch' })
    const left = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'red',
      attackDirection: -1,
      ball: { normalized: [0.22, 0.66, 0] },
    }, { id: 'runtime.touch.blue', type: 'touch' })
    const rightPath = right.choices.find((choice) => choice.id === 'shoot_near_post').affordances[0].points
    const leftPath = left.choices.find((choice) => choice.id === 'shoot_near_post').affordances[0].points
    expect(rightPath[0]).toEqual([0.78, 0.34, 0])
    expect(rightPath.at(-1)[0]).toBeGreaterThan(0.98)
    expect(leftPath[0]).toEqual([0.22, 0.66, 0])
    expect(leftPath.at(-1)[0]).toBeLessThan(0.02)
  })

  it('keeps personnel and referee choices free from football paths', () => {
    for (const scenarioId of ['stamina_collapse_sub', 'var_goal_review', 'leading_protect']) {
      const decision = buildFormalCoachDecision({ actorSource, scenarioId })
      const script = buildFormalDecisionSceneScriptV3(
        decision,
        actorSource,
        runtimeMoment,
        sourceEvent,
      )
      for (const choice of script.choices) {
        expect(choice.affordances.some((item) => item.kind === 'ball-path')).toBe(false)
        Object.values(choice.outcomes).forEach((outcome) => expect(outcome.path).toBeNull())
      }
      expect(FORMAL_DECISION_SCENE_CATALOG_V3[scenarioId]).toBeTruthy()
    }
  })

  it('declares pass versus shot semantics instead of treating every ball path as a shot', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'freekick_dangerous' })
    const script = buildFormalDecisionSceneScriptV3(
      decision,
      actorSource,
      runtimeMoment,
      sourceEvent,
    )
    expect(Object.fromEntries(script.choices.map((choice) => [choice.id, choice.runtimeBallEventType])))
      .toEqual({
        direct_freekick: 'shot',
        freekick_cross: 'pass',
        short_freekick: 'pass',
      })
  })

  it('keeps a corner as a pass and emits the receiver shot only at the finishing cue', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'header_corner' })
    const script = buildFormalDecisionSceneScriptV3(
      decision,
      actorSource,
      runtimeMoment,
      { id: 'runtime.corner.pass-shot', type: 'corner', side: 'red' },
    )
    const nearPost = script.choices.find((choice) => choice.id === 'near_post_corner')
    const goal = nearPost.outcomes.goal_near_post
    expect(nearPost.runtimeBallEventType).toBe('pass')
    expect(goal.runtimeBallEventType).toBe('pass')
    expect(goal.secondaryRuntimeEvents).toEqual([
      expect.objectContaining({
        type: 'shot',
        role: 'support',
        runtimeActorId: script.actors.support.runtimeActorId,
      }),
    ])
    expect(goal.secondaryRuntimeEvents[0].atMs).toBeGreaterThan(0)
    expect(goal.secondaryRuntimeEvents[0].atMs).toBeLessThan(goal.durationMs)
  })

  it('never opens a penalty appeal outside the real penalty area', () => {
    for (const scenarioId of [
      'var_penalty_review',
      'defensive_line_handball_var',
      'handball_penalty_claim',
    ]) {
      const outside = {
        id: `runtime.${scenarioId}.outside`,
        type: 'handball-review',
        sourceEventId: 'runtime.shot.outside',
        detail: { inPenaltyArea: false },
      }
      const inside = {
        ...outside,
        id: `runtime.${scenarioId}.inside`,
        detail: { inPenaltyArea: true },
      }
      expect(isFormalDecisionMomentEligibleV3(scenarioId, runtimeMoment, outside)).toBe(false)
      expect(isFormalDecisionMomentEligibleV3(scenarioId, runtimeMoment, inside)).toBe(true)
    }
  })

  it('authors carrying choices as a running dribble instead of a static translation', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'long_shot_opportunity' })
    const script = buildFormalDecisionSceneScriptV3(
      decision,
      actorSource,
      runtimeMoment,
      { id: 'runtime.long-shot.touch', type: 'touch' },
    )
    const carry = script.choices.find((choice) => choice.id === 'control_advance')
    const modes = new Set()
    for (const outcome of Object.values(carry.outcomes)) {
      modes.add(outcome.executionMode)
      expect(['ball-carry', 'carry-then-shot']).toContain(outcome.executionMode)
      expect(outcome.carriesBall).toBe(true)
      expect(outcome.actorMotion?.runtimeActorId).toBe(outcome.sourceRuntimeActorId)
      expect(outcome.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({ role: 'primary', animation: 'dribble' }),
      ]))
      if (outcome.executionMode === 'carry-then-shot') {
        expect(outcome.carryPath).toHaveLength(4)
        expect(outcome.shotAtMs).toBeGreaterThan(0)
        expect(outcome.actions).toEqual(expect.arrayContaining([
          expect.objectContaining({ role: 'primary', animation: 'shoot' }),
        ]))
      }
    }
    expect(modes.has('carry-then-shot')).toBe(true)
  })

  it('executes each outcome from the selected semantic route instead of rebuilding a generic arc', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'freekick_dangerous' })
    const script = buildFormalDecisionSceneScriptV3(
      decision,
      actorSource,
      runtimeMoment,
      sourceEvent,
    )
    for (const choice of script.choices) {
      const preview = choice.affordances.find((item) => item.kind === 'ball-path')?.points
      if (!preview) continue
      for (const outcome of Object.values(choice.outcomes)) {
        const openingPath = outcome.passPath || outcome.path
        expect(openingPath?.[0]).toEqual(preview[0])
        expect(openingPath?.[1]).toEqual(preview[1])
      }
    }
  })

  it('hands completed ball actions to the actor at the outcome terminal', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'solo_run_penalty' })
    const script = buildFormalDecisionSceneScriptV3(
      decision,
      actorSource,
      runtimeMoment,
      { id: 'runtime.touch.2', type: 'touch' },
    )
    const pass = script.choices.find((choice) => choice.id === 'pass_to_teammate')
    expect(pass.outcomes.pass_intercepted.continuation).toMatchObject({
      type: 'actor-possession',
      role: 'blocker',
    })
    expect(pass.outcomes.goal_assist.continuation.type).toBe('loose-ball')
  })

  it('wins a clean tackle through real contact: run-in, fall and a loose ball', () => {
    const opponent = actorSource.actors.find((actor) => actor.side === 'blue' && !actor.isGoalkeeper)
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'penalty_area_foul_risk' })
    const script = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'blue',
      attackDirection: -1,
      ownerRuntimeActorId: opponent.runtimeActorId,
      ball: { normalized: [0.24, 0.52, 0] },
    }, { id: 'runtime.tackle.clean', type: 'touch' })
    const outcome = script.choices.find((choice) => choice.id === 'slide_tackle')
      .outcomes.tackle_success

    // 铲球者真实冲向持球人，接触瞬间对方倒地、球被铲松，随后球权交给铲球者
    expect(outcome.actorMotions).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'primary', carriesBall: false }),
    ]))
    expect(outcome.pathSegments).toHaveLength(2)
    expect(outcome.segmentEndTimes[0]).toBeLessThan(outcome.segmentEndTimes[1])
    expect(outcome.releaseBallAtMs).toBe(outcome.segmentEndTimes[0])
    expect(outcome.path).toEqual(outcome.pathSegments.at(-1))
    expect(outcome.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        atMs: outcome.segmentEndTimes[0],
        role: 'opponent',
        animation: 'fall_forward',
      }),
    ]))
    expect(outcome.continuation).toMatchObject({
      type: 'actor-possession',
      role: 'primary',
      runtimeActorId: script.actors.primary.runtimeActorId,
    })
  })

  it('moves only the football for every authored shooting choice', () => {
    for (const scenario of DECISION_LIBRARY) {
      const decision = buildFormalCoachDecision({ actorSource, scenarioId: scenario.id })
      const script = buildFormalDecisionSceneScriptV3(
        decision,
        actorSource,
        runtimeMoment,
        sourceEvent,
      )
      for (const choice of script.choices.filter((item) => (
        item.runtimeBallEventType === 'shot' && item.executionMode === 'ball-only-shot'
      ))) {
        expect(choice.executionMode, `${scenario.id}/${choice.id}`).toBe('ball-only-shot')
        Object.values(choice.outcomes).forEach((outcome) => {
          if (outcome.terminal !== 'hold') {
            expect(outcome.path?.length, `${scenario.id}/${choice.id}`).toBe(4)
          }
          expect(outcome.carriesBall, `${scenario.id}/${choice.id}`).toBe(false)
          expect(outcome.actorMotion?.runtimeActorId, `${scenario.id}/${choice.id}`)
            .not.toBe(outcome.sourceRuntimeActorId)
        })
      }
    }
  })

  it('never carries an actor into a goal or goalkeeper terminal', () => {
    const ballOnlyTerminals = new Set([
      'goal-for', 'goal-against', 'away-goalkeeper', 'home-goalkeeper',
    ])
    for (const scenario of DECISION_LIBRARY) {
      const decision = buildFormalCoachDecision({ actorSource, scenarioId: scenario.id })
      const script = buildFormalDecisionSceneScriptV3(
        decision,
        actorSource,
        runtimeMoment,
        sourceEvent,
      )
      for (const choice of script.choices) {
        Object.values(choice.outcomes).forEach((outcome) => {
          if (!ballOnlyTerminals.has(outcome.terminal) || !outcome.path) return
          expect([
            'ball-only-shot',
            'carry-then-shot',
            'pass-then-shot',
            'pass-sequence-then-shot',
          ], `${scenario.id}/${choice.id}`)
            .toContain(outcome.executionMode)
          expect(outcome.path?.length, `${scenario.id}/${choice.id}`).toBe(4)
          if (outcome.executionMode === 'ball-only-shot') {
            expect(outcome.carriesBall, `${scenario.id}/${choice.id}`).toBe(false)
            expect(outcome.actorMotion?.runtimeActorId, `${scenario.id}/${choice.id}`)
              .not.toBe(outcome.sourceRuntimeActorId)
          } else if (outcome.executionMode === 'carry-then-shot') {
            const actorEnd = outcome.actorMotion.points.at(-1)
            const ballEnd = outcome.path.at(-1)
            expect(Math.hypot(actorEnd[0] - ballEnd[0], actorEnd[1] - ballEnd[1]))
              .toBeGreaterThanOrEqual(0.04)
            expect(outcome.actions.some((action) => action.animation === 'shoot')).toBe(true)
            // 射门段必须从带球终点发出（或经过回传中间点），且射门动作落在带球者身上
            const carryEnd = outcome.carryPath.at(-1)
            if (outcome.pathSegments?.length) {
              // 底线回传射门：第一段从带球终点发出，段间连续
              expect(Math.hypot(outcome.pathSegments[0][0][0] - carryEnd[0], outcome.pathSegments[0][0][1] - carryEnd[1]),
                `${scenario.id}/${choice.id}`)
                .toBeLessThan(1e-6)
              expect(outcome.pathSegments.at(-1)).toEqual(outcome.path)
              for (let si = 1; si < outcome.pathSegments.length; si += 1) {
                expect(outcome.pathSegments[si - 1].at(-1), `${scenario.id}/${choice.id}/seg-join`)
                  .toEqual(outcome.pathSegments[si][0])
              }
            } else {
              expect(Math.hypot(outcome.path[0][0] - carryEnd[0], outcome.path[0][1] - carryEnd[1]),
                `${scenario.id}/${choice.id}`)
                .toBeLessThan(1e-6)
            }
            const carrierRole = outcome.actorMotions.find((motion) => motion.carriesBall)?.role
            expect(outcome.actions.some((action) => (
              action.animation === 'shoot' && action.role === carrierRole
            )), `${scenario.id}/${choice.id}`)
              .toBe(true)
          } else {
            expect(outcome.passPath?.length, `${scenario.id}/${choice.id}`).toBe(4)
            expect(outcome.pathSegments?.at(-1), `${scenario.id}/${choice.id}`)
              .toEqual(outcome.path)
            for (let index = 1; index < outcome.pathSegments.length; index += 1) {
              expect(outcome.pathSegments[index - 1].at(-1), `${scenario.id}/${choice.id}`)
                .toEqual(outcome.pathSegments[index][0])
            }
            expect(outcome.runtimeBallEventType, `${scenario.id}/${choice.id}`).toBe('pass')
            expect(outcome.secondaryRuntimeEvents.some((event) => event.type === 'shot'))
              .toBe(true)
          }
        })
      }
    }
  })

  it('executes the 3v2 wide choice as switch, cross and finish instead of a midfield shot', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'counter_attack_3v2' })
    const script = buildFormalDecisionSceneScriptV3(
      decision,
      actorSource,
      runtimeMoment,
      sourceEvent,
    )
    const choice = script.choices.find((item) => item.id === 'wide_spread')
    const goalOutcome = Object.values(choice.outcomes)
      .find((outcome) => outcome.terminal === 'goal-for')

    expect(choice.affordances.filter((item) => item.kind === 'ball-path')).toHaveLength(2)
    expect(goalOutcome.executionMode).toBe('pass-sequence-then-shot')
    expect(goalOutcome.pathSegments).toHaveLength(3)
    expect(goalOutcome.runtimeBallEventType).toBe('pass')
    expect(goalOutcome.secondaryRuntimeEvents.map((event) => event.type))
      .toEqual(['pass', 'shot'])
    expect(goalOutcome.initialSourceRuntimeActorId).toBe(script.actors.primary.runtimeActorId)
    expect(goalOutcome.sourceRuntimeActorId).toBe(script.actors.aerialTarget.runtimeActorId)
    expect(goalOutcome.sourceRuntimeActorId).not.toBe(goalOutcome.initialSourceRuntimeActorId)
    expect(goalOutcome.pathSegments[0][0]).toEqual(script.ball.normalized)
    expect(goalOutcome.pathSegments[0].at(-1)).toEqual(goalOutcome.pathSegments[1][0])
    expect(goalOutcome.pathSegments[1].at(-1)).toEqual(goalOutcome.pathSegments[2][0])
    const finishEnd = goalOutcome.pathSegments[2].at(-1)
    expect(finishEnd[0]).toBe(script.fieldAnchors.homeAttackGoal[0])
    expect(finishEnd[1]).toBeGreaterThanOrEqual(0.4353)
    expect(finishEnd[1]).toBeLessThanOrEqual(0.5647)
  })

  it('keeps every role action inside its authored semantic range', () => {
    for (const scenario of DECISION_LIBRARY) {
      const decision = buildFormalCoachDecision({ actorSource, scenarioId: scenario.id })
      const script = buildFormalDecisionSceneScriptV3(
        decision,
        actorSource,
        runtimeMoment,
        sourceEvent,
      )
      for (const choice of script.choices) {
        for (const lane of choice.affordances.filter((item) => (
          item.kind === 'run-lane'
          && item.carriesBall
          && script.actors[item.role]?.side === 'red'
        ))) {
          const start = lane.points[0]
          const end = lane.points.at(-1)
          expect(
            Math.abs(end[0] - start[0]),
            `${scenario.id}/${choice.id}/${lane.role}/run-distance`,
          ).toBeLessThanOrEqual(0.185)
        }
        for (const outcome of Object.values(choice.outcomes)) {
          if (script.runtimeMoment.eligibleForTrigger === false) continue
          if (!['pass-then-shot', 'pass-sequence-then-shot'].includes(outcome.executionMode)) continue
          const goal = outcome.terminal === 'goal-for'
            ? script.fieldAnchors.homeAttackGoal
            : script.fieldAnchors.homeDefendGoal
          const limit = scenario.id === 'late_keeper_up_corner'
            && choice.id === 'send_keeper_up' ? 1 : 0.42
          expect(
            Math.abs(outcome.path[0][0] - goal[0]),
            `${scenario.id}/${choice.id}/${outcome.terminal}/shot-origin`,
          ).toBeLessThanOrEqual(limit)
        }
      }
    }
  })

  it('does not offer a 3v2 counter in the home defensive half', () => {
    const event = { id: 'runtime.counter.touch', type: 'touch' }
    expect(isFormalDecisionMomentEligibleV3('counter_attack_3v2', {
      ...runtimeMoment,
      attackingSide: 'red',
      attackDirection: 1,
      ball: { normalized: [0.35, 0.5, 0] },
    }, event)).toBe(false)
    expect(isFormalDecisionMomentEligibleV3('counter_attack_3v2', {
      ...runtimeMoment,
      attackingSide: 'red',
      attackDirection: 1,
      ball: { normalized: [0.52, 0.5, 0] },
    }, event)).toBe(true)
  })

  it('forces the opponent toward the corner with two actor motions and a real blue corner restart', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'last_defender_tackle' })
    const script = buildFormalDecisionSceneScriptV3(
      decision,
      actorSource,
      runtimeMoment,
      sourceEvent,
    )
    const choice = script.choices.find((item) => item.id === 'jockey_to_corner')
    const outcome = choice.outcomes.forced_corner

    expect(choice.affordances.some((item) => item.kind === 'ball-path')).toBe(false)
    expect(outcome.runtimeBallEventType).toBeNull()
    expect(outcome.executionMode).toBe('ball-carry')
    expect(outcome.actorMotions).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'primary', carriesBall: false }),
      expect.objectContaining({ role: 'opponent', carriesBall: true }),
    ]))
    expect(outcome.runtimeEffect).toBe('queue-corner-blue')
    expect(outcome.path.at(-1)[0]).toBeLessThanOrEqual(0.02)
    expect(Math.min(outcome.path.at(-1)[1], 1 - outcome.path.at(-1)[1]))
      .toBeLessThanOrEqual(0.03)
  })

  it('audits all 53 scripts for explicit actor side, absolute goals and truthful hold outcomes', () => {
    for (const scenario of DECISION_LIBRARY) {
      const decision = buildFormalCoachDecision({ actorSource, scenarioId: scenario.id })
      const script = buildFormalDecisionSceneScriptV3(
        decision,
        actorSource,
        runtimeMoment,
        sourceEvent,
      )
      for (const choice of script.choices) {
        for (const affordance of choice.affordances) {
          if (affordance.kind === 'ball-path') {
            if (affordance.startRole && script.actors[affordance.startRole]) {
              const startId = script.actors[affordance.startRole].runtimeActorId
              const stagedPos = (script.stagedActorPositions || [])
                .find((p) => p.runtimeActorId === startId)
              const livePos = (script.actorPositions || [])
                .find((p) => p.runtimeActorId === startId)
              const expectedXY = stagedPos?.normalized || livePos?.normalized
              if (expectedXY) {
                expect(affordance.points[0][0], `${scenario.id}/${choice.id}/startRole-x`)
                  .toBeCloseTo(expectedXY[0], 2)
                expect(affordance.points[0][1], `${scenario.id}/${choice.id}/startRole-y`)
                  .toBeCloseTo(expectedXY[1], 2)
              }
            } else {
              expect(affordance.points[0], `${scenario.id}/${choice.id}`).toEqual(script.ball.normalized)
            }
            expect(script.actors[affordance.role].side, `${scenario.id}/${choice.id}/${affordance.role}`)
              .toBe(affordance.side === 'home' ? 'red' : 'blue')
          }
          if (affordance.kind === 'run-lane') {
            expect(script.actors[affordance.role], `${scenario.id}/${choice.id}/${affordance.role}`).toBeTruthy()
          }
        }
        for (const outcome of Object.values(choice.outcomes)) {
          const end = outcome.path?.at(-1)
          if (outcome.terminal === 'goal-for' && end) {
            expect(end[0], `${scenario.id}/${choice.id}/goal-for`).toBe(script.fieldAnchors.homeAttackGoal[0])
            expect(end[1], `${scenario.id}/${choice.id}/goal-for`).toBeGreaterThanOrEqual(0.4353)
            expect(end[1], `${scenario.id}/${choice.id}/goal-for`).toBeLessThanOrEqual(0.5647)
            expect(outcome.scoringSide, `${scenario.id}/${choice.id}/goal-for-side`).toBe('red')
          }
          if (outcome.terminal === 'goal-against' && end) {
            expect(end[0], `${scenario.id}/${choice.id}/goal-against`).toBe(script.fieldAnchors.homeDefendGoal[0])
            expect(end[1], `${scenario.id}/${choice.id}/goal-against`).toBeGreaterThanOrEqual(0.4353)
            expect(end[1], `${scenario.id}/${choice.id}/goal-against`).toBeLessThanOrEqual(0.5647)
            expect(outcome.scoringSide, `${scenario.id}/${choice.id}/goal-against-side`).toBe('blue')
          }
          if (outcome.terminal === 'home-goalkeeper') {
            expect(outcome.continuation.role, `${scenario.id}/${choice.id}/home-gk`).toBe('homeGoalkeeper')
          }
          if (outcome.terminal === 'away-goalkeeper') {
            expect(outcome.continuation.role, `${scenario.id}/${choice.id}/away-gk`).toBe('awayGoalkeeper')
          }
          if (outcome.terminal === 'hold' && choice.runtimeBallEventType === 'shot') {
            expect(outcome.path, `${scenario.id}/${choice.id}/unrealized-shot`).toBeNull()
            expect(outcome.actions.some((action) => action.animation === 'shoot')).toBe(false)
          }
          // 语义检测：动作名必须在 spine 动画表内（pass 不存在会导致出球者全程无动作）
          for (const action of outcome.actions || []) {
            expect(action.animation, `${scenario.id}/${choice.id}/${action.animation}`)
              .toMatch(/^(shoot|slide|dribble|sprint|idle|waving|jump|hands_in_front|throw|run|fall_forward)$/)
          }
          // 语义检测：有对抗接触事件的结局，铲球者必须有冲向持球人的跑动
          for (const runtimeEvent of outcome.secondaryRuntimeEvents || []) {
            if (runtimeEvent.type !== 'tackle-contact') continue
            expect(
              outcome.actorMotions.some((motion) => motion.role === runtimeEvent.role),
              `${scenario.id}/${choice.id}/${outcome.terminal}/tackle-motion`,
            ).toBe(true)
          }
          // 语义检测：球速合理（射门 ≥0.10 归一化/秒，传球 ≥0.06），不允许远射慢速平移
          if (end && outcome.runtimeBallEventType && outcome.durationMs) {
            const finalSegment = outcome.pathSegments?.length
              ? outcome.pathSegments.at(-1)
              : outcome.path
            const flightMs = outcome.shotAtMs
              ? outcome.durationMs - outcome.shotAtMs
              : outcome.durationMs
            const flight = Math.hypot(
              finalSegment.at(-1)[0] - finalSegment[0][0],
              finalSegment.at(-1)[1] - finalSegment[0][1],
            )
            if (flight > 0.04 && flightMs > 0) {
              const speed = flight / (flightMs / 1000)
              const floor = outcome.runtimeBallEventType === 'shot'
                || ['goal-for', 'goal-against'].includes(outcome.terminal) ? 0.1 : 0.06
              expect(speed, `${scenario.id}/${choice.id}/${outcome.terminal}/ball-speed`).toBeGreaterThanOrEqual(floor)
            }
          }
        }
      }
    }
  })

  it('mirrors live geometry after teams change ends', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'solo_run_penalty' })
    const script = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'red',
      attackDirection: -1,
      ball: { normalized: [0.24, 0.42, 0] },
    }, { id: 'runtime.touch.second-half', type: 'touch' })
    const shot = script.choices.find((choice) => choice.id === 'shoot_near_post')
    expect(shot.affordances[0].points.at(-1)[0]).toBeLessThan(0.02)
  })

  it('rejects sweeper decisions in the opponent own box and requires a real goalkeeper approach', () => {
    const homeGoalkeeper = actorSource.actors.find((actor) => actor.side === 'red' && actor.isGoalkeeper)
    const withGoalkeeper = (ball, goalkeeper) => ({
      ...runtimeMoment,
      attackingSide: 'blue',
      attackDirection: -1,
      homeGoalkeeperRuntimeActorId: homeGoalkeeper.runtimeActorId,
      ball: { normalized: ball },
      actorPositions: runtimeMoment.actorPositions.map((entry) => (
        entry.runtimeActorId === homeGoalkeeper.runtimeActorId
          ? { ...entry, normalized: goalkeeper }
          : entry
      )),
    })
    const event = { id: 'runtime.pass.sweeper', type: 'pass' }
    expect(isFormalDecisionMomentEligibleV3(
      'keeper_sweeper_claim',
      withGoalkeeper([0.84, 0.5, 0], [0.12, 0.5]),
      event,
    )).toBe(false)
    expect(isFormalDecisionMomentEligibleV3(
      'keeper_sweeper_claim',
      withGoalkeeper([0.25, 0.5, 0], [0.12, 0.5]),
      event,
    )).toBe(true)
    expect(isFormalDecisionMomentEligibleV3(
      'keeper_sweeper_claim',
      withGoalkeeper([0.25, 0.5, 0], [0.04, 0.5]),
      event,
    )).toBe(false)
  })

  it('authors the one-on-one goalkeeper choice as an opponent shot plus a visible save', () => {
    const opponent = actorSource.actors.find((actor) => actor.side === 'blue' && !actor.isGoalkeeper)
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'gk_one_on_one' })
    const script = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'blue',
      attackDirection: -1,
      ownerRuntimeActorId: opponent.runtimeActorId,
      ball: { normalized: [0.22, 0.5, 0] },
    }, { id: 'runtime.gk-one-on-one', type: 'touch' })
    const hold = script.choices.find((choice) => choice.id === 'gk_hold_line')
    const save = hold.outcomes.gk_reaction_save
    expect(hold.affordances).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'zone', intent: 'keeper-line' }),
      expect.objectContaining({ kind: 'ball-path', role: 'opponent', runtimeEventType: 'shot' }),
    ]))
    expect(save.path).toHaveLength(4)
    expect(save.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'opponent', animation: 'shoot' }),
      expect.objectContaining({ role: 'homeGoalkeeper', animation: 'jump' }),
      expect.objectContaining({ role: 'homeGoalkeeper', animation: 'hands_in_front' }),
    ]))
    expect(save.commentaryText).toContain('做出扑救并控制住皮球')
  })

  it('makes a rushing goalkeeper and the football meet at one claim point before reporting control', () => {
    const opponent = actorSource.actors.find((actor) => actor.side === 'blue' && !actor.isGoalkeeper)
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'gk_one_on_one' })
    const script = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'blue',
      attackDirection: -1,
      ownerRuntimeActorId: opponent.runtimeActorId,
      ball: { normalized: [0.24, 0.52, 0] },
    }, { id: 'runtime.gk-rush.claim', type: 'touch' })
    const rush = script.choices.find((choice) => choice.id === 'gk_rush_out')
    const run = rush.affordances.find((item) => item.kind === 'run-lane')
    for (const outcomeId of ['gk_save_rush', 'gk_claim_ball']) {
      const outcome = rush.outcomes[outcomeId]
      expect(outcome.path.at(-1)).toEqual(run.points.at(-1))
      expect(outcome.continuation).toMatchObject({
        type: 'actor-possession',
        role: 'homeGoalkeeper',
        runtimeActorId: script.actors.homeGoalkeeper.runtimeActorId,
      })
      expect(outcome.commentaryText).toContain('控制住皮球')
    }
    expect(rush.outcomes.goal_chip_over.path.at(-1)).toEqual(script.fieldAnchors.homeDefendGoal)
  })

  it('keeps the solo breakaway readable: ball at the foot, far-post finish and square pass', () => {
    const owner = actorSource.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'solo_run_penalty' })
    const origin = [0.78, 0.31, 0]
    const script = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'red',
      attackDirection: 1,
      ownerRuntimeActorId: owner.runtimeActorId,
      ball: { normalized: origin },
    }, { id: 'runtime.solo-readable', type: 'touch' })
    const farPost = script.choices.find((choice) => choice.id === 'far_post_shot')
    const squarePass = script.choices.find((choice) => choice.id === 'pass_to_teammate')
    const passPath = squarePass.affordances.find((item) => item.kind === 'ball-path').points

    expect(script.ball.displayNormalized[0]).toBeGreaterThan(origin[0])
    expect(script.ball.displayNormalized[0] - origin[0]).toBeLessThan(0.02)
    expect(farPost.affordances[0]).toMatchObject({ intent: 'shoot-far-post' })
    expect(farPost.affordances[0].points.at(-1)[1]).toBeGreaterThan(0.5)
    expect(passPath.at(-1)[0]).toBeGreaterThanOrEqual(origin[0])
    expect(Math.abs(passPath.at(-1)[1] - origin[1])).toBeGreaterThan(0.12)
  })

  it('executes 3v2 carry as dribble then far-post shot instead of an instant keeper pass', () => {
    const owner = actorSource.actors.find((actor) => actor.side === 'red' && !actor.isGoalkeeper)
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'counter_attack_3v2' })
    const script = buildFormalDecisionSceneScriptV3(decision, actorSource, {
      ...runtimeMoment,
      attackingSide: 'red',
      attackDirection: 1,
      ownerRuntimeActorId: owner.runtimeActorId,
      ball: { normalized: [0.55, 0.38, 0] },
    }, { id: 'runtime.counter-3v2', type: 'touch' })
    const carry = script.choices.find((choice) => choice.id === 'sprint_shoot')
    const saved = carry.outcomes.saved_rush

    expect(carry.executionMode).toBe('carry-then-shot')
    expect(saved.executionMode).toBe('carry-then-shot')
    expect(saved.carryPath).toHaveLength(4)
    expect(saved.path[0]).toEqual(saved.carryPath.at(-1))
    expect(saved.path.at(-1)[1]).not.toBe(0.5)
    expect(saved.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ atMs: 0, animation: 'dribble' }),
      expect.objectContaining({ atMs: saved.shotAtMs, animation: 'shoot' }),
    ]))
  })

  it('aims half-space goalkeeper claims at the opponent goalkeeper', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'half_space_through_run' })
    const script = buildFormalDecisionSceneScriptV3(
      decision,
      actorSource,
      runtimeMoment,
      { id: 'runtime.half-space', type: 'touch' },
    )
    const claim = script.choices.find((choice) => choice.id === 'thread_half_space').outcomes.gk_claim
    expect(claim.terminal).toBe('away-goalkeeper')
    expect(claim.continuation).toMatchObject({
      role: 'awayGoalkeeper',
      runtimeActorId: script.actors.awayGoalkeeper.runtimeActorId,
    })
    expect(claim.path.at(-1)).toEqual(
      script.actorPositions.find((entry) => (
        entry.runtimeActorId === script.actors.awayGoalkeeper.runtimeActorId
      )).normalized.concat(0).slice(0, 3),
    )
  })

  it('presses the football, switches to the far side and anchors the handball marker at the incident', () => {
    const origin = [0.51, 0.2, 0]
    const moment = { ...runtimeMoment, ball: { normalized: origin } }
    const build = (scenarioId, event = { id: `runtime.${scenarioId}`, type: 'touch' }) => (
      buildFormalDecisionSceneScriptV3(
        buildFormalCoachDecision({ actorSource, scenarioId }),
        actorSource,
        moment,
        event,
      )
    )
    const press = build('high_press_trap')
    const pressRun = press.choices.find((choice) => choice.id === 'press_trap_sideline')
      .affordances.find((item) => item.kind === 'run-lane')
    expect(pressRun.points.at(-1)).toEqual(origin)

    const switched = build('midfield_switch_play')
    const switchPath = switched.choices.find((choice) => choice.id === 'switch_far_side')
      .affordances.find((item) => item.kind === 'ball-path').points
    expect(Math.abs(switchPath.at(-1)[1] - origin[1])).toBeGreaterThan(0.35)
    expect(Math.hypot(
      switchPath.at(-1)[0] - origin[0],
      switchPath.at(-1)[1] - origin[1],
    )).toBeGreaterThan(0.35)

    const handball = build('handball_penalty_claim', {
      id: 'runtime.handball.inside',
      type: 'handball-review',
      detail: { inPenaltyArea: true },
    })
    handball.choices.forEach((choice) => {
      expect(choice.affordances[0].center).toEqual(origin)
    })
  })

  it('shows the through ball crossing the real defensive line before offside settles', () => {
    const decision = buildFormalCoachDecision({ actorSource, scenarioId: 'offside_trap' })
    const script = buildFormalDecisionSceneScriptV3(
      decision,
      actorSource,
      runtimeMoment,
      { id: 'runtime.offside-pass', type: 'pass' },
    )
    const trap = script.choices.find((choice) => choice.id === 'offside_trap_spring')
    const line = trap.affordances.find((item) => item.kind === 'formation')
    const pass = trap.affordances.find((item) => item.kind === 'ball-path')
    const runner = trap.affordances.find((item) => item.kind === 'run-lane')
    const outcome = trap.outcomes.offside_success
    const positionById = new Map(script.actorPositions.map((entry) => [entry.runtimeActorId, entry.normalized]))
    const defenderXs = actorSource.actors
      .filter((actor) => actor.side === 'red' && !actor.isGoalkeeper)
      .map((actor) => positionById.get(actor.runtimeActorId)?.[0])
      .filter(Number.isFinite)
      .sort((left, right) => left - right)
    const expectedLineX = Math.min(1, defenderXs[1] + 0.035)

    expect(line.points[0][0]).toBeCloseTo(expectedLineX, 6)
    expect(line.points[1][0]).toBeCloseTo(expectedLineX, 6)
    expect(runner.points.at(-1)[0]).toBeLessThan(line.points[0][0])
    expect(pass.runtimeEventType).toBe('pass')
    expect(outcome.path.at(-1)).toEqual(runner.points.at(-1))
    expect(outcome.releaseBallAtMs).toBe(0)
    expect(outcome.durationMs).toBeGreaterThan(700)
  })

  it('caps direct free-kick conversion well below a one-on-one chance', () => {
    const freeKick = DECISION_LIBRARY.find((scenario) => scenario.id === 'freekick_dangerous')
      .choices.find((choice) => choice.id === 'direct_freekick')
    const solo = DECISION_LIBRARY.find((scenario) => scenario.id === 'solo_run_penalty')
      .choices.find((choice) => choice.id === 'shoot_near_post')
    expect(freeKick.goal_conversion).toBe(0.12)
    expect(freeKick.goal_conversion).toBeLessThan(solo.goal_conversion / 4)
    expect(freeKick.conversion_miss_outcome).toBe('hit_wall')
  })
})
