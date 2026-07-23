import React, { useCallback, useMemo, useState } from 'react'
import { HappySeedMatchBroadcast } from './HappySeedMatchBroadcast.jsx'
import PenaltyShootout from './PenaltyShootout.jsx'
import {
  buildFormalMatchRuleReport,
  settleRunMatchRules,
} from '../utils/formalMatchRules.js'
import { getLogisticsModifiers } from '../utils/logisticsEffects.js'
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

  const persistMatchComplete = useCallback(({ report, actorSnapshot }, shootoutWinner = null, shootoutResult = null) => {
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
    const settledRun = settleRunMatchRules(currentRun, ruleReport)
    const matchResults = currentRun.matchResults || []
    const isKnockout = Boolean(currentRun.isKnockoutMatch)
    const matchInjuries = ruleReport.injuredPlayerIds
      .map((playerId) => `${ruleReport.playerStates[playerId]?.name || playerId}伤停`)
    const matchRedCards = ruleReport.redCardedPlayerIds
      .map((playerId) => `${ruleReport.playerStates[playerId]?.name || playerId}被红牌罚下`)

    const nextSaveData = {
      ...saveData,
      currentRun: {
        ...settledRun,
        matchInjuries,
        matchRedCards,
        lastMatchResult: authoritativeReport,
        matchResults: isKnockout ? matchResults : [...matchResults, authoritativeReport.result],
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
