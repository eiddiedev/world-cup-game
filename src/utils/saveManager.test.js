/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SAVE_SCHEMA_VERSION,
  createNewRun,
  loadSaveData,
} from './saveManager.js'
import { getStorageKey } from '../config/runtime.js'

describe('champion journey save migration', () => {
  beforeEach(() => {
    const store = new Map()
    const localStorageMock = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      removeItem: vi.fn((key) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    }
    vi.stubGlobal('localStorage', localStorageMock)
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
  })

  it('creates versioned journey runs with the three starter items', () => {
    const run = createNewRun('france')
    expect(run.gameMode).toBe('journey')
    expect(run.itemInventory).toMatchObject({
      'sports-drink': 1,
      'football-boots': 1,
      'tactical-board': 1,
    })
  })

  it('prefers the legacy player save and retains the coach save as backup', () => {
    localStorage.setItem(getStorageKey(), JSON.stringify({
      currentRun: { teamId: 'brazil', gameMode: 'coach', stage: 'lineup' },
      playerModeRun: { teamId: 'france', gameMode: 'player', stage: 'match' },
    }))
    const migrated = loadSaveData()
    expect(migrated.saveVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(migrated.currentRun).toMatchObject({ teamId: 'france', gameMode: 'journey', stage: 'match' })
    expect(migrated.journeyRun).toEqual(migrated.currentRun)
    expect(migrated.legacyCoachBackup).toMatchObject({ teamId: 'brazil', gameMode: 'coach' })
  })

  it('migrates a lone coach save and skips its retired logistics route', () => {
    localStorage.setItem(getStorageKey(), JSON.stringify({
      currentRun: { teamId: 'spain', gameMode: 'coach', stage: 'logistics' },
    }))
    const migrated = loadSaveData()
    expect(migrated.currentRun).toMatchObject({ teamId: 'spain', gameMode: 'journey', stage: 'tournament' })
    expect(migrated.legacyCoachBackup).toMatchObject({ teamId: 'spain', gameMode: 'coach' })
  })
})
