import { readFileSync } from 'node:fs'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(import.meta.dirname, '../..')
const standaloneRuntime = readFileSync(
  path.join(projectRoot, 'public/match-runtime-min/standalone-match.js'),
  'utf8',
)
const decisionDirector = readFileSync(
  path.join(projectRoot, 'public/match-runtime-min/happyseed/runtime-v3.js'),
  'utf8',
)
const runtimeStadium = readFileSync(
  path.join(projectRoot, 'public/match-runtime-min/happyseed/runtime-v2.js'),
  'utf8',
)
const runtimeService = readFileSync(
  path.join(projectRoot, 'src/services/happySeedMatchRuntime.js'),
  'utf8',
)
const matchBroadcast = readFileSync(
  path.join(projectRoot, 'src/components/HappySeedMatchBroadcast.jsx'),
  'utf8',
)

describe('Match Runtime integration contracts', () => {
  it('extends both halves with data-driven stoppage time outside the third-party core', () => {
    expect(standaloneRuntime).toContain('window.__happySeedSetStoppageMinutes')
    expect(standaloneRuntime).toContain('window.__happySeedGetStoppageSnapshot')
    expect(standaloneRuntime).toContain('period: "stoppage-time"')
    expect(standaloneRuntime).toContain('if (half === 1 || half === 3) pitch.endHalf()')
    expect(standaloneRuntime).toContain('else pitch.endMatch()')
    expect(standaloneRuntime).toContain('regularHalfSeconds + realSecondsPerMatchMinute * maximumAddedMinutes')
  })
  it('supports extra time as two 15-minute segments with preserved scores', () => {
    expect(standaloneRuntime).toContain('window.__happySeedStartExtraTime')
    expect(standaloneRuntime).toContain('extraHalfSeconds: regularHalfSeconds / 3')
    expect(standaloneRuntime).toContain('clock.extraTime ? engine + 2 : engine')
    expect(standaloneRuntime).toContain('pitch.redTeam.score = redScore')
    expect(standaloneRuntime).toContain('pitch.blueTeam.score = blueScore')
  })
  it('clamps goalkeeper-controlled balls on both sides of the native physics step', () => {
    expect(standaloneRuntime).toContain('function enforceGoalkeeperControlledBallSafety(game)')
    expect(standaloneRuntime).toMatch(
      /enforceGoalkeeperControlledBallSafety\(mode\.game\);\s*pitch\.update\(elapsed\);\s*enforceGoalkeeperControlledBallSafety\(mode\.game\);/,
    )
    expect(standaloneRuntime).toContain('pitch.prevStepBallPosition.x = ball.position.x')
  })

  it('confirms goalkeeper saves only after control or a safe parry endpoint', () => {
    expect(standaloneRuntime).toContain('game.pitch.ball.inHands.team')
    expect(standaloneRuntime).toContain('"signal:player.Player.onBallHold"')
    expect(standaloneRuntime).toContain('"signal:player.Player.onHitByBall"')
    expect(standaloneRuntime).toContain('function recordGoalkeeperParryCandidate(game, goalkeeper, saveKind)')
    expect(standaloneRuntime).toContain('function maybeFinalizeGoalkeeperParryCandidate(game, owner)')
    expect(standaloneRuntime).toMatch(
      /"signal:player\.Player\.onHitByBall"[\s\S]*recordGoalkeeperParryCandidate\(game, goalkeeper, "parried"\)/,
    )
    expect(standaloneRuntime).not.toMatch(
      /"signal:player\.Player\.onHitByBall"[\s\S]{0,120}emitGoalkeeperSaveEvent/,
    )
    expect(standaloneRuntime).toContain('keeperTouchCandidate = takeGoalkeeperParryCandidate(game, goalShotEventId)')
    expect(standaloneRuntime).toContain('keeperTouch: !!keeperTouchCandidate')
    expect(standaloneRuntime).toContain('game.__happySeedLastSaveShotEventId')
    expect(standaloneRuntime).toContain('sourceEventId: shotEventId')
    expect(decisionDirector).toMatch(
      /entry\.actor\.isGoalkeeper[\s\S]*__happySeedEmitRuntimeEvent\([\s\S]*"save"[\s\S]*sourceEventId: active\.runtimeBallEventId/,
    )
  })

  it('sorts the aggregate pixel net at its deforming front edge', () => {
    expect(runtimeStadium).toContain('pixelDynamicNetDepthMode: "aggregate-front-edge"')
    expect(runtimeStadium).toContain('function refreshAggregateNetDepth()')
    expect(runtimeStadium).toContain('frontWorldY * Generic.PIXELS_Y')
    expect(runtimeStadium).toMatch(
      /previousFrame\(frame\);[\s\S]*pixelNetDepthUpdaters\[depthIndex\]\(\)/,
    )
  })

  it('keeps the continuous pixel net readable from the normal match camera', () => {
    expect(runtimeStadium).toMatch(
      /net\.sidePoints,[\s\S]*net\.divideY,\s*1,\s*3/,
    )
    expect(runtimeStadium).toMatch(
      /net\.topPoints,[\s\S]*net\.topDivideY,\s*1,\s*2/,
    )
  })

  it('exposes a native tactical stance hook that shifts formation anchors', () => {
    expect(standaloneRuntime).toContain('window.__happySeedSetTacticalStance')
    expect(standaloneRuntime).toContain('window.__happySeedGetTacticalStance')
    expect(standaloneRuntime).toContain('team._happySeedBaseHomes')
    expect(standaloneRuntime).toMatch(/team\.ai = preset\.ai/)
    expect(standaloneRuntime).toMatch(/playerStates\.ReturnHome/)
  })

  it('physically removes a red-carded actor from the native match', () => {
    expect(standaloneRuntime).toContain('function removePhysicalActor(entry)')
    expect(standaloneRuntime).toContain('function hideRetiredActorVisual(entry)')
    expect(standaloneRuntime).toContain('renderer.renderable = !1')
    expect(standaloneRuntime).toContain('entry.actor._runtimeRemoved = !0')
    expect(standaloneRuntime).toMatch(
      /entry\.actor\._runtimeRemoved = !0;[\s\S]*hideRetiredActorVisual\(entry\);[\s\S]*game\.removePlayer\(entity\)/,
    )
    expect(standaloneRuntime).toMatch(
      /finally \{[\s\S]*hideRetiredActorVisual\(entry\);[\s\S]*\}/,
    )
    expect(standaloneRuntime).toMatch(
      /previousActorFrame\(frame\)[\s\S]*entry\.actor\._runtimeRemoved && hideRetiredActorVisual\(entry\)/,
    )
    expect(standaloneRuntime).toContain('enforceRetiredVisuals: function ()')
    expect(standaloneRuntime).toMatch(
      /patch\.redCard === !0[\s\S]*state\.onPitch = !1[\s\S]*removePhysicalActor\(entry\)/,
    )
    expect(standaloneRuntime).toMatch(
      /state\.yellowCards >= 2[\s\S]*state\.redCard = !0[\s\S]*removePhysicalActor\(entry\)/,
    )
  })

  it('keeps a dismissed actor visually sealed even when native removal throws or visuals reopen', () => {
    const helpersStart = standaloneRuntime.indexOf('function hideRetiredActorVisual(entry)')
    const helpersEnd = standaloneRuntime.indexOf('window.__happySeedRuntimeActors = {', helpersStart)
    const helperSource = standaloneRuntime.slice(helpersStart, helpersEnd)
    const entity = { static: false, hasBall: true }
    const renderer = {
      visible: true,
      renderable: true,
      alpha: 1,
      sprite: { visible: true },
      spine: {
        visible: true,
        sprites: {
          eyes: { visible: true },
          head: { visible: true },
        },
      },
    }
    const entry = {
      actor: { _runtimeRemoved: false },
      entity,
      renderer,
      label: { visible: true, renderable: true },
      eventRing: { visible: true, renderable: true },
    }
    entity.team = {
      players: [entity],
      removePlayer() { throw new Error('already removed from team') },
    }
    const context = {
      console: { error() {} },
      pitch: { ball: { owner: entity, inHands: entity } },
      window: {
        __matchGame: {
          removePlayer() { throw new Error('Player not found') },
        },
      },
    }
    runInNewContext(`${helperSource}; retirementApi = { removePhysicalActor };`, context)

    context.retirementApi.removePhysicalActor(entry)

    expect(entry.actor._runtimeRemoved).toBe(true)
    expect(entity).toMatchObject({ static: true, hasBall: false })
    expect(context.pitch.ball).toMatchObject({ owner: null, inHands: null })
    expect(renderer).toMatchObject({ visible: false, renderable: false, alpha: 0 })
    expect(renderer.spine.visible).toBe(false)
    expect(Object.values(renderer.spine.sprites).every((slot) => slot.visible === false)).toBe(true)
    expect(entry.label).toMatchObject({ visible: false, renderable: false })
    expect(entry.eventRing).toMatchObject({ visible: false, renderable: false })

    renderer.visible = true
    renderer.spine.sprites.eyes.visible = true
    context.retirementApi.removePhysicalActor(entry)
    expect(renderer.visible).toBe(false)
    expect(renderer.spine.sprites.eyes.visible).toBe(false)
  })

  it('returns temporary manual camera movement to continuous ball follow', () => {
    expect(runtimeStadium).toContain('manualReturnDelayMs: 2600')
    expect(runtimeStadium).toMatch(
      /window\.__happySeedManualCamera\s*&&[\s\S]*state\.manualReturnDelayMs[\s\S]*followBall\(\)/,
    )
    expect(decisionDirector).toMatch(
      /function applyStaging\(\)[\s\S]*__happySeedStadiumScene\.followBall\(\)/,
    )
    expect(decisionDirector).toMatch(
      /function restoreCamera\(\)[\s\S]*__happySeedStadiumScene\.followBall\(\)/,
    )
  })

  it('recovers every coach-decision failure path instead of leaving timeScale frozen', () => {
    expect(runtimeService).toContain("'happyseed/runtime-v3.js?v=11'")
    expect(matchBroadcast).toMatch(
      /withDecisionWatchdog\(\s*prepareFormalCoachDecision\(/,
    )
    expect(matchBroadcast).toMatch(
      /catch \(decisionError\)[\s\S]*cancelFormalCoachDecision\(\)[\s\S]*setDecisionPhase\('idle'\)/,
    )
    expect(decisionDirector).toContain('function ensureContinuousMatchRecovery(finished)')
    expect(decisionDirector).toContain('director lifetime timeout; forcing recovery')
    expect(decisionDirector).toContain('}, 25000)')
    expect(decisionDirector).toMatch(
      /function emergencyDecisionCleanup\(finished\)[\s\S]*ensureContinuousMatchRecovery\(finished\)/,
    )
    expect(decisionDirector).toMatch(
      /displayNormalized[\s\S]*frame\.ball\.position\.x = displayBall\.x/,
    )
  })

  it('applies a disallowed VAR goal before choosing the correct restart', () => {
    expect(standaloneRuntime).toContain('window.__happySeedApplyVarResult = function (payload)')
    expect(standaloneRuntime).toContain('scoringTeam.score = Math.max(0, (scoringTeam.score | 0) - 1)')
    expect(standaloneRuntime).toMatch(
      /__happySeedPendingVarInvalidGoal[\s\S]*Pitch\.states\.GoalKick/,
    )
  })

  it('holds goal presentation and the following kickoff outside the third-party core', () => {
    expect(standaloneRuntime).toContain('window.__happySeedSetGoalPresentationHold = function (active)')
    expect(standaloneRuntime).toContain('game.__happySeedGoalPresentationHoldToken = pitch.timeScale.change(0)')
    expect(standaloneRuntime).toContain('game.__happySeedDeferredDecisionGoalRestart')
    expect(standaloneRuntime).toContain('game.__happySeedPendingGoalRestartHold = !0')
    expect(standaloneRuntime).toContain('}, 1600)')
  })

  it('deduplicates goal-state reentry only when both entries share an explicit shot id', () => {
    expect(standaloneRuntime).toMatch(
      /goalEnteredAt - game\.__happySeedAcceptedGoalAt < 2500\s*&& goalShotEventId\s*&& game\.__happySeedAcceptedGoalShotEventId\s*&& goalShotEventId === game\.__happySeedAcceptedGoalShotEventId/,
    )
    expect(standaloneRuntime).not.toMatch(
      /!goalShotEventId\s*\|\|\s*!game\.__happySeedAcceptedGoalShotEventId/,
    )
  })

  it('executes authored multi-leg passes segment by segment before the receiving shot', () => {
    expect(decisionDirector).toContain('active.execution.pathSegments && active.execution.pathSegments.length')
    expect(decisionDirector).toContain('active.execution.segmentEndTimes || []')
    expect(decisionDirector).toContain('runtimeEvent.type === "shot" && emittedEventId')
    expect(decisionDirector).toContain('active.runtimeBallEventId = emittedEventId')
  })

  it('applies every authored actor motion to both physics and renderer frames', () => {
    expect(decisionDirector).not.toMatch(/currentActorMotion\(/)
    expect(decisionDirector).toContain('currentActorMotions(frameNow)')
    expect(decisionDirector).toMatch(
      /motions\.forEach\(function \(motion\) \{\s*setFramePosition\(frame, motion\)/,
    )
  })
})
