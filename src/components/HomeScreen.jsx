import React, { useState } from 'react'
import { teams } from '../data/teams'
import { getHomeProgress, hasContinueGame } from '../utils/saveManager'

const PRIMARY_MODES = [
  { id: 'coach', label: '教练模式' },
  { id: 'player', label: '球员模式' },
]

const CONTINUE_STAGES = new Set([
  'team-select',
  'recruitment',
  'tournament',
  'lineup',
  'match',
  'post-match',
  'ending',
])

/**
 * 首页只呈现玩家真正需要选择的四个入口。
 * 开发实验、AI 和商业化能力保留在项目内部，不占用主菜单层级。
 */
export default function HomeScreen({ saveData, navigateTo, showToast }) {
  const [selectedMode, setSelectedMode] = useState(null)
  const progress = getHomeProgress(saveData, teams)
  const hasSave = hasContinueGame(saveData)
  const savedMode = saveData.currentRun?.gameMode || 'coach'
  const canContinueMode = hasSave && selectedMode === savedMode

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

    const stage = saveData.currentRun?.stage || 'tournament'
    setSelectedMode(null)
    navigateTo(CONTINUE_STAGES.has(stage) ? stage : 'tournament', {
      gameMode: selectedMode,
    })
  }

  const selectedModeLabel = selectedMode === 'player' ? '球员模式' : '教练模式'
  const savedModeLabel = savedMode === 'player' ? '球员模式' : '教练模式'

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
            onClick={() => navigateTo('penalty-mode')}
          >
            <span className="button-face" aria-hidden="true" />
            <span className="button-label">点球大战</span>
          </button>

          <button
            type="button"
            className="PixelButton menu-button"
            onClick={() => navigateTo('settings')}
          >
            <span className="button-face" aria-hidden="true" />
            <span className="button-label">设置</span>
          </button>
        </nav>

        <aside className="PixelPanel unlock-panel" aria-label="通关进度">
          <div className="unlock-copy">
            <span>通关球队</span>
            <strong>{progress.champion} / {progress.total}</strong>
          </div>
          <ul className="flag-strip">
            {teams.map((team) => {
              const isChampion = progress.championTeamIds.includes(team.id)
              return (
                <li
                  key={team.id}
                  className={`PixelBadge flag-chip ${isChampion ? 'is-champion' : 'is-normal'}`}
                  aria-label={`${team.name}${isChampion ? '已通关' : '未通关'}`}
                >
                  <img src={team.flag} alt="" />
                  {!isChampion && <img src="/assets/锁.png" alt="" className="lock-icon" />}
                </li>
              )
            })}
          </ul>
        </aside>
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
                <span className="button-label">新开存档</span>
              </button>
              <button
                type="button"
                className="PixelButton"
                onClick={continueGame}
                disabled={!canContinueMode}
              >
                <span className="button-face" aria-hidden="true" />
                <span className="button-label">继续游戏</span>
              </button>
            </div>

            <p className="mode-save-status">
              {!hasSave
                ? '当前没有进行中的存档'
                : canContinueMode
                  ? `可继续上次的${selectedModeLabel}`
                  : `当前存档属于${savedModeLabel}`}
            </p>
          </section>
        </div>
      )}
    </main>
  )
}
