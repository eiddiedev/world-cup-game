export const ALL_PLAYABLE_TEAM_IDS = Object.freeze([
  'spain',
  'argentina',
  'france',
  'england',
  'brazil',
  'portugal',
  'germany',
  'japan',
  'morocco',
  'norway',
  'colombia',
  'usa',
  'canada',
  'mexico',
  'capeverde',
  'curacao',
])

const FULL_FEATURES = Object.freeze({
  coachMode: false,
  playerMode: false,
  journeyMode: true,
  onlineMode: true,
  ironFootball: true,
  deterministicOffside: true,
  codex: true,
  standalonePenalty: true,
  formalMatchPenalties: true,
})

export const VARIANTS = Object.freeze({
  'compliant-full': Object.freeze({
    id: 'compliant-full',
    label: '合规完整版',
    platform: 'web',
    targetPlatform: 'douyin-mini-game',
    artPack: 'compliant',
    brandingProfile: 'compliant',
    playableTeamIds: ALL_PLAYABLE_TEAM_IDS,
    features: FULL_FEATURES,
    storageKey: 'targeting-2026-compliant-full-save',
    formalMatchRealtimeMinutes: 3,
    package: Object.freeze({ enabled: false, archiveName: null, maxZipBytes: null, compressionProfile: 'lossless' }),
    matchView: Object.freeze({ coachDefaultZoom: 1, coachMinZoom: 0.72, playerDefaultZoom: 1 }),
  }),
})

export const VARIANT_IDS = Object.freeze(Object.keys(VARIANTS))

export function getVariant(variantId) {
  const variant = VARIANTS[variantId]
  if (!variant) {
    throw new Error(`Unknown Targeting 2026 variant: ${variantId}`)
  }
  return variant
}

export function variantIdForMode() {
  return 'compliant-full'
}
