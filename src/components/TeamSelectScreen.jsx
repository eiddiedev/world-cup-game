import React from 'react'
import { teams, getDifficultyStars } from '../data/teams'
import { createNewRun } from '../utils/saveManager'

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
    navigateTo('recruitment')
  }

  return (
    <div className="screen team-select-screen">
      <div className="screen-header">
        <button className="back-button" onClick={() => navigateTo('home')}>
          ←
        </button>
        <h1>选择国家队</h1>
      </div>

      <div className="team-list">
        {unlockedTeams.map((team) => (
          <div
            key={team.id}
            className="team-card"
            onClick={() => handleSelectTeam(team)}
            style={{ borderColor: team.jerseyColor }}
          >
            <div className="team-card-header">
              <img src={team.flag} alt={team.name} className="team-flag" />
              <div className="team-info">
                <div className="team-name-row">
                  <h3 className="team-name">{team.name}</h3>
                  <span className="team-skill-tag">{team.skill}</span>
                </div>
                <div className="team-header-meta">
                  <span className="difficulty-label">难度</span>
                  <span className="difficulty-stars">{getDifficultyStars(team.difficulty)}</span>
                </div>
              </div>
            </div>
            <div className="team-card-body">
              <p className="team-quote">{team.description}</p>
              <div className="team-meta">
                <div className="team-budget">
                  <span className="budget-label">预算</span>
                  <span className="budget-value">{team.budget}<img src="/assets/金币.png" alt="金币" className="coin-icon" /></span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
