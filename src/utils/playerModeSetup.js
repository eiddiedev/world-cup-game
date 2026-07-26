/**
 * 球员模式自动管理
 *
 * 球员模式下玩家只负责上场踢球，征召/布阵/后勤/换人全部自动：
 *  - autoSetupPlayerRun：选队后自动生成 23 人名单 + 首发 11 + 后勤分配，直达赛程。
 *  - refreshPlayerLineup：每场比赛前按可用阵容（排除伤停、按体力）重选首发。
 *  - autoAllocateLogistics：按固定优先级把后勤预算分配到 6 部门。
 *  - autoSubstituteRedSide：赛前/中场自动换下体力过低的球员。
 */
import { getTeamById } from '../data/teams'
import { getTeamDefaultFormation } from '../data/teamFormations'
import { buildRecommendedNationalSquad } from '../data/rosterRules'
import { autoSelectLineupForFormation } from './lineupFormation'
import { LOGISTICS_DEPARTMENTS, getUpgradeCost, getMaxLevel } from '../data/logisticsDepartments'
import {
  getRuntimeActorSnapshot,
  substituteRuntimeActor,
} from '../services/happySeedMatchRuntime'

const UNAVAILABLE_STATUSES = new Set(['injured', 'suspended', 'unavailable', 'red-carded'])

// 后勤升级优先级：医疗 > 营养 > 心理 > 训练 > 数据 > 球探
const LOGISTICS_PRIORITY = ['medical', 'nutrition', 'psychology', 'training', 'analytics', 'scouting']

/**
 * 把后勤预算按固定优先级分配到各部门，返回 { levels, spent }
 * levels: { [deptId]: level }，spent: 实际花掉的预算
 */
export function autoAllocateLogistics(budget = 0) {
  const levels = {}
  LOGISTICS_DEPARTMENTS.forEach((dept) => { levels[dept.id] = 0 })
  let remaining = budget
  // 多轮循环，每轮按优先级给每个部门升一级，直到预算不够
  let progressed = true
  while (progressed && remaining > 0) {
    progressed = false
    for (const deptId of LOGISTICS_PRIORITY) {
      const current = levels[deptId]
      if (current >= getMaxLevel(deptId)) continue
      const cost = getUpgradeCost(deptId, current)
      if (cost <= remaining) {
        levels[deptId] = current + 1
        remaining -= cost
        progressed = true
      }
    }
  }
  return { levels, spent: budget - remaining }
}

/**
 * 把 autoSelectLineupForFormation 返回的槽位转成带 .pos 的球员对象，
 * 对齐 LineupScreen 的 getLineupPlayersFromSlots 输出格式。
 */
function slotsToLineupPlayers(slots, playersById) {
  return slots
    .map((slot) => {
      const player = playersById.get(slot.playerId)
      if (!player) return null
      return { ...player, pos: slot.position || slot.slotId?.split('-')[0] || player.position }
    })
    .filter(Boolean)
}

function isAvailable(player) {
  return Boolean(player?.id) && !UNAVAILABLE_STATUSES.has(player.status)
}

/**
 * 选队后一次性自动建队：名单 + 首发 + 后勤，stage 直达 tournament。
 */
export function autoSetupPlayerRun(run, _saveData = null) {
  const team = getTeamById(run.teamId)
  if (!team) return run
  const formation = run.formation || getTeamDefaultFormation(team.id)
  const squad = buildRecommendedNationalSquad(team.players || [], team.budget, formation)
  const playersById = new Map(squad.map((player) => [player.id, player]))
  const slots = autoSelectLineupForFormation(squad, formation)
  const lineup = slotsToLineupPlayers(slots, playersById)
  const budget = run.logisticsBudget ?? 0
  const { levels: logisticsLevels, spent } = autoAllocateLogistics(budget)

  return {
    ...run,
    formation,
    purchasedPlayerIds: squad,
    roster: squad,
    lineup,
    logisticsLevels,
    logisticsBudget: Math.max(0, budget - spent),
    matchIndex: 0,
    stage: 'tournament',
  }
}

/**
 * 每场比赛前刷新首发：从可用名单（排除伤停）重选 11 人。
 * 返回更新后的 run（仅改 lineup / formation）。
 */
export function refreshPlayerLineup(run) {
  const roster = run.roster || run.purchasedPlayerIds || []
  const formation = run.formation || getTeamDefaultFormation(run.teamId)
  const available = roster.filter(isAvailable)
  const playersById = new Map(available.map((player) => [player.id, player]))
  const slots = autoSelectLineupForFormation(available, formation)
  const lineup = slotsToLineupPlayers(slots, playersById)
  return { ...run, formation, lineup }
}

const INELIGIBLE_SOURCE_STATUSES = new Set(['injured', 'suspended', 'unavailable'])
const AUTO_SUB_STAMINA_THRESHOLD = 58 // 体力低于此值才考虑换下
const AUTO_SUB_MAX_PER_WINDOW = 3 // 单个窗口最多自动换几人

/**
 * 自动换人：换下红方体力过低（或受伤）的非门将球员，换上位置匹配的最佳替补。
 * 复用 Runtime 换人通道 substituteRuntimeActor，返回实际完成的换人数。
 */
export function autoSubstituteRedSide() {
  const snapshot = getRuntimeActorSnapshot()
  const actors = snapshot?.actors || []
  const onPitch = actors.filter((actor) => (
    actor.side === 'red' && actor.state?.onPitch && !actor.isGoalkeeper
  ))
  const bench = (snapshot?.sides?.red?.bench || []).filter((player) => (
    player.state?.status === 'bench'
    && player.naturalPosition !== 'GK'
    && !INELIGIBLE_SOURCE_STATUSES.has(player.sourceStatus)
  ))
  if (!onPitch.length || !bench.length) return 0

  // 需要被换下的球员：体力过低，按体力升序
  const tired = onPitch
    .filter((actor) => Number(actor.state?.stamina ?? 100) < AUTO_SUB_STAMINA_THRESHOLD)
    .sort((a, b) => Number(a.state?.stamina ?? 100) - Number(b.state?.stamina ?? 100))

  const usedBenchIds = new Set()
  let done = 0
  for (const outgoing of tired) {
    if (done >= AUTO_SUB_MAX_PER_WINDOW) break
    // 位置匹配优先，其次体力最高
    const incoming = bench
      .filter((player) => !usedBenchIds.has(player.playerId))
      .sort((a, b) => {
        const aExact = a.naturalPosition === outgoing.assignedPosition
          || a.naturalPosition === outgoing.naturalPosition
        const bExact = b.naturalPosition === outgoing.assignedPosition
          || b.naturalPosition === outgoing.naturalPosition
        if (aExact !== bExact) return aExact ? -1 : 1
        return Number(b.state?.stamina || 0) - Number(a.state?.stamina || 0)
      })[0]
    if (!incoming) break
    if (substituteRuntimeActor('red', outgoing.playerId, incoming.playerId)) {
      usedBenchIds.add(incoming.playerId)
      done += 1
    }
  }
  return done
}
