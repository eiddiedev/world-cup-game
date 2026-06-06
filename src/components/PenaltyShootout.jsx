import React, { useState } from 'react'
import { audioManager } from '../utils/audioManager'

/**
 * 点球大战组件
 * 淘汰赛平局时触发
 */
export default function PenaltyShootout({ homeTeam, awayTeam, onComplete }) {
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [currentRound, setCurrentRound] = useState(0)
  const [isHomeTurn, setIsHomeTurn] = useState(true)
  const [shots, setShots] = useState([])
  const [isFinished, setIsFinished] = useState(false)
  const [showResult, setShowResult] = useState(false)

  const maxRounds = 5

  const handleShoot = (direction) => {
    if (isFinished) return

    // 简化的点球逻辑：50%命中率
    const scored = Math.random() > 0.5

    const newShots = [...shots, {
      round: currentRound + 1,
      team: isHomeTurn ? 'home' : 'away',
      direction,
      scored,
    }]
    setShots(newShots)

    if (scored) {
      if (isHomeTurn) {
        setHomeScore(prev => prev + 1)
        audioManager.playGoal()
        audioManager.vibrate([20, 36, 20])
      } else {
        setAwayScore(prev => prev + 1)
        audioManager.playSound('opponentGoal')
        audioManager.vibrate(32)
      }
    } else {
      audioManager.playSound('whistle')
    }

    // 判断是否结束
    const homeShots = newShots.filter(s => s.team === 'home').length
    const awayShots = newShots.filter(s => s.team === 'away').length

    // 计算当前比分
    const currentHomeScore = newShots.filter(s => s.team === 'home' && s.scored).length
    const currentAwayScore = newShots.filter(s => s.team === 'away' && s.scored).length

    // 检查是否可以提前结束（一方已经无法追平）
    const homeRemaining = maxRounds - homeShots
    const awayRemaining = maxRounds - awayShots

    if (homeShots >= maxRounds && awayShots >= maxRounds) {
      // 5轮结束
      if (currentHomeScore !== currentAwayScore) {
        setIsFinished(true)
        setTimeout(() => {
          setShowResult(true)
          onComplete(currentHomeScore > currentAwayScore ? 'home' : 'away')
        }, 1000)
      } else {
        // 平局，进入突然死亡
        setCurrentRound(prev => prev + 1)
      }
    } else if (currentHomeScore > currentAwayScore + awayRemaining) {
      // 主队领先且客队无法追平
      setIsFinished(true)
      setTimeout(() => {
        setShowResult(true)
        onComplete('home')
      }, 1000)
    } else if (currentAwayScore > currentHomeScore + homeRemaining) {
      // 客队领先且主队无法追平
      setIsFinished(true)
      setTimeout(() => {
        setShowResult(true)
        onComplete('away')
      }, 1000)
    } else {
      // 切换到另一队
      if (isHomeTurn) {
        setIsHomeTurn(false)
      } else {
        setIsHomeTurn(true)
        setCurrentRound(prev => prev + 1)
      }
    }
  }

  const getShotResult = (round, team) => {
    const shot = shots.find(s => s.round === round && s.team === team)
    if (!shot) return null
    return shot.scored
  }

  return (
    <div className="screen penalty-screen">
      <div className="penalty-header">
        <h2>点球大战</h2>
        <div className="penalty-score">
          <div className="penalty-team">
            <span className="team-name">{homeTeam}</span>
            <span className="team-score">{homeScore}</span>
          </div>
          <span className="penalty-vs">VS</span>
          <div className="penalty-team">
            <span className="team-score">{awayScore}</span>
            <span className="team-name">{awayTeam}</span>
          </div>
        </div>
      </div>

      <div className="penalty-rounds">
        {Array.from({ length: Math.max(maxRounds, currentRound + 1) }, (_, i) => i + 1).map(round => (
          <div key={round} className={`penalty-round ${round <= currentRound ? 'completed' : ''}`}>
            <span className="round-number">第{round}轮</span>
            <div className="round-shots">
              <span className={`shot-result ${getShotResult(round, 'home') === true ? 'goal' : getShotResult(round, 'home') === false ? 'miss' : ''}`}>
                {getShotResult(round, 'home') === true ? '⚽' : getShotResult(round, 'home') === false ? '❌' : '·'}
              </span>
              <span className={`shot-result ${getShotResult(round, 'away') === true ? 'goal' : getShotResult(round, 'away') === false ? 'miss' : ''}`}>
                {getShotResult(round, 'away') === true ? '⚽' : getShotResult(round, 'away') === false ? '❌' : '·'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!isFinished && (
        <div className="penalty-controls">
          <p className="penalty-turn">
            {isHomeTurn ? homeTeam : awayTeam}的点球
          </p>
          <div className="penalty-directions">
            <button className="btn-gold" onClick={() => handleShoot('left')}>
              ⬅️ 左侧
            </button>
            <button className="btn-gold" onClick={() => handleShoot('center')}>
              ⬆️ 中路
            </button>
            <button className="btn-gold" onClick={() => handleShoot('right')}>
              ➡️ 右侧
            </button>
          </div>
        </div>
      )}

      {showResult && (
        <div className="penalty-result">
          <div className="result-emoji">{homeScore > awayScore ? '🎉' : '😢'}</div>
          <h2 className="result-text">
            {homeScore > awayScore ? `${homeTeam}获胜！` : `${awayTeam}获胜！`}
          </h2>
          <p>点球比分: {homeScore} - {awayScore}</p>
        </div>
      )}
    </div>
  )
}
