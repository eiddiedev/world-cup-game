/**
 * 更衣室决策引擎 — 场景选择与效果结算
 * 效果立即写入 actor.state（morale/form/stamina），并通过
 * moraleBonus 进入决策成功率公式，真实影响比赛走向。
 */
import { LOCKER_ROOM_DECISIONS } from '../data/lockerRoomDecisions.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0))

// 与 Runtime 换人资格校验保持一致：受伤/停赛/不可用的替补不能被换上场
const INELIGIBLE_SOURCE_STATUSES = new Set(['injured', 'suspended', 'unavailable'])

// 场景文案按阶段适配：赛前不出现“上半场/下半场/中场休息”等赛中表述
export function getLockerRoomSituation(scenario, phase) {
  return scenario?.situationByPhase?.[phase] || scenario?.situation || ''
}

/**
 * 为更衣室换人决策挑选换人对象：
 * strategy = 'primary' 换下评分最高的场上非门将球员（核心球员）
 * strategy = 'lowest-stamina' 换下体能最低的非门将球员（轮换/抽筋）
 * 换入者从替补席挑选：位置匹配优先，其次体能最高。
 */
export function pickLockerRoomSubstitution(actorSnapshot = {}, strategy = 'primary') {
  const onPitch = (actorSnapshot.actors || []).filter((actor) => (
    actor.side === 'red' && actor.state?.onPitch && !actor.isGoalkeeper
  ))
  if (!onPitch.length) return null
  const outgoing = strategy === 'lowest-stamina'
    ? [...onPitch].sort((left, right) => (
      Number(left.state?.stamina ?? 100) - Number(right.state?.stamina ?? 100)
    ))[0]
    : [...onPitch].sort((left, right) => (
      Number(right.rating || 0) - Number(left.rating || 0)
    ))[0]
  const bench = (actorSnapshot.sides?.red?.bench || []).filter((player) => (
    player.state?.status === 'bench'
    && player.naturalPosition !== 'GK'
    && !INELIGIBLE_SOURCE_STATUSES.has(player.sourceStatus)
  ))
  if (!outgoing || !bench.length) return null
  const incoming = [...bench].sort((left, right) => {
    const leftExact = left.naturalPosition === outgoing.assignedPosition
      || left.naturalPosition === outgoing.naturalPosition
    const rightExact = right.naturalPosition === outgoing.assignedPosition
      || right.naturalPosition === outgoing.naturalPosition
    if (leftExact !== rightExact) return leftExact ? -1 : 1
    return Number(right.state?.stamina || 0) - Number(left.state?.stamina || 0)
  })[0]
  if (!incoming) return null
  return { outgoing, incoming }
}

function conditionForScoreDiff(scoreDiff) {
  if (scoreDiff > 0) return 'leading'
  if (scoreDiff < 0) return 'trailing'
  return 'draw'
}

export function selectLockerRoomScenario({ phase, scoreDiff = 0, usedIds = [], randomFn = Math.random } = {}) {
  const condition = conditionForScoreDiff(scoreDiff)
  const eligible = LOCKER_ROOM_DECISIONS.filter((scenario) => (
    (scenario.phases || [scenario.phase]).includes(phase)
    && (scenario.condition === 'any' || scenario.condition === condition)
    && !usedIds.includes(scenario.id)
  ))
  if (!eligible.length) return null
  return eligible[Math.floor(randomFn() * eligible.length)]
}

function targetActors(actors, scope, randomFn) {
  const outfield = actors.filter((actor) => !actor.isGoalkeeper)
  if (scope === 'all') return actors
  if (scope === 'defense') {
    const defenders = outfield.filter((actor) => actor.assignedPosition === 'DF')
    return defenders.length ? defenders : outfield.slice(0, 3)
  }
  if (scope === 'attack') {
    const attackers = outfield.filter((actor) => ['FW', 'MF'].includes(actor.assignedPosition))
    return attackers.length ? attackers : outfield.slice(-3)
  }
  if (scope === 'primary') {
    return [[...outfield].sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0))[0]].filter(Boolean)
  }
  // random
  return [outfield[Math.floor(randomFn() * outfield.length)]].filter(Boolean)
}

const FIELDS = ['morale', 'form', 'stamina']

export function resolveLockerRoomChoice(scenario, choiceId, { actors = [], randomFn = Math.random } = {}) {
  const choice = scenario?.choices?.find((candidate) => candidate.id === choiceId)
  if (!choice) throw new Error(`未知更衣室选择：${scenario?.id}/${choiceId}`)
  const patches = new Map()
  const applyDelta = (actor, field, delta) => {
    if (!actor?.runtimeActorId || !delta) return
    const current = patches.get(actor.runtimeActorId) || { morale: 0, form: 0, stamina: 0 }
    current[field] += delta
    patches.set(actor.runtimeActorId, current)
    const stateKey = field === 'stamina' ? 'stamina' : field
    const base = Number(actor.state?.[stateKey] ?? (field === 'stamina' ? 80 : 70))
    actor.state[stateKey] = clamp(base + delta, 0, field === 'stamina' ? 100 : 99)
  }
  for (const effect of choice.effects || []) {
    const targets = targetActors(actors, effect.scope, randomFn)
    for (const actor of targets) {
      for (const field of FIELDS) {
        if (effect[field] != null) applyDelta(actor, field, effect[field])
      }
    }
  }
  const affected = [...patches.entries()].map(([runtimeActorId, deltas]) => {
    const actor = actors.find((candidate) => candidate.runtimeActorId === runtimeActorId)
    return {
      runtimeActorId,
      name: actor?.name || '球员',
      number: actor?.number,
      deltas,
    }
  })
  const averageDelta = (field) => {
    const values = affected.map((entry) => entry.deltas[field] || 0)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  }
  const average = {
    morale: averageDelta('morale'),
    form: averageDelta('form'),
    stamina: averageDelta('stamina'),
  }
  // 极端情况下名单未就绪（打不到任何人）时，仍按设计效果展示，避免满屏 +0
  if (!affected.length) {
    for (const effect of choice.effects || []) {
      const weight = effect.scope === 'all' ? 1 : 0.4
      for (const field of FIELDS) average[field] += (effect[field] || 0) * weight
    }
  }
  return {
    scenarioId: scenario.id,
    choiceId,
    label: choice.label,
    resultText: choice.result,
    affected,
    average,
  }
}

// 士气/状态 → 决策成功率加成（上下限 ±0.07）
export function lockerRoomMoraleBonus(actors = []) {
  const onPitch = actors.filter((actor) => actor?.state?.onPitch !== false)
  if (!onPitch.length) return 0
  const morale = onPitch.reduce((sum, actor) => sum + Number(actor.state?.morale ?? 70), 0) / onPitch.length
  const form = onPitch.reduce((sum, actor) => sum + Number(actor.state?.form ?? 70), 0) / onPitch.length
  return clamp((morale - 70) * 0.004 + (form - 70) * 0.003, -0.07, 0.07)
}
