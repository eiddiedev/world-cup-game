import React, { useEffect, useMemo, useState } from 'react'
import { hasVariantFeature } from '../config/runtime.js'
import { teams } from '../data/teams.js'
import { buildRecommendedNationalSquad } from '../data/rosterRules.js'
import { ONLINE_MESSAGE } from '../online/onlineProtocol.js'
import { onlineRoomClient } from '../services/onlineRoomClient.js'

function completeOnlineSquad(team) {
  return buildRecommendedNationalSquad(team?.players || [], Number.POSITIVE_INFINITY, team?.defaultFormation)
    .slice(0, 23)
}

function completePenaltyLineup(roster = []) {
  const goalkeeper = [...roster]
    .filter((player) => player.position === 'GK')
    .sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0))[0]
  const outfield = [...roster]
    .filter((player) => player.position !== 'GK')
    .sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0))
    .slice(0, 10)
  return [goalkeeper, ...outfield].filter(Boolean)
}

function rulesetLabel(ruleset) {
  if (ruleset === 'iron') return '无规则乱斗 · 无犯规 / 无越位 / 100 HP'
  if (ruleset === 'penalty') return '点球大战 · 双方轮流射门与扑救'
  return '常规对战 · 正常规则与越位'
}

export default function OnlineLobbyScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const ironEnabled = hasVariantFeature('ironFootball')
  const [network, setNetwork] = useState(() => onlineRoomClient.getSnapshot())
  const [roomCode, setRoomCode] = useState('')
  const [ruleset, setRuleset] = useState('standard')
  const [editingPenaltyTeam, setEditingPenaltyTeam] = useState(false)
  const [busy, setBusy] = useState(false)
  const room = network.room
  const ownSeat = network.ownSeat
  const otherSeat = ownSeat?.seatId === 'host' ? room?.guest : room?.host
  const onlineRun = saveData.onlineRun || (saveData.currentRun?.gameMode === 'online' ? saveData.currentRun : null)

  useEffect(() => onlineRoomClient.subscribe((snapshot, event) => {
    setNetwork(snapshot)
    if (event?.type === ONLINE_MESSAGE.MATCH_PAUSED) showToast('对方掉线，比赛已暂停并等待 20 秒重连')
    if (event?.type === ONLINE_MESSAGE.MATCH_ABORTED) showToast('重连超时，本场作废，已回到原房间')
    if (event?.type === ONLINE_MESSAGE.ERROR) showToast(event.message || snapshot.lastError?.message || '联机服务异常')
  }), [showToast])

  useEffect(() => {
    onlineRoomClient.connect().catch(() => {})
  }, [])

  useEffect(() => {
    if (room?.status !== 'playing' || !ownSeat || !otherSeat?.teamId || !onlineRun) return
    const nextRun = {
      ...onlineRun,
      gameMode: 'online',
      ruleset: room.ruleset,
      currentOpponent: otherSeat.teamId,
      onlineRoom: room,
      onlineSeatId: ownSeat.seatId,
      stage: room.ruleset === 'penalty' ? 'online-penalty' : 'match',
    }
    updateSaveData({ ...saveData, currentRun: nextRun, onlineRun: nextRun })
    navigateTo(room.ruleset === 'penalty' ? 'online-penalty' : 'match', { gameMode: 'online' })
  }, [onlineRun, otherSeat, ownSeat, room, saveData, updateSaveData, navigateTo])

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === ownSeat?.teamId || team.id === onlineRun?.teamId),
    [onlineRun?.teamId, ownSeat?.teamId],
  )

  const createRoom = async () => {
    setBusy(true)
    try { await onlineRoomClient.createRoom(ruleset) }
    catch (error) { showToast(error.message) }
    finally { setBusy(false) }
  }

  const joinRoom = async () => {
    if (!/^\d{6}$/.test(roomCode)) return showToast('请输入六位房间码')
    setBusy(true)
    try { await onlineRoomClient.joinRoom(roomCode) }
    catch (error) { showToast(error.message) }
    finally { setBusy(false) }
  }

  const chooseTeam = (team) => {
    const roster = completeOnlineSquad(team)
    const penaltyLineup = room.ruleset === 'penalty' ? completePenaltyLineup(roster) : []
    const nextRun = {
      ...(onlineRun || {}),
      teamId: team.id,
      gameMode: 'online',
      ruleset: room.ruleset,
      formation: team.defaultFormation,
      roster,
      purchasedPlayerIds: roster,
      lineup: penaltyLineup,
      currentOpponent: otherSeat?.teamId || null,
      onlineRoomCode: room.code,
      onlineSeatId: ownSeat.seatId,
      stage: room.ruleset === 'penalty' ? 'online-lobby' : 'online-lineup',
    }
    onlineRoomClient.selectTeam(team.id, ownSeat.seatId === 'host' ? room.ruleset : undefined)
    updateSaveData({ ...saveData, currentRun: nextRun, onlineRun: nextRun })
    if (room.ruleset === 'penalty') {
      onlineRoomClient.lockLineup(
        roster.map((player) => player.id),
        penaltyLineup.map((player) => player.id),
        team.defaultFormation || '4-3-3',
      )
      setEditingPenaltyTeam(false)
      return
    }
    navigateTo('lineup', { gameMode: 'online' })
  }

  const setReady = () => {
    if (!ownSeat?.lineupLocked) return showToast('请先完成排兵布阵')
    onlineRoomClient.setReady(!ownSeat.ready)
  }

  if (!network.configured) {
    return (
      <main className="screen online-lobby-screen">
        <header className="screen-header"><button className="back-button" onClick={() => navigateTo('home')}>←</button><h1>创建房间联机</h1></header>
        <section className="PixelPanel online-service-error">
          <h2>联机服务地址未配置</h2>
          <p>发布环境需要设置 <code>VITE_MATCH_WS_URL</code>，本地开发默认连接 8787 端口。</p>
        </section>
      </main>
    )
  }

  if (!room) {
    return (
      <main className="screen online-lobby-screen">
        <header className="screen-header"><button className="back-button" onClick={() => navigateTo('home')}>←</button><h1>创建房间联机</h1></header>
        <section className="online-entry-grid">
          <article className="PixelPanel online-entry-card">
            <h2>创建房间</h2>
            <div className="online-ruleset-picker" aria-label="比赛规则">
              <button type="button" className={ruleset === 'standard' ? 'is-selected' : ''} onClick={() => setRuleset('standard')}>常规对战</button>
              {ironEnabled && (
                <button type="button" className={ruleset === 'iron' ? 'is-selected' : ''} onClick={() => setRuleset('iron')}>无规则乱斗</button>
              )}
              <button type="button" className={ruleset === 'penalty' ? 'is-selected' : ''} onClick={() => setRuleset('penalty')}>点球大战</button>
            </div>
            <button type="button" className="PixelButton" disabled={busy || network.connectionState === 'connecting'} onClick={createRoom}><span className="button-face" /><span className="button-label">生成六位房间码</span></button>
          </article>
          <article className="PixelPanel online-entry-card">
            <h2>加入房间</h2>
            <input aria-label="六位房间码" inputMode="numeric" maxLength={6} value={roomCode} onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
            <button type="button" className="PixelButton" disabled={busy || roomCode.length !== 6} onClick={joinRoom}><span className="button-face" /><span className="button-label">加入对战</span></button>
          </article>
        </section>
      </main>
    )
  }

  return (
    <main className="screen online-lobby-screen">
      <header className="screen-header">
        <button className="back-button" onClick={() => navigateTo('home')}>←</button>
        <div><h1>房间 {room.code}</h1><p>{rulesetLabel(room.ruleset)}</p></div>
      </header>

      <section className="online-room-seats">
        {[room.host, room.guest].map((seat, index) => (
          <article className={`PixelPanel online-seat${seat?.seatId === ownSeat?.seatId ? ' is-self' : ''}`} key={seat?.seatId || `empty-${index}`}>
            <strong>{index === 0 ? '房主 · 红方' : '客人 · 蓝方'}</strong>
            {seat ? (
              <>
                <span>{seat.teamId ? teams.find((team) => team.id === seat.teamId)?.name : '正在选择球队'}</span>
                <small>{seat.connected ? '在线' : '断线重连中'} · {seat.lineupLocked ? '阵容已锁定' : '尚未布阵'} · {seat.ready ? '已准备' : '未准备'}</small>
              </>
            ) : <span>等待输入房间码加入</span>}
          </article>
        ))}
      </section>

      {room.status === 'finished' && (
        <section className="PixelPanel online-rematch-wait">
          <h2>本场已经结束</h2>
          <p>{ownSeat?.rematchRequested ? '你已申请再来一局，正在等待对方。' : '双方都确认后回到原阵容准备状态。'}</p>
          <button type="button" className="PixelButton" disabled={ownSeat?.rematchRequested} onClick={() => onlineRoomClient.requestRematch()}>
            <span className="button-face" /><span className="button-label">{ownSeat?.rematchRequested ? '等待对方确认' : '再来一局'}</span>
          </button>
        </section>
      )}

      {room.status === 'lobby' && ownSeat && (!ownSeat.lineupLocked || (room.ruleset === 'penalty' && editingPenaltyTeam)) && (
        <section className="online-team-picker">
          <h2>{room.ruleset === 'penalty' ? '选择点球队伍（自动选出主罚手与门将）' : '选择球队后排兵布阵'}</h2>
          <div className="online-team-grid">
            {teams.map((team) => (
              <button type="button" key={team.id} className={selectedTeam?.id === team.id ? 'is-selected' : ''} onClick={() => chooseTeam(team)}>
                <img src={team.flag} alt="" /><strong>{team.name}</strong><small>完整 23 人阵容</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {room.status === 'lobby' && ownSeat?.lineupLocked && (
        <footer className="online-ready-bar">
          {room.ruleset === 'penalty' ? (
            <button type="button" onClick={() => setEditingPenaltyTeam((current) => !current)}>
              {editingPenaltyTeam ? '收起球队' : '更换球队'}
            </button>
          ) : (
            <button type="button" onClick={() => navigateTo('lineup', { gameMode: 'online' })}>重新布阵</button>
          )}
          <button type="button" className="PixelButton" disabled={!room.guest || !otherSeat?.lineupLocked} onClick={setReady}>
            <span className="button-face" /><span className="button-label">{ownSeat.ready ? '取消准备' : '准备开赛'}</span>
          </button>
          <span>{room.guest ? (otherSeat?.ready ? '对方已准备' : '等待对方准备') : '等待另一名玩家'}</span>
        </footer>
      )}
    </main>
  )
}
