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
const interactiveBuilder = readFileSync(
  path.join(projectRoot, 'scripts/build-interactive.mjs'),
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
  })

  it('uses one bounded recovery path without expiring while the coach is still reading', () => {
    expect(runtimeService).toContain("'happyseed/runtime-v2.js?v=13'")
    expect(runtimeService).toContain("'happyseed/runtime-v3.js?v=14'")
    expect(runtimeService).toContain("'standalone-match.js?v=43'")
    expect(matchBroadcast).toMatch(
      /withDecisionWatchdog\(\s*prepareFormalCoachDecision\(/,
    )
    expect(matchBroadcast).toMatch(
      /catch \(decisionError\)[\s\S]*cancelFormalCoachDecision\(\)[\s\S]*setDecisionPhase\('idle'\)/,
    )
    expect(decisionDirector).toContain('function resumeFrozenMatchPlayers(finished)')
    expect(decisionDirector).toContain('function emergencyDecisionCleanup(finished)')
    expect(decisionDirector).toContain('function ensureContinuousMatchRecovery(finished)')
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

  it('rejects stale goalkeeper possession before every kickoff', () => {
    expect(standaloneRuntime).toContain('function clearInvalidKickoffPossession(game)')
    expect(standaloneRuntime).toMatch(
      /"signal:pitch\.Pitch\.states\.Kickoff\.onEnter": function \(game\) \{\s*resetKickoffParticipants\(game, "enter"\)/,
    )
    expect(standaloneRuntime).toContain('carrier.isGoalkeeper')
    expect(standaloneRuntime).toContain('startingTeam && carrier.team !== startingTeam')
    expect(standaloneRuntime).toContain('function resetKickoffParticipants(game, reason)')
    expect(standaloneRuntime).toContain('function recoverStalledKickoff(game)')
    expect(standaloneRuntime).toContain('player.states.change(playerStates.ReturnHome)')
    expect(standaloneRuntime).toContain('resetKickoffParticipants(game, "enter")')
    expect(standaloneRuntime).toContain('game.__happySeedKickoffRecovery = null')
    expect(standaloneRuntime).toContain('ball.owner = null')
    expect(standaloneRuntime).toContain('ball.inHands = null')
    expect(standaloneRuntime).toContain('ball.lastTouch === carrier')
    expect(standaloneRuntime).not.toMatch(/\.hasBall\s*=/)
    expect(standaloneRuntime).toContain('ball.placeAtPosition(centerX, centerY')
    expect(standaloneRuntime).toMatch(
      /runtimeStateName\(mode\.game\) === "Kickoff"[\s\S]*recoverStalledKickoff\(mode\.game\)/,
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

  it('starts interactive-space coach matches zoomed out without changing player mode', () => {
    expect(runtimeService).toContain('window.__happySeedInteractiveSpace = Boolean(__DOUYIN_BUILD__)')
    expect(runtimeService).toContain(
      'else if (__DOUYIN_BUILD__ && !options.playerMode && !options.technicalLab) setZoom(0.68)',
    )
    expect(standaloneRuntime).toContain(
      'return window.__happySeedInteractiveSpace && !window.__acPlay ? 0.68 : 1',
    )
    expect(standaloneRuntime).toContain(
      'return window.__happySeedInteractiveSpace && !window.__acPlay ? 0.48 : 0.8',
    )
    expect(standaloneRuntime).toContain('window.__matchZoomMul = defaultZoomMultiplier()')
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

  it('forces a coach-mode goalkeeper to distribute a held save instead of freezing', () => {
    expect(standaloneRuntime).toContain('function recoverStalledGoalkeeperDistribution(game, goalkeeper)')
    expect(standaloneRuntime).toContain('now - watch.startedAt < 2800')
    expect(standaloneRuntime).toContain('playerStates.AIGoalkeeperPutBallBackInPlay')
    expect(standaloneRuntime).toContain('playerStates.AIGoalkeeperReturnHome')
    expect(standaloneRuntime).toContain('game.__happySeedGoalkeeperHoldWatch = null')
    expect(standaloneRuntime).toContain('if (!window.__acPlay)')
    expect(standaloneRuntime).toContain('recoverStalledGoalkeeperDistribution(game, goalkeeper)')
  })

  it('wakes the whole match when goalkeeper possession remains held past the watchdog', () => {
    const helperStart = standaloneRuntime.indexOf(
      'function recoverStalledGoalkeeperDistribution(game, goalkeeper)',
    )
    const helperEnd = standaloneRuntime.indexOf(
      'function enforceGoalkeeperControlledBallSafety(game)',
      helperStart,
    )
    const helperSource = standaloneRuntime.slice(helperStart, helperEnd)
    const stateChanges = []
    const keeper = {
      isGoalkeeper: true,
      static: true,
      passing: true,
      team: { inControl: true },
      states: { change(next) { stateChanges.push(`keeper:${next}`) } },
    }
    const teammate = {
      isGoalkeeper: false,
      static: true,
      passing: true,
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
        ball: { inHands: keeper, owner: keeper },
        ballOutOfPlay: false,
        players: [keeper, teammate],
        states: { change(next) { stateChanges.push(`pitch:${next}`) } },
        timeScale,
      },
    }
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
      runtime(name) {
        if (name === 'pitch') return { Pitch: { states: { Match: 'Match' } } }
        if (name === 'players/global') return { forceAI() {} }
        return {
          AIGoalkeeperPutBallBackInPlay: 'AIGoalkeeperPutBallBackInPlay',
          AIGoalkeeperReturnHome: 'AIGoalkeeperReturnHome',
          AIAttack: 'AIAttack',
          AIDefend: 'AIDefend',
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
      'keeper:AIGoalkeeperPutBallBackInPlay',
      'teammate:AIAttack',
    ])
    expect(keeper).toMatchObject({ static: false, passing: false })
    expect(teammate).toMatchObject({ static: false, passing: false })
    expect(context.document.body.dataset.goalkeeperDistributionRecovery).toBe('1')
  })

  it('loads the interactive-space Runtime once from one ordered static bundle', () => {
    expect(interactiveBuilder).not.toContain(
      '<script src="./match-runtime-min/__data-bundle.js"></script>',
    )
    expect(interactiveBuilder).not.toContain(
      '<script src="./match-runtime-min/__dirlist.js"></script>',
    )
    expect(interactiveBuilder).toContain(
      '<script defer src="./runtime-data-a.js"></script>',
    )
    expect(interactiveBuilder).toContain('<script defer src="./runtime-data-b.js"></script>')
    expect(interactiveBuilder).toContain('<script defer src="./app-bundle.js"></script>')
    expect(interactiveBuilder).toContain('function buildPlatformScriptShards()')
    expect(interactiveBuilder).toContain('Platform script shard exceeds 3 MiB')
    expect(interactiveBuilder).toContain('function sanitizePackageAssetPaths()')
    expect(interactiveBuilder).toContain('CSP-unsafe Runtime compilers remain')
    expect(runtimeService).toContain('const SCRIPT_PATHS = __DOUYIN_BUILD__ ? [] : [')
    expect(runtimeService).toContain('互动空间比赛引擎静态包未完成注入')
    expect(runtimeService).not.toMatch(
      /if \(__DOUYIN_BUILD__\)[\s\S]{0,800}loadScript\('__data-bundle\.js'\)/,
    )
    expect(mainApp).toContain('ready: IS_TEST_RUNTIME || IS_DOUYIN_DEMO')
    expect(mainApp).toMatch(
      /if \(IS_TEST_RUNTIME \|\| IS_DOUYIN_DEMO\) return undefined[\s\S]*preloadAssetUrls\(getCriticalStartupAssets/,
    )
  })

  it('packages interactive-space archives with UTF-8 path metadata', () => {
    expect(interactiveBuilder).toContain("import { zipSync } from 'fflate'")
    expect(interactiveBuilder).toContain('function writeUtf8Zip(')
    expect(interactiveBuilder).toContain('writeUtf8Zip(deliveryDirectory, zipPath)')
  })

  it('packages four exact kits and tints one shared kit for every other opponent', () => {
    expect(interactiveBuilder).not.toMatch(/const pixelWhitelist[\s\S]*?'kits'/)
    expect(interactiveBuilder).toContain('scripts/build-shared-runtime-kit.py')
    expect(interactiveBuilder).toContain("firstReport.scheduleAssets.kitTeams !== 5")
    expect(standaloneRuntime).toContain('function kitSlotTint(visual, slot)')
    expect(standaloneRuntime).toContain('if (!visual.sharedKit || !visual.palette) return 16777215')
    expect(standaloneRuntime).toContain('sharedKitTint(visual.palette.shorts')
    expect(standaloneRuntime).toContain('sharedKitTint(visual.palette.socks')
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
