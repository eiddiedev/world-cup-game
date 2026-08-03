import React, { useState, useMemo } from 'react'
import { teams, getTeamById } from '../data/teams'
import {
  CODEX_ACHIEVEMENTS,
  getAchievementProgress,
  resultRank,
} from '../data/codexAchievements'
import { getCodexProgress } from '../utils/saveManager'
import { COMPETITION_BRAND } from '@competition-brand'
import '../styles/codex.css'

const TABS = [
  { id: 'teams', label: '国家档案' },
  { id: 'trophies', label: '奖杯陈列室' },
  { id: 'records', label: COMPETITION_BRAND.recordsLabel },
  { id: 'achievements', label: '成就' },
]

const TARGET_MAP = {
  '夺冠': 'champion',
  '四强': 'semifinal',
  '八强': 'quarterfinal',
  '16强': 'round16',
  '小组出线': 'round32',
  '争取首胜': 'group',
}

function isTargetMet(teamId, codex) {
  const team = getTeamById(teamId)
  if (!team) return false
  const target = TARGET_MAP[team.tournamentTarget] || 'group'
  const achieved = codex.teamResults?.[teamId]
  if (!achieved) return false
  return resultRank(achieved) >= resultRank(target)
}

const RECORD_LABELS = [
  { key: 'totalMatches', label: '总比赛场次', unit: '场' },
  { key: 'totalWins', label: '总胜场', unit: '场' },
  { key: 'totalGoals', label: '总进球', unit: '球' },
  { key: 'bestWinStreak', label: '最长连胜', unit: '场' },
  { key: 'bestCleanSheetStreak', label: '最长连续零封', unit: '场' },
  { key: 'mostGoalsInMatch', label: '单场最多进球', unit: '球' },
  { key: 'maxPenaltyRounds', label: '点球大战最多轮次', unit: '轮' },
  { key: 'fastestGoalMinute', label: '最快进球', unit: '分钟' },
  { key: 'hatTricks', label: '帽子戏法次数', unit: '次' },
  { key: 'penaltiesSaved', label: '扑出点球总数', unit: '个' },
]

const RESULT_LABELS = {
  champion: '冠军',
  finalist: '亚军',
  semifinal: '四强',
  quarterfinal: '八强',
  round16: '十六强',
  round32: '三十二强',
  group: '小组赛',
}

const RESULT_ICON = {
  champion: '★',
  finalist: '☆',
  semifinal: '◆',
  quarterfinal: '◇',
  round16: '○',
  round32: '△',
  group: '·',
}

export default function CodexScreen({ saveData, navigateTo }) {
  const [activeTab, setActiveTab] = useState('teams')
  const codex = saveData.codex || {}
  const progress = getCodexProgress(saveData)

  const runHistory = useMemo(() => {
    return [...(codex.runHistory || [])].reverse()
  }, [codex.runHistory])

  return (
    <div className="screen codex-screen">
      <header className="codex-header">
        <button className="back-button" onClick={() => navigateTo('home')}>
          ←
        </button>
        <div className="codex-title-row">
          <img src="/assets/图鉴.png" alt="" className="codex-header-icon" />
          <h1>图鉴</h1>
        </div>
        <span className="codex-progress-badge">
          {progress.done}/{progress.total} ({progress.percent}%)
        </span>
      </header>

      <nav className="codex-tabs" aria-label="图鉴分类">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`codex-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="codex-tab-content">
        {activeTab === 'teams' && <TeamsTab codex={codex} />}
        {activeTab === 'trophies' && <TrophiesTab runHistory={runHistory} />}
        {activeTab === 'records' && <RecordsTab records={codex.records || {}} />}
        {activeTab === 'achievements' && <AchievementsTab saveData={saveData} />}
      </div>
    </div>
  )
}

/* ---- Tab 1: 国家档案 ---- */
function TeamsTab({ codex }) {
  return (
    <div className="codex-team-grid">
      {teams.map((team) => {
        const met = isTargetMet(team.id, codex)
        const result = codex.teamResults?.[team.id]
        return (
          <div
            key={team.id}
            className={`codex-team-card ${met ? 'is-complete' : 'is-incomplete'}`}
          >
            <img src={team.flag} alt={team.name} className="codex-team-flag" />
            <span className="codex-team-name">{team.name}</span>
            <span className="codex-team-target">目标：{team.tournamentTarget}</span>
            {result ? (
              <span className="codex-team-result">
                {RESULT_ICON[result]} {RESULT_LABELS[result]}
              </span>
            ) : (
              <span className="codex-team-locked">未挑战</span>
            )}
            {met && <span className="codex-team-check">✓</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ---- Tab 2: 奖杯陈列室 ---- */
function TrophiesTab({ runHistory }) {
  // 只展示有实际成绩（非小组赛淘汰）且 teamId 有效的记录
  const filtered = runHistory.filter(
    (run) => run.teamId && getTeamById(run.teamId) && run.result && run.result !== 'group'
  )

  if (filtered.length === 0) {
    return (
      <div className="codex-empty">
        <span className="codex-empty-icon pixel-icon">★</span>
        <p>还没有征程记录</p>
        <small>{COMPETITION_BRAND.codexEmpty}</small>
      </div>
    )
  }

  return (
    <div className="codex-trophy-list">
      {filtered.map((run, i) => {
        const team = getTeamById(run.teamId)
        const date = run.date ? new Date(run.date).toLocaleDateString('zh-CN') : ''
        return (
          <div key={i} className="codex-trophy-item">
            <span className="trophy-icon pixel-icon">{RESULT_ICON[run.result] || '·'}</span>
            <img src={team.flag} alt="" className="trophy-flag" />
            <div className="trophy-info">
              <strong>{team.name}</strong>
              <span>{RESULT_LABELS[run.result] || run.result}</span>
            </div>
            <time className="trophy-date">{date}</time>
          </div>
        )
      })}
    </div>
  )
}

/* ---- Tab 3: 赛事记录 ---- */
function RecordsTab({ records }) {
  return (
    <div className="codex-record-list">
      {RECORD_LABELS.map(({ key, label, unit }) => {
        const value = records[key]
        const display = value === null || value === undefined || value === 0
          ? '--'
          : `${value}${unit}`
        return (
          <div key={key} className="codex-record-row">
            <span className="record-label">{label}</span>
            <span className={`record-value ${display === '--' ? 'is-empty' : ''}`}>
              {display}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ---- Tab 4: 成就 ---- */
function AchievementsTab({ saveData }) {
  return (
    <div className="codex-achievement-grid">
      {CODEX_ACHIEVEMENTS.map((achievement) => {
        const progress = getAchievementProgress(achievement, saveData)
        const maxTier = achievement.tiers ? achievement.tiers.length : 1
        const isUnlocked = progress >= maxTier
        return (
          <div
            key={achievement.id}
            className={`codex-achievement-card ${isUnlocked ? 'is-unlocked' : 'is-locked'}`}
          >
            <span className="achievement-icon pixel-icon">{achievement.icon}</span>
            <div className="achievement-info">
              <strong className="achievement-name">{achievement.name}</strong>
              <p className="achievement-desc">{achievement.desc}</p>
            </div>
            {achievement.tiers && (
              <div className="achievement-tiers">
                {achievement.tiers.map((tier, i) => (
                  <span
                    key={i}
                    className={`tier-dot ${progress > i ? 'is-filled' : ''}`}
                  />
                ))}
                <small>{progress}/{maxTier}</small>
              </div>
            )}
            {!isUnlocked && !achievement.tiers && <span className="achievement-lock">×</span>}
          </div>
        )
      })}
    </div>
  )
}
