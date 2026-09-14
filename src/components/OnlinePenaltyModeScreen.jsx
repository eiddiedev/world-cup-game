import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getTeamById } from '../data/teams.js'
import { ONLINE_MESSAGE } from '../online/onlineProtocol.js'
import { onlineRoomClient } from '../services/onlineRoomClient.js'
import PenaltyShootout from './PenaltyShootout.jsx'

function fallbackShootoutLineup(team) {
  const players = team?.players || []
  const goalkeeper = [...players]
    .filter((player) => player.position === 'GK')
    .sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0))[0]
  const outfield = [...players]
    .filter((player) => player.position !== 'GK')
    .sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0))
    .slice(0, 10)
  return [goalkeeper, ...outfield].filter(Boolean)
}

function roomShootoutLineup(seat) {
  const team = getTeamById(seat?.teamId)
  const byId = new Map((team?.players || []).map((player) => [player.id, player]))
  const selected = (seat?.lineupPlayerIds || []).map((playerId) => byId.get(playerId)).filter(Boolean)
  return selected.length >= 11 ? selected : fallbackShootoutLineup(team)
}

export default function OnlinePenaltyModeScreen({
  saveData,
  updateSaveData,
  navigateTo,
  showToast,
}) {
  const [network, setNetwork] = useState(() => onlineRoomClient.getSnapshot())
  const [resolvedAttempt, setResolvedAttempt] = useState(null)
  const completedMatchRef = useRef(null)
  const room = network.room
  const ownSeat = network.ownSeat
  const homeTeam = getTeamById(room?.host?.teamId)
  const awayTeam = getTeamById(room?.guest?.teamId)
  const penalty = room?.match?.penalty

  useEffect(() => onlineRoomClient.subscribe((snapshot, event) => {
    setNetwork(snapshot)
    if (event?.type === ONLINE_MESSAGE.PENALTY_STATE && event.resolvedAttempt) {
      setResolvedAttempt(event.resolvedAttempt)
    }
    if (event?.type === ONLINE_MESSAGE.MATCH_PAUSED) {
      showToast('对方掉线，点球大战已暂停并等待 20 秒重连')
    }
    if (event?.type === ONLINE_MESSAGE.MATCH_ABORTED) {
      showToast('重连超时，本场点球大战已作废')
      navigateTo('online-lobby', { gameMode: 'online' })
    }
    if (event?.type === ONLINE_MESSAGE.ERROR) {
      showToast(event.message || snapshot.lastError?.message || '点球同步失败')
    }
  }), [navigateTo, showToast])

  useEffect(() => {
    if (!room || room.ruleset !== 'penalty' || !ownSeat) {
      navigateTo('online-lobby', { gameMode: 'online' })
    }
  }, [navigateTo, ownSeat, room])

  const homeLineup = useMemo(() => roomShootoutLineup(room?.host), [room?.host])
  const awayLineup = useMemo(() => roomShootoutLineup(room?.guest), [room?.guest])
  const onlineSession = useMemo(() => ({
    seatId: ownSeat?.seatId,
    status: room?.status,
    attemptIndex: penalty?.attemptIndex || 0,
    shots: penalty?.shots || [],
    winner: penalty?.winner || null,
    submitted: penalty?.submitted || {},
    resolvedAttempt,
    onSubmit: (choice) => onlineRoomClient.submitPenaltyChoice(choice),
  }), [ownSeat?.seatId, penalty, resolvedAttempt, room?.status])

  if (!room || !ownSeat || !homeTeam || !awayTeam || !penalty) {
    return <main className="screen"><div className="loading-screen">正在同步点球房间…</div></main>
  }

  const handleComplete = (winner, result) => {
    if (completedMatchRef.current === room.match?.id) return
    completedMatchRef.current = room.match?.id
    const ownTeam = ownSeat.seatId === 'host' ? 'home' : 'away'
    const didWin = winner === ownTeam
    const currentRun = saveData.currentRun
    const nextRun = currentRun ? {
      ...currentRun,
      stage: 'online-lobby',
      lastMatchResult: {
        matchId: room.match?.id,
        online: true,
        ruleset: 'penalty',
        result: didWin ? 'win' : 'loss',
        homeScore: ownTeam === 'home' ? result.homeScore : result.awayScore,
        awayScore: ownTeam === 'home' ? result.awayScore : result.homeScore,
        shootout: result,
      },
    } : currentRun
    if (nextRun) updateSaveData({ ...saveData, currentRun: nextRun, onlineRun: nextRun })
    showToast(didWin ? '你赢得了点球大战！' : '对方赢得了点球大战')
    navigateTo('online-lobby', { gameMode: 'online' })
  }

  return (
    <>
      <PenaltyShootout
        homeTeam={homeTeam.name}
        awayTeam={awayTeam.name}
        homeTeamId={homeTeam.id}
        awayTeamId={awayTeam.id}
        homeLineup={homeLineup}
        awayLineup={awayLineup}
        homeFormation={room.host.formation || homeTeam.defaultFormation || '4-3-3'}
        awayFormation={room.guest.formation || awayTeam.defaultFormation || '4-3-3'}
        onlineSession={onlineSession}
        onComplete={handleComplete}
      />
      {room.status === 'paused' && (
        <div className="penalty-online-status" role="status">
          对方断线，比赛暂停 · 20 秒内重连后继续
        </div>
      )}
    </>
  )
}
