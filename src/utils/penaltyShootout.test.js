import { describe, expect, it } from 'vitest'
import {
  AI_SHOOTER_BASE_MISS_RATE,
  PENALTY_ZONES,
  getShootoutWinner,
  keeperPerspectiveDirection,
  pickAiKeeperZone,
  pickAiShooterZone,
  reconcileShootoutResult,
  resolveShootoutAttempt,
} from './penaltyShootout.js'

function mulberry32(seed) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('6 区点球结算', () => {
  it('maps goalkeeper left/right from the keeper own perspective', () => {
    expect(keeperPerspectiveDirection('left')).toBe('right')
    expect(keeperPerspectiveDirection('center')).toBe('center')
    expect(keeperPerspectiveDirection('right')).toBe('left')
  })

  it('lets the physical Runtime result override the sampled rule result', () => {
    expect(reconcileShootoutResult(
      { scored: true, saved: false, missed: false },
      'saved',
    )).toEqual({ scored: false, saved: true, missed: false })
    expect(reconcileShootoutResult(
      { scored: false, saved: true, missed: false },
      'goal',
    )).toEqual({ scored: true, saved: false, missed: false })
  })

  it('exports the six goal zones', () => {
    expect(PENALTY_ZONES).toEqual([
      'left-top', 'center-top', 'right-top',
      'left-bottom', 'center-bottom', 'right-bottom',
    ])
  })

  it('saves the shot when the keeper picks the same zone', () => {
    const result = resolveShootoutAttempt({
      shooterZone: 'left-top',
      keeperZone: 'left-top',
      keeperDef: 80,
      random: mulberry32(1),
    })
    expect(result).toEqual({ scored: false, saved: true, missed: false })
  })

  it('scores when the keeper picks a different zone and the shot avoids the post', () => {
    const result = resolveShootoutAttempt({
      shooterZone: 'right-bottom',
      keeperZone: 'left-top',
      shooterTec: 95,
      keeperDef: 80,
      random: () => 0.99,
    })
    expect(result).toEqual({ scored: true, saved: false, missed: false })
  })

  it('misses off target when the shot is overpowered', () => {
    const result = resolveShootoutAttempt({
      shooterZone: 'center-top',
      keeperZone: 'center-top',
      overpowered: true,
      random: () => 0.99,
    })
    expect(result).toEqual({ scored: false, saved: false, missed: true })
  })

  it('flags post shots as missed with a post marker', () => {
    const result = resolveShootoutAttempt({
      shooterZone: 'left-bottom',
      keeperZone: 'right-bottom',
      shooterTec: 45,
      random: () => 0,
    })
    expect(result).toMatchObject({ scored: false, saved: false, missed: true, post: true })
  })

  it('rejects unknown zones as missed', () => {
    const result = resolveShootoutAttempt({
      shooterZone: 'nowhere',
      keeperZone: 'left-top',
      random: () => 0.99,
    })
    expect(result.missed).toBe(true)
  })

  it('lets very weak keepers spill a same-zone shot', () => {
    const spilled = resolveShootoutAttempt({
      shooterZone: 'center-bottom',
      keeperZone: 'center-bottom',
      keeperDef: 40,
      random: () => 0,
    })
    expect(spilled).toEqual({ scored: true, saved: false, missed: false })
  })
})

describe('AI 选区', () => {
  it('low-tec AI shooters aim down the middle more often than high-tec ones', () => {
    const countCenters = (tec, seed) => {
      const random = mulberry32(seed)
      let centers = 0
      for (let i = 0; i < 500; i += 1) {
        if (pickAiShooterZone(tec, random).zone.startsWith('center')) centers += 1
      }
      return centers / 500
    }
    expect(countCenters(45, 7)).toBeGreaterThan(countCenters(95, 7))
  })

  it('AI shooters overpower roughly the base miss rate of shots', () => {
    const random = mulberry32(11)
    let flies = 0
    for (let i = 0; i < 2000; i += 1) {
      if (pickAiShooterZone(70, random).overpowered) flies += 1
    }
    const rate = flies / 2000
    expect(rate).toBeGreaterThan(AI_SHOOTER_BASE_MISS_RATE)
    expect(rate).toBeLessThan(AI_SHOOTER_BASE_MISS_RATE + 0.08)
  })

  it('AI keeper zones are always valid zones', () => {
    const random = mulberry32(23)
    for (let i = 0; i < 200; i += 1) {
      expect(PENALTY_ZONES).toContain(pickAiKeeperZone(75, random))
    }
  })
})

describe('getShootoutWinner 既有语义', () => {
  const makeShots = (homeScored, awayScored) => ([
    ...Array.from({ length: homeScored.length }, (_, i) => ({
      round: i + 1, team: 'home', scored: homeScored[i], saved: !homeScored[i], missed: false,
    })),
    ...Array.from({ length: awayScored.length }, (_, i) => ({
      round: i + 1, team: 'away', scored: awayScored[i], saved: !awayScored[i], missed: false,
    })),
  ])

  it('returns null while the shootout is undecided', () => {
    expect(getShootoutWinner([])).toBeNull()
    expect(getShootoutWinner(makeShots([true], []))).toBeNull()
  })

  it('locks the win early when the trailing side cannot catch up', () => {
    const shots = makeShots([true, true, true], [false, false, false])
    expect(getShootoutWinner(shots)).toBe('home')
  })

  it('decides after five rounds when scores differ', () => {
    const shots = makeShots(
      [true, true, true, false, true],
      [true, false, true, false, true],
    )
    expect(getShootoutWinner(shots)).toBe('home')
  })

  it('goes to sudden death when level after five rounds', () => {
    const tied = makeShots(
      [true, true, true, true, false],
      [true, true, true, true, false],
    )
    expect(getShootoutWinner(tied)).toBeNull()
    expect(getShootoutWinner([...tied, { round: 6, team: 'home', scored: true }])).toBeNull()
    expect(getShootoutWinner([
      ...tied,
      { round: 6, team: 'home', scored: true },
      { round: 6, team: 'away', scored: false },
    ])).toBe('home')
  })
})
