import React, { useMemo, useState } from 'react'
import { FORMATION_NAMES, FORMATION_TACTICS } from '../data/formationTactics.js'
import { getTeamDefaultFormation } from '../data/teamFormations.js'
import { getTeamById, getTeamFlag } from '../data/teams'
import {
  calculateLineupRatings,
  getEffectiveRating as calculateEffectiveRating,
} from '../utils/lineupBalance.js'
import {
  getOpponentMatchSetup,
  resolveOpponentStrength,
} from '../utils/opponentTactics.js'

/**
 * 排兵布阵页面
 * 球场背景 + 阵型选择 + 球员拖动上阵
 */

// 属性图标
const statIcons = {
  spd: '/assets/属性/速度.png',
  phy: '/assets/属性/身体.png',
  tec: '/assets/属性/技术.png',
  def: '/assets/属性/防守.png',
  sta: '/assets/属性/体能.png',
  status: '/assets/属性/状态.png',
}

// 阵型位置配置
const formationPositions = {
  '4-3-3': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 15, y: 70 }, { x: 35, y: 75 }, { x: 65, y: 75 }, { x: 85, y: 70 }],
    MF: [{ x: 30, y: 50 }, { x: 50, y: 55 }, { x: 70, y: 50 }],
    FW: [{ x: 25, y: 25 }, { x: 50, y: 20 }, { x: 75, y: 25 }],
  },
  '4-4-2': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 15, y: 70 }, { x: 35, y: 75 }, { x: 65, y: 75 }, { x: 85, y: 70 }],
    MF: [{ x: 15, y: 50 }, { x: 35, y: 55 }, { x: 65, y: 55 }, { x: 85, y: 50 }],
    FW: [{ x: 35, y: 25 }, { x: 65, y: 25 }],
  },
  '4-2-3-1': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 15, y: 70 }, { x: 35, y: 75 }, { x: 65, y: 75 }, { x: 85, y: 70 }],
    MF: [{ x: 35, y: 60 }, { x: 65, y: 60 }, { x: 25, y: 40 }, { x: 50, y: 35 }, { x: 75, y: 40 }],
    FW: [{ x: 50, y: 15 }],
  },
  '4-3-2-1': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 15, y: 70 }, { x: 35, y: 75 }, { x: 65, y: 75 }, { x: 85, y: 70 }],
    MF: [{ x: 30, y: 55 }, { x: 50, y: 50 }, { x: 70, y: 55 }, { x: 35, y: 35 }, { x: 65, y: 35 }],
    FW: [{ x: 50, y: 15 }],
  },
  '3-5-2': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 25, y: 75 }, { x: 50, y: 78 }, { x: 75, y: 75 }],
    MF: [{ x: 10, y: 50 }, { x: 30, y: 55 }, { x: 50, y: 50 }, { x: 70, y: 55 }, { x: 90, y: 50 }],
    FW: [{ x: 35, y: 25 }, { x: 65, y: 25 }],
  },
  '3-4-3': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 25, y: 75 }, { x: 50, y: 78 }, { x: 75, y: 75 }],
    MF: [{ x: 15, y: 50 }, { x: 35, y: 55 }, { x: 65, y: 55 }, { x: 85, y: 50 }],
    FW: [{ x: 25, y: 25 }, { x: 50, y: 20 }, { x: 75, y: 25 }],
  },
  '3-4-2-1': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 25, y: 75 }, { x: 50, y: 78 }, { x: 75, y: 75 }],
    MF: [
      { x: 12, y: 52 }, { x: 38, y: 56 }, { x: 62, y: 56 },
      { x: 88, y: 52 }, { x: 35, y: 36 }, { x: 65, y: 36 },
    ],
    FW: [{ x: 50, y: 18 }],
  },
  '5-3-2': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 10, y: 65 }, { x: 25, y: 72 }, { x: 50, y: 75 }, { x: 75, y: 72 }, { x: 90, y: 65 }],
    MF: [{ x: 30, y: 50 }, { x: 50, y: 45 }, { x: 70, y: 50 }],
    FW: [{ x: 35, y: 25 }, { x: 65, y: 25 }],
  },
  '4-1-4-1': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 15, y: 70 }, { x: 35, y: 75 }, { x: 65, y: 75 }, { x: 85, y: 70 }],
    MF: [{ x: 50, y: 60 }, { x: 15, y: 45 }, { x: 35, y: 48 }, { x: 65, y: 48 }, { x: 85, y: 45 }],
    FW: [{ x: 50, y: 20 }],
  },
  '4-4-1-1': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 15, y: 70 }, { x: 35, y: 75 }, { x: 65, y: 75 }, { x: 85, y: 70 }],
    MF: [{ x: 15, y: 50 }, { x: 35, y: 55 }, { x: 65, y: 55 }, { x: 85, y: 50 }],
    FW: [{ x: 50, y: 35 }, { x: 50, y: 18 }],
  },
}

// 位置中文名
const POSITION_NAMES = { GK: '门将', DF: '后卫', MF: '中场', FW: '前锋' }

// 获取状态等级
function getStatusGrade(form) {
  if (form >= 90) return 'S'
  if (form >= 80) return 'A'
  if (form >= 70) return 'B'
  if (form >= 60) return 'C'
  return 'D'
}

function getStatusGradeColor(grade) {
  if (grade === 'S') return '#ff4444'
  if (grade === 'A') return '#33ff66'
  if (grade === 'B') return '#ffcc00'
  if (grade === 'C') return '#ff8800'
  return '#888'
}

export default function LineupScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const formations = FORMATION_NAMES
  const teamDefaultFormation = getTeamDefaultFormation(saveData.currentRun?.teamId)

  const [selectedFormation, setSelectedFormation] = useState(
    saveData.currentRun?.formation || teamDefaultFormation,
  )
  const [viewingOpponent, setViewingOpponent] = useState(false)
  const [showPlayerInfo, setShowPlayerInfo] = useState(null)
  const [draggedPlayer, setDraggedPlayer] = useState(null)
  const [showPositionWarning, setShowPositionWarning] = useState(null)
  const [dragSource, setDragSource] = useState(null) // 'bench' or 'pitch'

  // 球员可用性
  const injuredPlayersSet = new Set(saveData.currentRun?.injuredPlayers || [])
  const suspendedPlayersSet = new Set(saveData.currentRun?.suspendedPlayers || [])
  const allRosterPlayers = saveData.currentRun?.roster || saveData.currentRun?.purchasedPlayerIds || []
  const isPlayerAvailable = (id) => !injuredPlayersSet.has(id) && !suspendedPlayersSet.has(id)
  const getPlayerUnavailableReason = (id) => {
    if (injuredPlayersSet.has(id)) return '受伤'
    if (suspendedPlayersSet.has(id)) return '停赛'
    return null
  }

  const [startingLineup, setStartingLineup] = useState(() => {
    const savedLineup = saveData.currentRun?.lineup
    if (savedLineup && savedLineup.length > 0) {
      if (savedLineup[0]?.id) {
        const formation = saveData.currentRun?.formation || teamDefaultFormation
        const slots = formationPositions[formation]
        if (!slots) return []
        const result = []
        const positionCounters = {}
        const rosterIds = new Set(allRosterPlayers.map(p => p.id))
        savedLineup.filter(p => rosterIds.has(p.id) && isPlayerAvailable(p.id)).forEach(player => {
          const pos = player.position
          if (!positionCounters[pos]) positionCounters[pos] = 0
          const idx = positionCounters[pos]++
          result.push({ slotId: `${pos}-${idx}`, playerId: player.id, position: pos })
        })
        return result
      }
      return savedLineup
    }
    return []
  })

  const opponent = saveData.currentRun?.currentOpponent || '未知对手'
  const currentTeam = getTeamById(saveData.currentRun?.teamId)
  const opponentTeam = getTeamById(opponent)
  const opponentStrength = resolveOpponentStrength(
    saveData.currentRun?.teamId,
    opponent,
    opponentTeam,
  )
  const opponentSetup = useMemo(
    () => getOpponentMatchSetup(opponent, opponentTeam, opponentStrength),
    [opponent, opponentTeam, opponentStrength],
  )
  const allPlayers = allRosterPlayers

  const getLineupPlayersFromSlots = () => startingLineup
    .map(slot => {
      const player = allPlayers.find(p => p.id === slot.playerId)
      return player ? { ...player, pos: slot.position || slot.slotId.split('-')[0] } : null
    })
    .filter(player => player && isPlayerAvailable(player.id))

  const lineupAssessment = calculateLineupRatings(getLineupPlayersFromSlots(), selectedFormation)

  // 获取对手国旗
  const getOpponentFlag = (opponentName) => {
    const team = getTeamById(opponentName)
    if (team?.flag) return <img src={team.flag} alt={opponentName} className="preview-flag" />
    const flagSrc = getTeamFlag(opponentName)
    if (flagSrc) return <img src={flagSrc} alt={opponentName} className="preview-flag" />
    return <span className="flag-emoji">🏳️</span>
  }

  // 获取替补球员
  const getBenchPlayers = () => {
    const starterIds = new Set(startingLineup.map(s => s.playerId))
    return allPlayers.filter(p => !starterIds.has(p.id) && isPlayerAvailable(p.id))
  }

  // 计算位置惩罚后的有效评分
  const getEffectiveRating = (player, targetPosition) => {
    return calculateEffectiveRating(player, targetPosition)
  }

  // 拖拽开始 - 从替补席
  const handleBenchDragStart = (e, player) => {
    setDraggedPlayer(player)
    setDragSource('bench')
    e.dataTransfer.effectAllowed = 'move'
    createDragGhost(e, player.number || '?')
  }

  // 拖拽开始 - 从球场位置（允许拖走）
  const handlePitchDragStart = (e, player, slotId) => {
    e.stopPropagation()
    setDraggedPlayer(player)
    setDragSource('pitch')
    setDraggedPlayer({ ...player, _fromSlotId: slotId })
    e.dataTransfer.effectAllowed = 'move'
    createDragGhost(e, player.number || '?')
  }

  // 创建拖拽预览
  const createDragGhost = (e, text) => {
    const ghost = document.createElement('div')
    ghost.textContent = text
    ghost.style.cssText = `
      width: 36px; height: 36px;
      background: #C99A2E;
      border: 3px solid #1B3764; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-family: "Zpix", monospace; font-size: 15px; font-weight: 700; color: #1B3764;
      position: absolute; top: -1000px;
    `
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 18, 18)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDragEnd = () => {
    setDraggedPlayer(null)
    setDragSource(null)
  }

  // 拖拽到球场位置
  const handleDrop = (e, positionType, slotIndex) => {
    e.preventDefault()
    if (!draggedPlayer) return

    const slotId = `${positionType}-${slotIndex}`

    // 检查位置兼容性
    const isWrongPosition = draggedPlayer.position !== positionType
    if (isWrongPosition) {
      const effectiveRating = getEffectiveRating(draggedPlayer, positionType)
      setShowPositionWarning({
        player: draggedPlayer,
        targetPosition: positionType,
        effectiveRating,
        onConfirm: () => {
          performDrop(draggedPlayer, slotId, positionType)
          setShowPositionWarning(null)
        },
        onCancel: () => setShowPositionWarning(null),
      })
      setDraggedPlayer(null)
      return
    }

    performDrop(draggedPlayer, slotId, positionType)
  }

  // 执行放置
  const performDrop = (player, slotId, positionType) => {
    // 如果是从球场拖来的，先移除原位置
    let filtered = startingLineup
    if (player._fromSlotId) {
      filtered = filtered.filter(s => s.slotId !== player._fromSlotId)
    }
    // 移除目标位置的球员
    filtered = filtered.filter(s => s.slotId !== slotId)
    // 移除该球员在其他位置的分配
    filtered = filtered.filter(s => s.playerId !== player.id)

    setStartingLineup([...filtered, { slotId, playerId: player.id, position: positionType }])
    setDraggedPlayer(null)
    setDragSource(null)
  }

  // 拖拽到替补席（从球场拖回来）
  const handleBenchDrop = (e) => {
    e.preventDefault()
    if (!draggedPlayer || dragSource !== 'pitch') return

    // 从阵容中移除该球员
    const filtered = startingLineup.filter(s => s.playerId !== draggedPlayer.id)
    setStartingLineup(filtered)
    setDraggedPlayer(null)
    setDragSource(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // 点击球场位置显示球员信息
  const handleSlotClick = (positionType, slotIndex) => {
    const slotId = `${positionType}-${slotIndex}`
    const assigned = startingLineup.find(s => s.slotId === slotId)
    if (assigned) {
      const player = allPlayers.find(p => p.id === assigned.playerId)
      if (player) setShowPlayerInfo(player)
    }
  }

  // 右键点击球场位置移除球员
  const handleSlotRightClick = (e, positionType, slotIndex) => {
    e.preventDefault()
    const slotId = `${positionType}-${slotIndex}`
    const filtered = startingLineup.filter(s => s.slotId !== slotId)
    setStartingLineup(filtered)
  }

  const handleBenchClick = (player) => setShowPlayerInfo(player)

  // 一键布阵 - 按能力值自动选择最佳阵容
  const handleAutoLineup = () => {
    const formationCounts = FORMATION_TACTICS[selectedFormation]?.counts
    if (!formationCounts) return

    const availablePlayers = allPlayers.filter(p => isPlayerAvailable(p.id))

    // 按位置分组
    const playersByPosition = {
      GK: availablePlayers.filter(p => p.position === 'GK').sort((a, b) => b.rating - a.rating),
      DF: availablePlayers.filter(p => p.position === 'DF').sort((a, b) => b.rating - a.rating),
      MF: availablePlayers.filter(p => p.position === 'MF').sort((a, b) => b.rating - a.rating),
      FW: availablePlayers.filter(p => p.position === 'FW').sort((a, b) => b.rating - a.rating),
    }

    const newLineup = []
    const usedPlayerIds = new Set()

    // 按位置分配球员（只选本位置球员，不够就留空）
    for (const [position, count] of Object.entries(formationCounts)) {
      const candidates = playersByPosition[position] || []
      let assigned = 0

      // 只选本位置球员
      for (const player of candidates) {
        if (assigned >= count) break
        if (!usedPlayerIds.has(player.id)) {
          newLineup.push({
            slotId: `${position}-${assigned}`,
            playerId: player.id,
            position,
          })
          usedPlayerIds.add(player.id)
          assigned++
        }
      }
    }

    setStartingLineup(newLineup)
    showToast('已自动布阵！')
  }

  const getOverallRating = () => {
    return startingLineup.length === 0 ? 0 : lineupAssessment.overall
  }

  const getAttackRating = () => {
    return startingLineup.length === 0 ? 0 : lineupAssessment.attack
  }

  const getDefenseRating = () => {
    return startingLineup.length === 0 ? 0 : lineupAssessment.defense
  }

  const handleConfirmLineup = () => {
    if (startingLineup.length < 11) {
      showToast('需要选择11名首发球员！')
      return
    }
    const lineupPlayers = getLineupPlayersFromSlots()
    if (lineupPlayers.length < 11) {
      showToast('首发中包含伤停球员，请重新调整阵容！')
      return
    }
    updateSaveData({
      ...saveData,
      currentRun: {
        ...saveData.currentRun,
        lineup: lineupPlayers,
        formation: selectedFormation,
        matchAttackRating: getAttackRating(),
        matchDefenseRating: getDefenseRating(),
        lineupAssessment,
        stage: 'match',
      },
    })
    navigateTo('match')
  }

  // 六维图
  const renderHexagonChart = (player, size = 60) => {
    const stats = [
      { label: 'SPD', value: player.spd, icon: statIcons.spd },
      { label: 'PHY', value: player.phy, icon: statIcons.phy },
      { label: 'TEC', value: player.tec, icon: statIcons.tec },
      { label: 'DEF', value: player.def, icon: statIcons.def },
      { label: 'STA', value: player.sta, icon: statIcons.sta },
      { label: 'FOR', value: player.form || 80, icon: statIcons.status },
    ]
    const center = size / 2
    const radius = size / 2 - 10
    const angleStep = (Math.PI * 2) / 6
    const points = stats.map((stat, i) => {
      const angle = angleStep * i - Math.PI / 2
      const r = (stat.value / 100) * radius
      return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) }
    })
    const bgPoints = stats.map((_, i) => {
      const angle = angleStep * i - Math.PI / 2
      return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }
    })
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
    const bgPathData = bgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
    const iconSize = size * 0.16
    const iconOffset = radius + iconSize * 0.6
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={bgPathData} fill="none" stroke="var(--pixel-shadow)" strokeWidth="1" opacity="0.3" />
        <path d={pathData} fill="var(--pixel-gold)" fillOpacity="0.3" stroke="var(--pixel-gold)" strokeWidth="2" />
        <circle cx={center} cy={center} r="2" fill="var(--pixel-main)" />
        {stats.map((stat, i) => {
          const angle = angleStep * i - Math.PI / 2
          const ix = center + iconOffset * Math.cos(angle) - iconSize / 2
          const iy = center + iconOffset * Math.sin(angle) - iconSize / 2
          return <image key={stat.label} href={stat.icon} x={ix} y={iy} width={iconSize} height={iconSize} style={{ imageRendering: 'pixelated' }} />
        })}
      </svg>
    )
  }

  // 渲染球场位置
  const renderPitchSlots = () => {
    const activeFormation = viewingOpponent ? opponentSetup.formation : selectedFormation
    const slots = formationPositions[activeFormation]
    if (!slots) return null
    const elements = []
    Object.entries(slots).forEach(([positionType, positions]) => {
      positions.forEach((pos, idx) => {
        const slotId = `${positionType}-${idx}`
        const assigned = viewingOpponent ? null : startingLineup.find(s => s.slotId === slotId)
        const opponentPlayersAtPosition = opponentSetup.lineup.filter(player => player.assignedPosition === positionType)
        const player = viewingOpponent
          ? opponentPlayersAtPosition[idx]
          : assigned ? allPlayers.find(p => p.id === assigned.playerId) : null
        const isWrongPos = player && player.position !== positionType

        let isDragging = false

        elements.push(
          <div
            key={slotId}
            className={`pitch-slot ${player ? 'filled' : 'empty'} ${isWrongPos ? 'wrong-position' : ''} ${viewingOpponent ? 'opponent-slot' : ''}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => {
              if (viewingOpponent && player) {
                setShowPlayerInfo(player)
              } else if (!isDragging) {
                handleSlotClick(positionType, idx)
              }
              isDragging = false
            }}
            onContextMenu={viewingOpponent ? undefined : (e) => handleSlotRightClick(e, positionType, idx)}
            onDrop={viewingOpponent ? undefined : (e) => handleDrop(e, positionType, idx)}
            onDragOver={viewingOpponent ? undefined : handleDragOver}
            draggable={!viewingOpponent && !!player}
            onDragStart={(e) => {
              if (viewingOpponent) return
              isDragging = true
              if (player) {
                handlePitchDragStart(e, player, slotId)
              }
            }}
            onDragEnd={() => {
              isDragging = false
              handleDragEnd()
            }}
          >
            {player ? (
              <span className="slot-number">{player.number || '?'}</span>
            ) : (
              <span className="slot-placeholder">{POSITION_NAMES[positionType] || positionType}</span>
            )}
          </div>
        )
      })
    })
    return elements
  }

  return (
    <div className="screen lineup-screen">
      <div className="screen-header">
        <button className="back-button" onClick={() => navigateTo('tournament')}>←</button>
        <h1>排兵布阵</h1>
      </div>

      {/* 对阵双方 */}
      <div className="match-preview">
        <span className="preview-team">
          {currentTeam && (
            <>
              <img src={currentTeam.flag} alt={currentTeam.name} className="preview-flag" />
              <span>{currentTeam.name}</span>
            </>
          )}
        </span>
        <span className="vs-text">VS</span>
        <span className="preview-team">
          {getOpponentFlag(opponent)}
          <span>{opponent}</span>
        </span>
      </div>

      <div className="lineup-workspace">
        <section className="lineup-pitch-pane">
          <div className="pitch-view-title">
            <span>{viewingOpponent ? `${opponent}首发阵容` : `${currentTeam?.name || '我方'}战术板`}</span>
            <strong>{viewingOpponent ? opponentSetup.formation : selectedFormation}</strong>
          </div>
          <div className="pitch-container">
            <img src="/assets/足球场.png" alt="球场" className="pitch-bg" />
            <div className="pitch-overlay">{renderPitchSlots()}</div>
          </div>
        </section>

        <aside className="lineup-control-pane">
          <button
            className={`lineup-view-toggle ${viewingOpponent ? 'active' : ''}`}
            onClick={() => setViewingOpponent(value => !value)}
          >
            {viewingOpponent ? '返回我方阵容' : `查看${opponent}阵容`}
          </button>

          <section className="lineup-control-section formation-control-section">
            <div className="lineup-section-title">
              <span>{viewingOpponent ? '对手阵型' : '阵型选择'}</span>
              <strong>{viewingOpponent ? opponentSetup.formation : selectedFormation}</strong>
            </div>
            {!viewingOpponent && (
              <div className="formation-selector">
                {formations.map(f => (
                  <button
                    key={f}
                    className={`formation-btn ${selectedFormation === f ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedFormation(f)
                      // 使用一键布阵逻辑
                      const formationCounts = FORMATION_TACTICS[f]?.counts
                      if (!formationCounts) return
                      const availablePlayers = allPlayers.filter(p => isPlayerAvailable(p.id))
                      const playersByPosition = {
                        GK: availablePlayers.filter(p => p.position === 'GK').sort((a, b) => b.rating - a.rating),
                        DF: availablePlayers.filter(p => p.position === 'DF').sort((a, b) => b.rating - a.rating),
                        MF: availablePlayers.filter(p => p.position === 'MF').sort((a, b) => b.rating - a.rating),
                        FW: availablePlayers.filter(p => p.position === 'FW').sort((a, b) => b.rating - a.rating),
                      }
                      const newLineup = []
                      const usedPlayerIds = new Set()
                      for (const [position, count] of Object.entries(formationCounts)) {
                        const candidates = playersByPosition[position] || []
                        let assigned = 0
                        // 只选本位置球员，不够就留空
                        for (const player of candidates) {
                          if (assigned >= count) break
                          if (!usedPlayerIds.has(player.id)) {
                            newLineup.push({ slotId: `${position}-${assigned}`, playerId: player.id, position })
                            usedPlayerIds.add(player.id)
                            assigned++
                          }
                        }
                      }
                      setStartingLineup(newLineup)
                    }}
                    aria-label={`${f} ${FORMATION_TACTICS[f].style}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div className="formation-description">
              <strong>{(viewingOpponent ? opponentSetup.tactics : FORMATION_TACTICS[selectedFormation]).style}</strong>
              <span>{(viewingOpponent ? opponentSetup.tactics : FORMATION_TACTICS[selectedFormation]).summary}</span>
              <small>{(viewingOpponent ? opponentSetup.tactics : FORMATION_TACTICS[selectedFormation]).suitableFor}</small>
            </div>
          </section>

          <section
            className={`lineup-control-section player-control-section${viewingOpponent ? ' is-opponent' : ''}`}
          >
            <div className="lineup-section-title">
              <span>{viewingOpponent ? '对手首发' : '球员选择'}</span>
              <div className="lineup-section-actions">
                {!viewingOpponent && (
                  <>
                    <span style={{ fontSize: 11, color: '#C99A2E', fontFamily: 'Zpix, monospace', whiteSpace: 'nowrap' }}>
                      拖拽球员到战术面板，点击查看详情
                    </span>
                    <button
                      className="auto-lineup-btn"
                      onClick={handleAutoLineup}
                      title="按能力值自动选择最佳阵容"
                    >
                      一键布阵
                    </button>
                  </>
                )}
                <strong>{viewingOpponent ? '11人' : `${getBenchPlayers().length}人可选`}</strong>
              </div>
            </div>

            {!viewingOpponent && (
              <div className="lineup-rating">
                <span className="rating-overall">总评 <strong>{getOverallRating()}</strong></span>
                <span className="rating-attack">进攻 <strong>{getAttackRating()}</strong></span>
                <span className="rating-defense">防守 <strong>{getDefenseRating()}</strong></span>
                <span className="rating-count">{startingLineup.length}/11</span>
              </div>
            )}

            <div
              className={`bench-section ${viewingOpponent ? 'opponent-roster-section' : ''}`}
              onDrop={viewingOpponent ? undefined : handleBenchDrop}
              onDragOver={viewingOpponent ? undefined : handleDragOver}
            >
              <div className="bench-list">
                {(viewingOpponent ? opponentSetup.lineup : getBenchPlayers()).map(player => {
                  const grade = getStatusGrade(player.form || 80)
                  const gradeColor = getStatusGradeColor(grade)
                  const unavailable = !viewingOpponent && !isPlayerAvailable(player.id)
                  const reason = getPlayerUnavailableReason(player.id)
                  return (
                    <div
                      key={player.id}
                      className={`bench-player ${unavailable ? 'bench-player-unavailable' : ''} ${viewingOpponent ? 'opponent-player-row' : ''}`}
                      draggable={!viewingOpponent && !unavailable}
                      onDragStart={(e) => { if (!viewingOpponent && !unavailable) handleBenchDragStart(e, player) }}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        if (unavailable) showToast(`${player.name} 因${reason}无法上场`)
                        else handleBenchClick(player)
                      }}
                    >
                      <span className="bench-position-label">{POSITION_NAMES[player.position] || player.position}</span>
                      <span className="bench-number">{player.number || '?'}</span>
                      <span className="bench-name">{player.name}</span>
                      {unavailable ? (
                        <span className="bench-unavailable-tag">{reason}</span>
                      ) : (
                        <span className="bench-rating">
                          {player.rating}
                          <span className="bench-status-title">状态</span>
                          <span className="bench-grade" style={{ color: gradeColor }}>{grade}</span>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* 确认按钮 */}
      <div className="lineup-footer">
        <button
          className="lineup-confirm-button"
          onClick={handleConfirmLineup}
          disabled={startingLineup.length < 11}
        >
          {startingLineup.length < 11 ? `还需选择 ${11 - startingLineup.length} 名球员` : '确认阵容 → 开始比赛'}
        </button>
      </div>

      {/* 位置警告弹窗 */}
      {showPositionWarning && (
        <div className="modal-overlay" onClick={showPositionWarning.onCancel}>
          <div className="modal-content position-warning-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ 位置不匹配</h3>
              <button className="modal-close" onClick={showPositionWarning.onCancel}>×</button>
            </div>
            <div className="warning-body">
              <p>
                <strong>{showPositionWarning.player.name}</strong> 是 {POSITION_NAMES[showPositionWarning.player.position]}
                ，放在 {POSITION_NAMES[showPositionWarning.targetPosition]} 位置
              </p>
              <p className="warning-effect">
                有效评分: {showPositionWarning.player.rating} → <span className="rating-penalty">{showPositionWarning.effectiveRating}</span>
              </p>
              <p className="warning-hint">球员在不熟悉的位置能力会打折扣，但关键时刻可能有奇效！</p>
              <div className="warning-actions">
                <button className="PixelButton" onClick={showPositionWarning.onConfirm}>
                  <span className="button-face" aria-hidden="true"></span>
                  <span className="button-label">确定安排</span>
                </button>
                <button className="PixelButton btn-secondary" onClick={showPositionWarning.onCancel}>
                  <span className="button-face" aria-hidden="true"></span>
                  <span className="button-label">取消</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 球员信息弹窗 */}
      {showPlayerInfo && (
        <div className="modal-overlay" onClick={() => setShowPlayerInfo(null)}>
          <div className="modal-content player-info-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <span className="player-number-badge">{showPlayerInfo.number || '?'}</span>
                {showPlayerInfo.name}
              </h3>
              <button className="modal-close" onClick={() => setShowPlayerInfo(null)}>×</button>
            </div>
            <div className="player-info-body">
              <div className="player-info-top">
                {showPlayerInfo.avatar && (
                  <div className="player-info-portrait">
                    <img src={showPlayerInfo.avatar} alt={showPlayerInfo.name} />
                  </div>
                )}
                <div className="player-info-basic">
                  <div className="player-info-meta">
                    <span className="info-position">{showPlayerInfo.position}</span>
                    <span className="info-rating">{showPlayerInfo.rating}</span>
                    <span className="info-grade" style={{ color: getStatusGradeColor(getStatusGrade(showPlayerInfo.form || 80)) }}>
                      {getStatusGrade(showPlayerInfo.form || 80)}
                    </span>
                  </div>
                  <div className="player-info-stars">{'⭐'.repeat(showPlayerInfo.star || 1)}</div>
                  <div className="player-info-physical">
                    {showPlayerInfo.height && <span>📏 {showPlayerInfo.height}</span>}
                    {showPlayerInfo.weight && <span>⚖️ {showPlayerInfo.weight}</span>}
                  </div>
                  {showPlayerInfo.price != null && <div className="player-info-price">💰 {showPlayerInfo.price} 金币</div>}
                </div>
              </div>
              <div className="player-info-chart">{renderHexagonChart(showPlayerInfo, 100)}</div>
              <div className="player-info-stats">
                {[
                  { key: 'spd', label: '速度' },
                  { key: 'phy', label: '身体' },
                  { key: 'tec', label: '技术' },
                  { key: 'def', label: '防守' },
                  { key: 'sta', label: '体能' },
                ].map(({ key, label }) => (
                  <div key={key} className="stat-row">
                    <img src={statIcons[key]} alt={label} className="stat-icon" />
                    <span className="stat-label">{label}</span>
                    <div className="stat-bar-bg">
                      <div className="stat-bar-fill" style={{ width: `${showPlayerInfo[key]}%` }}></div>
                    </div>
                    <span className="stat-value">{showPlayerInfo[key]}</span>
                  </div>
                ))}
              </div>
              <div className="player-info-desc">{showPlayerInfo.description}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
