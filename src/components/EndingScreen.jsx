import React from 'react'
import { getTeamById } from '../data/teams'

/**
 * 结局页面
 * 根据最终成绩展示不同结局
 */
export default function EndingScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const team = getTeamById(saveData.currentRun?.teamId)
  const matchIndex = saveData.currentRun?.matchIndex || 0
  const matchResults = saveData.currentRun?.matchResults || []
  const knockoutResults = saveData.currentRun?.knockoutResults || []

  // 统计小组赛数据
  const winCount = matchResults.filter(r => r === 'win').length
  const drawCount = matchResults.filter(r => r === 'draw').length
  const lossCount = matchResults.filter(r => r === 'loss').length
  const groupPoints = winCount * 3 + drawCount

  // 根据比赛场次判断最终成绩
  const getFinalResult = () => {
    const lastResult = saveData.currentRun?.lastMatchResult?.result
    const knockoutRound = saveData.currentRun?.knockoutRound
    if (knockoutRound === 'final') return lastResult === 'win' ? 'champion' : 'finalist'
    if (knockoutRound === 'sf') return 'semifinal'
    if (knockoutRound === 'qf') return 'quarterfinal'
    if (knockoutRound === 'r16') return 'round16'
    if ((saveData.currentRun?.matchResults || []).length >= 3) return 'group'
    if (matchIndex >= 7) return 'champion'
    if (matchIndex >= 6) return 'finalist'
    if (matchIndex >= 5) return 'semifinal'
    if (matchIndex >= 4) return 'quarterfinal'
    if (matchIndex >= 3) return 'round16'
    return 'group'
  }

  const finalResult = getFinalResult()

  const endings = {
    champion: {
      emoji: '🏆',
      title: '冠军！',
      message: '冠军庆典像素动画 + 完整数据回顾 + 你的征程故事',
      showCelebration: true,
      special: team?.id === 'newzealand'
        ? '大洋洲的骄傲，比任何奖杯都重要。'
        : team?.id === 'curacao'
        ? '他们没有夺冠，但整个世界都听说了库拉索。'
        : null,
    },
    finalist: {
      emoji: '🥈',
      title: '亚军',
      message: '一步之遥。但历史不会忘记你们走到了这里。',
    },
    semifinal: {
      emoji: '🥉',
      title: '四强',
      message: '世界看见了你们。这已经足够。',
    },
    quarterfinal: {
      emoji: '💪',
      title: '8强',
      message: '止步于此，但每一场都是故事。',
    },
    round16: {
      emoji: '🌟',
      title: '16强',
      message: '止步于此，但每一场都是故事。',
    },
    group: {
      emoji: '😢',
      title: '小组未出线',
      message: '世界杯的舞台太残酷，但你来过了。',
    },
  }

  const ending = endings[finalResult]

  const handleNewGame = () => {
    // 如果夺冠，解锁新球队
    if (finalResult === 'champion') {
      const allTeamIds = ['france', 'brazil', 'argentina', 'portugal', 'germany', 'japan', 'norway', 'morocco', 'newzealand', 'curacao']
      const nextUnlock = allTeamIds.find((id) => !saveData.unlockTeams.includes(id))

      if (nextUnlock) {
        updateSaveData({
          ...saveData,
          unlockTeams: [...saveData.unlockTeams, nextUnlock],
          championshipHistory: [
            ...saveData.championshipHistory,
            { team: team?.id, year: 2026 },
          ],
          currentRun: null,
        })
        showToast(`解锁新球队：${nextUnlock}`)
      }
    } else {
      updateSaveData({
        ...saveData,
        currentRun: null,
      })
    }

    navigateTo('home')
  }

  return (
    <div className="screen ending-screen">
      <div className="ending-content">
        {ending.showCelebration && (
          <img src="/assets/庆祝.gif" alt="庆祝" className="celebration-gif" />
        )}
        <div className="ending-emoji">{ending.emoji}</div>
        <h1 className="ending-title">{ending.title}</h1>
        <p className="ending-team">{team?.name}</p>
        <p className="ending-message">{ending.message}</p>

        {ending.special && (
          <div className="ending-special">
            <p className="special-text">"{ending.special}"</p>
          </div>
        )}

        <div className="ending-stats">
          <h3>征程回顾</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">比赛场次</span>
              <span className="stat-value">{matchResults.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">最终成绩</span>
              <span className="stat-value">{ending.title}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">小组赛</span>
              <span className="stat-value">{winCount}胜{drawCount}平{lossCount}负</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">积分</span>
              <span className="stat-value">{groupPoints}分</span>
            </div>
          </div>

          {/* 晋级之路 */}
          {matchResults.length > 0 && (
            <div className="ending-journey">
              <h4>晋级之路</h4>
              <div className="journey-matches">
                {matchResults.map((result, i) => (
                  <span key={i} className={`journey-result ${result}`}>
                    {result === 'win' ? 'W' : result === 'draw' ? 'D' : 'L'}
                  </span>
                ))}
                {knockoutResults.map((r, i) => (
                  <span key={`ko-${i}`} className={`journey-result ${r}`}>
                    {r === 'win' ? 'W' : 'L'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="ending-actions">
          <button className="PixelButton" onClick={handleNewGame}>
            <span className="button-face" aria-hidden="true"></span>
            <span className="button-label">重新挑战</span>
          </button>
          <button className="PixelButton secondary-button" onClick={() => navigateTo('home')}>
            <span className="button-face" aria-hidden="true"></span>
            <span className="button-label">返回首页</span>
          </button>
        </div>
      </div>
    </div>
  )
}
