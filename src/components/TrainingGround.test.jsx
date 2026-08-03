/* @vitest-environment jsdom */
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  configureTrainingRuntime: vi.fn(({ defender = false } = {}) => ({
    playerIndex: 6,
    defenderIndex: 17,
    visibleIndices: defender ? [0, 6, 11, 17] : [0, 6, 11],
    pitchPlayerCount: defender ? 4 : 3,
    state: 'Practice',
  })),
  shutdownMatchRuntime: vi.fn(),
}))

vi.mock('../services/happySeedMatchRuntime.js', () => runtimeMocks)
vi.mock('./HappySeedMatchBroadcast.jsx', () => ({
  HappySeedMatchBroadcast: () => <div data-testid="training-runtime" />,
}))
vi.mock('../utils/audioManager.js', () => ({
  audioManager: {
    stadiumEnabled: true,
    soundEnabled: false,
    playSound: vi.fn(),
    stopCrowdAmbient: vi.fn(),
    startCrowdAmbient: vi.fn(),
  },
}))

import TrainingGround from './TrainingGround.jsx'
import { audioManager } from '../utils/audioManager.js'

function makeGame() {
  const sprites = Array.from({ length: 22 }, () => ({ visible: true, alpha: 1 }))
  const originalRender = vi.fn()
  return {
    renderer: {
      render: originalRender,
      view: document.createElement('canvas'),
    },
    stadium: {
      players: sprites,
      _happySeedActorEntries: [],
    },
    allPlayers: Array.from({ length: 22 }, (_, index) => ({ id: index })),
    pitch: {
      width: 100,
      height: 60,
      states: { current: { name: 'Practice' } },
      ball: { position: { x: 45, y: 30 } },
    },
    originalRender,
  }
}

describe('TrainingGround 自由训练模式', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    window.__matchGame = makeGame()
    window.__happySeedConfigureTraining = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    delete window.__matchGame
    delete window.__happySeedConfigureTraining
  })

  it('starts with only the player and two goalkeepers, then toggles one defender', () => {
    render(<TrainingGround
      saveData={{ currentRun: { teamId: 'france', gameMode: 'player' } }}
      navigateTo={vi.fn()}
      updateSaveData={vi.fn()}
    />)

    act(() => vi.advanceTimersByTime(60))
    expect(runtimeMocks.configureTrainingRuntime).toHaveBeenCalledWith({
      defender: false,
      initial: true,
      resetBall: true,
    })

    act(() => window.__matchGame.renderer.render({}))
    const visible = window.__matchGame.stadium.players
      .map((sprite, index) => sprite.visible ? index : null)
      .filter((index) => index !== null)
    expect(visible).toEqual([0, 6, 11])

    fireEvent.click(screen.getByRole('button', { name: '添加防守' }))
    expect(runtimeMocks.configureTrainingRuntime).toHaveBeenLastCalledWith({ defender: true })
    expect(screen.getByRole('button', { name: '移除防守' })).toBeInTheDocument()

    act(() => window.__matchGame.renderer.render({}))
    expect(window.__matchGame.stadium.players[17].visible).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '移除防守' }))
    expect(runtimeMocks.configureTrainingRuntime).toHaveBeenLastCalledWith({ defender: false })
    expect(screen.getByRole('button', { name: '添加防守' })).toBeInTheDocument()
  })

  it('cancels formal dead-ball restarts and returns the ball to the player', () => {
    render(<TrainingGround
      saveData={{ currentRun: { teamId: 'france', gameMode: 'player' } }}
      navigateTo={vi.fn()}
      updateSaveData={vi.fn()}
    />)
    act(() => vi.advanceTimersByTime(60))

    window.__matchGame.pitch.states.current.name = 'ThrowIn'
    act(() => {
      window.__matchGame.renderer.render({})
      vi.runOnlyPendingTimers()
    })

    expect(runtimeMocks.configureTrainingRuntime).toHaveBeenLastCalledWith({
      defender: false,
      resetBall: true,
    })
    expect(screen.getByRole('status')).toHaveTextContent('足球出界，已回到脚下')
  })

  it('plays the goal-frame sound immediately when training hits a post or crossbar', () => {
    render(<TrainingGround
      saveData={{ currentRun: { teamId: 'france', gameMode: 'player' } }}
      navigateTo={vi.fn()}
      updateSaveData={vi.fn()}
    />)

    act(() => {
      window.dispatchEvent(new CustomEvent('ab-training-goal-frame-hit', {
        detail: { id: 'training-post-1', type: 'post-hit' },
      }))
    })

    expect(audioManager.playSound).toHaveBeenCalledWith('postHit')
  })

  it('shuts down training before navigating through the tournament schedule', () => {
    const navigateTo = vi.fn()
    const updateSaveData = vi.fn()
    const saveData = {
      currentRun: { teamId: 'france', gameMode: 'player', trainingCompleted: false },
    }
    render(<TrainingGround
      saveData={saveData}
      navigateTo={navigateTo}
      updateSaveData={updateSaveData}
    />)

    fireEvent.click(screen.getByRole('button', { name: '开始比赛' }))

    expect(updateSaveData).toHaveBeenCalledWith({
      ...saveData,
      currentRun: { ...saveData.currentRun, trainingCompleted: true },
    })
    expect(runtimeMocks.shutdownMatchRuntime).toHaveBeenCalledOnce()
    expect(navigateTo).toHaveBeenCalledWith('tournament')
  })
})
