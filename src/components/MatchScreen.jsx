import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getTeamById, getTeamFlag } from '../data/teams'
import { generateOpponentTeam } from '../utils/matchEngine'
import { TEAM_SCHEDULES } from '../data/schedules'
import {
  selectScenario,
  executeDecision,
  resolveChoiceResult,
  shouldTriggerDecision,
} from '../utils/decisionSystem'
import { createOpeningCommentary, generateCommentaryEvent, generateRandomMatchEvent } from '../utils/commentaryEngine'
import { buildAnimationActors, createVisualEvent } from '../utils/matchVisuals.js'
import { audioManager } from '../utils/audioManager.js'
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

/**
 * 比赛页面 — 决策弹窗 + 弹幕事件 + 换人系统 + 体力事件
 */
export default function MatchScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const team = getTeamById(saveData.currentRun?.teamId)
  const fullRoster = saveData.currentRun?.roster || saveData.currentRun?.purchasedPlayerIds || []
  const injuredSet = new Set(saveData.currentRun?.injuredPlayers || [])
  const suspendedSet = new Set(saveData.currentRun?.suspendedPlayers || [])
  const availablePlayers = fullRoster.filter(p => !injuredSet.has(p.id) && !suspendedSet.has(p.id))
  const lineup = (saveData.currentRun?.lineup || []).filter(p => !injuredSet.has(p.id) && !suspendedSet.has(p.id))
  const starterIds = new Set(lineup.map(p => p.id))
  const benchPlayers = availablePlayers.filter(p => !starterIds.has(p.id))
  const formation = saveData.currentRun?.formation || '4-3-3'
  const opponentName = saveData.currentRun?.currentOpponent || '未知对手'

  const [matchTime, setMatchTime] = useState(0)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [, setEvents] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [showPenalty, setShowPenalty] = useState(false)

  // 决策状态
  const [currentDecision, setCurrentDecision] = useState(null)
  const [decisionResult, setDecisionResult] = useState(null)

  // 弹幕
  const [danmaku, setDanmaku] = useState([])
  const danmakuId = useRef(0)

  // 换人
  const [showSubModal, setShowSubModal] = useState(false)
  const [substitutionsLeft, setSubstitutionsLeft] = useState(3)
  const [, setSubEvents] = useState([]) // 换人记录

  // 比赛统计
  const matchStatsRef = useRef(createEmptyMatchStats())
  const matchRedCardsRef = useRef([])
  const matchInjuriesRef = useRef([])

  // 体力事件
  const [staminaEvent, setStaminaEvent] = useState(null)
  const [subBonus, setSubBonus] = useState(0) // 换人带来的胜率修正

  // 通知
  const [notification, setNotification] = useState(null)

  const animRef = useRef(null)
  const ambientAnimationRef = useRef(Promise.resolve())
  const triggeredRef = useRef({ first: 0, second: 0 })
  const lastDecisionMinuteRef = useRef(-99)
  const currentLineupRef = useRef([...lineup])
  const [currentLineup, setCurrentLineup] = useState([...lineup])

  // 球员状态（体力值）
  const [playerStamina, setPlayerStamina] = useState(() => {
    const map = {}
    lineup.forEach(p => { map[p.id] = p.sta || 80 })
    return map
  })

  // 对手（根据赛程获取对手强度）
  const opponentTeam = getTeamById(opponentName)
  const matchIndex = saveData.currentRun?.matchIndex || 0
  const schedule = TEAM_SCHEDULES[saveData.currentRun?.teamId]
  const opponentStrength = schedule?.groupStage?.[matchIndex]?.opponentStrength || 'medium'
  const [opponentPlayers] = useState(() => {
    if (opponentTeam) return generateOpponentTeam(opponentName, opponentTeam, opponentStrength)
    return generateOpponentTeam(opponentName, { name: opponentName }, opponentStrength)
  })

  // 画布尺寸：优先保留球场空间，同时兼容矮屏手机
  const [canvasSize, setCanvasSize] = useState({ width: 340, height: 340 })
  useEffect(() => {
    const updateSize = () => {
      const availableHeight = Math.max(260, window.innerHeight - 250)
      const w = Math.min(window.innerWidth - 24, 420, Math.floor(availableHeight / 1.08))
      setCanvasSize({ width: w, height: Math.floor(w * 0.95) })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // 添加弹幕（保留在列表中，不自动消失）
  const addDanmaku = useCallback((text, color = 'var(--pixel-bg)') => {
    const id = danmakuId.current++
    setDanmaku(prev => {
      const next = [...prev, { id, text, color, createdAt: Date.now() }]
      // 最多保留8条
      return next.length > 8 ? next.slice(-8) : next
    })
  }, [])

  // 比赛时钟 + 体力消耗 + 随机事件
  useEffect(() => {
    if (!isPlaying || currentDecision || showSubModal) return
    const interval = setInterval(() => {
      setMatchTime(prev => {
        if (prev >= 90) { setIsPlaying(false); return 90 }
        const next = prev + 1

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

        return next
      })
    }, 500)
    return () => clearInterval(interval)
  }, [isPlaying, currentDecision, showSubModal])

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

  const getGameState = useCallback(() => ({
    minute: matchTime,
    myScore: homeScore,
    oppScore: awayScore,
    scoreDiff: homeScore - awayScore,
    myAttack: currentLineupRef.current.reduce((s, p) => s + (p.tec || 70) + (p.spd || 70), 0) / 11,
    oppDefense: opponentPlayers.reduce((s, p) => s + (p.def || 70), 0) / 11,
    teamAvgRating: currentLineupRef.current.reduce((s, p) => s + (p.rating || 70), 0) / currentLineupRef.current.length,
    isKnockout: Boolean(saveData.currentRun?.isKnockoutMatch),
    isExtraTime: matchTime > 90,
    opponentName,
    subBonus,
  }), [matchTime, homeScore, awayScore, opponentPlayers, saveData, opponentName, subBonus])

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
    setCurrentDecision(decision)
  }, [matchTime, opponentPlayers, getGameState])

  // 玩家选择
  const handleChoice = useCallback(async (choice) => {
    if (!currentDecision) return
    const keyPlayer = currentDecision.keyPlayers?.default || currentLineupRef.current[0]
    const gameState = getGameState()
    const result = resolveChoiceResult(choice, keyPlayer, gameState)
    setCurrentDecision(null)
    setDecisionResult(null)

    if (animRef.current) {
      const actors = buildAnimationActors(currentDecision.scenario, currentDecision.keyPlayers, currentLineupRef.current, opponentPlayers)
      await animRef.current.playResult(currentDecision.scenario.animation_type, result.outcome, actors)
    }

    if (result.homeScoreChange > 0) setHomeScore(prev => prev + result.homeScoreChange)
    if (result.awayScoreChange > 0) setAwayScore(prev => prev + result.awayScoreChange)

    // 更新比赛统计
    const stats = matchStatsRef.current
    const outcome = result.outcome
    // 射门判定（含封堵射门）
    const isShot = outcome.includes('goal') || outcome.includes('saved') || outcome.includes('miss') ||
      outcome.includes('over') || outcome.includes('wide') || outcome.includes('post') ||
      outcome.includes('shot') || outcome.includes('header') || outcome.includes('freekick') ||
      outcome.includes('volley') || outcome.includes('placement') || outcome.includes('power') ||
      outcome.includes('panenka') || outcome.includes('chip') || outcome.includes('blocked')
    const isGoal = result.homeScoreChange > 0
    const isOnTarget = outcome.includes('saved') || isGoal

    if (isShot) {
      stats.myShots++
      if (isOnTarget) stats.myShotsOnTarget++
      // xG估算：基于成功概率
      stats.myXG += result.successProb * 0.3
    }
    // 对方射门（goal_against相关）
    if (outcome.includes('goal_against') || outcome.includes('counter_sealed')) {
      stats.oppShots++
      stats.oppShotsOnTarget++
      stats.oppXG += 0.3
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

    const resultText = generateResultText(choice, result, keyPlayer)
    addDanmaku(resultText, result.homeScoreChange > 0 ? 'var(--pixel-gold)' : result.awayScoreChange > 0 ? 'var(--pixel-accent)' : 'var(--pixel-bg)')
    setEvents(prev => [...prev, { minute: matchTime, text: resultText }])

    if (result.outcome.includes('red_card')) {
      setNotification({ type: 'red_card', text: `🟥 红牌！${keyPlayer.name}被罚下！` })
    }

    await new Promise(r => setTimeout(r, 1800))
    setNotification(null)
    setDecisionResult(null)
    setIsPlaying(true)
  }, [currentDecision, matchTime, opponentPlayers, getGameState, addDanmaku])

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
    // 对方进球
    if (result.awayScoreChange > 0) return `对手反击得手……`
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

    const newLineup = currentLineupRef.current.map(p =>
      p.id === outPlayer.id ? { ...benchPlayer, pos: outPlayer.pos } : p
    )
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
    setShowSubModal(false)
  }

  // 开始比赛
  const handleStartMatch = () => {
    audioManager.playSound('whistle')
    setIsPlaying(true)
    setMatchTime(0)
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
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--pixel-bg)', overflow: 'hidden', position: 'relative',
    }}>
      {/* ── 比分头部 ── */}
      <div style={{
        background: 'var(--pixel-main)', padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        flexShrink: 0, borderBottom: '3px solid var(--pixel-gold)',
      }}>
        <button onClick={() => navigateTo('tournament')} style={{
          position: 'absolute', left: 8, top: 8,
          background: 'none', border: '2px solid var(--pixel-gold)',
          color: 'var(--pixel-gold)', fontFamily: 'Zpix, monospace',
          fontSize: 11, padding: '4px 8px', cursor: 'pointer',
        }}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FlagImg nameOrId={saveData.currentRun?.teamId} size={22} />
          <span style={{ color: '#F3E3B4', fontFamily: 'Zpix, monospace', fontSize: 13 }}>{team?.name}</span>
        </div>
        <div style={{
          background: 'rgba(0,0,0,0.4)', padding: '4px 16px', borderRadius: 4,
          border: '2px solid var(--pixel-gold)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: '#F3E3B4', fontFamily: 'Zpix, monospace', fontSize: 22, fontWeight: 'bold' }}>{homeScore}</span>
          <span style={{ color: 'var(--pixel-gold)', fontFamily: 'Zpix, monospace', fontSize: 11 }}>:</span>
          <span style={{ color: '#F3E3B4', fontFamily: 'Zpix, monospace', fontSize: 22, fontWeight: 'bold' }}>{awayScore}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#F3E3B4', fontFamily: 'Zpix, monospace', fontSize: 13 }}>{opponentName}</span>
          <FlagImg nameOrId={opponentName} size={22} />
        </div>
      </div>

      {/* ── 时间 + 换人按钮 ── */}
      <div style={{
        textAlign: 'center', padding: '4px 12px', background: 'var(--pixel-shadow)',
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      }}>
        <span style={{ color: 'var(--pixel-gold)', fontFamily: 'Zpix, monospace', fontSize: 14 }}>⏱ {matchTime}'</span>
        {isPlaying && !currentDecision && substitutionsLeft > 0 && (
          <button onClick={() => setShowSubModal(true)} style={{
            background: 'var(--pixel-accent)', color: '#F3E3B4',
            border: '1px solid var(--pixel-gold)', borderRadius: 4,
            padding: '2px 8px', fontFamily: 'Zpix, monospace', fontSize: 10, cursor: 'pointer',
          }}>🔄 换人({substitutionsLeft})</button>
        )}
        {subBonus > 0 && (
          <span style={{ color: '#00cc44', fontFamily: 'Zpix, monospace', fontSize: 9 }}>+{Math.round(subBonus * 100)}%加成</span>
        )}
      </div>

      {/* ── 球场 + 事件列表 ── */}
      <div style={{ flex: '1 1 auto', padding: '10px 12px 96px', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* 球场 */}
        <div className="match-canvas-wrap">
          <AnimationEngine
            ref={animRef}
            myLineup={currentLineup}
            opponentLineup={opponentPlayers}
            formation={formation}
            width={canvasSize.width}
            height={canvasSize.height}
            ambientEnabled={isPlaying && !showSubModal && !showPenalty}
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
          <div className="match-commentary-panel" aria-live="polite">
            {danmaku.length === 0 && (
              <div className="match-commentary-empty">等待开球...</div>
            )}
            {danmaku.slice(-3).map(d => (
              <div key={d.id} className="match-commentary-line">
                <span style={{ color: d.color }}>{d.text}</span>
              </div>
            ))}
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

      {/* ── 控制按钮 ── */}
      <div className="match-controls">
        {!showPenalty && !showSubModal && (
          <>
            {matchTime === 0 && !isPlaying && (
              <button onClick={handleStartMatch} style={{
                width: '100%', background: 'var(--pixel-accent)', color: '#F3E3B4',
                border: '2px solid var(--pixel-gold)', borderRadius: 4, padding: '5px 10px',
                fontFamily: 'Zpix, monospace', fontSize: 13, cursor: 'pointer',
              }}>⚽ 开始比赛</button>
            )}
            {isPlaying && !currentDecision && (
              <button onClick={() => setIsPlaying(false)} style={{
                width: '100%', background: 'var(--pixel-main)', color: '#F3E3B4',
                border: '2px solid var(--pixel-gold)', borderRadius: 4, padding: '5px 10px',
                fontFamily: 'Zpix, monospace', fontSize: 13, cursor: 'pointer',
              }}>⏸ 暂停</button>
            )}
            {!isPlaying && matchTime > 0 && matchTime < 90 && !currentDecision && (
              <button onClick={() => setIsPlaying(true)} style={{
                width: '100%', background: 'var(--pixel-main)', color: '#F3E3B4',
                border: '2px solid var(--pixel-gold)', borderRadius: 4, padding: '5px 10px',
                fontFamily: 'Zpix, monospace', fontSize: 13, cursor: 'pointer',
              }}>▶ 继续</button>
            )}
            {!isPlaying && matchTime >= 90 && !currentDecision && (
              <button onClick={handleEndMatch} style={{
                width: '100%', background: 'var(--pixel-accent)', color: '#F3E3B4',
                border: '2px solid var(--pixel-gold)', borderRadius: 4, padding: '5px 10px',
                fontFamily: 'Zpix, monospace', fontSize: 13, cursor: 'pointer',
              }}>🏁 查看结算</button>
            )}
          </>
        )}
      </div>

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
            borderRadius: 8, padding: 16, width: '100%', maxWidth: 380,
            maxHeight: '80vh', overflowY: 'auto',
          }}>
            {/* 情境文字 */}
            <div style={{
              background: 'var(--pixel-main)', padding: '10px 12px', borderRadius: 4,
              marginBottom: 12, border: '2px solid var(--pixel-gold)',
            }}>
              <div style={{ color: 'var(--pixel-gold)', fontFamily: 'Zpix, monospace', fontSize: 12, marginBottom: 6, fontWeight: 'bold' }}>
                ⚡ 第{matchTime}分钟 · 关键时刻
              </div>
              <div style={{ color: '#F3E3B4', fontFamily: 'Zpix, monospace', fontSize: 11, lineHeight: 1.7 }}>
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
                  border: '2px solid var(--pixel-gold)', borderRadius: 4,
                  padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                  color: '#F3E3B4', fontFamily: 'Zpix, monospace', marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--pixel-gold)' }}>{choice.label}</span>
                  <span style={{ fontSize: 9, color: '#aaa' }}>关键: {choice.keyPlayerName}</span>
                </div>
                <div style={{ fontSize: 10, color: '#ccc', marginBottom: 6, lineHeight: 1.5 }}>{choice.desc}</div>
                <div style={{ display: 'flex', gap: 10, fontSize: 9 }}>
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

      {/* ═══════════════════════════════════════ */}
      {/* 换人弹窗 */}
      {/* ═══════════════════════════════════════ */}
      {showSubModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 110,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--pixel-bg)', border: '3px solid var(--pixel-gold)',
            borderRadius: 8, padding: 16, width: '100%', maxWidth: 380,
            maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
            }}>
              <span style={{ fontFamily: 'Zpix, monospace', fontSize: 14, color: 'var(--pixel-main)', fontWeight: 'bold' }}>
                🔄 换人 (剩余{substitutionsLeft}次)
              </span>
              <button onClick={() => setShowSubModal(false)} style={{
                background: 'none', border: 'none', color: 'var(--pixel-main)',
                fontFamily: 'Zpix, monospace', fontSize: 14, cursor: 'pointer',
              }}>✕</button>
            </div>

            {/* 当前阵容（可点击换下） */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Zpix, monospace', fontSize: 10, color: 'var(--pixel-shadow)', marginBottom: 6 }}>
                点击场上球员换下 ↓
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {currentLineup.map(p => {
                  const sta = playerStamina[p.id] || 80
                  return (
                    <div key={p.id} style={{
                      background: 'var(--pixel-main)', border: `2px solid ${getStaminaColor(sta)}`,
                      borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
                      fontFamily: 'Zpix, monospace', fontSize: 10, color: '#F3E3B4',
                      minWidth: 60, textAlign: 'center',
                    }}
                    onClick={() => {
                      if (benchPlayers.length === 0) { showToast('没有可用替补'); return }
                      // 标记要换下的球员
                      setStaminaEvent(prev => ({ ...prev, _outPlayer: p }))
                    }}
                    >
                      <div style={{ fontWeight: 'bold' }}>#{p.number || '?'} {p.name}</div>
                      <div style={{ color: getStaminaColor(sta), fontSize: 9 }}>体力 {sta}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 替补席 */}
            <div>
              <div style={{ fontFamily: 'Zpix, monospace', fontSize: 10, color: 'var(--pixel-shadow)', marginBottom: 6 }}>
                替补席（点击上场）↓
              </div>
              {benchPlayers.length === 0 && (
                <div style={{ fontFamily: 'Zpix, monospace', fontSize: 10, color: '#aaa', textAlign: 'center', padding: 12 }}>
                  无可用替补
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {benchPlayers.map(bp => (
                  <div key={bp.id} style={{
                    background: 'rgba(27,55,100,0.08)', border: '2px solid var(--pixel-main)',
                    borderRadius: 4, padding: '6px 10px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: 'Zpix, monospace', fontSize: 10,
                  }}
                  onClick={() => {
                    // 如果已选中要换下的球员，直接换
                    const outPlayer = staminaEvent?._outPlayer
                    if (outPlayer) {
                      handleSubstitute(bp, outPlayer)
                    } else {
                      // 否则提示先选场上球员
                      showToast('请先点击要换下的场上球员')
                    }
                  }}
                  >
                    <div>
                      <span style={{ color: 'var(--pixel-main)', fontWeight: 'bold' }}>
                        #{bp.number || '?'} {bp.name}
                      </span>
                      <span style={{ color: 'var(--pixel-shadow)', marginLeft: 8 }}>{bp.position || bp.pos}</span>
                    </div>
                    <span style={{ color: 'var(--pixel-gold)', fontSize: 9 }}>
                      {bp.position || bp.pos} · 体力80
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 点球大战 */}
      {showPenalty && (
        <PenaltyShootout
          homeTeam={team?.name || '主队'}
          awayTeam={opponentName}
          onComplete={handlePenaltyComplete}
        />
      )}

      <style>{`
      `}</style>
    </div>
  )
}
