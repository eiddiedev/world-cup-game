import React, { useEffect, useRef } from 'react'
import { getTeamById } from '../data/teams'
import { resultRank, checkAchievements } from '../data/codexAchievements'
import { createInitialCodex } from '../utils/saveManager'
import { calculatePrizeMoney, settleLogisticsBudget } from '../data/prizeMoney'

/**
 * 结局页面
 * 根据最终成绩展示不同结局
 */
export default function EndingScreen({ saveData, updateSaveData, navigateTo }) {
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
    if (knockoutRound === 'r32') return 'round32'
    if ((saveData.currentRun?.matchResults || []).length >= 3) return 'group'
    if (matchIndex >= 8) return 'champion'
    if (matchIndex >= 7) return 'finalist'
    if (matchIndex >= 6) return 'semifinal'
    if (matchIndex >= 5) return 'quarterfinal'
    if (matchIndex >= 4) return 'round16'
    if (matchIndex >= 3) return 'round32'
    return 'group'
  }

  const finalResult = getFinalResult()

  const resultRanks = {
    group: 0,
    round32: 1,
    round16: 2,
    quarterfinal: 3,
    semifinal: 4,
    finalist: 5,
    champion: 6,
  }
  const targetRanks = {
    '争取首胜': winCount > 0 ? 0 : 1,
    '小组出线': 1,
    '16强': 2,
    '八强': 3,
    '四强': 4,
    '夺冠': 6,
  }
  const targetMet = team?.worldCupTarget === '争取首胜'
    ? winCount > 0
    : (resultRanks[finalResult] || 0) >= (targetRanks[team?.worldCupTarget] ?? 0)
  const teamEpilogue = team
    ? `「${team.mission}」${targetMet ? '——足协目标已经达成。' : `——本届未能完成“${team.worldCupTarget}”目标。`} ${team.faMessage}`
    : null

  const endings = {
    champion: {
      emoji: '🏆',
      title: '冠军！',
      message: '你带领球队站上了世界之巅。',
      showCelebration: false,
      special: teamEpilogue,
    },
    finalist: {
      emoji: '🥈',
      title: '亚军',
      message: '一步之遥。但历史不会忘记你们走到了这里。',
      special: teamEpilogue,
    },
    semifinal: {
      emoji: '🥉',
      title: '四强',
      message: '世界看见了你们。这已经足够。',
      special: teamEpilogue,
    },
    quarterfinal: {
      emoji: '💪',
      title: '8强',
      message: '止步于此，但每一场都是故事。',
      special: teamEpilogue,
    },
    round16: {
      emoji: '🌟',
      title: '16强',
      message: '止步于此，但每一场都是故事。',
      special: teamEpilogue,
    },
    round32: {
      emoji: '🌟',
      title: '32强',
      message: '世界杯的舞台太残酷，但你来过了。',
      special: teamEpilogue,
    },
    group: {
      emoji: '😢',
      title: '小组未出线',
      message: '世界杯的舞台太残酷，但你来过了。',
      special: teamEpilogue,
    },
  }

  const ending = endings[finalResult]

  // 计算本次征程奖金
  const prizeMoney = calculatePrizeMoney(finalResult, matchResults)
  const remainingLogisticsBudget = saveData.currentRun?.logisticsBudget || 0

  // 组件挂载时自动结算 codex（确保无论点哪个按钮都能记录）
  const settledRef = useRef(false)
  useEffect(() => {
    if (settledRef.current) return
    settledRef.current = true

    const currentTeamId = team?.id
    const totalMatches = matchResults.length + knockoutResults.length
    const totalWins = winCount + knockoutResults.filter(r => r === 'win').length
    const isChampion = finalResult === 'champion'

    // 结算后勤预算
    if (currentTeamId) {
      settleLogisticsBudget(currentTeamId, remainingLogisticsBudget, prizeMoney, saveData)
    }

    // 构建更新后的 codex
    const prevCodex = saveData.codex || createInitialCodex()
    const codex = {
      ...prevCodex,
      records: { ...prevCodex.records },
      teamResults: { ...prevCodex.teamResults },
      runHistory: [...(prevCodex.runHistory || [])],
      unlockedAchievements: [...(prevCodex.unlockedAchievements || [])],
    }

    // 记录本次征程
    codex.runHistory.push({
      teamId: currentTeamId,
      result: finalResult,
      date: new Date().toISOString(),
    })

    // 一次性成就检测
    const unlockedSet = new Set(codex.unlockedAchievements)
    if (matchResults.length === 3 && matchResults.every(r => r === 'win') && !unlockedSet.has('clean_sweep')) {
      codex.unlockedAchievements.push('clean_sweep')
      unlockedSet.add('clean_sweep')
    }
    if (isChampion && matchResults.every(r => r === 'win') && knockoutResults.every(r => r === 'win') && !unlockedSet.has('perfectionist')) {
      codex.unlockedAchievements.push('perfectionist')
      unlockedSet.add('perfectionist')
    }
    if (isChampion && (saveData.currentRun?.injuredPlayers || []).length === 0 && !unlockedSet.has('medical_miracle')) {
      codex.unlockedAchievements.push('medical_miracle')
      unlockedSet.add('medical_miracle')
    }
    if (isChampion && (team?.difficulty || 0) >= 4 && !unlockedSet.has('underdog_story')) {
      codex.unlockedAchievements.push('underdog_story')
      unlockedSet.add('underdog_story')
    }

    // 战术大师：记录夺冠时使用的阵型，累计3种不同阵型夺冠则解锁
    if (isChampion) {
      const formation = saveData.currentRun?.formation
      if (formation) {
        const championFormations = new Set(codex.championFormations || [])
        championFormations.add(formation)
        codex.championFormations = [...championFormations]
        if (championFormations.size >= 3 && !unlockedSet.has('tactician')) {
          codex.unlockedAchievements.push('tactician')
          unlockedSet.add('tactician')
        }
      }
    }

    // 更新球队最好成绩
    const prevResult = codex.teamResults[currentTeamId]
    if (!prevResult || resultRank(finalResult) > resultRank(prevResult)) {
      codex.teamResults[currentTeamId] = finalResult
    }

    // 更新累计记录
    codex.records.totalMatches += totalMatches
    codex.records.totalWins += totalWins

    // 连胜逻辑：计算本次征程末尾的连胜场次
    const allResults = [...matchResults, ...knockoutResults]
    let runEndStreak = 0
    for (let i = allResults.length - 1; i >= 0; i--) {
      if (allResults[i] === 'win') runEndStreak++
      else break
    }
    // 如果本次征程以连胜结束，累加到跨征程连胜
    if (runEndStreak > 0 && allResults.length > 0 && allResults[allResults.length - 1] === 'win') {
      codex.records.winStreak = (codex.records.winStreak || 0) + runEndStreak
    } else if (allResults.length > 0 && allResults[allResults.length - 1] !== 'win') {
      codex.records.winStreak = 0
    }
    if (codex.records.winStreak > (codex.records.bestWinStreak || 0)) {
      codex.records.bestWinStreak = codex.records.winStreak
    }

    // 如果夺冠，记录冠军历史 + 解锁新球队
    const newData = { ...saveData, codex }
    if (isChampion) {
      const allTeamIds = ['spain', 'argentina', 'france', 'england', 'brazil', 'portugal', 'germany', 'japan', 'morocco', 'norway', 'colombia', 'usa', 'canada', 'mexico', 'capeverde', 'curacao']
      const nextUnlock = allTeamIds.find((id) => !saveData.unlockTeams.includes(id) && id !== currentTeamId)
      newData.championshipHistory = [...(saveData.championshipHistory || []), currentTeamId]
      if (nextUnlock) {
        newData.unlockTeams = [...saveData.unlockTeams, nextUnlock]
      }
    }

    // 检查成就
    const newAchievements = checkAchievements(newData)
    if (newAchievements.length > 0) {
      newData.codex.unlockedAchievements = [...newData.codex.unlockedAchievements, ...newAchievements]
    }

    updateSaveData(newData)
  }, [])

  const handleNewGame = () => {
    updateSaveData({ ...saveData, currentRun: null })
    navigateTo('home')
  }

  return (
    <div className="screen ending-screen">
      <div className="ending-content">
        {ending.showCelebration && (
          <img src="/assets/庆祝.gif" alt="庆祝" className="celebration-gif" />
        )}
        <div className="ending-emoji">
          {finalResult === 'champion'
            ? <img src="/assets/branding/trophy.png" alt="大力神杯" style={{ width: 72, height: 'auto', imageRendering: 'pixelated' }} />
            : ending.emoji}
        </div>
        <h1 className="ending-title" data-guide="ending-result">{ending.title}</h1>
        <p className="ending-team">{team?.name}</p>
        <p className="ending-message">{ending.message}</p>

        {ending.special && (
          <div className="ending-special">
            <p className="special-text">"{ending.special}"</p>
          </div>
        )}

        <div className="ending-stats" data-guide="ending-review">
          <h3>征程回顾</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">比赛场次</span>
              <span className="stat-value">{matchResults.length + knockoutResults.length}</span>
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

          {/* 奖金结算 */}
          <div className="ending-prize">
            <h4><img src="/assets/金币.png" alt="" style={{ width: 18, height: 18, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 6 }} />奖金结算</h4>
            <div className="prize-detail">
              <span>赛事奖金：+{prizeMoney}</span>
              <span>剩余后勤预算：{remainingLogisticsBudget}</span>
              <span className="prize-total">下届可用：{remainingLogisticsBudget + prizeMoney}</span>
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

        <div className="ending-actions" data-guide="ending-actions">
          <button className="PixelButton" onClick={handleNewGame}>
            <span className="button-face" aria-hidden="true"></span>
            <span className="button-label">重新挑战</span>
          </button>
          <button className="PixelButton secondary-button" onClick={() => { updateSaveData({ ...saveData, currentRun: null }); navigateTo('home') }}>
            <span className="button-face" aria-hidden="true"></span>
            <span className="button-label">返回首页</span>
          </button>
        </div>
      </div>
    </div>
  )
}
