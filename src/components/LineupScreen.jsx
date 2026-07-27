import React, { useMemo, useRef, useState } from 'react'
import { FORMATION_NAMES, FORMATION_TACTICS } from '../data/formationTactics.js'
import { getTeamDefaultFormation } from '../data/teamFormations.js'
import { getTeamById, getTeamFlag } from '../data/teams'
import {
  calculateLineupRatings,
  getEffectiveRating as calculateEffectiveRating,
} from '../utils/lineupBalance.js'
import {
  adaptLineupToFormation,
  autoSelectLineupForFormation,
} from '../utils/lineupFormation.js'
import {
  getOpponentMatchSetup,
  resolveOpponentStrength,
} from '../utils/opponentTactics.js'
import { getLogisticsModifiers } from '../utils/logisticsEffects.js'
import { computeMatchIntel } from '../utils/scoutIntel.js'
import '../styles/intel-panel.css'

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
  '5-4-1': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 10, y: 65 }, { x: 25, y: 72 }, { x: 50, y: 75 }, { x: 75, y: 72 }, { x: 90, y: 65 }],
    MF: [{ x: 15, y: 50 }, { x: 38, y: 55 }, { x: 62, y: 55 }, { x: 85, y: 50 }],
    FW: [{ x: 50, y: 25 }],
  },
  '4-1-4-1': {
    GK: [{ x: 50, y: 90 }],
    DF: [{ x: 15, y: 70 }, { x: 35, y: 75 }, { x: 65, y: 75 }, { x: 85, y: 70 }],
    MF: [{ x: 50, y: 60 }, { x: 15, y: 45 }, { x: 35, y: 48 }, { x: 65, y: 48 }, { x: 85, y: 45 }],
    FW: [{ x: 50, y: 20 }],
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
  const [selectedBenchPlayerId, setSelectedBenchPlayerId] = useState(null)
  const [showPositionWarning, setShowPositionWarning] = useState(null)
  const [dragSource, setDragSource] = useState(null) // 'bench' or 'pitch'
  const [intelExpanded, setIntelExpanded] = useState(false)
  // 阵型选择：手机横屏默认收起，桌面/iPad 默认展开
  const [formationCollapsed, setFormationCollapsed] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches
  })
  const pointerDragRef = useRef(null)
  const suppressPointerClickRef = useRef(false)

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

  // 赛前情报计算（基于后勤等级）
  const intelData = useMemo(() => {
    const modifiers = getLogisticsModifiers(saveData.currentRun?.logisticsLevels)
    if (modifiers.intelLevel === 0 && modifiers.scoutLevel === 0) return null
    return computeMatchIntel({
      opponentSetup,
      opponentTeam,
      opponentTeamId: saveData.currentRun?.currentOpponent,
      opponentStrength,
      playerLineup: getLineupPlayersFromSlots(),
      playerFormation: selectedFormation,
      intelLevel: modifiers.intelLevel,
      scoutLevel: modifiers.scoutLevel,
    })
  }, [opponentSetup, opponentTeam, opponentStrength, startingLineup, selectedFormation, saveData.currentRun?.logisticsLevels])

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
  const preparePlayerPlacement = (player, positionType, slotIndex) => {
    if (!player) return
    const slotId = `${positionType}-${slotIndex}`

    // 检查位置兼容性
    const isWrongPosition = player.position !== positionType
    if (isWrongPosition) {
      const effectiveRating = getEffectiveRating(player, positionType)
      setShowPositionWarning({
        player,
        targetPosition: positionType,
        effectiveRating,
        onConfirm: () => {
          performDrop(player, slotId, positionType)
          setShowPositionWarning(null)
        },
        onCancel: () => {
          setShowPositionWarning(null)
          setSelectedBenchPlayerId(null)
        },
      })
      setDraggedPlayer(null)
      return
    }

    performDrop(player, slotId, positionType)
  }

  const handleDrop = (e, positionType, slotIndex) => {
    e.preventDefault()
    preparePlayerPlacement(draggedPlayer, positionType, slotIndex)
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
    setSelectedBenchPlayerId(null)
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

  // 移动端不会可靠触发 HTML5 drag/drop，使用 Pointer Events 补齐手指拖放。
  const clearPointerDrag = () => {
    const activeDrag = pointerDragRef.current
    activeDrag?.element?.classList.remove('is-pointer-dragging')
    pointerDragRef.current = null
    setDraggedPlayer(null)
    setDragSource(null)
  }

  const handlePlayerPointerDown = (e, player, source, slotId = null) => {
    if (e.pointerType === 'mouse' || !player || !isPlayerAvailable(player.id)) return

    const dragPlayer = slotId ? { ...player, _fromSlotId: slotId } : player
    pointerDragRef.current = {
      pointerId: e.pointerId,
      player: dragPlayer,
      source,
      element: e.currentTarget,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      direction: null, // 'horizontal' | 'vertical' | null
    }
    // Don't capture pointer yet — wait until we confirm horizontal drag direction
  }

  const handlePlayerPointerMove = (e) => {
    const activeDrag = pointerDragRef.current
    if (!activeDrag || activeDrag.pointerId !== e.pointerId) return

    const dx = Math.abs(e.clientX - activeDrag.startX)
    const dy = Math.abs(e.clientY - activeDrag.startY)
    const distance = Math.hypot(dx, dy)

    // Determine drag direction on first significant movement
    if (!activeDrag.direction && distance >= 6) {
      if (dy > dx * 0.8) {
        // Vertical movement dominant → cancel drag, let browser scroll
        activeDrag.direction = 'vertical'
        pointerDragRef.current = null
        return
      }
      // Horizontal movement → start drag
      activeDrag.direction = 'horizontal'
      activeDrag.element?.setPointerCapture?.(activeDrag.pointerId)
    }

    if (activeDrag.direction === 'vertical') {
      pointerDragRef.current = null
      return
    }

    if (!activeDrag.moved && distance >= 6) {
      activeDrag.moved = true
      activeDrag.element?.classList.add('is-pointer-dragging')
      setDraggedPlayer(activeDrag.player)
      setDragSource(activeDrag.source)
    }

    if (activeDrag.moved) e.preventDefault()
  }

  const handlePlayerPointerUp = (e) => {
    const activeDrag = pointerDragRef.current
    if (!activeDrag || activeDrag.pointerId !== e.pointerId) return

    try { activeDrag.element?.releasePointerCapture?.(e.pointerId) } catch { /* not captured */ }
    if (!activeDrag.moved) {
      clearPointerDrag()
      return
    }

    const dropTarget = document.elementFromPoint(e.clientX, e.clientY)
    const pitchSlot = dropTarget?.closest?.('.pitch-slot[data-slot-id]')
    const benchTarget = dropTarget?.closest?.('.bench-section')

    if (pitchSlot) {
      const [positionType, slotIndex] = pitchSlot.dataset.slotId.split('-')
      preparePlayerPlacement(activeDrag.player, positionType, Number(slotIndex))
    } else if (benchTarget && activeDrag.source === 'pitch') {
      setStartingLineup(current => current.filter(slot => slot.playerId !== activeDrag.player.id))
    }

    suppressPointerClickRef.current = true
    e.preventDefault()
    e.stopPropagation()
    clearPointerDrag()
    window.setTimeout(() => {
      suppressPointerClickRef.current = false
    }, 0)
  }

  const handlePlayerPointerCancel = () => clearPointerDrag()

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

  const renderBenchPlayer = (player, extraClassName = '') => {
    const grade = getStatusGrade(player.form || 80)
    const gradeColor = getStatusGradeColor(grade)
    const unavailable = !isPlayerAvailable(player.id)
    const reason = getPlayerUnavailableReason(player.id)

    return (
      <div
        key={player.id}
        className={`bench-player ${unavailable ? 'bench-player-unavailable' : ''} ${extraClassName}`.trim()}
        draggable={!unavailable}
        onDragStart={(e) => { if (!unavailable) handleBenchDragStart(e, player) }}
        onDragEnd={handleDragEnd}
        onPointerDown={(e) => { if (!unavailable) handlePlayerPointerDown(e, player, 'bench') }}
        onPointerMove={handlePlayerPointerMove}
        onPointerUp={handlePlayerPointerUp}
        onPointerCancel={handlePlayerPointerCancel}
        onClick={() => {
          if (suppressPointerClickRef.current) return
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
  }

  // 一键布阵 - 按能力值自动选择最佳阵容
  const handleAutoLineup = () => {
    const availablePlayers = allPlayers.filter(p => isPlayerAvailable(p.id))
    const newLineup = autoSelectLineupForFormation(availablePlayers, selectedFormation)

    setStartingLineup(newLineup)
    showToast('已自动布阵！')
  }

  const handleFormationChange = (formation) => {
    setSelectedFormation(formation)
    const availablePlayers = allPlayers.filter(p => isPlayerAvailable(p.id))
    setStartingLineup(current => adaptLineupToFormation(current, availablePlayers, formation))
    showToast(`已切换为 ${formation}，保留当前首发并自动补位`)
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
            data-slot-id={slotId}
            onClick={() => {
              if (suppressPointerClickRef.current) return
              if (viewingOpponent && player) {
                setShowPlayerInfo(player)
              } else if (selectedBenchPlayerId) {
                const selectedPlayer = allPlayers.find(candidate => candidate.id === selectedBenchPlayerId)
                preparePlayerPlacement(selectedPlayer, positionType, idx)
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
            onPointerDown={viewingOpponent || !player
              ? undefined
              : (e) => handlePlayerPointerDown(e, player, 'pitch', slotId)}
            onPointerMove={viewingOpponent ? undefined : handlePlayerPointerMove}
            onPointerUp={viewingOpponent ? undefined : handlePlayerPointerUp}
            onPointerCancel={viewingOpponent ? undefined : handlePlayerPointerCancel}
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
          <div className="demo-lineup-left">
            <div className="pitch-container">
              <img src="/assets/足球场.png" alt="球场" className="pitch-bg" />
              <div className="pitch-overlay">{renderPitchSlots()}</div>
            </div>
          </div>
        </section>

        <aside className={`lineup-control-pane${intelExpanded && !viewingOpponent ? ' is-intel-expanded' : ''}`}>
          <button
            className={`lineup-view-toggle ${viewingOpponent ? 'active' : ''}`}
            onClick={() => setViewingOpponent(value => !value)}
          >
            {viewingOpponent ? '返回我方阵容' : `查看${opponent}阵容`}
          </button>

          <section className={`lineup-control-section formation-control-section${formationCollapsed ? ' is-formation-collapsed' : ''}`}>
            <div className="lineup-section-title">
              <span>{viewingOpponent ? '对手阵型' : '阵型选择'}</span>
              <strong>{viewingOpponent ? opponentSetup.formation : selectedFormation}</strong>
              {!viewingOpponent && (
                <button
                  type="button"
                  className="intel-toggle-btn formation-toggle-btn"
                  onClick={() => setFormationCollapsed(v => !v)}
                >
                  {formationCollapsed ? '展开' : '收起'}
                </button>
              )}
            </div>
            {!viewingOpponent && (
              <div className="formation-selector">
                {formations.map(f => (
                  <button
                    key={f}
                    className={`formation-btn ${selectedFormation === f ? 'active' : ''}`}
                    onClick={() => handleFormationChange(f)}
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

          {/* 赛前情报面板 */}
          {!viewingOpponent && (
            <section className={`lineup-control-section intel-panel-section ${intelExpanded ? 'is-expanded' : 'is-collapsed'}`}>
              <div className="lineup-section-title">
                <span>赛前情报</span>
                <button
                  className="intel-toggle-btn"
                  onClick={() => setIntelExpanded(v => !v)}
                >
                  {intelExpanded ? '收起' : '展开'}
                </button>
              </div>
              {intelExpanded && (
                intelData ? (
                  <div className="intel-content">
                    {/* 数据分析中心 */}
                    {intelData.intel && (
                      <div className="intel-group">
                        <div className="intel-group-header">
                          <img src="/assets/后勤/数据分析中心.png" alt="" className="intel-group-icon" />
                          <span>数据分析中心</span>
                          <span className="intel-group-level">Lv.{intelData.intel.level}</span>
                        </div>
                        {/* L1: 对手风格 */}
                        <div className="intel-item">
                          <span className="intel-item-label">风格</span>
                          <div className="intel-tags">
                            {intelData.intel.strengths.map(tag => (
                              <span key={tag} className="intel-tag">{tag}</span>
                            ))}
                          </div>
                        </div>
                        {/* L2: 危险球员 + 弱点 */}
                        {intelData.intel.level >= 2 && intelData.intel.dangerPlayer && (
                          <div className="intel-item">
                            <span className="intel-item-label">危险球员</span>
                            <span className="intel-item-value danger">
                              {intelData.intel.dangerPlayer.name}（{intelData.intel.dangerPlayer.position} 评分{intelData.intel.dangerPlayer.rating}）
                            </span>
                          </div>
                        )}
                        {intelData.intel.level >= 2 && intelData.intel.weakness && (
                          <div className="intel-item">
                            <span className="intel-item-label">弱点</span>
                            <span className="intel-item-value warning">
                              对手{intelData.intel.weakness.areaLabel}评分{intelData.intel.weakness.opponentRating}，
                              我方{intelData.intel.weakness.playerAreaLabel}评分{intelData.intel.weakness.playerRating}
                            </span>
                          </div>
                        )}
                        {intelData.intel.level >= 2 && intelData.intel.weakness && (
                          <div className="intel-item">
                            <span className="intel-item-label">建议</span>
                            <span className="intel-item-value highlight">{intelData.intel.weakness.advice}</span>
                          </div>
                        )}
                        {/* L3: 战术建议 */}
                        {intelData.intel.level >= 3 && intelData.intel.tacticalAdvice && (
                          <div className="intel-advice-box">
                            对手{intelData.intel.tacticalAdvice.opponentFormation}阵型被
                            <span className="advice-formation"> {intelData.intel.tacticalAdvice.recommendedFormation} </span>
                            克制。{intelData.intel.tacticalAdvice.reason}
                          </div>
                        )}
                        {/* 未解锁提示 */}
                        {intelData.intel.level < 2 && (
                          <div className="intel-locked">
                            <img src="/assets/锁.png" alt="" />
                            <span>升级数据分析中心至Lv.2解锁弱点分析</span>
                          </div>
                        )}
                        {intelData.intel.level < 3 && (
                          <div className="intel-locked">
                            <img src="/assets/锁.png" alt="" />
                            <span>升级至Lv.3解锁战术建议</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* 情报部门 */}
                    {intelData.scout && (
                      <div className="intel-group">
                        <div className="intel-group-header">
                          <img src="/assets/后勤/情报部门.png" alt="" className="intel-group-icon" />
                          <span>情报部门</span>
                          <span className="intel-group-level">Lv.{intelData.scout.level}</span>
                        </div>
                        {/* L1: 近期趋势 */}
                        <div className="intel-item">
                          <span className="intel-item-label">趋势</span>
                          <span className="intel-item-value">{intelData.scout.formTrend}</span>
                        </div>
                        {/* L2: 门将 + 阵型 */}
                        {intelData.scout.level >= 2 && intelData.scout.goalkeeper && (
                          <div className="intel-item">
                            <span className="intel-item-label">门将</span>
                            <span className="intel-item-value">{intelData.scout.goalkeeper.tip}</span>
                          </div>
                        )}
                        {intelData.scout.level >= 2 && intelData.scout.goalkeeper?.tendency && (
                          <div className="intel-item">
                            <span className="intel-item-label">扑点</span>
                            <span className="intel-item-value danger">
                              习惯扑{intelData.scout.goalkeeper.tendency.biasLabel}，{intelData.scout.goalkeeper.tendency.description}
                            </span>
                          </div>
                        )}
                        {intelData.scout.level >= 2 && intelData.scout.formationTendency && (
                          <div className="intel-item">
                            <span className="intel-item-label">阵型</span>
                            <span className="intel-item-value">惯用 {intelData.scout.formationTendency}</span>
                          </div>
                        )}
                        {/* L3: 战术预判 */}
                        {intelData.scout.level >= 3 && intelData.scout.tacticalPrediction && (
                          <>
                            <div className="intel-item">
                              <span className="intel-item-label">领先时</span>
                              <span className="intel-item-value">{intelData.scout.tacticalPrediction.whenWinning}</span>
                            </div>
                            <div className="intel-item">
                              <span className="intel-item-label">落后时</span>
                              <span className="intel-item-value warning">{intelData.scout.tacticalPrediction.whenLosing}</span>
                            </div>
                            <div className="intel-item">
                              <span className="intel-item-label">威胁</span>
                              <span className="intel-item-value danger">{intelData.scout.tacticalPrediction.keyThreat}</span>
                            </div>
                          </>
                        )}
                        {/* 未解锁提示 */}
                        {intelData.scout.level < 2 && (
                          <div className="intel-locked">
                            <img src="/assets/锁.png" alt="" />
                            <span>升级情报部门至Lv.2解锁门将情报</span>
                          </div>
                        )}
                        {intelData.scout.level < 3 && (
                          <div className="intel-locked">
                            <img src="/assets/锁.png" alt="" />
                            <span>升级至Lv.3解锁战术预判</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="intel-empty-hint">
                    升级数据分析中心或情报部门以解锁赛前情报
                  </div>
                )
              )}
            </section>
          )}

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
                  if (!viewingOpponent) return renderBenchPlayer(player)

                  const grade = getStatusGrade(player.form || 80)
                  const gradeColor = getStatusGradeColor(grade)
                  return (
                    <div
                      key={player.id}
                      className="bench-player opponent-player-row"
                      onClick={() => handleBenchClick(player)}
                    >
                      <span className="bench-position-label">{POSITION_NAMES[player.position] || player.position}</span>
                      <span className="bench-number">{player.number || '?'}</span>
                      <span className="bench-name">{player.name}</span>
                      <span className="bench-rating">
                        {player.rating}
                        <span className="bench-status-title">状态</span>
                        <span className="bench-grade" style={{ color: gradeColor }}>{grade}</span>
                      </span>
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
                  {showPlayerInfo.price != null && <div className="player-info-price">{showPlayerInfo.price} 征召点</div>}
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
