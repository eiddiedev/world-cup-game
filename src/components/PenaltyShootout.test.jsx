/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  prepare: vi.fn(() => Promise.resolve()),
  execute: vi.fn(() => ({
    settled: Promise.resolve({ resolution: {} }),
    completed: Promise.resolve({ runtime: {} }),
  })),
  cancel: vi.fn(),
  configurePresentation: vi.fn(),
  clearPresentation: vi.fn(),
  createDecision: vi.fn((_index, options) => ({
    id: `shootout-${options.side}`,
    runtimeContext: options.runtimeContext,
    choices: [
      {
        id: 'penalty_left',
        label: '射向左下角',
        desc: '冷静推射球门左下角，角度刁钻。',
        possible_outcomes: ['goal_placement', 'saved_placement', 'miss_post'],
      },
      {
        id: 'penalty_center',
        label: '勺子点球',
        desc: '轻挑中路，赌门将会自己扑向一边。',
        possible_outcomes: ['goal_panenka', 'saved_panenka', 'miss_panenka'],
      },
      {
        id: 'penalty_right',
        label: '射向右下角',
        desc: '瞄准球门右侧，门将的反方向。',
        possible_outcomes: ['goal_power', 'saved_power', 'miss_wide_power'],
      },
    ],
  })),
}))

vi.mock('../services/happySeedMatchRuntime.js', () => ({
  captureFormalMatchRuntimeMoment: () => ({
    ownerRuntimeActorId: 'red-fw-runtime',
    attackingSide: 'red',
    attackDirection: 1,
    ball: { normalized: [0.5, 0.5] },
    actorPositions: [
      { runtimeActorId: 'red-fw-runtime', normalized: [0.5, 0.5] },
      { runtimeActorId: 'red-gk-runtime', normalized: [0.05, 0.5] },
      { runtimeActorId: 'blue-fw-runtime', normalized: [0.5, 0.5] },
      { runtimeActorId: 'blue-gk-runtime', normalized: [0.95, 0.5] },
    ],
  }),
  getRuntimeActorSnapshot: () => ({
    actors: [
      { runtimeActorId: 'red-fw-runtime', playerId: 'fw', side: 'red', state: { onPitch: true } },
      { runtimeActorId: 'red-gk-runtime', playerId: 'gk', side: 'red', isGoalkeeper: true, state: { onPitch: true } },
      { runtimeActorId: 'blue-fw-runtime', playerId: 'fw', side: 'blue', state: { onPitch: true } },
      { runtimeActorId: 'blue-gk-runtime', playerId: 'gk', side: 'blue', isGoalkeeper: true, state: { onPitch: true } },
    ],
  }),
  createFormalCoachDecision: runtimeMocks.createDecision,
  prepareFormalCoachDecision: runtimeMocks.prepare,
  executeFormalCoachDecisionChoice: runtimeMocks.execute,
  cancelFormalCoachDecision: runtimeMocks.cancel,
  configureShootoutPresentation: runtimeMocks.configurePresentation,
  clearShootoutPresentation: runtimeMocks.clearPresentation,
  pauseMatch: vi.fn(),
  withDecisionWatchdog: (promise) => promise,
}))

import PenaltyShootout from './PenaltyShootout.jsx'

const lineup = [
  { id: 'gk', name: '门将', position: 'GK', rating: 84, def: 84 },
  { id: 'fw', name: '前锋', position: 'FW', rating: 88, tec: 88, att: 90 },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Runtime 场内点球大战', () => {
  it('直接复用比赛中的 match_penalty 决策及其三个正式选项', async () => {
    const { container } = render(
      <PenaltyShootout
        homeTeam="西班牙"
        awayTeam="法国"
        homeTeamId="spain"
        awayTeamId="france"
        homeLineup={lineup}
        awayLineup={lineup}
        gameMode="coach"
      />,
    )

    expect(screen.getByRole('dialog', { name: '点球大战' }))
      .toHaveAttribute('data-runtime-scene', 'match_penalty')
    expect(await screen.findByRole('button', { name: /射向左下角/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /勺子点球/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /射向右下角/ })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '射门方向' }).querySelectorAll('button')).toHaveLength(3)
    expect(container.querySelector('.engine-goal-target')).not.toBeInTheDocument()
    expect(container.querySelector('img[src*="/shootout/"]')).not.toBeInTheDocument()
    expect(runtimeMocks.prepare).toHaveBeenCalledTimes(1)
    expect(runtimeMocks.createDecision).toHaveBeenCalledWith(0, expect.objectContaining({
      scenarioId: 'match_penalty',
      runtimeContext: 'shootout',
      side: 'red',
    }))
    expect(runtimeMocks.configurePresentation).toHaveBeenCalledWith({
      attackingSide: 'red',
      shooterPlayerId: 'fw',
      goalSide: 'right',
    })
  })

  it('球员模式用横向滑动选择 Runtime 射门方向', async () => {
    render(
      <PenaltyShootout
        homeTeam="阿根廷"
        awayTeam="英格兰"
        homeTeamId="argentina"
        awayTeamId="england"
        homeLineup={lineup}
        awayLineup={lineup}
        gameMode="player"
      />,
    )
    const dialog = screen.getByRole('dialog', { name: '点球大战' })
    await screen.findByText('向射门方向滑动')

    fireEvent.pointerDown(dialog, { pointerId: 1, clientX: 160, clientY: 150 })
    fireEvent.pointerUp(dialog, { pointerId: 1, clientX: 245, clientY: 145 })

    await waitFor(() => expect(runtimeMocks.execute).toHaveBeenCalled())
    expect(runtimeMocks.execute.mock.calls[0][1]).toBe('penalty_right')
    expect(runtimeMocks.execute.mock.calls[0][2]).toMatchObject({ commitRuntimeGoal: false })
  })
})
