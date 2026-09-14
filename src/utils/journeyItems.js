import { COMMERCIAL_ITEMS } from '../data/commercialization.js'

export const MAX_MATCH_ITEMS = 3
export const JOURNEY_ITEM_IDS = Object.freeze(COMMERCIAL_ITEMS.map((item) => item.id))
export const STARTER_JOURNEY_INVENTORY = Object.freeze({
  'sports-drink': 1,
  'football-boots': 1,
  'tactical-board': 1,
})

const ITEM_BY_ID = new Map(COMMERCIAL_ITEMS.map((item) => [item.id, item]))
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0))
const playerIdOf = (player) => player?.id || player?.playerId || player

function rosterMap(run) {
  return new Map((run.roster || run.purchasedPlayerIds || []).map((player) => [playerIdOf(player), player]))
}

export function normalizeJourneyInventory(inventory = {}) {
  return Object.fromEntries(JOURNEY_ITEM_IDS.map((itemId) => [
    itemId,
    Math.max(0, Math.floor(Number(inventory[itemId]) || 0)),
  ]))
}

export function validateJourneyLoadout(run = {}, selections = []) {
  const errors = []
  if (!Array.isArray(selections)) return { valid: false, errors: ['道具配置格式无效'] }
  if (selections.length > MAX_MATCH_ITEMS) errors.push(`每场最多携带 ${MAX_MATCH_ITEMS} 件道具`)
  const inventory = normalizeJourneyInventory(run.itemInventory)
  const requested = {}
  const players = rosterMap(run)

  selections.forEach((selection, index) => {
    const item = ITEM_BY_ID.get(selection?.itemId)
    if (!item) {
      errors.push(`第 ${index + 1} 件道具不存在`)
      return
    }
    requested[item.id] = (requested[item.id] || 0) + 1
    const targets = [...new Set((selection.targetPlayerIds || []).filter(Boolean))]
    const targetPlayers = targets.map((id) => players.get(id)).filter(Boolean)
    if (targets.length !== targetPlayers.length) errors.push(`${item.label}包含无效球员`)
    if (['sports-drink', 'ice-pack', 'football-boots', 'goalkeeper-gloves'].includes(item.id)
      && targets.length !== 1) errors.push(`${item.label}需要选择 1 名球员`)
    if (item.id === 'football-boots' && targetPlayers.some((player) => player.position === 'GK')) {
      errors.push('球鞋不能装备给门将')
    }
    if (item.id === 'goalkeeper-gloves' && targetPlayers.some((player) => player.position !== 'GK')) {
      errors.push('门将手套只能装备给门将')
    }
    if (item.id === 'ice-pack') {
      const duration = Number(run.injuryMatches?.[targets[0]] || 0)
      if (duration !== 1) errors.push('冰袋只能用于剩余 1 轮的轻伤球员')
    }
    if (item.id === 'training-equipment' && (targets.length < 1 || targets.length > 3)) {
      errors.push('训练器材需要选择 1–3 名球员')
    }
  })

  Object.entries(requested).forEach(([itemId, count]) => {
    if (count > inventory[itemId]) errors.push(`${ITEM_BY_ID.get(itemId)?.label || itemId}库存不足`)
  })
  return { valid: errors.length === 0, errors }
}

function currentPlayerState(run, playerId, players) {
  const player = players.get(playerId) || {}
  return {
    ...(run.playerMatchStates?.[playerId] || {}),
    stamina: clamp(run.playerMatchStates?.[playerId]?.stamina ?? player.stamina ?? player.sta ?? 80, 0, 100),
    form: clamp(run.playerMatchStates?.[playerId]?.form ?? player.form ?? 70, 0, 99),
    morale: clamp(run.playerMatchStates?.[playerId]?.morale ?? player.morale ?? 70, 0, 99),
  }
}

export function applyJourneyLoadout(run = {}, selections = [], now = new Date().toISOString()) {
  const validation = validateJourneyLoadout(run, selections)
  if (!validation.valid) return { run, effects: [], ...validation }

  const players = rosterMap(run)
  const inventory = normalizeJourneyInventory(run.itemInventory)
  const states = { ...(run.playerMatchStates || {}) }
  const injuryMatches = { ...(run.injuryMatches || {}) }
  const effects = []
  const transientItemEffects = {}
  const lineupIds = (run.lineup || []).map(playerIdOf).filter(Boolean)

  const patchState = (playerId, patch) => {
    states[playerId] = { ...currentPlayerState({ ...run, playerMatchStates: states }, playerId, players), ...patch }
  }
  const rememberTransient = (playerId, key, amount) => {
    transientItemEffects[playerId] = {
      ...(transientItemEffects[playerId] || {}),
      [key]: Number(transientItemEffects[playerId]?.[key] || 0) + amount,
    }
  }

  selections.forEach((selection) => {
    const item = ITEM_BY_ID.get(selection.itemId)
    const targets = [...new Set(selection.targetPlayerIds || [])]
    if (item.id === 'sports-drink') {
      const playerId = targets[0]
      const state = currentPlayerState({ ...run, playerMatchStates: states }, playerId, players)
      patchState(playerId, { stamina: clamp(state.stamina + 8, 0, 100) })
    } else if (item.id === 'ice-pack') {
      const playerId = targets[0]
      const next = Math.max(0, Number(injuryMatches[playerId] || 0) - 1)
      if (next) injuryMatches[playerId] = next
      else delete injuryMatches[playerId]
    } else if (item.id === 'football-boots' || item.id === 'goalkeeper-gloves') {
      const playerId = targets[0]
      const state = currentPlayerState({ ...run, playerMatchStates: states }, playerId, players)
      const nextForm = clamp(state.form + 5, 0, 99)
      patchState(playerId, { form: nextForm })
      rememberTransient(playerId, 'form', nextForm - state.form)
    } else if (item.id === 'tactical-board') {
      lineupIds.forEach((playerId) => {
        const state = currentPlayerState({ ...run, playerMatchStates: states }, playerId, players)
        const nextMorale = clamp(state.morale + 3, 0, 99)
        patchState(playerId, { morale: nextMorale })
        rememberTransient(playerId, 'morale', nextMorale - state.morale)
      })
    } else if (item.id === 'training-equipment') {
      targets.slice(0, 3).forEach((playerId) => {
        const state = currentPlayerState({ ...run, playerMatchStates: states }, playerId, players)
        patchState(playerId, {
          form: clamp(state.form + 3, 0, 99),
          stamina: clamp(state.stamina - 5, 0, 100),
        })
      })
    }
    inventory[item.id] -= 1
    effects.push({
      itemId: item.id,
      label: item.label,
      targetPlayerIds: item.id === 'tactical-board' ? lineupIds : targets,
    })
  })

  const injuredPlayers = (run.injuredPlayers || []).filter((playerId) => injuryMatches[playerId] > 0)
  return {
    valid: true,
    errors: [],
    effects,
    run: {
      ...run,
      itemInventory: inventory,
      playerMatchStates: states,
      injuryMatches,
      injuredPlayers,
      matchItemLoadout: effects,
      matchItemLoadoutLocked: true,
      matchItemEffectsAppliedAt: now,
      transientItemEffects,
      stage: 'match',
    },
  }
}

export function clearJourneyTransientItemEffects(run = {}) {
  const transient = run.transientItemEffects || {}
  if (!Object.keys(transient).length) return { ...run, transientItemEffects: {} }
  const states = { ...(run.playerMatchStates || {}) }
  Object.entries(transient).forEach(([playerId, deltas]) => {
    if (!states[playerId]) return
    states[playerId] = {
      ...states[playerId],
      form: clamp(Number(states[playerId].form ?? 70) - Number(deltas.form || 0), 0, 99),
      morale: clamp(Number(states[playerId].morale ?? 70) - Number(deltas.morale || 0), 0, 99),
    }
  })
  return { ...run, playerMatchStates: states, transientItemEffects: {} }
}

function stableHash(value) {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function awardJourneyDrops(run = {}, report = {}) {
  const matchId = report.matchId || `journey-${run.matchIndex || 0}-${run.knockoutRound || 'group'}`
  const history = [...(run.itemDropHistory || [])]
  if (history.some((entry) => entry.matchId === matchId)) return { run, drops: [] }
  if (report.forfeited) {
    return {
      run: { ...run, lastMatchDrops: [], matchItemLoadout: [], matchItemLoadoutLocked: false },
      drops: [],
    }
  }

  const count = report.result === 'win' ? 2 : 1
  const drops = Array.from({ length: count }, (_, index) => (
    JOURNEY_ITEM_IDS[stableHash(`${matchId}:${index}`) % JOURNEY_ITEM_IDS.length]
  ))
  const inventory = normalizeJourneyInventory(run.itemInventory)
  drops.forEach((itemId) => { inventory[itemId] += 1 })
  const entry = { matchId, result: report.result, itemIds: drops, awardedAt: report.completedAt || null }
  return {
    drops,
    run: {
      ...run,
      itemInventory: inventory,
      lastMatchDrops: drops,
      itemDropHistory: [...history, entry].slice(-40),
      matchItemLoadout: [],
      matchItemLoadoutLocked: false,
    },
  }
}

export function getJourneyItem(itemId) {
  return ITEM_BY_ID.get(itemId) || null
}
