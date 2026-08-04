import { describe, expect, it } from 'vitest'
import { COMPETITION_BRAND as compliantBrand } from './competitionBrand.compliant.js'
import { COMPETITION_BRAND as showcaseBrand } from './competitionBrand.showcase.js'

const RESTRICTED = /世界杯|fifa|world[\s_-]*cup|大力神杯/iu

describe('competition branding profiles', () => {
  it('keeps the showcase wording available only in the showcase profile', () => {
    expect(JSON.stringify(showcaseBrand)).toMatch(RESTRICTED)
  })

  it('keeps compliant copy free of restricted competition IP', () => {
    const serialized = [
      JSON.stringify(compliantBrand),
      compliantBrand.teamJourneyStarted('西班牙'),
    ].join('\n')
    expect(serialized).not.toMatch(RESTRICTED)
    expect(compliantBrand.tournamentName).toBe('国际足球冠军赛')
  })
})
