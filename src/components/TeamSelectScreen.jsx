import React, { useState } from 'react'
import { teams, getDifficultyStars } from '../data/teams'
import { getAvailableLogisticsBudget } from '../data/prizeMoney'
import { IS_INTERACTIVE_SPACE } from '../config/runtime'
import { createNewRun } from '../utils/saveManager.js'
import { autoSetupPlayerRun } from '../utils/playerModeSetup.js'
import AppointmentLetter from './AppointmentLetter'

/**
 * 国家队选择页面
 * 直接点击球队开启征程
 */
export default function TeamSelectScreen({ saveData, updateSaveData, navigateTo, showToast, gameMode = 'coach' }) {
  const [appointmentTeam, setAppointmentTeam] = useState(null)

  const unlockedTeams = teams.filter((t) =>
    saveData.unlockTeams.includes(t.id)
  )

  const handleSelectTeam = (team) => {
    if (gameMode === 'player') {
      const newRun = autoSetupPlayerRun(createNewRun(team.id, gameMode, saveData), saveData)
      updateSaveData({ ...saveData, currentRun: newRun })
      // 首次进入训练基地（已完成训练则直接到赛程）
      navigateTo(newRun.trainingCompleted ? 'tournament' : 'training')
      return
    }
    setAppointmentTeam(team)
  }

  const handleAppointmentConfirm = () => {
    const team = appointmentTeam
    setAppointmentTeam(null)
    const newRun = createNewRun(team.id, gameMode, saveData)
    updateSaveData({
      ...saveData,
      currentRun: newRun,
    })
    showToast(`${team.name}世界杯征程已开始！`)
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
          四档难度，完整世界杯征程。从三场小组赛一路打到决赛，选择你的意难平，改写结局。
        </p>
      </div>

      <div className={`team-list${IS_INTERACTIVE_SPACE ? ' is-demo-team-list' : ''}`} data-guide="team-list">
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
                  <span className="hover-info-label">小组赛对手</span>
                  <div className="hover-info-opponents">
                    {(team.groupOpponents || []).map((opponent) => (
                      <span className="hover-opponent" key={opponent.name}>
                        <img src={opponent.flag} alt="" className="hover-opponent-flag" />
                        {opponent.name}
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
                  <span className="hover-info-label">足协期望</span>
                  <div className="hover-info-star">
                    {team.faExpectation}
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
                  <span className="stat-label">世界杯目标</span>
                  <span className="stat-target">{team.worldCupTarget}</span>
                </div>
                {gameMode === 'coach' && (
                  <>
                    <div className="team-stat-row">
                      <span className="stat-label">征召点</span>
                      <span className="stat-budget">{team.budget}<img src="/assets/征召点.png" alt="征召点" className="coin-icon" /></span>
                    </div>
                    <div className="team-stat-row">
                      <span className="stat-label">后勤预算</span>
                      <span className="stat-budget logistics-budget">{getAvailableLogisticsBudget(team.id, saveData)}<img src="/assets/金币.png" alt="后勤预算" className="coin-icon" /></span>
                    </div>
                  </>
                )}
              </div>
              <div className="team-card-bottom">
                <div className="team-card-identity">
                  <img src={team.flag} alt={team.name} className="team-flag" />
                  <div className="team-identity-text">
                    <span className="team-name-cn">{team.name}</span>
                    <span className="team-name-en">{team.nameEn}</span>
                  </div>
                </div>
                <p className="team-card-flavor">
                  <span className="team-fa-message">{team.faMessage}</span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {appointmentTeam && (
        <AppointmentLetter
          team={appointmentTeam}
          onConfirm={handleAppointmentConfirm}
          onCancel={() => setAppointmentTeam(null)}
        />
      )}
    </div>
  )
}
