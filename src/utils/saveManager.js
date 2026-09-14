import { getTeamDefaultFormation } from '../data/teamFormations.js'
import { getPlayableTeamIds, getStorageKey } from '../config/runtime.js'
import { createInitialAiEnhancementState } from '../data/aiEnhancement.js'
import { createInitialCommercializationState } from '../data/commercialization.js'
import { getAvailableLogisticsBudget } from '../data/prizeMoney.js'

const STORAGE_KEY = getStorageKey()
export const SAVE_SCHEMA_VERSION = 2
export const JOURNEY_RUN_VERSION = 2

const STARTER_JOURNEY_INVENTORY = Object.freeze({
  'sports-drink': 1,
  'football-boots': 1,
  'tactical-board': 1,
})

function normalizeJourneyStage(stage) {
  if (stage === 'training' || stage === 'logistics' || stage === 'mini-cup-prep') return 'tournament'
  return stage || 'tournament'
}

export function migrateLegacyRunToJourney(run) {
  if (!run) return null
  return {
    ...run,
    gameMode: 'journey',
    runVersion: JOURNEY_RUN_VERSION,
    stage: normalizeJourneyStage(run.stage),
    itemInventory: { ...(run.itemInventory || {}) },
    matchItemLoadout: [...(run.matchItemLoadout || [])],
    itemDropHistory: [...(run.itemDropHistory || [])],
  }
}

/**
 * 创建初始图鉴数据
 */
export function createInitialCodex() {
  return {
    teamResults: {},
    runHistory: [],
    championFormations: [],
    records: {
      fastestGoalMinute: null,
      mostGoalsInMatch: 0,
      maxPenaltyRounds: 0,
      winStreak: 0,
      bestWinStreak: 0,
      cleanSheetStreak: 0,
      bestCleanSheetStreak: 0,
      totalMatches: 0,
      totalWins: 0,
      totalGoals: 0,
      hatTricks: 0,
      penaltiesSaved: 0,
      substituteGoals: 0,
    },
    unlockedAchievements: [],
  }
}

/**
 * 创建初始存档数据
 */
export function createInitialSaveData() {
  return {
    saveVersion: SAVE_SCHEMA_VERSION,
    unlockTeams: getPlayableTeamIds(),
    championshipHistory: [],
    currentRun: null,
    journeyRun: null,
    onlineRun: null,
    playerModeRun: null,  // 旧球员模式只用于一次性迁移与兼容备份
    legacyCoachBackup: null,
    logisticsBudgets: {},  // { [teamId]: number } 每队累积的后勤预算
    aiEnhancement: createInitialAiEnhancementState(),
    commercialization: createInitialCommercializationState(),
    codex: createInitialCodex(),
    settings: {
      sound: true,
      music: true,
      vibration: true,
      language: 'zh-CN',
    },
  }
}

/**
 * 从 localStorage 加载存档
 */
export function loadSaveData() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return createInitialSaveData()

  try {
    const initial = createInitialSaveData()
    const saved = JSON.parse(raw)
    const savedCommercialization = saved.commercialization || {}
    saved.unlockTeams = getPlayableTeamIds()
    const initialCodex = createInitialCodex()
    const savedCodex = saved.codex || {}
    const legacyPlayerRun = saved.playerModeRun
      || (saved.currentRun?.gameMode === 'player' ? saved.currentRun : null)
    const legacyCoachRun = saved.currentRun?.gameMode === 'coach' ? saved.currentRun : null
    const journeyRun = migrateLegacyRunToJourney(
      saved.journeyRun
      || (saved.currentRun?.gameMode === 'journey' ? saved.currentRun : null)
      || legacyPlayerRun
      || legacyCoachRun,
    )
    return {
      ...initial,
      ...saved,
      saveVersion: SAVE_SCHEMA_VERSION,
      currentRun: journeyRun,
      journeyRun,
      playerModeRun: saved.playerModeRun || null,
      legacyCoachBackup: saved.legacyCoachBackup || legacyCoachRun || null,
      codex: {
        ...initialCodex,
        ...savedCodex,
        records: {
          ...initialCodex.records,
          ...(savedCodex.records || {}),
        },
        teamResults: savedCodex.teamResults || {},
        runHistory: savedCodex.runHistory || [],
        unlockedAchievements: savedCodex.unlockedAchievements || [],
      },
      aiEnhancement: {
        ...initial.aiEnhancement,
        ...(saved.aiEnhancement || {}),
        cachedResponses: {
          ...initial.aiEnhancement.cachedResponses,
          ...(saved.aiEnhancement?.cachedResponses || {}),
        },
      },
      commercialization: {
        ...initial.commercialization,
        ...savedCommercialization,
        wallet: {
          ...initial.commercialization.wallet,
          ...(savedCommercialization.wallet || {}),
        },
        inventory: {
          ...initial.commercialization.inventory,
          ...(savedCommercialization.inventory || {}),
        },
        equipment: {
          ...initial.commercialization.equipment,
          ...(savedCommercialization.equipment || {}),
          playerBoots: {
            ...initial.commercialization.equipment.playerBoots,
            ...(savedCommercialization.equipment?.playerBoots || {}),
          },
          goalkeeperGloves: {
            ...initial.commercialization.equipment.goalkeeperGloves,
            ...(savedCommercialization.equipment?.goalkeeperGloves || {}),
          },
        },
        sponsor: {
          ...initial.commercialization.sponsor,
          ...(savedCommercialization.sponsor || {}),
        },
      },
      settings: {
        ...initial.settings,
        ...(saved.settings || {}),
      },
    }
  } catch {
    return createInitialSaveData()
  }
}

/**
 * 保存存档到 localStorage
 */
export function persistSaveData(saveData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
}

/**
 * 创建新的征程
 */
export function createNewRun(teamId, gameMode = 'journey', saveData = null) {
  const logisticsBudget = saveData
    ? getAvailableLogisticsBudget(teamId, saveData)
    : 3000
  return {
    teamId,
    gameMode: gameMode === 'online' ? 'online' : 'journey',
    runVersion: JOURNEY_RUN_VERSION,
    formation: getTeamDefaultFormation(teamId),
    stage: 'recruitment',
    startedAt: new Date().toISOString(),
    purchasedPlayerIds: [],
    lineup: [],
    substitutes: [],
    matchIndex: 0,
    tournamentData: null,
    logisticsLevels: {},   // { [deptId]: level } 本次 run 的部门等级
    logisticsBudget,       // 本局可用后勤预算
    itemInventory: { ...STARTER_JOURNEY_INVENTORY },
    matchItemLoadout: [],
    itemDropHistory: [],
  }
}

/**
 * 获取主页进度信息
 */
export function getHomeProgress(saveData, allTeams) {
  const championTeamIds = (saveData.championshipHistory || []).filter((teamId) =>
    allTeams.some((team) => team.id === teamId)
  )

  return {
    champion: championTeamIds.length,
    total: allTeams.length,
    championTeamIds,
  }
}

/**
 * 获取图鉴进度（用于主页入口按钮显示）
 */
export function getCodexProgress(saveData) {
  const codex = saveData.codex || {}
  const teamResults = codex.teamResults || {}
  const achievements = codex.unlockedAchievements || []
  // 国家档案达成数 + 成就解锁数
  const teamDone = Object.keys(teamResults).length
  const achieveDone = achievements.length
  const done = teamDone + achieveDone
  const total = 16 + 22 // 16队 + 22成就
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
}

/**
 * 检查是否有继续游戏
 */
export function hasContinueGame(saveData) {
  return Boolean(saveData.journeyRun || saveData.currentRun)
}
