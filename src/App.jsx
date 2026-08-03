import React, { useState, useEffect } from 'react'
import { loadSaveData, persistSaveData, createNewRun } from './utils/saveManager'
import { teams, getTeamById } from './data/teams'
import { initAudio, audioManager } from './utils/audioManager'
import { preloadAssetUrls, preloadAssetUrlsSoftly } from './utils/visualAssetLoader'
import {
  getCriticalStartupAssets,
  getPenaltyShootoutAssets,
  getSecondaryTeamAssets,
  getSelectedTeamPlayerAssets,
} from './utils/startupAssets'
import {
  preloadHappySeedMatchAssets,
  preloadHappySeedRuntimeCore,
} from './services/happySeedMatchRuntime'
import HomeScreen from './components/HomeScreen'
import TeamSelectScreen from './components/TeamSelectScreen'
import RecruitmentScreen from './components/RecruitmentScreen'
import LineupScreen from './components/LineupScreen'
import LogisticsScreen from './components/LogisticsScreen'
import TournamentScreen from './components/TournamentScreen'
import MatchScreen from './components/MatchScreen'
import PostMatchScreen from './components/PostMatchScreen'
import EndingScreen from './components/EndingScreen'
import SettingsScreen from './components/SettingsScreen'
import PixelPlayerLab from './components/PixelPlayerLab'
import EnhancementHubScreen from './components/EnhancementHubScreen'
import PenaltyModeScreen from './components/PenaltyModeScreen'
import CodexScreen from './components/CodexScreen'
import TrainingGround from './components/TrainingGround'
import GameLoadingScreen from './components/GameLoadingScreen'
import SpotlightTour from './components/SpotlightTour.jsx'
import { getScreenSpotlightTour } from './data/spotlightTours.js'
import { IS_DOUYIN_DEMO } from './config/runtime'

const IS_TEST_RUNTIME = import.meta.env.MODE === 'test'

function scheduleSoftTask(callback, { delayMs = 1200, idleTimeoutMs = 3500 } = {}) {
  let idleId = null
  let cancelled = false
  const delayId = window.setTimeout(() => {
    if (cancelled) return
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => {
        if (!cancelled) callback()
      }, { timeout: idleTimeoutMs })
    } else {
      callback()
    }
  }, delayMs)

  return () => {
    cancelled = true
    window.clearTimeout(delayId)
    if (idleId != null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId)
  }
}

function shouldSoftLoadHeavyAssets() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (connection?.saveData) return false
  return !['slow-2g', '2g'].includes(connection?.effectiveType)
}

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
    ready: IS_TEST_RUNTIME || IS_DOUYIN_DEMO,
    progress: IS_TEST_RUNTIME || IS_DOUYIN_DEMO ? 100 : 0,
    detail: IS_TEST_RUNTIME || IS_DOUYIN_DEMO ? '必要资源加载完成' : '正在准备主视觉',
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
    // 互动空间优先完成 React 首绘，图片由页面按需加载，避免冷启动被
    // 22 个视觉资源阻塞。完整版仍保留启动预载和进度反馈。
    if (IS_TEST_RUNTIME || IS_DOUYIN_DEMO) return undefined
    let cancelled = false
    preloadAssetUrls(getCriticalStartupAssets(teams), {
      concurrency: 6,
      onProgress: ({ percent, completed, total }) => {
        if (cancelled) return
        setStartup({
          ready: false,
          progress: percent,
          detail: completed < 14
            ? `正在准备主标题与基础图标 · ${completed}/${total}`
            : `正在加载 ${teams.length} 支国家队选择卡片 · ${completed}/${total}`,
        })
      },
    }).then(({ failures }) => {
      if (cancelled) return
      if (failures.length) console.warn('[Startup] 部分资源稍后重试', failures)
      setStartup({ ready: true, progress: 100, detail: '必要资源加载完成' })
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (IS_TEST_RUNTIME || IS_DOUYIN_DEMO || !startup.ready) return undefined
    let cancelled = false
    const cancelTask = scheduleSoftTask(() => {
      preloadHappySeedRuntimeCore()
        .then(() => {
          if (cancelled) return
          return preloadAssetUrls(getSecondaryTeamAssets(teams), { concurrency: 2 })
        })
        .catch((error) => {
          console.warn('[Match preload] 比赛引擎将在进入比赛时重试', error)
        })
    })

    return () => {
      cancelled = true
      cancelTask()
    }
  }, [startup.ready])

  useEffect(() => {
    if (saveData?.settings) {
      audioManager.applySettings(saveData.settings)
    }
  }, [saveData?.settings])

  useEffect(() => {
    if (currentScreen !== 'match') audioManager.stopMatchAudio()
  }, [currentScreen])

  useEffect(() => {
    const run = saveData?.currentRun
    if (IS_DOUYIN_DEMO || !startup.ready || !run?.teamId) return
    const selectedTeam = getTeamById(run.teamId)
    const opponent = getTeamById(run.currentOpponent)
    let cancelled = false
    let penaltyTimer = null
    const cancelTask = scheduleSoftTask(async () => {
      const selectedPlayerAssets = preloadAssetUrls(getSelectedTeamPlayerAssets(selectedTeam), {
        concurrency: 4,
      })

      try {
        await Promise.all([
          preloadHappySeedRuntimeCore(),
          selectedPlayerAssets,
        ])
        if (cancelled) return

        await preloadHappySeedMatchAssets({
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
        }, { assetConcurrency: 3 })
        if (cancelled || !shouldSoftLoadHeavyAssets()) return

        penaltyTimer = window.setTimeout(() => {
          preloadAssetUrlsSoftly(getPenaltyShootoutAssets(), {
            batchSize: 1,
            pauseMs: 900,
            shouldContinue: () => !cancelled,
          }).catch(() => {})
        }, 3000)
      } catch (error) {
        console.warn('[Match preload] 本场资源将在开赛时重试', error)
      }
    }, { delayMs: 350, idleTimeoutMs: 1800 })

    return () => {
      cancelled = true
      cancelTask()
      if (penaltyTimer != null) window.clearTimeout(penaltyTimer)
    }
  }, [
    saveData?.currentRun?.teamId,
    saveData?.currentRun?.currentOpponent,
    saveData?.currentRun?.formation,
    saveData?.currentRun?.roster,
    saveData?.currentRun?.purchasedPlayerIds,
    saveData?.currentRun?.lineup,
    saveData?.currentRun?.injuredPlayers,
    saveData?.currentRun?.suspendedPlayers,
    startup.ready,
  ])

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
    if (screen === 'recruitment' && !skipRecruitmentGuard) {
      const latestData = loadSaveData()
      const stage = latestData?.currentRun?.stage
      const isRecruitmentDone = stage && [
        'logistics', 'tournament', 'lineup', 'match', 'post-match', 'ending',
      ].includes(stage)
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
  const screenSpotlightTour = getScreenSpotlightTour(currentScreen, activeGameMode)

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen {...screenProps} />
      case 'team-select':
        return <TeamSelectScreen {...screenProps} />
      case 'recruitment':
        return <RecruitmentScreen {...screenProps} />
      case 'logistics':
        return <LogisticsScreen {...screenProps} />
      case 'lineup':
        return <LineupScreen {...screenProps} />
      case 'tournament':
      case 'mini-cup-prep':
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
        if (IS_DOUYIN_DEMO) return <HomeScreen {...screenProps} />
        return <PenaltyModeScreen {...screenProps} />
      case 'codex':
        if (IS_DOUYIN_DEMO) return <HomeScreen {...screenProps} />
        return <CodexScreen {...screenProps} />
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
    <div className={`app${useDouyinLayout ? ' douyin-demo' : ''}${currentScreen === 'recruitment' ? ' zoom-page-active' : ''}`}>
      {renderScreen()}
      <SpotlightTour tour={screenSpotlightTour} autoStart />
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
