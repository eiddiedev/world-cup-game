import React, { useState } from 'react'
import { getTeamById } from '../data/teams'
import { getTeamDefaultFormation } from '../data/teamFormations'
import {
  NATIONAL_SQUAD_SIZE,
  MIN_PURCHASE,
  buildRecommendedNationalSquad,
  validateNationalSquad,
} from '../data/rosterRules'

/**
 * 根据阵型字符串解析各位置最少人数
 * 例: "4-3-3" → {GK:1, DF:4, MF:3, FW:3}
 *     "4-2-3-1" → {GK:1, DF:4, MF:5, FW:1}
 *     "5-3-2" → {GK:1, DF:5, MF:3, FW:2}
 */
function parseFormationMin(formationStr) {
  const parts = formationStr.split('-').map(Number)
  if (parts.length < 2) return { GK: 1, DF: 4, MF: 3, FW: 3 }
  const df = parts[0]
  const fw = parts[parts.length - 1]
  const mf = parts.slice(1, -1).reduce((a, b) => a + b, 0)
  return { GK: 1, DF: df, MF: mf, FW: fw }
}

/**
 * 球员招募页面
 * 按位置分组显示球员：GK → DF → MF → FW
 * 球员卡片设计 + 六维属性图
 */
export default function RecruitmentScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const team = getTeamById(saveData.currentRun?.teamId)
  const [purchasedPlayers, setPurchasedPlayers] = useState(
    saveData.currentRun?.purchasedPlayerIds || []
  )
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [activePosition, setActivePosition] = useState('GK')

  if (!team) {
    return (
      <div className="screen">
        <p>错误：未找到球队数据</p>
        <button className="PixelButton" onClick={() => navigateTo('home')}>
          <span className="button-face" aria-hidden="true"></span>
          <span className="button-label">返回首页</span>
        </button>
      </div>
    )
  }

  const availablePlayers = team.players || []
  const totalBudget = team.budget
  const squadValidation = validateNationalSquad(purchasedPlayers, totalBudget)
  const spentBudget = squadValidation.spent
  const remainingBudget = totalBudget - spentBudget

  // 按位置分组
  const positionOrder = ['GK', 'DF', 'MF', 'FW']
  const positionNames = { GK: '门将', DF: '后卫', MF: '中场', FW: '前锋' }

  // 按位置筛选
  const filteredPlayers = availablePlayers.filter(p => p.position === activePosition)

  // 按价格排序（从高到低）
  const sortedPlayers = [...filteredPlayers].sort((a, b) => b.price - a.price)

  // 当前阵型及各位置最少人数
  const currentFormation = saveData.currentRun?.formation || getTeamDefaultFormation(team.id)
  const formationMin = parseFormationMin(currentFormation)

  // 按位置统计已购球员
  const purchasedByPosition = positionOrder.reduce((acc, pos) => {
    acc[pos] = purchasedPlayers.filter(p => p.position === pos).length
    return acc
  }, {})

  const handleBuyPlayer = (player) => {
    if (purchasedPlayers.length >= NATIONAL_SQUAD_SIZE) {
      showToast(`征召名单已满（${NATIONAL_SQUAD_SIZE}人）`)
      return
    }
    if (player.price > remainingBudget) {
      showToast('预算不足')
      return
    }
    if (purchasedPlayers.some(p => p.id === player.id)) {
      showToast('该球员已在征召名单中')
      return
    }
    setPurchasedPlayers([...purchasedPlayers, player])
    showToast(`已征召 ${player.name}`)
  }

  const handleSellPlayer = (player) => {
    setPurchasedPlayers(purchasedPlayers.filter((p) => p.id !== player.id))
    showToast(`已移出 ${player.name}`)
  }

  const handleConfirmRoster = () => {
    const validation = validateNationalSquad(purchasedPlayers, totalBudget)
    if (validation.count < MIN_PURCHASE) {
      showToast(`至少征召${MIN_PURCHASE}人才能开赛`)
      return
    }
    if (validation.missing.length > 0) {
      showToast('位置结构不足：至少2门将、3后卫、3中场、2前锋')
      return
    }
    if (validation.spent > totalBudget) {
      showToast('征召预算超支')
      return
    }

    updateSaveData({
      ...saveData,
      currentRun: {
        ...saveData.currentRun,
        purchasedPlayerIds: purchasedPlayers,
        roster: purchasedPlayers, // 保存完整阵容
        matchIndex: 0, // 从第一场比赛开始
        stage: 'logistics',
      },
    })
    navigateTo('logistics')
  }

  // 一键推荐征召：按阵型、预算和最低位置结构推荐23人
  const handleAutoRecruit = () => {
    const formation = saveData.currentRun?.formation || getTeamDefaultFormation(team.id)
    const selected = buildRecommendedNationalSquad(availablePlayers, team.budget, formation)

    if (selected.length === 0) {
      showToast('无法生成征召推荐')
      return
    }

    setPurchasedPlayers(selected)
    showToast(`一键推荐完成：征召 ${selected.length} 人`)
  }

  // 六维图渲染
  const renderRadarChart = (player) => {
    const stats = [
      { label: '速度', value: player.spd, icon: '/assets/属性/速度.png' },
      { label: '身体', value: player.phy, icon: '/assets/属性/身体.png' },
      { label: '技术', value: player.tec, icon: '/assets/属性/技术.png' },
      { label: '防守', value: player.def, icon: '/assets/属性/防守.png' },
      { label: '体能', value: player.sta, icon: '/assets/属性/体能.png' },
      { label: '状态', value: player.form || 80, icon: '/assets/属性/状态.png' },
    ]
    const cx = 150, cy = 150, r = 80
    const angles = stats.map((_, i) => (Math.PI * 2 * i) / 6 - Math.PI / 2)
    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0]

    const getPoint = (ratio, angle) => ({
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    })

    const dataPoints = stats.map((s, i) => getPoint(s.value / 100, angles[i]))

    return (
      <svg viewBox="0 0 300 300" className="radar-chart">
        {/* 网格层 */}
        {gridLevels.map(level => {
          const pts = angles.map(a => getPoint(level, a))
          return <polygon key={level} points={pts.map(p => `${p.x},${p.y}`).join(' ')} className="radar-grid" />
        })}
        {/* 轴线 */}
        {angles.map(a => {
          const p = getPoint(1, a)
          return <line key={a} x1={cx} y1={cy} x2={p.x} y2={p.y} className="radar-axis" />
        })}
        {/* 数据多边形 */}
        <polygon points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')} className="radar-data" />
        {/* 数据点 */}
        {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" className="radar-dot" />)}
        {/* 标签 + 图标 + 数值 */}
        {stats.map((s, i) => {
          const lp = getPoint(1.35, angles[i])
          const iconSize = 14
          return (
            <g key={i}>
              <image href={s.icon} x={lp.x - 38} y={lp.y - 7} width={iconSize} height={iconSize} />
              <text x={lp.x - 14} y={lp.y} textAnchor="middle" dominantBaseline="middle" className="radar-label">{s.label}</text>
              <text x={lp.x} y={lp.y + 14} textAnchor="middle" dominantBaseline="middle" className="radar-value">{s.value}</text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <div className="screen recruitment-screen">
      <div className="recruitment-top">
        <div className="screen-header">
          <button className="back-button" onClick={() => navigateTo('team-select')}>
            ←
          </button>
          <h1>国家队征召 - {team.name}</h1>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p className="recruitment-hint">
            从{availablePlayers.length}人候选池中征召（至少{MIN_PURCHASE}人，受预算约束）。默认阵型 {team.defaultFormation}，风格：{team.styleTags?.join(' / ')}。
          </p>
        </div>

        <div className="recruitment-stats">
          <div className="stat-item" data-guide="recruitment-budget">
            <span className="stat-label">征召点</span>
            <span className="stat-value budget">{remainingBudget}<img src="/assets/征召点.png" alt="征召点" className="coin-icon" /></span>
          </div>
          <div className="stat-item">
            <span className="stat-label">已征召</span>
            <span className="stat-value">{purchasedPlayers.length}</span>
          </div>
          {positionOrder.map(pos => (
            <div key={pos} className="stat-item">
              <span className="stat-label">{positionNames[pos]}</span>
              <span className="stat-value">{purchasedByPosition[pos]}<span className="stat-min-hint">/≥{formationMin[pos]}</span></span>
            </div>
          ))}
        </div>

        <div className="position-tabs" data-guide="recruitment-positions">
          {positionOrder.map(pos => (
            <button
              key={pos}
              className={`position-tab ${activePosition === pos ? 'active' : ''}`}
              onClick={() => setActivePosition(pos)}
            >
              {positionNames[pos]}
            </button>
          ))}
        </div>
      </div>

      <div className="player-grid">
        {sortedPlayers.length === 0 ? (
          <div className="empty-state">
            <p>暂无球员数据</p>
          </div>
        ) : (
          sortedPlayers.map((player, playerIndex) => {
            const isPurchased = purchasedPlayers.some((p) => p.id === player.id)
            const ratingColor = player.rating >= 85 ? 'green' : player.rating >= 75 ? 'yellow' : 'red'
            return (
              <div
                key={player.id}
                data-guide={playerIndex === 0 ? 'recruitment-player-card' : undefined}
                className={`game-card-v2 ${player.isGolden ? 'golden' : ''} ${player.cardTier === '银' ? 'silver' : ''} ${isPurchased ? 'purchased' : ''}`}
                onClick={() => setSelectedPlayer(player)}
              >
                {/* 区域1：上半区 */}
                <div className="card-v2-top">
                  <div className="card-v2-avatar">
                    {player.avatar ? (
                      <img src={player.avatar} alt={player.name} />
                    ) : (
                      <div className="avatar-placeholder">{player.position}</div>
                    )}
                  </div>
                  <div className={`card-v2-rating rating-${ratingColor}`}>
                    {player.rating}
                  </div>
                  <div className="card-v2-price">
                    {player.price}
                    <img src="/assets/征召点.png" className="coin-icon" alt="征召点" />
                  </div>
                  <div className="card-v2-name-row">
                    <span className="card-v2-name">{player.name}</span>
                    <span className="card-v2-number">#{player.number || '?'}</span>
                  </div>
                </div>

                {/* 区域3：分隔线 */}
                <div className="card-v2-divider" />

                {/* 区域4：六维属性 */}
                <div className="card-v2-stats">
                  {[
                    ['速度', player.spd],
                    ['身体', player.phy],
                    ['技术', player.tec],
                    ['防守', player.def],
                    ['体能', player.sta],
                    ['状态', player.form],
                  ].map(([label, value]) => (
                    <div className="card-v2-stat" key={label}>
                      <span className="stat-label">{label}</span>
                      <span className="stat-value">{value}</span>
                    </div>
                  ))}
                </div>

                {/* 区域5：操作按钮 */}
                <div className="card-v2-action">
                  {isPurchased ? (
                    <button
                      className="btn-v2-sell"
                      onClick={(e) => { e.stopPropagation(); handleSellPlayer(player); }}
                    >
                      移出
                    </button>
                  ) : (
                    <button
                      className="btn-v2-buy"
                      onClick={(e) => { e.stopPropagation(); handleBuyPlayer(player); }}
                      disabled={player.price > remainingBudget || purchasedPlayers.length >= NATIONAL_SQUAD_SIZE}
                    >
                      征召
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {selectedPlayer && (
        <div className="player-detail-modal" onClick={() => setSelectedPlayer(null)}>
          <div className="player-detail-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPlayer(null)}>✕</button>
            <h3>{selectedPlayer.name}</h3>
            <p className="player-description">{selectedPlayer.description}</p>
            {renderRadarChart(selectedPlayer)}
            <div className="player-detail-stars">
              <span className="stat-label">关键时刻</span>
              <span className="stat-stars">{'★'.repeat(selectedPlayer.star)}</span>
            </div>
            <div className="player-detail-physical">
              {selectedPlayer.height && <span>📏 {selectedPlayer.height}</span>}
              {selectedPlayer.weight && <span>⚖️ {selectedPlayer.weight}</span>}
            </div>
            <div className="player-detail-price">
              价格: {selectedPlayer.price}
            </div>
            {!purchasedPlayers.some(p => p.id === selectedPlayer.id) && (
              <button
                className="PixelButton"
                onClick={() => {
                  handleBuyPlayer(selectedPlayer)
                  setSelectedPlayer(null)
                }}
                disabled={selectedPlayer.price > remainingBudget || purchasedPlayers.length >= NATIONAL_SQUAD_SIZE}
              >
                <span className="button-face" aria-hidden="true"></span>
                <span className="button-label">征召</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="recruitment-footer">
        <button className="PixelButton secondary-button" data-guide="recruitment-auto" onClick={handleAutoRecruit}>
          <span className="button-face" aria-hidden="true"></span>
          <span className="button-label">一键推荐</span>
        </button>
        <button className="PixelButton" data-guide="recruitment-confirm" onClick={handleConfirmRoster}>
          <span className="button-face" aria-hidden="true"></span>
          <span className="button-label">确认征召</span>
        </button>
      </div>
    </div>
  )
}
