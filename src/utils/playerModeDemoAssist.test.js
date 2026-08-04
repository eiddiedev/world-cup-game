import { describe, expect, it } from 'vitest'
import {
  PLAYER_MODE_DEMO_ASSIST,
  getPlayerModeDemoAssistProfile,
} from './playerModeDemoAssist.js'

describe('player mode demo assist profile', () => {
  it('slows only player mode and keeps the agreed accessibility limits', () => {
    expect(getPlayerModeDemoAssistProfile(false)).toBeNull()
    expect(getPlayerModeDemoAssistProfile(true)).toMatchObject({
      schemaVersion: 'player-mode-demo-assist-v1',
      speed: 0.85,
      receptionGraceMs: 500,
      activePressers: 1,
      coverPlayers: 1,
      defensiveWidth: 1.12,
    })
  })

  it('returns a copy so one match cannot mutate the shared defaults', () => {
    const profile = getPlayerModeDemoAssistProfile(true)
    profile.speed = 1
    expect(PLAYER_MODE_DEMO_ASSIST.speed).toBe(0.85)
  })
})
