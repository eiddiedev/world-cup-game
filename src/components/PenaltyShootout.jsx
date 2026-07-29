import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audioManager } from '../utils/audioManager.js'
import {
  captureFormalMatchRuntimeMoment,
  cancelFormalCoachDecision,
  clearShootoutPresentation,
  configureShootoutPresentation,
  createFormalCoachDecision,
  executeFormalCoachDecisionChoice,
  getRuntimeActorSnapshot,
  prepareFormalCoachDecision,
  withDecisionWatchdog,
} from '../services/happySeedMatchRuntime.js'
import { getTeamById } from '../data/teams.js'
import {
  getShootoutWinner,
  keeperPerspectiveDirection,
  pickAiKeeperZone,
  pickAiShooterZone,
  reconcileShootoutResult,
  resolveShootoutAttempt,
} from '../utils/penaltyShootout.js'
import { getKeeperTendency } from '../data/keeperTendencies.js'
import SpotlightTour from './SpotlightTour.jsx'
import { SPOTLIGHT_TOURS } from '../data/spotlightTours.js'
import '../styles/enginePenaltyShootout.css'

const DIRECTIONS = Object.freeze(['left', 'center', 'right'])
const DIRECTION_LABELS = Object.freeze({ left: '左侧', center: '中路', right: '右侧' })
const MATCH_PENALTY_CHOICES = Object.freeze({
  left: 'penalty_left',
  center: 'penalty_center',
  right: 'penalty_right',
})

const getPosition = (player) => player?.pos || player?.position
const zoneColumn = (zone = 'center-bottom') => String(zone).split('-')[0]
const lateralZone = (zone = 'center-bottom') => `${zoneColumn(zone)}-bottom`

function pickGoalkeeper(lineup = []) {
  return lineup.find((player) => getPosition(player) === 'GK') || lineup[0] || {}
}

function pickShooter(lineup = [], index = 0) {
  const candidates = lineup
    .filter((player) => getPosition(player) !== 'GK')
    .sort((left, right) => (
      Number(right.tec || right.rating || 70) + Number(right.att || 0)
      - Number(left.tec || left.rating || 70) - Number(left.att || 0)
    ))
  return candidates[index % Math.max(1, candidates.length)] || lineup[0] || {}
}

function directionFromSwipe(dx, dy) {
  if (Math.hypot(dx, dy) < 24) return null
  if (Math.abs(dx) < 32) return 'center'
  return dx < 0 ? 'left' : 'right'
}

function outcomeForAttempt(direction, result) {
  if (direction === 'center') {
    if (result.scored) return 'goal_panenka'
    return result.saved ? 'saved_panenka' : 'miss_panenka'
  }
  if (direction === 'left') {
    if (result.scored) return 'goal_placement'
    return result.saved ? 'saved_placement' : 'miss_post'
  }
  if (result.scored) return 'goal_power'
  return result.saved ? 'saved_power' : 'miss_wide_power'
}

function runtimeMomentForAttempt(side, shooterId) {
  const moment = captureFormalMatchRuntimeMoment({ allowPaused: true })
  const actors = getRuntimeActorSnapshot()
  if (!moment || !actors?.actors?.length) throw new Error('比赛引擎尚未准备好点球场景')
  const shooter = actors.actors.find((actor) => (
    actor.side === side && actor.playerId === shooterId && actor.state?.onPitch
  )) || actors.actors.find((actor) => side === actor.side && actor.state?.onPitch && !actor.isGoalkeeper)
  const opposingKeeper = actors.actors.find((actor) => (
    actor.side !== side && actor.state?.onPitch && actor.isGoalkeeper
  ))
  if (!shooter || !opposingKeeper) throw new Error('点球主罚球员或门将未进入 Runtime')

  return {
    ...moment,
    ownerRuntimeActorId: shooter.runtimeActorId,
    attackingSide: side,
    // 点球大战全程复用同一侧球门，避免双方轮次之间横穿整座球场。
    attackDirection: 1,
  }
}

function TeamScore({ name, flag, score, shots, side }) {
  const attempts = shots.filter((shot) => shot.team === side)
  return (
    <div className={`runtime-shootout-team is-${side}`}>
      <span className="runtime-shootout-team-name">
        {flag && <img src={flag} alt="" aria-hidden="true" />}
        <b>{name}</b>
      </span>
      <strong>{score}</strong>
      <div className="runtime-shootout-dots" aria-label={`${name}点球记录`}>
        {Array.from({ length: Math.max(5, attempts.length) }, (_, index) => {
          const shot = attempts[index]
          return <i aria-hidden="true" key={`${side}-${index}`} className={shot ? (shot.scored ? 'is-goal' : 'is-miss') : ''} />
        })}
      </div>
    </div>
  )
}

export default function PenaltyShootout({
  homeTeam,
  awayTeam,
  homeTeamId,
  awayTeamId,
  homeLineup = [],
  awayLineup = [],
  stabilityBonus = 0,
  gameMode = 'coach',
  onExit,
  onComplete,
}) {
  const [shots, setShots] = useState([])
  const [phase, setPhase] = useState('staging')
  const [decision, setDecision] = useState(null)
  const [feedback, setFeedback] = useState('球员正在走向点球点…')
  const [error, setError] = useState('')
  const pointerRef = useRef(null)
  const attemptKeyRef = useRef('')
  const presentationReadyRef = useRef(false)
  const timersRef = useRef([])
  const shotsRef = useRef([])
  const completeRef = useRef(onComplete)
  const homeFlag = getTeamById(homeTeamId)?.flag || ''
  const awayFlag = getTeamById(awayTeamId)?.flag || ''

  useEffect(() => { completeRef.current = onComplete }, [onComplete])
  useEffect(() => {
    document.body.dataset.engineShootout = 'true'
    return () => { delete document.body.dataset.engineShootout }
  }, [])
  useEffect(() => {
    // A naturally reached shootout (or the development shortcut) can start
    // while the last regulation decision is still settling. Clear that scene;
    // DecisionDirectorV3 will take over and freeze the scene during staging.
    // Pausing the whole Runtime here would also pause the staging animation.
    cancelFormalCoachDecision()
  }, [])
  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
    attemptKeyRef.current = ''
    cancelFormalCoachDecision()
    clearShootoutPresentation()
  }, [])

  const schedule = useCallback((callback, delay) => {
    const timer = window.setTimeout(callback, delay)
    timersRef.current.push(timer)
    return timer
  }, [])

  const homeTurn = shots.length % 2 === 0
  const homeKicks = shots.filter((shot) => shot.team === 'home').length
  const awayKicks = shots.filter((shot) => shot.team === 'away').length
  const homeScore = shots.filter((shot) => shot.team === 'home' && shot.scored).length
  const awayScore = shots.filter((shot) => shot.team === 'away' && shot.scored).length
  const round = Math.floor(shots.length / 2) + 1
  const shooter = homeTurn ? pickShooter(homeLineup, homeKicks) : pickShooter(awayLineup, awayKicks)
  const keeper = homeTurn ? pickGoalkeeper(awayLineup) : pickGoalkeeper(homeLineup)

  const scoreState = useMemo(() => ({
    red: homeScore,
    blue: awayScore,
  }), [awayScore, homeScore])

  useEffect(() => {
    if (phase !== 'staging') return undefined
    const attemptKey = `${shots.length}:${homeTurn ? 'red' : 'blue'}:${shooter.id || ''}`
    if (attemptKeyRef.current === attemptKey) return undefined
    attemptKeyRef.current = attemptKey
    let cancelled = false

    const stage = async () => {
      try {
        setError('')
        setFeedback(`${shooter.name || '主罚球员'}走向点球点…`)
        const side = homeTurn ? 'red' : 'blue'
        const nextDecision = createFormalCoachDecision(shots.length, {
          scenarioId: 'match_penalty',
          minute: 120,
          label: `点球大战第 ${round} 轮`,
          preferredPlayerId: shooter.id,
          authorityState: { score: scoreState },
          side,
          runtimeContext: 'shootout',
        })
        const presentation = {
          attackingSide: side,
          shooterPlayerId: shooter.id,
          goalSide: 'right',
        }
        // 首轮立即收起其余球员；后续轮次保留上一脚的构图，等正式点球
        // 导演完成新一轮摆位后再切换人物，避免短暂露出中圈站位。
        if (!presentationReadyRef.current) {
          configureShootoutPresentation(presentation)
          presentationReadyRef.current = true
        }
        const runtimeMoment = runtimeMomentForAttempt(side, shooter.id)
        // prepare() 会同步拉起 blackout，再异步完成摆位。先启动黑场，再切换
        // 新一轮可见角色，避免旧主罚者以“禁区外队员”身份短暂露出。
        const preparation = prepareFormalCoachDecision(nextDecision, runtimeMoment)
        configureShootoutPresentation(presentation)
        await withDecisionWatchdog(preparation)
        if (cancelled) return
        setDecision(nextDecision)
        setPhase('aim')
        setFeedback(homeTurn ? '选择射门方向' : '判断对手方向，指挥门将扑救')
      } catch (stageError) {
        if (cancelled) return
        console.error(stageError)
        setError(stageError.message || '点球场景加载失败')
        setFeedback('Runtime 点球场景未能就绪')
        setPhase('error')
      }
    }
    stage()
    return () => { cancelled = true }
  }, [homeTurn, phase, round, scoreState, shooter.id, shooter.name, shots.length])

  const finishAttempt = useCallback(async (selectedDirection) => {
    if (phase !== 'aim' || !decision || !DIRECTIONS.includes(selectedDirection)) return
    setPhase('executing')
    setFeedback('真实比赛引擎正在执行点球…')
    setError('')

    const shooterTec = Number(shooter?.tec || shooter?.rating || 70)
    const keeperDef = Number(keeper?.def || keeper?.rating || 70)
    let shooterZone
    let keeperZone
    let overpowered = false

    if (homeTurn) {
      shooterZone = `${selectedDirection}-bottom`
      keeperZone = lateralZone(pickAiKeeperZone(
        keeperDef,
        Math.random,
        getKeeperTendency(awayTeamId, awayTeam),
      ))
    } else {
      // 按门将面对主罚者时的自身左右解释按钮/滑动；从射手视角看
      // 左右正好相反，因此进入六区判定前需要翻转一次。
      keeperZone = `${keeperPerspectiveDirection(selectedDirection)}-bottom`
      const aiShot = pickAiShooterZone(shooterTec, Math.random)
      shooterZone = lateralZone(aiShot.zone)
      overpowered = aiShot.overpowered
    }

    const result = resolveShootoutAttempt({
      shooterZone,
      keeperZone,
      overpowered,
      shooterTec,
      keeperDef,
      stabilityBonus: homeTurn ? stabilityBonus : 0,
      random: Math.random,
    })
    const shotDirection = zoneColumn(shooterZone)
    const choiceId = MATCH_PENALTY_CHOICES[shotDirection]
    const outcomeOverride = outcomeForAttempt(shotDirection, result)

    try {
      audioManager.playSound('ballShot')
      const execution = executeFormalCoachDecisionChoice(decision, choiceId, {
        outcomeOverride,
        commitRuntimeGoal: false,
      })
      const settledResult = await withDecisionWatchdog(execution.settled)
      const liveResult = settledResult?.runtime?.snapshot?.liveResult
      const physicalResult = reconcileShootoutResult(result, liveResult)
      const shot = {
        round,
        team: homeTurn ? 'home' : 'away',
        shooterId: shooter?.id || null,
        shooterZone,
        keeperZone,
        ...physicalResult,
      }
      const nextShots = [...shotsRef.current, shot]
      shotsRef.current = nextShots
      setShots(nextShots)
      setDecision(null)
      setPhase('result')
      setFeedback(physicalResult.scored ? '命中！' : physicalResult.saved ? '扑出！' : '偏出！')
      audioManager.playSound(physicalResult.saved ? 'ballTouch' : 'whistle')

      // 结果在球越过门线或门将完成扑救的当帧反馈；导演随后用很短的
      // 收尾时间清理物理状态，但不再拖延比分、文案和哨声。
      await withDecisionWatchdog(execution.completed)

      const winner = getShootoutWinner(nextShots)
      if (winner) {
        schedule(() => {
          setPhase('done')
          setFeedback(winner === 'home' ? `${homeTeam}晋级！` : `${awayTeam}晋级！`)
          schedule(() => completeRef.current?.(winner, {
            homeScore: nextShots.filter((item) => item.team === 'home' && item.scored).length,
            awayScore: nextShots.filter((item) => item.team === 'away' && item.scored).length,
            shots: nextShots,
          }), 900)
        }, 700)
        return
      }

      schedule(() => {
        attemptKeyRef.current = ''
        setPhase('staging')
      }, 900)
    } catch (executionError) {
      console.error(executionError)
      cancelFormalCoachDecision()
      setError(executionError.message || '点球动作执行失败')
      setFeedback('Runtime 点球动作执行失败，请重试')
      setDecision(null)
      setPhase('error')
    }
  }, [
    awayTeam,
    awayTeamId,
    decision,
    homeTeam,
    homeTurn,
    keeper,
    phase,
    round,
    schedule,
    shooter,
    stabilityBonus,
  ])

  const handlePointerDown = (event) => {
    if (gameMode !== 'player' || phase !== 'aim') return
    event.preventDefault()
    pointerRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerUp = (event) => {
    if (gameMode !== 'player' || phase !== 'aim' || !pointerRef.current) return
    event.preventDefault()
    const direction = directionFromSwipe(
      event.clientX - pointerRef.current.x,
      event.clientY - pointerRef.current.y,
    )
    pointerRef.current = null
    if (direction) finishAttempt(direction)
  }

  const retryStage = () => {
    cancelFormalCoachDecision()
    attemptKeyRef.current = ''
    setDecision(null)
    setPhase('staging')
  }

  return (
    <div
      className={`engine-shootout is-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label="点球大战"
      data-runtime-scene="match_penalty"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerRef.current = null }}
    >
      {onExit && (
        <button type="button" className="runtime-shootout-exit" onClick={onExit}>
          退出测试
        </button>
      )}
      <header className="runtime-shootout-scoreboard" data-guide="penalty-scoreboard">
        <TeamScore name={homeTeam} flag={homeFlag} score={homeScore} shots={shots} side="home" />
        <div className="runtime-shootout-round">
          <small>点球大战</small>
          <strong>第 {round} 轮</strong>
        </div>
        <TeamScore name={awayTeam} flag={awayFlag} score={awayScore} shots={shots} side="away" />
      </header>

      <div className="runtime-shootout-prompt" role="status" data-guide="penalty-prompt">
        <strong>{homeTurn ? `${homeTeam}主罚` : `${awayTeam}主罚`}</strong>
        <span>{feedback}</span>
        <small>{shooter?.name || '罚球手'} · {keeper?.name || '门将'}</small>
      </div>

      {phase === 'aim' && gameMode === 'coach' && (
        <nav
          className="runtime-shootout-actions"
          aria-label={homeTurn ? '射门方向' : '扑救方向'}
          data-guide="penalty-actions"
        >
          {DIRECTIONS.map((direction) => {
            const matchChoice = decision?.choices?.find((choice) => (
              choice.id === MATCH_PENALTY_CHOICES[direction]
            ))
            return (
              <button type="button" key={direction} onClick={() => finishAttempt(direction)}>
                <strong>
                  {homeTurn && matchChoice
                    ? matchChoice.label
                    : `扑向${DIRECTION_LABELS[direction]}`}
                </strong>
                <span>
                  {homeTurn && matchChoice
                    ? matchChoice.desc
                    : direction === 'center' ? '保持中路' : '预判对手方向'}
                </span>
              </button>
            )
          })}
        </nav>
      )}

      {phase === 'aim' && gameMode === 'player' && (
        <div className="runtime-shootout-swipe-hint" data-guide="penalty-actions">
          <strong>{homeTurn ? '向射门方向滑动' : '向扑救方向滑动'}</strong>
          <span>左滑 · 直滑 · 右滑</span>
        </div>
      )}

      {phase === 'error' && (
        <button type="button" className="runtime-shootout-retry" onClick={retryStage}>重新装配点球场景</button>
      )}
      {error && <div className="runtime-shootout-error">{error}</div>}
      <SpotlightTour
        tour={SPOTLIGHT_TOURS.penalty}
        autoStart
        helpButtonClassName="spotlight-tour-help--shootout"
      />
    </div>
  )
}
