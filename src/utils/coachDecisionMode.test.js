import { describe, expect, it } from 'vitest'
import { shouldEnableCoachDecisions } from './coachDecisionMode.js'

describe('coach decision mode contract', () => {
  it('keeps decisions enabled for coach mode in production even when the host URL has debug-like params', () => {
    const hostParams = new URLSearchParams('events=manual&decisions=off')

    expect(shouldEnableCoachDecisions('coach', hostParams, false)).toBe(true)
    expect(shouldEnableCoachDecisions(undefined, hostParams, false)).toBe(true)
  })

  it('only honors decision-off params in local debug entries and never enables them in player mode', () => {
    const debugParams = new URLSearchParams('events=auto')

    expect(shouldEnableCoachDecisions('coach', debugParams, true)).toBe(false)
    expect(shouldEnableCoachDecisions('player', new URLSearchParams(), false)).toBe(false)
  })
})
