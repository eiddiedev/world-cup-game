import React, { useCallback, useMemo, useState } from 'react'
import { HappySeedMatchBroadcast } from './HappySeedMatchBroadcast.jsx'
import PenaltyShootout from './PenaltyShootout.jsx'
import {
  buildFormalMatchRuleReport,
  settleRunMatchRules,
} from '../utils/formalMatchRules.js'
import { getLogisticsModifiers } from '../utils/logisticsEffects.js'
import { createInitialCodex } from '../utils/saveManager.js'
import { audioManager } from '../utils/audioManager.js'
import '../styles/happySeedBroadcastV2.css'

/**
 * 正式比赛入口。
 *
 * MatchScreen 不再维护另一套分钟、比分、随机播报和决策循环；这些状态全部由
 * FormalMatchSession 持有。这里仅负责把终场报告写回世界杯存档并进入赛后页。
 */
export default function MatchScreen({
  saveData,
  updateSaveData,
  navigateTo,
}) {
  const [pendingShootout, setPendingShootout] = useState(null)

  const persistMatchComplete = useCallback(({ report, actorSnapshot, session: completedSession }, shootoutWinner = null, shootoutResult = null) => {
    const currentRun = saveData.currentRun
    if (!currentRun || currentRun.lastMatchResult?.matchId === report.matchId) return

    const resolvedReport = shootoutWinner
      ? {
        ...report,
        result: shootoutWinner === 'home' ? 'win' : 'loss',
        shootout: {
          winner: shootoutWinner,
          regulationScore: [report.homeScore, report.awayScore],
          score: [Number(shootoutResult?.homeScore || 0), Number(shootoutResult?.awayScore || 0)],
          shots: shootoutResult?.shots || [],
        },
      }
      : report

    const ruleReport = buildFormalMatchRuleReport(actorSnapshot, {
      matchId: resolvedReport.matchId,
      matchIndex: currentRun.matchIndex,
      completedAt: resolvedReport.completedAt,
      previousPlayerStates: currentRun.playerMatchStates,
      previousPlayerStatuses: currentRun.playerStatuses,
    })
    const authoritativeReport = { ...resolvedReport, matchRuleReport: ruleReport }
    const settledRun = settleRunMatchRules(currentRun, ruleReport, {
      logisticsLevels: currentRun.logisticsLevels,
    })
    const matchResults = currentRun.matchResults || []
    const knockoutResults = currentRun.knockoutResults || []
    const isKnockout = Boolean(currentRun.isKnockoutMatch)
    const matchInjuries = ruleReport.injuredPlayerIds
      .map((playerId) => `${ruleReport.playerStates[playerId]?.name || playerId}伤停`)
    const matchRedCards = ruleReport.redCardedPlayerIds
      .map((playerId) => `${ruleReport.playerStates[playerId]?.name || playerId}被红牌罚下`)

    // 成就追踪：更新 codex.records
    const codex = saveData.codex || createInitialCodex()
    const records = { ...codex.records }
    const unlockedAchievements = [...(codex.unlockedAchievements || [])]
    const unlockedSet = new Set(unlockedAchievements)
    const homeScore = resolvedReport.homeScore || 0
    const awayScore = resolvedReport.awayScore || 0
    records.totalGoals = (records.totalGoals || 0) + homeScore
    records.mostGoalsInMatch = Math.max(records.mostGoalsInMatch || 0, homeScore)
    if (awayScore === 0) {
      records.cleanSheetStreak = (records.cleanSheetStreak || 0) + 1
      records.bestCleanSheetStreak = Math.max(records.bestCleanSheetStreak || 0, records.cleanSheetStreak)
    } else {
      records.cleanSheetStreak = 0
    }

    // 从 session commentary 提取进球分钟，追踪最快进球 & 帽子戏法 & 成就
    const session = completedSession
    const goalLines = (session?.commentary || []).filter((line) => line.type === 'runtime-goal')
    // 只取本方进球（比分变化中 red 增加的行）
    const homeGoalMinutes = []
    let prevRed = 0
    for (const line of goalLines) {
      const scoreMatch = line.text.match(/比分更新为\s*(\d+):(\d+)/)
      if (scoreMatch) {
        const curRed = Number(scoreMatch[1])
        if (curRed > prevRed) {
          homeGoalMinutes.push(Number(line.minute))
        }
        prevRed = curRed
      }
    }
    // 最快进球
    if (homeGoalMinutes.length > 0) {
      const fastest = Math.min(...homeGoalMinutes)
      if (records.fastestGoalMinute == null || fastest < records.fastestGoalMinute) {
        records.fastestGoalMinute = fastest
      }
      // 闪电战：开场5分钟内进球
      if (fastest <= 5 && !unlockedSet.has('lightning_strike')) {
        unlockedAchievements.push('lightning_strike')
        unlockedSet.add('lightning_strike')
      }
      // 补时绝杀：90分钟后进球且本方获胜
      const lateGoal = homeGoalMinutes.some((m) => m >= 90)
      if (lateGoal && resolvedReport.result === 'win' && !unlockedSet.has('last_gas')) {
        unlockedAchievements.push('last_gas')
        unlockedSet.add('last_gas')
      }
    }
    // 奇迹逆转：追踪比分变化，检测是否曾落后3球且最终获胜
    if (resolvedReport.result === 'win' && !unlockedSet.has('miracle_comeback')) {
      let maxDeficit = 0
      for (const line of goalLines) {
        const scoreMatch = line.text.match(/比分更新为\s*(\d+):(\d+)/)
        if (scoreMatch) {
          const deficit = Number(scoreMatch[2]) - Number(scoreMatch[1])
          if (deficit > maxDeficit) maxDeficit = deficit
        }
      }
      if (maxDeficit >= 3) {
        unlockedAchievements.push('miracle_comeback')
        unlockedSet.add('miracle_comeback')
      }
    }
    // 帽子戏法：解析本方进球球员名
    const homeGoalScorers = []
    prevRed = 0
    for (const line of goalLines) {
      const scoreMatch = line.text.match(/比分更新为\s*(\d+):(\d+)/)
      if (scoreMatch) {
        const curRed = Number(scoreMatch[1])
        if (curRed > prevRed) {
          // 提取球员名：格式为 "X号NAME完成破门" 或 decision resultText
          const nameMatch = line.text.match(/\d+号(.+?)完成破门/)
          if (nameMatch) homeGoalScorers.push(nameMatch[1])
          else homeGoalScorers.push('__unknown__')
        }
        prevRed = curRed
      }
    }
    const scorerCounts = {}
    for (const name of homeGoalScorers) {
      scorerCounts[name] = (scorerCounts[name] || 0) + 1
    }
    const hatTrickCount = Object.values(scorerCounts).filter((c) => c >= 3).length
    if (hatTrickCount > 0) {
      records.hatTricks = (records.hatTricks || 0) + hatTrickCount
    }

    // 替补进球追踪：检查换人上场的球员是否进球
    const subHistory = ruleReport.substitutionHistory?.red || []
    if (subHistory.length > 0 && homeGoalScorers.length > 0) {
      const subPlayerIds = new Set(subHistory.map((s) => s.inPlayerId))
      const actorMap = Object.fromEntries(
        (actorSnapshot?.actors || []).map((a) => [a.playerId, a.name])
      )
      const subNames = new Set(
        [...subPlayerIds].map((id) => actorMap[id]).filter(Boolean)
      )
      const subGoalsThisMatch = homeGoalScorers.filter((name) => subNames.has(name)).length
      if (subGoalsThisMatch > 0) {
        records.substituteGoals = (records.substituteGoals || 0) + subGoalsThisMatch
      }
    }

    // 点球大战记录追踪
    if (shootoutResult?.shots) {
      const shots = shootoutResult.shots
      const rounds = Math.ceil(shots.length / 2)
      records.maxPenaltyRounds = Math.max(records.maxPenaltyRounds || 0, rounds)
      // 本方扑出点球数（对方射门未进且 saved=true）
      const homeSaves = shots.filter((s) => s.team === 'away' && s.saved).length
      records.penaltiesSaved = (records.penaltiesSaved || 0) + homeSaves
      // 叹息之墙：单场扑出3粒点球
      if (homeSaves >= 3 && !unlockedSet.has('wall_of_sighs')) {
        unlockedAchievements.push('wall_of_sighs')
        unlockedSet.add('wall_of_sighs')
      }
      // 点球大师：本方5罚全中
      const homeShots = shots.filter((s) => s.team === 'home')
      const homeScored = homeShots.filter((s) => s.scored).length
      if (homeShots.length >= 5 && homeScored === homeShots.length && !unlockedSet.has('penalty_master')) {
        unlockedAchievements.push('penalty_master')
        unlockedSet.add('penalty_master')
      }
    }

    const nextSaveData = {
      ...saveData,
      codex: { ...codex, records, unlockedAchievements },
      currentRun: {
        ...settledRun,
        matchInjuries,
        matchRedCards,
        lastMatchResult: authoritativeReport,
        matchResults: isKnockout ? matchResults : [...matchResults, authoritativeReport.result],
        knockoutResults: isKnockout ? [...knockoutResults, authoritativeReport.result] : knockoutResults,
        stage: 'post-match',
      },
    }
    updateSaveData(nextSaveData)
    audioManager.playSound('whistle')
    if (authoritativeReport.result === 'win') audioManager.playWin()
    else if (authoritativeReport.result === 'loss') audioManager.playLose()
    navigateTo('post-match')
  }, [navigateTo, saveData, updateSaveData])

  const handleMatchComplete = useCallback((completion) => {
    if (
      completion.forceShootout
      || (saveData.currentRun?.isKnockoutMatch && completion.report.result === 'draw')
    ) {
      setPendingShootout(completion)
      return
    }
    persistMatchComplete(completion)
  }, [persistMatchComplete, saveData.currentRun?.isKnockoutMatch])

  const shootoutLineups = useMemo(() => {
    const actors = pendingShootout?.actorSnapshot?.actors || []
    const mapActor = (actor) => ({
      id: actor.playerId,
      name: actor.name,
      number: actor.number,
      pos: actor.assignedPosition || actor.naturalPosition,
      position: actor.assignedPosition || actor.naturalPosition,
      ...(actor.operationAttributes || {}),
    })
    return {
      home: actors.filter((actor) => actor.side === 'red' && actor.state?.onPitch).map(mapActor),
      away: actors.filter((actor) => actor.side === 'blue' && actor.state?.onPitch).map(mapActor),
    }
  }, [pendingShootout])

  return (
    <>
      <HappySeedMatchBroadcast
        saveData={saveData}
        onMatchComplete={handleMatchComplete}
        shootoutActive={Boolean(pendingShootout)}
      />
      {pendingShootout && (
        <PenaltyShootout
          homeTeam={pendingShootout.report.teamName || '本方'}
          awayTeam={pendingShootout.report.opponent || '对方'}
          homeTeamId={saveData.currentRun?.teamId}
          awayTeamId={pendingShootout.actorSnapshot?.sides?.blue?.teamId}
          homeLineup={shootoutLineups.home}
          awayLineup={shootoutLineups.away}
          homeFormation={saveData.currentRun?.formation || '4-3-3'}
          awayFormation={pendingShootout.actorSnapshot?.sides?.blue?.formation || '4-3-3'}
          stabilityBonus={getLogisticsModifiers(saveData.currentRun?.logisticsLevels).penaltyStabilityBonus}
          gameMode={saveData.currentRun?.gameMode || 'coach'}
          onComplete={(winner, shootoutResult) => {
            const completion = pendingShootout
            setPendingShootout(null)
            persistMatchComplete(completion, winner, shootoutResult)
          }}
        />
      )}
    </>
  )
}
