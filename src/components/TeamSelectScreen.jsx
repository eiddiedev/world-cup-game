import React from 'react'
import { teams, getDifficultyStars } from '../data/teams'
import { createNewRun } from '../utils/saveManager'
import { IS_DOUYIN_DEMO } from '../config/runtime'

/**
 * 国家队选择页面
 * 直接点击球队开启征程
 */
export default function TeamSelectScreen({ saveData, updateSaveData, navigateTo, showToast }) {

  const unlockedTeams = teams.filter((t) =>
    saveData.unlockTeams.includes(t.id)
  )

  const handleSelectTeam = (team) => {
    const newRun = createNewRun(team.id)
    updateSaveData({
      ...saveData,
      currentRun: newRun,
    })
    showToast(`${team.name}征程已开始！`)
    navigateTo('recruitment', { skipRecruitmentGuard: true })
  }

  return (
    <div className="screen team-select-screen">
      <div className="screen-header">
        <button className="back-button" onClick={() => navigateTo('home')}>
          ←
        </button>
        <h1>选择国家队</h1>
      </div>

      <div style={{ textAlign: 'center' }}>
        <p className="team-select-hint">
          预算越高，阵容越豪华，难度星越多，挑战越大～留意小组对手和球队技能，选一支你想带上冠军之路的队伍吧！
        </p>
      </div>

      <div className={`team-list${IS_DOUYIN_DEMO ? ' is-demo-team-list' : ''}`}>
        {unlockedTeams.map((team) => (
          <div
            key={team.id}
            className={`team-card${team.lightColor ? ' team-card--light' : ''}`}
            onClick={() => handleSelectTeam(team)}
            style={{ borderColor: team.jerseyColor, '--team-color': team.jerseyColor }}
          >
            <div className="team-card-left">
              <div className="team-card-hover-info">
                <div className="hover-info-block">
                  <span className="hover-info-label">{team.group} 小组赛对手</span>
                  <div className="hover-info-opponents">
                    {team.groupOpponents?.map((opp) => (
                      <span key={opp.name} className="hover-opponent">
                        <img src={opp.flag} alt={opp.name} className="hover-opponent-flag" />
                        {opp.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="hover-info-block">
                  <span className="hover-info-label">特色技能</span>
                  <div className="hover-info-skill">
                    【{team.skill}】{team.skillEffect}
                  </div>
                </div>
                <div className="hover-info-block">
                  <span className="hover-info-label">金卡球星</span>
                  <div className="hover-info-star">
                    ⭐ {team.goldenStar} · {team.goldenStarPosition}
                  </div>
                </div>
              </div>
              <div className="team-card-logo-wrap">
                {team.logo && (
                  <img src={team.logo} alt={team.name + '队徽'} className="team-card-logo" />
                )}
              </div>
            </div>
            <div className="team-card-right">
              <div className="team-card-stats">
                <div className="team-stat-row">
                  <span className="stat-label">难度</span>
                  <span className="stat-stars">{getDifficultyStars(team.difficulty)}</span>
                </div>
                <div className="team-stat-row">
                  <span className="stat-label">预算</span>
                  <span className="stat-budget">{team.budget}<img src="/assets/金币.png" alt="金币" className="coin-icon" /></span>
                </div>
              </div>
              <div className="team-card-bottom">
                <div className="team-card-identity">
                  <img src={team.flag} alt={team.name} className="team-flag" />
                  <div className="team-identity-text">
                    <span className="team-name-cn">{team.name}</span>
                    <span className="team-name-en">{team.nameEn}</span>
                  </div>
                </div>
                <p className="team-card-flavor">{team.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
