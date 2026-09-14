import { describe, expect, it } from 'vitest'
import {
  COMPLIANT_CAPTURE_BIASES,
  resolveCompliantCaptureBias,
} from './compliantCaptureBias.js'

describe('compliant full capture action weights', () => {
  it('activates only for the two exact compliant-full coach fixtures', () => {
    expect(resolveCompliantCaptureBias({
      variantId: 'compliant-full',
      gameMode: 'coach',
      teamId: 'germany',
      opponentTeamId: 'curacao',
    })?.id).toBe('germany-curacao-big-win')

    expect(resolveCompliantCaptureBias({
      variantId: 'compliant-full',
      gameMode: 'coach',
      teamId: 'capeverde',
      opponentTeamId: 'spain',
    })?.id).toBe('capeverde-spain-clean-sheet')

    for (const options of [
      { variantId: 'showcase-full', gameMode: 'coach' },
      { variantId: 'compliant-interactive', gameMode: 'coach' },
      { variantId: 'compliant-full', gameMode: 'player' },
    ]) {
      expect(resolveCompliantCaptureBias({
        ...options,
        teamId: 'germany',
        opponentTeamId: 'curacao',
      })).toBeNull()
    }
  })

  it('contains only tactical and pre-goal shot weighting, never score suppression', () => {
    const serialized = JSON.stringify(COMPLIANT_CAPTURE_BIASES)
    expect(serialized).not.toMatch(/maximumGoals|minimumGoals|scoreFloors|statFloors|suppress/i)
    expect(COMPLIANT_CAPTURE_BIASES['germany-curacao-big-win'].shotBias.red.softGoalTarget).toBe(7)
    expect(COMPLIANT_CAPTURE_BIASES['capeverde-spain-clean-sheet'].shotBias.blue.mode)
      .toBe('keeper-channel')
  })
})
