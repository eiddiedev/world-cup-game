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

export const INTERACTIVE_PLAYABLE_TEAM_IDS = Object.freeze([
  ...ALL_PLAYABLE_TEAM_IDS,
])

const FULL_FEATURES = Object.freeze({
  coachMode: true,
  playerMode: true,
  codex: true,
  standalonePenalty: true,
  formalMatchPenalties: true,
})

const INTERACTIVE_FEATURES = Object.freeze({
  coachMode: true,
  playerMode: true,
  codex: false,
  standalonePenalty: false,
  formalMatchPenalties: true,
})

export const VARIANTS = Object.freeze({
  'showcase-full': Object.freeze({
    id: 'showcase-full',
    label: '展示完整版',
    platform: 'web',
    artPack: 'showcase',
    brandingProfile: 'showcase',
    playableTeamIds: ALL_PLAYABLE_TEAM_IDS,
    features: FULL_FEATURES,
    storageKey: 'targeting-2026-save',
    formalMatchRealtimeMinutes: 3,
    package: Object.freeze({ enabled: false, archiveName: null, maxZipBytes: null, compressionProfile: 'lossless' }),
    matchView: Object.freeze({ coachDefaultZoom: 1, coachMinZoom: 0.72, playerDefaultZoom: 1 }),
  }),
  'compliant-full': Object.freeze({
    id: 'compliant-full',
    label: '合规完整版',
    platform: 'web',
    artPack: 'compliant',
    brandingProfile: 'compliant',
    playableTeamIds: ALL_PLAYABLE_TEAM_IDS,
    features: FULL_FEATURES,
    storageKey: 'targeting-2026-compliant-full-save',
    formalMatchRealtimeMinutes: 3,
    package: Object.freeze({ enabled: false, archiveName: null, maxZipBytes: null, compressionProfile: 'lossless' }),
    matchView: Object.freeze({ coachDefaultZoom: 1, coachMinZoom: 0.72, playerDefaultZoom: 1 }),
  }),
  'compliant-interactive': Object.freeze({
    id: 'compliant-interactive',
    label: '互动空间合规版',
    platform: 'interactive-space',
    artPack: 'compliant',
    brandingProfile: 'compliant',
    playableTeamIds: INTERACTIVE_PLAYABLE_TEAM_IDS,
    features: INTERACTIVE_FEATURES,
    storageKey: 'targeting-2026-compliant-interactive-save',
    formalMatchRealtimeMinutes: 2,
    package: Object.freeze({
      enabled: true,
      archiveName: 'targeting-2026-compliant-interactive.zip',
      maxZipBytes: 15 * 1024 * 1024,
      compressionProfile: 'match-quality',
    }),
    matchView: Object.freeze({ coachDefaultZoom: 0.68, coachMinZoom: 0.48, playerDefaultZoom: 1.16 }),
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

export function variantIdForMode(mode) {
  if (mode === 'compliant') return 'compliant-full'
  if (mode === 'interactive') return 'compliant-interactive'
  return 'showcase-full'
}
