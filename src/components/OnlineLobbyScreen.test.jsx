/* @vitest-environment jsdom */
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  connect: vi.fn(() => Promise.resolve()),
  createRoom: vi.fn(() => Promise.resolve(true)),
  joinRoom: vi.fn(() => Promise.resolve(true)),
  selectTeam: vi.fn(() => true),
  lockLineup: vi.fn(() => true),
  setReady: vi.fn(() => true),
  requestRematch: vi.fn(() => true),
}))

vi.mock('../services/onlineRoomClient.js', () => ({ onlineRoomClient: client }))

import OnlineLobbyScreen from './OnlineLobbyScreen.jsx'

const baseSave = { currentRun: null, onlineRun: null }

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  client.subscribe.mockReturnValue(() => {})
  client.connect.mockResolvedValue(true)
  client.createRoom.mockResolvedValue(true)
  client.getSnapshot.mockReturnValue({
    configured: true,
    connectionState: 'open',
    room: null,
    ownSeat: null,
  })
})

describe('online lobby match modes', () => {
  it('creates penalty shootout as the third independent online mode', async () => {
    render(
      <OnlineLobbyScreen
        saveData={baseSave}
        updateSaveData={vi.fn()}
        navigateTo={vi.fn()}
        showToast={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '常规对战' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '无规则乱斗' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '点球大战' }))
    fireEvent.click(screen.getByRole('button', { name: '生成六位房间码' }))

    await waitFor(() => expect(client.createRoom).toHaveBeenCalledWith('penalty'))
  })

  it('auto-locks a complete penalty lineup without routing through formation setup', () => {
    const navigateTo = vi.fn()
    const updateSaveData = vi.fn()
    client.getSnapshot.mockReturnValue({
      configured: true,
      connectionState: 'open',
      room: {
        code: '123456',
        status: 'lobby',
        ruleset: 'penalty',
        host: { seatId: 'host', connected: true, lineupLocked: false, ready: false },
        guest: null,
      },
      ownSeat: { seatId: 'host', connected: true, lineupLocked: false, ready: false },
    })

    render(
      <OnlineLobbyScreen
        saveData={baseSave}
        updateSaveData={updateSaveData}
        navigateTo={navigateTo}
        showToast={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /法国/ }))
    expect(client.selectTeam).toHaveBeenCalledWith('france', 'penalty')
    expect(client.lockLineup).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.any(String),
    )
    expect(client.lockLineup.mock.calls[0][1]).toHaveLength(11)
    expect(navigateTo).not.toHaveBeenCalledWith('lineup', expect.anything())
    expect(updateSaveData).toHaveBeenCalled()
  })
})
