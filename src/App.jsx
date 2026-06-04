import React, { useState, useEffect } from 'react'
import { loadSaveData, persistSaveData } from './utils/saveManager'
import { initAudio, audioManager } from './utils/audioManager'
import HomeScreen from './components/HomeScreen'
import TeamSelectScreen from './components/TeamSelectScreen'
import RecruitmentScreen from './components/RecruitmentScreen'
import LineupScreen from './components/LineupScreen'
import TournamentScreen from './components/TournamentScreen'
import MatchScreen from './components/MatchScreen'
import PostMatchScreen from './components/PostMatchScreen'
import EndingScreen from './components/EndingScreen'
import SettingsScreen from './components/SettingsScreen'

/**
 * 剑指美加墨 — 主应用组件
 * 管理游戏页面路由和全局状态
 */
export default function App() {
  const [saveData, setSaveData] = useState(null)
  const [currentScreen, setCurrentScreen] = useState('home')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const data = loadSaveData()
    setSaveData(data)

    // 初始化音效系统
    try {
      initAudio(data.settings)
    } catch (e) {
      console.log('Audio initialization failed:', e)
    }
  }, [])

  useEffect(() => {
    if (saveData?.settings) {
      audioManager.applySettings(saveData.settings)
    }
  }, [saveData?.settings])

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

  const updateSaveData = (newData) => {
    setSaveData(newData)
    persistSaveData(newData)
  }

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  const navigateTo = (screen) => {
    // 防止在比赛进行中返回招募页面（但允许返回首页）
    const stage = saveData?.currentRun?.stage
    const isRecruitmentDone = stage && ['tournament', 'lineup', 'match', 'post-match', 'knockout', 'ending'].includes(stage)

    if (screen === 'recruitment' && isRecruitmentDone) {
      showToast('阵容已确认，无法返回招募页面')
      return
    }

    setCurrentScreen(screen)
  }

  if (!saveData) return <div className="loading">加载中...</div>

  const screenProps = {
    saveData,
    updateSaveData,
    navigateTo,
    showToast,
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
      default:
        return <HomeScreen {...screenProps} />
    }
  }

  return (
    <div className="app">
      {renderScreen()}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
