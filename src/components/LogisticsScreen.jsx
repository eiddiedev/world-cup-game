import React, { useState } from 'react'
import { getTeamById } from '../data/teams'
import {
  LOGISTICS_DEPARTMENTS,
  getUpgradeCost,
  getMaxLevel,
} from '../data/logisticsDepartments'
import '../styles/logistics.css'

/**
 * 后勤配置页面
 * 征召完成后、比赛开始前，玩家用后勤预算升级六大部门
 */
export default function LogisticsScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const team = getTeamById(saveData.currentRun?.teamId)
  const currentRun = saveData.currentRun || {}
  const [levels, setLevels] = useState(currentRun.logisticsLevels || {})
  const [budget, setBudget] = useState(currentRun.logisticsBudget || 0)

  if (!team) {
    return (
      <div className="screen">
        <p>错误：未找到球队数据</p>
        <button className="PixelButton" onClick={() => navigateTo('home')}>
          <span className="button-face" aria-hidden="true"></span>
          <span className="button-label">返回首页</span>
        </button>
      </div>
    )
  }

  const handleUpgrade = (deptId) => {
    const currentLevel = levels[deptId] || 0
    const maxLevel = getMaxLevel(deptId)
    if (currentLevel >= maxLevel) {
      showToast('已达最高等级')
      return
    }
    const cost = getUpgradeCost(deptId, currentLevel)
    if (cost > budget) {
      showToast('后勤预算不足')
      return
    }
    setLevels({ ...levels, [deptId]: currentLevel + 1 })
    setBudget(budget - cost)
    showToast(`升级成功！`)
  }

  const handleDowngrade = (deptId) => {
    const currentLevel = levels[deptId] || 0
    if (currentLevel <= 0) {
      showToast('已是最低等级')
      return
    }
    const dept = LOGISTICS_DEPARTMENTS.find(d => d.id === deptId)
    const refund = dept.levels[currentLevel].cost
    setLevels({ ...levels, [deptId]: currentLevel - 1 })
    setBudget(budget + refund)
    showToast(`已降级，返还 ${refund}`)
  }

  const handleAutoUpgrade = () => {
    let newLevels = { ...levels }
    let remaining = budget
    let upgraded = false
    let changed = true
    while (changed) {
      changed = false
      for (const dept of LOGISTICS_DEPARTMENTS) {
        const lvl = newLevels[dept.id] || 0
        const maxLvl = getMaxLevel(dept.id)
        if (lvl >= maxLvl) continue
        const cost = getUpgradeCost(dept.id, lvl)
        if (cost <= remaining) {
          newLevels[dept.id] = lvl + 1
          remaining -= cost
          changed = true
          upgraded = true
        }
      }
    }
    if (upgraded) {
      setLevels(newLevels)
      setBudget(remaining)
      showToast('一键升级完成！')
    } else {
      showToast('预算不足以升级任何部门')
    }
  }

  const handleConfirm = () => {
    const nextStage = 'tournament'
    updateSaveData({
      ...saveData,
      currentRun: {
        ...currentRun,
        logisticsLevels: levels,
        logisticsBudget: budget,
        stage: nextStage,
      },
    })
    navigateTo(nextStage)
  }

  return (
    <div className="screen logistics-screen">
      <div className="logistics-header">
        <div className="screen-header">
          <button className="back-button" onClick={() => navigateTo('recruitment', { skipRecruitmentGuard: true })}>
            ←
          </button>
          <h1>后勤配置 - {team.name}</h1>
        </div>

        <p className="logistics-hint">
          升级后勤部门提升球队实力。未花完的预算将保留到下一届，赛事奖金也会累积。
        </p>

        <div className="logistics-budget-bar" data-guide="logistics-budget">
          <span className="budget-label">后勤预算</span>
          <span className="budget-value">
            {budget}
            <img src="/assets/金币.png" alt="后勤预算" className="coin-icon" />
          </span>
        </div>
      </div>

      <div className="logistics-grid">
        {LOGISTICS_DEPARTMENTS.map((dept, deptIndex) => {
          const currentLevel = levels[dept.id] || 0
          const maxLevel = getMaxLevel(dept.id)
          const isMaxed = currentLevel >= maxLevel
          const nextCost = isMaxed ? null : getUpgradeCost(dept.id, currentLevel)
          const canAfford = nextCost != null && nextCost <= budget
          const currentLevelData = dept.levels[currentLevel]
          const nextLevelData = !isMaxed ? dept.levels[currentLevel + 1] : null

          return (
            <div
              key={dept.id}
              className={`logistics-card ${isMaxed ? 'maxed' : ''}`}
              data-guide={deptIndex === 0 ? 'logistics-card' : undefined}
            >
              {/* 图标 */}
              <div className="card-icon-wrap">
                <img src={dept.icon} alt={dept.name} />
              </div>

              {/* 部门名称 */}
              <div className="card-name">{dept.name}</div>

              {/* 等级行 */}
              <div className="card-level-row">
                <span className="level-badge">Lv.{currentLevel}</span>
                <span className="level-name">{currentLevelData?.name}</span>
              </div>

              {/* 当前效果 */}
              <p className="card-effect">{currentLevelData?.desc}</p>

              {/* 分隔线 + 下一级 */}
              {nextLevelData && (
                <>
                  <div className="card-divider" />
                  <p className="card-next">下一级：{nextLevelData.desc}</p>
                </>
              )}

              {/* 操作按钮 */}
              <div className="card-actions">
                {isMaxed ? (
                  <>
                    <span className="maxed-text">MAX</span>
                    <button className="btn-downgrade" onClick={() => handleDowngrade(dept.id)}>
                      ↓ 降级
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={`btn-upgrade ${!canAfford ? 'disabled' : ''}`}
                      onClick={() => handleUpgrade(dept.id)}
                      disabled={!canAfford}
                    >
                      升级 {nextCost}<img src="/assets/金币.png" alt="" className="btn-coin" />
                    </button>
                    {currentLevel > 0 && (
                      <button className="btn-downgrade" onClick={() => handleDowngrade(dept.id)}>
                        ↓ 降级
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 等级进度条 */}
              <div className="card-progress">
                {Array.from({ length: maxLevel + 1 }, (_, i) => (
                  <span key={i} className={`pip ${i <= currentLevel ? 'active' : ''}`} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="logistics-footer">
        <button className="PixelButton secondary-button" onClick={handleAutoUpgrade} data-guide="logistics-auto">
          <span className="button-face" aria-hidden="true"></span>
          <span className="button-label">一键升级</span>
        </button>
        <button className="PixelButton" onClick={handleConfirm} data-guide="logistics-confirm">
          <span className="button-face" aria-hidden="true"></span>
          <span className="button-label">确认配置，进入赛程</span>
        </button>
      </div>
    </div>
  )
}
