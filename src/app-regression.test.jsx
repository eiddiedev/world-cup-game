/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import SettingsScreen from './components/SettingsScreen.jsx'
import { DECISION_LIBRARY } from './data/decisionLibrary.js'
import { teams } from './data/teams.js'
import { ANIMATION_TEMPLATES } from './utils/animationTemplates.js'
import { BALL_ASSET_SRC, getResultAnimationKey } from './utils/animationResultMapper.js'
import { AudioManager, audioManager } from './utils/audioManager.js'
import { generateCommentaryEvent, generateRandomMatchEvent } from './utils/commentaryEngine.js'
import { selectKeyPlayers, shouldTriggerDecision } from './utils/decisionSystem.js'
import { getFallbackKnockoutOpponents } from './utils/knockoutResolver.js'
import {
  buildAnimationActors,
  collectUnsupportedAnimationFrameTypes,
  createAmbientTargets,
  createVisualEvent,
} from './utils/matchVisuals.js'
import { createInitialSaveData, createNewRun, loadSaveData } from './utils/saveManager.js'
import { getNextRunAfterMatch } from './utils/tournamentProgress.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('home screen', () => {
  it('routes from the app home screen into team selection', async () => {
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

    const startButton = await screen.findByRole('button', { name: '开始征程' })
    fireEvent.pointerDown(startButton)
    fireEvent.click(startButton)

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
      expect(screen.getByRole('button', { name: /音效/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /音乐/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /震动/ })).toBeInTheDocument()
    })
  })

  it('starts a new run from the visible pixel button', () => {
    const navigateTo = vi.fn()
    render(
      <HomeScreen
        saveData={createInitialSaveData()}
        navigateTo={navigateTo}
        showToast={vi.fn()}
      />,
    )

    const startButton = screen.getByRole('button', { name: '开始征程' })
    expect(startButton.className).toContain('PixelButton')
    expect(startButton).not.toHaveAttribute('style')

    fireEvent.click(startButton)

    expect(navigateTo).toHaveBeenCalledWith('team-select')
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

    fireEvent.click(screen.getByRole('button', { name: /音效/ }))

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
})

describe('team and player data', () => {
  it('keeps every selectable team at a 24-player roster with one named golden star', () => {
    const goldenNames = [
      '法国超跑',
      '桑巴舞者',
      '当世球王',
      '边路游龙',
      '战车门卫',
      '蓝武锋魂',
      '北欧魔人',
      '北非之狐',
      '全白重炮',
      '蓝浪飞翼',
    ]

    for (const team of teams) {
      expect(team.players, team.name).toHaveLength(24)
      expect(team.players.filter((player) => player.position === 'GK'), team.name).toHaveLength(2)
      const goldenPlayers = team.players.filter((player) => player.isGolden)
      expect(goldenPlayers, team.name).toHaveLength(1)
      expect(goldenNames).toContain(goldenPlayers[0].name)
      expect(goldenPlayers[0].hiddenSkill, team.name).toBeTruthy()
    }
  })

  it('calibrates budget pressure around 13 strongest and 18 cheapest players', () => {
    for (const team of teams) {
      const byPriceDesc = [...team.players].sort((a, b) => b.price - a.price)
      const byPriceAsc = [...team.players].sort((a, b) => a.price - b.price)
      const top13 = byPriceDesc.slice(0, 13).reduce((sum, player) => sum + player.price, 0)
      const low18 = byPriceAsc.slice(0, 18).reduce((sum, player) => sum + player.price, 0)
      const low19 = byPriceAsc.slice(0, 19).reduce((sum, player) => sum + player.price, 0)

      expect(top13, `${team.name} top13`).toBeLessThanOrEqual(Math.round(team.budget * 1.05))
      expect(low18, `${team.name} low18`).toBeLessThanOrEqual(team.budget)
      expect(low19, `${team.name} low19`).toBeGreaterThan(team.budget)
    }
  })
})

describe('match systems', () => {
  it('keeps the designed 28 key decision scenarios available', () => {
    expect(DECISION_LIBRARY).toHaveLength(28)
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

  it('resolves knockout opponents to concrete national teams', () => {
    const opponents = getFallbackKnockoutOpponents({
      teamId: 'france',
      teamName: '法国',
      group: 'I',
      playerRank: 1,
    })

    expect(Object.keys(opponents)).toEqual(['r16', 'qf', 'sf', 'final'])
    expect(Object.values(opponents)).not.toContain('待定')
    expect(Object.values(opponents)).not.toContain('A组第2')
    expect(Object.values(opponents)).not.toContain('法国')
  })

  it('maps every decision outcome to a playable animation result', () => {
    for (const scenario of DECISION_LIBRARY) {
      expect(ANIMATION_TEMPLATES[scenario.animation_type], scenario.id).toBeTruthy()
      const outcomes = scenario.choices.flatMap(choice => choice.possible_outcomes)
      for (const outcome of outcomes) {
        const resultKey = getResultAnimationKey(scenario.animation_type, outcome)
        expect(resultKey, `${scenario.id}:${outcome}`).toBeTruthy()
        expect(ANIMATION_TEMPLATES[scenario.animation_type].result_animations[resultKey], `${scenario.id}:${outcome}`).toBeTruthy()
      }
    }
  })

  it('uses dedicated free-kick and penalty animation paths', () => {
    expect(ANIMATION_TEMPLATES.attack_freekick.result_animations.goal_freekick).toBeTruthy()
    expect(ANIMATION_TEMPLATES.attack_freekick.result_animations.saved_freekick).toBeTruthy()
    expect(ANIMATION_TEMPLATES.attack_freekick.result_animations.goal_header).toBeTruthy()
    expect(ANIMATION_TEMPLATES.penalty_shootout.result_animations.goal_placement).toBeTruthy()
    expect(ANIMATION_TEMPLATES.penalty_shootout.result_animations.saved_placement).toBeTruthy()
    expect(ANIMATION_TEMPLATES.penalty_shootout.result_animations.goal_panenka).toBeTruthy()
  })

  it('keeps animation templates limited to engine-supported frame types', () => {
    expect(collectUnsupportedAnimationFrameTypes(ANIMATION_TEMPLATES)).toEqual([])
  })

  it('builds animation actors from decision key players', () => {
    const lineup = [
      { id: 'gk', name: '门将', number: 1, position: 'GK' },
      { id: 'mf', name: '主罚手', number: 8, position: 'MF' },
      { id: 'fw', name: '争顶点', number: 9, position: 'FW' },
    ]
    const opponents = [
      { id: 'opp-gk', name: '对手门将', number: 1, position: 'GK' },
      { id: 'opp-df', name: '对手后卫', number: 4, position: 'DF' },
    ]

    const penaltyActors = buildAnimationActors(
      { id: 'match_penalty', animation_type: 'penalty_shootout' },
      { default: lineup[1], second: lineup[2] },
      lineup,
      opponents,
    )
    expect(penaltyActors[0]).toBe(lineup[1])
    expect(penaltyActors[1]).toBe(opponents[0])

    const freeKickActors = buildAnimationActors(
      { id: 'freekick_dangerous', animation_type: 'attack_freekick' },
      { default: lineup[1], second: lineup[2] },
      lineup,
      opponents,
    )
    expect(freeKickActors[0]).toBe(lineup[1])
    expect(freeKickActors[1]).toBe(lineup[2])
  })

  it('keeps commentary number-led and action-heavy', () => {
    const text = generateCommentaryEvent(18, [
      { name: '甲', number: 2, position: 'DF' },
      { name: '乙', number: 3, position: 'MF' },
    ], [
      { name: '丙', number: 7, position: 'FW' },
    ]).text

    expect(text).toMatch(/18'/)
    expect(text).toMatch(/[237]号/)
    expect(text).toMatch(/本方[23]号/)
    expect(text).toMatch(/对方7号/)
    expect(text).toMatch(/推进|封堵|抢断|直塞|传中|回防/)
  })

  it('emits disciplinary and injury events with traceable player metadata', () => {
    const myPlayers = [
      { id: 'my-8', name: '八号', number: 8, position: 'MF' },
      { id: 'my-1', name: '门将', number: 1, position: 'GK' },
    ]
    const opponentPlayers = [
      { id: 'opp-4', name: '四号', number: 4, position: 'DF' },
      { id: 'opp-1', name: '对手门将', number: 1, position: 'GK' },
    ]

    const redCardRolls = [0.01, 0, 0, 0, 0.01, 0]
    const redCard = generateRandomMatchEvent(15, myPlayers, opponentPlayers, () => redCardRolls.shift() ?? 0)
    expect(redCard.type).toBe('red_card')
    expect(redCard.statsUpdate).toMatchObject({ fouls: 1, redCards: 1 })
    expect(redCard.playerId).toBe('opp-4')
    expect(redCard.teamSide).toBe('opponent')

    const injuryRolls = [0.71, 0, 0]
    const injury = generateRandomMatchEvent(42, myPlayers, opponentPlayers, () => injuryRolls.shift() ?? 0)
    expect(injury.type).toBe('injury')
    expect(injury.playerId).toBe('my-8')
    expect(injury.teamSide).toBe('my')
  })

  it('returns visual payloads for commentary events and ambient targets for every player', () => {
    const myPlayers = [
      { id: 'my-8', name: '八号', number: 8, position: 'MF' },
      { id: 'my-11', name: '十一号', number: 11, position: 'FW' },
    ]
    const opponentPlayers = [
      { id: 'opp-4', name: '四号', number: 4, position: 'DF' },
      { id: 'opp-1', name: '对手门将', number: 1, position: 'GK' },
    ]

    const commentary = generateCommentaryEvent(18, myPlayers, opponentPlayers)
    expect(commentary.visual).toMatchObject({
      visualKind: expect.any(String),
      actorId: expect.any(String),
      supportId: expect.any(String),
    })

    const visualEvent = createVisualEvent(commentary, myPlayers, opponentPlayers)
    expect(visualEvent).toMatchObject({
      visualKind: commentary.visual.visualKind,
      actorName: expect.any(String),
      supportName: expect.any(String),
    })

    const targets = createAmbientTargets({
      playerPositions: {
        八号: { x: 50, y: 50, team: 'my' },
        'opp_四号': { x: 50, y: 45, team: 'opponent' },
      },
      ballZone: 'right_attack',
      phase: 2,
    })
    expect(Object.keys(targets)).toEqual(['八号', 'opp_四号'])
  })

  it('uses the prepared football sprite instead of a drawn white dot', () => {
    expect(BALL_ASSET_SRC).toBe('/assets/足球透明.png')
  })

  it('does not trigger stacked decisions in the same minute or too close together', () => {
    expect(shouldTriggerDecision(20, 1, 20, 12, () => 0)).toBe(false)
    expect(shouldTriggerDecision(28, 1, 20, 12, () => 0)).toBe(false)
    expect(shouldTriggerDecision(32, 1, 20, 12, () => 0)).toBe(true)
  })
})
