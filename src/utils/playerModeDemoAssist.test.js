import { describe, expect, it } from 'vitest'
import {
  PLAYER_MODE_DEMO_ASSIST,
  getPlayerModeDemoAssistProfile,
  resolvePlayerModeDifficulty,
} from './playerModeDemoAssist.js'

describe('player mode demo assist profile', () => {
  it('keeps the current accessible pace for easy matches', () => {
    expect(getPlayerModeDemoAssistProfile(false)).toBeNull()
    expect(getPlayerModeDemoAssistProfile(true, 'easy')).toMatchObject({
      schemaVersion: 'player-mode-demo-assist-v3',
      difficulty: 'easy',
      speed: 0.85,
      ai: 0,
      enabled: true,
      receptionGraceMs: 500,
      activePressers: 1,
      coverPlayers: 1,
      defensiveWidth: 1.06,
      coverMinimumDistance: 5.5,
      shapeRefreshMs: 180,
    })
  })

  it('restores native pace for medium and accelerates hard matches', () => {
    expect(getPlayerModeDemoAssistProfile(true, 'medium')).toMatchObject({
      difficulty: 'medium',
      speed: 1,
      ai: 1,
      enabled: false,
    })
    expect(getPlayerModeDemoAssistProfile(true, 'hard')).toMatchObject({
      difficulty: 'hard',
      speed: 1.08,
      ai: 2,
      enabled: false,
    })
  })

  it('derives difficulty from the starting-rating gap', () => {
    const team = (ratings, baseRating) => ({
      players: ratings.map((rating) => ({ rating })),
      ...(baseRating == null ? {} : { baseRating }),
    })
    expect(resolvePlayerModeDifficulty(team([86, 84, 82]), team([], 68))).toBe('easy')
    expect(resolvePlayerModeDifficulty(team([78, 77, 76]), team([], 74))).toBe('medium')
    expect(resolvePlayerModeDifficulty(team([68, 67, 66]), team([], 80))).toBe('hard')
  })

  it('returns a copy so one match cannot mutate the shared defaults', () => {
    const profile = getPlayerModeDemoAssistProfile(true, 'easy')
    profile.speed = 1
    expect(PLAYER_MODE_DEMO_ASSIST.speed).toBe(0.85)
  })
})
