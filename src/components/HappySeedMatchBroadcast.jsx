import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  bootHappySeedMatch,
  applyRuntimeDisciplinaryCard,
  applyRuntimeVarResult,
  cancelFormalCoachDecision,
  captureFormalMatchRuntimeMoment,
  createFormalCoachDecision,
  executeFormalCoachDecisionChoice,
  getConservativeFormalCoachChoice,
  getMatchVisualEventSnapshot,
  getRuntimeActorSnapshot,
  getSnapshot,
  getStadiumSceneSnapshot,
  pauseMatch,
  prepareFormalCoachDecision,
  resumeMatch,
  setRuntimeGoalPresentationHold,
  setSpeed,
  setRuntimeStoppageMinutes,
  setTeamTacticalStance,
  getTeamTacticalStance,
  setFormalCoachDecisionChoiceHover,
  setRuntimeActorState,
  startExtraTime,
  subscribeToMatchEvents,
  subscribeToRuntimeDecisionChoices,
  subscribeToRuntimeMatchEvents,
  substituteRuntimeActor,
  withDecisionWatchdog,
  retainMatchRuntime,
  scheduleMatchRuntimeShutdown,
} from '../services/happySeedMatchRuntime.js'
import {
  buildBroadcastSubstitutionBoard,
  buildMatchBroadcastView,
} from '../utils/matchBroadcast.js'
import {
  FORMAL_MATCH_REALTIME_MINUTES,
  abortFormalDecisionInSession,
  advanceFormalMatchSession,
  buildFormalMatchSessionReport,
  createFormalMatchSession,
  deriveFormalRuntimeIncidents,
  finalizeFormalMatchSession,
  recordFormalRuntimeGoal,
  recordFormalSubstitution,
  settleFormalDecisionInSession,
  startFormalExtraTime,
  startFormalMatchSession,
} from '../utils/formalMatchSession.js'
import { getTeamById, getTeamFlag } from '../data/teams.js'
import { getLogisticsModifiers } from '../utils/logisticsEffects.js'
import { decisionReadingSeconds } from '../utils/matchRuntimeEvent.js'
import { createMatchSfxBus } from '../utils/matchSfxBus.js'
import { audioManager } from '../utils/audioManager.js'
import { getMatchEventArtwork } from '../utils/matchEventArtwork.js'
import LockerRoomDecision from './LockerRoomDecision.jsx'
import GameLoadingScreen from './GameLoadingScreen.jsx'
import PixelRain from './PixelRain.jsx'
import PlayerControls from './PlayerControls.jsx'
import SpotlightTour from './SpotlightTour.jsx'
import { SPOTLIGHT_TOURS } from '../data/spotlightTours.js'
import { hasCompletedSpotlightTour } from '../utils/spotlightTourStorage.js'
import { startGamepadInput, stopGamepadInput } from '../utils/gamepadInput.js'
import { autoSubstituteRedSide } from '../utils/playerModeSetup.js'
import {
  pickLockerRoomSubstitution,
  resolveLockerRoomChoice,
  selectLockerRoomScenario,
} from '../utils/lockerRoomDecisions.js'
import {
  calculateStoppageMinutes,
  formatMatchClock,
  getStoppageInputs,
} from '../utils/matchClock.js'
import { shouldEnableCoachDecisions } from '../utils/coachDecisionMode.js'

const SPEEDS = [1, 2, 3]
const MAX_SUBSTITUTION_WINDOWS = 3
const MAX_SUBSTITUTION_PLAYERS = 5
const TACTICAL_STANCES = Object.freeze([
  { id: 'all-out-attack', label: '全员压上', desc: '防线压至中圈，全员前插全力抢攻', recommend: '大比分落后时推荐' },
  { id: 'attack', label: '进攻主导', desc: '阵型整体前移，加强前插与压迫', recommend: '落后时推荐' },
  { id: 'balanced', label: '攻守平衡', desc: '恢复默认阵型站位', recommend: '僵持时适用' },
  { id: 'defend', label: '稳守反击', desc: '阵型回收站稳，伺机快速反击', recommend: '领先时推荐' },
  { id: 'park-bus', label: '全员防守', desc: '全线退守禁区前沿，保住胜果', recommend: '大比分领先时推荐' },
])
const VAR_REVIEW_DISPLAY_MS = 2800
const VAR_RESULT_DISPLAY_MS = 3000
const DIRECT_GOAL_DISPLAY_MS = 3200
const EVENT_ARTWORK_DELAY_MS = 1000 // 进球/VAR 播报图片延迟 1 秒再出现，等球完全进网
const POST_GOAL_SUPPRESS_MS = 6000 // 进球后 6 秒内压制同回合迟到的 save/penalty 事件
const STAT_ROWS = [
  ['possession', '控球率', (value) => `${value}%`],
  ['shots', '射门', String],
  ['shotsOnTarget', '射正', String],
  ['passAccuracy', '传球成功率', (value) => `${value}%`],
  ['corners', '角球', String],
  ['fouls', '犯规', String],
  ['yellowCards', '黄牌', String],
  ['redCards', '红牌', String],
]

const DECISION_SCENE_PROMPTS = Object.freeze({
  solo_run_penalty: '我方前锋正在面对单刀，门将已经出击，请立即选择终结方式。',
  gk_one_on_one: '对方前锋正在形成单刀，我方门将必须立即决定如何封堵。',
  counter_attack_3v2: '我方正在形成三打二快速反击，请选择这次推进的处理方式。',
  freekick_dangerous: '我方在禁区前沿获得危险任意球，请决定这次定位球战术。',
  penalty_kick: '我方正在主罚点球，请决定射门方向与方式。',
  penalty_area_foul_risk: '对方已经进入我方禁区，请立即选择防守动作。',
})

function teamAbbreviation(name = '') {
  return String(name).replace(/国家队$/, '') || '球队'
}

function playerPosition(player) {
  return player.assignedPosition || player.naturalPosition || player.position || 'MF'
}

function teamFlagUrl(team) {
  const name = String(team?.name || '').replace(/国家队$/, '')
  return name ? (getTeamFlag(name) || '') : ''
}

function formationPlayerLayouts(players = []) {
  const rowY = { GK: 88, DF: 70, MF: 47, FW: 23 }
  const layouts = new Map()
  Object.keys(rowY).forEach((position) => {
    const row = players
      .filter((player) => playerPosition(player) === position)
      .sort((left, right) => left.runtimeLocalIndex - right.runtimeLocalIndex)
    row.forEach((player, index) => {
      const x = row.length === 1 ? 50 : 12 + ((76 * index) / (row.length - 1))
      layouts.set(player.playerId, { left: `${x}%`, top: `${rowY[position]}%` })
    })
  })
  return layouts
}

function decisionSituationText(decision) {
  const scenarioId = decision?.coachDecisionEvent?.sourceScenarioId
  if (DECISION_SCENE_PROMPTS[scenarioId]) return DECISION_SCENE_PROMPTS[scenarioId]
  const situation = decision?.situation || decision?.coachDecisionEvent?.situation
  return situation
    ? `当前比赛进入“${decision.label}”：${situation}`
    : `当前比赛进入“${decision?.label || '关键回合'}”，请立即下达场内指令。`
}

export function HappySeedMatchBroadcast({
  saveData = null,
  onMatchComplete = null,
  shootoutActive = false,
}) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const gameMode = saveData?.currentRun?.gameMode || 'coach'
  const isPlayerMode = gameMode === 'player'
  const coachDecisionMode = useMemo(() => (
    shouldEnableCoachDecisions(gameMode, params, import.meta.env.DEV)
  ), [gameMode, params])
  const acceptanceMuted = useMemo(() => (
    params.get('mute') === '1'
    || (import.meta.env.DEV && params.has('time') && Number(params.get('time')) < 1)
  ), [params])
  const currentRun = saveData?.currentRun || null
  const redTeamId = currentRun?.teamId || params.get('red') || 'france'
  const opponentTeam = getTeamById(currentRun?.currentOpponent)
  const blueTeamId = opponentTeam?.id || params.get('blue') || 'brazil'
  const redTeam = getTeamById(redTeamId)
  const blueTeam = getTeamById(blueTeamId)
  const forcedScenarioIds = useMemo(() => (
    import.meta.env.DEV
      ? (params.get('scenarios') || params.get('scenario') || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      : []
  ), [params])
  const [status, setStatus] = useState('正在装配比赛现场…')
  const [error, setError] = useState('')
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [runtimeProgress, setRuntimeProgress] = useState(0)
  const [runtimeLoadingDetail, setRuntimeLoadingDetail] = useState('正在读取比赛资源')
  const runtimeProgressTargetRef = useRef(0)
  const [paused, setPaused] = useState(false)
  const [speed, setSelectedSpeed] = useState(1)
  const [showStats, setShowStats] = useState(false)
  const [showSubstitutions, setShowSubstitutions] = useState(false)
  const [showTactics, setShowTactics] = useState(false)
  const [tacticalStance, setTacticalStance] = useState('balanced')
  const [lockerRoom, setLockerRoom] = useState(null)
  const lockerRoomUsedIdsRef = useRef(new Set())
  const lockerRoomHandledRef = useRef(new Set())
  const lockerRoomPausedRef = useRef(false)
  const prematchChoicesRef = useRef([])
  const [selectedOutId, setSelectedOutId] = useState(null)
  const [selectedInId, setSelectedInId] = useState(null)
  const [draggingInId, setDraggingInId] = useState(null)
  const [pendingSubstitutions, setPendingSubstitutions] = useState([])
  const [substitutionWindowsUsed, setSubstitutionWindowsUsed] = useState(0)
  const [snapshot, setSnapshot] = useState(() => getSnapshot())
  const [visualEvents, setVisualEvents] = useState(() => getMatchVisualEventSnapshot())
  const [runtimeActors, setRuntimeActors] = useState(() => getRuntimeActorSnapshot())
  const [stadiumScene, setStadiumScene] = useState(() => getStadiumSceneSnapshot())
  const [matchSession, setMatchSession] = useState(() => createFormalMatchSession({
    teamId: redTeamId,
    opponentTeamId: blueTeamId,
    teamName: redTeam?.name || '本方',
    opponentName: blueTeam?.name || currentRun?.currentOpponent || '对方',
    matchId: `formal-${currentRun?.matchIndex || 0}-${redTeamId}-${blueTeamId}`,
  }))
  const [pendingDecisionPlan, setPendingDecisionPlan] = useState(null)
  const [coachDecision, setCoachDecision] = useState(null)
  const [decisionPhase, setDecisionPhase] = useState('idle')
  const [decisionCountdown, setDecisionCountdown] = useState(null)
  const [decisionTimedOut, setDecisionTimedOut] = useState(false)
  const [eventArtwork, setEventArtwork] = useState(null)
  const [audioStarted, setAudioStarted] = useState(() => audioManager.userUnlocked)
  const [prematchPlanned, setPrematchPlanned] = useState(() => (
    import.meta.env.MODE !== 'test' && !audioManager.userUnlocked
  ))
  // 赛前更衣室完成门控：未完成前不允许开赛（避免决策过程中已开球）
  const [prematchGateClear, setPrematchGateClear] = useState(false)
  // 本场天气：雨天时在球场上空渲染像素风雨点
  const [weather, setWeather] = useState(() => {
    const requestedWeather = params.get('weather')
    let resolvedWeather
    if (requestedWeather === 'rain' || requestedWeather === 'clear') {
      resolvedWeather = requestedWeather
    } else if (window.__happySeedForceWeather) {
      // R键等外部强制指定天气，用后清除
      resolvedWeather = window.__happySeedForceWeather
      window.__happySeedForceWeather = null
    } else {
      // 每场比赛独立掷骰子（25% 雨天）
      resolvedWeather = Math.random() < 0.25 ? 'rain' : 'clear'
    }
    window.__happySeedWeather = resolvedWeather
    return resolvedWeather
  })
  const bootedRef = useRef(false)
  const decisionChoiceLockedRef = useRef(false)
  const decisionRunIdRef = useRef(0)
  const sessionRef = useRef(matchSession)
  const runtimeMomentRef = useRef(null)
  const completedReportedRef = useRef(false)
  const extraTimeKickoffPendingRef = useRef(false)
  const halftimeAutoSubDoneRef = useRef(false)
  const runtimeEventQueueRef = useRef([])
  const runtimeIncidentTimersRef = useRef(new Set())
  const eventArtworkTimerRef = useRef(null)
  const goalPresentationHeldRef = useRef(false)
  const lastGoalAtRef = useRef(0)
  const lastDecisionTickRef = useRef(null)
  const secondHalfStoppageBaselineRef = useRef(null)
  const lastTacticalFatigueMinuteRef = useRef(0)
  const draggingInIdRef = useRef(null)
  const [sfxBus] = useState(() => createMatchSfxBus())
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const matchTour = isPlayerMode ? SPOTLIGHT_TOURS['match-player'] : SPOTLIGHT_TOURS['match-coach']
  const [matchTourFinished, setMatchTourFinished] = useState(() => hasCompletedSpotlightTour(matchTour.id))
  const [contextTourRequest, setContextTourRequest] = useState({ id: null, serial: 0 })
  const handleMatchTourFinish = useCallback(() => setMatchTourFinished(true), [])
  const requestContextTour = (id) => {
    setContextTourRequest((current) => ({ id, serial: current.serial + 1 }))
  }

  useEffect(() => {
    if (!acceptanceMuted) return
    audioManager.applySettings({ sound: false, music: false, vibration: false })
  }, [acceptanceMuted])

  const commitSession = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(sessionRef.current) : updater
    sessionRef.current = next
    if (import.meta.env.DEV) window.__formalMatchSession = next
    setMatchSession(next)
    return next
  }, [])

  const showEventArtwork = useCallback((event) => {
    const artwork = getMatchEventArtwork(event)
    if (!artwork) return
    // 球员模式：只显示红黄牌和角球，且用紧凑左上角样式
    if (isPlayerMode) {
      const allowedTypes = new Set(['card', 'corner'])
      if (!allowedTypes.has(artwork.eventType)) return
    }
    if (eventArtworkTimerRef.current) window.clearTimeout(eventArtworkTimerRef.current)
    setEventArtwork(artwork)
    eventArtworkTimerRef.current = window.setTimeout(() => {
      setEventArtwork((current) => current?.eventId === artwork.eventId ? null : current)
      eventArtworkTimerRef.current = null
    }, Number(artwork.holdMs || 1700))
  }, [isPlayerMode])

  useEffect(() => {
    audioManager.prepareMatchAudio()
    // 比赛界面挂起像素风BGM，离开后恢复
    audioManager.suspendMusic()
    return () => audioManager.resumeMusic()
  }, [])

  // 雨天环境音：音频解锁后开始播放，组件卸载或天气变化时停止
  useEffect(() => {
    if (weather !== 'rain' || !audioStarted) return undefined
    audioManager.startRainAmbient()
    return () => audioManager.stopRainAmbient()
  }, [weather, audioStarted])

  // 开球哨声 + 观众背景音：监听引擎真正开球时刻（ab-kickoff-played），自动适应球员落位快慢
  useEffect(() => {
    if (!runtimeLoading) return undefined
    const timer = window.setInterval(() => {
      if (runtimeProgressTargetRef.current < 95 || runtimeProgressTargetRef.current >= 99) return
      const next = Math.min(99, runtimeProgressTargetRef.current + 1)
      runtimeProgressTargetRef.current = next
      setRuntimeProgress((current) => Math.max(current, next))
      if (next >= 99) setRuntimeLoadingDetail('正在同步开球阵型')
      else if (next >= 97) setRuntimeLoadingDetail('正在装配球场与球衣')
      else setRuntimeLoadingDetail('正在创建比赛现场')
    }, 1800)
    return () => window.clearInterval(timer)
  }, [runtimeLoading])

  useEffect(() => {
    if (!audioStarted) return undefined
    let crowdTriggered = false
    let crowdStartTimer = null
    const onKickoffPlayed = () => {
      audioManager.playSound('periodWhistle')
      if (!crowdTriggered) {
        crowdTriggered = true
        crowdStartTimer = window.setTimeout(() => {
          crowdStartTimer = null
          audioManager.startCrowdAmbient()
        }, 1800)
      }
    }
    window.addEventListener('ab-kickoff-played', onKickoffPlayed)
    return () => {
      window.removeEventListener('ab-kickoff-played', onKickoffPlayed)
      if (crowdStartTimer) window.clearTimeout(crowdStartTimer)
      audioManager.stopCrowdAmbient()
    }
  }, [audioStarted])

  useEffect(() => {
    if (!audioStarted) return undefined
    if (!prematchGateClear) return undefined // 等赛前决策完成才开球
    if (bootedRef.current) return undefined
    bootedRef.current = true
    setRuntimeLoading(true)
    setRuntimeProgress(4)
    runtimeProgressTargetRef.current = 4
    setRuntimeLoadingDetail('正在读取比赛资源')
    // 天气已在 useState 初始化时确定，此处同步给引擎
    setWeather(window.__happySeedWeather || 'clear')
    const _logisticsMods = getLogisticsModifiers(currentRun?.logisticsLevels)
    bootHappySeedMatch({
      red: redTeamId,
      blue: blueTeamId,
      redFormation: currentRun?.formation,
      redSquadPlayerIds: currentRun?.roster || currentRun?.purchasedPlayerIds || [],
      redLineupPlayerIds: currentRun?.lineup || [],
      redPlayerStateById: currentRun?.playerMatchStates || {},
      redUnavailablePlayerIds: [
        ...(currentRun?.injuredPlayers || []),
        ...(currentRun?.suspendedPlayers || []),
      ],
      playerMode: isPlayerMode,
      ai: params.has('ai') ? Number(params.get('ai')) : (isPlayerMode ? 0 : 2),
      time: params.has('time') ? Number(params.get('time')) : FORMAL_MATCH_REALTIME_MINUTES,
      matchStartStaminaBonus: _logisticsMods.matchStartStaminaBonus,
      moraleDecayReduction: _logisticsMods.moraleDecayReduction,
      onProgress: (progress, detail) => {
        runtimeProgressTargetRef.current = Math.max(runtimeProgressTargetRef.current, progress)
        setRuntimeProgress((current) => (
          progress < 95 ? Math.max(current, progress) : Math.max(current, 95)
        ))
        if (detail) setRuntimeLoadingDetail(detail)
      },
    }).then(() => {
      // 赛前更衣室的选择在比赛未启动时无法落人，开赛后统一补打
      if (prematchChoicesRef.current.length) {
        const readyActors = (getRuntimeActorSnapshot()?.actors || []).filter((actor) => (
          actor.side === 'red' && actor.state?.onPitch
        ))
        prematchChoicesRef.current.forEach(({ scenario, choiceId }) => {
          const pendingReport = resolveLockerRoomChoice(scenario, choiceId, { actors: readyActors })
          pendingReport.affected.forEach((entry) => {
            setRuntimeActorState(entry.runtimeActorId, {
              moraleDelta: entry.deltas.morale,
              formDelta: entry.deltas.form,
              staminaDelta: entry.deltas.stamina,
            })
          })
        })
        prematchChoicesRef.current = []
      }
      setStatus('比赛进行中 · 正式 MatchSession 已接管时间、比分与播报')
      setSnapshot(getSnapshot())
      setVisualEvents(getMatchVisualEventSnapshot())
      setRuntimeActors(getRuntimeActorSnapshot())
      setStadiumScene(getStadiumSceneSnapshot())
      setRuntimeProgress(100)
      runtimeProgressTargetRef.current = 100
      setRuntimeLoadingDetail('比赛现场准备完成')
      requestAnimationFrame(() => requestAnimationFrame(() => setRuntimeLoading(false)))
      commitSession((current) => startFormalMatchSession(current))
      // 球员模式：开赛后自动换下体力不足的球员
      if (isPlayerMode) autoSubstituteRedSide()
    }).catch((bootError) => {
      console.error(bootError)
      setError(bootError.message || '比赛引擎启动失败')
      setRuntimeLoading(true)
    })
    return undefined
  }, [audioStarted, blueTeamId, commitSession, currentRun, isPlayerMode, params, prematchGateClear, redTeamId])

  // 进入加时赛：先置 extraTime 标志，加时更衣室在 effect 里打开，
  // 引擎重开球在更衣室关闭（或无场景可开）后进行
  const enterExtraTime = useCallback((debug = false) => {
    const current = sessionRef.current
    if (!current || current.extraTime || current.status !== 'running') return false
    extraTimeKickoffPendingRef.current = true
    commitSession((session) => startFormalExtraTime(session))
    setStatus(debug ? '（测试）直接进入加时赛' : '90 分钟战平，进入加时赛（30 分钟）')
    return true
  }, [commitSession])

  const finishMatch = useCallback((runtimeEventId = null, forceShootout = false) => {
    const finished = commitSession((current) => finalizeFormalMatchSession(
      current,
      new Date().toISOString(),
      runtimeEventId,
    ))
    setStatus(`终场 · ${finished.score.red}:${finished.score.blue} · 本场 ${finished.decisions.length} 次决策`)
    if (onMatchComplete && !completedReportedRef.current) {
      completedReportedRef.current = true
      window.setTimeout(() => onMatchComplete({
        session: finished,
        report: buildFormalMatchSessionReport(finished),
        actorSnapshot: getRuntimeActorSnapshot(),
        forceShootout,
      }), 900)
    }
  }, [commitSession, onMatchComplete])

  // 测试快捷键：E 直接进加时，P 直接进点球大战，W 强制3-0胜利
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (event.key === 'e' || event.key === 'E') enterExtraTime(true)
      else if (event.key === 'p' || event.key === 'P') {
        if (!completedReportedRef.current) finishMatch(null, true)
      } else if (event.key === 'w' || event.key === 'W') {
        if (!completedReportedRef.current) {
          commitSession((current) => ({ ...current, score: { ...current.score, red: 3, blue: 0 } }))
          finishMatch()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commitSession, enterExtraTime, finishMatch])

  useEffect(() => {
    const unsubscribe = subscribeToMatchEvents((event) => {
      if (event.type === 'ab-goal') {
        commitSession((current) => recordFormalRuntimeGoal(
          current,
          event.detail,
          runtimeMomentRef.current,
          getRuntimeActorSnapshot(),
        ))
      }
      if (event.type === 'ab-match-ended') {
        const current = sessionRef.current
        const tied = current.score.red === current.score.blue
        // 平局且未打过加时：进入加时赛（小组赛不设加时，平局收场）
        const extraTimeEligible = !currentRun || currentRun.isKnockoutMatch
        if (tied && !current.extraTime && extraTimeEligible && enterExtraTime()) return
        // 加时后仍平局：以平局完赛，由 MatchScreen 进入点球大战
        finishMatch(event.detail?.runtimeEventId || null, tied && current.extraTime)
      }
      if (event.type === 'ab-runtime-substitution') setStatus('换人已同步到场上')
    })
    return unsubscribe
  }, [commitSession, currentRun, enterExtraTime, finishMatch, onMatchComplete, showEventArtwork])

  useEffect(() => {
    const holdGoalPresentation = () => {
      if (isPlayerMode) return // 球员模式不定格
      if (goalPresentationHeldRef.current) return
      goalPresentationHeldRef.current = true
      setRuntimeGoalPresentationHold(true)
    }

    const releaseGoalPresentation = () => {
      if (!goalPresentationHeldRef.current) return
      goalPresentationHeldRef.current = false
      setRuntimeGoalPresentationHold(false)
    }

    const scheduleRuntimeIncident = (callback, delay) => {
      const timer = window.setTimeout(() => {
        runtimeIncidentTimersRef.current.delete(timer)
        callback()
      }, delay)
      runtimeIncidentTimersRef.current.add(timer)
      return timer
    }

    const deliverRuntimeEvent = (event, options = {}) => {
      if (!event) return
      if (event.type === 'var-result') applyRuntimeVarResult(event)
      if (event.type === 'injury' && event.primaryRuntimeActorId) {
        setRuntimeActorState(event.primaryRuntimeActorId, { injured: true })
      }
      const presentedEvent = applyRuntimeDisciplinaryCard(event)
      runtimeEventQueueRef.current.push(presentedEvent)
      runtimeEventQueueRef.current = runtimeEventQueueRef.current.slice(-160)
      const trainingOwnsGoalFrameSfx = document.body.classList.contains('training-mode')
        && (presentedEvent.type === 'post-hit' || presentedEvent.type === 'crossbar-hit')
      // 哨声/进球音效与播报图片保持同步：图片延迟出现时，音效也同步延迟
      if (trainingOwnsGoalFrameSfx) {
        // 训练基地由 ab-training-goal-frame-hit 在碰撞当帧直接播放，避免重复。
      } else if (options.artworkDelayMs > 0) {
        scheduleRuntimeIncident(() => sfxBus.consume(presentedEvent), options.artworkDelayMs)
      } else {
        sfxBus.consume(presentedEvent)
      }
      if (options.artwork !== false) {
        if (options.artworkDelayMs > 0) {
          scheduleRuntimeIncident(() => showEventArtwork(presentedEvent), options.artworkDelayMs)
        } else {
          showEventArtwork(presentedEvent)
        }
      }
    }

    const unsubscribe = subscribeToRuntimeMatchEvents((sourceEvent) => {
      const derivedEvents = deriveFormalRuntimeIncidents(sourceEvent)
      if (sourceEvent.type === 'goal') {
        lastGoalAtRef.current = Date.now()
        const reviewEvent = derivedEvents.find((event) => event.type === 'var-review')
        const resultEvent = derivedEvents.find((event) => event.type === 'var-result')
        if (!reviewEvent || !resultEvent) {
          deliverRuntimeEvent(sourceEvent, { artworkDelayMs: EVENT_ARTWORK_DELAY_MS })
          // 球滚入网窝后再定格，与进球图片/哨声同一帧（而不是球刚碰门线就定格）
          scheduleRuntimeIncident(() => {
            holdGoalPresentation()
            scheduleRuntimeIncident(releaseGoalPresentation, DIRECT_GOAL_DISPLAY_MS)
          }, EVENT_ARTWORK_DELAY_MS)
          return
        }

        // A reviewed goal has one visual timeline: checking -> GOAL / NO GOAL.
        // The underlying goal event still reaches the factual queue, but its generic
        // artwork cannot replace the authored VAR checking screen.
        deliverRuntimeEvent(sourceEvent, { artwork: false })
        deliverRuntimeEvent(reviewEvent, { artworkDelayMs: EVENT_ARTWORK_DELAY_MS })
        // 球滚入网窝后再定格，与 VAR 检查画面同一帧
        scheduleRuntimeIncident(holdGoalPresentation, EVENT_ARTWORK_DELAY_MS)
        scheduleRuntimeIncident(() => {
          deliverRuntimeEvent(resultEvent, { artworkDelayMs: EVENT_ARTWORK_DELAY_MS })
          scheduleRuntimeIncident(releaseGoalPresentation, VAR_RESULT_DISPLAY_MS)
        }, VAR_REVIEW_DISPLAY_MS)
        return
      }

      // 进球后短暂窗口内，压制同一回合迟到的 save/penalty 事件：
      // 球已越过门线，不可能再被扑出；已进球的回合也不应再判点球
      const sinceGoal = Date.now() - lastGoalAtRef.current
      if (sinceGoal < POST_GOAL_SUPPRESS_MS) {
        if (sourceEvent.type === 'save') return
        if (sourceEvent.type === 'penalty' && sourceEvent.detail?.decision !== true) return
      }

      deliverRuntimeEvent(sourceEvent)
      derivedEvents.forEach((derivedEvent) => {
        if (sinceGoal < POST_GOAL_SUPPRESS_MS
          && derivedEvent.type === 'penalty'
          && derivedEvent.detail?.decision !== true
        ) return
        deliverRuntimeEvent(derivedEvent)
      })
    })

    return () => {
      unsubscribe()
      runtimeIncidentTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      runtimeIncidentTimersRef.current.clear()
      releaseGoalPresentation()
    }
  }, [sfxBus, showEventArtwork])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextSnapshot = getSnapshot()
      const nextActors = getRuntimeActorSnapshot()
      const runtimeMoment = captureFormalMatchRuntimeMoment()
      runtimeMomentRef.current = runtimeMoment
      setSnapshot(nextSnapshot)
      setVisualEvents(getMatchVisualEventSnapshot())
      setRuntimeActors(nextActors)
      setStadiumScene(getStadiumSceneSnapshot())
      const elapsedFatigueMinutes = Math.max(
        0,
        Math.floor(Number(nextSnapshot.minute || 0)) - lastTacticalFatigueMinuteRef.current,
      )
      if (elapsedFatigueMinutes > 0 && sessionRef.current.status === 'running') {
        const stanceRate = {
          'all-out-attack': 1.45,
          attack: 1.2,
          balanced: 1,
          defend: 0.82,
          'park-bus': 0.68,
        }[tacticalStance] || 1
        ;(nextActors?.actors || []).filter((actor) => actor.side === 'red' && actor.state?.onPitch)
          .forEach((actor) => setRuntimeActorState(actor.runtimeActorId, {
            staminaDelta: -(elapsedFatigueMinutes * 0.18 * stanceRate),
          }))
        lastTacticalFatigueMinuteRef.current = Math.floor(Number(nextSnapshot.minute || 0))
      }
      const runtimeEvents = sessionRef.current.status === 'ready'
        ? []
        : runtimeEventQueueRef.current.splice(0)
      let decisionPlan = null
      commitSession((current) => {
        const advanced = advanceFormalMatchSession(current, {
          snapshot: nextSnapshot,
          runtimeMoment,
          actorSource: nextActors,
          forcedScenarioIds,
          decisionsEnabled: coachDecisionMode
            && decisionPhase === 'idle'
            && !coachDecision
            && !pendingDecisionPlan,
          runtimeEvents,
          deriveRuntimeIncidents: false,
        })
        decisionPlan = advanced.decisionPlan
        return advanced.session
      })
      if (decisionPlan) setPendingDecisionPlan({ ...decisionPlan, runtimeMoment })
    }, 200)
    return () => window.clearInterval(timer)
  }, [
    coachDecision,
    coachDecisionMode,
    commitSession,
    decisionPhase,
    forcedScenarioIds,
    pendingDecisionPlan,
    tacticalStance,
  ])

  const broadcast = useMemo(() => (
    buildMatchBroadcastView(snapshot, visualEvents, matchSession)
  ), [matchSession, snapshot, visualEvents])

  useEffect(() => {
    const halfTimeSeen = matchSession.commentary.some((line) => (
      line.type === 'period-change' && line.text.startsWith('上半场结束')
    ))
    if (halfTimeSeen && !secondHalfStoppageBaselineRef.current) {
      secondHalfStoppageBaselineRef.current = getStoppageInputs(matchSession)
    }
    const half = halfTimeSeen ? 2 : 1
    const minutes = calculateStoppageMinutes(
      matchSession,
      half === 2 ? secondHalfStoppageBaselineRef.current : {},
    )
    setRuntimeStoppageMinutes(half, minutes)
  }, [matchSession])

  const substitutionBoard = useMemo(() => (
    buildBroadcastSubstitutionBoard(runtimeActors, {
      side: 'red',
      outPlayerId: selectedOutId,
      inPlayerId: selectedInId,
    })
  ), [runtimeActors, selectedInId, selectedOutId])

  const substitutionWindowsLeft = Math.max(
    0,
    MAX_SUBSTITUTION_WINDOWS - substitutionWindowsUsed,
  )
  const substitutionPlayersLeft = Math.max(
    0,
    MAX_SUBSTITUTION_PLAYERS - substitutionBoard.substitutionsMade,
  )
  const recommendedTacticalStance = (() => {
    const diff = matchSession.score.red - matchSession.score.blue
    if (diff <= -2) return 'all-out-attack'
    if (diff === -1) return 'attack'
    if (diff === 1) return 'defend'
    if (diff >= 2) return 'park-bus'
    return 'balanced'
  })()
  const applyTacticalStance = (stanceId) => {
    const stance = TACTICAL_STANCES.find((item) => item.id === stanceId)
    if (!stance) return
    if (!setTeamTacticalStance('red', stanceId)) {
      setError('战术调整未能进入 Runtime')
      return
    }
    setTacticalStance(stanceId)
    setShowTactics(false)
    setError('')
    setStatus(`战术调整：${stance.label}——${stance.desc}`)
    audioManager.playSound('substitution')
  }

  // —— 更衣室决策：赛前 / 中场 / 加时中场 / 点球大战前 ——
  const LOCKER_ROOM_SCENARIO_COUNT = { prematch: 2, halftime: 2, extratime: 1, shootout: 1 }
  const openLockerRoom = (phase, { pause = false } = {}) => {
    if (lockerRoomHandledRef.current.has(phase) || lockerRoom) return false
    const scenarioCount = LOCKER_ROOM_SCENARIO_COUNT[phase] || 1
    const scenarios = []
    for (let index = 0; index < scenarioCount; index += 1) {
      const scenario = selectLockerRoomScenario({
        phase,
        scoreDiff: matchSession.score.red - matchSession.score.blue,
        usedIds: [...lockerRoomUsedIdsRef.current, ...scenarios.map((item) => item.id)],
        weather,
      })
      if (scenario) scenarios.push(scenario)
    }
    if (!scenarios.length) return false
    lockerRoomHandledRef.current.add(phase)
    if (pause) {
      lockerRoomPausedRef.current = true
      pauseMatch()
      setPaused(true)
    }
    setLockerRoom({ phase, scenarios, index: 0, report: null })
    return true
  }
  const handleLockerRoomChoose = (choiceId) => {
    if (!lockerRoom?.scenarios?.length || lockerRoom.report) return
    const scenario = lockerRoom.scenarios[lockerRoom.index]
    const choice = scenario.choices.find((candidate) => candidate.id === choiceId)
    const actors = (runtimeActors.actors || []).filter((actor) => (
      actor.side === 'red' && actor.state?.onPitch
    ))
    const report = resolveLockerRoomChoice(scenario, choiceId, { actors })
    report.affected.forEach((entry) => {
      setRuntimeActorState(entry.runtimeActorId, {
        moraleDelta: entry.deltas.morale,
        formDelta: entry.deltas.form,
        staminaDelta: entry.deltas.stamina,
      })
    })
    lockerRoomUsedIdsRef.current.add(scenario.id)
    // 赛前且球员未就绪：记账，开赛后补打
    if (lockerRoom.phase === 'prematch' && !report.affected.length) {
      prematchChoicesRef.current.push({ scenario, choiceId })
    }
    // 换人类决策真正接入换人逻辑：赛前球员未就绪时跳过（开赛后补打），
    // 中场/加时则立即执行换人并消耗换人名额
    if (choice?.substitute && lockerRoom.phase !== 'prematch' && substitutionPlayersLeft > 0) {
      const pair = pickLockerRoomSubstitution(getRuntimeActorSnapshot(), choice.substitute)
      if (pair && substituteRuntimeActor('red', pair.outgoing.playerId, pair.incoming.playerId)) {
        setSubstitutionWindowsUsed((current) => current + 1)
        commitSession((current) => recordFormalSubstitution(current, pair.outgoing, pair.incoming))
        report.resultText = `${pair.incoming.number}号${pair.incoming.name}替下${pair.outgoing.number}号${pair.outgoing.name}。${report.resultText}`
      }
    }
    setRuntimeActors(getRuntimeActorSnapshot())
    setLockerRoom({ ...lockerRoom, report })
    setError('')
    setStatus(report.resultText)
    audioManager.playSound('substitution')
  }
  const handleLockerRoomNext = () => {
    if (lockerRoom && lockerRoom.index + 1 < lockerRoom.scenarios.length) {
      setLockerRoom({ ...lockerRoom, index: lockerRoom.index + 1, report: null })
      return
    }
    handleLockerRoomContinue()
  }
  const handleLockerRoomContinue = () => {
    const wasPrematch = lockerRoom?.phase === 'prematch'
    setLockerRoom(null)
    // 加时更衣室关闭后，引擎重开球，比赛从 90 分钟继续
    if (extraTimeKickoffPendingRef.current) {
      extraTimeKickoffPendingRef.current = false
      startExtraTime()
    }
    if (lockerRoomPausedRef.current) {
      lockerRoomPausedRef.current = false
      resumeMatch()
      setPaused(false)
    }
    // 赛前更衣室的选择就是开赛手势：选完直接开赛，不再需要第二次点击
    if (wasPrematch) {
      setPrematchGateClear(true)
      setPrematchPlanned(false)
      if (!audioStarted) {
        audioManager.unlock()
        setAudioStarted(true)
      }
    }
  }

  // 赛前：开球前出现一次（测试环境跳过，避免遮挡其它交互测试）。
  // 此时比赛尚未启动，选择的效果先记入 prematchChoicesRef，开赛后补打到真实球员。
  // 无论更衣室是否打开，都必须放行 prematchGateClear，否则比赛永远不会启动
  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      setPrematchGateClear(true)
      return undefined
    }
    // 球员模式不开赛前更衣室，直接放行 Runtime 装配。
    if (isPlayerMode) {
      setPrematchGateClear(true)
      setPrematchPlanned(false)
      return undefined
    }
    const timer = window.setTimeout(() => {
      if (!openLockerRoom('prematch')) {
        setPrematchGateClear(true)
        setPrematchPlanned(false)
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [isPlayerMode])

  // 中场休息 / 加时中场 / 点球大战前：按比赛阶段触发。
  // 常规中场的 period-change 一旦发生过 halfTimeSeen 就永真，
  // 所以加时两个钩子必须独立判断，不能挂在 else-if 链上
  useEffect(() => {
    const halfTimeSeen = matchSession.commentary.some((line) => (
      line.type === 'period-change' && line.text.startsWith('上半场结束')
    ))
    // 球员模式：中场自动换人（仅一次），加时直接重开球，不弹更衣室
    if (isPlayerMode) {
      if (halfTimeSeen && !halftimeAutoSubDoneRef.current) {
        halftimeAutoSubDoneRef.current = true
        autoSubstituteRedSide()
      }
      if (matchSession.extraTime && extraTimeKickoffPendingRef.current) {
        extraTimeKickoffPendingRef.current = false
        startExtraTime()
      }
      return
    }
    if (halfTimeSeen) openLockerRoom('halftime', { pause: true })
    // 加时重开球以 extraTime 标志 + 待开球标记为准，不依赖分钟数
    //（E 键可能在 90 分钟前直接进入加时）
    if (matchSession.extraTime && extraTimeKickoffPendingRef.current && !lockerRoom) {
      const opened = openLockerRoom('extratime', { pause: true })
      // 加时更衣室无场景可开时，直接重开球进入加时
      if (!opened) {
        extraTimeKickoffPendingRef.current = false
        startExtraTime()
      }
    } else if (matchSession.extraTime && matchSession.minute >= 105) {
      openLockerRoom('shootout', { pause: true })
    }
  }, [lockerRoom, matchSession, isPlayerMode])
  const pendingOutgoingIds = new Set(pendingSubstitutions.map((swap) => swap.outgoing.playerId))
  const pendingIncomingIds = new Set(pendingSubstitutions.map((swap) => swap.incoming.playerId))
  const pendingSwapByOutgoingId = new Map(pendingSubstitutions.map((swap) => [
    swap.outgoing.playerId,
    swap,
  ]))
  const availableBench = (runtimeActors.sides?.red?.bench || []).filter((player) => (
    player.state?.status === 'bench' && !pendingIncomingIds.has(player.playerId)
  ))
  const substitutionBenchPreview = [
    ...availableBench.map((player) => ({ ...player, previewRole: 'available' })),
    ...pendingSubstitutions.map((swap) => ({ ...swap.outgoing, previewRole: 'pending-out' })),
  ]

  const togglePause = () => {
    const nextPaused = !paused
    if (nextPaused) pauseMatch()
    else resumeMatch()
    setPaused(nextPaused)
  }

  const cycleSpeed = () => {
    const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(nextSpeed)
    setSelectedSpeed(nextSpeed)
  }

  const queueSubstitution = (outPlayerId, inPlayerId) => {
    if (substitutionWindowsLeft <= 0 || substitutionPlayersLeft <= 0) return false
    const outgoing = substitutionBoard.active.find((player) => player.playerId === outPlayerId)
    const incoming = runtimeActors.sides?.red?.bench?.find((player) => (
      player.playerId === inPlayerId && player.state?.status === 'bench'
    ))
    if (!outgoing || !incoming || outgoing.isGoalkeeper !== (incoming.naturalPosition === 'GK')) {
      setError('换人位置不匹配：门将只能与门将互换')
      return false
    }
    const existingForSlot = pendingSwapByOutgoingId.get(outPlayerId)
    if (
      !existingForSlot
      && pendingSubstitutions.length >= substitutionPlayersLeft
    ) {
      setError(`本场最多还能换 ${substitutionPlayersLeft} 人`)
      return false
    }
    if (
      pendingSubstitutions.some((swap) => (
        swap.incoming.playerId === inPlayerId && swap.outgoing.playerId !== outPlayerId
      ))
    ) {
      setError('这名替补已经加入本次换人方案')
      return false
    }
    setPendingSubstitutions((current) => [
      ...current.filter((swap) => swap.outgoing.playerId !== outPlayerId),
      { outgoing, incoming },
    ])
    setSelectedOutId(null)
    setSelectedInId(null)
    draggingInIdRef.current = null
    setDraggingInId(null)
    setError('')
    return true
  }

  const chooseOutgoing = (playerId) => {
    if (pendingOutgoingIds.has(playerId)) {
      setPendingSubstitutions((current) => current.filter((swap) => (
        swap.outgoing.playerId !== playerId
      )))
      return
    }
    if (selectedInId) {
      queueSubstitution(playerId, selectedInId)
      return
    }
    setSelectedOutId((current) => current === playerId ? null : playerId)
  }

  const chooseIncoming = (playerId) => {
    if (selectedOutId) {
      queueSubstitution(selectedOutId, playerId)
      return
    }
    setSelectedInId((current) => current === playerId ? null : playerId)
  }

  const closeSubstitutionEditor = () => {
    setShowSubstitutions(false)
    setPendingSubstitutions([])
    setSelectedOutId(null)
    setSelectedInId(null)
    draggingInIdRef.current = null
    setDraggingInId(null)
  }

  const confirmSubstitutions = () => {
    if (!pendingSubstitutions.length || substitutionWindowsLeft <= 0) return
    const completed = pendingSubstitutions.filter((swap) => (
      substituteRuntimeActor('red', swap.outgoing.playerId, swap.incoming.playerId)
    ))
    if (!completed.length) {
      setError('本次换人没有通过 Runtime 在场资格校验')
      return
    }
    setRuntimeActors(getRuntimeActorSnapshot())
    setSubstitutionWindowsUsed((current) => current + 1)
    completed.forEach(({ outgoing, incoming }) => {
      commitSession((current) => recordFormalSubstitution(current, outgoing, incoming))
    })
    setPendingSubstitutions([])
    setSelectedOutId(null)
    setSelectedInId(null)
    setShowSubstitutions(false)
    setError(completed.length === pendingSubstitutions.length
      ? ''
      : '部分换人未通过资格校验，请重新检查名单')
    setStatus(`本次完成 ${completed.length} 人换人，已使用 1 个换人窗口`)
    audioManager.playSound('substitution')
  }

  const dropSubstituteOnPlayer = (event, outPlayerId) => {
    event.preventDefault()
    const inPlayerId = event.dataTransfer?.getData('text/plain') || draggingInIdRef.current
    if (!inPlayerId) return
    setSelectedOutId(outPlayerId)
    setSelectedInId(inPlayerId)
    queueSubstitution(outPlayerId, inPlayerId)
  }

  const startCoachDecision = useCallback(async (plan, runtimeMoment) => {
    // 点球大战复用同一个 DecisionDirector。常规比赛遗留的待决策计划
    // 不能在此时再次 prepare，否则它的失败恢复会把点球场景 cancel 掉。
    if (shootoutActive || !plan || !runtimeMoment) return
    const runId = ++decisionRunIdRef.current
    decisionChoiceLockedRef.current = false
    setDecisionTimedOut(false)
    setDecisionCountdown(null)
    setShowStats(false)
    setShowSubstitutions(false)
    setPendingSubstitutions([])
    setError('')
    setDecisionPhase('staging')
    setStatus(`第 ${plan.minute} 分钟出现 ${plan.label}，正在冻结真实比赛瞬间`)

    try {
      const decision = createFormalCoachDecision(plan.sequenceIndex, {
        scenarioId: plan.scenarioId,
        minute: plan.minute,
        label: plan.label,
        preferredPlayerId: plan.preferredPlayerId,
        authorityState: sessionRef.current,
      })
      setCoachDecision(decision)
      await withDecisionWatchdog(
        prepareFormalCoachDecision(decision, runtimeMoment, plan.sourceEvent),
      )
      if (decisionRunIdRef.current !== runId) return
      setVisualEvents(getMatchVisualEventSnapshot())
      setDecisionCountdown(
        import.meta.env.DEV && params.has('acceptanceOutcome')
          ? 30
          : decisionReadingSeconds(decision),
      )
      setDecisionPhase('choosing')
      setStatus('点击草坪上的场内方案或旁边按钮下达指令')
    } catch (decisionError) {
      if (decisionRunIdRef.current !== runId) return
      console.error(decisionError)
      cancelFormalCoachDecision()
      commitSession((current) => abortFormalDecisionInSession(current))
      setCoachDecision(null)
      setPendingDecisionPlan(null)
      setDecisionPhase('idle')
      setError(decisionError.message || '教练决策铺垫失败')
    }
  }, [commitSession, params, shootoutActive])

  const handleCoachChoice = useCallback(async (choiceOrId, options = {}) => {
    if (
      !coachDecision
      || decisionPhase !== 'choosing'
      || decisionChoiceLockedRef.current
    ) return
    const choice = typeof choiceOrId === 'string'
      ? coachDecision.choices.find((candidate) => candidate.id === choiceOrId)
      : choiceOrId
    if (!choice) return
    decisionChoiceLockedRef.current = true
    const runId = ++decisionRunIdRef.current
    setDecisionTimedOut(Boolean(options.timedOut))
    setDecisionCountdown(null)
    setDecisionPhase('executing')
    setStatus(options.timedOut ? '时间到，执行稳健方案' : '指令已下达，场内表达已锁定')

    try {
      const execution = executeFormalCoachDecisionChoice(
        coachDecision,
        choice.id,
      )
      const { resolution } = await withDecisionWatchdog(execution.settled)
      if (decisionRunIdRef.current !== runId) return
      if (
        resolution.runtimeEffect?.type === 'substitution'
        && resolution.runtimeEffect.applied
      ) {
        setSubstitutionWindowsUsed((current) => current + 1)
      }
      const settledSession = commitSession((current) => (
        settleFormalDecisionInSession(current, coachDecision, resolution)
      ))
      setDecisionPhase('settled')
      setStatus(resolution.resultText)
      await withDecisionWatchdog(execution.completed)
      if (decisionRunIdRef.current !== runId) return
      setCoachDecision(null)
      setPendingDecisionPlan(null)
      setDecisionPhase('idle')
      setStatus(`${resolution.resultText} · 已恢复连续比赛（${settledSession.decisions.length}/${settledSession.targetDecisionCount}）`)
    } catch (decisionError) {
      if (decisionRunIdRef.current !== runId) return
      console.error(decisionError)
      // 任何异常（不只超时）都必须退出导演并恢复比赛。把 UI 留在 error
      // 会让 Runtime 的 timeScale=0 与冻结快照永久存活，形成整场卡死。
      cancelFormalCoachDecision()
      commitSession((current) => abortFormalDecisionInSession(current))
      setCoachDecision(null)
      setPendingDecisionPlan(null)
      setDecisionPhase('idle')
      setError(decisionError.message || '教练决策结果播放失败，已恢复比赛')
    }
  }, [coachDecision, commitSession, decisionPhase])

  useEffect(() => subscribeToRuntimeDecisionChoices(({ choiceId }) => {
    if (shootoutActive) return
    if (choiceId) handleCoachChoice(choiceId)
  }), [handleCoachChoice, shootoutActive])

  useEffect(() => {
    if (
      !coachDecisionMode
      || shootoutActive
      || !pendingDecisionPlan
      || coachDecision
      || decisionPhase !== 'idle'
      || !visualEvents.ready
    ) return
    startCoachDecision(pendingDecisionPlan, pendingDecisionPlan.runtimeMoment)
  }, [
    coachDecision,
    coachDecisionMode,
    decisionPhase,
    pendingDecisionPlan,
    startCoachDecision,
    shootoutActive,
    visualEvents.ready,
  ])

  useEffect(() => {
    if (decisionPhase !== 'choosing') return undefined
    const timer = window.setInterval(() => {
      setVisualEvents(getMatchVisualEventSnapshot())
    }, 50)
    return () => window.clearInterval(timer)
  }, [decisionPhase])

  useEffect(() => {
    if (decisionPhase !== 'choosing' || !coachDecision) return undefined
    const timer = window.setInterval(() => {
      setDecisionCountdown((current) => {
        if (document.hidden || paused) return current
        const next = Math.max(0, Number(current || 0) - 1)
        if (next === 0) {
          window.clearInterval(timer)
          const conservativeChoice = getConservativeFormalCoachChoice(coachDecision)
          if (conservativeChoice) {
            window.setTimeout(() => {
              handleCoachChoice(conservativeChoice, { timedOut: true })
            }, 0)
          }
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [coachDecision, decisionPhase, handleCoachChoice, paused])

  useEffect(() => {
    if (decisionPhase !== 'choosing' || !Number.isFinite(decisionCountdown)) {
      lastDecisionTickRef.current = null
      return
    }
    if (lastDecisionTickRef.current === decisionCountdown) return
    lastDecisionTickRef.current = decisionCountdown
    audioManager.playSound('decisionTick')
  }, [decisionCountdown, decisionPhase])

  useEffect(() => {
    // StrictMode 会在开发环境回放一次 effect。先认领单例 Runtime，并让卸载释放
    // 延后到当前 React commit 结束；若紧接着重新挂载，释放会被自动取消。
    retainMatchRuntime()
    return () => {
      decisionRunIdRef.current += 1
      cancelFormalCoachDecision()
      if (eventArtworkTimerRef.current) window.clearTimeout(eventArtworkTimerRef.current)
      scheduleMatchRuntimeShutdown()
    }
  }, [])

  // 球员模式：启用手柄输入轮询，卸载时停止
  useEffect(() => {
    if (!isPlayerMode) return undefined
    startGamepadInput()
    return () => stopGamepadInput()
  }, [isPlayerMode])

  const latestLine = broadcast.commentary[broadcast.commentary.length - 1]
  const decisionInteractionLocked = ['staging', 'choosing', 'executing', 'settled'].includes(decisionPhase)
  const decisionProgress = Math.min(
    matchSession.targetDecisionCount,
    matchSession.decisions.length + (coachDecision ? 1 : 0),
  )
  const decisionPrimaryName = coachDecision?.coachDecisionEvent?.keyPlayers?.primary?.name
    || coachDecision?.keyPlayers?.default?.name
    || '主罚球员'
  const decisionSupportName = coachDecision?.coachDecisionEvent?.keyPlayers?.support?.name
    || coachDecision?.keyPlayers?.second?.name
    || decisionPrimaryName
  const interpolateChoiceText = (value) => String(value || '')
    .replaceAll('{player}', decisionPrimaryName)
    .replaceAll('{player2}', decisionSupportName)
  const formationLayouts = formationPlayerLayouts(substitutionBoard.active)
  const decisionSituation = decisionSituationText(coachDecision)
  const decisionHitZoneCenters = (visualEvents.choiceHitZones || [])
    .map((zone) => Number(zone.centerX ?? (zone.x + zone.width / 2)))
    .filter(Number.isFinite)
  const decisionScreenX = decisionHitZoneCenters.length
    ? decisionHitZoneCenters.reduce((total, value) => total + value, 0) / decisionHitZoneCenters.length
    : window.innerWidth / 2
  const decisionRailSide = decisionScreenX > window.innerWidth / 2 ? 'left' : 'right'

  return (
    <main
      className="happyseed-match-broadcast"
      data-runtime-ready={snapshot.ready ? 'true' : 'false'}
      data-event-status={visualEvents.status || 'loading'}
      data-active-event-id={visualEvents.activeEventId || ''}
      data-ball-attached-to={visualEvents.ballAttachedToRuntimeActorId || ''}
      data-ball-foot-distance={visualEvents.ballFootDistance ?? ''}
      data-performed-actions={JSON.stringify(visualEvents.performedActions || {})}
      data-camera-mode={stadiumScene.cameraMode || ''}
      data-pitch-projection="4096x2048:648,611,2800,1057"
      data-base-render-size={`${stadiumScene.baseRenderSize?.width || 0}x${stadiumScene.baseRenderSize?.height || 0}`}
      data-runtime-display-size={`${stadiumScene.runtimeDisplaySize?.width || 0}x${stadiumScene.runtimeDisplaySize?.height || 0}`}
      data-pixel-goal-atlas={stadiumScene.pixelGoalAtlasApplied ? 'true' : 'false'}
      data-pixel-ball-texture={stadiumScene.pixelBallTextureApplied ? 'true' : 'false'}
      data-pixel-ball-output={stadiumScene.pixelBallOutputApplied ? 'true' : 'false'}
      data-pixel-dynamic-net={stadiumScene.pixelDynamicNetApplied ? 'true' : 'false'}
      data-pixel-dynamic-net-triangles={stadiumScene.pixelDynamicNetTriangleCount || 0}
      data-pixel-dynamic-net-strands={stadiumScene.pixelDynamicNetStrandCount || 0}
      data-runtime-player-root={
        runtimeActors.actors?.[0]?.playerRoot
        || runtimeActors.actors?.[0]?.visual?.playerRoot
        || ''
      }
      data-runtime-player-scale={runtimeActors.displayScale || ''}
      data-decision-director-phase={visualEvents.phase || decisionPhase}
      data-decision-scenario={coachDecision?.coachDecisionEvent?.sourceScenarioId || ''}
      data-decision-scene={coachDecision?.coachDecisionEvent?.type || ''}
      data-decision-index={coachDecision?.sequenceIndex ?? ''}
      data-decision-rail-side={decisionRailSide}
      data-commentary-count={matchSession.commentary.length}
      data-commentary-types={matchSession.commentary.map((line) => line.type).join(',')}
      data-decision-count={matchSession.decisions.length}
      data-match-status={matchSession.status}
      onPointerDownCapture={() => audioManager.unlock()}
    >
      <div id="gui" className="gui" aria-hidden="true">
        <canvas id="forceRefreshCanvas1" width="1" height="1" />
        <canvas id="forceRefreshCanvas2" width="1" height="1" />
      </div>

      <div className="broadcast-vignette" aria-hidden="true" />

      {/* 雨天覆盖层通过 Portal 渲染到 body 层级，避免被 WebGL 合成层遮挡 */}
      {weather === 'rain' && createPortal(
        <>
          <div className="broadcast-rain-overlay" aria-hidden="true" />
          <PixelRain />
        </>,
        document.body,
      )}

      {runtimeLoading && createPortal(
        <GameLoadingScreen
          title="比赛即将开始"
          label="比赛资源加载中"
          detail={runtimeLoadingDetail}
          progress={runtimeProgress}
          error={error}
        />,
        document.body,
      )}

      {isPlayerMode && <PlayerControls />}

      {!audioStarted && !prematchPlanned && (
        <div className="broadcast-audio-start" role="dialog" aria-label="开始比赛并开启声音">
          <button
            type="button"
            onClick={() => {
              audioManager.unlock()
              setAudioStarted(true)
            }}
          >
            <strong>点击开赛</strong>
            <span>从开球第一秒启用背景音乐、触球和比赛音效</span>
          </button>
        </div>
      )}

      {eventArtwork && (
        <aside
          className={`broadcast-event-artwork${isPlayerMode ? ' is-compact' : ''}${!eventArtwork.src ? ' is-text-only' : ''}`}
          data-event-artwork={eventArtwork.label}
          data-event-artwork-src={eventArtwork.src || ''}
          key={eventArtwork.eventId}
          aria-label={`${eventArtwork.minute} 分钟 ${eventArtwork.headline}`}
        >
          {eventArtwork.src ? <img src={eventArtwork.src} alt="" /> : <span className="broadcast-event-artwork-text">{eventArtwork.label}</span>}
          <span>
            <strong>{eventArtwork.headline}</strong>
            <small>{eventArtwork.label} · {eventArtwork.minute}&apos;</small>
          </span>
        </aside>
      )}

      <header className="broadcast-scoreboard" aria-label="比赛比分" data-guide="match-scoreboard">
        <div
          className={`broadcast-scoreboard-strip${showStats ? ' is-expanded' : ''}`}
        >
          <span className="broadcast-team is-home">
            <img src={teamFlagUrl(redTeam)} alt={`${broadcast.teams.red.name}国旗`} />
            <b>{teamAbbreviation(broadcast.teams.red.name)}</b>
          </span>
          <strong className="is-home-score">{broadcast.teams.red.score}</strong>
          <span className="broadcast-cup-mark" aria-hidden="true">
            <img src="/assets/branding/trophy.png" alt="" />
          </span>
          <strong className="is-away-score">{broadcast.teams.blue.score}</strong>
          <span className="broadcast-team is-away">
            <b>{teamAbbreviation(broadcast.teams.blue.name)}</b>
            <img src={teamFlagUrl(blueTeam)} alt={`${broadcast.teams.blue.name}国旗`} />
          </span>
        </div>
        <button
          type="button"
          className={`broadcast-details-trigger${showStats ? ' is-expanded' : ''}`}
          aria-label="展开比赛数据"
          aria-expanded={showStats}
          aria-controls="broadcast-match-stats"
          onClick={() => {
            setShowStats((current) => !current)
            setShowSubstitutions(false)
          }}
        >
          <span className="broadcast-scoreboard-arrow" aria-hidden="true">▼</span>
          <strong>查看详情</strong>
        </button>
        <div
          className={`broadcast-clock${broadcast.clock?.inStoppage ? ' is-stoppage' : ''}`}
          data-stoppage-total={broadcast.clock?.addedTotal || 0}
        >
          <span>{formatMatchClock(broadcast.clock, broadcast.minute)}&apos;</span>
          <small>
            {broadcast.clock?.inStoppage
              ? `补时 +${broadcast.clock?.addedTotal || broadcast.clock?.addedMinute || 1}`
              : currentRun?.isKnockoutMatch
                ? ({ r32: '32强', r16: '16强', qf: '8强', sf: '半决赛', final: '决赛' }[currentRun?.knockoutRound] || '淘汰赛')
                : '小组赛'}
          </small>
        </div>
        {showStats && (
          <aside id="broadcast-match-stats" className="broadcast-stats" aria-label="精简比赛统计">
            <header>
              <span>{teamAbbreviation(broadcast.teams.red.name)}</span>
              <strong>比赛数据</strong>
              <span>{teamAbbreviation(broadcast.teams.blue.name)}</span>
            </header>
            <dl>
              {STAT_ROWS.map(([key, label, format]) => (
                <div key={key}>
                  <dd>{format(broadcast.teams.red[key])}</dd>
                  <dt>{label}</dt>
                  <dd>{format(broadcast.teams.blue[key])}</dd>
                </div>
              ))}
            </dl>
          </aside>
        )}
      </header>

      {!isPlayerMode && <section
        className={`broadcast-commentary${latestLine?.tone === 'highlight' ? ' is-key' : ''}`}
        aria-label="比赛播报"
        aria-live="polite"
      >
        {broadcast.commentary.length ? broadcast.commentary.map((line) => (
          <p className={`is-${line.tone}`} key={line.id}>
            <time>{line.minute}&apos;</time>
            <span>{line.text}</span>
          </p>
        )) : (
          <p className="is-live">
            <time>00&apos;</time>
            <span>{error || '双方球员已经就位，准备开球。'}</span>
          </p>
        )}
      </section>}

      <div className="broadcast-status" aria-live="polite">
        <span className={error ? 'is-error' : ''}>{error || status}</span>
        <small>
          {coachDecisionMode
            ? `${decisionProgress}/${matchSession.targetDecisionCount} 正式决策`
            : `${broadcast.completedCount}/${broadcast.totalCount} 关键回合`}
        </small>
      </div>

      <nav className="broadcast-controls" aria-label="比赛控制" data-guide="match-controls">
        <button type="button" className="broadcast-pause-button" disabled={decisionInteractionLocked} onClick={togglePause}>
          <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
          <b>{paused ? '继续' : '暂停'}</b>
        </button>
        {!isPlayerMode && <button type="button" className="broadcast-speed-button" disabled={decisionInteractionLocked} onClick={cycleSpeed}>
          <b>{speed}×</b>
        </button>}
        <button type="button" className="broadcast-exit-button" onClick={() => setShowExitConfirm(true)}>
          <span aria-hidden="true">✕</span>
          <b>退出</b>
        </button>
      </nav>

      {showExitConfirm && (
        <div className="broadcast-exit-backdrop" onPointerDown={() => setShowExitConfirm(false)}>
          <div className="broadcast-exit-dialog" onPointerDown={(e) => e.stopPropagation()}>
            <strong>确认退出比赛？</strong>
            <p>退出将视为弃权，本场将以 <em>0 : 3</em> 判负。</p>
            <div className="broadcast-exit-actions">
              <button type="button" className="broadcast-exit-cancel" onClick={() => setShowExitConfirm(false)}>继续比赛</button>
              <button type="button" className="broadcast-exit-confirm" onClick={() => {
                setShowExitConfirm(false)
                if (!completedReportedRef.current) {
                  // 立即停止引擎与所有环境音
                  pauseMatch()
                  audioManager.stopCrowdAmbient()
                  audioManager.stopRainAmbient()
                  commitSession((current) => ({ ...current, score: { red: 0, blue: 3 } }))
                  finishMatch()
                }
              }}>确认退出</button>
            </div>
          </div>
        </div>
      )}

      {!isPlayerMode && <button
        type="button"
        className="broadcast-substitution-trigger broadcast-tactics-trigger"
        data-guide="match-tactics-trigger"
        disabled={decisionInteractionLocked}
        aria-expanded={showTactics}
        aria-controls="broadcast-tactics-drawer"
        onClick={() => {
          if (showTactics) setShowTactics(false)
          else {
            setTacticalStance(getTeamTacticalStance('red'))
            setShowTactics(true)
          }
          setShowSubstitutions(false)
          setShowStats(false)
        }}
      >
        <span className="broadcast-substitution-icon broadcast-tactics-icon" aria-hidden="true"><i>♟</i></span>
        <span className="broadcast-substitution-copy">
          <strong>战术</strong>
          <small>{TACTICAL_STANCES.find((item) => item.id === tacticalStance)?.label || '攻守平衡'}</small>
        </span>
      </button>}

      {!isPlayerMode && <button
        type="button"
        className="broadcast-substitution-trigger"
        data-guide="match-substitutions-trigger"
        disabled={decisionInteractionLocked || substitutionWindowsLeft <= 0 || substitutionPlayersLeft <= 0}
        aria-expanded={showSubstitutions}
        aria-controls="broadcast-substitution-drawer"
        onClick={() => {
          if (showSubstitutions) closeSubstitutionEditor()
          else {
            setPendingSubstitutions([])
            setShowSubstitutions(true)
          }
          setShowStats(false)
        }}
      >
        <span className="broadcast-substitution-icon" aria-hidden="true"><i>↑</i><i>↓</i></span>
        <span className="broadcast-substitution-copy">
          <strong>换人</strong>
          <small>{substitutionWindowsLeft} 次 · {substitutionPlayersLeft} 人</small>
        </span>
      </button>}

      {showTactics && (
        <div className="broadcast-substitution-backdrop" onPointerDown={() => setShowTactics(false)}>
          <aside
            id="broadcast-tactics-drawer"
            className="broadcast-substitutions broadcast-tactics"
            aria-label="战术调整"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>{broadcast.teams.red.name} · 当前 {TACTICAL_STANCES.find((item) => item.id === tacticalStance)?.label || '攻守平衡'}</small>
                <strong>战术调整</strong>
              </div>
              <span>比分 {matchSession.score.red}:{matchSession.score.blue}</span>
              <button
                type="button"
                className="broadcast-drawer-guide"
                aria-label="打开战术新手指引"
                onClick={() => requestContextTour(SPOTLIGHT_TOURS.tactics.id)}
              >?</button>
              <button type="button" aria-label="关闭战术调整" onClick={() => setShowTactics(false)}>×</button>
            </header>
            <section className="broadcast-tactics-options" data-guide="tactics-options">
              {TACTICAL_STANCES.map((stance) => (
                <button
                  key={stance.id}
                  type="button"
                  className={`broadcast-tactics-option${tacticalStance === stance.id ? ' is-active' : ''}`}
                  onClick={() => applyTacticalStance(stance.id)}
                >
                  <strong>
                    {stance.label}
                    {stance.id === recommendedTacticalStance && <em>推荐</em>}
                  </strong>
                  <span>{stance.desc}</span>
                  <small>{stance.recommend}</small>
                </button>
              ))}
            </section>
            <footer>调整全队阵型锚点与前插积极度，即刻生效</footer>
          </aside>
        </div>
      )}

      {lockerRoom && (
        <LockerRoomDecision
          scenario={lockerRoom.scenarios[lockerRoom.index]}
          report={lockerRoom.report}
          onChoose={handleLockerRoomChoose}
          onContinue={handleLockerRoomNext}
          queueIndex={lockerRoom.index}
          queueTotal={lockerRoom.scenarios.length}
          phase={lockerRoom.phase}
        />
      )}

      {coachDecision && ['staging', 'choosing', 'executing', 'settled'].includes(decisionPhase) && (
        <aside
          className={`broadcast-decision-v3 is-${decisionPhase} is-${decisionRailSide}`}
          aria-label="限时教练决策"
          aria-live="assertive"
        >
          <div className="broadcast-decision-heading">
            <span>{coachDecision.coachDecisionEvent?.minute ?? matchSession.minute}&apos; · {coachDecision.label}</span>
            <strong>{decisionSituation}</strong>
          </div>
          <div className={`broadcast-stopwatch${decisionPhase === 'choosing' ? ' is-running' : ''}`}>
            <span className="broadcast-stopwatch-crown" aria-hidden="true" />
            <span className="broadcast-stopwatch-face" aria-hidden="true">
              <i key={decisionCountdown ?? decisionPhase} />
            </span>
            <time aria-label={`剩余 ${decisionCountdown ?? 0} 秒`}>
              {decisionPhase === 'choosing'
                ? <><b>{decisionCountdown}</b><small>秒</small></>
                : decisionPhase === 'staging'
                  ? '准备'
                  : decisionPhase === 'settled'
                    ? '完成'
                    : decisionTimedOut ? '超时' : '执行'}
            </time>
          </div>
        </aside>
      )}

      {coachDecision && decisionPhase === 'choosing' && (
        <div className={`runtime-world-choices is-${decisionRailSide}`} aria-label="场内决策选择">
          {coachDecision.choices.map((choice) => {
            const description = interpolateChoiceText(choice.desc)
            const risk = interpolateChoiceText(choice.risk)
            const reward = interpolateChoiceText(choice.reward)
            const successHint = interpolateChoiceText(choice.successHint)
            return (
              <button
                type="button"
                className="runtime-world-choice"
                data-choice-id={choice.id}
                key={choice.id}
                aria-label={`${choice.label}。${description}。风险：${risk}。收益：${reward}。${successHint}`}
                onPointerEnter={() => setFormalCoachDecisionChoiceHover(choice.id, true)}
                onPointerLeave={() => setFormalCoachDecisionChoiceHover(choice.id, false)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => handleCoachChoice(choice.id)}
              >
                <strong>{choice.label}</strong>
                <span>{description}</span>
                <small><b>风险</b>{risk}</small>
                <small className="is-reward"><b>收益</b>{reward}</small>
                {successHint && <em>{successHint}</em>}
              </button>
            )
          })}
        </div>
      )}

      {showSubstitutions && (
        <div className="broadcast-substitution-backdrop" onPointerDown={closeSubstitutionEditor}>
          <aside
            id="broadcast-substitution-drawer"
            className="broadcast-substitutions"
            aria-label="换人调整"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>{broadcast.teams.red.name} · {runtimeActors.sides?.red?.formation || redTeam?.defaultFormation || '4-3-3'}</small>
                <strong>阵型换人</strong>
              </div>
              <span>{substitutionWindowsLeft} 次窗口 · {substitutionPlayersLeft} 人名额</span>
              <button
                type="button"
                className="broadcast-drawer-guide"
                aria-label="打开换人新手指引"
                onClick={() => requestContextTour(SPOTLIGHT_TOURS.substitutions.id)}
              >?</button>
              <button type="button" aria-label="关闭换人调整" onClick={closeSubstitutionEditor}>×</button>
            </header>

            <section className="broadcast-formation-pitch" aria-label="场上阵型" data-guide="substitution-pitch">
              <div className="broadcast-pitch-markings" aria-hidden="true">
                <i className="is-halfway" /><i className="is-circle" /><i className="is-box-top" /><i className="is-box-bottom" />
              </div>
              {substitutionBoard.active.map((player) => {
                const pendingSwap = pendingSwapByOutgoingId.get(player.playerId)
                const displayedPlayer = pendingSwap?.incoming || player
                return (
                  <button
                    type="button"
                    className={`broadcast-formation-player${selectedOutId === player.playerId ? ' is-selected' : ''}${pendingSwap ? ' is-pending' : ''}${draggingInId ? ' is-drop-target' : ''}`}
                    key={player.playerId}
                    style={formationLayouts.get(player.playerId)}
                    aria-label={pendingSwap
                      ? `待换入 #${displayedPlayer.number} ${displayedPlayer.name}，替下 #${player.number} ${player.name}`
                      : `场上 #${player.number} ${player.name} ${playerPosition(player)} 体力 ${Math.round(player.state?.stamina ?? 0)}`}
                    aria-pressed={selectedOutId === player.playerId || Boolean(pendingSwap)}
                    onClick={() => chooseOutgoing(player.playerId)}
                    onDragEnter={(event) => event.preventDefault()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropSubstituteOnPlayer(event, player.playerId)}
                  >
                    <small>{pendingSwap ? '换入' : playerPosition(player)}</small>
                    <strong>{displayedPlayer.number}</strong>
                    <span>{displayedPlayer.name}</span>
                    <em>{Math.round(displayedPlayer.state?.stamina ?? displayedPlayer.stamina ?? 0)}</em>
                  </button>
                )
              })}
            </section>

            <section className="broadcast-bench" aria-label="替补席" data-guide="substitution-bench">
              <div className="broadcast-drawer-label">
                <span>替补席 · 拖到阵型中的球员位置</span>
                <small>{availableBench.length} 人可用 · 待换 {pendingSubstitutions.length} 人</small>
              </div>
              <div className="broadcast-bench-list">
                {substitutionBenchPreview.map((player) => (
                  <button
                    type="button"
                    draggable={player.previewRole === 'available'}
                    className={`${selectedInId === player.playerId ? 'is-selected' : ''}${player.previewRole === 'pending-out' ? ' is-pending-out' : ''}`}
                    key={`${player.previewRole}:${player.playerId}`}
                    aria-label={player.previewRole === 'pending-out'
                      ? `待换下 #${player.number} ${player.name}`
                      : `替补 #${player.number} ${player.name} ${player.naturalPosition} 体力 ${Math.round(player.state?.stamina ?? 0)}`}
                    aria-pressed={selectedInId === player.playerId}
                    onDragStart={(event) => {
                      if (player.previewRole !== 'available') return
                      event.dataTransfer?.setData('text/plain', player.playerId)
                      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
                      draggingInIdRef.current = player.playerId
                      setDraggingInId(player.playerId)
                    }}
                    onDragEnd={() => {
                      draggingInIdRef.current = null
                      setDraggingInId(null)
                    }}
                    onClick={() => {
                      if (player.previewRole === 'pending-out') {
                        setPendingSubstitutions((current) => current.filter((swap) => (
                          swap.outgoing.playerId !== player.playerId
                        )))
                        return
                      }
                      chooseIncoming(player.playerId)
                    }}
                  >
                    <strong>#{player.number}</strong>
                    <span>{player.name}</span>
                    <small>{player.naturalPosition}</small>
                    <em>{Math.round(player.state?.stamina ?? 0)}</em>
                  </button>
                ))}
              </div>
            </section>

            <footer>
              <span>
                {pendingSubstitutions.length
                  ? `本次已安排 ${pendingSubstitutions.length} 人，确认后统一使用 1 个换人窗口`
                  : '拖拽或依次点选替补与场上球员，可在本次窗口安排多人'}
              </span>
              <button
                type="button"
                disabled={!pendingSubstitutions.length || substitutionWindowsLeft <= 0}
                onClick={confirmSubstitutions}
              >
                确认换人{pendingSubstitutions.length ? `（${pendingSubstitutions.length} 人）` : ''}
              </button>
            </footer>
          </aside>
        </div>
      )}
      {audioStarted && prematchGateClear && !lockerRoom && (
        <SpotlightTour
          tour={matchTour}
          autoStart
          onFinish={handleMatchTourFinish}
          showHelpButton={false}
        />
      )}
      {showTactics && matchTourFinished && (
        <SpotlightTour
          tour={SPOTLIGHT_TOURS.tactics}
          autoStart
          startRequest={contextTourRequest.id === SPOTLIGHT_TOURS.tactics.id ? contextTourRequest.serial : 0}
          showHelpButton={false}
        />
      )}
      {showSubstitutions && matchTourFinished && (
        <SpotlightTour
          tour={SPOTLIGHT_TOURS.substitutions}
          autoStart
          startRequest={contextTourRequest.id === SPOTLIGHT_TOURS.substitutions.id ? contextTourRequest.serial : 0}
          showHelpButton={false}
        />
      )}
    </main>
  )
}
