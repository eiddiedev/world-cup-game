import React, { useState } from 'react'
import { teams } from '../data/teams'
import { getHomeProgress, hasContinueGame } from '../utils/saveManager'

/**
 * 首页组件
 * 像素风格，包含背景图、标题图、像素按钮、解锁进度
 */
export default function HomeScreen({ saveData, navigateTo, showToast }) {
  const progress = getHomeProgress(saveData, teams)
  const canContinue = hasContinueGame(saveData)

  const menuItems = [
    { id: 'start', label: '开始征程', primary: true },
    { id: 'continue', label: '继续游戏', disabled: !canContinue },
    { id: 'settings', label: '设置' },
  ]

  const [showConfirm, setShowConfirm] = useState(false)

  const handleMenuAction = (action) => {
    if (action === 'start') {
      if (saveData.currentRun) {
        setShowConfirm(true)
      } else {
        navigateTo('team-select')
      }
    } else if (action === 'continue') {
      if (!saveData.currentRun) {
        showToast('暂无存档，请开始新的征程。')
        return
      }
      const stage = saveData.currentRun.stage || 'tournament'
      const validStages = ['team-select', 'recruitment', 'tournament', 'lineup', 'match', 'post-match', 'ending']
      if (validStages.includes(stage)) {
        navigateTo(stage)
      } else {
        // stage无效，回退到tournament
        navigateTo('tournament')
      }
    } else if (action === 'settings') {
      navigateTo('settings')
    }
  }

  return (
    <main className="screen home-screen">
      <img className="home-bg" src="/assets/背景图.png" alt="" aria-hidden="true" />
      <section className="home-stage" aria-label="剑指美加墨">
        <h1 className="PixelTitle title-lockup">
          <div className="logo-animation">
            <img className="logo-frame logo-frame-1" src="/assets/logo.png" alt="剑指美加墨" />
            <img className="logo-frame logo-frame-2" src="/assets/logo2.png" alt="" />
          </div>
        </h1>

        <nav className="main-menu" aria-label="主菜单">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`PixelButton menu-button ${item.primary ? 'is-primary' : ''}`}
              onClick={() => handleMenuAction(item.id)}
              disabled={item.disabled}
            >
              <span className="button-face" aria-hidden="true"></span>
              <span className="button-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <aside className="PixelPanel unlock-panel" aria-label="解锁进度">
          <div className="unlock-copy">
            <span>已解锁球队</span>
            <strong>{progress.unlocked} / {progress.total}</strong>
          </div>
          <ul className="flag-strip">
            {teams.map((team) => {
              const isUnlocked = progress.unlockedTeamIds.includes(team.id)
              return (
                <li
                  key={team.id}
                  className={`PixelBadge flag-chip ${isUnlocked ? 'is-unlocked' : 'is-locked'}`}
                  aria-label={isUnlocked ? '已解锁球队' : '未解锁球队'}
                >
                  {isUnlocked ? (
                    <img src={team.flag} alt="" />
                  ) : (
                    <span aria-hidden="true">?</span>
                  )}
                </li>
              )
            })}
          </ul>
        </aside>
      </section>

      {showConfirm && (
        <div className="confirm-modal">
          <div className="confirm-content">
            <h3>已有进行中的征程</h3>
            <p>是否开始新的征程？当前进度将被覆盖。</p>
            <div className="confirm-actions">
              <button className="PixelButton" onClick={() => {
                setShowConfirm(false)
                navigateTo('team-select')
              }}>
                <span className="button-face" aria-hidden="true"></span>
                <span className="button-label">确定</span>
              </button>
              <button className="PixelButton" onClick={() => setShowConfirm(false)}>
                <span className="button-face" aria-hidden="true"></span>
                <span className="button-label">取消</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
