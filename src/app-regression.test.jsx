/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import LineupScreen from './components/LineupScreen.jsx'
import SettingsScreen from './components/SettingsScreen.jsx'
import { simulateGroupStage } from './components/TournamentScreen.jsx'
import { DECISION_LIBRARY } from './data/decisionLibrary.js'
import {
  DATA_RUNTIME_CONSTRAINTS,
  buildTeamAiContext,
} from './data/teamDataContracts.js'
import {
  ROSTER_POOL_RULES,
  SAMPLE_TEAM_IDS,
  TEAM_DATA_SCHEMA_VERSION,
  VISUAL_RECIPE_RULE,
  WORLD_CUP_TEAM_CAPACITY,
  buildVisualRecipeId,
  validateTeamCatalog,
  validateTeamRecord,
} from './data/teamDataSchema.js'
import { allTeams, teams } from './data/teams.js'
import { getTeamSchedule } from './data/schedules.js'
import { FORMATION_TACTICS } from './data/formationTactics.js'
import { AudioManager, audioManager } from './utils/audioManager.js'
import {
  outcomeConcedesPenalty,
  executeDecision,
  resolveChoiceResult,
  resolveDiveChoice,
  resolveMatchPenaltyChoice,
  resolveOpponentPenaltyChoice,
  selectKeyPlayers,
  shouldTriggerDecision,
} from './utils/decisionSystem.js'
import { calculateLineupRatings, calculateOpponentPressure } from './utils/lineupBalance.js'
import {
  getOpponentMatchSetup,
  resolveOpponentStrength,
} from './utils/opponentTactics.js'
import { getFallbackKnockoutOpponents } from './utils/knockoutResolver.js'
import { createInitialSaveData, createNewRun, loadSaveData } from './utils/saveManager.js'
import { buildPostMatchInsights } from './utils/postMatchInsights.js'
import { getNextRunAfterMatch } from './utils/tournamentProgress.js'
import { adaptLineupToFormation, autoSelectLineupForFormation } from './utils/lineupFormation.js'
import { getTeamDefaultFormation } from './data/teamFormations.js'
import {
  MIN_PURCHASE,
  buildRecommendedNationalSquad,
  validateNationalSquad,
} from './data/rosterRules.js'
import { getMatchKits, getTeamKit } from './data/teamKits.js'
import {
  PIXEL_PLAYER_ACTIONS,
  buildPixelPlayerModel,
  getPixelPlayerProductionRules,
} from './utils/pixelPlayerRecipe.js'
import {
  getShootoutWinner,
  resolveOpponentShootoutKick,
  resolveUserShootoutKick,
} from './utils/penaltyShootout.js'
import { getStorageKey, selectPlayableTeams } from './config/runtime.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('home screen', () => {
  it('opens the coach save dialog and routes a new save into team selection', async () => {
    const clickSpy = vi.spyOn(audioManager, 'playClick').mockImplementation(() => true)
    const store = new Map()
    const localStorageMock = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      clear: vi.fn(() => store.clear()),
    }
    vi.stubGlobal('localStorage', localStorageMock)
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
    render(<App />)

    const coachButton = await screen.findByRole('button', { name: '教练模式' })
    fireEvent.pointerDown(coachButton)
    fireEvent.click(coachButton)

    const newSaveButton = await screen.findByRole('button', { name: '新的挑战' })
    fireEvent.click(newSaveButton)

    expect(clickSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText('选择国家队')).toBeInTheDocument()
    })
  })

  it('opens the pixel settings screen from the home menu', async () => {
    const store = new Map()
    const localStorageMock = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      clear: vi.fn(() => store.clear()),
    }
    vi.stubGlobal('localStorage', localStorageMock)
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '设置' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^音效/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /音乐/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /震动/ })).toBeInTheDocument()
    })
  })

  it('shows only the two primary modes and settings on the home screen', () => {
    const navigateTo = vi.fn()
    render(
      <HomeScreen
        saveData={createInitialSaveData()}
        navigateTo={navigateTo}
        showToast={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '教练模式' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '球员模式' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '点球测试' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '小人样板' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'AI与赞助' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /图鉴/ })).not.toBeInTheDocument()
    expect(screen.queryByText('四队迷你世界杯')).not.toBeInTheDocument()
    expect(screen.queryByText('两场夺冠 · 约 5–7 分钟')).not.toBeInTheDocument()
  })

  it('stores the selected mode when starting a player-mode save', () => {
    const navigateTo = vi.fn()
    render(
      <HomeScreen
        saveData={createInitialSaveData()}
        navigateTo={navigateTo}
        showToast={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '球员模式' }))
    expect(screen.getByRole('dialog', { name: '球员模式' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续征程' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '新的挑战' }))
    expect(navigateTo).toHaveBeenCalledWith('team-select', { gameMode: 'player' })
  })
})

describe('mobile lineup interaction', () => {
  it('renders the right-side bench with draggable players', () => {
    const goalkeeper = {
      id: 'touch-gk',
      name: '触屏门将',
      number: 1,
      position: 'GK',
      rating: 82,
      form: 84,
      speed: 50,
      physical: 80,
      technique: 70,
      defense: 84,
      stamina: 78,
    }
    const saveData = {
      currentRun: {
        teamId: 'france',
        currentOpponent: '伊拉克',
        roster: [goalkeeper],
        lineup: [],
        formation: '4-3-3',
        injuredPlayers: [],
        suspendedPlayers: [],
      },
    }

    const { container } = render(
      <LineupScreen
        saveData={saveData}
        updateSaveData={vi.fn()}
        navigateTo={vi.fn()}
        showToast={vi.fn()}
      />,
    )

    // 右边替补席应包含可拖拽的球员
    const benchPlayer = container.querySelector('.bench-player[draggable]')
    expect(benchPlayer).toBeInTheDocument()
    expect(benchPlayer).toHaveTextContent('触屏门将')

    // 球场 GK 槽位应存在
    const goalkeeperSlot = container.querySelector('[data-slot-id="GK-0"]')
    expect(goalkeeperSlot).toBeInTheDocument()
  })

  it('places a player with a touch pointer drag and keeps intel collapsed by default', () => {
    const goalkeeper = {
      id: 'touch-drag-gk',
      name: '手势门将',
      number: 1,
      position: 'GK',
      rating: 82,
      form: 84,
      speed: 50,
      physical: 80,
      technique: 70,
      defense: 84,
      stamina: 78,
    }
    const saveData = {
      currentRun: {
        teamId: 'france',
        currentOpponent: '伊拉克',
        roster: [goalkeeper],
        lineup: [],
        formation: '4-3-3',
        injuredPlayers: [],
        suspendedPlayers: [],
        logisticsLevels: { dataCenter: 1, intelDepartment: 1 },
      },
    }

    const { container } = render(
      <LineupScreen
        saveData={saveData}
        updateSaveData={vi.fn()}
        navigateTo={vi.fn()}
        showToast={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '展开' })).toBeInTheDocument()
    expect(container.querySelector('.intel-content')).not.toBeInTheDocument()

    const benchPlayer = container.querySelector('.bench-player')
    const goalkeeperSlot = container.querySelector('[data-slot-id="GK-0"]')
    const originalElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => goalkeeperSlot),
    })

    const createTouchPointerEvent = (type, clientX, clientY) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
      })
      Object.defineProperties(event, {
        pointerId: { value: 7 },
        pointerType: { value: 'touch' },
      })
      return event
    }

    fireEvent(benchPlayer, createTouchPointerEvent('pointerdown', 600, 320))
    fireEvent(benchPlayer, createTouchPointerEvent('pointermove', 420, 180))
    fireEvent(benchPlayer, createTouchPointerEvent('pointerup', 260, 180))

    expect(goalkeeperSlot).toHaveTextContent('1')
    expect(container.querySelector('.rating-count')).toHaveTextContent('1/11')

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: originalElementFromPoint,
    })
  })
})

describe('settings and audio', () => {
  it('merges missing settings from older saves', () => {
    const store = new Map([
      ['targeting-2026-save', JSON.stringify({
        unlockTeams: ['france'],
        settings: { sound: false },
      })],
    ])
    const localStorageMock = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, value) => store.set(key, value)),
      clear: vi.fn(() => store.clear()),
    }
    vi.stubGlobal('localStorage', localStorageMock)
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })

    expect(loadSaveData().settings).toEqual({
      sound: false,
      music: true,
      vibration: true,
      language: 'zh-CN',
    })
  })

  it('persists settings toggles and applies them to audio', () => {
    const updateSaveData = vi.fn()
    const applySpy = vi.spyOn(audioManager, 'applySettings').mockImplementation(() => {})
    render(
      <SettingsScreen
        saveData={createInitialSaveData()}
        updateSaveData={updateSaveData}
        navigateTo={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^音效/ }))

    expect(updateSaveData).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ sound: false }),
    }))
    expect(applySpy).toHaveBeenCalledWith(expect.objectContaining({ sound: false }))
    applySpy.mockRestore()
  })

  it('respects sound and music switches in the audio manager', () => {
    const manager = new AudioManager()
    const click = vi.fn()
    manager.sounds.click = click
    manager.applySettings({ sound: false, music: true, vibration: true })

    expect(manager.playSound('click')).toBe(false)
    expect(click).not.toHaveBeenCalled()

    manager.applySettings({ sound: true, music: false, vibration: true })
    expect(manager.musicEnabled).toBe(false)
    expect(manager.musicPlaying).toBe(false)
    expect(manager.playSound('click')).toBe(true)
    expect(click).toHaveBeenCalled()
  })

  it('plays generated effects through a buffer source output path', () => {
    const start = vi.fn()
    const connect = vi.fn()
    class FakeAudioContext {
      constructor() {
        this.sampleRate = 8000
        this.state = 'running'
        this.destination = {}
      }

      createGain() {
        return { gain: { value: 1 }, connect: vi.fn() }
      }

      createBuffer(_channels, length) {
        return { getChannelData: () => new Float32Array(length) }
      }

      createBufferSource() {
        return { connect, start, buffer: null }
      }
    }
    window.AudioContext = FakeAudioContext
    const manager = new AudioManager()
    manager.init({ sound: true, music: false, vibration: true })

    expect(manager.playSound('click')).toBe(true)
    expect(connect).toHaveBeenCalledWith(manager.audioContext.destination)
    expect(start).toHaveBeenCalled()
  })

  it('uses a layered rain sound and follows the sound switch', () => {
    const starts = []
    const stops = []
    class FakeRainAudioContext {
      constructor() {
        this.sampleRate = 8000
        this.state = 'running'
        this.destination = {}
      }

      createGain() {
        return { gain: { value: 1 }, connect: vi.fn() }
      }

      createBiquadFilter() {
        return {
          type: '',
          frequency: { value: 0 },
          Q: { value: 0 },
          connect: vi.fn(),
        }
      }

      createBuffer(_channels, length) {
        return { getChannelData: () => new Float32Array(length) }
      }

      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          connect: vi.fn(),
          start: () => starts.push(true),
          stop: () => stops.push(true),
        }
      }
    }
    window.AudioContext = FakeRainAudioContext
    const manager = new AudioManager()
    manager.init({ sound: true, music: false, vibration: true })

    expect(manager.startRainAmbient()).toBe(true)
    expect(manager._rainNode).not.toBeNull()
    expect(starts).toHaveLength(1)

    manager.applySettings({ sound: false, music: false, vibration: true })
    expect(manager._rainNode).toBeNull()
    expect(stops).toHaveLength(1)

    manager.applySettings({ sound: true, music: false, vibration: true })
    expect(manager._rainNode).not.toBeNull()
    expect(starts).toHaveLength(2)
    manager.stopRainAmbient()
  })

  it('stops match-only audio without disabling menu music or future sound effects', () => {
    const pause = vi.fn()
    const stoppedSource = { stop: vi.fn() }
    const manager = new AudioManager()
    manager.musicPlaying = true
    manager._crowdRequested = true
    manager._crowdNode = { pause, currentTime: 12 }
    manager._activeMatchAudioNodes.add({ pause, currentTime: 4 })
    manager._activeMatchBufferSources.add(stoppedSource)

    manager.stopMatchAudio()

    expect(manager._crowdRequested).toBe(false)
    expect(manager._crowdNode).toBeNull()
    expect(manager._activeMatchAudioNodes.size).toBe(0)
    expect(manager._activeMatchBufferSources.size).toBe(0)
    expect(stoppedSource.stop).toHaveBeenCalledWith(0)
    expect(manager.musicPlaying).toBe(true)
    expect(manager.soundEnabled).toBe(true)
  })
})

describe('team and player data', () => {
  it('limits the Douyin demo to the requested representative teams', () => {
    const sourceTeams = [
      { id: 'spain' },
      { id: 'france' },
      { id: 'argentina' },
      { id: 'england' },
      { id: 'norway' },
      { id: 'capeverde' },
      { id: 'brazil' },
      { id: 'curacao' },
    ]

    expect(selectPlayableTeams(sourceTeams, false).map(team => team.id)).toEqual([
      'spain',
      'france',
      'argentina',
      'england',
      'norway',
      'capeverde',
      'brazil',
      'curacao',
    ])
    expect(selectPlayableTeams(sourceTeams, true).map(team => team.id)).toEqual([
      'france',
      'curacao',
    ])
    expect(getStorageKey(false)).toBe('targeting-2026-save')
    expect(getStorageKey(true)).toBe('targeting-2026-douyin-demo-save')
  })

  it('keeps every selectable team at a 24-player pool with one named golden star', () => {
    const goldenNames = [
      '世一腰',
      '潘帕球王',
      '法国超跑',
      '大英巴图鲁',
      '桑巴舞者',
      '边路游龙',
      '战车门卫',
      '蓝武左刃',
      '沙漠飞翼',
      '魔人布欧',
      '咖啡飞翼',
      '美国队长',
      '加拿大超跑',
      '绿鹰中锋',
      '草根门神',
      '海岛门神',
    ]

    for (const team of teams) {
      expect(team.players.length, team.name).toBe(24)
      expect(team.players.filter((player) => player.position === 'GK').length, team.name).toBe(2)
      const goldenPlayers = team.players.filter((player) => player.isGolden)
      expect(goldenPlayers, team.name).toHaveLength(1)
      expect(goldenNames).toContain(goldenPlayers[0].name)
      expect(goldenPlayers[0].hiddenSkill, team.name).toBeTruthy()
      expect(team.defaultFormation, team.name).toBe(getTeamDefaultFormation(team.id))
      expect(team.styleTags.length, team.name).toBeGreaterThanOrEqual(2)
      expect(team.players.every(player => player.spriteRecipe && player.portraitRecipe), team.name).toBe(true)
    }
  })

  it('publishes a 48-team-ready schema with France and Curacao as complete samples', () => {
    expect(TEAM_DATA_SCHEMA_VERSION).toBe('team-roster-v2')
    expect(WORLD_CUP_TEAM_CAPACITY).toBe(48)
    expect(ROSTER_POOL_RULES).toMatchObject({
      minimum: 24,
      target: 24,
      maximum: 24,
      nationalSquadSize: 24,
      minPurchase: 11,
      nationalSquadMinimums: { GK: 2, DF: 3, MF: 3, FW: 2 },
      positionTargets: { GK: 2, DF: 8, MF: 8, FW: 6 },
    })
    expect(VISUAL_RECIPE_RULE.idPattern).toBe('pixel/recipes/{teamId}/{playerId}.json')

    const catalogValidation = validateTeamCatalog(teams)
    expect(catalogValidation.valid).toBe(true)
    expect(catalogValidation.teamCount).toBe(16)
    expect(catalogValidation.remainingCapacity).toBe(32)

    for (const teamId of SAMPLE_TEAM_IDS) {
      const team = teams.find(candidate => candidate.id === teamId)
      const validation = validateTeamRecord(team)

      expect(team.dataStage).toBe('sample-complete')
      expect(team.schemaVersion).toBe(TEAM_DATA_SCHEMA_VERSION)
      expect(team.rosterSummary).toMatchObject({
        poolSize: 24,
        sourcePlayers: 24,
        placeholderPlayers: 0,
      })
      expect(validation.valid, `${team.name}: ${validation.errors.join(', ')}`).toBe(true)
    }
  })

  it('binds every normalized player to one deterministic visual recipe id', () => {
    for (const team of teams) {
      for (const player of team.players) {
        expect(player.teamId).toBe(team.id)
        expect(player.visualRecipeId).toBe(buildVisualRecipeId(team.id, player.id))
        expect(player.spriteRecipe.visualRecipeId).toBe(player.visualRecipeId)
      }
    }
  })

  it('calibrates budget so the full 24-player pool exceeds budget but a minimum XI is affordable', () => {
    for (const team of teams) {
      const byPriceAsc = [...team.players].sort((a, b) => a.price - b.price)
      const poolTotal = team.players.reduce((sum, player) => sum + player.price, 0)
      const cheapestEleven = byPriceAsc.slice(0, 11).reduce((sum, player) => sum + player.price, 0)

      expect(poolTotal, `${team.name} poolTotal`).toBeGreaterThan(team.budget)
      expect(cheapestEleven, `${team.name} cheapestEleven`).toBeLessThanOrEqual(team.budget)
    }
  })

  it('builds valid recommended national squads of at least 11 players', () => {
    for (const team of teams) {
      const squad = buildRecommendedNationalSquad(team.players, team.budget, team.defaultFormation)
      const validation = validateNationalSquad(squad, team.budget)

      expect(squad.length, team.name).toBeGreaterThanOrEqual(MIN_PURCHASE)
      expect(validation.valid, team.name).toBe(true)
    }
  })

  it('gives every player pool 24 source-priced players with positive prices', () => {
    const allPreparedPlayers = teams.flatMap(team => team.players)
    expect(allPreparedPlayers).toHaveLength(384)

    for (const team of teams) {
      expect(team.players, team.name).toHaveLength(24)
      for (const player of team.players) {
        expect(player.price, `${team.name}: ${player.name}`).toBeGreaterThan(0)
      }
    }
  })

  it('exposes shared team data contracts for local simulation and Volcengine AI analysis', () => {
    expect(DATA_RUNTIME_CONSTRAINTS.packageBudgetMb).toMatchObject({
      targetMin: 80,
      targetMax: 120,
      hardMax: 150,
      platformLimit: 200,
    })
    expect(DATA_RUNTIME_CONSTRAINTS.networking).toMatchObject({
      realtimePvp: false,
      websocket: false,
      onlinePvp: false,
      aiProvider: 'volcengine',
    })
    expect(DATA_RUNTIME_CONSTRAINTS.runtimeModes).toEqual(['coach', 'player', 'penalty', 'aiSimulation'])

    for (const team of teams) {
      expect(team.dataConsumers, team.name).toEqual(expect.arrayContaining([
        'local-match-engine',
        'volcengine-ai-analysis',
        'coach-mode',
        'player-mode',
        'penalty-mode',
        'ai-simulation',
      ]))
      expect(team.styleTags, team.name).toEqual(expect.arrayContaining([expect.stringMatching(/速度冲击|传控|定位球|防守反击/)]))

      const aiContext = buildTeamAiContext(team)
      expect(aiContext.schemaVersion).toBe(TEAM_DATA_SCHEMA_VERSION)
      expect(aiContext.team.styleTags, team.name).toEqual(team.styleTags)
      expect(aiContext.players, team.name).toHaveLength(team.players.length)
      expect(aiContext.players[0].visualRecipeId).toBe(team.players[0].visualRecipeId)
      expect(aiContext.players[0].operationAttributes).toEqual(expect.objectContaining({
        ballControl: expect.any(Number),
        turning: expect.any(Number),
        sprint: expect.any(Number),
        passing: expect.any(Number),
        shooting: expect.any(Number),
        tackling: expect.any(Number),
      }))
      expect(() => JSON.stringify(aiContext)).not.toThrow()
    }
  })

  it('normalizes player-mode operation attributes for every playable-team player', () => {
    const operationKeys = ['ballControl', 'turning', 'sprint', 'passing', 'shooting', 'tackling']

    for (const player of teams.flatMap(team => team.players)) {
      for (const key of operationKeys) {
        expect(Number.isFinite(player.operationAttributes?.[key]), `${player.name}:${key}`).toBe(true)
        expect(player.operationAttributes[key], `${player.name}:${key}`).toBeGreaterThanOrEqual(0)
        expect(player.operationAttributes[key], `${player.name}:${key}`).toBeLessThanOrEqual(99)
      }
      expect(player.control).toBe(player.operationAttributes.ballControl)
      expect(player.turning).toBe(player.operationAttributes.turning)
      expect(player.sprint).toBe(player.operationAttributes.sprint)
      expect(player.pass).toBe(player.operationAttributes.passing)
      expect(player.shoot).toBe(player.operationAttributes.shooting)
      expect(player.tackle).toBe(player.operationAttributes.tackling)
    }
  })
})

describe('match systems', () => {
  it('documents every selectable formation with a tactical style and use case', () => {
    const formationNames = ['4-3-3', '4-4-2', '4-2-3-1', '4-3-2-1', '3-5-2', '3-4-3', '3-4-2-1', '5-3-2', '5-4-1', '4-1-4-1']
    expect(Object.keys(FORMATION_TACTICS)).toEqual(expect.arrayContaining(formationNames))
    formationNames.forEach(name => {
      expect(FORMATION_TACTICS[name].style).toBeTruthy()
      expect(FORMATION_TACTICS[name].suitableFor).toBeTruthy()
    })
  })

  it('keeps stronger players and opens new slots when changing formation', () => {
    const players = [
      { id: 'gk', position: 'GK', rating: 80 },
      ...[79, 91, 84, 88].map((rating, index) => ({ id: `df-${index}`, position: 'DF', rating })),
      ...[90, 85, 81].map((rating, index) => ({ id: `mf-${index}`, position: 'MF', rating })),
      ...[94, 89, 72].map((rating, index) => ({ id: `fw-${index}`, position: 'FW', rating })),
    ]
    const lineup = players.map((player, index) => ({
      playerId: player.id,
      position: player.position,
      slotId: `${player.position}-${players.slice(0, index).filter(item => item.position === player.position).length}`,
    }))

    const adapted = adaptLineupToFormation(lineup, players, '4-4-2')

    expect(adapted).toHaveLength(11)
    expect(adapted.find(slot => slot.position === 'GK')?.playerId).toBe('gk')
    expect(adapted.filter(slot => slot.position === 'DF').map(slot => slot.playerId)).toEqual([
      'df-0',
      'df-1',
      'df-2',
      'df-3',
    ])
    expect(adapted.filter(slot => slot.position === 'MF')).toHaveLength(4)
    expect(adapted.filter(slot => slot.position === 'FW').map(slot => slot.playerId)).toEqual([
      'fw-0',
      'fw-1',
    ])
    expect(adapted.find(slot => slot.playerId === 'fw-2')?.position).toBe('MF')
  })

  it('keeps the goalkeeper and drops the lowest-fit defender during formation adaptation', () => {
    const players = [
      { id: 'gk-current', position: 'GK', rating: 72, goalkeeper: 74 },
      { id: 'gk-bench', position: 'GK', rating: 98, goalkeeper: 98 },
      ...[92, 88, 84, 79, 68].map((defense, index) => ({
        id: `df-${index}`,
        position: 'DF',
        rating: defense,
        def: defense,
        phy: 80,
        sta: 80,
      })),
      ...[90, 86, 82].map((rating, index) => ({ id: `mf-${index}`, position: 'MF', rating })),
      ...[91, 87, 83].map((rating, index) => ({ id: `fw-${index}`, position: 'FW', rating })),
    ]
    const currentIds = ['gk-current', 'df-0', 'df-1', 'df-2', 'df-3', 'df-4', 'mf-0', 'mf-1', 'mf-2', 'fw-0', 'fw-1']
    const lineup = currentIds.map(playerId => {
      const player = players.find(candidate => candidate.id === playerId)
      return { playerId, position: player.position, slotId: `${player.position}-${playerId}` }
    })

    const adapted = adaptLineupToFormation(lineup, players, '4-3-3')

    expect(adapted).toHaveLength(11)
    expect(adapted.find(slot => slot.position === 'GK')?.playerId).toBe('gk-current')
    expect(adapted.filter(slot => slot.position === 'DF').map(slot => slot.playerId)).not.toContain('df-4')
    expect(adapted.filter(slot => slot.position === 'FW').map(slot => slot.playerId)).toContain('fw-2')
  })

  it('builds a complete position-correct eleven with the shared one-click rule', () => {
    const france = teams.find(team => team.id === 'france')
    const lineup = autoSelectLineupForFormation(france.players, france.defaultFormation)

    expect(lineup).toHaveLength(11)
    expect(lineup.filter(slot => slot.position === 'GK')).toHaveLength(1)
    expect(lineup.filter(slot => slot.position === 'DF')).toHaveLength(4)
    expect(lineup.filter(slot => slot.position === 'MF')).toHaveLength(3)
    expect(lineup.filter(slot => slot.position === 'FW')).toHaveLength(3)
    expect(new Set(lineup.map(slot => slot.playerId)).size).toBe(11)
  })

  it('uses researched default formations for all ten playable teams', () => {
    expect(getTeamDefaultFormation('france')).toBe('4-3-3')
    expect(getTeamDefaultFormation('brazil')).toBe('4-2-3-1')
    expect(getTeamDefaultFormation('argentina')).toBe('4-3-3')
    expect(getTeamDefaultFormation('portugal')).toBe('4-2-3-1')
    expect(getTeamDefaultFormation('germany')).toBe('4-2-3-1')
    expect(getTeamDefaultFormation('japan')).toBe('3-4-2-1')
    expect(getTeamDefaultFormation('norway')).toBe('4-3-3')
    expect(getTeamDefaultFormation('morocco')).toBe('5-3-2')
    expect(getTeamDefaultFormation('newzealand')).toBe('5-3-2')
    expect(getTeamDefaultFormation('curacao')).toBe('4-4-2')
    teams.forEach(team => {
      expect(createNewRun(team.id).formation).toBe(getTeamDefaultFormation(team.id))
    })
  })

  it('uses one stable opponent tactical lineup for preview and match simulation', () => {
    const first = getOpponentMatchSetup('塞内加尔', null, 'medium')
    const second = getOpponentMatchSetup('塞内加尔', null, 'medium')

    expect(first.formation).toBe(second.formation)
    expect(first.lineup).toHaveLength(11)
    expect(first.lineup).toEqual(second.lineup)
    expect(first.lineup.filter(player => player.position === 'GK')).toHaveLength(1)
    expect(first.lineup.map(player => player.number)).toEqual(second.lineup.map(player => player.number))
  })

  it('resolves scheduled opponent strength by team and opponent name', () => {
    expect(resolveOpponentStrength('france', '伊拉克', null)).toBe('weak')
    expect(resolveOpponentStrength('france', '塞内加尔', null)).toBe('medium')
  })

  it('selects a position-correct best eleven from playable team rosters', () => {
    const france = teams.find(team => team.id === 'france')
    const setup = getOpponentMatchSetup('法国', france, 'strong')

    expect(setup.lineup).toHaveLength(11)
    expect(setup.lineup.filter(player => player.position === 'GK')).toHaveLength(1)
    expect(setup.lineup.every(player => player.assignedPosition)).toBe(true)
  })

  it('keeps 50+ key decision scenarios with replay and runtime mapping metadata', () => {
    expect(DECISION_LIBRARY.length).toBeGreaterThanOrEqual(50)
    expect(DECISION_LIBRARY.map(scenario => scenario.id)).toEqual(expect.arrayContaining([
      'penalty_area_dive',
      'var_penalty_review',
      'defend_dangerous_freekick',
      'box_second_ball_chaos',
      'defensive_line_handball_var',
      'second_ball_corner_attack',
      'opponent_dangerous_freekick_wall',
    ]))

    for (const scenario of DECISION_LIBRARY) {
      expect(scenario.countdownSeconds, scenario.id).toBeGreaterThanOrEqual(3)
      expect(scenario.countdownSeconds, scenario.id).toBeLessThanOrEqual(6)
      expect(scenario.riskLevel, scenario.id).toMatch(/low|medium|high|critical/)
      expect(scenario.rewardLevel, scenario.id).toMatch(/low|medium|high|critical/)
      expect(scenario.abilityImpact, scenario.id).toEqual(expect.any(String))
      expect(scenario.animationTag, scenario.id).toBe(scenario.animation_type)
      expect(scenario.replayTags?.length, scenario.id).toBeGreaterThan(0)
      expect(scenario.modeScope, scenario.id).toBe('coach')
      expect(scenario.runtimeContract, scenario.id).toMatchObject({
        sharedRuntime: '2.5d-match-runtime',
        localCore: true,
        network: 'none',
        aiDependency: 'optional-volcano-ai',
      })
      for (const choice of scenario.choices) {
        expect(choice.risk, `${scenario.id}:${choice.id}`).toEqual(expect.any(String))
        expect(choice.reward, `${scenario.id}:${choice.id}`).toEqual(expect.any(String))
        expect(choice.abilityImpact, `${scenario.id}:${choice.id}`).toEqual(expect.any(String))
        expect(choice.animationTag, `${scenario.id}:${choice.id}`).toBe(scenario.animation_type)
        expect(choice.replayTags?.length, `${scenario.id}:${choice.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('exposes dynamic success rates from player ability and opponent quality', () => {
    const scenario = DECISION_LIBRARY.find(decision => decision.id === 'freekick_dangerous')
    const weakLineup = [
      { id: 'weak-mf', name: '普通主罚手', position: 'MF', tec: 58, spd: 58, phy: 58, def: 58, sta: 62, rating: 59, star: 2 },
    ]
    const eliteLineup = [
      { id: 'elite-mf', name: '顶级主罚手', position: 'MF', tec: 94, spd: 86, phy: 82, def: 70, sta: 90, rating: 92, star: 5, isGolden: true },
    ]

    const weakDecision = executeDecision(scenario, weakLineup, {
      minute: 62,
      oppDefense: 86,
      teamAvgRating: 59,
      teamDifficulty: 5,
      isKnockout: true,
    })
    const eliteDecision = executeDecision(scenario, eliteLineup, {
      minute: 62,
      oppDefense: 62,
      teamAvgRating: 90,
      teamDifficulty: 1,
      isKnockout: true,
    })

    expect(eliteDecision.choices[0].successProb).toBeGreaterThan(weakDecision.choices[0].successProb + 0.18)
    expect(weakDecision.choices[0].successProb).toBeLessThan(0.55)
  })

  it('selects key players using the canonical position field', () => {
    const lineup = [
      { id: 'gk', name: '门将', position: 'GK', spd: 40, tec: 50, def: 90, sta: 90 },
      { id: 'df', name: '后卫', position: 'DF', spd: 70, tec: 60, def: 92, sta: 90 },
      { id: 'mf', name: '中场', position: 'MF', spd: 76, tec: 95, def: 70, sta: 90 },
      { id: 'fw', name: '前锋', position: 'FW', spd: 98, tec: 88, def: 40, sta: 90 },
    ]

    const players = selectKeyPlayers({ id: 'solo_run_penalty' }, lineup)

    expect(players.default.name).toBe('前锋')
    expect(players.second.name).toBe('中场')
  })

  it('advances group matches and preserves knockout stage for penalty checks', () => {
    const run = {
      ...createNewRun('france'),
      stage: 'post-match',
      matchIndex: 0,
      matchResults: ['win'],
      lastMatchResult: { result: 'win' },
    }

    expect(getNextRunAfterMatch(run)).toMatchObject({
      stage: 'tournament',
      matchIndex: 1,
    })

    expect(getNextRunAfterMatch({ ...run, stage: 'knockout', knockoutRound: 'r16' })).toMatchObject({
      stage: 'tournament',
      knockoutRound: 'qf',
    })
  })

  it('ranks all sixteen playable teams from deterministic group results', () => {
    teams.forEach((team) => {
      const perfect = simulateGroupStage(team.id, ['win', 'win', 'win'])
      expect(perfect.teams).toHaveLength(4)
      expect(perfect.rank, team.id).toBe(1)
      expect(perfect.teams[0]).toMatchObject({ id: team.id, points: 9, isPlayer: true })
      expect(perfect.teams.reduce((sum, entry) => sum + entry.points, 0)).toBeGreaterThan(0)
    })
  })

  it('resolves knockout opponents to concrete national teams', () => {
    const opponents = getFallbackKnockoutOpponents({
      teamId: 'france',
      teamName: '法国',
      group: 'I',
      playerRank: 1,
    })

    expect(Object.keys(opponents)).toEqual(['r32', 'r16', 'qf', 'sf', 'final'])
    expect(Object.values(opponents)).not.toContain('待定')
    expect(Object.values(opponents)).not.toContain('A组第2')
    expect(Object.values(opponents)).not.toContain('法国')
  })

  it('does not trigger stacked decisions in the same minute or too close together', () => {
    expect(shouldTriggerDecision(20, 1, 20, 12, () => 0)).toBe(false)
    expect(shouldTriggerDecision(28, 1, 20, 12, () => 0)).toBe(false)
    expect(shouldTriggerDecision(32, 1, 20, 12, () => 0)).toBe(true)
  })

  it('punishes lineups that use midfielders as the entire back line', () => {
    const gk = { id: 'gk', name: '门将', number: 1, position: 'GK', pos: 'GK', rating: 86, def: 90, phy: 82, spd: 70, sta: 88 }
    const naturalBackLine = [
      gk,
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `df-${i}`,
        name: `后卫${i}`,
        number: i + 2,
        position: 'DF',
        pos: 'DF',
        rating: 84,
        def: 86,
        phy: 82,
        spd: 76,
        sta: 86,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `mf-${i}`,
        name: `中场${i}`,
        number: i + 6,
        position: 'MF',
        pos: 'MF',
        rating: 84,
        def: 72,
        tec: 86,
        spd: 78,
        sta: 86,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `fw-${i}`,
        name: `前锋${i}`,
        number: i + 9,
        position: 'FW',
        pos: 'FW',
        rating: 84,
        tec: 86,
        spd: 86,
        phy: 78,
        sta: 84,
      })),
    ]
    const midfieldBackLine = naturalBackLine.map((player, index) => (
      index >= 1 && index <= 4
        ? { ...player, position: 'MF', name: `客串后卫${index}`, def: 70, tec: 86 }
        : player
    ))

    const normal = calculateLineupRatings(naturalBackLine, '4-3-3')
    const broken = calculateLineupRatings(midfieldBackLine, '4-3-3')

    expect(broken.defenderCoverage).toBe(0)
    expect(broken.defense).toBeLessThan(normal.defense - 20)
    expect(broken.defensiveIntegrity).toBeLessThan(normal.defensiveIntegrity)
  })

  it('raises opponent pressure when the defense is badly out of position', () => {
    const opponentLineup = Array.from({ length: 10 }, (_, i) => ({
      id: `opp-${i}`,
      name: `对方${i}`,
      position: i === 0 ? 'GK' : i < 5 ? 'FW' : 'MF',
      rating: 82,
      tec: 84,
      spd: 84,
      phy: 78,
      sta: 82,
      def: 70,
    }))
    const healthyLineup = [
      { id: 'gk', position: 'GK', pos: 'GK', rating: 84, def: 88, phy: 80, spd: 70, sta: 86 },
      ...Array.from({ length: 4 }, (_, i) => ({ id: `df-${i}`, position: 'DF', pos: 'DF', rating: 82, def: 86, phy: 80, spd: 74, sta: 82 })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `midfw-${i}`, position: i < 3 ? 'MF' : 'FW', pos: i < 3 ? 'MF' : 'FW', rating: 82, def: 70, tec: 84, spd: 82, phy: 76, sta: 82 })),
    ]
    const brokenLineup = healthyLineup.map((player, index) => (
      index >= 1 && index <= 4 ? { ...player, position: 'MF', def: 68, tec: 86 } : player
    ))

    const healthyPressure = calculateOpponentPressure({ myLineup: healthyLineup, opponentLineup, formation: '4-3-3' })
    const brokenPressure = calculateOpponentPressure({ myLineup: brokenLineup, opponentLineup, formation: '4-3-3' })

    expect(healthyPressure.chance).toBeLessThan(0.31)
    expect(healthyPressure.goalChance).toBeLessThan(0.28)
    expect(brokenPressure.chance).toBeGreaterThan(healthyPressure.chance)
    expect(brokenPressure.goalChance).toBeGreaterThan(healthyPressure.goalChance)
  })

  it('keeps direct red-card outcomes in the high-risk failure tier', () => {
    const lastDefender = DECISION_LIBRARY.find(decision => decision.id === 'last_defender_tackle')
    const tacticalFoul = DECISION_LIBRARY.find(decision => decision.id === 'tactical_foul_counter')

    expect(lastDefender.choices.find(choice => choice.id === 'last_man_tackle').possible_outcomes.at(-1)).toBe('red_card_penalty')
    expect(tacticalFoul.choices.find(choice => choice.id === 'tactical_foul_commit').possible_outcomes.at(-1)).toBe('red_card_second_yellow')
  })

  it('keeps red cards as rare tail outcomes within failed high-risk choices', () => {
    const scenario = DECISION_LIBRARY.find(decision => decision.id === 'penalty_area_foul_risk')
    const choice = scenario.choices.find(item => item.id === 'slide_tackle')
    const player = { def: 45, phy: 45, sta: 45, star: 1, rating: 45 }
    const gameState = { minute: 64, oppDefense: 88, teamAvgRating: 50, teamDifficulty: 5 }

    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.01)

    expect(resolveChoiceResult(choice, player, gameState).outcome).not.toBe('red_card_penalty')
    random.mockRestore()
  })

  it('treats three-outcome high-risk failures as failure states before the red-card tail', () => {
    const scenario = DECISION_LIBRARY.find(decision => decision.id === 'weather_slippery_tackle')
    const choice = scenario.choices.find(item => item.id === 'slide_in_rain')
    const player = { def: 45, phy: 45, sta: 45, star: 1, rating: 45 }
    const gameState = { minute: 64, oppDefense: 88, teamAvgRating: 50, teamDifficulty: 5 }

    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.60)

    expect(resolveChoiceResult(choice, player, gameState)).toMatchObject({
      outcome: 'yellow_card_penalty',
      isSuccess: false,
    })
    random.mockRestore()
  })

  it('does not make the near-post one-on-one choice a guaranteed goal', () => {
    const scenario = DECISION_LIBRARY.find(decision => decision.id === 'solo_run_penalty')
    const choice = scenario.choices.find(item => item.id === 'shoot_near_post')
    const player = { tec: 92, spd: 94, sta: 88, star: 5, rating: 91 }
    const gameState = { minute: 30, oppDefense: 65, teamAvgRating: 86 }

    const goalRandom = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.1)
    expect(resolveChoiceResult(choice, player, gameState).homeScoreChange).toBe(1)
    goalRandom.mockRestore()

    const saveRandom = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
    expect(resolveChoiceResult(choice, player, gameState)).toMatchObject({
      outcome: 'saved_near',
      homeScoreChange: 0,
    })
    saveRandom.mockRestore()
  })

  it('turns card penalties and dives into second-stage penalty logic', () => {
    expect(outcomeConcedesPenalty('yellow_card_penalty')).toBe(true)
    expect(outcomeConcedesPenalty('red_card_penalty')).toBe(true)

    const keeper = { name: '门将', position: 'GK', def: 90, spd: 82, sta: 88 }
    const saved = resolveOpponentPenaltyChoice({ side: 'left' }, keeper, { myDefense: 82 }, () => 0)
    const scored = resolveOpponentPenaltyChoice({ side: 'right' }, keeper, { myDefense: 82 }, () => 0.99)

    expect(saved).toMatchObject({ outcome: 'opponent_saved_left', awayScoreChange: 0 })
    expect(scored).toMatchObject({ outcome: 'opponent_goal_right', awayScoreChange: 1 })

    expect(resolveDiveChoice({ id: 'simulate_contact' }, { tec: 90, sta: 88 }, { isKnockout: false }, () => 0.05).outcome).toBe('penalty_won')
    expect(resolveDiveChoice({ id: 'simulate_contact' }, { tec: 60, sta: 60 }, { isKnockout: false }, () => 0.99).outcome).toBe('yellow_card_dive')
  })

  it('gives normal penalty takers a realistic scoring chance instead of splitting successful rolls again', () => {
    const penalty = DECISION_LIBRARY.find(decision => decision.id === 'match_penalty')
    const placement = penalty.choices.find(choice => choice.id === 'penalty_left')
    const panenka = penalty.choices.find(choice => choice.id === 'penalty_center')
    const player = { tec: 86, sta: 84, star: 4, rating: 85 }

    expect(resolveMatchPenaltyChoice(placement, player, {}, () => 0.70)).toMatchObject({
      outcome: 'goal_placement',
      homeScoreChange: 1,
    })
    expect(resolveMatchPenaltyChoice(placement, player, {}, () => 0.96)).toMatchObject({
      outcome: 'miss_post',
      homeScoreChange: 0,
    })
    expect(resolveMatchPenaltyChoice(panenka, player, {}, () => 0.74).homeScoreChange).toBe(0)
  })
})

describe('post-match review', () => {
  it('turns recorded choices into a decision recap and actionable advice', () => {
    const insights = buildPostMatchInsights({
      homeScore: 2,
      awayScore: 1,
      stats: {
        myShots: 12,
        oppShots: 10,
        myShotsOnTarget: 5,
        oppShotsOnTarget: 4,
        myXG: 2.2,
        oppXG: 1.4,
        possession: 48,
        fouls: 4,
        yellowCards: 2,
        redCards: 0,
        penalties: 1,
        corners: 3,
      },
      decisions: [
        { minute: 32, situation: '获得点球', choiceLabel: '射向左下角', resultText: '点球罚进', isSuccess: true, sourceEventId: 'runtime.penalty.32' },
        { minute: 74, situation: '对方快速反击', choiceLabel: '战术犯规', resultText: '吃到黄牌', isSuccess: false, sourceEventId: 'runtime.counter.74' },
      ],
    }, '法国')

    expect(insights.summary).toContain('2次临场决策')
    expect(insights.decisionItems).toHaveLength(2)
    expect(insights.decisionItems[0]).toContain('32′')
    expect(insights.advice.join('')).toContain('纪律')
  })

  it('keeps at most five sourced decisions and explains injuries and suspensions', () => {
    const decisions = Array.from({ length: 7 }, (_, index) => ({
      minute: 10 + index,
      situation: `关键回合${index + 1}`,
      choiceLabel: '稳健处理',
      resultText: '完成执行',
      isSuccess: true,
      sourceEventId: index === 0 ? null : `runtime.choice.${index}`,
    }))
    const insights = buildPostMatchInsights({
      homeScore: 1,
      awayScore: 0,
      stats: {},
      decisions,
      matchRuleReport: {
        playerStates: {
          sentOff: { side: 'red', name: '后卫甲', redCard: true },
          injured: { side: 'red', name: '前锋乙', injured: true },
        },
      },
    }, '法国')

    expect(insights.decisionItems).toHaveLength(5)
    expect(insights.decisionItems.every((item) => item.includes('事件:runtime.choice.'))).toBe(true)
    expect(insights.advice.join('')).toContain('停赛')
    expect(insights.advice.join('')).toContain('伤停')
  })
})

describe('landscape match presentation', () => {
  it('keeps opponent penalty direction hidden behind the goalkeeper choice', () => {
    const opponentKick = resolveOpponentShootoutKick('left', vi.fn()
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.5))
    const userKick = resolveUserShootoutKick('right', vi.fn()
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.5))

    expect(opponentKick).toMatchObject({
      keeperDirection: 'left',
      shooterDirection: 'right',
      scored: true,
    })
    expect(userKick).toMatchObject({
      shooterDirection: 'right',
      keeperDirection: 'left',
      scored: true,
    })
  })

  it('ends a shootout only after both sides have taken equal sudden-death kicks', () => {
    const shots = [
      ...Array.from({ length: 5 }, (_, index) => ({ team: 'home', scored: index < 4 })),
      ...Array.from({ length: 5 }, (_, index) => ({ team: 'away', scored: index < 4 })),
      { team: 'home', scored: true },
    ]
    expect(getShootoutWinner(shots)).toBeNull()
    expect(getShootoutWinner([...shots, { team: 'away', scored: false }])).toBe('home')
  })

  it('provides distinct pixel kits for all sixteen playable teams', () => {
    const playableTeamIds = teams.map(team => team.id)
    const kits = playableTeamIds.map(teamId => getTeamKit(teamId))

    expect(kits).toHaveLength(16)
    expect(new Set(kits.map(kit => kit.shirt)).size).toBeGreaterThanOrEqual(8)
    kits.forEach(kit => {
      expect(kit.shirt).toMatch(/^#/)
      expect(kit.shorts).toMatch(/^#/)
      expect(kit.socks).toMatch(/^#/)
      expect(kit.goalkeeper).toMatch(/^#/)
    })
  })

  it('switches the opponent to an alternate kit when the shirts would clash', () => {
    const { home, away } = getMatchKits('france', '日本')

    expect(home.shirt).not.toBe(away.shirt)
    expect(away).toMatchObject(getTeamKit('japan').away)
  })

  it('builds modular pixel players from one reusable paper-doll part set', () => {
    const france = buildPixelPlayerModel({ teamId: 'france', number: 10, role: 'outfield', action: 'dribble' })
    const brazil = buildPixelPlayerModel({ teamId: 'brazil', number: 9, role: 'outfield', action: 'shoot' })
    const keeper = buildPixelPlayerModel({ teamId: 'france', number: 1, role: 'goalkeeper', action: 'idle' })

    expect(france.partSetId).toBe(brazil.partSetId)
    expect(france.kit.shirt).not.toBe(brazil.kit.shirt)
    expect(france.layers.map(layer => layer.id)).toEqual(expect.arrayContaining([
      'head',
      'body',
      'leftArm',
      'rightArm',
      'leftLeg',
      'rightLeg',
      'shirt',
      'boots',
      'number',
    ]))
    expect(france.numberLayer.text).toBe('10')
    expect(keeper.layers.some(layer => layer.id === 'gloves')).toBe(true)
    expect(keeper.kit.shirt).toBe(getTeamKit('france').goalkeeper)
    expect(PIXEL_PLAYER_ACTIONS).toEqual(expect.arrayContaining(['idle', 'run', 'dribble', 'pass', 'shoot', 'tackle', 'save']))
  })

  it('documents pixel player asset naming, package budgets, and shared-runtime rules', () => {
    const rules = getPixelPlayerProductionRules()

    expect(rules.baseFrame).toMatchObject({ width: 32, height: 40, scale: 4 })
    expect(rules.packageBudgetMb).toMatchObject({ targetMin: 80, targetMax: 120, hardMax: 150 })
    expect(rules.estimatedSavings.currentWholePlayerPngMb).toBeGreaterThan(10)
    expect(rules.estimatedSavings.projectedModularPlayerMb).toBeLessThan(4)
    expect(rules.runtimeReuse.modes).toEqual(['coach', 'player', 'penalty'])
    expect(rules.runtimeReuse.sharedAssets).toEqual(expect.arrayContaining(['pitch', 'paperDollPlayer', 'ball', 'animationTimelines', 'teamKits']))
    expect(rules.networkingBoundary).toContain('AI')
    expect(rules.naming.playerPart).toContain('{part}')
    expect(rules.naming.teamKit).toContain('{teamId}')
    expect(rules.batchSteps.join(' ')).toContain('spriteRecipe')
  })

})
