import React, { useState } from 'react'
import { getTeamById } from '../data/teams'

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
  const spentBudget = purchasedPlayers.reduce((sum, p) => sum + (p.price || 0), 0)
  const remainingBudget = totalBudget - spentBudget

  // 按位置分组
  const positionOrder = ['GK', 'DF', 'MF', 'FW']
  const positionNames = { GK: '门将', DF: '后卫', MF: '中场', FW: '前锋' }

  // 按位置筛选
  const filteredPlayers = availablePlayers.filter(p => p.position === activePosition)

  // 按价格排序（从高到低）
  const sortedPlayers = [...filteredPlayers].sort((a, b) => b.price - a.price)

  // 按位置统计已购球员
  const purchasedByPosition = positionOrder.reduce((acc, pos) => {
    acc[pos] = purchasedPlayers.filter(p => p.position === pos).length
    return acc
  }, {})

  const handleBuyPlayer = (player) => {
    if (purchasedPlayers.length >= 24) {
      showToast('阵容已满（24人）')
      return
    }
    if (player.price > remainingBudget) {
      showToast('预算不足')
      return
    }
    if (purchasedPlayers.some(p => p.id === player.id)) {
      showToast('该球员已在阵容中')
      return
    }
    setPurchasedPlayers([...purchasedPlayers, player])
    showToast(`已签下 ${player.name}`)
  }

  const handleSellPlayer = (player) => {
    setPurchasedPlayers(purchasedPlayers.filter((p) => p.id !== player.id))
    showToast(`已出售 ${player.name}`)
  }

  const handleConfirmRoster = () => {
    const hasGoalkeeper = purchasedPlayers.some((p) => p.position === 'GK')
    if (!hasGoalkeeper) {
      showToast('必须至少有1名门将')
      return
    }

    updateSaveData({
      ...saveData,
      currentRun: {
        ...saveData.currentRun,
        purchasedPlayerIds: purchasedPlayers,
        roster: purchasedPlayers, // 保存完整阵容
        matchIndex: 0, // 从第一场比赛开始
        stage: 'tournament',
      },
    })
    navigateTo('tournament')
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
          <h1>球员招募 - {team.name}</h1>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p className="recruitment-hint">
            超跑闪击，球王绝杀，金色卡面自带隐藏神技 ！但要小心预算空置与下半场的疲劳危机，是堆砌球星还是平衡深度？现在，行使你的主帅特权 ！
          </p>
        </div>

        <div className="recruitment-stats">
          <div className="stat-item">
            <span className="stat-label">预算</span>
            <span className="stat-value budget">{remainingBudget}<img src="/assets/金币.png" alt="金币" className="coin-icon" /></span>
          </div>
          <div className="stat-item">
            <span className="stat-label">已购</span>
            <span className="stat-value">{purchasedPlayers.length}/24</span>
          </div>
          {positionOrder.map(pos => (
            <div key={pos} className="stat-item">
              <span className="stat-label">{positionNames[pos]}</span>
              <span className="stat-value">{purchasedByPosition[pos]}</span>
            </div>
          ))}
        </div>

        <div className="position-tabs">
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
          sortedPlayers.map((player) => {
            const isPurchased = purchasedPlayers.some((p) => p.id === player.id)
            const ratingColor = player.rating >= 85 ? 'green' : player.rating >= 75 ? 'yellow' : 'red'
            return (
              <div
                key={player.id}
                className={`game-card-v2 ${player.isGolden ? 'golden' : ''} ${isPurchased ? 'purchased' : ''}`}
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
                    <img src="/assets/金币.png" className="coin-icon" alt="金币" />
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
                      出售
                    </button>
                  ) : (
                    <button
                      className="btn-v2-buy"
                      onClick={(e) => { e.stopPropagation(); handleBuyPlayer(player); }}
                      disabled={player.price > remainingBudget}
                    >
                      购买
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
                disabled={selectedPlayer.price > remainingBudget}
              >
                <span className="button-face" aria-hidden="true"></span>
                <span className="button-label">购买</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="recruitment-footer">
        <button className="PixelButton" onClick={handleConfirmRoster}>
          <span className="button-face" aria-hidden="true"></span>
          <span className="button-label">确认阵容</span>
        </button>
      </div>
    </div>
  )
}
