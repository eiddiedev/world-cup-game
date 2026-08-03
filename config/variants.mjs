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
  'spain',
  'england',
  'norway',
  'capeverde',
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
    playableTeamIds: ALL_PLAYABLE_TEAM_IDS,
    features: FULL_FEATURES,
    storageKey: 'targeting-2026-save',
    formalMatchRealtimeMinutes: 3,
    package: Object.freeze({ enabled: false, archiveName: null, maxZipBytes: null, compressionProfile: 'lossless' }),
    matchView: Object.freeze({ coachDefaultZoom: 1, coachMinZoom: 0.72 }),
  }),
  'compliant-full': Object.freeze({
    id: 'compliant-full',
    label: '合规完整版',
    platform: 'web',
    artPack: 'compliant',
    playableTeamIds: ALL_PLAYABLE_TEAM_IDS,
    features: FULL_FEATURES,
    storageKey: 'targeting-2026-compliant-full-save',
    formalMatchRealtimeMinutes: 3,
    package: Object.freeze({ enabled: false, archiveName: null, maxZipBytes: null, compressionProfile: 'lossless' }),
    matchView: Object.freeze({ coachDefaultZoom: 1, coachMinZoom: 0.72 }),
  }),
  'compliant-interactive': Object.freeze({
    id: 'compliant-interactive',
    label: '互动空间合规版',
    platform: 'interactive-space',
    artPack: 'compliant',
    playableTeamIds: INTERACTIVE_PLAYABLE_TEAM_IDS,
    features: INTERACTIVE_FEATURES,
    storageKey: 'targeting-2026-world-cup-save',
    formalMatchRealtimeMinutes: 2,
    package: Object.freeze({
      enabled: true,
      archiveName: 'targeting-2026-compliant-interactive.zip',
      maxZipBytes: 8 * 1024 * 1024,
      compressionProfile: 'platform-safe',
    }),
    matchView: Object.freeze({ coachDefaultZoom: 0.68, coachMinZoom: 0.48 }),
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
