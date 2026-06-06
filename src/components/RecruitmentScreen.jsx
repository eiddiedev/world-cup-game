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

  // 属性图标映射
  const statIcons = {
    spd: '/assets/属性/速度.png',
    phy: '/assets/属性/身体.png',
    tec: '/assets/属性/技术.png',
    def: '/assets/属性/防守.png',
    sta: '/assets/属性/体能.png',
    status: '/assets/属性/状态.png',
  }

  // 绘制六维属性图（带属性图标）
  // 6个属性：速度、身体、技术、防守、体能、状态
  const renderHexagonChart = (player, size = 70) => {
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
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
      }
    })

    const bgPoints = stats.map((_, i) => {
      const angle = angleStep * i - Math.PI / 2
      return {
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
      }
    })

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
    const bgPathData = bgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

    // 属性图标位置（在六边形顶点外侧）
    const iconSize = size * 0.16
    const iconOffset = radius + iconSize * 0.3
    const iconPositions = stats.map((_, i) => {
      const angle = angleStep * i - Math.PI / 2
      return {
        x: center + iconOffset * Math.cos(angle) - iconSize / 2,
        y: center + iconOffset * Math.sin(angle) - iconSize / 2,
      }
    })

    // 扩大SVG viewBox以容纳图标
    const padding = iconSize * 1.2

    return (
      <svg width={size} height={size} viewBox={`${-padding} ${-padding} ${size + padding * 2} ${size + padding * 2}`}>
        {/* 背景六边形 */}
        <path d={bgPathData} fill="none" stroke="var(--pixel-shadow)" strokeWidth="1" opacity="0.3" />
        {/* 属性区域 */}
        <path d={pathData} fill="var(--pixel-gold)" fillOpacity="0.3" stroke="var(--pixel-gold)" strokeWidth="2" />
        {/* 中心点 */}
        <circle cx={center} cy={center} r="2" fill="var(--pixel-main)" />
        {/* 属性图标 */}
        {stats.map((stat, i) => (
          stat.icon ? (
            <image
              key={i}
              href={stat.icon}
              x={iconPositions[i].x}
              y={iconPositions[i].y}
              width={iconSize}
              height={iconSize}
            />
          ) : (
            <text
              key={i}
              x={center + iconOffset * Math.cos(angleStep * i - Math.PI / 2)}
              y={center + iconOffset * Math.sin(angleStep * i - Math.PI / 2)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={iconSize * 0.8}
              fill="var(--pixel-gold)"
            >
              ★
            </text>
          )
        ))}
      </svg>
    )
  }

  // 渲染属性条（带图标）
  const renderStatBar = (label, value, iconPath) => (
    <div className="stat-row">
      <img src={iconPath} alt={label} className="stat-icon" />
      <span className="stat-label">{label}</span>
      <div className="stat-bar-bg">
        <div className="stat-bar-fill" style={{ width: `${value}%` }}></div>
      </div>
      <span className="stat-value">{value}</span>
    </div>
  )

  return (
    <div className="screen recruitment-screen">
      <div className="screen-header">
        <button className="back-button" onClick={() => navigateTo('team-select')}>
          ←
        </button>
        <h1>球员招募 - {team.name}</h1>
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
                className={`game-card ${isPurchased ? 'purchased' : ''} ${player.isGolden ? 'golden' : ''}`}
                onClick={() => setSelectedPlayer(player)}
              >
                {/* 卡片上半部分：头像 */}
                <div className="game-card-portrait">
                  {player.avatar ? (
                    <img src={player.avatar} alt={player.name} />
                  ) : (
                    <div className="avatar-placeholder">{player.position}</div>
                  )}
                  <div className="card-number-badge">#{player.number || '?'}</div>
                  <div className={`card-rating-badge rating-${ratingColor}`}>{player.rating}</div>
                </div>

                {/* 卡片下半部分：信息 */}
                <div className="game-card-info">
                  <div className="card-name-row">
                    <h4 className="card-name">{player.name}</h4>
                    <span className="card-stars-display">{'★'.repeat(player.star)}</span>
                  </div>
                  <div className="card-chart-price">
                    <div className="card-chart">
                      {renderHexagonChart(player, 80)}
                    </div>
                    <div className="card-price">{player.price}<img src="/assets/金币.png" alt="金币" className="coin-icon-small" /></div>
                  </div>
                </div>

                {/* 购买/出售按钮 */}
                <div className="card-action">
                  {isPurchased ? (
                    <button
                      className="btn-card-sell"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSellPlayer(player)
                      }}
                    >
                      出售
                    </button>
                  ) : (
                    <button
                      className="btn-card-buy"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBuyPlayer(player)
                      }}
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
            <div className="player-detail-stats">
              {renderStatBar('速度', selectedPlayer.spd, statIcons.spd)}
              {renderStatBar('身体', selectedPlayer.phy, statIcons.phy)}
              {renderStatBar('技术', selectedPlayer.tec, statIcons.tec)}
              {renderStatBar('防守', selectedPlayer.def, statIcons.def)}
              {renderStatBar('体能', selectedPlayer.sta, statIcons.sta)}
              {renderStatBar('状态', selectedPlayer.form || 80, statIcons.status)}
              <div className="stat-row">
                <img src="/assets/星星.png" alt="关键时刻" className="stat-star-img" />
                <span className="stat-label">关键时刻</span>
                <span className="stat-stars">{'★'.repeat(selectedPlayer.star)}</span>
              </div>
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
