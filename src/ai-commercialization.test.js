import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AI_ENHANCEMENT_SCENES,
  AI_SCENE_DEFINITIONS,
  createAiEnhancementRequest,
} from './data/aiEnhancement.js'
import {
  COMMERCIAL_ENTRY_POINTS,
  COMMERCIAL_FAIRNESS_RULES,
  COMMERCIAL_ITEMS,
  createInitialCommercializationState,
} from './data/commercialization.js'
import { requestAiEnhancement } from './services/aiEnhancementService.js'
import { createInitialSaveData, loadSaveData } from './utils/saveManager.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AI enhancement phase-one contract', () => {
  it('normalizes the unified AiEnhancementRequest shape', () => {
    const request = createAiEnhancementRequest({
      scene: AI_ENHANCEMENT_SCENES.PRE_MATCH_SCOUT,
      playerTeam: { id: 'france', name: '法国' },
      opponentTeam: { name: '挪威' },
      recentEvents: Array.from({ length: 15 }, (_, index) => `event-${index}`),
    })

    expect(Object.keys(request)).toEqual([
      'scene',
      'matchSnapshot',
      'playerTeam',
      'opponentTeam',
      'recentEvents',
      'locale',
    ])
    expect(request.recentEvents).toHaveLength(12)
    expect(request.locale).toBe('zh-CN')
  })

  it('returns a local fallback for all six scenes without using fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(AI_SCENE_DEFINITIONS).toHaveLength(6)
    for (const definition of AI_SCENE_DEFINITIONS) {
      const response = await requestAiEnhancement({
        scene: definition.scene,
        matchSnapshot: {},
        playerTeam: { name: '法国' },
        opponentTeam: { name: '巴西' },
        recentEvents: [],
        locale: 'zh-CN',
      })
      expect(response.source).toBe('local-fallback')
      expect(response.items.length).toBeGreaterThan(0)
    }

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falls back when a future provider fails', async () => {
    const provider = { generate: vi.fn().mockRejectedValue(new Error('offline')) }
    const response = await requestAiEnhancement({
      scene: AI_ENHANCEMENT_SCENES.POST_MATCH_REVIEW,
      matchSnapshot: { homeScore: 1, awayScore: 0 },
      playerTeam: { name: '法国' },
      opponentTeam: { name: '巴西' },
      recentEvents: [],
      locale: 'zh-CN',
    }, { provider })

    expect(response.source).toBe('local-fallback')
    expect(response.fallbackReason).toBe('provider_request_failed')
  })
})

describe('commercialization phase-one contract', () => {
  it('defines five visible entries and six timing-specific items', () => {
    expect(COMMERCIAL_ENTRY_POINTS.map(entry => entry.label)).toEqual([
      '赞助商加码',
      '品牌补给站',
      '训练道具',
      '球鞋装备',
      '赛后奖励',
    ])
    expect(COMMERCIAL_ITEMS).toHaveLength(6)
    COMMERCIAL_ITEMS.forEach(item => {
      expect(item.useTiming).toEqual(expect.any(String))
      expect(item.effectIntent.type).toEqual(expect.any(String))
      expect(item.tradeoff).toEqual(expect.any(String))
    })
  })

  it('keeps all pay-to-win and real SDK switches disabled', () => {
    expect(COMMERCIAL_FAIRNESS_RULES).toEqual({
      directScorePurchase: false,
      directWinPurchase: false,
      decisionProbabilityPurchase: false,
      refereeBiasPurchase: false,
      realPaymentEnabled: false,
      realAdSdkEnabled: false,
    })
  })

  it('creates empty economy fields and merges them into older saves', () => {
    const initialCommercialization = createInitialCommercializationState()
    expect(initialCommercialization.inventory['sports-drink']).toBe(0)
    expect(initialCommercialization.rewardLedger).toEqual([])

    const oldSave = {
      unlockTeams: ['france'],
      championshipHistory: [],
      currentRun: null,
      settings: { sound: false },
    }
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(oldSave)),
      setItem: vi.fn(),
    })

    const merged = loadSaveData()
    expect(merged.settings.sound).toBe(false)
    expect(merged.aiEnhancement.fallbackEnabled).toBe(true)
    expect(merged.commercialization.inventory['goalkeeper-gloves']).toBe(0)
    expect(createInitialSaveData().commercialization.wallet.teamFunds).toBe(0)
  })
})
