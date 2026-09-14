export const MATCH_RULESET = Object.freeze({
  STANDARD: 'standard',
  IRON: 'iron',
})

export const IRON_INITIAL_HP = 100
export const IRON_DAMAGE_MIN = 10
export const IRON_DAMAGE_MAX = 38
export const IRON_HIT_COOLDOWN_MS = 800

export function getMatchRuleset(value) {
  return value === MATCH_RULESET.IRON ? MATCH_RULESET.IRON : MATCH_RULESET.STANDARD
}

export function getMatchRulesetContract(value) {
  const id = getMatchRuleset(value)
  if (id === MATCH_RULESET.IRON) {
    return {
      id,
      offside: false,
      fouls: false,
      cards: false,
      penaltiesFromTackles: false,
      injuries: true,
      hp: {
        initial: IRON_INITIAL_HP,
        damageMin: IRON_DAMAGE_MIN,
        damageMax: IRON_DAMAGE_MAX,
        cooldownMs: IRON_HIT_COOLDOWN_MS,
      },
    }
  }
  return {
    id,
    offside: true,
    fouls: true,
    cards: true,
    penaltiesFromTackles: true,
    injuries: true,
    hp: null,
  }
}
export function calculateIronTackleDamage({ relativeSpeed = 0, fromBehind = false } = {}) {
  const normalizedSpeed = Math.max(0, Math.min(1, Number(relativeSpeed) / 8))
  const speedDamage = Math.round(normalizedSpeed * 20)
  const behindDamage = fromBehind ? 8 : 0
  return Math.max(
    IRON_DAMAGE_MIN,
    Math.min(IRON_DAMAGE_MAX, IRON_DAMAGE_MIN + speedDamage + behindDamage),
  )
}

export function createIronHealthState(runtimeActorIds = []) {
  return {
    schemaVersion: 'iron-health-v1',
    hpByRuntimeActorId: Object.fromEntries(
      runtimeActorIds.map((runtimeActorId) => [runtimeActorId, IRON_INITIAL_HP]),
    ),
    lastHitAtByRuntimeActorId: {},
    injuredRuntimeActorIds: [],
  }
}

export function applyIronTackleDamage(state, hit = {}) {
  const targetRuntimeActorId = String(hit.targetRuntimeActorId || '')
  if (!targetRuntimeActorId) return { state, applied: false, reason: 'missing-target' }
  const atMs = Math.max(0, Number(hit.atMs) || 0)
  const lastHitAt = Number(state.lastHitAtByRuntimeActorId[targetRuntimeActorId])
  if (Number.isFinite(lastHitAt) && atMs - lastHitAt < IRON_HIT_COOLDOWN_MS) {
    return { state, applied: false, reason: 'hit-cooldown' }
  }
  const hpBefore = Math.max(0, Math.min(
    IRON_INITIAL_HP,
    Number(state.hpByRuntimeActorId[targetRuntimeActorId] ?? IRON_INITIAL_HP),
  ))
  if (hpBefore <= 0) return { state, applied: false, reason: 'already-injured' }
  const damage = calculateIronTackleDamage(hit)
  const hp = Math.max(0, hpBefore - damage)
  const injured = hp === 0
  const next = {
    ...state,
    hpByRuntimeActorId: { ...state.hpByRuntimeActorId, [targetRuntimeActorId]: hp },
    lastHitAtByRuntimeActorId: {
      ...state.lastHitAtByRuntimeActorId,
      [targetRuntimeActorId]: atMs,
    },
    injuredRuntimeActorIds: injured
      ? [...new Set([...state.injuredRuntimeActorIds, targetRuntimeActorId])]
      : [...state.injuredRuntimeActorIds],
  }
  return {
    state: next,
    applied: true,
    event: {
      type: injured ? 'injury' : 'iron-damage',
      attackerRuntimeActorId: hit.attackerRuntimeActorId || null,
      targetRuntimeActorId,
      damage,
      hpBefore,
      hp,
      injured,
      relativeSpeed: Math.max(0, Number(hit.relativeSpeed) || 0),
      fromBehind: Boolean(hit.fromBehind),
      atMs,
    },
  }
}
