import { describe, expect, it } from 'vitest'
import {
  applyJourneyLoadout,
  awardJourneyDrops,
  clearJourneyTransientItemEffects,
  validateJourneyLoadout,
} from './journeyItems.js'

const roster = [
  { id: 'gk', name: '门将', position: 'GK', sta: 70, form: 70 },
  { id: 'fw', name: '前锋', position: 'FW', sta: 70, form: 70 },
  ...Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, position: 'MF', sta: 70, form: 70 })),
]

function run() {
  return {
    roster,
    lineup: roster.slice(0, 11),
    itemInventory: {
      'sports-drink': 1,
      'ice-pack': 1,
      'football-boots': 1,
      'goalkeeper-gloves': 1,
      'tactical-board': 1,
      'training-equipment': 1,
    },
    injuredPlayers: ['fw'],
    injuryMatches: { fw: 1 },
  }
}

describe('journey match items', () => {
  it('locks at most three owned items and applies their real state effects', () => {
    const result = applyJourneyLoadout(run(), [
      { itemId: 'sports-drink', targetPlayerIds: ['fw'] },
      { itemId: 'football-boots', targetPlayerIds: ['fw'] },
      { itemId: 'tactical-board', targetPlayerIds: [] },
    ], '2026-09-04T00:00:00.000Z')

    expect(result.valid).toBe(true)
    expect(result.run.playerMatchStates.fw).toMatchObject({ stamina: 78, form: 75, morale: 73 })
    expect(result.run.matchItemLoadoutLocked).toBe(true)
    expect(result.run.itemInventory['sports-drink']).toBe(0)
    expect(result.run.matchItemLoadout[2].targetPlayerIds).toHaveLength(11)

    const cleared = clearJourneyTransientItemEffects(result.run)
    expect(cleared.playerMatchStates.fw).toMatchObject({ stamina: 78, form: 70, morale: 70 })
    expect(cleared.transientItemEffects).toEqual({})
  })

  it('rejects invalid targets and over-cap loadouts without consuming inventory', () => {
    const result = validateJourneyLoadout(run(), [
      { itemId: 'goalkeeper-gloves', targetPlayerIds: ['fw'] },
      { itemId: 'sports-drink', targetPlayerIds: ['fw'] },
      { itemId: 'tactical-board', targetPlayerIds: [] },
      { itemId: 'football-boots', targetPlayerIds: ['fw'] },
    ])
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('每场最多携带 3 件道具')
    expect(result.errors).toContain('门将手套只能装备给门将')
  })

  it('drops one item after completion, one more after a win, and none after forfeit', () => {
    const base = run()
    const loss = awardJourneyDrops(base, { matchId: 'm1', result: 'loss' })
    const win = awardJourneyDrops(base, { matchId: 'm2', result: 'win' })
    const forfeit = awardJourneyDrops(base, { matchId: 'm3', result: 'loss', forfeited: true })
    expect(loss.drops).toHaveLength(1)
    expect(win.drops).toHaveLength(2)
    expect(forfeit.drops).toEqual([])
  })
})
