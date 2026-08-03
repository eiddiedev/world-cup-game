import React, { useMemo, useState } from 'react'
import { getTeamById } from '../data/teams.js'
import {
  MINI_CUP_FORMATIONS,
  MINI_CUP_SEMIFINALS,
  MINI_CUP_SUPPORTS,
  getMiniCupIntel,
  getMiniCupOpponentId,
  prepareMiniCupMatch,
} from '../utils/miniCup.js'
import '../styles/miniCup.css'
import { COMPETITION_BRAND } from '@competition-brand'

function TeamChip({ teamId, active = false, winner = false }) {
  const team = getTeamById(teamId)
  if (!team) return <span className="mini-team-chip">待定</span>
  return (
    <span className={`mini-team-chip${active ? ' is-active' : ''}${winner ? ' is-winner' : ''}`}>
      <img src={team.flag} alt="" />
      <b>{team.name}</b>
    </span>
  )
}

export default function MiniCupPrepScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const run = saveData.currentRun
  const team = getTeamById(run?.teamId)
  const opponentId = getMiniCupOpponentId(run)
  const opponent = getTeamById(opponentId)
  const intel = useMemo(() => getMiniCupIntel(opponentId), [opponentId])
  const [formation, setFormation] = useState(run?.formation || team?.defaultFormation || '4-3-3')
  const [supportId, setSupportId] = useState(run?.miniCup?.selectedSupport || '')
  const round = run?.miniCup?.round || 'sf'
  const isFinal = round === 'final'

  if (!run?.miniCup || !team || !opponent) {
    return (
      <main className="screen mini-cup-prep-screen mini-cup-empty">
        <p>迷你杯进度需要重新开始。</p>
        <button type="button" className="PixelButton" onClick={() => navigateTo('team-select')}>
          <span className="button-face" aria-hidden="true" />
          <span className="button-label">选择球队</span>
        </button>
      </main>
    )
  }

  const startMatch = () => {
    if (!supportId) {
      showToast('请先选择一项赛前支援')
      return
    }
    const preparedRun = prepareMiniCupMatch(run, { formation, supportId })
    updateSaveData({ ...saveData, currentRun: preparedRun })
    navigateTo('match')
  }

  return (
    <main className="screen mini-cup-prep-screen">
      <header className="mini-cup-header">
        <button type="button" className="back-button" onClick={() => navigateTo('home')}>←</button>
        <div>
          <small>{COMPETITION_BRAND.miniTournamentLabel} · {run.gameMode === 'player' ? '球员模式' : '教练模式'}</small>
          <h1>{isFinal ? '决赛备战' : '半决赛备战'}</h1>
        </div>
        <span className="mini-cup-timer">约 2 分钟</span>
      </header>

      <section className="mini-bracket PixelPanel" aria-label="四强对阵">
        {MINI_CUP_SEMIFINALS.map((pair) => {
          const isOther = !pair.includes(team.id)
          const simulatedWinner = isOther ? run.miniCup.otherSemifinalWinner : null
          return (
            <div className="mini-bracket-match" key={pair.join('-')}>
              <TeamChip teamId={pair[0]} active={pair.includes(team.id)} winner={simulatedWinner === pair[0]} />
              <span>VS</span>
              <TeamChip teamId={pair[1]} active={pair.includes(team.id)} winner={simulatedWinner === pair[1]} />
            </div>
          )
        })}
        {isFinal && (
          <div className="mini-final-line">
            <span>决赛</span>
            <TeamChip teamId={team.id} active />
            <b>VS</b>
            <TeamChip teamId={opponent.id} />
          </div>
        )}
      </section>

      <div className="mini-prep-grid">
        <section className="mini-opponent-panel PixelPanel">
          <div className="mini-section-heading">
            <span>本场对手</span>
            <strong>{isFinal ? '冠军战' : '四强战'}</strong>
          </div>
          <div className="mini-versus">
            <TeamChip teamId={team.id} active />
            <em>VS</em>
            <TeamChip teamId={opponent.id} />
          </div>
          <div className="mini-intel-card">
            <div><span>预计阵型</span><b>{intel.formation}</b></div>
            <div><span>实力评级</span><b>{intel.strength}</b></div>
            <p>{intel.gameModel}</p>
            <div className="mini-style-tags">
              {intel.styleTags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <p className="mini-team-skill">球队技能：{opponent.skill} · {opponent.skillEffect}</p>
          </div>
        </section>

        <section className="mini-plan-panel PixelPanel">
          <div className="mini-section-heading">
            <span>阵型选择</span>
            <strong>{formation}</strong>
          </div>
          <div className="mini-formation-grid">
            {MINI_CUP_FORMATIONS.map((candidate) => (
              <button
                type="button"
                key={candidate}
                className={candidate === formation ? 'is-active' : ''}
                onClick={() => setFormation(candidate)}
              >
                {candidate}
              </button>
            ))}
          </div>

          <div className="mini-section-heading mini-support-heading">
            <span>选择一项赛前支援</span>
            <strong>{supportId ? '已生效' : '待选择'}</strong>
          </div>
          <div className="mini-support-list">
            {MINI_CUP_SUPPORTS.map((support) => (
              <button
                type="button"
                key={support.id}
                className={`mini-support-card${supportId === support.id ? ' is-active' : ''}`}
                onClick={() => setSupportId(support.id)}
              >
                <img src={support.icon} alt="" />
                <span>
                  <b>{support.name}</b>
                  <small>{support.summary}</small>
                  <em>{support.detail}</em>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <footer className="mini-prep-footer">
        <p>名单与首发已自动推荐；阵型、支援、球队技能与临场决策都会进入比赛计算。</p>
        <button type="button" className="PixelButton mini-start-button" onClick={startMatch}>
          <span className="button-face" aria-hidden="true" />
          <span className="button-label">{isFinal ? '向冠军发起冲击' : '开始半决赛'}</span>
        </button>
      </footer>
    </main>
  )
}
