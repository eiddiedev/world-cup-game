/* @vitest-environment jsdom */
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  submitPenaltyChoice: vi.fn(() => true),
}))

vi.mock('../services/onlineRoomClient.js', () => ({ onlineRoomClient: client }))
vi.mock('./PenaltyShootout.jsx', () => ({
  default: ({ homeTeam, awayTeam, onlineSession, onComplete }) => (
    <div role="dialog" aria-label="联机点球大战">
      <span>{homeTeam} 对 {awayTeam}</span>
      <span>第 {onlineSession.attemptIndex + 1} 次</span>
      <button type="button" onClick={() => onlineSession.onSubmit({ role: 'shooter' })}>提交方向</button>
      <button type="button" onClick={() => onComplete('home', { homeScore: 5, awayScore: 4, shots: [] })}>完成比赛</button>
    </div>
  ),
}))

import OnlinePenaltyModeScreen from './OnlinePenaltyModeScreen.jsx'

afterEach(cleanup)

describe('online penalty mode screen', () => {
  it('binds the shared shootout visual to room choices and returns to the same room after settlement', () => {
    client.getSnapshot.mockReturnValue({
      room: {
        code: '123456',
        status: 'playing',
        ruleset: 'penalty',
        host: { seatId: 'host', teamId: 'france', formation: '4-3-3', lineupPlayerIds: [] },
        guest: { seatId: 'guest', teamId: 'brazil', formation: '4-3-3', lineupPlayerIds: [] },
        match: {
          id: 'penalty-match-1',
          penalty: { attemptIndex: 0, submitted: {}, shots: [], winner: null },
        },
      },
      ownSeat: { seatId: 'host', teamId: 'france' },
    })
    const updateSaveData = vi.fn()
    const navigateTo = vi.fn()
    const showToast = vi.fn()
    const saveData = {
      currentRun: { gameMode: 'online', teamId: 'france', stage: 'online-penalty' },
      onlineRun: null,
    }

    render(
      <OnlinePenaltyModeScreen
        saveData={saveData}
        updateSaveData={updateSaveData}
        navigateTo={navigateTo}
        showToast={showToast}
      />,
    )

    expect(screen.getByRole('dialog', { name: '联机点球大战' })).toHaveTextContent('法国 对 巴西')
    fireEvent.click(screen.getByRole('button', { name: '提交方向' }))
    expect(client.submitPenaltyChoice).toHaveBeenCalledWith({ role: 'shooter' })

    fireEvent.click(screen.getByRole('button', { name: '完成比赛' }))
    expect(updateSaveData).toHaveBeenCalledWith(expect.objectContaining({
      currentRun: expect.objectContaining({
        stage: 'online-lobby',
        lastMatchResult: expect.objectContaining({ result: 'win', ruleset: 'penalty' }),
      }),
    }))
    expect(showToast).toHaveBeenCalledWith('你赢得了点球大战！')
    expect(navigateTo).toHaveBeenCalledWith('online-lobby', { gameMode: 'online' })
  })
})
