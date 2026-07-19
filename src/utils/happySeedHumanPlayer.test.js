import { describe, expect, it } from 'vitest'
import {
  HAPPYSEED_HUMAN_ACTIONS,
  HAPPYSEED_HUMAN_PART_SET_ID,
  HAPPYSEED_PLAYER_BONES,
  HAPPYSEED_PLAYER_SLOTS,
  HAPPYSEED_SLOT_TEXTURE_SIZES,
  buildHappySeedHumanRecipe,
  getHappySeedHumanCompatibilityContract,
  getHappySeedHumanRecipes,
  validateHappySeedHumanRecipe,
} from './happySeedHumanPlayer.js'

describe('HappySeed human player compatibility slice', () => {
  it('locks the exported Spine skeleton bones, slots, bounds, and orientation contract', () => {
    const contract = getHappySeedHumanCompatibilityContract()

    expect(contract.spineVersion).toBe('2.1.27')
    expect(contract.skeletonBounds).toEqual({ width: 123.69, height: 202.3 })
    expect(HAPPYSEED_PLAYER_BONES).toHaveLength(17)
    expect(HAPPYSEED_PLAYER_SLOTS).toHaveLength(32)
    expect(HAPPYSEED_PLAYER_BONES).toEqual(expect.arrayContaining(['root', 'pelvis', 'chest', 'head']))
    expect(HAPPYSEED_PLAYER_SLOTS).toEqual(expect.arrayContaining([
      'chest_shirt',
      'number',
      'head',
      'hand_left_glove',
      'hand_right_glove',
    ]))
    expect(contract.anchor.strategy).toBe('root-footline')
    expect(contract.directions.leftRight.duplicateTextures).toBe(false)
    expect(contract.occlusion.strategy).toBe('preserve-runtime-draw-order')
  })

  it('maps the complete stage-two action checklist onto animations that exist in player.json', () => {
    expect(HAPPYSEED_HUMAN_ACTIONS.map((action) => action.id)).toEqual([
      'idle',
      'run',
      'sprint',
      'dribble',
      'pass',
      'shoot',
      'slide',
      'fall',
      'stand_up',
      'celebrate',
      'goalkeeper_save',
    ])
    HAPPYSEED_HUMAN_ACTIONS.forEach((action) => {
      expect(action.runtimeState).toBeTruthy()
      expect(action.runtimeAnimations.length).toBeGreaterThan(0)
    })
  })

  it('builds valid recipes for the two outfield samples and one goalkeeper sample', () => {
    const recipes = getHappySeedHumanRecipes()

    expect(recipes.map((recipe) => recipe.id)).toEqual([
      'france-outfield',
      'brazil-outfield',
      'france-goalkeeper',
    ])
    expect(new Set(recipes.map((recipe) => recipe.partSetId))).toEqual(new Set([HAPPYSEED_HUMAN_PART_SET_ID]))
    expect(recipes.filter((recipe) => recipe.role === 'goalkeeper')).toHaveLength(1)
    recipes.forEach((recipe) => expect(validateHappySeedHumanRecipe(recipe)).toEqual({ valid: true, errors: [] }))
  })

  it('keeps exact source attachment dimensions in the generated-asset contract', () => {
    expect(HAPPYSEED_SLOT_TEXTURE_SIZES).toMatchObject({
      head_front: [81, 77],
      head_back: [81, 77],
      shirt_front: [56, 52],
      glove_left: [26, 24],
      number: [33, 18],
    })
    expect(buildHappySeedHumanRecipe('france-outfield').assets.playerRoot).toContain('/pixel/player/')
    expect(buildHappySeedHumanRecipe('france-goalkeeper').assets.kitRoot).toContain('/goalkeeper/')
  })
})
