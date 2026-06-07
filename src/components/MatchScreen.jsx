import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getTeamById, getTeamFlag } from '../data/teams'
import { generateOpponentTeam } from '../utils/matchEngine'
import {
  selectScenario,
  executeDecision,
  outcomeConcedesPenalty,
  outcomeWinsPenalty,
  resolveDiveChoice,
  resolveMatchPenaltyChoice,
  resolveOpponentPenaltyChoice,
  resolveChoiceResult,
  shouldTriggerDecision,
} from '../utils/decisionSystem'
import { getScenarioById } from '../data/decisionLibrary'
import { createOpeningCommentary, generateCommentaryEvent, generateRandomMatchEvent } from '../utils/commentaryEngine'
import { buildAnimationActors, createVisualEvent } from '../utils/matchVisuals.js'
import { calculateLineupRatings, calculateOpponentAttackRating, calculateOpponentPressure } from '../utils/lineupBalance.js'
import {
  getOpponentMatchSetup,
  resolveOpponentStrength,
} from '../utils/opponentTactics.js'
import { getTeamDefaultFormation } from '../data/teamFormations.js'
import { audioManager } from '../utils/audioManager.js'
import { getFittedLandscapePitchSize } from '../utils/pitchRendering.js'
import { getMatchEventVisual } from '../utils/matchEventVisuals.js'
import { appendCommentaryEntry, openChainedDecision } from '../utils/commentaryTimeline.js'
import { getNextMatchSpeed } from '../utils/liveMatchSimulation.js'
import { getMatchBench, swapMatchPlayer } from '../utils/substitution.js'
import PenaltyShootout from './PenaltyShootout'
import AnimationEngine from './AnimationEngine'

const createEmptyMatchStats = () => ({
  myShots: 0,
  oppShots: 0,
  myShotsOnTarget: 0,
  oppShotsOnTarget: 0,
  myXG: 0,
  oppXG: 0,
  myPossession: 50,
  fouls: 0,
  yellowCards: 0,
  redCards: 0,
  penalties: 0,
  corners: 0,
})

const getIncidentKey = (incident) => {
  const playerKey = incident.teamSide === 'my' && incident.playerId
    ? incident.playerId
    : `${incident.playerName || incident.text || 'unknown'}-${incident.playerNumber || ''}`
  return `${incident.teamSide || 'unknown'}:${playerKey}`
}

const appendUniqueIncident = (list, incident) => {
  const key = getIncidentKey(incident)
  if (list.some(item => getIncidentKey(item) === key)) return list
  return [...list, incident]
}

const pickOutfield = (players) => {
  const outfield = players.filter(p => (p.pos || p.position) !== 'GK')
  return outfield[Math.floor(Math.random() * outfield.length)] || players[0]
}

const OPPONENT_SHOT_OUTCOMES = new Set([
  'goal_against',
  'counter_sealed',
  'counter_golden_goal',
  'opponent_shoots',
  'gk_reaction_save',
  'goal_chip_over',
  'goal_corner',
  'goal_saved_post',
  'goal_tight_angle',
  'solo_against_gk',
  'lost_runner_chance',
  'goal_zone_gap',
  'offside_fail_solo',
  'saved_freekick_against',
  'keeper_save_freekick',
  'miss_over_against',
  'opponent_header_saved',
  'blocked_second_ball',
])

const isOpponentShotOutcome = (outcome = '') => (
  outcome.startsWith('opponent_goal')
  || OPPONENT_SHOT_OUTCOMES.has(outcome)
)

const getShotXG = (outcome = '', successProb = 0.5) => {
  if (outcome.includes('penalty')) return 0.76
  if (outcome.includes('long')) return 0.08
  if (outcome.includes('freekick')) return 0.12
  if (outcome.includes('header')) return 0.20
  if (outcome.includes('chip')) return 0.32
  if (outcome.includes('near') || outcome.includes('close') || outcome.includes('tap_in')) return 0.42
  return Math.min(0.48, Math.max(0.10, successProb * 0.48))
}

/**
 * 比赛页面 — 决策弹窗 + 弹幕事件 + 换人系统 + 体力事件
 */
export default function MatchScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const team = getTeamById(saveData.currentRun?.teamId)
  const fullRoster = saveData.currentRun?.roster || saveData.currentRun?.purchasedPlayerIds || []
  const injuredSet = new Set(saveData.currentRun?.injuredPlayers || [])
  const suspendedSet = new Set(saveData.currentRun?.suspendedPlayers || [])
  const lineup = (saveData.currentRun?.lineup || []).filter(p => !injuredSet.has(p.id) && !suspendedSet.has(p.id))
  const formation = saveData.currentRun?.formation
    || getTeamDefaultFormation(saveData.currentRun?.teamId)
  const opponentName = saveData.currentRun?.currentOpponent || '未知对手'

  const [matchTime, setMatchTime] = useState(0)
  const matchTimeRef = useRef(0)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [, setEvents] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [matchSpeed, setMatchSpeed] = useState(1)
  const [showPenalty, setShowPenalty] = useState(false)

  // 决策状态
  const [currentDecision, setCurrentDecision] = useState(null)
  const [decisionResult, setDecisionResult] = useState(null)
  const [fieldDecisionMessage, setFieldDecisionMessage] = useState(null)

  // 弹幕
  const [danmaku, setDanmaku] = useState([])
  const danmakuId = useRef(0)
  const commentaryRef = useRef(null)

  // 换人
  const [showSubModal, setShowSubModal] = useState(false)
  const [substitutionsLeft, setSubstitutionsLeft] = useState(3)
  const [draggedBenchId, setDraggedBenchId] = useState(null)
  const [, setSubEvents] = useState([]) // 换人记录

  // 比赛统计
  const matchStatsRef = useRef(createEmptyMatchStats())
  const matchRedCardsRef = useRef([])
  const [redCardedPlayerIds, setRedCardedPlayerIds] = useState([])
  const matchInjuriesRef = useRef([])
  const matchDecisionsRef = useRef([])

  // 体力事件
  const [staminaEvent, setStaminaEvent] = useState(null)
  const [subBonus, setSubBonus] = useState(0) // 换人带来的胜率修正

  // 通知
  const [notification, setNotification] = useState(null)

  const animRef = useRef(null)
  const canvasHostRef = useRef(null)
  const ambientAnimationRef = useRef(Promise.resolve())
  const triggeredRef = useRef({ first: 0, second: 0 })
  const lastDecisionMinuteRef = useRef(-99)
  const currentLineupRef = useRef([...lineup])
  const [currentLineup, setCurrentLineup] = useState([...lineup])
  const unavailableSubIds = [
    ...injuredSet,
    ...suspendedSet,
    ...redCardedPlayerIds,
  ]
  const benchPlayers = getMatchBench(fullRoster, currentLineup, unavailableSubIds)
  const allNonStarters = getMatchBench(fullRoster, currentLineup)

  // 球员状态（体力值）
  const [playerStamina, setPlayerStamina] = useState(() => {
    const map = {}
    lineup.forEach(p => { map[p.id] = p.sta || 80 })
    return map
  })

  // 对手（根据赛程获取对手强度）
  const opponentTeam = getTeamById(opponentName)
  const opponentStrength = resolveOpponentStrength(
    saveData.currentRun?.teamId,
    opponentName,
    opponentTeam,
  )
  const opponentSetup = getOpponentMatchSetup(opponentName, opponentTeam, opponentStrength)
  const [opponentPlayers, setOpponentPlayers] = useState(() => {
    if (opponentTeam) return generateOpponentTeam(opponentName, opponentTeam, opponentStrength)
    return generateOpponentTeam(opponentName, { name: opponentName }, opponentStrength)
  })

  // 画布尺寸：读取左侧真实空间，完整显示原生 3:2 横向球场。
  const [canvasSize, setCanvasSize] = useState({ width: 720, height: 480 })
  useEffect(() => {
    const updateSize = () => {
      const host = canvasHostRef.current
      if (!host) return
      const rect = host.getBoundingClientRect()
      const nextSize = getFittedLandscapePitchSize(
        Math.max(300, rect.width),
        Math.max(200, rect.height),
      )
      setCanvasSize(previous => (
        previous.width === nextSize.width && previous.height === nextSize.height
          ? previous
          : nextSize
      ))
    }
    const observer = new ResizeObserver(updateSize)
    if (canvasHostRef.current) observer.observe(canvasHostRef.current)
    const frame = requestAnimationFrame(updateSize)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  // 添加弹幕（保留在列表中，不自动消失）
  const addDanmaku = useCallback((text, color = 'var(--pixel-bg)') => {
    const id = danmakuId.current++
    setDanmaku(prev => appendCommentaryEntry(prev, {
      id,
      text,
      color,
      createdAt: Date.now(),
    }))
  }, [])

  useEffect(() => {
    const panel = commentaryRef.current
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [danmaku])

  // 比赛时钟 + 体力消耗 + 随机事件
  useEffect(() => {
    if (!isPlaying || currentDecision || showSubModal) return
    const interval = setInterval(() => {
      if (matchTimeRef.current >= 90) {
        setIsPlaying(false)
        return
      }
      const next = matchTimeRef.current + 1
      matchTimeRef.current = next
      setMatchTime(next)

      // 每10分钟消耗体力（半场约掉5-8点，全场约掉10-16点）
      if (next % 10 === 0) {
        setPlayerStamina(prevStamina => {
          const newStamina = { ...prevStamina }
          currentLineupRef.current.forEach(p => {
            if ((p.pos || p.position) !== 'GK') {
              const loss = Math.floor(Math.random() * 2) + 1 // 1-2点
              newStamina[p.id] = Math.max(35, (newStamina[p.id] || 80) - loss)
            }
          })
          return newStamina
        })
      }

      // 随机弹幕事件（每3-6分钟一次）
      if (next > 3 && next % (3 + Math.floor(Math.random() * 4)) === 0) {
        generateRandomEvent(next)
      }

      // 对手自然进攻：阵容越失衡、越缺真正后卫，对手越容易获得射门。
      if (next >= 12 && next % 6 === 0) {
        maybeGenerateOpponentChance(next)
      }
    }, Math.max(80, 500 / matchSpeed))
    return () => clearInterval(interval)
  }, [isPlaying, currentDecision, showSubModal, matchSpeed])

  // 体力事件检测（体力低于30的球员触发，概率降低）
  useEffect(() => {
    if (!isPlaying || currentDecision || staminaEvent) return
    if (matchTime < 60) return // 60分钟前不触发体力事件
    const lineup_now = currentLineupRef.current
    for (const p of lineup_now) {
      if ((p.pos || p.position) === 'GK') continue
      const sta = playerStamina[p.id]
      if (sta && sta < 30 && Math.random() < 0.15) {
        setStaminaEvent({
          player: p,
          message: (p.pos || p.position) === 'DF' ? `${p.name}体力不支，防守覆盖面大幅下降！`
            : (p.pos || p.position) === 'MF' ? `${p.name}跑不动了，中场控制力减弱！`
            : `${p.name}体力透支，进攻威胁大减！`,
          posType: p.pos,
        })
        break
      }
    }
  }, [matchTime, isPlaying, currentDecision, playerStamina, staminaEvent])

  // 随机事件（混合常规播报和比赛事件：犯规/牌/角球/边线球等）
  const generateRandomEvent = (minute) => {
    const myPlayers = currentLineupRef.current
    const oppPlayers = opponentPlayers
    // 60%概率生成比赛事件（犯规、角球等），40%常规播报
    const useMatchEvent = Math.random() < 0.60
    if (useMatchEvent) {
      const ev = generateRandomMatchEvent(minute, myPlayers, oppPlayers)
      if (ev.type === 'red_card' && matchRedCardsRef.current.some(card => getIncidentKey(card) === getIncidentKey(ev))) {
        return
      }
      if (ev.type === 'injury' && matchInjuriesRef.current.some(injury => getIncidentKey(injury) === getIncidentKey(ev))) {
        return
      }
      addDanmaku(ev.text, ev.color)
      if (animRef.current) {
        ambientAnimationRef.current = animRef.current.playAmbientEvent(createVisualEvent(ev, myPlayers, oppPlayers))
      }
      setEvents(prev => [...prev, { minute, text: ev.text }])
      // 更新比赛统计
      if (ev.statsUpdate) {
        const stats = matchStatsRef.current
        if (ev.statsUpdate.fouls) stats.fouls += ev.statsUpdate.fouls
        if (ev.statsUpdate.yellowCards) stats.yellowCards += ev.statsUpdate.yellowCards
        if (ev.statsUpdate.redCards) stats.redCards += ev.statsUpdate.redCards
        if (ev.statsUpdate.corners) stats.corners += ev.statsUpdate.corners
      }
      if (ev.statsUpdate?.yellowCards || ev.statsUpdate?.redCards || ev.type === 'yellow_card' || ev.type === 'red_card') {
        audioManager.playSound('card')
        audioManager.vibrate(28)
      }
      if (ev.type === 'red_card') {
        matchRedCardsRef.current = appendUniqueIncident(
          matchRedCardsRef.current,
          {
            playerId: ev.teamSide === 'my' ? ev.playerId : null,
            playerName: ev.playerName,
            playerNumber: ev.playerNumber,
            text: `${ev.playerName || '球员'}被红牌罚下`,
            teamSide: ev.teamSide,
          },
        )
        if (ev.teamSide === 'my' && ev.playerId) {
          setRedCardedPlayerIds(ids => ids.includes(ev.playerId) ? ids : [...ids, ev.playerId])
          const reducedLineup = currentLineupRef.current.filter(player => player.id !== ev.playerId)
          if (reducedLineup.length > 0) {
            currentLineupRef.current = reducedLineup
            setCurrentLineup(reducedLineup)
          }
        } else if (ev.teamSide === 'opponent' && ev.playerId) {
          setOpponentPlayers(players => players.filter(player => player.id !== ev.playerId))
        }
      }
      if (ev.type === 'injury') {
        matchInjuriesRef.current = appendUniqueIncident(
          matchInjuriesRef.current,
          {
            playerId: ev.teamSide === 'my' ? ev.playerId : null,
            playerName: ev.playerName,
            playerNumber: ev.playerNumber,
            text: `${ev.playerName || '球员'}受伤离场`,
            teamSide: ev.teamSide,
          },
        )
      }
    } else {
      const ev = generateCommentaryEvent(minute, myPlayers.filter(p => (p.pos || p.position) !== 'GK'), oppPlayers.filter(p => (p.pos || p.position) !== 'GK'))
      addDanmaku(ev.text, ev.color)
      if (animRef.current) {
        ambientAnimationRef.current = animRef.current.playAmbientEvent(createVisualEvent(ev, myPlayers, oppPlayers))
      }
      setEvents(prev => [...prev, { minute, text: ev.text }])
    }
  }

  const maybeGenerateOpponentChance = (minute) => {
    const pressure = calculateOpponentPressure({
      myLineup: currentLineupRef.current,
      opponentLineup: opponentPlayers,
      formation,
      teamDifficulty: team?.difficulty,
    })
    if (Math.random() > pressure.chance) return

    const shooter = pickOutfield(opponentPlayers)
    const gk = currentLineupRef.current.find(p => (p.pos || p.position) === 'GK') || currentLineupRef.current[0]
    const scored = Math.random() < pressure.goalChance
    const shotOnTarget = scored || Math.random() < 0.72
    const stats = matchStatsRef.current
    stats.oppShots++
    stats.oppXG += pressure.goalChance
    if (shotOnTarget) stats.oppShotsOnTarget++
    stats.myPossession = Math.max(34, stats.myPossession - 1)

    const pressureText = pressure.lineupRatings.dfWrongCount > 0 || pressure.lineupRatings.defenderCoverage < 0.75
      ? `防线错位被抓住，对方${shooter?.number || '?'}号突入禁区`
      : `对方${shooter?.number || '?'}号突然前插，形成一次射门`

    if (scored) {
      setAwayScore(prev => prev + 1)
      addDanmaku(`${minute}' ${pressureText}，低射破门！`, 'var(--pixel-accent)')
    } else if (shotOnTarget) {
      addDanmaku(`${minute}' ${pressureText}，被本方${gk?.number || 1}号门将扑出！`, 'var(--pixel-bg)')
    } else {
      addDanmaku(`${minute}' ${pressureText}，射门偏出！`, 'var(--pixel-bg)')
    }

    if (animRef.current) {
      const orderedOpponents = [shooter, ...opponentPlayers.filter(p => p.id !== shooter?.id)]
      const actors = buildAnimationActors(
        { id: 'gk_one_on_one', animation_type: 'defend_gk_rush' },
        { default: gk },
        currentLineupRef.current,
        orderedOpponents,
      )
      ambientAnimationRef.current = animRef.current.playResult(
        'defend_gk_rush',
        scored ? 'goal_against' : shotOnTarget ? 'gk_reaction_save' : 'miss',
        actors,
        { eventAsset: false },
      )
    }

    setEvents(prev => [...prev, {
      minute,
      text: scored ? `${pressureText}，对方进球` : `${pressureText}，没有进`,
    }])
  }

  // 触发决策：按最小间隔分散，避免同一分钟堆叠
  useEffect(() => {
    if (matchTime > 0 && !currentDecision && isPlaying && matchTime <= 90) {
      const half = matchTime <= 45 ? 'first' : 'second'
      if (shouldTriggerDecision(matchTime, triggeredRef.current[half], lastDecisionMinuteRef.current)) {
        triggeredRef.current[half]++
        lastDecisionMinuteRef.current = matchTime
        triggerDecision()
      }
    }
  }, [matchTime, currentDecision, isPlaying])

  const getGameState = useCallback(() => {
    const lineupAssessment = calculateLineupRatings(currentLineupRef.current, formation)
    return {
      minute: matchTime,
      myScore: homeScore,
      oppScore: awayScore,
      scoreDiff: homeScore - awayScore,
      myAttack: lineupAssessment.attack,
      myDefense: lineupAssessment.defense,
      oppAttack: calculateOpponentAttackRating(opponentPlayers),
      oppDefense: opponentPlayers.reduce((s, p) => s + (p.def || 70), 0) / Math.max(1, opponentPlayers.length),
      teamAvgRating: lineupAssessment.overall,
      teamDifficulty: team?.difficulty || 3,
      lineupAssessment,
      isKnockout: Boolean(saveData.currentRun?.isKnockoutMatch),
      isExtraTime: matchTime > 90,
      opponentName,
      subBonus,
    }
  }, [matchTime, homeScore, awayScore, opponentPlayers, saveData, opponentName, subBonus, formation, team?.difficulty])

  const createOpponentPenaltyDecision = useCallback((foulPlayer, foulOutcome) => {
    const goalkeeper = currentLineupRef.current.find(p => (p.pos || p.position) === 'GK') || currentLineupRef.current[0]
    const shooter = pickOutfield(opponentPlayers)
    return {
      kind: 'opponent_penalty',
      scenario: { id: 'opponent_penalty_defense', animation_type: 'defend_opponent_penalty' },
      situation: `${foulOutcome.includes('red') ? '红牌加点球！' : '黄牌加点球！'}${foulPlayer?.name || '防守球员'}禁区内犯规。对方${shooter?.number || '?'}号站上点球点，${goalkeeper?.name || '门将'}判断扑救方向！`,
      keyPlayers: { default: goalkeeper, second: shooter },
      choices: [
        { id: 'dive_left', label: '扑向左侧', side: 'left', desc: '提前压低重心扑左下角。', risk: '猜错方向几乎必丢', reward: '猜中就能把点球封出去', keyPlayerName: goalkeeper?.name || '门将', successHint: '赌方向' },
        { id: 'stay_center', label: '守住中路', side: 'center', desc: '等主罚球员出脚后再反应。', risk: '两侧死角覆盖不足', reward: '能克制勺子和中路推射', keyPlayerName: goalkeeper?.name || '门将', successHint: '稳反应' },
        { id: 'dive_right', label: '扑向右侧', side: 'right', desc: '全力扑向右下角。', risk: '猜错方向几乎必丢', reward: '猜中就能把点球封出去', keyPlayerName: goalkeeper?.name || '门将', successHint: '赌方向' },
      ],
      animation_type: 'defend_opponent_penalty',
    }
  }, [opponentPlayers])

  const createAwardedPenaltyDecision = useCallback((reasonText) => {
    const scenario = getScenarioById('match_penalty')
    const decision = executeDecision(scenario, currentLineupRef.current, getGameState())
    return {
      ...decision,
      kind: 'awarded_penalty',
      situation: `${reasonText} ${decision.keyPlayers?.default?.name || '主罚手'}站上点球点，选择射门方向！`,
    }
  }, [getGameState])

  const triggerDecision = useCallback(async () => {
    setIsPlaying(false)
    await Promise.race([
      ambientAnimationRef.current.catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 520)),
    ])
    const gameState = getGameState()
    const scenario = selectScenario(matchTime, gameState)
    const decision = executeDecision(scenario, currentLineupRef.current, gameState)

    if (animRef.current) {
      const actors = buildAnimationActors(scenario, decision.keyPlayers, currentLineupRef.current, opponentPlayers)
      await animRef.current.playEvent(scenario.animation_type, actors)
    }

    await new Promise(r => setTimeout(r, 500))
    setDecisionResult(null)
    setFieldDecisionMessage(null)
    setCurrentDecision(decision)
  }, [matchTime, opponentPlayers, getGameState])

  // 玩家选择
  const handleChoice = useCallback(async (choice) => {
    if (!currentDecision) return
    if (currentDecision.kind === 'opponent_penalty') {
      await handleOpponentPenaltyChoice(choice)
      return
    }
    const keyPlayer = currentDecision.keyPlayers?.default || currentLineupRef.current[0]
    const gameState = getGameState()
    const result = currentDecision.scenario?.id === 'penalty_area_dive' && choice.id === 'simulate_contact'
      ? resolveDiveChoice(choice, keyPlayer, gameState)
      : currentDecision.scenario?.id === 'match_penalty'
        ? resolveMatchPenaltyChoice(choice, keyPlayer, gameState)
        : resolveChoiceResult(choice, keyPlayer, gameState)
    const resultText = generateResultText(choice, result, keyPlayer)
    setCurrentDecision(null)
    setDecisionResult(result)
    setFieldDecisionMessage({
      text: resultText,
      visual: getMatchEventVisual(result.outcome, result),
    })

    if (animRef.current) {
      const actors = buildAnimationActors(currentDecision.scenario, currentDecision.keyPlayers, currentLineupRef.current, opponentPlayers)
      await animRef.current.playResult(currentDecision.scenario.animation_type, result.outcome, actors)
    }

    if (result.homeScoreChange > 0) setHomeScore(prev => prev + result.homeScoreChange)
    if (result.awayScoreChange > 0) setAwayScore(prev => prev + result.awayScoreChange)

    // 更新比赛统计
    const stats = matchStatsRef.current
    const outcome = result.outcome
    if (currentDecision.scenario?.id === 'match_penalty' && currentDecision.kind !== 'awarded_penalty') {
      stats.penalties++
    }
    // 射门判定（含封堵射门）
    const opponentShotOutcome = isOpponentShotOutcome(outcome)
    const isShot = !opponentShotOutcome && (outcome.includes('goal') || outcome.includes('saved') || outcome.includes('miss') ||
      outcome.includes('over') || outcome.includes('wide') || outcome.includes('post') ||
      outcome.includes('shot') || outcome.includes('header') || outcome.includes('freekick') ||
      outcome.includes('volley') || outcome.includes('placement') || outcome.includes('power') ||
      outcome.includes('panenka') || outcome.includes('chip') || outcome.includes('blocked'))
    const isGoal = result.homeScoreChange > 0
    const isOnTarget = outcome.includes('saved') || isGoal

    if (isShot) {
      stats.myShots++
      if (isOnTarget) stats.myShotsOnTarget++
      const isPenaltyAttempt = currentDecision.scenario?.id === 'match_penalty'
        || currentDecision.kind === 'awarded_penalty'
      stats.myXG += isPenaltyAttempt ? 0.76 : getShotXG(outcome, result.successProb)
    }
    if (opponentShotOutcome) {
      stats.oppShots++
      if (!outcome.includes('miss') && !outcome.includes('over')) stats.oppShotsOnTarget++
      stats.oppXG += getShotXG(outcome, result.successProb)
    }
    // 控球率微调
    stats.myPossession = Math.min(65, Math.max(35, stats.myPossession + (result.isSuccess ? 1 : -1)))
    // 犯规/牌
    if (outcome.includes('foul') || outcome.includes('yellow')) stats.fouls++
    if (outcome.includes('yellow')) stats.yellowCards++
    if (outcome.includes('red_card')) {
      stats.redCards++; stats.fouls++
      matchRedCardsRef.current = appendUniqueIncident(
        matchRedCardsRef.current,
        {
          playerId: keyPlayer?.id,
          playerName: keyPlayer?.name,
          playerNumber: keyPlayer?.number,
          text: `${keyPlayer?.name || '球员'}被红牌罚下`,
          teamSide: 'my',
        },
      )
      if (keyPlayer?.id) {
        setRedCardedPlayerIds(ids => ids.includes(keyPlayer.id) ? ids : [...ids, keyPlayer.id])
      }
      const reducedLineup = currentLineupRef.current.filter(p => p.id !== keyPlayer?.id)
      if (reducedLineup.length > 0) {
        currentLineupRef.current = reducedLineup
        setCurrentLineup(reducedLineup)
      }
    }
    if (outcome.includes('yellow') || outcome.includes('red_card')) {
      audioManager.playSound('card')
      audioManager.vibrate(28)
    }
    // 角球
    if (outcome.includes('corner')) stats.corners++
    // 解围产生角球
    if (outcome.includes('deflected') || outcome.includes('cleared')) stats.corners++

    matchDecisionsRef.current.push({
      minute: matchTime,
      scenarioId: currentDecision.scenario?.id,
      situation: currentDecision.situation,
      choiceLabel: choice.label,
      resultText,
      outcome: result.outcome,
      isSuccess: result.isSuccess,
      playerName: keyPlayer?.name,
    })
    addDanmaku(resultText, result.homeScoreChange > 0 ? 'var(--pixel-gold)' : result.awayScoreChange > 0 ? 'var(--pixel-accent)' : 'var(--pixel-bg)')
    setEvents(prev => [...prev, { minute: matchTime, text: resultText }])

    if (result.outcome.includes('red_card')) {
      setNotification({ type: 'red_card', text: `🟥 红牌！${keyPlayer.name}被罚下！` })
    }

    if (outcomeConcedesPenalty(outcome)) {
      stats.penalties++
      const penaltyDecision = createOpponentPenaltyDecision(keyPlayer, outcome)
      setNotification({ type: 'penalty', text: `点球！对方获得十二码机会！` })
      if (animRef.current) {
        const actors = buildAnimationActors(
          penaltyDecision.scenario,
          penaltyDecision.keyPlayers,
          currentLineupRef.current,
          opponentPlayers,
        )
        await animRef.current.playEvent('defend_opponent_penalty', actors)
      }
      await new Promise(r => setTimeout(r, 500))
      setNotification(null)
      setFieldDecisionMessage(null)
      openChainedDecision(penaltyDecision, { setDecisionResult, setCurrentDecision })
      return
    }

    if (outcomeWinsPenalty(outcome)) {
      stats.penalties++
      const penaltyDecision = createAwardedPenaltyDecision(
        outcome === 'penalty_awarded' ? 'VAR改判点球！' : '裁判指向点球点！',
      )
      setNotification({ type: 'penalty', text: '点球！本方获得十二码机会！' })
      if (animRef.current) {
        const actors = buildAnimationActors(
          penaltyDecision.scenario,
          penaltyDecision.keyPlayers,
          currentLineupRef.current,
          opponentPlayers,
        )
        await animRef.current.playEvent('penalty_shootout', actors)
      }
      await new Promise(r => setTimeout(r, 500))
      setNotification(null)
      setFieldDecisionMessage(null)
      openChainedDecision(penaltyDecision, { setDecisionResult, setCurrentDecision })
      return
    }

    await new Promise(r => setTimeout(r, 1800))
    setNotification(null)
    setDecisionResult(null)
    setFieldDecisionMessage(null)
    setIsPlaying(true)
  }, [currentDecision, matchTime, opponentPlayers, getGameState, addDanmaku, createOpponentPenaltyDecision, createAwardedPenaltyDecision])

  const handleOpponentPenaltyChoice = useCallback(async (choice) => {
    if (!currentDecision) return
    const goalkeeper = currentDecision.keyPlayers?.default || currentLineupRef.current[0]
    const result = resolveOpponentPenaltyChoice(choice, goalkeeper, getGameState())
    const resultText = result.awayScoreChange > 0
      ? `对方点球罚进，本方${goalkeeper?.number || 1}号判断错方向。`
      : `本方${goalkeeper?.number || 1}号扑出点球！`
    setCurrentDecision(null)
    setDecisionResult(result)
    setFieldDecisionMessage({
      text: resultText,
      visual: getMatchEventVisual(result.outcome, result),
    })
    const actors = buildAnimationActors(
      currentDecision.scenario,
      currentDecision.keyPlayers,
      currentLineupRef.current,
      opponentPlayers,
    )
    if (animRef.current) {
      await animRef.current.playResult('defend_opponent_penalty', result.outcome, actors)
    }

    const stats = matchStatsRef.current
    stats.oppShots++
    stats.oppShotsOnTarget++
    stats.oppXG += 0.76
    if (result.awayScoreChange > 0) {
      setAwayScore(prev => prev + 1)
      addDanmaku(`${matchTime}' ${resultText}`, 'var(--pixel-accent)')
    } else {
      addDanmaku(`${matchTime}' ${resultText}`, 'var(--pixel-gold)')
      audioManager.playSave()
    }
    matchDecisionsRef.current.push({
      minute: matchTime,
      scenarioId: 'opponent_penalty_defense',
      situation: currentDecision.situation,
      choiceLabel: choice.label,
      resultText: result.awayScoreChange > 0 ? '对方点球罚进' : `${goalkeeper?.name || '门将'}扑出点球`,
      outcome: result.outcome,
      isSuccess: result.isSuccess,
      playerName: goalkeeper?.name,
    })
    await new Promise(r => setTimeout(r, 1200))
    setDecisionResult(null)
    setFieldDecisionMessage(null)
    setIsPlaying(true)
  }, [currentDecision, getGameState, matchTime, opponentPlayers, addDanmaku])

  const generateResultText = (choice, result, keyPlayer) => {
    const name = keyPlayer?.name || '球员'
    const outcome = result.outcome
    // 进球
    if (result.homeScoreChange > 0) {
      if (outcome.includes('freekick')) return `⚽ 任意球直接破门！${name}的弧线球绕过人墙直入死角！`
      if (outcome.includes('penalty') || outcome.includes('power') || outcome.includes('placement') || outcome.includes('panenka')) return `⚽ 点球罚进！${name}一蹴而就！`
      if (outcome.includes('header')) return `⚽ 头球破门！${name}力压防守球员将球顶入！`
      if (outcome.includes('chip')) return `⚽ 挑射入网！${name}冷静挑射越过门将！`
      if (outcome.includes('long')) return `⚽ 世界波！${name}30米外远射直挂死角！`
      if (outcome.includes('volley')) return `⚽ 凌空抽射！${name}一脚精彩的射门！`
      if (outcome.includes('tap_in')) return `⚽ 推射空门得手！${name}轻松将球送入网中！`
      const texts = [`⚽ ${name}射门得分！球进了！`, `⚽ 精彩的进球！${name}打破僵局！`, `⚽ 球进了！${name}立功了！`]
      return texts[Math.floor(Math.random() * texts.length)]
    }
    if (outcome === 'penalty_won') return `裁判指向点球点！${name}禁区内倒地为球队赢得点球。`
    if (outcome === 'penalty_awarded') return `VAR改判点球！${name}的申诉奏效。`
    if (outcome === 'yellow_card_dive') return `🟨 ${name}被裁判认定假摔，吃到黄牌！`
    if (outcome === 'play_on_lost') return `${name}倒在禁区内，裁判示意比赛继续，球权丢了。`
    if (outcome === 'yellow_card_penalty') return `🟨 ${name}禁区内犯规，黄牌并送给对方点球！`
    if (outcome === 'red_card_penalty') return `🟥 ${name}禁区内犯规，红牌并送给对方点球！`
    // 对方进球
    if (result.awayScoreChange > 0) {
      if (outcome.includes('freekick')) return `对方任意球直接破门，本方人墙和门将都没能挡住。`
      if (outcome.includes('header')) return `对方后点头球破门，定位球防守漏人了。`
      if (outcome.includes('scramble')) return `禁区二点球没处理干净，对方乱战中补射得手。`
      return `对手反击得手……`
    }
    if (outcome === 'wall_block') return `人墙挡住对方任意球！`
    if (outcome === 'keeper_save_freekick' || outcome === 'saved_freekick_against') return `门将判断准确，扑出对方任意球！`
    if (outcome === 'cleared_second_ball') return `${name}第一时间解围，把二点球踢出危险区。`
    if (outcome === 'blocked_second_ball') return `${name}门前封堵成功，挡住对方补射！`
    if (outcome === 'corner_against' || outcome === 'deflected_corner') return `球被挡出底线，对方获得角球。`
    // 被扑
    if (outcome.includes('saved')) return `${name}的射门被门将神勇扑出！`
    // 被封堵
    if (outcome.includes('blocked') || outcome.includes('block')) return `${name}的射门被防守球员用身体挡出！`
    // 偏出
    if (outcome.includes('miss') || outcome.includes('over') || outcome.includes('wide') || outcome.includes('post') || outcome.includes('crossbar')) return `${name}射门${outcome.includes('over') ? '高出横梁' : outcome.includes('post') || outcome.includes('crossbar') ? '击中门框' : '偏出'}！`
    // 铲断成功
    if (outcome.includes('tackle') && result.isSuccess) return `${name}成功铲断！干净利落！`
    // 铲断失败
    if (outcome.includes('tackle') && !result.isSuccess) return `${name}铲球失误！`
    // 红黄牌
    if (outcome.includes('red_card')) return `🟥 ${name}被红牌罚下！`
    if (outcome.includes('yellow')) return `🟨 ${name}吃到黄牌！`
    // 犯规
    if (outcome.includes('foul')) return `${name}犯规，对方获得任意球`
    // 越位
    if (outcome.includes('offside')) return `越位！${name}启动太早了`
    // 门将
    if (outcome.includes('gk_') || outcome.includes('claim')) return `门将${name}出击将球没收！`
    // 解围/角球
    if (outcome.includes('cleared') || outcome.includes('deflected')) return `防守球员将球解围出底线，角球！`
    if (outcome.includes('corner')) return `球被挡出底线，角球！`
    // 二点球/机会
    if (outcome.includes('second_ball')) return `二点球机会！禁区内一片混战！`
    if (outcome.includes('chance') || outcome.includes('cross')) return `${name}创造了机会！`
    // 边线球违例
    if (outcome.includes('violation')) return `边线球违例！裁判判给对方球权`
    // 换人效果
    if (outcome.includes('sub_')) return `换人${result.isSuccess ? '收到效果' : '效果一般'}`
    // 任意球重组织
    if (outcome.includes('reorganized') || outcome.includes('possession')) return `${choice.label}——${result.isSuccess ? '球权保持' : '未能创造机会'}。`
    // 默认
    return `${choice.label}——${result.isSuccess ? '成功' : '未果'}。`
  }

  // 换人
  const handleSubstitute = (benchPlayer, outPlayer) => {
    if (substitutionsLeft <= 0) return
    const newLineup = swapMatchPlayer(currentLineupRef.current, benchPlayer, outPlayer)
    if (!newLineup) {
      showToast('该球员已在场上，无法重复换入')
      return
    }
    currentLineupRef.current = newLineup
    setCurrentLineup(newLineup)
    setSubstitutionsLeft(prev => prev - 1)

    // 替补球员初始体力80
    setPlayerStamina(prev => ({
      ...prev,
      [benchPlayer.id]: 80,
    }))

    // 如果是因为体力事件换人，给予奖励
    if (staminaEvent && staminaEvent.player.id === outPlayer.id) {
      const bonus = outPlayer.pos === 'DF' ? 0.08 : outPlayer.pos === 'MF' ? 0.06 : 0.05
      setSubBonus(prev => prev + bonus)
      setStaminaEvent(null)
      addDanmaku(`换人成功！${benchPlayer.name}替补登场，球队${outPlayer.pos === 'DF' ? '防守' : outPlayer.pos === 'MF' ? '中场' : '进攻'}得到加强！`, 'var(--pixel-gold)')
    } else {
      addDanmaku(`换人：${benchPlayer.name}替下${outPlayer.name}`, 'var(--pixel-gold)')
    }

    setSubEvents(prev => [...prev, { minute: matchTime, in: benchPlayer.name, out: outPlayer.name }])
    audioManager.playSound('substitution')
    audioManager.vibrate(18)
    setDraggedBenchId(null)
    setShowSubModal(false)
  }

  // 开始比赛
  const handleStartMatch = () => {
    audioManager.playSound('whistle')
    setIsPlaying(true)
    setMatchTime(0)
    matchTimeRef.current = 0
    setHomeScore(0)
    setAwayScore(0)
    const kickoffText = createOpeningCommentary(team?.name || '我方', opponentName)
    setEvents([{ minute: 0, text: kickoffText }])
    setDanmaku([{ id: danmakuId.current++, text: kickoffText, color: 'var(--pixel-bg)', createdAt: Date.now() }])
    triggeredRef.current = { first: 0, second: 0 }
    lastDecisionMinuteRef.current = -99
    currentLineupRef.current = [...lineup]
    setCurrentLineup([...lineup])
    matchStatsRef.current = createEmptyMatchStats()
    matchRedCardsRef.current = []
    matchInjuriesRef.current = []
    matchDecisionsRef.current = []
    setSubstitutionsLeft(3)
    setSubBonus(0)
    setStaminaEvent(null)
    setPlayerStamina(() => {
      const map = {}
      lineup.forEach(p => { map[p.id] = p.sta || 80 })
      return map
    })
    if (animRef.current) animRef.current.resetPositions()
  }

  const handleEndMatch = () => {
    const isKnockout = Boolean(saveData.currentRun?.isKnockoutMatch)
    if (homeScore === awayScore && isKnockout) setShowPenalty(true)
    else finishMatch(homeScore, awayScore)
  }

  const finishMatch = (h, a) => {
    const result = h > a ? 'win' : h < a ? 'loss' : 'draw'
    if (result === 'win') {
      audioManager.playWin()
      audioManager.vibrate([24, 44, 24])
    } else if (result === 'loss') {
      audioManager.playLose()
      audioManager.vibrate(44)
    } else {
      audioManager.playSound('whistle')
    }
    const matchResults = saveData.currentRun?.matchResults || []
    const isKnockout = Boolean(saveData.currentRun?.isKnockoutMatch)
    const stats = matchStatsRef.current
    const activeSuspensions = {
      ...(saveData.currentRun?.suspensionMatches || {}),
    }
    ;(saveData.currentRun?.suspendedPlayers || []).forEach(id => {
      if (!activeSuspensions[id]) activeSuspensions[id] = 1
    })
    const nextSuspensions = Object.fromEntries(
      Object.entries(activeSuspensions)
        .map(([id, count]) => [id, Math.max(0, Number(count) - 1)])
        .filter(([, count]) => count > 0),
    )
    matchRedCardsRef.current.forEach(card => {
      if (card.playerId) nextSuspensions[card.playerId] = Math.max(nextSuspensions[card.playerId] || 0, 1)
    })
    const matchInjuryIds = matchInjuriesRef.current
      .filter(injury => injury.playerId)
      .map(injury => injury.playerId)
    const nextInjuredPlayers = Array.from(new Set([...(saveData.currentRun?.injuredPlayers || []), ...matchInjuryIds]))
    updateSaveData({
      ...saveData,
      currentRun: {
        ...saveData.currentRun,
        injuredPlayers: nextInjuredPlayers,
        suspendedPlayers: Object.keys(nextSuspensions),
        suspensionMatches: nextSuspensions,
        matchInjuries: matchInjuriesRef.current.map(injury => injury.text),
        matchRedCards: matchRedCardsRef.current.map(card => card.text),
        lastMatchResult: {
          homeScore: h, awayScore: a, opponent: opponentName, result,
          decisions: matchDecisionsRef.current,
          stats: {
            myShots: stats.myShots,
            oppShots: stats.oppShots,
            myShotsOnTarget: stats.myShotsOnTarget,
            oppShotsOnTarget: stats.oppShotsOnTarget,
            myXG: Math.round(stats.myXG * 100) / 100,
            oppXG: Math.round(stats.oppXG * 100) / 100,
            possession: stats.myPossession,
            fouls: stats.fouls,
            yellowCards: stats.yellowCards,
            redCards: stats.redCards,
            penalties: stats.penalties,
            corners: stats.corners,
          },
        },
        matchResults: isKnockout ? matchResults : [...matchResults, result],
        stage: 'post-match',
      },
    })
    navigateTo('post-match')
  }

  const handlePenaltyComplete = (winner) => {
    finishMatch(homeScore + (winner === 'home' ? 1 : 0), awayScore + (winner === 'away' ? 1 : 0))
  }

  const FlagImg = ({ nameOrId, size = 22 }) => {
    const getFlagSrc = n => {
      let flag = getTeamFlag(n)
      if (flag) return flag
      const t = getTeamById(n)
      if (t) return getTeamFlag(t.name)
      return null
    }
    const src = getFlagSrc(nameOrId)
    if (src) return <img src={src} alt="" className="inline-flag" style={{ width: size, height: size }} />
    return <span style={{ fontSize: size * 0.7 }}>🏳️</span>
  }

  const getStaminaColor = (sta) => sta >= 70 ? 'var(--pixel-gold)' : sta >= 50 ? 'var(--pixel-main)' : sta >= 35 ? 'var(--pixel-shadow)' : 'var(--pixel-accent)'

  return (
    <div className="screen match-screen" style={{
      display: 'grid', gridTemplateRows: 'minmax(0, 1fr)',
      height: '100dvh',
      background: 'var(--pixel-bg)', overflow: 'hidden', position: 'relative',
    }}>
      {/* 返回按钮 */}
      <button onClick={() => navigateTo('tournament')} style={{
        position: 'absolute', left: 8, top: 8, zIndex: 10,
        background: 'none', border: '2px solid var(--pixel-gold)',
        color: 'var(--pixel-gold)', fontFamily: 'Zpix, monospace',
        fontSize: 11, padding: '4px 8px', cursor: 'pointer',
      }}>←</button>

      {/* ── 主内容区域：左右布局 ── */}
      <div className="match-play-area" style={{ marginTop: '8px' }}>
        {/* 左边：横过来的足球场 */}
        <div className="match-canvas-wrap" ref={canvasHostRef}>
          <AnimationEngine
            ref={animRef}
            myLineup={currentLineup}
            opponentLineup={opponentPlayers}
            formation={formation}
            opponentFormation={opponentSetup.formation}
            myTeam={saveData.currentRun?.teamId}
            opponentTeam={opponentName}
            width={canvasSize.width}
            height={canvasSize.height}
            ambientEnabled={isPlaying && !showSubModal && !showPenalty}
            simulationSpeed={matchSpeed}
            onGoalEffect={() => {
              audioManager.playGoal()
              audioManager.vibrate([22, 36, 22])
            }}
            onOpponentGoalEffect={() => {
              audioManager.playSound('opponentGoal')
              audioManager.vibrate(36)
            }}
            onSaveEffect={() => {
              audioManager.playSave()
            }}
          />
          {fieldDecisionMessage && (
            <div className="field-decision-message" role="status">
              {fieldDecisionMessage.visual && (
                <img
                  src={fieldDecisionMessage.visual.src}
                  alt={fieldDecisionMessage.visual.label}
                  className="field-decision-icon"
                />
              )}
              <span>{fieldDecisionMessage.text}</span>
            </div>
          )}
        </div>

        {/* 右边：比赛信息 */}
        <div className="match-info-panel">
          {/* 比分 + 国旗 */}
          <div className="match-score-panel">
            <div className="score-team">
              <FlagImg nameOrId={saveData.currentRun?.teamId} size={20} />
              <span className="team-name">{team?.name}</span>
            </div>
            <div className="score-display">
              <span className="score-number">{homeScore}</span>
              <span className="score-divider">:</span>
              <span className="score-number">{awayScore}</span>
            </div>
            <div className="score-team">
              <span className="team-name">{opponentName}</span>
              <FlagImg nameOrId={opponentName} size={20} />
            </div>
          </div>

          {/* 时间 */}
          <div className="match-time-bar">
            <span className="match-time">⏱ {matchTime}'</span>
            {subBonus > 0 && (
              <span className="sub-bonus">+{Math.round(subBonus * 100)}%加成</span>
            )}
          </div>

          {/* 比赛播报 */}
          <div className="match-commentary-panel" ref={commentaryRef} aria-live="polite">
            {danmaku.length === 0 && (
              <div className="match-commentary-empty">等待开球...</div>
            )}
            {danmaku.map(d => (
              <div key={d.id} className="match-commentary-line">
                <span style={{ color: d.color }}>{d.text}</span>
              </div>
            ))}
          </div>

          {/* 控制按钮 */}
          <div className="match-controls">
            {!showPenalty && !showSubModal && (
              <>
                {matchTime === 0 && !isPlaying && (
                  <button onClick={handleStartMatch} className="match-action-btn start-btn">
                    ⚽ 开始比赛
                  </button>
                )}
                {isPlaying && !currentDecision && (
                  <>
                    <button
                      onClick={() => setMatchSpeed(speed => getNextMatchSpeed(speed))}
                      className="match-action-btn speed-btn"
                      title="切换比赛速度"
                    >
                      {matchSpeed}×
                    </button>
                    <button onClick={() => setIsPlaying(false)} className="match-action-btn pause-btn">
                      ⏸ 暂停
                    </button>
                  </>
                )}
                {!isPlaying && matchTime > 0 && matchTime < 90 && !currentDecision && (
                  <button onClick={() => setIsPlaying(true)} className="match-action-btn continue-btn">
                    ▶ 继续
                  </button>
                )}
                {!isPlaying && matchTime >= 90 && !currentDecision && (
                  <button onClick={handleEndMatch} className="match-action-btn end-btn">
                    🏁 查看结算
                  </button>
                )}
              </>
            )}
          </div>

          {/* 换人板块 */}
          <div className="sub-panel">
            <div className="sub-panel-title">
              🔄 换人机会
              <span className="sub-count">剩余 {substitutionsLeft} 次</span>
            </div>
            {/* 当前阵容 */}
            <div className="sub-lineup-section">
              <div className="sub-section-label">场上球员（将替补拖到这里）</div>
              <div className="sub-lineup-grid">
                {currentLineup.map(p => {
                  const sta = playerStamina[p.id] || 80
                  return (
                    <div
                      key={p.id}
                      className={`sub-player-card ${draggedBenchId ? 'sub-drop-ready' : ''}`}
                      style={{ borderColor: getStaminaColor(sta) }}
                      onDragOver={event => {
                        if (draggedBenchId && substitutionsLeft > 0) event.preventDefault()
                      }}
                      onDrop={event => {
                        event.preventDefault()
                        const benchId = draggedBenchId || event.dataTransfer.getData('text/player-id')
                        const benchPlayer = benchPlayers.find(player => String(player.id) === String(benchId))
                        if (benchPlayer) handleSubstitute(benchPlayer, p)
                      }}
                      onClick={() => {
                        if (draggedBenchId) {
                          const benchPlayer = benchPlayers.find(player => String(player.id) === String(draggedBenchId))
                          if (benchPlayer) handleSubstitute(benchPlayer, p)
                          return
                        }
                        if (benchPlayers.length === 0) { showToast('没有可用替补'); return }
                        showToast('请把下方替补拖到这名球员上')
                      }}
                    >
                      <span className="sub-player-number">#{p.number || '?'}</span>
                      <span className="sub-player-name">{p.name}</span>
                      <span className="sub-player-sta" style={{ color: getStaminaColor(sta) }}>{sta}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* 替补席 */}
            <div className="sub-bench-section">
              <div className="sub-section-label">替补席（拖拽到场上球员；触屏可先点替补）</div>
              {allNonStarters.length === 0 && (
                <div className="sub-empty">无可用替补</div>
              )}
              <div className="sub-bench-grid">
                {allNonStarters.map(bp => {
                  const isSuspended = suspendedSet.has(bp.id)
                  const isRedCarded = redCardedPlayerIds.includes(bp.id)
                  const isInjured = injuredSet.has(bp.id)
                  const isUnavailable = isSuspended || isRedCarded || isInjured
                  return (
                    <div
                      key={bp.id}
                      className={`sub-bench-card ${isUnavailable ? 'sub-bench-disabled' : ''} ${String(draggedBenchId) === String(bp.id) ? 'sub-bench-selected' : ''}`}
                      draggable={!isUnavailable && substitutionsLeft > 0}
                      onDragStart={event => {
                        if (isUnavailable || substitutionsLeft <= 0) {
                          event.preventDefault()
                          return
                        }
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/player-id', String(bp.id))
                        setDraggedBenchId(bp.id)
                      }}
                      onDragEnd={() => setDraggedBenchId(null)}
                      onClick={() => {
                        if (isUnavailable) {
                          showToast(`${bp.name}${isInjured ? '因伤' : '因停赛'}无法上场`)
                          return
                        }
                        if (substitutionsLeft <= 0) return
                        setDraggedBenchId(current => String(current) === String(bp.id) ? null : bp.id)
                      }}
                    >
                      <span className="sub-bench-number">#{bp.number || '?'}</span>
                      <span className="sub-bench-name">{bp.name}</span>
                      <span className="sub-bench-pos">{bp.position || bp.pos}</span>
                      {isUnavailable && <span className="sub-bench-status">{isInjured ? '伤停' : '停赛'}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 体力事件提示 ── */}
      {staminaEvent && !currentDecision && !showSubModal && (
        <div style={{
          margin: '4px 12px', padding: '8px 10px',
          background: 'rgba(255,136,0,0.15)', border: '2px solid #ff8800', borderRadius: 4,
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: 'Zpix, monospace', fontSize: 11, color: '#ff8800', marginBottom: 6 }}>
            ⚠️ {staminaEvent.message}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowSubModal(true)} style={{
              flex: 1, background: 'var(--pixel-accent)', color: '#F3E3B4',
              border: '1px solid var(--pixel-gold)', borderRadius: 4,
              padding: '6px', fontFamily: 'Zpix, monospace', fontSize: 11, cursor: 'pointer',
            }}>🔄 换人调整</button>
            <button onClick={() => setStaminaEvent(null)} style={{
              flex: 1, background: 'var(--pixel-main)', color: '#aaa',
              border: '1px solid #666', borderRadius: 4,
              padding: '6px', fontFamily: 'Zpix, monospace', fontSize: 11, cursor: 'pointer',
            }}>让他坚持</button>
          </div>
        </div>
      )}

      {/* ── 特殊通知 ── */}
      {notification && (
        <div style={{
          margin: '4px 12px', padding: '8px 12px',
          background: 'rgba(255,0,0,0.2)', border: '2px solid #ff2222', borderRadius: 4,
          fontFamily: 'Zpix, monospace', fontSize: 13, color: '#ff2222',
          textAlign: 'center', fontWeight: 'bold', flexShrink: 0,
        }}>
          {notification.text}
        </div>
      )}


      {/* ═══════════════════════════════════════ */}
      {/* 决策弹窗 */}
      {/* ═══════════════════════════════════════ */}
      {currentDecision && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--pixel-bg)', border: '3px solid var(--pixel-gold)',
            borderRadius: 0, padding: 20, width: '100%', maxWidth: 460,
            maxHeight: '86vh', overflowY: 'auto',
            boxShadow: '6px 6px 0 var(--pixel-shadow)',
          }}>
            {/* 情境文字 */}
            <div style={{
              background: 'var(--pixel-main)', padding: '14px 16px', borderRadius: 0,
              marginBottom: 12, border: '2px solid var(--pixel-gold)',
            }}>
              <div style={{ color: 'var(--pixel-gold)', fontFamily: 'Zpix, monospace', fontSize: 13, marginBottom: 8, fontWeight: 'bold' }}>
                ⚡ 第{matchTime}分钟 · 关键时刻
              </div>
              <div style={{ color: '#F3E3B4', fontFamily: '"Microsoft YaHei", "PingFang SC", "SimHei", sans-serif', fontSize: 15, lineHeight: 1.65, fontWeight: 600 }}>
                {currentDecision.situation}
              </div>
            </div>

            {/* 结果 */}
            {decisionResult && (
              <div style={{
                padding: '8px 12px', borderRadius: 4, marginBottom: 12, textAlign: 'center',
                background: decisionResult.homeScoreChange > 0 ? 'rgba(0,204,68,0.2)' : decisionResult.awayScoreChange > 0 ? 'rgba(255,0,0,0.2)' : 'rgba(201,154,46,0.15)',
                border: `2px solid ${decisionResult.homeScoreChange > 0 ? '#00cc44' : decisionResult.awayScoreChange > 0 ? '#ff4444' : 'var(--pixel-gold)'}`,
                fontFamily: 'Zpix, monospace', fontSize: 14, fontWeight: 'bold',
                color: decisionResult.homeScoreChange > 0 ? '#00cc44' : decisionResult.awayScoreChange > 0 ? '#ff4444' : 'var(--pixel-main)',
              }}>
                {decisionResult.homeScoreChange > 0 ? '⚽ 进球！！' : decisionResult.awayScoreChange > 0 ? '😢 失球！' : decisionResult.isSuccess ? '✅ 成功！' : '❌ 未果'}
              </div>
            )}

            {/* 选项 */}
            {!decisionResult && currentDecision.choices.map((choice, idx) => (
              <button
                key={choice.id || idx}
                onClick={() => handleChoice(choice)}
                style={{
                  display: 'block', width: '100%', background: 'var(--pixel-main)',
                  border: '3px solid var(--pixel-gold)', borderRadius: 0,
                  padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                  color: '#F3E3B4', fontFamily: '"Microsoft YaHei", "PingFang SC", "SimHei", sans-serif', marginBottom: 10,
                  boxShadow: '3px 3px 0 var(--pixel-shadow)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--pixel-gold)' }}>{choice.label}</span>
                  <span style={{ fontSize: 11, color: '#F3E3B4' }}>关键: {choice.keyPlayerName}</span>
                </div>
                <div style={{ fontSize: 13, color: '#F3E3B4', marginBottom: 8, lineHeight: 1.55 }}>{choice.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: 11, lineHeight: 1.4 }}>
                  <span style={{ color: choice.risk.includes('高') || choice.risk.includes('极') ? '#ff6644' : '#88cc88' }}>
                    风险: {choice.risk}
                  </span>
                  <span style={{ color: choice.reward.includes('大') || choice.reward.includes('极') ? 'var(--pixel-gold)' : '#aaa' }}>
                    收益: {choice.reward}
                  </span>
                  <span style={{
                    color: choice.successProb > 0.6 ? '#00cc44' : choice.successProb > 0.4 ? '#ffdd00' : '#ff6644',
                    marginLeft: 'auto',
                  }}>
                    {choice.successHint}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}


      {/* 点球大战 */}
      {showPenalty && (
        <PenaltyShootout
          homeTeam={team?.name || '主队'}
          awayTeam={opponentName}
          homeTeamId={saveData.currentRun?.teamId}
          awayTeamId={opponentName}
          homeLineup={currentLineup}
          awayLineup={opponentPlayers}
          homeFormation={formation}
          awayFormation={opponentSetup.formation}
          onComplete={handlePenaltyComplete}
        />
      )}

      <style>{`
      `}</style>
    </div>
  )
}
