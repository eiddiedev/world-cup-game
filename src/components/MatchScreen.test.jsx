/* @vitest-environment jsdom */
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./HappySeedMatchBroadcast.jsx', () => ({
  HappySeedMatchBroadcast: ({ onMatchComplete }) => (
    <button
      type="button"
      onClick={() => onMatchComplete({
        report: {
          matchId: 'formal-knockout-1',
          completedAt: '2026-07-14T09:00:00.000Z',
          teamName: '法国',
          opponent: '巴西',
          homeScore: 1,
          awayScore: 1,
          result: 'draw',
        },
        actorSnapshot: {
          sides: {
            blue: { teamId: 'brazil', formation: '4-2-3-1' },
          },
          actors: [
            {
              playerId: 'france-gk', name: '法国门将', number: 1,
              side: 'red', assignedPosition: 'GK', state: { onPitch: true },
            },
            {
              playerId: 'brazil-gk', name: '巴西门将', number: 1,
              side: 'blue', assignedPosition: 'GK', state: { onPitch: true },
            },
          ],
        },
      })}
    >
      模拟终场
    </button>
  ),
}))

vi.mock('./PenaltyShootout.jsx', () => ({
  default: ({ onComplete }) => (
    <button type="button" onClick={() => onComplete('home')}>模拟本方点球晋级</button>
  ),
}))

vi.mock('../utils/formalMatchRules.js', () => ({
  buildFormalMatchRuleReport: () => ({
    playerStates: {},
    injuredPlayerIds: [],
    redCardedPlayerIds: [],
  }),
  settleRunMatchRules: (run) => run,
}))

vi.mock('../utils/audioManager.js', () => ({
  audioManager: {
    playSound: vi.fn(),
    playWin: vi.fn(),
    playLose: vi.fn(),
  },
}))

import MatchScreen from './MatchScreen.jsx'

afterEach(cleanup)

describe('MatchScreen 正式终场链', () => {
  it('keeps a knockout draw in the local shootout before persisting post-match', () => {
    const updateSaveData = vi.fn()
    const navigateTo = vi.fn()
    render(<MatchScreen
      saveData={{
        currentRun: {
          teamId: 'france',
          formation: '4-3-3',
          matchIndex: 4,
          matchResults: [],
          isKnockoutMatch: true,
        },
      }}
      updateSaveData={updateSaveData}
      navigateTo={navigateTo}
    />)

    fireEvent.click(screen.getByRole('button', { name: '模拟终场' }))
    expect(screen.getByRole('button', { name: '模拟本方点球晋级' })).toBeInTheDocument()
    expect(updateSaveData).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '模拟本方点球晋级' }))
    expect(updateSaveData).toHaveBeenCalledWith(expect.objectContaining({
      currentRun: expect.objectContaining({
        stage: 'post-match',
        lastMatchResult: expect.objectContaining({
          result: 'win',
          homeScore: 2,
          awayScore: 1,
          shootout: {
            winner: 'home',
            regulationScore: [1, 1],
          },
        }),
      }),
    }))
    expect(navigateTo).toHaveBeenCalledWith('post-match')
  })
})
