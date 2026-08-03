import React, { useEffect, useMemo } from 'react'
import { getTeamById, getTeamFlag } from '../data/teams'
import { getTeamSchedule, KNOCKOUT_ROUNDS } from '../data/schedules'
import { generateKnockoutOpponents } from '../services/aiService'
import { getFallbackKnockoutOpponents, sanitizeKnockoutOpponents } from '../utils/knockoutResolver'
import { refreshPlayerLineup } from '../utils/playerModeSetup'
import { COMPETITION_BRAND } from '@competition-brand'

/**
 * 赛程页面
 * 展示赛事赛程（小组赛→淘汰赛）
 */

// 获取国旗图片组件
const FlagImg = ({ name, size = 18 }) => {
  const src = getTeamFlag(name)
  if (src) return <img src={src} alt="" className="inline-flag" style={{ width: size, height: size }} />
  return <span style={{ fontSize: size * 0.7 }}>🏳️</span>
}

// 对手ID到中文名映射
const OPPONENT_ID_TO_NAME = {
  'norway': '挪威', 'iraq': '伊拉克', 'senegal': '塞内加尔',
  'morocco': '摩洛哥', 'haiti': '海地', 'scotland': '苏格兰',
  'jordan': '约旦', 'austria': '奥地利', 'algeria': '阿尔及利亚',
  'congo': '刚果民主共和国', 'uzbekistan': '乌兹别克斯坦', 'colombia': '哥伦比亚',
  'ivory_coast': '科特迪瓦', 'ecuador': '厄瓜多尔', 'curacao': '库拉索',
  'netherlands': '荷兰', 'tunisia': '突尼斯', 'sweden': '瑞典',
  'egypt': '埃及', 'iran': '伊朗', 'belgium': '比利时',
  'spain': '西班牙', 'england': '英格兰', 'usa': '美国', 'canada': '加拿大',
  'mexico': '墨西哥', 'capeverde': '佛得角',
  'saudi': '沙特', 'uruguay': '乌拉圭', 'croatia': '克罗地亚', 'panama': '巴拿马',
  'ghana': '加纳', 'paraguay': '巴拉圭', 'australia': '澳大利亚', 'turkey': '土耳其',
  'bosnia': '波黑', 'qatar': '卡塔尔', 'switzerland': '瑞士',
  'south_africa': '南非', 'south_korea': '韩国', 'czech': '捷克',
  // 可玩球队作为对手时的名称映射
  'france': '法国', 'brazil': '巴西', 'germany': '德国', 'portugal': '葡萄牙',
  'argentina': '阿根廷', 'japan': '日本', 'newzealand': '新西兰',
}

// 球队实力（用于模拟）
// T1: 西班牙/法国  T2: 巴西/阿根廷/英格兰/葡萄牙
// T3: 德国/日本/挪威/摩洛哥  T4: 哥伦比亚/美国/墨西哥/加拿大
// T5: 佛得角/库拉索
const TEAM_STRENGTH = {
  spain: 98, france: 97,
  brazil: 94, argentina: 93, england: 92, portugal: 91,
  germany: 87, morocco: 84, norway: 81, japan: 79,
  colombia: 76, usa: 74, mexico: 73, canada: 71,
  capeverde: 64, curacao: 58,
  // 对手实力
  iraq: 65, senegal: 75, haiti: 60, scotland: 72,
  jordan: 62, austria: 74, algeria: 70, congo: 63,
  uzbekistan: 68, ivory_coast: 73,
  ecuador: 76, netherlands: 85, tunisia: 69, sweden: 77,
  egypt: 71, iran: 72, belgium: 86,
  saudi: 64, uruguay: 80, croatia: 82, panama: 66,
  ghana: 67, paraguay: 70, australia: 73, turkey: 76,
  bosnia: 71, qatar: 65, switzerland: 79,
  south_africa: 66, south_korea: 74, czech: 75,
}

function getScheduleOpponentId(match) {
  return getTeamById(match?.opponent)?.id || match?.opponent || 'unknown'
}

/**
 * 基于种子的伪随机数生成器
 * 保证相同输入产生相同输出
 */
function seededRandom(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * 模拟两支球队之间的比赛结果
 * @returns 'home_win' | 'draw' | 'away_win'
 */
function simulateMatch(homeStrength, awayStrength, seed) {
  const rand = seededRandom(seed)
  const diff = homeStrength - awayStrength
  const homeWinChance = Math.min(0.65, Math.max(0.30, 0.45 + diff * 0.006))
  const drawChance = 0.22

  const r = rand()
  if (r < homeWinChance) return 'home_win'
  if (r < homeWinChance + drawChance) return 'draw'
  return 'away_win'
}

/**
 * 模拟整个小组赛（保证结果一致性）
 * 所有6场比赛一起模拟，确保不会出现A赢B、B赢C、C赢A的矛盾
 */
// Exported for deterministic tournament-algorithm verification.
// eslint-disable-next-line react-refresh/only-export-components
export function simulateGroupStage(playerTeamId, playerMatchResults) {
  const opponents = (getTeamSchedule(playerTeamId)?.groupStage || []).map(getScheduleOpponentId)
  if (opponents.length !== 3) return { rank: 1, teams: [] }

  // 4支球队
  const allTeams = [playerTeamId, ...opponents]

  // 初始化积分
  const points = {}
  const goalsFor = {}
  const goalsAgainst = {}
  allTeams.forEach(t => {
    points[t] = 0
    goalsFor[t] = 0
    goalsAgainst[t] = 0
  })

  // 处理玩家的比赛结果（已知）
  playerMatchResults.forEach((result, i) => {
    const opponent = opponents[i]
    if (result === 'win') {
      points[playerTeamId] += 3
      goalsFor[playerTeamId] += 2
      goalsAgainst[playerTeamId] += 0
      goalsFor[opponent] += 0
      goalsAgainst[opponent] += 2
    } else if (result === 'draw') {
      points[playerTeamId] += 1
      points[opponent] += 1
      goalsFor[playerTeamId] += 1
      goalsAgainst[playerTeamId] += 1
      goalsFor[opponent] += 1
      goalsAgainst[opponent] += 1
    } else {
      points[opponent] += 3
      goalsFor[playerTeamId] += 0
      goalsAgainst[playerTeamId] += 2
      goalsFor[opponent] += 2
      goalsAgainst[opponent] += 0
    }
  })

  // 模拟对手之间的3场比赛（使用固定种子保证一致性）
  // 比赛: 对手1 vs 对手2, 对手1 vs 对手3, 对手2 vs 对手3
  const opponentMatches = [
    [opponents[0], opponents[1]],
    [opponents[0], opponents[2]],
    [opponents[1], opponents[2]],
  ]

  opponentMatches.forEach(([home, away], i) => {
    // 使用两支球队的名字生成唯一种子
    const seed = (home.charCodeAt(0) * 1000 + away.charCodeAt(0) * 100 + i * 10 + 42)
    const homeStrength = TEAM_STRENGTH[home] || 70
    const awayStrength = TEAM_STRENGTH[away] || 70

    const result = simulateMatch(homeStrength, awayStrength, seed)

    if (result === 'home_win') {
      points[home] += 3
      goalsFor[home] += 2
      goalsAgainst[home] += 0
      goalsFor[away] += 0
      goalsAgainst[away] += 2
    } else if (result === 'draw') {
      points[home] += 1
      points[away] += 1
      goalsFor[home] += 1
      goalsAgainst[home] += 1
      goalsFor[away] += 1
      goalsAgainst[away] += 1
    } else {
      points[away] += 3
      goalsFor[home] += 0
      goalsAgainst[home] += 2
      goalsFor[away] += 2
      goalsAgainst[away] += 0
    }
  })

  // 计算排名
  const teams = allTeams.map(id => ({
    id,
    points: points[id],
    goalDiff: goalsFor[id] - goalsAgainst[id],
    goalsFor: goalsFor[id],
    isPlayer: id === playerTeamId,
    name: id === playerTeamId ? null : (getTeamById(id)?.name || OPPONENT_ID_TO_NAME[id] || id),
  }))

  // 排序：积分 > 净胜球 > 进球数
  teams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    return b.goalsFor - a.goalsFor
  })

  const playerRank = teams.findIndex(t => t.isPlayer) + 1

  return { rank: playerRank, teams }
}

export default function TournamentScreen({ saveData, updateSaveData, navigateTo }) {
  const team = getTeamById(saveData.currentRun?.teamId)
  const schedule = getTeamSchedule(saveData.currentRun?.teamId)
  const matchIndex = saveData.currentRun?.matchIndex || 0

  const groupMatches = schedule?.groupStage || []
  const results = saveData.currentRun?.matchResults || []
  const groupPoints = results.reduce((sum, r) => {
    if (r === 'win') return sum + 3
    if (r === 'draw') return sum + 1
    return sum
  }, 0)

  const groupFinished = results.length >= 3

  // 计算排名（使用正确的算法）
  const { rank: playerRank, teams: groupTeams } = useMemo(() => {
    if (!groupFinished) return { rank: -1, teams: [] }
    return simulateGroupStage(saveData.currentRun?.teamId, results)
  }, [groupFinished, results, saveData.currentRun?.teamId])

  // 2026世界杯赛制：每组前2名直接出线，第3名根据积分概率出线（模拟“8个最好第3名”规则）
  const thirdPlaceAdvanceProb = { 4: 0.85, 3: 0.55, 2: 0.20, 1: 0.05, 0: 0 }
  const isThirdPlace = playerRank === 3
  const thirdPlaceAdvanced = isThirdPlace && (() => {
    // 使用确定性哈希保证同一存档结果一致
    const seed = String(saveData.currentRun?.teamId || '') + String(groupPoints) + String(results.join(''))
    let hash = 0
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
    const pseudoRandom = ((hash >>> 0) % 1000) / 1000
    return pseudoRandom < (thirdPlaceAdvanceProb[groupPoints] || 0)
  })()
  const advanced = groupFinished && (playerRank <= 2 || thirdPlaceAdvanced)
  const fallbackKnockoutOpponents = getFallbackKnockoutOpponents({
    teamId: saveData.currentRun?.teamId,
    teamName: team?.name,
    group: schedule?.group,
    playerRank,
  })
  const knockoutOpponents = sanitizeKnockoutOpponents(
    saveData.currentRun?.knockoutOpponents,
    fallbackKnockoutOpponents,
    team?.name,
  )

  useEffect(() => {
    if (!advanced || !team || !schedule) return
    if (saveData.currentRun?.knockoutOpponents?.r32) return

    let cancelled = false
    generateKnockoutOpponents({
      teamId: saveData.currentRun?.teamId,
      teamName: team.name,
      group: schedule.group,
      playerRank,
    }).then((resolved) => {
      if (cancelled) return
      updateSaveData({
        ...saveData,
        currentRun: {
          ...saveData.currentRun,
          knockoutOpponents: resolved,
        },
      })
    })

    return () => { cancelled = true }
  }, [advanced, playerRank, saveData.currentRun?.teamId, saveData.currentRun?.knockoutOpponents?.r32, schedule, team])

  if (!team || !schedule) {
    return (
      <div className="screen tournament-screen">
        <div className="screen-header">
          <button className="back-button" onClick={() => navigateTo('home')}>←</button>
          <h1>{COMPETITION_BRAND.scheduleTitle}</h1>
        </div>
        <p>加载赛程中...</p>
      </div>
    )
  }

  // 进入排兵布阵
  const handlePrepareMatch = (roundIndex) => {
    const isPlayerMode = saveData.currentRun?.gameMode === 'player'
    const opponentId = getScheduleOpponentId(groupMatches[roundIndex])
    if (isPlayerMode) {
      // 球员模式：自动刷新首发，跳过布阵页直接比赛
      const refreshed = refreshPlayerLineup(saveData.currentRun)
      updateSaveData({
        ...saveData,
        currentRun: {
          ...refreshed,
          matchIndex: roundIndex,
          stage: 'match',
          isKnockoutMatch: false,
          currentOpponent: opponentId,
        },
      })
      navigateTo('match')
      return
    }
    updateSaveData({
      ...saveData,
      currentRun: {
        ...saveData.currentRun,
        matchIndex: roundIndex,
        stage: 'lineup',
        isKnockoutMatch: false,
        currentOpponent: opponentId,
      },
    })
    navigateTo('lineup')
  }

  // 进入淘汰赛
  const handleKnockout = (roundId) => {
    const isPlayerMode = saveData.currentRun?.gameMode === 'player'
    if (isPlayerMode) {
      const refreshed = refreshPlayerLineup(saveData.currentRun)
      updateSaveData({
        ...saveData,
        currentRun: {
          ...refreshed,
          stage: 'match',
          knockoutRound: roundId,
          isKnockoutMatch: true,
          currentOpponent: knockoutOpponents[roundId] || '待定',
        },
      })
      navigateTo('match')
      return
    }
    updateSaveData({
      ...saveData,
      currentRun: {
        ...saveData.currentRun,
        stage: 'lineup',
        knockoutRound: roundId,
        isKnockoutMatch: true,
        currentOpponent: knockoutOpponents[roundId] || '待定',
      },
    })
    navigateTo('lineup')
  }

  return (
    <div className="screen tournament-screen">
      <div className="screen-header">
        <button className="back-button" onClick={() => navigateTo('home')}>←</button>
        <h1>{COMPETITION_BRAND.scheduleTitle}</h1>
      </div>

      {/* 球队信息 */}
      <div className="tournament-team-info">
        <img src={team.flag} alt={team.name} className="team-flag-img" />
        <span className="team-name">{team.name}</span>
        <span className="team-group">小组 {schedule.group}</span>
      </div>

      {/* 进度条 */}
      {(() => {
        const totalMatches = 8
        const knockoutRoundIndex = (() => {
          const round = saveData.currentRun?.knockoutRound
          if (round === 'r32') return 0
          if (round === 'r16') return 1
          if (round === 'qf') return 2
          if (round === 'sf') return 3
          if (round === 'final') return 4
          return -1
        })()
        const completedMatches = groupFinished
          ? 3 + (knockoutRoundIndex >= 0 ? knockoutRoundIndex + 1 : 0)
          : results.length
        const pct = Math.min(100, (completedMatches / totalMatches) * 100)
        return (
          <div style={{ padding: '8px 16px' }} data-guide="tournament-progress">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'Zpix, monospace', fontSize: 12, color: '#F3E3B4' }}>征程进度</span>
              <span style={{ fontFamily: 'Zpix, monospace', fontSize: 12, color: '#C99A2E' }}>{completedMatches}/{totalMatches} 场</span>
            </div>
            <div style={{
              width: '100%', height: 12, background: '#1B3764',
              border: '2px solid #2a4a7a', imageRendering: 'pixelated',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0,
                width: `${pct}%`, height: '100%',
                background: '#C99A2E',
                imageRendering: 'pixelated',
              }} />
            </div>
          </div>
        )
      })()}

      {/* 小组赛 */}
      <div className="group-stage">
        <h3>🏟️ 小组赛</h3>
        <div className="match-list">
          {groupMatches.map((match, index) => {
            const result = results[index]
            const isCurrent = index === matchIndex && !groupFinished
            const isCompleted = index < results.length

            return (
              <div
                key={index}
                className={`match-item ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
                data-guide={isCurrent ? 'tournament-current-match' : undefined}
              >
                <div className="match-info">
                  <span className="match-date">{match.date}</span>
                  <span className="match-opponent">
                    <img src={team.flag} alt={team.name} className="match-flag" />
                    {team.name}
                    <span className="vs-small">VS</span>
                    <FlagImg name={match.opponent} size={16} />
                    {OPPONENT_ID_TO_NAME[match.opponent] || match.opponent}
                  </span>
                  <span className={`strength-badge strength-${match.opponentStrength}`}>
                    实力：{match.opponentStrength === 'weak' ? '弱' : match.opponentStrength === 'medium' ? '中' : '强'}
                  </span>
                </div>

                {isCompleted && (
                  <div className={`match-result ${result}`}>
                    {result === 'win' ? 'W 胜' : result === 'draw' ? 'D 平' : 'L 负'}
                  </div>
                )}

                {isCurrent && (
                  <button className="table-action-button tournament-action-button" onClick={() => handlePrepareMatch(index)}>
                    {saveData.currentRun?.gameMode === 'player' ? '开始比赛' : '排兵布阵'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* 小组积分 */}
        {results.length > 0 && (
          <div className="group-standings">
            <span>积分: <strong>{groupPoints}</strong></span>
            <span>胜{results.filter(r => r === 'win').length} 平{results.filter(r => r === 'draw').length} 负{results.filter(r => r === 'loss').length}</span>
            {groupFinished && <span>小组第{playerRank}名</span>}
          </div>
        )}

        {/* 小组排名表 */}
        {groupFinished && groupTeams.length > 0 && (
          <div className="group-table">
            <h4>小组排名</h4>
            {groupTeams.map((t, i) => {
              const displayName = t.isPlayer ? team.name : t.name
              const flagSrc = t.isPlayer ? team.flag : getTeamFlag(displayName)

              return (
                <div key={t.id} className={`group-table-row ${t.isPlayer ? 'player-row' : ''}`}>
                  <span className="rank">{i + 1}</span>
                  {flagSrc ? <img src={flagSrc} alt="" className="inline-flag" style={{ width: 16, height: 16 }} /> : <span style={{ fontSize: 12 }}>🏳️</span>}
                  <span className="team-name">{displayName}</span>
                  <span className="points">{t.points}分</span>
                  <span className="goal-diff">{t.goalDiff > 0 ? '+' : ''}{t.goalDiff}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 淘汰赛 */}
      {groupFinished && (
        <div className="knockout-stage">
          <h3>🏆 淘汰赛</h3>
          {advanced ? (
            <>
              <div className="knockout-message">
                🎉 恭喜晋级！小组第{playerRank}名出线
              </div>
              <div className="knockout-bracket">
                {KNOCKOUT_ROUNDS.map((round, roundIndex) => {
                  const currentKnockoutRound = saveData.currentRun?.knockoutRound || 'r32'
                  const currentRoundIndex = KNOCKOUT_ROUNDS.findIndex(r => r.id === currentKnockoutRound)
                  const isCurrent = currentKnockoutRound === round.id
                  const isCompleted = roundIndex < currentRoundIndex
                  const isFuture = roundIndex > currentRoundIndex
                  // 只有已完成的轮次和当前轮次才显示对手，未来的轮次显示"？"
                  const opponentName = isFuture ? '？' : (knockoutOpponents[round.id] || '待定')
                  const opponentFlag = (!isFuture && opponentName !== '待定') ? getTeamFlag(opponentName) : null

                  return (
                    <div
                      key={round.id}
                      className={`knockout-round ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
                      data-guide={isCurrent ? 'tournament-current-match' : undefined}
                    >
                      <span className="round-name">{round.name}</span>
                      <span className="round-opponent">
                        VS {opponentFlag ? <img src={opponentFlag} alt="" className="inline-flag" style={{ width: 16, height: 16, marginRight: 4 }} /> : null}{opponentName}
                      </span>
                      {isCurrent && (
                        <button className="table-action-button tournament-action-button" onClick={() => handleKnockout(round.id)}>
                          {saveData.currentRun?.gameMode === 'player' ? '开始比赛' : '排兵布阵'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="eliminated-message">
              <p>😔 小组赛未能晋级</p>
              <p>小组第{playerRank}名，未能进入32强</p>
              <button
                className="PixelButton compact-button"
                onClick={() => {
                  updateSaveData({
                    ...saveData,
                    currentRun: {
                      ...saveData.currentRun,
                      stage: 'ending',
                      groupRank: playerRank,
                      isKnockoutMatch: false,
                    },
                  })
                  navigateTo('ending')
                }}
              >
                <span className="button-face" aria-hidden="true"></span>
                <span className="button-label">查看结局</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
