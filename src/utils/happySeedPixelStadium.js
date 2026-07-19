export const HAPPYSEED_PIXEL_STADIUM_ID = 'world-cup-day-v1'

export const HAPPYSEED_STADIUM_SOURCE_SIZE = Object.freeze({ width: 4096, height: 2048 })
export const HAPPYSEED_STADIUM_RUNTIME_SIZE = Object.freeze({ width: 5120, height: 2560 })
export const HAPPYSEED_STADIUM_SOURCE_PITCH_BOUNDS = Object.freeze({
  x: 648,
  y: 611,
  width: 2800,
  height: 1057,
})
export const HAPPYSEED_STADIUM_PITCH_BOUNDS = Object.freeze({
  x: 810,
  y: 764,
  width: 3500,
  height: 1321,
})

export const HAPPYSEED_STADIUM_GOAL_LINE_X = Object.freeze({
  left: HAPPYSEED_STADIUM_PITCH_BOUNDS.x,
  right: HAPPYSEED_STADIUM_PITCH_BOUNDS.x + HAPPYSEED_STADIUM_PITCH_BOUNDS.width,
})
export const HAPPYSEED_STADIUM_GOAL_VISUAL_NUDGE_X = Object.freeze({ left: 12, right: -12 })

export const HAPPYSEED_STADIUM_LAYERS = Object.freeze([
  { id: 'master-background', label: '统一白天世界杯像素球场', runtimeLayer: 'base' },
  { id: 'runtime-goal-back', label: '原生球门后框', runtimeLayer: 'bottom' },
  { id: 'runtime-goal-front', label: '原生门柱前框', runtimeLayer: 'middle' },
  { id: 'runtime-net', label: '原生动态球网', runtimeLayer: 'runtime-net' },
])

export const HAPPYSEED_STADIUM_CAMERA_PRESETS = Object.freeze([
  { id: 'normal', label: '常规', normalizedTarget: [0.5, 0.5], zoomMultiplier: 1, followBall: true },
  { id: 'goal', label: '进球', normalizedTarget: [0.88, 0.5], zoomMultiplier: 1.22 },
  { id: 'corner', label: '角球', normalizedTarget: [0.92, 0.12], zoomMultiplier: 1.18 },
  { id: 'goal-kick', label: '门球', normalizedTarget: [0.86, 0.5], zoomMultiplier: 1.12 },
  { id: 'touchline', label: '边线球', normalizedTarget: [0.5, 0.12], zoomMultiplier: 1.14 },
  { id: 'free-kick', label: '危险任意球', normalizedTarget: [0.855, 0.5], zoomMultiplier: 1.34 },
])

export const HAPPYSEED_PIXEL_STADIUM_ASSETS = Object.freeze({
  masterBackground: `/pixel/stadiums/${HAPPYSEED_PIXEL_STADIUM_ID}/stadium-day-master-v1.png`,
  scene: `/pixel/stadiums/${HAPPYSEED_PIXEL_STADIUM_ID}/scene.json`,
  ballTexture: '/pixel/runtime-equipment/happyseed-equipment-v6/football-pixel-v6.png',
  goalAtlas: '/pixel/runtime-equipment/happyseed-equipment-v6/goal-net-pixel-v6.png',
  equipmentManifest: '/pixel/runtime-equipment/happyseed-equipment-v6/manifest.json',
})

export const HAPPYSEED_STADIUM_COMPOSITION = Object.freeze({
  artSource: {
    kind: 'image-generation-edit',
    humanCrowd: true,
    lighting: 'bright-daylight',
    generatedLayerRole: 'single-master-background',
  },
  projectionReference: 'animal-cup-international-runtime',
  sourcePitchBounds: HAPPYSEED_STADIUM_SOURCE_PITCH_BOUNDS,
  opaqueBackgroundCount: 1,
  runtimePitchOverlay: false,
  reuseOriginalGoalSprites: true,
  goalPositionSource: 'stadium.json',
  goalVisualAlignment: {
    source: 'pitchBounds',
    lineX: HAPPYSEED_STADIUM_GOAL_LINE_X,
    nudgeX: HAPPYSEED_STADIUM_GOAL_VISUAL_NUDGE_X,
  },
})

export function getHappySeedPixelStadiumContract() {
  return {
    schemaVersion: 'happyseed-pixel-stadium-v2',
    id: HAPPYSEED_PIXEL_STADIUM_ID,
    visualThesis: '明亮人类世界杯像素场作为唯一背景，原生球门、动态球网、角色和足球保持独立。',
    sourceSize: HAPPYSEED_STADIUM_SOURCE_SIZE,
    runtimeSize: HAPPYSEED_STADIUM_RUNTIME_SIZE,
    runtimeScale: 1.25,
    pitchBounds: HAPPYSEED_STADIUM_PITCH_BOUNDS,
    scaleReference: {
      humanSkeletonBounds: { width: 123.69, height: 202.3 },
      anchor: 'root-footline',
    },
    assets: HAPPYSEED_PIXEL_STADIUM_ASSETS,
    layers: HAPPYSEED_STADIUM_LAYERS,
    cameraPresets: HAPPYSEED_STADIUM_CAMERA_PRESETS,
    composition: HAPPYSEED_STADIUM_COMPOSITION,
    invariants: {
      preserveGoalCollision: true,
      preserveDynamicNet: true,
      preserveBallGeometry: true,
      equipmentFiltering: 'nearest',
      preserveCamera: true,
      preserveDepthSort: true,
      hideLegacyAnimalCrowd: true,
      sharedModes: ['coach', 'player', 'penalty'],
      networking: 'none',
    },
  }
}

export function validateHappySeedPixelStadiumContract(contract) {
  const errors = []
  if (contract?.schemaVersion !== 'happyseed-pixel-stadium-v2') errors.push('schemaVersion')
  if (contract?.id !== HAPPYSEED_PIXEL_STADIUM_ID) errors.push('id')
  if (contract?.sourceSize?.width !== 4096 || contract?.sourceSize?.height !== 2048) errors.push('sourceSize')
  if (contract?.runtimeSize?.width !== 5120 || contract?.runtimeSize?.height !== 2560) errors.push('runtimeSize')
  if (contract?.runtimeScale !== 1.25) errors.push('runtimeScale')
  if (contract?.layers?.length !== HAPPYSEED_STADIUM_LAYERS.length) errors.push('layers')
  if (contract?.cameraPresets?.length !== HAPPYSEED_STADIUM_CAMERA_PRESETS.length) errors.push('cameraPresets')
  if (contract?.scaleReference?.anchor !== 'root-footline') errors.push('scaleReference.anchor')
  if (contract?.composition?.opaqueBackgroundCount !== 1) errors.push('composition.opaqueBackgroundCount')
  if (contract?.composition?.runtimePitchOverlay !== false) errors.push('composition.runtimePitchOverlay')
  if (contract?.composition?.reuseOriginalGoalSprites !== true) errors.push('composition.reuseOriginalGoalSprites')
  if (contract?.composition?.goalPositionSource !== 'stadium.json') errors.push('composition.goalPositionSource')
  if (contract?.composition?.goalVisualAlignment?.source !== 'pitchBounds') errors.push('composition.goalVisualAlignment.source')
  if (contract?.composition?.goalVisualAlignment?.lineX?.left !== HAPPYSEED_STADIUM_GOAL_LINE_X.left
    || contract?.composition?.goalVisualAlignment?.lineX?.right !== HAPPYSEED_STADIUM_GOAL_LINE_X.right) {
    errors.push('composition.goalVisualAlignment.lineX')
  }
  if (contract?.composition?.goalVisualAlignment?.nudgeX?.left !== HAPPYSEED_STADIUM_GOAL_VISUAL_NUDGE_X.left
    || contract?.composition?.goalVisualAlignment?.nudgeX?.right !== HAPPYSEED_STADIUM_GOAL_VISUAL_NUDGE_X.right) {
    errors.push('composition.goalVisualAlignment.nudgeX')
  }
  if (contract?.composition?.sourcePitchBounds?.x !== 648 || contract?.composition?.sourcePitchBounds?.y !== 611) errors.push('composition.sourcePitchBounds')
  if (contract?.invariants?.hideLegacyAnimalCrowd !== true) errors.push('invariants.hideLegacyAnimalCrowd')
  if (contract?.invariants?.preserveBallGeometry !== true) errors.push('invariants.preserveBallGeometry')
  if (contract?.invariants?.equipmentFiltering !== 'nearest') errors.push('invariants.equipmentFiltering')
  if (contract?.invariants?.networking !== 'none') errors.push('invariants.networking')
  return { valid: errors.length === 0, errors }
}
