import { describe, expect, it } from 'vitest'
import {
  HAPPYSEED_STADIUM_CAMERA_PRESETS,
  HAPPYSEED_STADIUM_LAYERS,
  HAPPYSEED_STADIUM_GOAL_LINE_X,
  HAPPYSEED_STADIUM_GOAL_VISUAL_NUDGE_X,
  HAPPYSEED_STADIUM_PITCH_BOUNDS,
  HAPPYSEED_STADIUM_SOURCE_PITCH_BOUNDS,
  getHappySeedPixelStadiumContract,
  validateHappySeedPixelStadiumContract,
} from './happySeedPixelStadium.js'

describe('HappySeed pixel stadium contract', () => {
  it('locks the original runtime pitch projection', () => {
    expect(HAPPYSEED_STADIUM_PITCH_BOUNDS).toEqual({
      x: 810,
      y: 764,
      width: 3500,
      height: 1321,
    })
    expect(HAPPYSEED_STADIUM_SOURCE_PITCH_BOUNDS).toEqual({
      x: 648,
      y: 611,
      width: 2800,
      height: 1057,
    })
  })

  it('uses one image-generated master background and original runtime goals', () => {
    expect(HAPPYSEED_STADIUM_LAYERS.map((layer) => layer.id)).toEqual([
      'master-background',
      'runtime-goal-back',
      'runtime-goal-front',
      'runtime-net',
    ])
  })

  it('aligns the visible goal posts to the shared pitch goal lines', () => {
    expect(HAPPYSEED_STADIUM_GOAL_LINE_X).toEqual({ left: 810, right: 4310 })
    expect(getHappySeedPixelStadiumContract().composition.goalVisualAlignment).toEqual({
      source: 'pitchBounds',
      lineX: HAPPYSEED_STADIUM_GOAL_LINE_X,
      nudgeX: HAPPYSEED_STADIUM_GOAL_VISUAL_NUDGE_X,
    })
  })

  it('defines all six required camera compositions', () => {
    expect(HAPPYSEED_STADIUM_CAMERA_PRESETS.map((preset) => preset.id)).toEqual([
      'normal',
      'goal',
      'corner',
      'goal-kick',
      'touchline',
      'free-kick',
    ])
  })

  it('ships the single-background art provenance and reuses stadium.json goal placement', () => {
    const contract = getHappySeedPixelStadiumContract()
    expect(contract.composition).toMatchObject({
      opaqueBackgroundCount: 1,
      runtimePitchOverlay: false,
      reuseOriginalGoalSprites: true,
      goalPositionSource: 'stadium.json',
    })
    expect(contract.assets).toEqual({
      masterBackground: '/pixel/stadiums/international-championship-day-v1/stadium-day-master-v1.png',
      scene: '/pixel/stadiums/international-championship-day-v1/scene.json',
      ballTexture: '/pixel/runtime-equipment/happyseed-equipment-v6/football-pixel-v6.png',
      goalAtlas: '/pixel/runtime-equipment/happyseed-equipment-v6/goal-net-pixel-v6.png',
      equipmentManifest: '/pixel/runtime-equipment/happyseed-equipment-v6/manifest.json',
    })
  })

  it('preserves collision, dynamic net, camera, depth sort and three-mode reuse', () => {
    const contract = getHappySeedPixelStadiumContract()
    expect(validateHappySeedPixelStadiumContract(contract)).toEqual({ valid: true, errors: [] })
    expect(contract.invariants).toMatchObject({
      preserveGoalCollision: true,
      preserveDynamicNet: true,
      preserveBallGeometry: true,
      equipmentFiltering: 'nearest',
      preserveCamera: true,
      preserveDepthSort: true,
      hideLegacyAnimalCrowd: true,
      sharedModes: ['coach', 'player', 'penalty'],
      networking: 'none',
    })
  })
})
