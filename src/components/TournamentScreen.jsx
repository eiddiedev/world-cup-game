import React, { useEffect, useMemo } from 'react'
import { getTeamById, getTeamFlag } from '../data/teams'
import { getTeamSchedule, KNOCKOUT_ROUNDS } from '../data/schedules'
import { generateKnockoutOpponents } from '../services/aiService'
import { getFallbackKnockoutOpponents, sanitizeKnockoutOpponents } from '../utils/knockoutResolver'

/**
 * 赛程页面
 * 展示世界杯赛程（小组赛→淘汰赛）
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
  'ivory_coast': '科特迪瓦', 'ecuador': '厄瓜多尔',
  'netherlands': '荷兰', 'tunisia': '突尼斯', 'sweden': '瑞典',
  'egypt': '埃及', 'iran': '伊朗', 'belgium': '比利时',
}

// 球队实力（用于模拟）
const TEAM_STRENGTH = {
  france: 95, brazil: 93, argentina: 92, portugal: 90,
  germany: 88, japan: 85, norway: 82, morocco: 80,
  newzealand: 75, curacao: 70,
  // 对手实力
  iraq: 65, senegal: 75, haiti: 60, scotland: 72,
  jordan: 62, austria: 74, algeria: 70, congo: 63,
  uzbekistan: 68, colombia: 78, ivory_coast: 73,
  ecuador: 76, netherlands: 85, tunisia: 69, sweden: 77,
  egypt: 71, iran: 72, belgium: 86,
}

// 同组对手映射（真实分组）
const GROUP_OPPONENTS = {
  france: ['norway', 'iraq', 'senegal'],
  brazil: ['morocco', 'haiti', 'scotland'],
  argentina: ['jordan', 'austria', 'algeria'],
  portugal: ['congo', 'uzbekistan', 'colombia'],
  germany: ['curacao', 'ivory_coast', 'ecuador'],
  japan: ['netherlands', 'tunisia', 'sweden'],
  norway: ['france', 'iraq', 'senegal'],
  morocco: ['brazil', 'haiti', 'scotland'],
  newzealand: ['egypt', 'iran', 'belgium'],
  curacao: ['germany', 'ecuador', 'ivory_coast'],
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
function simulateGroupStage(playerTeamId, playerMatchResults) {
  const opponents = GROUP_OPPONENTS[playerTeamId] || []
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
    name: id === playerTeamId ? null : (OPPONENT_ID_TO_NAME[id] || id),
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

  const advanced = groupFinished && playerRank <= 2
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
    if (saveData.currentRun?.knockoutOpponents?.r16) return

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
  }, [advanced, playerRank, saveData.currentRun?.teamId, saveData.currentRun?.knockoutOpponents?.r16, schedule, team])

  if (!team || !schedule) {
    return (
      <div className="screen tournament-screen">
        <div className="screen-header">
          <button className="back-button" onClick={() => navigateTo('home')}>←</button>
          <h1>世界杯赛程</h1>
        </div>
        <p>加载赛程中...</p>
      </div>
    )
  }

  // 进入排兵布阵
  const handlePrepareMatch = (roundIndex) => {
    updateSaveData({
      ...saveData,
      currentRun: {
        ...saveData.currentRun,
        matchIndex: roundIndex,
        stage: 'lineup',
        isKnockoutMatch: false,
        currentOpponent: groupMatches[roundIndex]?.opponent || '未知',
      },
    })
    navigateTo('lineup')
  }

  // 进入淘汰赛
  const handleKnockout = (roundId) => {
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
        <h1>世界杯赛程</h1>
      </div>

      {/* 球队信息 */}
      <div className="tournament-team-info">
        <img src={team.flag} alt={team.name} className="team-flag-img" />
        <span className="team-name">{team.name}</span>
        <span className="team-group">小组 {schedule.group}</span>
      </div>

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
                  <button className="PixelButton compact-button table-action-button" onClick={() => handlePrepareMatch(index)}>
                    <span className="button-face" aria-hidden="true"></span>
                    <span className="button-label">排兵布阵</span>
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
                {KNOCKOUT_ROUNDS.map((round) => {
                  const currentKnockoutRound = saveData.currentRun?.knockoutRound || 'r16'
                  const isCurrent = currentKnockoutRound === round.id

                  return (
                    <div key={round.id} className={`knockout-round ${isCurrent ? 'current' : ''}`}>
                      <span className="round-name">{round.name}</span>
                      <span className="round-opponent">VS {knockoutOpponents[round.id] || '待定'}</span>
                      {isCurrent && (
                        <button className="PixelButton compact-button table-action-button" onClick={() => handleKnockout(round.id)}>
                          <span className="button-face" aria-hidden="true"></span>
                          <span className="button-label">排兵布阵</span>
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
              <p>小组第{playerRank}名，未能进入16强</p>
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
