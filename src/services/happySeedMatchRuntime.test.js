/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cancelFormalCoachDecision,
  clearShootoutPresentation,
  configureShootoutPresentation,
  emitFormalDecisionRuntimeConsequences,
  pauseMatch,
  retainMatchRuntime,
  resumeMatch,
  resolveDecisionPenaltySides,
  scheduleMatchRuntimeShutdown,
  shutdownMatchRuntime,
  waitForStadiumMasterReady,
} from './happySeedMatchRuntime.js'

describe('decision penalty direction', () => {
  afterEach(() => {
    delete window.__happySeedStadiumScene
    delete window.__happySeedEmitRuntimeEvent
  })

  it('awards defensive-decision penalties to the opponent', () => {
    expect(resolveDecisionPenaltySides({ attackingSide: 'blue' })).toEqual({
      awardedSide: 'blue',
      offendingSide: 'red',
    })
  })

  it('awards attacking handball penalties to the user team', () => {
    expect(resolveDecisionPenaltySides({ attackingSide: 'red' })).toEqual({
      awardedSide: 'red',
      offendingSide: 'blue',
    })
  })

  it('does not invent a home penalty when direction data is missing', () => {
    expect(resolveDecisionPenaltySides({})).toBeNull()
  })

  it('emits a defensive foul as an opponent penalty against the user team', () => {
    const emitted = []
    window.__happySeedEmitRuntimeEvent = vi.fn((type, runtimeActorId, payload) => {
      emitted.push({ type, runtimeActorId, payload })
      return `runtime-${emitted.length}`
    })
    const primary = { runtimeActorId: 'red-defender', side: 'red' }
    const opponent = { runtimeActorId: 'blue-attacker', side: 'blue' }

    emitFormalDecisionRuntimeConsequences({
      scenarioId: 'penalty_area_foul_risk',
      attackingSide: 'blue',
      mode: 'freeze-live',
      sourceEvent: { id: 'blue-attack-1', side: 'blue' },
      actors: { primary, opponent },
    }, 'slide_tackle', 'red_card_penalty')

    expect(emitted[0]).toMatchObject({
      type: 'penalty',
      runtimeActorId: 'red-defender',
      payload: {
        side: 'red',
        detail: { awardedSide: 'blue' },
      },
    })
  })

  it('emits an attacking handball claim as a user penalty against the opponent', () => {
    const emitted = []
    window.__happySeedEmitRuntimeEvent = vi.fn((type, runtimeActorId, payload) => {
      emitted.push({ type, runtimeActorId, payload })
      return `runtime-${emitted.length}`
    })
    const primary = { runtimeActorId: 'red-attacker', side: 'red' }
    const opponent = { runtimeActorId: 'blue-defender', side: 'blue' }

    emitFormalDecisionRuntimeConsequences({
      scenarioId: 'handball_penalty_claim',
      attackingSide: 'red',
      mode: 'freeze-incident',
      sourceEvent: { id: 'red-shot-1', side: 'red' },
      actors: { primary, opponent },
    }, 'calm_handball_claim', 'penalty_awarded')

    expect(emitted.find((event) => event.type === 'penalty')).toMatchObject({
      runtimeActorId: 'blue-defender',
      payload: {
        side: 'blue',
        detail: { awardedSide: 'red' },
      },
    })
  })
})

describe('formal decision recovery', () => {
  afterEach(() => {
    delete window.__happySeedDecisionDirectorV3
  })

  it('runs the idempotent recovery path when cancellation finds an already half-cleared director', () => {
    const cancel = vi.fn(() => false)
    const recover = vi.fn(() => true)
    window.__happySeedDecisionDirectorV3 = { cancel, recover }

    expect(cancelFormalCoachDecision()).toBe(true)
    expect(cancel).toHaveBeenCalledOnce()
    expect(recover).toHaveBeenCalledOnce()
  })
})

function actorEntry({ side, playerId, isGoalkeeper = false }) {
  return {
    actor: {
      side,
      playerId,
      isGoalkeeper,
      state: { onPitch: true },
    },
    renderer: { visible: true },
    label: { visible: true },
    eventRing: { visible: true },
  }
}

describe('legacy shootout presentation fallback', () => {
  afterEach(() => {
    delete window.__happySeedShootoutPresentation
    delete window.__happySeedStadiumScene
    delete window.__matchZoom
    delete window.__matchGame
  })

  it('keeps only the current shooter and opposing goalkeeper visible', () => {
    const entries = [
      actorEntry({ side: 'red', playerId: 'red-shooter' }),
      actorEntry({ side: 'red', playerId: 'red-keeper', isGoalkeeper: true }),
      actorEntry({ side: 'blue', playerId: 'blue-player' }),
      actorEntry({ side: 'blue', playerId: 'blue-keeper', isGoalkeeper: true }),
    ]
    const shadowChildren = Array.from({ length: 9 }, () => ({ visible: true }))
    const stadium = {
      players: entries.map((entry) => entry.renderer),
      shadows: { visible: true, autoShadows: { children: shadowChildren } },
      frame: vi.fn(),
    }
    stadium._happySeedActorEntries = entries
    window.__matchGame = { stadium, pitch: { width: 100, height: 60 } }
    window.__happySeedStadiumScene = {
      focusAt: vi.fn(),
      followBall: vi.fn(),
      getSnapshot: vi.fn(() => ({ cameraMode: 'event-ball' })),
    }
    window.__matchZoom = { get: vi.fn(() => 1), set: vi.fn(), reset: vi.fn() }

    const snapshot = configureShootoutPresentation({
      attackingSide: 'red',
      shooterPlayerId: 'red-shooter',
    })

    expect(snapshot.visibleCount).toBe(2)
    expect(entries.filter((entry) => entry.renderer.visible)).toEqual([entries[0], entries[3]])
    expect(stadium.shadows.visible).toBe(false)
    expect(shadowChildren.every((shadow) => shadow.visible)).toBe(true)
    expect(snapshot.cameraMode).toBe('event-ball')
    expect(window.__happySeedStadiumScene.focusAt).not.toHaveBeenCalled()
    expect(window.__matchZoom.set).not.toHaveBeenCalled()

    entries.forEach((entry) => { entry.renderer.visible = true })
    stadium.frame()
    expect(entries.filter((entry) => entry.renderer.visible)).toEqual([entries[0], entries[3]])

    expect(clearShootoutPresentation()).toBe(true)
    expect(entries.every((entry) => entry.renderer.visible)).toBe(true)
    expect(stadium.shadows.visible).toBe(true)
    expect(shadowChildren.every((shadow) => shadow.visible)).toBe(true)
    expect(window.__happySeedStadiumScene.followBall).not.toHaveBeenCalled()
    expect(window.__matchZoom.reset).not.toHaveBeenCalled()
  })
})

describe('match Runtime canvas lifecycle', () => {
  afterEach(() => {
    retainMatchRuntime()
    delete window.__happySeedStadiumScene
    delete window.__matchGame
    delete window.__happySeedResetMatchLifecycle
    document.querySelectorAll('body > canvas').forEach((canvas) => canvas.remove())
  })

  it('keeps a late-created prewarm canvas suppressed until a playable screen claims it', () => {
    retainMatchRuntime({ visible: false })

    expect(document.body.dataset.matchRuntimeCanvas).toBe('hidden')

    const canvas = document.createElement('canvas')
    document.body.prepend(canvas)
    window.__matchGame = { renderer: { view: canvas }, resize: vi.fn() }

    retainMatchRuntime()

    expect(document.body.dataset.matchRuntimeCanvas).toBe('hidden')
    expect(canvas.style.display).toBe('none')

    window.__happySeedStadiumScene = { getSnapshot: () => ({ ready: true }) }
    retainMatchRuntime()

    expect(document.body.dataset.matchRuntimeCanvas).toBeUndefined()
    expect(canvas.style.display).toBe('')
    expect(canvas.style.visibility).toBe('')
    expect(canvas.hasAttribute('aria-hidden')).toBe(false)
  })

  it('cancels a same-commit release and keeps the renderer visible', async () => {
    const canvas = document.createElement('canvas')
    canvas.style.display = 'none'
    const pause = vi.fn()
    const resize = vi.fn()
    window.__matchGame = { renderer: { view: canvas }, pause, resize }
    window.__happySeedStadiumScene = { getSnapshot: () => ({ ready: true }) }

    retainMatchRuntime()
    scheduleMatchRuntimeShutdown()
    retainMatchRuntime()
    await Promise.resolve()

    expect(canvas.isConnected).toBe(true)
    expect(canvas.style.display).toBe('')
    expect(pause).not.toHaveBeenCalled()
  })

  it('hides and pauses the renderer after a real release while keeping the loaded engine reusable', async () => {
    const canvas = document.createElement('canvas')
    const pause = vi.fn()
    window.__matchGame = {
      renderer: { view: canvas },
      pause,
      pitch: {},
      stadium: { players: [] },
    }
    window.__happySeedStadiumScene = { getSnapshot: () => ({ ready: true }) }

    retainMatchRuntime()
    scheduleMatchRuntimeShutdown()
    await Promise.resolve()

    expect(pause).toHaveBeenCalledOnce()
    expect(canvas.style.display).toBe('none')
    expect(window.__matchGame).toBeTruthy()
  })

  it('clears shared decision and goal holds before hiding a reusable renderer', () => {
    const canvas = document.createElement('canvas')
    const lifecycleReset = vi.fn(() => ({ timeScale: 1, directorPhase: 'idle' }))
    const pause = vi.fn()
    window.__happySeedResetMatchLifecycle = lifecycleReset
    window.__matchGame = {
      renderer: { view: canvas },
      pause,
      pitch: {},
      stadium: { players: [] },
    }

    shutdownMatchRuntime()

    expect(lifecycleReset).toHaveBeenCalledWith('react-shutdown')
    expect(pause).toHaveBeenCalledOnce()
    expect(canvas.style.display).toBe('none')
  })

  it('marks only an explicit UI pause as intentional and clears it on resume', () => {
    const pause = vi.fn()
    const resume = vi.fn()
    const pitchPause = vi.fn()
    const pitchResume = vi.fn()
    const stadiumPause = vi.fn()
    const stadiumResume = vi.fn()
    window.__matchGame = {
      pause,
      resume,
      pitch: { pause: pitchPause, resume: pitchResume },
      stadium: { pause: stadiumPause, resume: stadiumResume },
    }

    expect(pauseMatch()).toBe(true)
    expect(window.__matchGame.__happySeedUiPaused).toBe(true)
    expect(pause).toHaveBeenCalledOnce()
    expect(pitchPause).toHaveBeenCalledOnce()
    expect(stadiumPause).toHaveBeenCalledOnce()

    expect(resumeMatch()).toBe(true)
    expect(window.__matchGame.__happySeedUiPaused).toBe(false)
    expect(resume).toHaveBeenCalledOnce()
    expect(pitchResume).toHaveBeenCalledOnce()
    expect(stadiumResume).toHaveBeenCalledOnce()
  })

  it('waits for the rendered master before resolving the reveal gate', async () => {
    let ready = false
    window.__happySeedStadiumScene = { getSnapshot: () => ({ ready }) }

    const pending = waitForStadiumMasterReady(100)
    ready = true
    window.dispatchEvent(new CustomEvent('ab-stadium-slice-ready'))

    await expect(pending).resolves.toBe(true)
  })
})
