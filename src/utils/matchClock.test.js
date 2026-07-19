import { describe, expect, it } from 'vitest'
import {
  calculateStoppageMinutes,
  formatMatchClock,
  getStoppageInputs,
  runtimeMatchMinute,
} from './matchClock.js'

describe('正式比赛分钟换算', () => {
  it('maps the three-minute Runtime half and full-time ticks to 45 and 90', () => {
    expect(runtimeMatchMinute(2700, 3)).toBe(45)
    expect(runtimeMatchMinute(5400, 3)).toBe(90)
  })

  it('clamps invalid or over-time input safely', () => {
    expect(runtimeMatchMinute(-20, 3)).toBe(0)
    expect(runtimeMatchMinute(99999, 3)).toBe(90)
  })

  it('calculates short stoppage time from goals, fouls, cards and reviews', () => {
    const session = {
      score: { red: 2, blue: 1 },
      stats: {
        red: { fouls: 7, yellowCards: 1, redCards: 0 },
        blue: { fouls: 6, yellowCards: 2, redCards: 0 },
      },
      commentary: [
        { type: 'var-review' },
        { type: 'injury' },
        { type: 'substitution' },
      ],
    }
    expect(getStoppageInputs(session)).toEqual({
      goals: 3,
      fouls: 13,
      cards: 3,
      injuries: 1,
      reviews: 1,
      substitutions: 1,
    })
    expect(calculateStoppageMinutes(session)).toBe(5)
    expect(calculateStoppageMinutes(session, getStoppageInputs(session))).toBe(1)
  })

  it('formats both halves of added time without changing ordinary minutes', () => {
    expect(formatMatchClock({ minute: 47, regulationMinute: 45, addedMinute: 2 })).toBe('45+2')
    expect(formatMatchClock({ minute: 93, regulationMinute: 90, addedMinute: 3 })).toBe('90+3')
    expect(formatMatchClock({ minute: 26 }, 26)).toBe('26')
  })
})
