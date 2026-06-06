import React, { useMemo } from 'react'
import { getTeamById } from '../data/teams'
import { buildPostMatchInsights } from '../utils/postMatchInsights'
import { getNextRunAfterMatch } from '../utils/tournamentProgress'

/**
 * 赛后结算页面
 */
export default function PostMatchScreen({ saveData, updateSaveData, navigateTo }) {
  const team = getTeamById(saveData.currentRun?.teamId)
  const result = saveData.currentRun?.lastMatchResult
  const lineup = saveData.currentRun?.lineup || []
  const playerStatuses = saveData.currentRun?.playerStatuses || {}
  const matchInjuries = saveData.currentRun?.matchInjuries || []
  const matchRedCards = saveData.currentRun?.matchRedCards || []
  const uniqueMatchInjuries = Array.from(new Set(matchInjuries))
  const uniqueMatchRedCards = Array.from(new Set(matchRedCards))
  const knockoutRound = saveData.currentRun?.knockoutRound

  // 判断是否真正打完所有比赛
  const isKnockoutDone = Boolean(saveData.currentRun?.isKnockoutMatch && knockoutRound === 'final' && result?.result)

  // 状态变化
  const statusChanges = useMemo(() => {
    return lineup.map(player => {
      const oldStatus = playerStatuses[player.id] || player.sta || 80
      const change = Math.floor(Math.random() * 12) - 8
      const newStatus = Math.max(20, Math.min(100, oldStatus + change))
      return { ...player, oldStatus, newStatus, change: newStatus - oldStatus, isInjured: newStatus < 30 }
    })
  }, [lineup, playerStatuses])

  const buildUpdatedRun = (baseRun) => {
    const newStatuses = { ...(baseRun.playerStatuses || {}) }
    const injuredPlayers = []
    statusChanges.forEach(p => {
      newStatuses[p.id] = p.newStatus
      if (p.isInjured) injuredPlayers.push(p.id)
    })
    const updatedRoster = (baseRun.roster || []).map(p => {
      const sc = statusChanges.find(s => s.id === p.id)
      return sc ? { ...p, sta: sc.newStatus } : p
    })
    const injuredSet = new Set(injuredPlayers)
    const updatedLineup = lineup.filter(p => !injuredSet.has(p.id))
    return {
      ...baseRun,
      playerStatuses: newStatuses,
      roster: updatedRoster,
      lineup: updatedLineup.length >= 11 ? updatedLineup : lineup,
      injuredPlayers: [...(baseRun.injuredPlayers || []), ...injuredPlayers],
    }
  }

  if (!result) {
    return (
      <div className="screen empty-state-screen">
        <p>无比赛数据</p>
        <button className="PixelButton compact-button" onClick={() => navigateTo('tournament')}>
          <span className="button-face" aria-hidden="true"></span>
          <span className="button-label">返回赛程</span>
        </button>
      </div>
    )
  }

  const { homeScore, awayScore, opponent } = result
  const isWin = homeScore > awayScore
  const isDraw = homeScore === awayScore
  const resultText = isWin ? '胜利！' : isDraw ? '平局' : '失利'
  const resultEmoji = isWin ? '🎉' : isDraw ? '🤝' : '😢'
  const mvp = lineup.length > 0 ? lineup[Math.floor(Math.random() * lineup.length)] : null
  const injuredCount = statusChanges.filter(p => p.isInjured).length
  const insights = buildPostMatchInsights(result, team?.name)

  const handleNextMatch = () => {
    try {
      const updatedRun = buildUpdatedRun(saveData.currentRun)
      const nextRun = getNextRunAfterMatch(updatedRun)
      updateSaveData({
        ...saveData,
        currentRun: nextRun,
      })
      navigateTo(nextRun.stage === 'ending' ? 'ending' : 'tournament')
    } catch (e) {
      console.error('handleNextMatch error:', e)
      // Fallback: 直接跳转，不更新状态
      navigateTo('tournament')
    }
  }

  const handleViewEnding = () => {
    try {
      const updatedRun = buildUpdatedRun(saveData.currentRun)
      updateSaveData({
        ...saveData,
        currentRun: { ...updatedRun, stage: 'ending', isKnockoutMatch: false },
      })
      navigateTo('ending')
    } catch (e) {
      console.error('handleViewEnding error:', e)
      navigateTo('ending')
    }
  }

  const getStatusColorHex = (status) => {
    if (status >= 80) return 'status-high'
    if (status >= 60) return 'status-mid'
    return 'status-low'
  }

  return (
    <div className="screen post-match-compact">
      {/* 结果头部 */}
      <div className="post-result-header">
        <div className="post-result-emoji">{resultEmoji}</div>
        <h1>{resultText}</h1>
        <div className="post-score-row">
          <span>{team?.name}</span>
          <span className="post-score-box">{homeScore} - {awayScore}</span>
          <span>{opponent}</span>
        </div>
      </div>

      <div className="post-match-content">
        <div className="post-match-column">
          {mvp && (
            <div className="PixelPanel post-mini-panel post-mvp-panel">
              <div className="post-panel-title">最佳球员</div>
              <div className="post-player-name">
                {mvp.name} <span>{mvp.position || mvp.pos}</span>
              </div>
            </div>
          )}

          {result.stats && (
            <div className="PixelPanel post-mini-panel">
              <div className="post-panel-title">比赛数据</div>
              <div className="post-stats-grid">
              <div className="post-stat-row">
                <span className="post-stat-val">{result.stats.myShots}</span>
                <span className="post-stat-label">射门</span>
                <span className="post-stat-val">{result.stats.oppShots}</span>
              </div>
              <div className="post-stat-row">
                <span className="post-stat-val">{result.stats.myShotsOnTarget}</span>
                <span className="post-stat-label">射正</span>
                <span className="post-stat-val">{result.stats.oppShotsOnTarget}</span>
              </div>
              <div className="post-stat-row">
                <span className="post-stat-val">{result.stats.myXG}</span>
                <span className="post-stat-label">预期进球</span>
                <span className="post-stat-val">{result.stats.oppXG}</span>
              </div>
              <div className="post-stat-row">
                <span className="post-stat-val">{result.stats.possession}%</span>
                <span className="post-stat-label">控球率</span>
                <span className="post-stat-val">{100 - result.stats.possession}%</span>
              </div>
              <div className="post-stat-row">
                <span className="post-stat-val">{result.stats.fouls}</span>
                <span className="post-stat-label">犯规</span>
                <span className="post-stat-val">-</span>
              </div>
              <div className="post-stat-row">
                <span className="post-stat-val">{result.stats.corners}</span>
                <span className="post-stat-label">角球</span>
                <span className="post-stat-val">-</span>
              </div>
              <div className="post-stat-row">
                <span className="post-stat-val">{result.stats.penalties || 0}</span>
                <span className="post-stat-label">点球</span>
                <span className="post-stat-val">-</span>
              </div>
              <div className="post-stat-row">
                <span className="post-stat-val">{result.stats.yellowCards}</span>
                <span className="post-stat-label">黄牌</span>
                <span className="post-stat-val">{result.stats.redCards > 0 ? result.stats.redCards : 0}</span>
              </div>
              </div>
              <div className="post-match-summary">{insights.summary}</div>
            </div>
          )}

          <div className="PixelPanel post-mini-panel post-advice-panel">
            <div className="post-panel-title">教练组建议</div>
            {insights.advice.map((advice, index) => <div key={index} className="post-review-line">{advice}</div>)}
          </div>
        </div>

        <div className="post-match-column">
          <div className="PixelPanel post-mini-panel post-decision-panel">
            <div className="post-panel-title">关键决策复盘</div>
            {insights.decisionItems.length > 0
              ? insights.decisionItems.map((item, index) => <div key={index} className="post-review-line">{item}</div>)
              : <div className="post-review-empty">本场没有触发临场决策。</div>}
          </div>

          <div className="PixelPanel post-mini-panel">
            <div className="post-panel-title">
              状态变化
              {injuredCount > 0 && <span className="post-alert-text">{injuredCount}人受伤</span>}
            </div>
            {statusChanges.map((player) => (
              <div key={player.id} className="post-status-row">
                <span className="post-status-name">
                  {player.name}
                  {player.isInjured && <span className="post-alert-text">伤</span>}
                </span>
                <span className={getStatusColorHex(player.oldStatus)}>{player.oldStatus}</span>
                <span className="status-arrow">→</span>
                <span className={getStatusColorHex(player.newStatus)}>{player.newStatus}</span>
                <span className={player.change >= 0 ? 'status-high' : 'status-low'}>
                  ({player.change >= 0 ? '+' : ''}{player.change})
                </span>
              </div>
            ))}
          </div>

          {(uniqueMatchInjuries.length > 0 || uniqueMatchRedCards.length > 0) && (
            <div className="PixelPanel post-mini-panel post-warning-panel">
              <div className="post-panel-title">比赛伤停或红牌罚下</div>
              {uniqueMatchRedCards.map((t, i) => <div key={`rc-${i}`}>🟥 {t}</div>)}
              {uniqueMatchInjuries.map((t, i) => <div key={`inj-${i}`}>🤕 {t}</div>)}
            </div>
          )}

          {injuredCount > 0 && (
            <div className="PixelPanel post-mini-panel post-warning-panel">
              以下球员无法参加下一场：
              <div className="post-warning-names">{statusChanges.filter(p => p.isInjured).map(p => p.name).join('、')}</div>
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 - 固定在底部 */}
      <div className="post-actions">
        {isKnockoutDone ? (
          <button className="PixelButton compact-button post-action-button" onClick={handleViewEnding}>
            <span className="button-face" aria-hidden="true"></span>
            <span className="button-label">查看最终结局</span>
          </button>
        ) : (
          <button className="PixelButton compact-button post-action-button" onClick={handleNextMatch}>
            <span className="button-face" aria-hidden="true"></span>
            <span className="button-label">下一场比赛</span>
          </button>
        )}
      </div>
    </div>
  )
}
