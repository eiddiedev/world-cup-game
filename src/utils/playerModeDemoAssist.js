const EASY_PROFILE = Object.freeze({
  schemaVersion: 'player-mode-demo-assist-v3',
  difficulty: 'easy',
  enabled: true,
  speed: 0.85,
  ai: 0,
  receptionGraceMs: 500,
  passInputBufferMs: 240,
  activePressers: 1,
  coverPlayers: 1,
  defensiveWidth: 1.06,
  coverMinimumDistance: 5.5,
  shapeRefreshMs: 180,
})

const MEDIUM_PROFILE = Object.freeze({
  ...EASY_PROFILE,
  difficulty: 'medium',
  enabled: false,
  speed: 1,
  ai: 1,
})

const HARD_PROFILE = Object.freeze({
  ...EASY_PROFILE,
  difficulty: 'hard',
  enabled: false,
  speed: 1.08,
  ai: 2,
})

export const PLAYER_MODE_DEMO_ASSIST = EASY_PROFILE
export const PLAYER_MODE_PACE_PROFILES = Object.freeze({
  easy: EASY_PROFILE,
  medium: MEDIUM_PROFILE,
  hard: HARD_PROFILE,
})

function averageStartingRating(team) {
  if (Number.isFinite(Number(team?.baseRating))) return Number(team.baseRating)
  const ratings = (team?.players || [])
    .map((player) => Number(player?.rating))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)
    .slice(0, 11)
  if (!ratings.length) return null
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
}

export function resolvePlayerModeDifficulty(redTeam, blueTeam) {
  const redRating = averageStartingRating(redTeam)
  const blueRating = averageStartingRating(blueTeam)
  if (redRating == null || blueRating == null) return 'medium'
  const ratingGap = redRating - blueRating
  if (ratingGap >= 5) return 'easy'
  if (ratingGap <= -4) return 'hard'
  return 'medium'
}

export function getPlayerModeDemoAssistProfile(playerMode, difficulty = 'medium') {
  if (!playerMode) return null
  const profile = PLAYER_MODE_PACE_PROFILES[difficulty] || MEDIUM_PROFILE
  return { ...profile }
}
