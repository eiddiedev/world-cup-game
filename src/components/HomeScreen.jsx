import React, { useState } from 'react'
import { hasContinueGame, getCodexProgress } from '../utils/saveManager'
import { hasVariantFeature, IS_ONLINE_ENTRY_ENABLED } from '../config/runtime'
import { BRANDING_ASSETS } from '../config/artAssets'

const PRIMARY_MODES = [
  { id: 'journey', label: '冠军征程' },
]

const CONTINUE_STAGES = new Set([
  'team-select',
  'recruitment',
  'tournament',
  'lineup',
  'item-prep',
  'match',
  'post-match',
  'ending',
])

/**
 * 首页只呈现正式玩法入口。
 * 开发实验、AI 和商业化能力保留在项目内部，不占用主菜单层级。
 */
export default function HomeScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const [selectedMode, setSelectedMode] = useState(null)
  const codexEnabled = hasVariantFeature('codex')
  const codexProgress = codexEnabled ? getCodexProgress(saveData) : null
  const hasSave = hasContinueGame(saveData)
  const journeyRun = saveData.journeyRun || saveData.currentRun
  const canContinueMode = selectedMode === 'journey' && hasSave

  const openModeDialog = (mode) => setSelectedMode(mode)

  const startNewGame = () => {
    const mode = selectedMode
    setSelectedMode(null)
    navigateTo('team-select', { gameMode: mode })
  }

  const continueGame = () => {
    if (!canContinueMode) {
      showToast('暂无冠军征程存档')
      return
    }
    const stage = journeyRun?.stage || 'tournament'
    updateSaveData({ ...saveData, currentRun: journeyRun, journeyRun })
    setSelectedMode(null)
    navigateTo(CONTINUE_STAGES.has(stage) ? stage : 'tournament', {
      gameMode: 'journey',
    })
  }

  const selectedModeLabel = '冠军征程'

  return (
    <main className="screen home-screen">
      <img className="home-bg" src={BRANDING_ASSETS.homeBackground} alt="" aria-hidden="true" />
      <section className="home-stage" aria-label="剑指美加墨">
        <h1 className="PixelTitle title-lockup">
          <span className="logo-animation">
            <img className="logo-frame logo-frame-1" src={BRANDING_ASSETS.titleFrame1} alt="剑指美加墨" />
            <img className="logo-frame logo-frame-2" src={BRANDING_ASSETS.titleFrame2} alt="" />
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

          {IS_ONLINE_ENTRY_ENABLED && (
            <button
              type="button"
              className="PixelButton menu-button"
              onClick={() => navigateTo('online-lobby', { gameMode: 'online' })}
            >
              <span className="button-face" aria-hidden="true" />
              <span className="button-label">联机对战</span>
            </button>
          )}

          <button
            type="button"
            className="PixelButton menu-button"
            onClick={() => navigateTo('settings')}
          >
            <span className="button-face" aria-hidden="true" />
            <span className="button-label">设置</span>
          </button>
        </nav>

        {codexEnabled && (
          <aside className="PixelPanel codex-panel" onClick={() => navigateTo('codex')} role="button" tabIndex={0} aria-label="图鉴">
            <img src="/assets/图鉴.png" alt="" className="codex-panel-icon" />
            <span className="codex-panel-label">图鉴</span>
            <span className="codex-panel-progress">{codexProgress.done}/{codexProgress.total}</span>
          </aside>
        )}
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
              {hasSave ? '可继续上次的冠军征程' : '该模式暂无存档'}
            </p>
          </section>
        </div>
      )}
    </main>
  )
}
