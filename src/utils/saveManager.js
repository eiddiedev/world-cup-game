import { getTeamDefaultFormation } from '../data/teamFormations.js'
import { getPlayableTeamIds, getStorageKey } from '../config/runtime.js'
import { createInitialAiEnhancementState } from '../data/aiEnhancement.js'
import { createInitialCommercializationState } from '../data/commercialization.js'

const STORAGE_KEY = getStorageKey()

/**
 * 创建初始存档数据
 */
export function createInitialSaveData() {
  return {
    unlockTeams: getPlayableTeamIds(),
    championshipHistory: [],
    currentRun: null,
    aiEnhancement: createInitialAiEnhancementState(),
    commercialization: createInitialCommercializationState(),
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
    return {
      ...initial,
      ...saved,
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
export function createNewRun(teamId, gameMode = 'coach') {
  return {
    teamId,
    gameMode,
    formation: getTeamDefaultFormation(teamId),
    stage: 'recruitment',
    startedAt: new Date().toISOString(),
    purchasedPlayerIds: [],
    lineup: [],
    substitutes: [],
    matchIndex: 0,
    tournamentData: null,
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
 * 检查是否有继续游戏
 */
export function hasContinueGame(saveData) {
  return Boolean(saveData.currentRun)
}
