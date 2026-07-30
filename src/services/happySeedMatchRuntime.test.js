/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cancelFormalCoachDecision,
  clearShootoutPresentation,
  configureShootoutPresentation,
  retainMatchRuntime,
  scheduleMatchRuntimeShutdown,
  shutdownMatchRuntime,
} from './happySeedMatchRuntime.js'

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
    delete window.__matchGame
    delete window.__happySeedResetMatchLifecycle
    document.querySelectorAll('body > canvas').forEach((canvas) => canvas.remove())
  })

  it('cancels a same-commit release and keeps the renderer visible', async () => {
    const canvas = document.createElement('canvas')
    canvas.style.display = 'none'
    const pause = vi.fn()
    const resize = vi.fn()
    window.__matchGame = { renderer: { view: canvas }, pause, resize }

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
})
