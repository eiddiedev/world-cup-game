import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  setFormalCoachDecisionChoiceHover,
  setRuntimeActorState,
  subscribeToMatchEvents,
  subscribeToRuntimeDecisionChoices,
  subscribeToRuntimeMatchEvents,
  substituteRuntimeActor,
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
  startFormalMatchSession,
} from '../utils/formalMatchSession.js'
import { getTeamById } from '../data/teams.js'
import { decisionReadingSeconds } from '../utils/matchRuntimeEvent.js'
import { createMatchSfxBus } from '../utils/matchSfxBus.js'
import { audioManager } from '../utils/audioManager.js'
import { getMatchEventArtwork } from '../utils/matchEventArtwork.js'
import {
  calculateStoppageMinutes,
  formatMatchClock,
  getStoppageInputs,
} from '../utils/matchClock.js'

const SPEEDS = [1, 2, 3]
const MAX_SUBSTITUTION_WINDOWS = 3
const MAX_SUBSTITUTION_PLAYERS = 5
const VAR_REVIEW_DISPLAY_MS = 2800
const VAR_RESULT_DISPLAY_MS = 3000
const DIRECT_GOAL_DISPLAY_MS = 3200
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
  return String(name).replace(/国家队$/, '').slice(0, 3) || '球队'
}

function playerPosition(player) {
  return player.assignedPosition || player.naturalPosition || player.position || 'MF'
}

function teamFlagUrl(team) {
  const name = String(team?.name || '').replace(/国家队$/, '')
  return name ? `/assets/国旗/${name}.png` : ''
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

export function HappySeedMatchBroadcast({ saveData = null, onMatchComplete = null }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const coachDecisionMode = useMemo(() => (
    params.get('events') !== 'manual'
    && params.get('events') !== 'auto'
    && params.get('decisions') !== 'off'
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
  const [paused, setPaused] = useState(false)
  const [speed, setSelectedSpeed] = useState(1)
  const [showStats, setShowStats] = useState(false)
  const [showSubstitutions, setShowSubstitutions] = useState(false)
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
  const bootedRef = useRef(false)
  const decisionChoiceLockedRef = useRef(false)
  const decisionRunIdRef = useRef(0)
  const sessionRef = useRef(matchSession)
  const runtimeMomentRef = useRef(null)
  const completedReportedRef = useRef(false)
  const runtimeEventQueueRef = useRef([])
  const runtimeIncidentTimersRef = useRef(new Set())
  const eventArtworkTimerRef = useRef(null)
  const goalPresentationHeldRef = useRef(false)
  const lastDecisionTickRef = useRef(null)
  const secondHalfStoppageBaselineRef = useRef(null)
  const draggingInIdRef = useRef(null)
  const [sfxBus] = useState(() => createMatchSfxBus())

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
    if (eventArtworkTimerRef.current) window.clearTimeout(eventArtworkTimerRef.current)
    setEventArtwork(artwork)
    eventArtworkTimerRef.current = window.setTimeout(() => {
      setEventArtwork((current) => current?.eventId === artwork.eventId ? null : current)
      eventArtworkTimerRef.current = null
    }, Number(artwork.holdMs || 1700))
  }, [])

  useEffect(() => {
    audioManager.prepareMatchAudio()
  }, [])

  useEffect(() => {
    if (!audioStarted) return undefined
    if (bootedRef.current) return undefined
    bootedRef.current = true
    bootHappySeedMatch({
      red: redTeamId,
      blue: blueTeamId,
      redFormation: currentRun?.formation,
      redSquadPlayerIds: currentRun?.roster || currentRun?.purchasedPlayerIds || [],
      redLineupPlayerIds: currentRun?.lineup || [],
      playerMode: false,
      ai: params.has('ai') ? Number(params.get('ai')) : 2,
      time: params.has('time') ? Number(params.get('time')) : FORMAL_MATCH_REALTIME_MINUTES,
    }).then(() => {
      setStatus('比赛进行中 · 正式 MatchSession 已接管时间、比分与播报')
      setSnapshot(getSnapshot())
      setVisualEvents(getMatchVisualEventSnapshot())
      setRuntimeActors(getRuntimeActorSnapshot())
      setStadiumScene(getStadiumSceneSnapshot())
      commitSession((current) => startFormalMatchSession(current))
    }).catch((bootError) => {
      console.error(bootError)
      setError(bootError.message || '比赛引擎启动失败')
    })
    return undefined
  }, [audioStarted, blueTeamId, commitSession, currentRun, params, redTeamId])

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
        const finished = commitSession((current) => finalizeFormalMatchSession(
          current,
          new Date().toISOString(),
          event.detail?.runtimeEventId || null,
        ))
        setStatus(`终场 · ${finished.score.red}:${finished.score.blue} · 本场 ${finished.decisions.length} 次决策`)
        if (onMatchComplete && !completedReportedRef.current) {
          completedReportedRef.current = true
          window.setTimeout(() => onMatchComplete({
            session: finished,
            report: buildFormalMatchSessionReport(finished),
            actorSnapshot: getRuntimeActorSnapshot(),
          }), 900)
        }
      }
      if (event.type === 'ab-runtime-substitution') setStatus('换人已同步到场上')
    })
    return unsubscribe
  }, [commitSession, onMatchComplete, showEventArtwork])

  useEffect(() => {
    const holdGoalPresentation = () => {
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
      sfxBus.consume(presentedEvent)
      if (options.artwork !== false) showEventArtwork(presentedEvent)
    }

    const unsubscribe = subscribeToRuntimeMatchEvents((sourceEvent) => {
      const derivedEvents = deriveFormalRuntimeIncidents(sourceEvent)
      if (sourceEvent.type === 'goal') {
        const reviewEvent = derivedEvents.find((event) => event.type === 'var-review')
        const resultEvent = derivedEvents.find((event) => event.type === 'var-result')
        holdGoalPresentation()
        if (!reviewEvent || !resultEvent) {
          deliverRuntimeEvent(sourceEvent)
          scheduleRuntimeIncident(releaseGoalPresentation, DIRECT_GOAL_DISPLAY_MS)
          return
        }

        // A reviewed goal has one visual timeline: checking -> GOAL / NO GOAL.
        // The underlying goal event still reaches the factual queue, but its generic
        // artwork cannot replace the authored VAR checking screen.
        deliverRuntimeEvent(sourceEvent, { artwork: false })
        deliverRuntimeEvent(reviewEvent)
        scheduleRuntimeIncident(() => {
          deliverRuntimeEvent(resultEvent)
          scheduleRuntimeIncident(releaseGoalPresentation, VAR_RESULT_DISPLAY_MS)
        }, VAR_REVIEW_DISPLAY_MS)
        return
      }

      deliverRuntimeEvent(sourceEvent)
      derivedEvents.forEach((derivedEvent) => deliverRuntimeEvent(derivedEvent))
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
    if (!plan || !runtimeMoment) return
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
      await prepareFormalCoachDecision(decision, runtimeMoment, plan.sourceEvent)
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
  }, [commitSession, params])

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
      const { resolution } = await execution.settled
      if (decisionRunIdRef.current !== runId) return
      const settledSession = commitSession((current) => (
        settleFormalDecisionInSession(current, coachDecision, resolution)
      ))
      setDecisionPhase('settled')
      setStatus(resolution.resultText)
      await execution.completed
      if (decisionRunIdRef.current !== runId) return
      setCoachDecision(null)
      setPendingDecisionPlan(null)
      setDecisionPhase('idle')
      setStatus(`${resolution.resultText} · 已恢复连续比赛（${settledSession.decisions.length}/5）`)
    } catch (decisionError) {
      if (decisionRunIdRef.current !== runId) return
      console.error(decisionError)
      setDecisionPhase('error')
      setError(decisionError.message || '教练决策结果播放失败')
    }
  }, [coachDecision, commitSession, decisionPhase])

  useEffect(() => subscribeToRuntimeDecisionChoices(({ choiceId }) => {
    if (choiceId) handleCoachChoice(choiceId)
  }), [handleCoachChoice])

  useEffect(() => {
    if (
      !coachDecisionMode
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

  useEffect(() => () => {
    decisionRunIdRef.current += 1
    cancelFormalCoachDecision()
    if (eventArtworkTimerRef.current) window.clearTimeout(eventArtworkTimerRef.current)
  }, [])

  const latestLine = broadcast.commentary[broadcast.commentary.length - 1]
  const decisionInteractionLocked = ['staging', 'choosing', 'executing', 'settled'].includes(decisionPhase)
  const decisionProgress = Math.min(
    matchSession.targetDecisionCount,
    matchSession.decisions.length + (coachDecision ? 1 : 0),
  )
  const decisionPrimaryName = coachDecision?.coachDecisionEvent?.keyPlayers?.primary?.name
    || coachDecision?.keyPlayers?.default?.name
    || '主罚球员'
  const interpolateChoiceText = (value) => String(value || '')
    .replaceAll('{player}', decisionPrimaryName)
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

      {!audioStarted && (
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
          className="broadcast-event-artwork"
          data-event-artwork={eventArtwork.label}
          data-event-artwork-src={eventArtwork.src}
          key={eventArtwork.eventId}
          aria-label={`${eventArtwork.minute} 分钟 ${eventArtwork.headline}`}
        >
          <img src={eventArtwork.src} alt="" />
          <span>
            <strong>{eventArtwork.headline}</strong>
            <small>{eventArtwork.label} · {eventArtwork.minute}&apos;</small>
          </span>
        </aside>
      )}

      <header className="broadcast-scoreboard" aria-label="比赛比分">
        <div
          className={`broadcast-scoreboard-strip${showStats ? ' is-expanded' : ''}`}
        >
          <span className="broadcast-team is-home">
            <img src={teamFlagUrl(redTeam)} alt={`${broadcast.teams.red.name}国旗`} />
            <b>{teamAbbreviation(broadcast.teams.red.name)}</b>
          </span>
          <strong className="is-home-score">{broadcast.teams.red.score}</strong>
          <span className="broadcast-cup-mark" aria-hidden="true">
            <img src="/assets/hud/world-cup-trophy.png" alt="" />
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

      <section
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
      </section>

      <div className="broadcast-status" aria-live="polite">
        <span className={error ? 'is-error' : ''}>{error || status}</span>
        <small>
          {coachDecisionMode
            ? `${decisionProgress}/${matchSession.targetDecisionCount} 正式决策`
            : `${broadcast.completedCount}/${broadcast.totalCount} 关键回合`}
        </small>
      </div>

      <nav className="broadcast-controls" aria-label="比赛控制">
        <button type="button" className="broadcast-pause-button" disabled={decisionInteractionLocked} onClick={togglePause}>
          <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
          <b>{paused ? '继续' : '暂停'}</b>
        </button>
        <button type="button" className="broadcast-speed-button" disabled={decisionInteractionLocked} onClick={cycleSpeed}>
          <b>{speed}×</b>
        </button>
      </nav>

      <button
        type="button"
        className="broadcast-substitution-trigger"
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
      </button>

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
              <button type="button" aria-label="关闭换人调整" onClick={closeSubstitutionEditor}>×</button>
            </header>

            <section className="broadcast-formation-pitch" aria-label="场上阵型">
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
                      : `场上 #${player.number} ${player.name} ${playerPosition(player)} 体力 ${player.state?.stamina ?? 0}`}
                    aria-pressed={selectedOutId === player.playerId || Boolean(pendingSwap)}
                    onClick={() => chooseOutgoing(player.playerId)}
                    onDragEnter={(event) => event.preventDefault()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropSubstituteOnPlayer(event, player.playerId)}
                  >
                    <small>{pendingSwap ? '换入' : playerPosition(player)}</small>
                    <strong>{displayedPlayer.number}</strong>
                    <span>{displayedPlayer.name}</span>
                    <em>{displayedPlayer.state?.stamina ?? displayedPlayer.stamina ?? 0}</em>
                  </button>
                )
              })}
            </section>

            <section className="broadcast-bench" aria-label="替补席">
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
                      : `替补 #${player.number} ${player.name} ${player.naturalPosition} 体力 ${player.state?.stamina ?? 0}`}
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
                    <em>{player.state?.stamina ?? 0}</em>
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
    </main>
  )
}
