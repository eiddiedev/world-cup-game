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
const mainApp = readFileSync(
  path.join(projectRoot, 'src/App.jsx'),
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
  it('monitors held-ball timeouts without rewriting native goalkeeper coordinates', () => {
    expect(standaloneRuntime).not.toContain('function enforceGoalkeeperControlledBallSafety(game)')
    expect(standaloneRuntime).not.toContain('window.__happySeedEnforceGoalkeeperSafety')
    expect(standaloneRuntime).toContain('function monitorGoalkeeperDistribution(game)')
    expect(standaloneRuntime).toMatch(
      /pitch\.update\(elapsed\);\s*monitorGoalkeeperDistribution\(mode\.game\);/,
    )
    const distributionStart = standaloneRuntime.indexOf(
      'function recoverStalledGoalkeeperDistribution(game, goalkeeper)',
    )
    const distributionEnd = standaloneRuntime.indexOf(
      'function scheduleCompliantCaptureShotBias(game, shooter)',
      distributionStart,
    )
    const distributionSource = standaloneRuntime.slice(distributionStart, distributionEnd)
    expect(distributionSource).not.toContain('goalkeeper.position.x =')
    expect(distributionSource).not.toContain('goalkeeper.position.y =')
    expect(distributionSource).not.toContain('ball.placeAtPosition(')
    expect(distributionSource).not.toContain('(pitch.players || game.allPlayers || []).forEach')
  })

  it('derives every decision penalty from the attacking side instead of hardcoding home benefit', () => {
    expect(runtimeService).toContain('function resolveDecisionPenaltySides(script)')
    expect(runtimeService).toContain('const penaltySides = resolveDecisionPenaltySides(script)')
    expect(runtimeService).toContain('side: penaltySides.offendingSide')
    expect(runtimeService).toContain('detail: { awardedSide: penaltySides.awardedSide }')
    expect(runtimeService).not.toContain("side: 'blue', detail: { awardedSide: 'red' }")
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
    expect(standaloneRuntime).toMatch(
      /team\._happySeedBaseHomes\.forEach[\s\S]*record\.player\.isGoalkeeper[\s\S]*record\.player\.home\.x = record\.x;[\s\S]*record\.player\.home\.y = record\.y;/,
    )
  })

  it('never shifts goalkeeper home anchors with coach tactical stances', () => {
    const helperStart = standaloneRuntime.indexOf(
      'window.__happySeedSetTacticalStance = function (side, stance)',
    )
    const helperEnd = standaloneRuntime.indexOf(
      'window.__happySeedGetTacticalStance',
      helperStart,
    )
    const goalkeeper = {
      isGoalkeeper: true,
      home: { x: 1.1, y: 17.5 },
      position: { x: 1.1, y: 17.5 },
      states: { change() {} },
    }
    const outfielder = {
      isGoalkeeper: false,
      home: { x: 10, y: 12 },
      position: { x: 10, y: 12 },
      states: { change() {} },
    }
    const opponent = { goal: { center: { x: 35, y: 17.5 } } }
    const team = {
      goal: { center: { x: 0, y: 17.5 } },
      opponents: opponent,
      players: [goalkeeper, outfielder],
    }
    opponent.opponents = team
    const context = {
      window: {
        __matchGame: {
          pitch: {
            width: 35,
            height: 35,
            redTeam: team,
            blueTeam: opponent,
            ball: { owner: null },
          },
        },
      },
      runtime: () => ({ ReturnHome: 'ReturnHome' }),
      Math,
    }
    runInNewContext(standaloneRuntime.slice(helperStart, helperEnd), context)

    expect(context.window.__happySeedSetTacticalStance('red', 'park-bus')).toBe(true)
    expect(goalkeeper.home).toEqual({ x: 1.1, y: 17.5 })
    expect(outfielder.home.x).toBeCloseTo(5.1)
    expect(outfielder.home.y).toBeCloseTo(12.99)
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
      /patch\.redCard === !0[\s\S]*state\.onPitch = !1[\s\S]*retirePhysicalActor\(entry\)/,
    )
    expect(standaloneRuntime).toMatch(
      /state\.yellowCards >= 2[\s\S]*state\.redCard = !0[\s\S]*retirePhysicalActor\(entry\)/,
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
      releaseRuntimeBallPossession(ball, expectedCarrier) {
        if (ball.owner !== expectedCarrier && ball.inHands !== expectedCarrier) return false
        ball.owner = null
        ball.inHands = null
        return true
      },
      window: {
        __matchGame: {
          removePlayer() { throw new Error('Player not found') },
        },
      },
    }
    runInNewContext(`${helperSource}; retirementApi = { removePhysicalActor };`, context)

    context.retirementApi.removePhysicalActor(entry)

    expect(entry.actor._runtimeRemoved).toBe(true)
    expect(entity).toMatchObject({ static: true })
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
    expect(standaloneRuntime).not.toContain('__happySeedPreviousDirectorPhase')
    expect(standaloneRuntime).not.toContain('decisionCameraRecovery')
  })

  it('uses one bounded recovery path without expiring while the coach is still reading', () => {
    expect(runtimeService).toContain("'happyseed/runtime-v2.js?v=13'")
    expect(runtimeService).toContain("'happyseed/runtime-v3.js?v=26'")
    expect(runtimeService).toContain("'standalone-match.js?v=76'")
    expect(matchBroadcast).toMatch(
      /withDecisionWatchdog\(\s*prepareFormalCoachDecision\(/,
    )
    expect(matchBroadcast).toMatch(
      /catch \(decisionError\)[\s\S]*cancelFormalCoachDecision\(\)[\s\S]*setDecisionPhase\('idle'\)/,
    )
    expect(decisionDirector).toContain('function resumeFrozenMatchPlayers(finished)')
    expect(decisionDirector).toContain('function emergencyDecisionCleanup(finished)')
    expect(decisionDirector).toContain('function ensureContinuousMatchRecovery(finished)')
    expect(decisionDirector).toContain('function wakeDecisionParticipants(finished)')
    expect(decisionDirector).toContain('function recoverIfStalled(now)')
    expect(decisionDirector).toContain('recoverIfStalled: recoverIfStalled')
    expect(standaloneRuntime).toContain('window.__happySeedDecisionDirectorV3.recoverIfStalled(performance.now())')
    expect(decisionDirector).not.toMatch(/\.hasBall\s*=/)
    expect(decisionDirector).toMatch(
      /finally \{[\s\S]*emergencyDecisionCleanup\(finished\)[\s\S]*publishRecoveryDiagnostics/,
    )
    expect(decisionDirector).toContain('recover: function () { return emergencyDecisionCleanup(active); }')
    expect(decisionDirector).toContain('current.constructor && current.constructor.name')
    expect(decisionDirector).toContain('finished.liveResult === "saved"')
    expect(decisionDirector).toContain('pitch.timeScale.clear()')
    expect(decisionDirector).toContain('loose-ball recovery failed')
    expect(decisionDirector).toMatch(
      /participants\[shot\.shooterRuntimeActorId\][\s\S]*participants\[shot\.keeperRuntimeActorId\][\s\S]*participants\[entry\.actor\.runtimeActorId\]\) return/,
    )
    expect(decisionDirector).not.toContain('director lifetime timeout')
    expect(decisionDirector).not.toContain('}, 25000)')
    expect(decisionDirector).not.toContain('pitch.timeScale.value')
  })

  it('binds player and coach control to each match instance instead of a shared mutable flag', () => {
    expect(runtimeService).toContain('playerMode: Boolean(options.playerMode)')
    expect(standaloneRuntime).toContain(
      'window.__acPlay = Boolean(options.playerMode);',
    )
    expect(standaloneRuntime).toContain(
      'window.__matchGame.__happySeedPlayerMode = window.__acPlay;',
    )
    expect(standaloneRuntime).toMatch(
      /function acPlay\(\) \{[\s\S]*typeof game\.__happySeedPlayerMode === "boolean"[\s\S]*game\.__happySeedPlayerMode[\s\S]*window\.__acPlay/,
    )
    expect(standaloneRuntime).toContain(
      'document.body.dataset.runtimePlayerMode = window.__acPlay',
    )
  })

  it('keeps coach-mode goalkeeper coordinates under the native state machine', () => {
    expect(decisionDirector).toContain('function preserveNativeGoalkeeper(entry)')
    expect(decisionDirector).toContain('active.script.runtimeContext !== "shootout"')
    expect(decisionDirector).toMatch(
      /function setEntityPosition\(position\)[\s\S]*preserveNativeGoalkeeper\(entry\)/,
    )
    expect(decisionDirector).toMatch(
      /function setFramePosition\(frame, position\)[\s\S]*preserveNativeGoalkeeper\(entry\)/,
    )
    expect(decisionDirector).toMatch(
      /function restoreCancelledSnapshot\(finished\)[\s\S]*preserveNativeGoalkeeper\(entry\)/,
    )
  })

  it('fully resumes a completed no-penalty VAR incident but preserves a real penalty freeze', () => {
    const helperStart = decisionDirector.indexOf('function resumeNoPenaltyVarIncident(finished)')
    const helperEnd = decisionDirector.indexOf(
      '// One idempotent terminal path is shared by successful completion',
      helperStart,
    )
    const helperSource = decisionDirector.slice(helperStart, helperEnd)
    const stateChanges = []
    let timeScale = 0
    let wakeCount = 0
    let followCount = 0
    const context = {
      pitch: {
        ballOutOfPlay: true,
        states: { change(next) { stateChanges.push(next) } },
        timeScale: {
          clear() { timeScale = 1 },
          valueOf() { return timeScale },
        },
      },
      pitchStateName: () => 'BallOutOfPlay',
      runtime: () => ({ Pitch: { states: { Match: 'Match' } } }),
      wakeDecisionParticipants() { wakeCount += 1 },
      document: { body: { dataset: {} } },
      console: { error() {} },
      window: {
        __matchGame: {},
        __happySeedStadiumScene: { followBall() { followCount += 1 } },
      },
    }
    runInNewContext(
      `${helperSource}; recoveryApi = { resumeNoPenaltyVarIncident };`,
      context,
    )

    const noPenalty = {
      script: { scenarioId: 'handball_penalty_claim', mode: 'freeze-incident' },
      outcome: 'play_continues',
    }
    expect(context.recoveryApi.resumeNoPenaltyVarIncident(noPenalty)).toBe(true)
    expect(timeScale).toBe(1)
    expect(context.pitch.ballOutOfPlay).toBe(false)
    expect(stateChanges).toEqual(['Match'])
    expect(wakeCount).toBe(1)
    expect(followCount).toBe(1)
    expect(context.document.body.dataset.noPenaltyVarRecovery).toBe('handball_penalty_claim')

    timeScale = 0
    const penaltyAwarded = {
      script: {
        scenarioId: 'handball_penalty_claim',
        mode: 'freeze-incident',
      },
      outcome: 'penalty_awarded',
    }
    expect(context.recoveryApi.resumeNoPenaltyVarIncident(penaltyAwarded)).toBe(false)
    expect(timeScale).toBe(0)
    expect(wakeCount).toBe(1)
  })

  it('clears every cross-match freeze token before reusing the loaded engine', () => {
    expect(standaloneRuntime).toContain('function resetReusableMatchLifecycle(game, reason)')
    expect(standaloneRuntime).toContain('window.__happySeedResetMatchLifecycle = function (reason)')
    expect(standaloneRuntime).toContain('pitch.timeScale.clear()')
    expect(standaloneRuntime).toContain('game.__happySeedDeferredGoalKickoff = null')
    expect(standaloneRuntime).toContain('game.__happySeedDeferredDecisionGoalRestart = null')
    expect(standaloneRuntime).toContain('game.__happySeedPendingVarInvalidGoal = null')
    expect(standaloneRuntime).toContain('game._firstKickoffDone = !1')
    expect(standaloneRuntime).toContain('game._kickoffForced = !1')
    expect(standaloneRuntime).toContain('game._introKickoffHeld = !1')
    expect(standaloneRuntime).toContain('game._kickoffSnapped = !1')
    expect(standaloneRuntime).toContain('pitch.ball.lastTouch = null')
    expect(standaloneRuntime).toContain('resetReusableMatchLifecycle(mode.game, "setup-match")')
    expect(standaloneRuntime).toContain('window.__happySeedResetMatchLifecycle("standalone-restart")')
    expect(runtimeService).toContain("window.__happySeedResetMatchLifecycle?.('react-shutdown')")
    expect(runtimeService).toContain("window.__happySeedResetMatchLifecycle?.('react-boot')")
  })

  it('lets native kickoff movement start before the watchdog can reset participants', () => {
    expect(standaloneRuntime).toContain('function clearInvalidKickoffPossession(game)')
    expect(standaloneRuntime).toMatch(
      /"signal:pitch\.Pitch\.states\.Kickoff\.onEnter": function \(game\) \{\s*clearInvalidKickoffPossession\(game\)/,
    )
    expect(standaloneRuntime).toContain('carrier.isGoalkeeper')
    expect(standaloneRuntime).toContain('startingTeam && carrier.team !== startingTeam')
    expect(standaloneRuntime).toContain('function resetKickoffParticipants(game, reason)')
    expect(standaloneRuntime).toContain('function recoverStalledKickoff(game)')
    expect(standaloneRuntime).toContain('player.states.change(playerStates.ReturnHome)')
    expect(standaloneRuntime).not.toContain('resetKickoffParticipants(game, "enter")')
    expect(standaloneRuntime).toContain('game.__happySeedKickoffRecovery = null')
    expect(standaloneRuntime).toContain('ball.owner = null')
    expect(standaloneRuntime).toContain('ball.inHands = null')
    expect(standaloneRuntime).toContain('ball.lastTouch === carrier')
    const kickoffPossessionGuard = standaloneRuntime.match(
      /function clearInvalidKickoffPossession\(game\) \{[\s\S]*?\n {2}\}\n {2}function resetKickoffParticipants/,
    )?.[0]
    expect(kickoffPossessionGuard).toBeTruthy()
    expect(kickoffPossessionGuard).not.toMatch(/\.hasBall\s*=/)
    expect(standaloneRuntime).toContain('ball.placeAtPosition(centerX, centerY')
    expect(standaloneRuntime).toMatch(
      /runtimeStateName\(mode\.game\) === "Kickoff"[\s\S]*recoverStalledKickoff\(mode\.game\)/,
    )
  })

  it('defers red-card removal until decision cleanup and restores live play safely', () => {
    expect(standaloneRuntime).toContain('function decisionDirectorBusyForDismissal()')
    expect(standaloneRuntime).toContain('function retirePhysicalActor(entry)')
    expect(standaloneRuntime).toContain('entry.actor._runtimeRemovalPending = !0')
    expect(standaloneRuntime).toContain('function flushPendingPhysicalDismissals(reason)')
    expect(standaloneRuntime).toContain('function recoverAfterActorDismissal(reason)')
    expect(standaloneRuntime).toContain('"ab-decision-director-completed"')
    expect(standaloneRuntime).toContain('"ab-decision-director-cancelled"')
    expect(standaloneRuntime).toMatch(
      /patch\.redCard === !0[\s\S]*retirePhysicalActor\(entry\)/,
    )
    expect(standaloneRuntime).toMatch(
      /state\.yellowCards >= 2[\s\S]*retirePhysicalActor\(entry\)/,
    )
    expect(standaloneRuntime).toMatch(
      /stateName === "Match" && !carrier[\s\S]*ball\.owner = nearest/,
    )
    expect(decisionDirector).toContain('entry.actor._runtimeRemovalPending')
    expect(runtimeService).toContain("if (script.mode === 'freeze-incident')")
  })

  it('flushes a deferred dismissal when the decision director completes', () => {
    const helpersStart = standaloneRuntime.indexOf('function hideRetiredActorVisual(entry)')
    const helpersEnd = standaloneRuntime.indexOf('window.__happySeedRuntimeActors = {', helpersStart)
    const helperSource = standaloneRuntime.slice(helpersStart, helpersEnd)
    const listeners = {}
    let directorPhase = 'settled'
    let teamRemovalCount = 0
    let gameRemovalCount = 0
    let cameraRecoveryCount = 0
    const ball = {
      owner: null,
      inHands: null,
      position: { x: 50, y: 30 },
    }
    const timeScale = {
      clear() {},
      valueOf() { return 1 },
    }
    const entity = {
      static: false,
      passing: true,
      team: null,
      states: { change() {} },
    }
    entity.team = {
      players: [entity],
      removePlayer(player) {
        expect(player).toBe(entity)
        teamRemovalCount += 1
        this.players = []
      },
    }
    const entry = {
      actor: {
        _runtimeRemoved: false,
        state: { onPitch: false },
      },
      entity,
      renderer: {},
    }
    const game = {
      pitch: { ball, timeScale, ballOutOfPlay: false },
      removePlayer(player) {
        expect(player).toBe(entity)
        gameRemovalCount += 1
      },
    }
    const context = {
      actorEntries: [entry],
      pitch: game.pitch,
      runtimeStateName: () => 'Match',
      runtime(id) {
        if (id === 'players/states') return {}
        return { forceAI() {} }
      },
      document: { body: { dataset: {} } },
      console: { error() {} },
      window: {
        __matchGame: game,
        __happySeedDecisionDirectorV3: {
          getSnapshot: () => ({ phase: directorPhase }),
        },
        __happySeedStadiumScene: {
          followBall() { cameraRecoveryCount += 1 },
        },
        addEventListener(name, listener) { listeners[name] = listener },
        setTimeout(callback) { callback() },
      },
    }
    runInNewContext(`${helperSource}; retirementApi = { retirePhysicalActor };`, context)

    context.retirementApi.retirePhysicalActor(entry)
    expect(entry.actor._runtimeRemovalPending).toBe(true)
    expect(entry.actor._runtimeRemoved).toBe(false)
    expect(entity).toMatchObject({ static: true, passing: false })

    directorPhase = 'idle'
    listeners['ab-decision-director-completed']()

    expect(entry.actor._runtimeRemovalPending).toBe(false)
    expect(entry.actor._runtimeRemoved).toBe(true)
    expect(teamRemovalCount).toBe(1)
    expect(gameRemovalCount).toBe(1)
    expect(cameraRecoveryCount).toBe(1)
    expect(context.document.body.dataset.dismissalRecovery).toBe(
      'ab-decision-director-completed',
    )
  })

  it('keeps mobile pinch-to-zoom in the shared stadium runtime', () => {
    expect(runtimeStadium).toContain('document.addEventListener("touchstart"')
    expect(runtimeStadium).toContain('document.addEventListener("touchmove"')
    expect(runtimeStadium).toContain('document.addEventListener("pointerdown"')
    expect(runtimeStadium).toContain('document.addEventListener("pointermove"')
    expect(runtimeStadium).toContain('if (window.__acPlay || event.touches.length !== 2) return')
    expect(runtimeStadium).toContain('pinchStartZoom * nextDistance / pinchStartDistance')
  })

  it('uses separate interactive-space zoom defaults for coach and player modes', () => {
    expect(runtimeService).toContain('window.__happySeedInteractiveSpace = Boolean(__DOUYIN_BUILD__)')
    expect(runtimeService).toContain(
      'setZoom(CURRENT_VARIANT.matchView.coachDefaultZoom)',
    )
    expect(standaloneRuntime).toContain(
      'if (window.__acPlay) return matchView.playerDefaultZoom || 1.16',
    )
    expect(standaloneRuntime).toContain(
      'return matchView.coachDefaultZoom || 0.68',
    )
    expect(standaloneRuntime).toContain(
      'return window.__happySeedInteractiveSpace && !window.__acPlay ? (configured || 0.48) : 0.8',
    )
    expect(standaloneRuntime).toContain('window.__matchZoomMul = defaultZoomMultiplier()')
    expect(standaloneRuntime).toContain('if (revealPitch.camera.auto) revealPitch.camera.auto()')
    expect(standaloneRuntime).toContain('pitch.camera.auto\n      ? pitch.camera.auto()')
  })

  it('selects player pace by match difficulty and keeps bounded press easy-only', () => {
    expect(runtimeService).toContain(
      'window.__happySeedPlayerModeAssist = getPlayerModeDemoAssistProfile(',
    )
    expect(runtimeService).toContain(
      'setSpeed(window.__happySeedPlayerModeAssist?.speed || 1)',
    )
    expect(runtimeService).toContain(
      'document.body.dataset.playerModePace = String(window.__happySeedPlayerModeAssist.speed)',
    )
    expect(runtimeService).toContain(
      'document.body.dataset.playerModeDifficulty = window.__happySeedPlayerModeAssist.difficulty',
    )
    expect(runtimeService).toContain('window.__happySeedPlayerModeAssist?.ai ?? 1')
    expect(standaloneRuntime).toContain('function applyPlayerModeDemoAssist(game)')
    expect(standaloneRuntime).toContain('function widenPlayerModeDefensiveShape(game, profile)')
    expect(standaloneRuntime).toContain('now + Number(profile.receptionGraceMs || 0)')
    expect(standaloneRuntime).toContain('this._bufferedPassUntil = inputNow')
    expect(standaloneRuntime).toContain('function preparePlayerModeGoalkeeperDistribution(game, goalkeeper)')
    expect(standaloneRuntime).toMatch(
      /trainingTarget = mode\.game\.__happySeedTrainingActive[\s\S]*applyPlayerModeDemoAssist\(mode\.game\);[\s\S]*if \(trainingTarget\)/,
    )
  })

  it('presses immediately during reception grace, then adds one spaced cover player', () => {
    const helperStart = standaloneRuntime.indexOf('function playerModeAssistProfile()')
    const helperEnd = standaloneRuntime.indexOf('function createPlayPhase()', helperStart)
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    let now = 100
    const changes = []
    const redTeam = {}
    const blueTeam = { inControl: false }
    const owner = { team: redTeam, position: { x: 50, y: 30 } }
    const opponents = Array.from({ length: 10 }, (_, index) => ({
      id: `blue-${index}`,
      team: blueTeam,
      position: { x: 54 + index * 4, y: 30 },
      home: { x: 70 + index, y: index % 2 ? 20 : 40 },
      states: {
        current: { name: 'AIChaseBall' },
        change(next) {
          this.current = { name: next }
          changes.push(`blue-${index}:${next}`)
        },
      },
    }))
    blueTeam.fieldPlayers = opponents
    blueTeam.allPlayers = opponents
    const game = {
      pitch: {
        width: 100,
        height: 60,
        ballOutOfPlay: false,
        ball: { owner, inHands: null },
        redTeam,
        blueTeam,
      },
    }
    const context = {
      acPlay: () => true,
      runtimeStateName: () => 'Match',
      stateObjectName: (state) => state?.name || '',
      performance: { now: () => now },
      document: { body: { dataset: {} } },
      window: {
        __happySeedPlayerModeAssist: {
          enabled: true,
          receptionGraceMs: 500,
          defensiveWidth: 1.06,
          coverMinimumDistance: 5.5,
          shapeRefreshMs: 180,
        },
      },
      runtime(name) {
        if (name === 'players/global') return { forceAI() {} }
        return {
          ReturnHome: 'ReturnHome',
          AIDefend: 'AIDefend',
          AIAttack: 'AIAttack',
        }
      },
    }
    runInNewContext(
      `${helperSource}; assistApi = { applyPlayerModeDemoAssist };`,
      context,
    )

    expect(context.assistApi.applyPlayerModeDemoAssist(game)).toBe(true)
    expect(context.window.__happySeedPlayerModeAssistSnapshot).toMatchObject({
      receptionGrace: true,
      activePressers: 1,
      coverPlayers: 0,
    })
    expect(changes).toContain('blue-0:AIDefend')
    expect(changes.filter((entry) => entry.endsWith(':ReturnHome'))).toHaveLength(9)
    expect(opponents[0].home.y).toBeCloseTo(40.6)

    now = 700
    game.__happySeedPlayerAssistNextShapeAt = 0
    expect(context.assistApi.applyPlayerModeDemoAssist(game)).toBe(true)
    expect(context.window.__happySeedPlayerModeAssistSnapshot).toMatchObject({
      receptionGrace: false,
      activePressers: 1,
      coverPlayers: 1,
    })
    expect(changes).toContain('blue-0:AIDefend')
    expect(opponents.slice(2).every((player) => player.states.current.name === 'ReturnHome')).toBe(true)

    const changeCountBeforePassFlight = changes.length
    game.pitch.ball.owner = null
    expect(context.assistApi.applyPlayerModeDemoAssist(game)).toBe(true)
    expect(changes).toHaveLength(changeCountBeforePassFlight)
  })

  it('gives a player goalkeeper three seconds before exactly one opponent presses', () => {
    const helperStart = standaloneRuntime.indexOf('function playerModeAssistProfile()')
    const helperEnd = standaloneRuntime.indexOf('function createPlayPhase()', helperStart)
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    let now = 100
    const redTeam = {}
    const goalkeeper = {
      isGoalkeeper: true,
      team: redTeam,
      position: { x: 8, y: 30 },
    }
    const blueTeam = {}
    const opponents = Array.from({ length: 10 }, (_, index) => ({
      id: `blue-${index}`,
      isGoalkeeper: false,
      team: blueTeam,
      position: { x: 20 + index * 3, y: 30 },
      states: {
        current: { name: 'AIDefend' },
        change(next) { this.current = { name: next } },
      },
    }))
    blueTeam.fieldPlayers = opponents
    const game = {
      pitch: {
        ballOutOfPlay: false,
        ball: { owner: goalkeeper, inHands: null },
        redTeam,
        blueTeam,
      },
      __happySeedTrainingActive: false,
    }
    let playerMode = true
    const context = {
      acPlay: () => playerMode,
      runtimeStateName: () => 'Match',
      stateObjectName: (state) => typeof state === 'string' ? state : state?.name || '',
      performance: { now: () => now },
      document: { body: { dataset: {} } },
      window: {},
      Math,
      runtime(name) {
        if (name === 'players/global') return { forceAI() {} }
        return { ReturnHome: 'ReturnHome', AIDefend: 'AIDefend' }
      },
    }
    runInNewContext(
      `${helperSource}; assistApi = { applyPlayerModeGoalkeeperPress };`,
      context,
    )

    expect(context.assistApi.applyPlayerModeGoalkeeperPress(game)).toBe(true)
    expect(context.window.__happySeedPlayerGoalkeeperPressSnapshot).toMatchObject({
      graceActive: true,
      activePressers: 0,
    })
    expect(opponents.every((player) => player.states.current.name === 'ReturnHome')).toBe(true)
    expect(context.document.body.dataset.playerGoalkeeperPress).toBe('grace')

    now = 3100
    expect(context.assistApi.applyPlayerModeGoalkeeperPress(game)).toBe(true)
    expect(context.window.__happySeedPlayerGoalkeeperPressSnapshot).toMatchObject({
      graceActive: false,
      activePressers: 1,
    })
    expect(opponents[0].states.current.name).toBe('AIDefend')
    expect(opponents.slice(1).every((player) => player.states.current.name === 'ReturnHome')).toBe(true)
    expect(context.document.body.dataset.playerGoalkeeperPress).toBe('press')

    game.pitch.ball.owner = null
    expect(context.assistApi.applyPlayerModeGoalkeeperPress(game)).toBe(false)
    expect(game.__happySeedPlayerGoalkeeperPossessionStartedAt).toBe(0)
    playerMode = false
    game.pitch.ball.owner = goalkeeper
    expect(context.assistApi.applyPlayerModeGoalkeeperPress(game)).toBe(false)
  })

  it('gives player mode its own movable goalkeeper control path', () => {
    const helperStart = standaloneRuntime.indexOf('function playerModeAssistProfile()')
    const helperEnd = standaloneRuntime.indexOf('function createPlayPhase()', helperStart)
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    const stateChanges = []
    const goalkeeper = {
      isGoalkeeper: true,
      hasBall: false,
      static: true,
      passing: true,
      position: { x: 7, y: 30 },
      home: { x: 7, y: 30 },
      velocity: { x: 0, y: 0 },
      user: null,
      dropBall() {
        ball.inHands = null
      },
      states: {
        current: null,
        is(next) { return this.current === next },
        change(next) {
          this.current = next
          stateChanges.push(`state:${next}`)
          return {
            queue(queued) {
              stateChanges.push(`queue:${queued}`)
            },
          }
        },
      },
    }
    const opponent = { team: { id: 'blue' } }
    const ball = {
      owner: opponent,
      inHands: null,
      position: { x: 12, y: 30 },
      velocity: { x: 0, y: 0, z: 0 },
      radius: 0.12,
      trap(player) {
        this.owner = player
      },
      placeAtPosition(x, y, z) {
        this.position = { x, y, z }
      },
    }
    const team = { id: 'red', goalkeeper, players: [goalkeeper] }
    goalkeeper.team = team
    const outfielder = { isGoalkeeper: false, team }
    const user = {
      team,
      player: outfielder,
      findControl() {
        this.player = outfielder
        outfielder.user = this
        return outfielder
      },
      takeControl(player, state) {
        this.player = player
        player.user = this
        player.states.current = state
        stateChanges.push(`take:${state}`)
      },
    }
    const controller = {
      velocity: { x: 0, y: 0 },
      pass: { isActive: false },
      lob: { isActive: false },
    }
    const game = {
      pitch: {
        ball,
        width: 100,
        height: 60,
        matchStarted: true,
        ballOutOfPlay: false,
      },
      __happySeedTrainingActive: false,
      __happySeedManualGoalkeeperUntil: 0,
    }
    let playerMode = true
    let now = 1000
    const context = {
      acPlay: () => playerMode,
      Math,
      performance: { now: () => now },
      stateObjectName: (state) => typeof state === 'string' ? state : state?.name || '',
      runtime: () => ({
        HumanMove: 'HumanMove',
        HumanDribble: 'HumanDribble',
        HumanPass: 'HumanPass',
        HumanLob: 'HumanLob',
        HumanPutBallBackInPlay: 'HumanPutBallBackInPlay',
      }),
      console: { error() {} },
      document: { body: { dataset: {} } },
    }
    runInNewContext(
      `${helperSource}; assistApi = {` +
      'tryTakePlayerModeGoalkeeper, ensurePlayerModeGoalkeeperControl, ' +
      'restorePlayerModeControlAfterGoalkeeperDistribution };',
      context,
    )

    expect(context.assistApi.tryTakePlayerModeGoalkeeper(game, user)).toBe(true)
    expect(user.player).toBe(goalkeeper)
    expect(goalkeeper.states.current).toBe('HumanMove')
    expect(game.__happySeedManualGoalkeeperUntil).toBe(4200)
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(true)

    ball.owner = null
    ball.inHands = goalkeeper
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(true)
    expect(goalkeeper.states.current).toBe('HumanPutBallBackInPlay')
    expect(ball.owner).toBeNull()
    expect(ball.inHands).toBe(goalkeeper)

    // A teammate backpass must be allowed to finish naturally. If both the
    // ball and goalkeeper stop progressing, recover it as a legal foot trap.
    ball.owner = null
    ball.inHands = null
    ball.lastTouch = outfielder
    ball.position = { x: 11, y: 30, z: 0.12 }
    team.receivingPlayer = goalkeeper
    goalkeeper.states.current = { name: 'AIReceivePass' }
    now = 2000
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(true)
    expect(game.__happySeedPlayerGoalkeeperReceiveWatch).toBeTruthy()
    now = 3101
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(true)
    expect(ball.owner).toBe(goalkeeper)
    expect(team.receivingPlayer).toBeNull()
    expect(goalkeeper.states.current).toBe('HumanPutBallBackInPlay')
    expect(context.document.body.dataset.playerGoalkeeperBackpassRecovery).toBe('trapped')

    // Once possession is secured, keep the input active for the native
    // HumanPutBallBackInPlay state. It owns the pass, controller release and
    // goalkeeper return-state queue as one atomic transition.
    controller.pass.isActive = true
    now = 3200
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(true)
    expect(game.__happySeedPlayerGoalkeeperDistributionUntil).toBe(5000)
    expect(goalkeeper.states.current).toBe('HumanPutBallBackInPlay')
    expect(controller.pass.isActive).toBe(true)
    expect(context.document.body.dataset.playerGoalkeeperPass).toBe('pass-requested')

    // Simulate the native distribution state's release. The adapter must not
    // reclaim the goalkeeper while the ball is leaving, which was the freeze.
    controller.pass.isActive = false
    goalkeeper.states.current = { name: 'HumanPass' }
    goalkeeper.user = null
    user.player = null
    ball.owner = null
    ball.inHands = null
    now = 3300
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(false)
    expect(goalkeeper.states.current).toEqual({ name: 'HumanPass' })

    // The native goalkeeper state releases the user immediately after the
    // launch. Restore an outfield controller before the pass/throw lands.
    expect(context.assistApi.restorePlayerModeControlAfterGoalkeeperDistribution(
      game,
      user,
    )).toBe(true)
    expect(user.player).toBe(outfielder)
    expect(context.document.body.dataset.playerGoalkeeperDistribution)
      .toBe('outfield-restored')

    // A hand throw uses the same native state handoff and must keep the lob
    // input intact until the engine consumes it.
    user.player = goalkeeper
    goalkeeper.user = user
    ball.owner = null
    ball.inHands = goalkeeper
    goalkeeper.states.current = 'HumanPutBallBackInPlay'
    controller.lob.isActive = true
    now = 3500
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(true)
    expect(controller.lob.isActive).toBe(true)
    expect(context.document.body.dataset.playerGoalkeeperPass).toBe('throw-requested')
    expect(game.__happySeedPlayerGoalkeeperDistributionUntil).toBe(5300)

    controller.lob.isActive = false
    goalkeeper.states.current = { name: 'HumanLob' }
    goalkeeper.user = null
    user.player = null
    ball.owner = null
    ball.inHands = null
    now = 3600
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(false)
    expect(context.assistApi.restorePlayerModeControlAfterGoalkeeperDistribution(
      game,
      user,
    )).toBe(true)
    expect(user.player).toBe(outfielder)

    user.player = goalkeeper
    goalkeeper.user = user
    ball.lastTouch = null
    team.receivingPlayer = null
    controller.velocity.x = 0.5
    now = 5500
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(true)
    expect(goalkeeper.states.current).toBe('HumanMove')
    expect(game.__happySeedManualGoalkeeperUntil).toBe(8700)
    expect(goalkeeper).toMatchObject({ static: false, passing: false })

    goalkeeper.position.x = 20
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(true)
    expect(goalkeeper.position.x).toBeCloseTo(12.5)

    playerMode = false
    controller.velocity.x = 1
    expect(context.assistApi.ensurePlayerModeGoalkeeperControl(
      game,
      user,
      controller,
    )).toBe(false)
    expect(stateChanges).toEqual([
      'take:HumanMove',
      'state:HumanPutBallBackInPlay',
      'state:HumanPutBallBackInPlay',
      'state:HumanMove',
    ])
  })

  it('keeps the native player and restart state machines authoritative each frame', () => {
    const playPhaseStart = standaloneRuntime.indexOf('function createPlayPhase()')
    const playPhaseEnd = standaloneRuntime.indexOf(
      'function prepareGoalkeeperDistributionBall',
      playPhaseStart,
    )
    const playPhaseSource = standaloneRuntime.slice(playPhaseStart, playPhaseEnd)

    expect(playPhaseSource).not.toContain('recoverPlayerModeRuntimeFreeze(mode.game)')
    expect(playPhaseSource).not.toContain('applyPlayerModeGoalkeeperPress(mode.game)')
    expect(playPhaseSource).not.toContain('ensurePlayerModeGoalkeeperControl(')
    expect(playPhaseSource).not.toContain(
      'restorePlayerModeControlAfterGoalkeeperDistribution(',
    )
    expect(playPhaseSource).toContain(
      'requestPrecisePlayerModeGoalkeeperPass(',
    )
    expect(playPhaseSource).toContain(
      'cp && (cp.hasBall || pitch.ball.owner === cp || pitch.ball.inHands === cp)',
    )
    expect(playPhaseSource).toContain('(this._switchCd <= 0 || cp.isGoalkeeper)')
  })

  it('uses the assisted Pass target for a player-controlled goalkeeper', () => {
    const helperStart = standaloneRuntime.indexOf('function playerModeAssistProfile()')
    const helperEnd = standaloneRuntime.indexOf('function createPlayPhase()', helperStart)
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    const receiver = {
      isGoalkeeper: false,
      position: { x: 22, y: 18 },
    }
    const target = { x: 23.5, y: 18.5 }
    const transitions = []
    const states = {
      change(...args) {
        transitions.push(['change', ...args])
        return this
      },
      queue(...args) {
        transitions.push(['queue', ...args])
        return this
      },
    }
    const goalkeeper = {
      isGoalkeeper: true,
      hasBall: true,
      static: true,
      passing: false,
      position: { x: 7, y: 30 },
      direction: { x: 1, y: 0 },
      states,
    }
    const team = {
      fieldPlayers: [receiver],
      findPassInDirection() {
        return { receiver, target, strength: 0.72 }
      },
    }
    goalkeeper.team = team
    receiver.team = team
    const ball = { owner: goalkeeper, inHands: null, untrappable: 0 }
    const user = { player: goalkeeper, team }
    const controller = {
      direction: { x: 1, y: 0 },
      pass: { isActive: true },
    }
    const game = { pitch: { ball } }
    let playerMode = true
    const playerStates = {
      Pass: 'Pass',
      RequestAI: 'RequestAI',
      AIGoalkeeperReturnHome: 'AIGoalkeeperReturnHome',
      AIGoalkeeperTendGoal: 'AIGoalkeeperTendGoal',
    }
    const context = {
      acPlay: () => playerMode,
      Math,
      Number,
      performance: { now: () => 1000 },
      runtime(name) {
        if (name === 'settings') return () => 20
        if (name === 'players/states') return playerStates
        return {}
      },
      console: { error() {} },
      document: { body: { dataset: {} } },
    }
    runInNewContext(
      `${helperSource}; assistApi = { requestPrecisePlayerModeGoalkeeperPass };`,
      context,
    )

    expect(context.assistApi.requestPrecisePlayerModeGoalkeeperPass(
      game,
      user,
      controller,
    )).toBe(true)
    expect(transitions).toEqual([
      ['change', 'Pass', receiver, target, 0.72, 1, true],
      ['queue', 'RequestAI', 'AIGoalkeeperReturnHome'],
      ['queue', 'AIGoalkeeperTendGoal'],
    ])
    expect(user.player).toBe(goalkeeper)
    expect(ball.untrappable).toBe(1)
    expect(goalkeeper).toMatchObject({ static: false, passing: true })
    expect(controller.pass.isActive).toBe(false)
    expect(game.__happySeedPlayerGoalkeeperDistributionUntil).toBe(2800)
    expect(context.document.body.dataset.playerGoalkeeperPass).toBe('precise-target')

    playerMode = false
    controller.pass.isActive = true
    expect(context.assistApi.requestPrecisePlayerModeGoalkeeperPass(
      game,
      user,
      controller,
    )).toBe(false)
    expect(transitions).toHaveLength(3)
  })

  it('detaches stale player controllers before every reused match', () => {
    expect(standaloneRuntime).toContain('function setupMatch(mode)')
    expect(standaloneRuntime).toContain('function detachReusableRuntimeUsers(reason)')
    expect(standaloneRuntime).toContain('detachReusableRuntimeUsers(reason || "lifecycle-reset")')
    expect(standaloneRuntime).toContain('staleUser.releaseControl(null)')
    expect(standaloneRuntime).toContain('(player.static = !1)')
    expect(standaloneRuntime).toContain('(player.passing = !1)')
    expect(standaloneRuntime).toContain('document.body.dataset.runtimeControlsReset')
  })

  it('exits Ball.Dribble before clearing possession on restarts and reuse', () => {
    const helperStart = standaloneRuntime.indexOf(
      'function releaseRuntimeBallPossession(ball, expectedCarrier)',
    )
    const helperEnd = standaloneRuntime.indexOf(
      'function resetReusableMatchLifecycle',
      helperStart,
    )
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    const carrier = { passing: true, dropBall() {} }
    const observations = []
    const ball = {
      owner: carrier,
      inHands: null,
      owningTime: 2,
      untrappable: 1,
      states: {
        idle() {
          observations.push(thisBall.owner)
          thisBall.owner = null
        },
      },
    }
    const thisBall = ball
    const context = {}
    runInNewContext(
      `${helperSource}; releaseApi = { releaseRuntimeBallPossession };`,
      context,
    )

    expect(context.releaseApi.releaseRuntimeBallPossession(ball, carrier)).toBe(true)
    expect(observations).toEqual([carrier])
    expect(ball.owner).toBeNull()
    expect(ball.inHands).toBeNull()
    expect(ball.owningTime).toBe(0)
    expect(carrier.passing).toBe(false)
    expect(standaloneRuntime).toContain(
      'releaseRuntimeBallPossession(pitch.ball, entity)',
    )
    expect(standaloneRuntime).toContain(
      'releaseRuntimeBallPossession(pitch.ball);',
    )
    expect(standaloneRuntime).toContain(
      'releaseRuntimeBallPossession(ball, carrier || null);',
    )
  })

  it('keeps stale coach directors and orphaned pauses from freezing player mode', () => {
    expect(standaloneRuntime).toContain('function recoverPlayerModeRuntimeFreeze(game)')
    expect(standaloneRuntime).toContain('game.__happySeedUiPaused')
    expect(standaloneRuntime).toContain('director.cancel && director.cancel()')
    expect(standaloneRuntime).toContain('director.recover && director.recover()')
    const playPhaseStart = standaloneRuntime.indexOf('function createPlayPhase()')
    const playPhaseEnd = standaloneRuntime.indexOf(
      'function prepareGoalkeeperDistributionBall',
      playPhaseStart,
    )
    expect(standaloneRuntime.slice(playPhaseStart, playPhaseEnd))
      .not.toContain('recoverPlayerModeRuntimeFreeze(mode.game)')
    expect(standaloneRuntime).toMatch(
      /freezeSimulationForDirector = !acPlay\(\) && directorSnapshot/,
    )
    expect(standaloneRuntime).toContain('document.body.dataset.playerFreezeRecovery')

    const helperStart = standaloneRuntime.indexOf(
      'function recoverPlayerModeRuntimeFreeze(game)',
    )
    const helperEnd = standaloneRuntime.indexOf(
      'function createPlayPhase()',
      helperStart,
    )
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    let directorPhase = 'staging'
    let directorCancels = 0
    let directorRecovers = 0
    let timeScaleClears = 0
    const pitch = {
      paused: true,
      ballOutOfPlay: false,
      resume() { this.paused = false },
      timeScale: {
        valueOf: () => 0,
        clear() { timeScaleClears += 1 },
      },
    }
    const stadium = {
      paused: true,
      resume() { this.paused = false },
    }
    const game = {
      pitch,
      stadium,
      __happySeedTrainingActive: false,
      __happySeedUiPaused: false,
      __happySeedGoalPresentationHoldToken: null,
    }
    const context = {
      acPlay: () => true,
      runtimeStateName: () => 'Match',
      Number,
      console: { error() {} },
      document: { body: { dataset: {} } },
      window: {
        __happySeedDecisionDirectorV3: {
          getSnapshot: () => ({ phase: directorPhase }),
          cancel() { directorCancels += 1; directorPhase = 'idle' },
          recover() { directorRecovers += 1 },
        },
      },
    }
    runInNewContext(
      `${helperSource}; freezeApi = { recoverPlayerModeRuntimeFreeze };`,
      context,
    )

    expect(context.freezeApi.recoverPlayerModeRuntimeFreeze(game)).toBe(true)
    expect(pitch.paused).toBe(false)
    expect(stadium.paused).toBe(false)
    expect(timeScaleClears).toBe(1)
    expect(directorCancels).toBe(1)
    expect(directorRecovers).toBe(1)
    expect(context.document.body.dataset.playerFreezeRecovery).toBe(
      '1:director+pitch+stadium+time-scale',
    )

    game.__happySeedUiPaused = true
    pitch.paused = true
    stadium.paused = true
    expect(context.freezeApi.recoverPlayerModeRuntimeFreeze(game)).toBe(false)
    expect(pitch.paused).toBe(true)
    expect(stadium.paused).toBe(true)
  })

  it('prewarms a real match session and uses the fast kickoff gate in all three variants', () => {
    expect(mainApp).toContain('const runtimeWarmup = prewarmHappySeedRuntimeSession()')
    expect(runtimeService).not.toContain(
      'if (!__DOUYIN_BUILD__) return preloadHappySeedRuntimeCore()',
    )
    expect(standaloneRuntime).toContain('kickoffWaitFrames = 8')
    expect(standaloneRuntime).not.toContain('kickoffWaitFrames = window.__happySeedInteractiveSpace ? 8 : 900')
    expect(standaloneRuntime).toMatch(
      /mode\.game\._introBowPending && !introActive\(\)[\s\S]*pitch\.camera\.auto\(\)/,
    )
  })

  it('refreshes custom stadium and player renderers after every native loadMatch', () => {
    expect(runtimeStadium).toContain('function refreshMatchVisuals()')
    expect(runtimeStadium).toContain('refreshMatch: refreshMatchVisuals')
    expect(runtimeStadium).toContain('state.matchVisualToken')
    expect(runtimeStadium).toContain('blankLegacyBaseUntilReady()')
    expect(standaloneRuntime).toContain('function bindEntryRenderer(entry, actor)')
    expect(standaloneRuntime).toContain('needsRebind: function ()')
    expect(standaloneRuntime).toContain('window.__happySeedStadiumScene.refreshMatch()')
    expect(standaloneRuntime).toContain('window.__happySeedRuntimeActors.reconfigure(')
    expect(standaloneRuntime).toContain('"prop_anchor"')
    expect(standaloneRuntime).toContain('"hand_right_accessory"')
  })

  it('keeps the AI goalkeeper distribution watchdog exclusive to coach mode', () => {
    expect(standaloneRuntime).toContain('function recoverStalledGoalkeeperDistribution(game, goalkeeper)')
    expect(standaloneRuntime).toContain('var holdLimit = 2800')
    expect(standaloneRuntime).not.toContain('window.__acPlay ? 4200 : 2800')
    expect(standaloneRuntime).toContain('now - watch.startedAt < holdLimit')
    expect(standaloneRuntime).toContain('playerStates.AIGoalkeeperPutBallBackInPlay')
    expect(standaloneRuntime).toMatch(
      /function recoverStalledGoalkeeperDistribution\(game, goalkeeper\)[\s\S]*if \(acPlay\(\)\) \{[\s\S]*return !1;/,
    )
    expect(standaloneRuntime).toMatch(
      /function monitorGoalkeeperDistribution\(game\) \{\s*if \(acPlay\(\)\)/,
    )
    expect(standaloneRuntime).toContain('game.__happySeedGoalkeeperHoldWatch = null')
    expect(standaloneRuntime).toContain('recoverStalledGoalkeeperDistribution(game, goalkeeper);')
    expect(standaloneRuntime).toContain('recoverStalledGoalkeeperDistribution(game, goalkeeper)')
  })

  it('recovers stationary coach-mode possession without changing goalkeeper coordinates', () => {
    const helperStart = standaloneRuntime.indexOf(
      'function resetCoachLivePlayWatch(game)',
    )
    const helperEnd = standaloneRuntime.indexOf(
      'function scheduleCompliantCaptureShotBias(game, shooter)',
      helperStart,
    )
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    let now = 0
    let playerMode = false
    let forcedAi = 0
    const stateChanges = []
    const team = { opponents: {} }
    const carrier = {
      isGoalkeeper: false,
      team,
      hasBall: true,
      static: true,
      passing: true,
      position: { x: 22, y: 18 },
      velocity: { x: 0, y: 0 },
      states: {
        current: { name: 'Ready' },
        change(next) {
          this.current = next
          stateChanges.push(next.name)
        },
      },
    }
    const ball = {
      owner: carrier,
      inHands: null,
      position: { x: 22, y: 18 },
      velocity: { x: 0, y: 0 },
    }
    const pitch = {
      ball,
      players: [carrier],
      ballOutOfPlay: false,
      timeScale: { valueOf: () => 1, clear() {} },
    }
    const game = {
      pitch,
      allPlayers: [carrier],
      __happySeedTrainingActive: false,
    }
    const context = {
      acPlay: () => playerMode,
      runtimeStateName: () => 'Match',
      stateObjectName: state => state?.name || '',
      recoverStalledGoalkeeperDistribution: () => false,
      runtime: key => key === 'players/states'
        ? { AIDribble: { name: 'AIDribble' } }
        : { forceAI() { forcedAi += 1 } },
      performance: { now: () => now },
      window: { __happySeedDecisionDirectorV3: null },
      document: { body: { dataset: {} } },
      console: { error() {} },
      Math,
      Number,
      Boolean,
      Infinity,
    }
    runInNewContext(
      `${helperSource}; livePlayApi = { monitorCoachLivePlay };`,
      context,
    )

    expect(context.livePlayApi.monitorCoachLivePlay(game)).toBe(false)
    now = 2700
    expect(context.livePlayApi.monitorCoachLivePlay(game)).toBe(true)
    expect(carrier).toMatchObject({ static: false, passing: false })
    expect(team).toMatchObject({
      controllingPlayer: carrier,
      activePlayer: carrier,
      receivingPlayer: null,
    })
    expect(stateChanges).toEqual(['AIDribble'])
    expect(forcedAi).toBe(1)
    expect(context.document.body.dataset.coachLivePlayRecovery).toBe('1')

    playerMode = true
    now = 6000
    expect(context.livePlayApi.monitorCoachLivePlay(game)).toBe(false)
    expect(stateChanges).toEqual(['AIDribble'])
  })

  it('gives native goalkeepers explicit distribution accuracy', () => {
    expect(standaloneRuntime).toMatch(
      /new Goalkeeper\(\{[\s\S]*?id,[\s\S]*?pitch: this\.pitch,[\s\S]*?accuracy: 0\.98,/,
    )
  })

  it('converts a stuck held ball into native goalkeeper possession without moving anyone', () => {
    const helperStart = standaloneRuntime.indexOf(
      'function prepareGoalkeeperDistributionBall(game, goalkeeper)',
    )
    const helperEnd = standaloneRuntime.indexOf(
      'function monitorGoalkeeperDistribution(game)',
      helperStart,
    )
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    const stateChanges = []
    const keeper = {
      isGoalkeeper: true,
      static: true,
      passing: true,
      position: { x: 7, y: 11 },
      dropBall() { game.pitch.ball.inHands = null },
      team: { inControl: true, opponents: {} },
      states: { change(next) { stateChanges.push(`keeper:${next}`) } },
    }
    const teammate = {
      isGoalkeeper: false,
      static: true,
      passing: true,
      position: { x: 12, y: 8 },
      team: { inControl: true },
      states: { change(next) { stateChanges.push(`teammate:${next}`) } },
    }
    let now = 100
    const timeScale = {
      valueOf: () => 1,
      clear() { stateChanges.push('timeScale:clear') },
    }
    const game = {
      pitch: {
        ball: {
          inHands: keeper,
          owner: null,
          trap(player) {
            this.owner = player
            stateChanges.push('ball:trap')
          },
          stop() { stateChanges.push('ball:stop') },
        },
        ballOutOfPlay: false,
        players: [keeper, teammate],
        states: { change(next) { stateChanges.push(`pitch:${next}`) } },
        timeScale,
      },
    }
    let playerMode = false
    const context = {
      game,
      goalkeeper: keeper,
      performance: { now: () => now },
      document: { body: { dataset: {} } },
      window: {
        __happySeedDecisionDirectorV3: {
          getSnapshot: () => ({ phase: 'idle' }),
        },
      },
      runtimeStateName: () => 'Match',
      acPlay: () => playerMode,
      runtime(name) {
        if (name === 'pitch') return { Pitch: { states: { Match: 'Match' } } }
        if (name === 'players/global') return { forceAI() {} }
        return {
          AIGoalkeeperPutBallBackInPlay: 'AIGoalkeeperPutBallBackInPlay',
        }
      },
      console: { error() {} },
    }
    runInNewContext(
      `${helperSource}; recoveryApi = { recoverStalledGoalkeeperDistribution };`,
      context,
    )

    expect(context.recoveryApi.recoverStalledGoalkeeperDistribution(game, keeper)).toBe(false)
    now = 3001
    expect(context.recoveryApi.recoverStalledGoalkeeperDistribution(game, keeper)).toBe(true)
    expect(stateChanges).toEqual([
      'ball:trap',
      'ball:stop',
      'keeper:AIGoalkeeperPutBallBackInPlay',
    ])
    expect(game.pitch.ball.inHands).toBeNull()
    expect(game.pitch.ball.owner).toBe(keeper)
    expect(keeper).toMatchObject({ static: false, passing: false })
    expect(keeper.position).toEqual({ x: 7, y: 11 })
    expect(teammate).toMatchObject({
      static: true,
      passing: true,
      position: { x: 12, y: 8 },
    })
    expect(context.document.body.dataset.goalkeeperDistributionRecovery).toBe('1')

    game.__happySeedGoalkeeperHoldWatch = null
    playerMode = true
    now = 5000
    expect(context.recoveryApi.recoverStalledGoalkeeperDistribution(game, keeper)).toBe(false)
    now = 9100
    expect(context.recoveryApi.recoverStalledGoalkeeperDistribution(game, keeper)).toBe(false)
    now = 9301
    expect(context.recoveryApi.recoverStalledGoalkeeperDistribution(game, keeper)).toBe(false)
    expect(context.document.body.dataset.goalkeeperDistributionRecovery).toBe('1')
  })

  it('biases the two capture fixtures before the goal line without mutating score', () => {
    expect(standaloneRuntime).toContain('function scheduleCompliantCaptureShotBias(game, shooter)')
    expect(standaloneRuntime).toContain('function applyPendingCompliantCaptureShotBias(game)')
    expect(standaloneRuntime).toContain('scheduleCompliantCaptureShotBias(game, shooter);')
    expect(standaloneRuntime).toContain('applyPendingCompliantCaptureShotBias(game);')
    const helperStart = standaloneRuntime.indexOf(
      'function scheduleCompliantCaptureShotBias(game, shooter)',
    )
    const helperEnd = standaloneRuntime.indexOf(
      'function isPointInSliderOwnPenaltyArea(game, slider)',
      helperStart,
    )
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    expect(helperSource).toContain('velocity.x = dx / distance * adjustedSpeed;')
    expect(helperSource).toContain('velocity.y = dy / distance * adjustedSpeed;')
    expect(helperSource).not.toMatch(/\.score\s*=|\.score\s*\+=|\.score\s*-=|\.shots\s*\+=/)
  })

  it('restores frozen live-shot players from Idle to explicit AI states', () => {
    const stateNameStart = decisionDirector.indexOf('function pitchStateName()')
    const stateNameEnd = decisionDirector.indexOf('function entryFor(', stateNameStart)
    const helperStart = decisionDirector.indexOf('function resumeFrozenMatchPlayers(finished)')
    const helperEnd = decisionDirector.indexOf('function resetDirectorState()', helperStart)
    const helperSource = [
      decisionDirector.slice(stateNameStart, stateNameEnd),
      decisionDirector.slice(helperStart, helperEnd),
    ].join('\n')
    const changedStates = []
    const createPlayer = (name, { goalkeeper = false, inControl = false } = {}) => ({
      name,
      isGoalkeeper: goalkeeper,
      static: true,
      team: { inControl },
      states: {
        current: 'Frozen',
        change(next) {
          this.current = next
          changedStates.push([name, next])
        },
      },
    })
    const keeper = createPlayer('keeper', { goalkeeper: true })
    const attacker = createPlayer('attacker', { inControl: true })
    const defender = createPlayer('defender')
    const finished = { liveFrozen: [keeper, attacker, defender] }
    const context = {
      pitch: {
        ball: { inHands: keeper, owner: keeper },
        ballOutOfPlay: false,
        states: { current: { name: 'Match' }, change() {} },
      },
      runtime() {
        return { Pitch: { states: { Match: 'Match' } } }
      },
      playerGlobals: {
        forceAI(player) {
          player.states.current = 'Idle'
        },
      },
      playerStates: {
        AIGoalkeeperPutBallBackInPlay: 'AIGoalkeeperPutBallBackInPlay',
        AIGoalkeeperReturnHome: 'AIGoalkeeperReturnHome',
        AIDribble: 'AIDribble',
        AIAttack: 'AIAttack',
        AIDefend: 'AIDefend',
        ReturnHome: 'ReturnHome',
      },
      actorEntries: [],
      finished,
    }
    runInNewContext(`${helperSource}; recoveryApi = { resumeFrozenMatchPlayers };`, context)

    expect(context.recoveryApi.resumeFrozenMatchPlayers(finished)).toBe(3)
    expect(changedStates).toEqual([
      ['keeper', 'AIGoalkeeperPutBallBackInPlay'],
      ['attacker', 'AIAttack'],
      ['defender', 'AIDefend'],
    ])
    expect([keeper, attacker, defender].every((player) => player.static === false)).toBe(true)
    expect(finished.liveFrozen).toEqual([])
  })

  it('activates native AI dribbling when a decision hands possession to an outfield player', () => {
    const helperStart = decisionDirector.indexOf('function activateDecisionPossession(entry)')
    const helperEnd = decisionDirector.indexOf('function handoffContinuation()', helperStart)
    const helperSource = decisionDirector.slice(helperStart, helperEnd)
    const stateChanges = []
    const ball = {
      owner: null,
      inHands: null,
      radius: 0.12,
      placeAtPosition(x, y, z) {
        this.position = { x, y, z }
      },
    }
    const opponents = { receivingPlayer: { id: 'stale-opponent-receiver' } }
    const team = {
      controllingPlayer: null,
      activePlayer: null,
      receivingPlayer: { id: 'stale-receiver' },
      opponents,
    }
    const player = {
      id: 'receiver',
      isGoalkeeper: false,
      static: true,
      passing: true,
      hasBall: false,
      position: { x: 42, y: 18 },
      team,
      forceTrap(targetBall) {
        targetBall.owner = this
        this.hasBall = true
      },
      states: {
        change(next) {
          stateChanges.push(next)
        },
      },
    }
    const context = {
      pitch: { ball },
      playerGlobals: {
        forceAI(target) {
          expect(target).toBe(player)
          stateChanges.push('forceAI')
        },
      },
      playerStates: {
        AIDribble: 'AIDribble',
        AIGoalkeeperPutBallBackInPlay: 'AIGoalkeeperPutBallBackInPlay',
      },
    }
    runInNewContext(
      `${helperSource}; possessionApi = { activateDecisionPossession };`,
      context,
    )

    expect(context.possessionApi.activateDecisionPossession({ entity: player })).toBe(true)
    expect(ball.owner).toBe(player)
    expect(ball.position).toEqual({ x: 42, y: 18, z: 0.12 })
    expect(player).toMatchObject({ static: false, passing: false, hasBall: true })
    expect(team).toMatchObject({
      controllingPlayer: player,
      activePlayer: player,
      receivingPlayer: null,
    })
    expect(opponents.receivingPlayer).toBeNull()
    expect(stateChanges).toEqual(['forceAI', 'AIDribble'])
    const goalkeeper = {
      isGoalkeeper: true,
      static: true,
      passing: false,
      position: { x: 8, y: 30 },
      states: {
        change(next) {
          stateChanges.push(`goalkeeper:${next}`)
        },
      },
    }
    expect(context.possessionApi.activateDecisionPossession({
      actor: { isGoalkeeper: true },
      entity: goalkeeper,
    })).toBe(false)
    expect(goalkeeper).toMatchObject({
      static: true,
      passing: false,
      position: { x: 8, y: 30 },
    })
    expect(stateChanges).toEqual(['forceAI', 'AIDribble'])
    expect(decisionDirector).toContain('function confirmNativeGoalkeeperPossession(entry)')
    expect(decisionDirector).toMatch(
      /if \(goalkeeperTarget\) \{\s*confirmNativeGoalkeeperPossession\(entry\);\s*\} else \{/,
    )
    expect(decisionDirector).toContain(
      '|| entry.actor.isGoalkeeper || entry.entity && entry.entity.isGoalkeeper',
    )
    expect(decisionDirector).toMatch(
      /球权交接超时[\s\S]*activateDecisionPossession\(contEntry\)/,
    )
  })

  it('leaves a goalkeeper on the native state machine during decision handoff', () => {
    const helperStart = decisionDirector.indexOf('function activateDecisionPossession(entry)')
    const helperEnd = decisionDirector.indexOf('function setBlackout(visible)', helperStart)
    const helperSource = decisionDirector.slice(helperStart, helperEnd)
    let dropCount = 0
    const stateChanges = []
    const goalkeeper = {
      isGoalkeeper: true,
      hasBall: false,
      position: { x: 7, y: 30, z: 0 },
      dropBall() { dropCount += 1 },
      states: { change(next) { stateChanges.push(next) } },
    }
    const entry = {
      actor: { isGoalkeeper: true, runtimeActorId: 'red-gk', side: 'red' },
      entity: goalkeeper,
    }
    const ball = {
      inHands: goalkeeper,
      owner: null,
      radius: 0.12,
      position: { x: 7, y: 30, z: 0.12 },
    }
    const context = {
      active: {
        execution: {
          continuation: { type: 'actor-possession', runtimeActorId: 'red-gk' },
        },
        script: { scenarioId: 'saved-shot' },
        choice: { id: 'hold' },
        outcome: 'saved',
      },
      entryFor: () => entry,
      pitch: { ball },
      playerGlobals: { forceAI() { throw new Error('goalkeeper AI must stay native') } },
      playerStates: { AIDribble: 'AIDribble' },
      state: { ballPosition: null },
      window: {},
    }
    runInNewContext(
      `${helperSource}; possessionApi = { handoffContinuation };`,
      context,
    )

    expect(context.possessionApi.handoffContinuation()).toBe(true)
    expect(ball.inHands).toBe(goalkeeper)
    expect(dropCount).toBe(0)
    expect(stateChanges).toEqual([])
    expect(goalkeeper.position).toEqual({ x: 7, y: 30, z: 0 })
  })

  it('never selects the goalkeeper for loose-ball decision recovery', () => {
    const possessionStart = decisionDirector.indexOf('function activateDecisionPossession(entry)')
    const possessionEnd = decisionDirector.indexOf('function handoffContinuation()', possessionStart)
    const recoveryStart = decisionDirector.indexOf('function ensureContinuousMatchRecovery(finished)')
    const recoveryEnd = decisionDirector.indexOf('function resetDirectorState()', recoveryStart)
    const stateChanges = []
    const ball = {
      owner: null,
      inHands: null,
      radius: 0.12,
      position: { x: 7, y: 30, z: 0.12 },
      velocity: { x: 1, y: 1, z: 0 },
      placeAtPosition(x, y, z) { this.position = { x, y, z } },
    }
    const goalkeeper = {
      isGoalkeeper: true,
      position: { x: 7, y: 30, z: 0 },
      team: {},
      states: { change(next) { stateChanges.push(`goalkeeper:${next}`) } },
    }
    const outfielder = {
      isGoalkeeper: false,
      hasBall: false,
      static: true,
      passing: true,
      position: { x: 20, y: 30, z: 0 },
      team: { opponents: {} },
      forceTrap(targetBall) {
        targetBall.owner = this
        this.hasBall = true
      },
      states: { change(next) { stateChanges.push(`outfield:${next}`) } },
    }
    const context = {
      actorEntries: [
        { actor: { isGoalkeeper: true, state: { onPitch: true } }, entity: goalkeeper },
        { actor: { isGoalkeeper: false, state: { onPitch: true } }, entity: outfielder },
      ],
      pitch: { ball, ballOutOfPlay: false },
      pitchStateName: () => 'Match',
      runtime: () => ({ Pitch: { states: { Match: 'Match' } } }),
      playerGlobals: { forceAI() { stateChanges.push('outfield:forceAI') } },
      playerStates: { AIDribble: 'AIDribble' },
      console: { error() {} },
    }
    runInNewContext(
      `${decisionDirector.slice(possessionStart, possessionEnd)};` +
      `${decisionDirector.slice(recoveryStart, recoveryEnd)};` +
      'possessionApi = { ensureContinuousMatchRecovery };',
      context,
    )

    context.possessionApi.ensureContinuousMatchRecovery({
      script: { runtimeContext: 'match' },
      livePhysics: false,
    })
    expect(ball.owner).toBe(outfielder)
    expect(goalkeeper.position).toEqual({ x: 7, y: 30, z: 0 })
    expect(stateChanges).toEqual(['outfield:forceAI', 'outfield:AIDribble'])
  })

  it('returns a saved decision shot from BallOutOfPlay to Match before waking actors', () => {
    const stateNameStart = decisionDirector.indexOf('function pitchStateName()')
    const stateNameEnd = decisionDirector.indexOf('function entryFor(', stateNameStart)
    const helperStart = decisionDirector.indexOf('function resumeFrozenMatchPlayers(finished)')
    const helperEnd = decisionDirector.indexOf('function resetDirectorState()', helperStart)
    const helperSource = [
      decisionDirector.slice(stateNameStart, stateNameEnd),
      decisionDirector.slice(helperStart, helperEnd),
    ].join('\n')
    const stateChanges = []
    const keeper = {
      isGoalkeeper: true,
      static: true,
      team: { inControl: true },
      states: { change(next) { stateChanges.push(`keeper:${next}`) } },
    }
    const context = {
      pitch: {
        ball: { inHands: keeper, owner: keeper },
        ballOutOfPlay: true,
        states: {
          current: { name: 'BallOutOfPlay' },
          change(next) { stateChanges.push(next) },
        },
      },
      runtime() {
        return { Pitch: { states: { Match: 'Match' } } }
      },
      playerGlobals: { forceAI() {} },
      playerStates: {
        AIGoalkeeperPutBallBackInPlay: 'AIGoalkeeperPutBallBackInPlay',
        AIGoalkeeperReturnHome: 'AIGoalkeeperReturnHome',
        AIDribble: 'AIDribble',
        AIAttack: 'AIAttack',
        AIDefend: 'AIDefend',
        ReturnHome: 'ReturnHome',
      },
      actorEntries: [],
      finished: { liveResult: 'saved', liveFrozen: [keeper] },
      console: { error() {} },
    }
    runInNewContext(`${helperSource}; recoveryApi = { resumeFrozenMatchPlayers };`, context)

    context.recoveryApi.resumeFrozenMatchPlayers(context.finished)

    expect(context.pitch.ballOutOfPlay).toBe(false)
    expect(stateChanges).toEqual(['Match', 'keeper:AIGoalkeeperPutBallBackInPlay'])
  })

  it('applies a disallowed VAR goal before choosing the correct restart', () => {
    expect(standaloneRuntime).toContain('window.__happySeedApplyVarResult = function (payload)')
    expect(standaloneRuntime).toContain('scoringTeam.score = Math.max(0, (scoringTeam.score | 0) - 1)')
    expect(standaloneRuntime).toMatch(
      /__happySeedPendingVarInvalidGoal[\s\S]*Pitch\.states\.GoalKick/,
    )
  })

  it('holds only the goal presentation and releases directly into native kickoff movement', () => {
    expect(standaloneRuntime).toContain('window.__happySeedSetGoalPresentationHold = function (active)')
    expect(standaloneRuntime).toContain('game.__happySeedGoalPresentationHoldToken = pitch.timeScale.change(0)')
    expect(standaloneRuntime).toContain('game.__happySeedDeferredDecisionGoalRestart')
    expect(standaloneRuntime).not.toContain('game.__happySeedPendingGoalRestartHold = !0')
    expect(standaloneRuntime).not.toContain('var goalRestartHoldToken = game.pitch.timeScale.change(0)')
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
