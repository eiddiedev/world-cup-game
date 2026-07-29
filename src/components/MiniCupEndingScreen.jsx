import React from 'react'
import { getTeamById } from '../data/teams.js'
import { createMiniCupRun } from '../utils/miniCup.js'
import '../styles/miniCup.css'

const TEAM_ENDINGS = {
  spain: {
    champion: '控球不再只是过程。你让斗牛士用耐心和锋芒重新站上世界之巅。',
    defeated: '传控仍然动人，只差最后一次穿透。重走来时路，答案仍在脚下。',
  },
  france: {
    champion: '天赋终于拧成一股绳。高卢雄鸡跨过更衣室与强敌，再次捧杯。',
    defeated: '天才们距离兑现只差一步。下一次，让所有锋芒指向同一个目标。',
  },
  argentina: {
    champion: '旧王的背影没有消失，新的蓝白军团用绝境反击守住了荣耀。',
    defeated: '卫冕之路停在这里，但潘帕斯的足球从不畏惧重新出发。',
  },
  england: {
    champion: '漫长等待在这一夜结束。三狮军团终于把期待写成了冠军。',
    defeated: '距离改写历史只差一场。那些未完成的期待，仍值得再战一次。',
  },
}

export default function MiniCupEndingScreen({ saveData, updateSaveData, navigateTo }) {
  const run = saveData.currentRun
  const team = getTeamById(run?.teamId)
  const champion = run?.miniCup?.status === 'champion'
  const copy = TEAM_ENDINGS[team?.id] || TEAM_ENDINGS.spain
  const matchCount = run?.knockoutResults?.length || 0

  const restart = () => {
    if (!team) {
      navigateTo('team-select')
      return
    }
    const nextRun = createMiniCupRun(team.id, run?.gameMode || 'coach', saveData)
    updateSaveData({ ...saveData, currentRun: nextRun })
    navigateTo('mini-cup-prep', { gameMode: run?.gameMode || 'coach' })
  }

  return (
    <main className={`screen mini-ending-screen${champion ? ' is-champion' : ''}`}>
      <section className="mini-ending-card PixelPanel">
        <div className="mini-ending-trophy" aria-hidden="true">
          {champion
            ? <img src="/assets/hud/world-cup-trophy.png" alt="" />
            : <span>◆</span>}
        </div>
        <small>{champion ? '四队迷你世界杯' : '本次征程结束'}</small>
        <h1>{champion ? '冠军！' : run?.knockoutRound === 'final' ? '决赛惜败' : '止步四强'}</h1>
        <div className="mini-ending-team">
          {team?.flag && <img src={team.flag} alt="" />}
          <b>{team?.name || '国家队'}</b>
        </div>
        <p>{champion ? copy.champion : copy.defeated}</p>
        <div className="mini-ending-summary">
          <span>完成比赛 <b>{matchCount}</b></span>
          <span>最终阵型 <b>{run?.formation || '4-3-3'}</b></span>
          <span>体验时长 <b>约 {matchCount * 2 + 1} 分钟</b></span>
        </div>
        <div className="mini-ending-actions">
          <button type="button" className="PixelButton" onClick={restart}>
            <span className="button-face" aria-hidden="true" />
            <span className="button-label">同队一键再战</span>
          </button>
          <button
            type="button"
            className="PixelButton secondary-button"
            onClick={() => {
              updateSaveData({ ...saveData, currentRun: null })
              navigateTo('team-select', { gameMode: run?.gameMode || 'coach' })
            }}
          >
            <span className="button-face" aria-hidden="true" />
            <span className="button-label">更换球队</span>
          </button>
        </div>
      </section>
    </main>
  )
}
