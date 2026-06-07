import React, { useEffect, useMemo, useRef, useState } from 'react'
import { audioManager } from '../utils/audioManager'
import {
  getShootoutWinner,
  resolveOpponentShootoutKick,
  resolveUserShootoutKick,
} from '../utils/penaltyShootout.js'
import AnimationEngine from './AnimationEngine'

const getPosition = player => player?.pos || player?.position

function pickGoalkeeper(lineup = []) {
  return lineup.find(player => getPosition(player) === 'GK') || lineup[0]
}

function pickShooter(lineup = [], index = 0) {
  const candidates = lineup
    .filter(player => getPosition(player) !== 'GK')
    .sort((a, b) => (
      (b.tec || b.rating || 70) + (b.att || 0)
      - (a.tec || a.rating || 70) - (a.att || 0)
    ))
  return candidates[index % Math.max(1, candidates.length)] || lineup[0]
}

export default function PenaltyShootout({
  homeTeam,
  awayTeam,
  homeTeamId,
  awayTeamId,
  homeLineup = [],
  awayLineup = [],
  homeFormation = '4-3-3',
  awayFormation = '4-3-3',
  onComplete,
}) {
  const animationRef = useRef(null)
  const completeTimerRef = useRef(null)
  const [shots, setShots] = useState([])
  const [isHomeTurn, setIsHomeTurn] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [finishedWinner, setFinishedWinner] = useState(null)

  const homeShots = shots.filter(shot => shot.team === 'home')
  const awayShots = shots.filter(shot => shot.team === 'away')
  const homeScore = homeShots.filter(shot => shot.scored).length
  const awayScore = awayShots.filter(shot => shot.scored).length
  const currentRound = Math.max(homeShots.length, awayShots.length) + 1
  const shooter = useMemo(() => (
    isHomeTurn
      ? pickShooter(homeLineup, homeShots.length)
      : pickShooter(awayLineup, awayShots.length)
  ), [awayLineup, awayShots.length, homeLineup, homeShots.length, isHomeTurn])
  const goalkeeper = useMemo(() => (
    isHomeTurn ? pickGoalkeeper(awayLineup) : pickGoalkeeper(homeLineup)
  ), [awayLineup, homeLineup, isHomeTurn])

  useEffect(() => () => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
  }, [])

  useEffect(() => {
    if (!shooter || !goalkeeper || finishedWinner) return
    animationRef.current?.preparePenalty({
      shooterTeam: isHomeTurn ? 'my' : 'opponent',
      shooterName: shooter.name,
      goalkeeperName: goalkeeper.name,
    })
  }, [finishedWinner, goalkeeper, isHomeTurn, shooter])

  const finishTurn = async (choiceDirection) => {
    if (isAnimating || finishedWinner || !shooter || !goalkeeper) return
    setIsAnimating(true)
    setLastResult(null)
    const result = isHomeTurn
      ? resolveUserShootoutKick(choiceDirection)
      : resolveOpponentShootoutKick(choiceDirection)
    const shot = {
      round: currentRound,
      team: isHomeTurn ? 'home' : 'away',
      ...result,
    }

    await animationRef.current?.playPenaltyKick({
      shooterTeam: isHomeTurn ? 'my' : 'opponent',
      shooterName: shooter.name,
      goalkeeperName: goalkeeper.name,
      ...result,
    })

    if (result.missed) audioManager.playSound('whistle')

    const nextShots = [...shots, shot]
    const winner = getShootoutWinner(nextShots)
    setShots(nextShots)
    setLastResult({
      ...shot,
      text: result.scored
        ? `${shooter.number || '?'}号罚进！`
        : result.saved
          ? `${goalkeeper.number || 1}号判断正确，扑出点球！`
          : `${shooter.number || '?'}号射偏！`,
    })

    if (winner) {
      setFinishedWinner(winner)
      completeTimerRef.current = setTimeout(() => onComplete(winner), 1500)
    } else {
      setIsHomeTurn(turn => !turn)
    }
    setIsAnimating(false)
  }

  const roundCount = Math.max(5, currentRound)

  return (
    <div className="penalty-screen" role="dialog" aria-label="点球大战">
      <div className="penalty-stage">
        <div className="penalty-pitch">
          <AnimationEngine
            ref={animationRef}
            myLineup={homeLineup}
            opponentLineup={awayLineup}
            formation={homeFormation}
            opponentFormation={awayFormation}
            myTeam={homeTeamId}
            opponentTeam={awayTeamId}
            width={780}
            height={480}
            ambientEnabled={false}
            onGoalEffect={() => audioManager.playGoal()}
            onOpponentGoalEffect={() => audioManager.playSound('opponentGoal')}
            onSaveEffect={() => audioManager.playSave()}
          />
        </div>

        <aside className="penalty-sidebar">
          <header className="penalty-header">
            <h2>点球大战</h2>
            <div className="penalty-score">
              <span>{homeTeam}</span>
              <strong>{homeScore} : {awayScore}</strong>
              <span>{awayTeam}</span>
            </div>
          </header>

          <div className="penalty-rounds">
            {Array.from({ length: roundCount }, (_, index) => index + 1).map(round => {
              const homeShot = shots.find(shot => shot.round === round && shot.team === 'home')
              const awayShot = shots.find(shot => shot.round === round && shot.team === 'away')
              return (
                <div key={round} className="penalty-round">
                  <span>{round}</span>
                  <span className={homeShot ? (homeShot.scored ? 'goal' : 'miss') : ''}>
                    {homeShot ? (homeShot.scored ? '进' : '失') : '·'}
                  </span>
                  <span className={awayShot ? (awayShot.scored ? 'goal' : 'miss') : ''}>
                    {awayShot ? (awayShot.scored ? '进' : '失') : '·'}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="penalty-controls">
            <div className="penalty-turn">
              <strong>{isHomeTurn ? '本方主罚' : '控制门将'}</strong>
              <span>
                {isHomeTurn
                  ? `${shooter?.number || '?'}号选择射门方向`
                  : `对手方向不可见，控制${goalkeeper?.number || 1}号扑救`}
              </span>
            </div>
            {lastResult && <div className="penalty-last-result">{lastResult.text}</div>}
            {!finishedWinner && (
              <div className="penalty-directions">
                <button disabled={isAnimating} onClick={() => finishTurn('left')}>
                  ← {isHomeTurn ? '射左侧' : '扑左侧'}
                </button>
                <button disabled={isAnimating} onClick={() => finishTurn('center')}>
                  ↑ {isHomeTurn ? '射中路' : '守中路'}
                </button>
                <button disabled={isAnimating} onClick={() => finishTurn('right')}>
                  {isHomeTurn ? '射右侧' : '扑右侧'} →
                </button>
              </div>
            )}
            {finishedWinner && (
              <div className="penalty-winner">
                {finishedWinner === 'home' ? `${homeTeam}晋级！` : `${awayTeam}晋级`}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
