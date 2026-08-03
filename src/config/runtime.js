import {
  ALL_PLAYABLE_TEAM_IDS,
  INTERACTIVE_PLAYABLE_TEAM_IDS,
  getVariant,
  variantIdForMode,
} from '../../config/variants.mjs'

const configuredVariantId = import.meta.env?.VITE_VARIANT_ID
  || variantIdForMode(import.meta.env?.MODE)

export const CURRENT_VARIANT = getVariant(configuredVariantId)
export const CURRENT_VARIANT_ID = CURRENT_VARIANT.id
export const VARIANT_FEATURES = CURRENT_VARIANT.features
export const IS_INTERACTIVE_SPACE = CURRENT_VARIANT.platform === 'interactive-space'

// Temporary compatibility alias for the embedded match Runtime. New app code
// should use IS_INTERACTIVE_SPACE or hasVariantFeature instead.
export const IS_DOUYIN_DEMO = IS_INTERACTIVE_SPACE
export const DOUYIN_DEMO_TEAM_IDS = INTERACTIVE_PLAYABLE_TEAM_IDS
export { ALL_PLAYABLE_TEAM_IDS }

export function hasVariantFeature(featureName) {
  return CURRENT_VARIANT.features[featureName] === true
}

export function selectPlayableTeams(sourceTeams, interactive = IS_INTERACTIVE_SPACE) {
  if (!interactive) return sourceTeams
  const allowed = new Set(INTERACTIVE_PLAYABLE_TEAM_IDS)
  return sourceTeams.filter(team => allowed.has(team.id))
}

export function getPlayableTeamIds(interactive = IS_INTERACTIVE_SPACE) {
  return interactive
    ? [...INTERACTIVE_PLAYABLE_TEAM_IDS]
    : [...ALL_PLAYABLE_TEAM_IDS]
}

export function getStorageKey() {
  return CURRENT_VARIANT.storageKey
}
