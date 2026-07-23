import { describe, expect, it } from 'vitest'
import {
  APPEARANCE_CATALOG,
  STUDIO_CATALOG_COUNTS,
  STUDIO_TEAMS,
} from './catalog.js'
import {
  STUDIO_AUTHORING_SCHEMA,
  STUDIO_PART_SET_ID,
  appearanceSignature,
  buildStudioRuntimeRecipe,
  createDefaultStudioRecipe,
  createStudioBatch,
  decodePatchRle,
  encodePatchRle,
  randomizeStudioRecipe,
  validateStudioRecipe,
} from './model.js'

describe('Pixel Player Studio production catalog', () => {
  it('locks the 16-team / 64-kit first wave', () => {
    expect(STUDIO_TEAMS).toHaveLength(16)
    expect(STUDIO_TEAMS.flatMap((team) => team.kits)).toHaveLength(64)
    expect(new Set(STUDIO_TEAMS.map((team) => team.id)).size).toBe(16)
    STUDIO_TEAMS.forEach((team) => {
      expect(team.kits.map((kit) => kit.id)).toEqual([
        'home',
        'away',
        'goalkeeper',
        'away-goalkeeper',
      ])
      expect(team.licenseStatus).toBe('review-required')
      expect(team.sourceUrls.length).toBeGreaterThan(0)
    })
  })

  it('meets the agreed production-library minimums', () => {
    expect(STUDIO_CATALOG_COUNTS.skinToneId).toBe(8)
    expect(STUDIO_CATALOG_COUNTS.faceId).toBe(12)
    expect(STUDIO_CATALOG_COUNTS.eyesId).toBe(16)
    expect(STUDIO_CATALOG_COUNTS.eyebrowsId).toBe(12)
    expect(STUDIO_CATALOG_COUNTS.noseId).toBe(10)
    expect(STUDIO_CATALOG_COUNTS.mouthId).toBe(12)
    expect(STUDIO_CATALOG_COUNTS.hairId).toBe(40)
    expect(STUDIO_CATALOG_COUNTS.hairColorId).toBe(16)
    expect(STUDIO_CATALOG_COUNTS.beardId).toBe(21)
    expect(STUDIO_CATALOG_COUNTS.accessoryIds).toBe(9)
    expect(STUDIO_CATALOG_COUNTS.bootsId).toBe(12)
    expect(STUDIO_CATALOG_COUNTS.glovesId).toBe(8)
    expect(Object.values(APPEARANCE_CATALOG).every((items) => items.length > 0)).toBe(true)
  })
})

describe('Pixel Player Studio recipe model', () => {
  it('creates a valid authoring recipe and preserves the runtime contract', () => {
    const recipe = createDefaultStudioRecipe({ teamId: 'france', number: 10 })
    expect(validateStudioRecipe(recipe)).toEqual({ valid: true, errors: [] })
    expect(recipe.schemaVersion).toBe(STUDIO_AUTHORING_SCHEMA)
    expect(recipe.partSetId).toBe(STUDIO_PART_SET_ID)

    const runtime = buildStudioRuntimeRecipe(recipe)
    expect(runtime.schemaVersion).toBe('happyseed-human-runtime-recipe-v1')
    expect(runtime.compatibility.anchor).toBe('root-footline')
    expect(runtime.compatibility.horizontalFlip).toBe('spine-scale-x')
    expect(runtime.assets.headFront).toContain('/head_front.png')
  })

  it('randomizes deterministically while respecting locked parts', () => {
    const base = createDefaultStudioRecipe({ playerId: 'france_player_10', seed: 7788 })
    base.lockedParts = ['skinToneId', 'hairId']
    const first = randomizeStudioRecipe(base)
    const second = randomizeStudioRecipe(base)
    expect(first.appearance).toEqual(second.appearance)
    expect(first.appearance.skinToneId).toBe(base.appearance.skinToneId)
    expect(first.appearance.hairId).toBe(base.appearance.hairId)
  })

  it('builds 38-player teams without duplicate appearance signatures', () => {
    const batch = createStudioBatch({ teamId: 'japan', count: 38, seed: 2026 })
    expect(batch.recipes).toHaveLength(38)
    expect(batch.uniqueAppearanceCount).toBe(38)
    expect(batch.duplicateCount).toBe(0)
    expect(new Set(batch.recipes.map(appearanceSignature)).size).toBe(38)
    expect(batch.recipes.filter((recipe) => recipe.role === 'goalkeeper')).toHaveLength(4)
  })

  it('round-trips sparse RLE paint patches and clips out-of-bounds pixels', () => {
    const points = [
      { x: 2, y: 1, color: '#FFFFFF' },
      { x: 3, y: 1, color: '#FFFFFF' },
      { x: 4, y: 1, color: '#FFFFFF' },
      { x: 9, y: 2, color: null },
      { x: 200, y: 200, color: '#FF0000' },
    ]
    const encoded = encodePatchRle(points, 'shirt_front')
    expect(encoded.runs[0]).toEqual([1, 2, 3, '#FFFFFF'])
    expect(decodePatchRle(encoded)).toEqual(points.slice(0, 4))
  })
})
