/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import SettingsScreen from './components/SettingsScreen.jsx'
import { DECISION_LIBRARY } from './data/decisionLibrary.js'
import { getPlayerMarketScore } from './data/playerBalance.js'
import { teams } from './data/teams.js'
import { FORMATION_TACTICS } from './data/formationTactics.js'
import { ANIMATION_TEMPLATES } from './utils/animationTemplates.js'
import { getResultAnimationKey } from './utils/animationResultMapper.js'
import { AudioManager, audioManager } from './utils/audioManager.js'
import { generateCommentaryEvent, generateRandomMatchEvent } from './utils/commentaryEngine.js'
import {
  outcomeConcedesPenalty,
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
import { generateOpponentTeam } from './utils/matchEngine.js'
import { getFallbackKnockoutOpponents } from './utils/knockoutResolver.js'
import {
  buildAnimationActors,
  collectUnsupportedAnimationFrameTypes,
  createAmbientTargets,
  createVisualEvent,
} from './utils/matchVisuals.js'
import { createInitialSaveData, createNewRun, loadSaveData } from './utils/saveManager.js'
import { buildPostMatchInsights } from './utils/postMatchInsights.js'
import { getNextRunAfterMatch } from './utils/tournamentProgress.js'
import { adaptLineupToFormation } from './utils/lineupFormation.js'
import { getTeamDefaultFormation } from './data/teamFormations.js'
import {
  getFittedLandscapePitchSize,
  mapPitchPointToLandscape,
} from './utils/pitchRendering.js'
import {
  MATCH_EVENT_ASSETS,
  getGoalOverlayLayers,
  getMatchEventVisual,
} from './utils/matchEventVisuals.js'
import {
  appendCommentaryEntry,
  openChainedDecision,
} from './utils/commentaryTimeline.js'
import { getMatchKits, getTeamKit } from './data/teamKits.js'
import { createPitchBounds, tacticalToPhaserPoint } from './utils/phaserPitch.js'
import {
  getBallAttachmentPoint,
  getDecisionBridge,
  getNextMatchSpeed,
} from './utils/liveMatchSimulation.js'
import {
  getShootoutWinner,
  resolveOpponentShootoutKick,
  resolveUserShootoutKick,
} from './utils/penaltyShootout.js'
import { getMatchBench, swapMatchPlayer } from './utils/substitution.js'
import { getStorageKey, selectPlayableTeams } from './config/runtime.js'

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
  it('limits the Douyin demo to France and Curacao with an isolated save', () => {
    const sourceTeams = [
      { id: 'france' },
      { id: 'brazil' },
      { id: 'curacao' },
    ]

    expect(selectPlayableTeams(sourceTeams, false).map(team => team.id)).toEqual([
      'france',
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

  it('prices all 240 players in the same order as their market value score', () => {
    const allPreparedPlayers = teams.flatMap(team => team.players)
    expect(allPreparedPlayers).toHaveLength(240)

    for (const team of teams) {
      const ranked = [...team.players].sort((a, b) => getPlayerMarketScore(b) - getPlayerMarketScore(a))
      for (let index = 1; index < ranked.length; index += 1) {
        expect(
          ranked[index - 1].price,
          `${team.name}: ${ranked[index - 1].name} should not cost less than ${ranked[index].name}`,
        ).toBeGreaterThanOrEqual(ranked[index].price)
      }
    }

    const france = teams.find(team => team.id === 'france')
    const firstKeeper = france.players.find(player => player.name === '铁臂门神')
    const secondKeeper = france.players.find(player => player.name === '青春之盾')
    expect(getPlayerMarketScore(firstKeeper)).toBeGreaterThan(getPlayerMarketScore(secondKeeper))
    expect(firstKeeper.price).toBeGreaterThan(secondKeeper.price)
  })
})

describe('match systems', () => {
  it('documents every selectable formation with a tactical style and use case', () => {
    const formationNames = ['4-3-3', '4-4-2', '4-2-3-1', '4-3-2-1', '3-5-2', '3-4-3', '3-4-2-1', '5-3-2', '4-1-4-1', '4-4-1-1']
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

    expect(adapted).toHaveLength(10)
    expect(adapted.filter(slot => slot.position === 'DF').map(slot => slot.playerId)).toEqual([
      'df-0',
      'df-1',
      'df-2',
      'df-3',
    ])
    expect(adapted.filter(slot => slot.position === 'MF')).toHaveLength(3)
    expect(adapted.filter(slot => slot.position === 'FW').map(slot => slot.playerId)).toEqual([
      'fw-0',
      'fw-1',
    ])
    expect(adapted.some(slot => slot.playerId === 'fw-2')).toBe(false)
  })

  it('uses researched default formations for all ten playable teams', () => {
    expect(getTeamDefaultFormation('france')).toBe('4-3-3')
    expect(getTeamDefaultFormation('brazil')).toBe('4-2-3-1')
    expect(getTeamDefaultFormation('argentina')).toBe('4-3-3')
    expect(getTeamDefaultFormation('portugal')).toBe('4-2-3-1')
    expect(getTeamDefaultFormation('germany')).toBe('4-2-3-1')
    expect(getTeamDefaultFormation('japan')).toBe('3-4-2-1')
    expect(getTeamDefaultFormation('norway')).toBe('4-3-3')
    expect(getTeamDefaultFormation('morocco')).toBe('4-3-3')
    expect(getTeamDefaultFormation('newzealand')).toBe('4-3-3')
    expect(getTeamDefaultFormation('curacao')).toBe('4-3-3')
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
    expect(generateOpponentTeam('塞内加尔', null, 'medium')).toEqual(first.lineup)
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

  it('keeps the designed 32 key decision scenarios available', () => {
    expect(DECISION_LIBRARY).toHaveLength(32)
    expect(DECISION_LIBRARY.map(scenario => scenario.id)).toEqual(expect.arrayContaining([
      'penalty_area_dive',
      'var_penalty_review',
      'defend_dangerous_freekick',
      'box_second_ball_chaos',
    ]))
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
    expect(ANIMATION_TEMPLATES.attack_dive.result_animations.penalty_won).toBeTruthy()
    expect(ANIMATION_TEMPLATES.var_penalty.result_animations.penalty_awarded).toBeTruthy()
    expect(ANIMATION_TEMPLATES.defend_freekick.result_animations.wall_block).toBeTruthy()
    expect(ANIMATION_TEMPLATES.box_chaos.result_animations.cleared_second_ball).toBeTruthy()
    expect(ANIMATION_TEMPLATES.defend_opponent_penalty.result_animations.opponent_saved_left).toBeTruthy()
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

    const redCardRolls = [0.01, 0, 0, 0, 0.001, 0]
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
        { minute: 32, situation: '获得点球', choiceLabel: '射向左下角', resultText: '点球罚进', isSuccess: true },
        { minute: 74, situation: '对方快速反击', choiceLabel: '战术犯规', resultText: '吃到黄牌', isSuccess: false },
      ],
    }, '法国')

    expect(insights.summary).toContain('2次临场决策')
    expect(insights.decisionItems).toHaveLength(2)
    expect(insights.decisionItems[0]).toContain('32′')
    expect(insights.advice.join('')).toContain('纪律')
  })
})

describe('landscape match presentation', () => {
  it('cycles the retained match acceleration controls', () => {
    expect(getNextMatchSpeed(1)).toBe(3)
    expect(getNextMatchSpeed(3)).toBe(6)
    expect(getNextMatchSpeed(6)).toBe(1)
  })

  it('attaches the ball at the carrier feet and bridges decisions with a pass', () => {
    expect(getBallAttachmentPoint({ x: 40, y: 55 }, 1)).toEqual({ x: 41.35, y: 56.1 })
    expect(getDecisionBridge('6号', '10号', {
      '6号': { x: 30, y: 50, team: 'my' },
      '10号': { x: 60, y: 50, team: 'my' },
    })).toMatchObject({
      type: 'pass',
      fromName: '6号',
      targetName: '10号',
    })
  })

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

  it('moves the outgoing player to the live bench and rejects duplicate substitutions', () => {
    const starter = { id: 'starter', name: '首发', pos: 'MF' }
    const bench = { id: 'bench', name: '替补', position: 'FW' }
    const roster = [starter, bench]
    const swapped = swapMatchPlayer([starter], bench, starter)

    expect(swapped).toEqual([{ ...bench, pos: 'MF', position: 'MF' }])
    expect(getMatchBench(roster, swapped)).toEqual([starter])
    expect(swapMatchPlayer(swapped, bench, swapped[0])).toBeNull()
  })

  it('maps tactical coordinates onto the same top-down horizontal pitch used by the Phaser demo', () => {
    const pitch = createPitchBounds(780, 480)
    const ownGoal = tacticalToPhaserPoint(50, 0, pitch)
    const center = tacticalToPhaserPoint(50, 50, pitch)
    const opponentGoal = tacticalToPhaserPoint(50, 100, pitch)

    expect(pitch).toEqual({ x: 40, y: 60, width: 700, height: 360 })
    expect(ownGoal.x).toBeLessThan(center.x)
    expect(opponentGoal.x).toBeGreaterThan(center.x)
    expect(ownGoal.y).toBe(center.y)
  })

  it('provides distinct pixel kits for all ten playable teams', () => {
    const playableTeamIds = teams.map(team => team.id)
    const kits = playableTeamIds.map(teamId => getTeamKit(teamId))

    expect(kits).toHaveLength(10)
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

  it('maps tactical progress from left goal to right goal on a native landscape pitch', () => {
    const myGoal = mapPitchPointToLandscape(50, 5, 900, 600)
    const center = mapPitchPointToLandscape(50, 50, 900, 600)
    const opponentGoal = mapPitchPointToLandscape(50, 95, 900, 600)

    expect(myGoal.px).toBeLessThan(center.px)
    expect(opponentGoal.px).toBeGreaterThan(center.px)
    expect(myGoal.py).toBeCloseTo(center.py)
  })

  it('fits a complete 3:2 field inside the available match area', () => {
    expect(getFittedLandscapePitchSize(960, 540)).toEqual({ width: 810, height: 540 })
    expect(getFittedLandscapePitchSize(600, 600)).toEqual({ width: 600, height: 400 })
  })

  it('maps match outcomes to the supplied pixel event assets', () => {
    expect(getMatchEventVisual('goal_placement', { homeScoreChange: 1 })).toEqual({
      type: 'goal',
      src: MATCH_EVENT_ASSETS.goal,
      label: '进球',
    })
    expect(getMatchEventVisual('gk_reaction_save', {})).toMatchObject({
      type: 'save',
      src: MATCH_EVENT_ASSETS.save,
    })
    expect(getMatchEventVisual('red_card_penalty', {})).toMatchObject({
      type: 'redCard',
      src: MATCH_EVENT_ASSETS.redCard,
    })
    expect(getMatchEventVisual('yellow_card_dive', {})).toMatchObject({
      type: 'yellowCard',
      src: MATCH_EVENT_ASSETS.yellowCard,
    })
    expect(getMatchEventVisual('deflected_corner', {})).toMatchObject({
      type: 'corner',
      src: MATCH_EVENT_ASSETS.corner,
    })
  })

  it('does not append the same commentary twice for one match minute', () => {
    const first = appendCommentaryEntry([], {
      id: 1,
      text: "12' 本方4号正在带球推进 → 本方3号前插接应 → 对方5号上前封堵",
      color: '#F3E3B4',
    })
    const repeated = appendCommentaryEntry(first, {
      id: 2,
      text: "12' 本方4号正在带球推进 → 本方3号前插接应 → 对方5号上前封堵",
      color: '#F3E3B4',
    })

    expect(repeated).toHaveLength(1)
  })

  it('keeps the original goal text over the transparent goal image without a backdrop', () => {
    expect(getGoalOverlayLayers()).toEqual({
      image: true,
      text: true,
      backdrop: false,
    })
  })

  it('clears the previous result before opening a chained penalty decision', () => {
    const setDecisionResult = vi.fn()
    const setCurrentDecision = vi.fn()
    const penaltyDecision = { kind: 'opponent_penalty' }

    openChainedDecision(penaltyDecision, { setDecisionResult, setCurrentDecision })

    expect(setDecisionResult).toHaveBeenCalledWith(null)
    expect(setCurrentDecision).toHaveBeenCalledWith(penaltyDecision)
  })
})
