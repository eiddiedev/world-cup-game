import React, { useState, useEffect } from 'react'
import { loadSaveData, persistSaveData, createNewRun } from './utils/saveManager'
import { teams, getTeamById } from './data/teams'
import { initAudio, audioManager } from './utils/audioManager'
import { preloadAssetUrls } from './utils/visualAssetLoader'
import { getCriticalStartupAssets, getSecondaryTeamAssets } from './utils/startupAssets'
import {
  preloadHappySeedMatchAssets,
  preloadHappySeedRuntimeCore,
} from './services/happySeedMatchRuntime'
import HomeScreen from './components/HomeScreen'
import TeamSelectScreen from './components/TeamSelectScreen'
import RecruitmentScreen from './components/RecruitmentScreen'
import LineupScreen from './components/LineupScreen'
import TournamentScreen from './components/TournamentScreen'
import MatchScreen from './components/MatchScreen'
import PostMatchScreen from './components/PostMatchScreen'
import EndingScreen from './components/EndingScreen'
import SettingsScreen from './components/SettingsScreen'
import PixelPlayerLab from './components/PixelPlayerLab'
import EnhancementHubScreen from './components/EnhancementHubScreen'
import PenaltyModeScreen from './components/PenaltyModeScreen'
import CodexScreen from './components/CodexScreen'
import LogisticsScreen from './components/LogisticsScreen'
import TrainingGround from './components/TrainingGround'
import GameLoadingScreen from './components/GameLoadingScreen'
import { IS_DOUYIN_DEMO } from './config/runtime'

const IS_TEST_RUNTIME = import.meta.env.MODE === 'test'

/**
 * 剑指美加墨 — 主应用组件
 * 管理游戏页面路由和全局状态
 */
export default function App() {
  const useDouyinLayout = IS_DOUYIN_DEMO || import.meta.env.DEV
  const [saveData, setSaveData] = useState(null)
  const [currentScreen, setCurrentScreen] = useState('home')
  const [activeGameMode, setActiveGameMode] = useState('coach')
  const [toast, setToast] = useState(null)
  const [startup, setStartup] = useState({
    ready: IS_TEST_RUNTIME,
    progress: IS_TEST_RUNTIME ? 100 : 0,
    detail: IS_TEST_RUNTIME ? '必要资源加载完成' : '正在准备主视觉',
  })

  useEffect(() => {
    const data = loadSaveData()
    setSaveData(data)
    setActiveGameMode(data.currentRun?.gameMode || 'coach')

    // 初始化音效系统
    try {
      initAudio(data.settings)
    } catch (e) {
      console.log('Audio initialization failed:', e)
    }
  }, [])

  useEffect(() => {
    if (IS_TEST_RUNTIME) return undefined
    let cancelled = false
    preloadAssetUrls(getCriticalStartupAssets(teams), {
      concurrency: 8,
      onProgress: ({ percent, completed, total }) => {
        if (cancelled) return
        setStartup({
          ready: false,
          progress: percent,
          detail: completed < 7 ? '正在准备主标题与背景' : `正在加载 16 支国家队资源 · ${completed}/${total}`,
        })
      },
    }).then(({ failures }) => {
      if (cancelled) return
      if (failures.length) console.warn('[Startup] 部分资源稍后重试', failures)
      setStartup({ ready: true, progress: 100, detail: '必要资源加载完成' })

      const warmup = () => {
        preloadAssetUrls(getSecondaryTeamAssets(teams), { concurrency: 6 }).catch(() => {})
        preloadHappySeedRuntimeCore().catch((error) => {
          console.warn('[Match preload] 比赛引擎将在进入比赛时重试', error)
        })
      }
      if ('requestIdleCallback' in window) window.requestIdleCallback(warmup, { timeout: 1500 })
      else window.setTimeout(warmup, 150)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (saveData?.settings) {
      audioManager.applySettings(saveData.settings)
    }
  }, [saveData?.settings])

  useEffect(() => {
    const run = saveData?.currentRun
    if (!startup.ready || !run?.teamId) return
    const opponent = getTeamById(run.currentOpponent)
    preloadHappySeedMatchAssets({
      red: run.teamId,
      blue: opponent?.id || 'brazil',
      redFormation: run.formation,
      redSquadPlayerIds: run.roster || run.purchasedPlayerIds || [],
      redLineupPlayerIds: run.lineup || [],
      redPlayerStateById: run.playerMatchStates || {},
      redUnavailablePlayerIds: [
        ...(run.injuredPlayers || []),
        ...(run.suspendedPlayers || []),
      ],
    }).catch((error) => {
      console.warn('[Match preload] 本场资源将在开赛时重试', error)
    })
  }, [saveData?.currentRun, startup.ready])

  useEffect(() => {
    const handleGlobalPointerDown = (event) => {
      const control = event.target.closest?.(
        'button, [role="button"], .team-card, .game-card, .pitch-slot, .bench-player, .match-item',
      )
      if (!control || control.disabled || control.getAttribute?.('aria-disabled') === 'true') return
      audioManager.unlock()
      audioManager.playClick()
      audioManager.vibrate(12)
    }

    document.addEventListener('pointerdown', handleGlobalPointerDown, true)
    return () => document.removeEventListener('pointerdown', handleGlobalPointerDown, true)
  }, [])

  // 测试快捷键：C 直接夺冠 / R 雨天比赛
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (event.key === 'r' || event.key === 'R') {
        // 强制雨天 + 教练模式快速进入比赛
        window.__happySeedForceWeather = 'rain'
        const team = teams.find(t => t.id === 'france') || teams[0]
        const playerIds = (team.players || []).map(p => p.id)
        const lineup = playerIds.slice(0, 11)
        setSaveData((prev) => {
          const base = prev || loadSaveData()
          const newRun = {
            ...createNewRun(team.id, 'coach', base),
            stage: 'match',
            purchasedPlayerIds: playerIds,
            roster: playerIds,
            lineup,
          }
          const next = { ...base, currentRun: newRun }
          persistSaveData(next)
          return next
        })
        setActiveGameMode('coach')
        setCurrentScreen('match')
        return
      }
      if (event.key === 'c' || event.key === 'C') {
        setSaveData((prev) => {
          if (!prev?.currentRun) return prev
          const next = {
            ...prev,
            currentRun: {
              ...prev.currentRun,
              knockoutRound: 'final',
              isKnockoutMatch: false,
              stage: 'ending',
              matchResults: ['win', 'win', 'win'],
              knockoutResults: ['win', 'win', 'win', 'win', 'win'],
              lastMatchResult: {
                result: 'win',
                homeScore: 3,
                awayScore: 0,
                teamName: prev.currentRun.teamId || '',
                opponent: '对手',
              },
            },
          }
          if (next.currentRun.gameMode === 'player') {
            next.playerModeRun = next.currentRun
          }
          persistSaveData(next)
          return next
        })
        setCurrentScreen('ending')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const updateSaveData = (newData) => {
    // 球员模式存档同步：当 currentRun 属于球员模式时，同步写入 playerModeRun
    if (newData.currentRun?.gameMode === 'player') {
      newData = { ...newData, playerModeRun: newData.currentRun }
    }
    setSaveData(newData)
    persistSaveData(newData)
  }

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  const navigateTo = (screen, { skipRecruitmentGuard = false, gameMode } = {}) => {
    if (gameMode === 'coach' || gameMode === 'player') {
      setActiveGameMode(gameMode)
    }
    // 防止在比赛进行中返回招募页面（但允许返回首页）
    if (screen === 'recruitment' && !skipRecruitmentGuard) {
      // Use latest save data to check stage (avoids stale closure issue)
      const latestData = loadSaveData()
      const stage = latestData?.currentRun?.stage
      const isRecruitmentDone = stage && ['logistics', 'tournament', 'lineup', 'match', 'post-match', 'knockout', 'ending'].includes(stage)
      if (isRecruitmentDone) {
        showToast('阵容已确认，无法返回招募页面')
        return
      }
    }

    setCurrentScreen(screen)
  }

  if (!saveData || !startup.ready) {
    return (
      <GameLoadingScreen
        progress={startup.progress}
        detail={saveData ? startup.detail : '正在读取本地存档'}
      />
    )
  }

  const screenProps = {
    saveData,
    updateSaveData,
    navigateTo,
    showToast,
    gameMode: activeGameMode,
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen {...screenProps} />
      case 'team-select':
        return <TeamSelectScreen {...screenProps} />
      case 'recruitment':
        return <RecruitmentScreen {...screenProps} />
      case 'lineup':
        return <LineupScreen {...screenProps} />
      case 'tournament':
        return <TournamentScreen {...screenProps} />
      case 'match':
        return <MatchScreen {...screenProps} />
      case 'post-match':
        return <PostMatchScreen {...screenProps} />
      case 'ending':
        return <EndingScreen {...screenProps} />
      case 'settings':
        return <SettingsScreen {...screenProps} />
      case 'penalty-mode':
        return <PenaltyModeScreen {...screenProps} />
      case 'codex':
        return <CodexScreen {...screenProps} />
      case 'logistics':
        return <LogisticsScreen {...screenProps} />
      case 'training':
        return <TrainingGround {...screenProps} />
      case 'enhancement-hub':
        return <EnhancementHubScreen {...screenProps} />
      case 'pixel-player-lab':
        return <PixelPlayerLab {...screenProps} />
      default:
        return <HomeScreen {...screenProps} />
    }
  }

  return (
    <div className={`app${useDouyinLayout ? ' douyin-demo' : ''}`}>
      {renderScreen()}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
