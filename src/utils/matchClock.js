export const MATCH_CLOCK_TICKS_PER_REALTIME_MINUTE = 20
export const MATCH_STOPPAGE_MINUTES_MIN = 1
export const MATCH_STOPPAGE_MINUTES_MAX = 5

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0))
}

export function runtimeMatchMinute(matchTime, realtimeMinutes = 3) {
  const duration = Math.max(0.1, Number(realtimeMinutes) || 3)
  return Math.max(0, Math.min(
    90,
    Math.floor((Number(matchTime) || 0) / (MATCH_CLOCK_TICKS_PER_REALTIME_MINUTE * duration)),
  ))
}

export function getStoppageInputs(session = {}) {
  const commentary = session.commentary || []
  const totalStats = ['red', 'blue'].reduce((totals, side) => {
    const stats = session.stats?.[side] || {}
    totals.fouls += Number(stats.fouls || 0)
    totals.cards += Number(stats.yellowCards || 0) + Number(stats.redCards || 0)
    return totals
  }, { fouls: 0, cards: 0 })
  return {
    goals: Number(session.score?.red || 0) + Number(session.score?.blue || 0),
    fouls: totalStats.fouls,
    cards: totalStats.cards,
    injuries: commentary.filter((line) => line.type === 'injury').length,
    reviews: commentary.filter((line) => line.type === 'var-review').length,
    substitutions: commentary.filter((line) => line.type === 'substitution').length,
  }
}

export function calculateStoppageMinutes(session = {}, baseline = {}) {
  const current = getStoppageInputs(session)
  const delta = Object.fromEntries(Object.entries(current).map(([key, value]) => [
    key,
    Math.max(0, value - Number(baseline[key] || 0)),
  ]))
  const weighted = 1
    + delta.goals * 0.55
    + delta.fouls * 0.12
    + delta.cards * 0.28
    + delta.injuries * 0.55
    + delta.reviews * 0.7
    + delta.substitutions * 0.12
  return clamp(
    Math.round(weighted),
    MATCH_STOPPAGE_MINUTES_MIN,
    MATCH_STOPPAGE_MINUTES_MAX,
  )
}

export function formatMatchClock(clock = {}, fallbackMinute = 0) {
  const safeClock = clock || {}
  const base = Number(safeClock.regulationMinute)
  const added = Number(safeClock.addedMinute)
  if ((base === 45 || base === 90) && added > 0) {
    return `${base}+${Math.floor(added)}`
  }
  return String(Math.max(0, Math.floor(Number(safeClock.minute ?? fallbackMinute) || 0)))
}
