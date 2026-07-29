import React, { useState } from 'react'
import { hasContinueGame } from '../utils/saveManager'

const PRIMARY_MODES = [
  { id: 'coach', label: '教练模式' },
  { id: 'player', label: '球员模式' },
]

const CONTINUE_STAGES = new Set([
  'team-select',
  'recruitment',
  'logistics',
  'tournament',
  'lineup',
  'match',
  'post-match',
  'ending',
])

/**
 * 首页呈现双模式与设置入口。
 */
export default function HomeScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const [selectedMode, setSelectedMode] = useState(null)
  const hasSave = hasContinueGame(saveData)
  const savedMode = saveData.currentRun?.gameMode || 'coach'
  // 球员模式独立存档判断
  const playerModeHasSave = Boolean(saveData.playerModeRun)
  const canContinueMode = selectedMode === 'player'
    ? playerModeHasSave
    : (hasSave && savedMode === 'coach')

  const openModeDialog = (mode) => setSelectedMode(mode)

  const startNewGame = () => {
    const mode = selectedMode
    setSelectedMode(null)
    navigateTo('team-select', { gameMode: mode })
  }

  const continueGame = () => {
    if (!canContinueMode) {
      showToast(`暂无${selectedMode === 'player' ? '球员' : '教练'}模式存档`)
      return
    }

    if (selectedMode === 'player') {
      // 球员模式：从 playerModeRun 恢复
      const playerRun = saveData.playerModeRun
      const stage = playerRun?.stage || 'tournament'
      updateSaveData({ ...saveData, currentRun: playerRun })
      setSelectedMode(null)
      navigateTo(CONTINUE_STAGES.has(stage) ? stage : 'tournament', {
        gameMode: 'player',
      })
      return
    }

    const stage = saveData.currentRun?.stage || 'tournament'
    setSelectedMode(null)
    navigateTo(CONTINUE_STAGES.has(stage) ? stage : 'tournament', {
      gameMode: selectedMode,
    })
  }

  const selectedModeLabel = selectedMode === 'player' ? '球员模式' : '教练模式'

  return (
    <main className="screen home-screen">
      <img className="home-bg" src="/assets/背景图.png" alt="" aria-hidden="true" />
      <section className="home-stage" aria-label="剑指美加墨">
        <h1 className="PixelTitle title-lockup">
          <span className="logo-animation">
            <img className="logo-frame logo-frame-1" src="/assets/logo.png" alt="剑指美加墨" />
            <img className="logo-frame logo-frame-2" src="/assets/logo2.png" alt="" />
          </span>
        </h1>

        <nav className="main-menu" aria-label="主菜单">
          {PRIMARY_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className="PixelButton menu-button is-primary-mode"
              onClick={() => openModeDialog(mode.id)}
            >
              <span className="button-face" aria-hidden="true" />
              <span className="button-label">{mode.label}</span>
            </button>
          ))}

          <button
            type="button"
            className="PixelButton menu-button"
            onClick={() => navigateTo('settings')}
          >
            <span className="button-face" aria-hidden="true" />
            <span className="button-label">设置</span>
          </button>

        </nav>

      </section>

      {selectedMode && (
        <div className="mode-save-modal" role="presentation" onClick={() => setSelectedMode(null)}>
          <section
            className="mode-save-dialog PixelPanel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mode-save-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mode-save-header">
              <h2 id="mode-save-title">{selectedModeLabel}</h2>
              <button
                type="button"
                className="mode-save-close"
                aria-label="关闭"
                onClick={() => setSelectedMode(null)}
              >
                ×
              </button>
            </header>

            <p className="mode-save-copy">选择这次要从哪里开始</p>

            <div className="mode-save-actions">
              <button type="button" className="PixelButton" onClick={startNewGame}>
                <span className="button-face" aria-hidden="true" />
                <span className="button-label">新的挑战</span>
              </button>
              <button
                type="button"
                className="PixelButton"
                onClick={continueGame}
                disabled={!canContinueMode}
              >
                <span className="button-face" aria-hidden="true" />
                <span className="button-label">继续征程</span>
              </button>
            </div>

            <p className="mode-save-status">
              {selectedMode === 'player'
                ? (playerModeHasSave ? '可继续上次的球员模式' : '该模式暂无存档')
                : (!hasSave || savedMode !== 'coach'
                  ? '该模式暂无存档'
                  : '可继续上次的教练模式')}
            </p>
          </section>
        </div>
      )}
    </main>
  )
}
