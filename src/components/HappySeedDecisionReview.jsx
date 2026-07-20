import { useEffect, useMemo, useRef, useState } from 'react'
import { DECISION_LIBRARY } from '../data/decisionLibrary.js'
import {
  DECISION_PRESENTATION_MODES,
  getFormalDecisionSceneContractV3,
} from '../utils/formalDecisionSceneCatalogV3.js'
import {
  bootHappySeedMatch,
  cancelFormalCoachDecision,
  createFormalCoachDecision,
  executeFormalCoachDecisionChoice,
  getDecisionDirectorSnapshot,
  getGame,
  getPitch,
  getSnapshot,
  prepareFormalCoachDecision,
  resetZoom,
  setZoom,
  subscribeToRuntimeMatchEvents,
  withDecisionWatchdog,
} from '../services/happySeedMatchRuntime.js'
import { getMatchEventArtwork } from '../utils/matchEventArtwork.js'
import { resolveFormalCoachDecisionRule } from '../utils/formalCoachDecision.js'
import { buildHappySeedRuntimeActorConfig } from '../utils/happySeedRuntimeActors.js'
import {
  buildDecisionSceneTestMoment,
  decisionSceneTestWeather,
} from '../utils/decisionSceneTestMoments.js'

const MODE_META = {
  [DECISION_PRESENTATION_MODES.LIVE]: ['实时机会', '原地冻结，不搬动球员或足球'],
  [DECISION_PRESENTATION_MODES.STAGED]: ['定位球', '真实死球后闪黑重排'],
  [DECISION_PRESENTATION_MODES.INCIDENT]: ['事故判罚', '冻结接触现场或人员状态'],
  [DECISION_PRESENTATION_MODES.MATCH_STATE]: ['比赛状态', '使用阵型、区域和人员箭头'],
}

const AFFORDANCE_LABELS = {
  'ball-path': '球路',
  'run-lane': '跑位',
  'duel-vector': '对抗',
  zone: '区域',
  actor: '人员',
  formation: '阵型',
}

const INTENT_LABELS = {
  'switch-wide': '转移到边路接应者',
  'cross-high': '由边路接应者传中',
  'show-touchline': '贴身移动并把持球者逼向边线',
  'slide-contact': '在当前接触点放铲',
  'last-man-tackle': '最后防守者在当前接触点放铲',
  'tactical-contact': '主动制造身体接触',
  'substitution-out': '执行真实名单换人',
  'team-appeal': '多名球员向裁判申诉',
  'captain-referee': '队长单独与裁判沟通',
  'contain-channel': '封住射门角度并向边路引导',
  'restart-shape': '恢复比赛站位',
}

function executionSummary(contract, choiceId) {
  return (contract.choices[choiceId] || []).map((item) => (
    INTENT_LABELS[item.intent]
      || `${AFFORDANCE_LABELS[item.kind] || item.kind}：${item.intent}`
  )).join(' → ')
}

function sourceEventFor(scenarioId) {
  const contract = getFormalDecisionSceneContractV3(scenarioId)
  const type = contract.sourceEventTypes?.[0] || 'touch'
  return {
    schemaVersion: 'match-runtime-event-v1',
    id: `review.${scenarioId}.${Date.now()}`,
    type,
    sourceEventId: ['foul', 'offside', 'card', 'injury', 'handball-review', 'var-review', 'throw-in-violation', 'penalty'].includes(type)
      ? `review.source.${Date.now()}`
      : null,
    frameId: 0,
    matchTime: 0,
    minute: 45,
    side: contract.sourceEventSide || contract.attackingSide || 'red',
    actorRuntimeIds: [],
    ball: { before: [0.5, 0.5, 0], after: [0.5, 0.5, 0] },
    runtimeStateBefore: 'Match',
    runtimeStateAfter: 'Match',
    detail: { acceptanceReview: true },
  }
}

export default function HappySeedDecisionReview() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const initialScenarioId = DECISION_LIBRARY.some((item) => item.id === params.get('scenario'))
    ? params.get('scenario')
    : DECISION_LIBRARY[0].id
  const [scenarioId, setScenarioId] = useState(initialScenarioId)
  const [choiceId, setChoiceId] = useState('')
  const [outcomeId, setOutcomeId] = useState('')
  const [decision, setDecision] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [status, setStatus] = useState('正在加载统一 11v11 Runtime…')
  const [error, setError] = useState('')
  const [matchSnapshot, setMatchSnapshot] = useState(() => getSnapshot())
  const [eventArtwork, setEventArtwork] = useState(null)
  const [preparedScript, setPreparedScript] = useState(null)
  const [executionReport, setExecutionReport] = useState(null)
  const [directorSnapshot, setDirectorSnapshot] = useState(null)
  const [runtimeDecisionEvents, setRuntimeDecisionEvents] = useState([])
  const bootedRef = useRef(false)
  const eventArtworkTimerRef = useRef(null)

  const selectedIndex = DECISION_LIBRARY.findIndex((item) => item.id === scenarioId)
  const scenario = DECISION_LIBRARY[selectedIndex] || DECISION_LIBRARY[0]
  const contract = getFormalDecisionSceneContractV3(scenario.id)
  const selectedChoice = scenario.choices.find((choice) => choice.id === choiceId)
    || scenario.choices[0]
  const selectedOutcome = selectedChoice.possible_outcomes.includes(outcomeId)
    ? outcomeId
    : selectedChoice.possible_outcomes[0]
  const modeMeta = MODE_META[contract.mode] || ['待校准', '']
  const primaryName = decision?.coachDecisionEvent?.keyPlayers?.primary?.name || '本方球员'
  const interpolateReviewCopy = (value) => String(value || '')
    .replaceAll('{player}', primaryName)
    .replaceAll('{opponent}', matchSnapshot.blue?.name || '对方球员')

  const actorSource = useMemo(() => buildHappySeedRuntimeActorConfig({
    red: params.get('red') || 'france',
    blue: params.get('blue') || 'brazil',
  }), [params])

  // 把 22 名球员和足球真实传送到标准摆位，执行时不再从错误的现场位置起跳
  const teleportRuntimeToMoment = (moment) => {
    const pitch = getPitch()
    const game = getGame()
    if (!pitch || !game) return
    const entries = game.stadium?._happySeedActorEntries || []
    moment.actorPositions.forEach((position) => {
      const entry = entries.find((candidate) => (
        candidate.actor?.runtimeActorId === position.runtimeActorId
      ))
      if (!entry?.entity?.position) return
      entry.entity.position.x = pitch.width * position.normalized[0]
      entry.entity.position.y = pitch.height * position.normalized[1]
      entry.entity.position.z = 0
      if (entry.entity.velocity) {
        entry.entity.velocity.x = 0
        entry.entity.velocity.y = 0
        entry.entity.velocity.z = 0
      }
      if (entry.entity.heading && position.facing) {
        entry.entity.heading.x = position.facing === 'left' ? -1 : 1
        entry.entity.heading.y = 0
      }
    })
    const ballSpot = moment.ball.normalized
    try {
      pitch.ball.placeAtPosition?.(
        pitch.width * ballSpot[0],
        pitch.height * ballSpot[1],
        Math.max(pitch.ball.radius || 0.12, ballSpot[2] || 0.12),
      )
      if (moment.ballInHands) {
        const keeperEntry = entries.find((candidate) => (
          candidate.actor?.runtimeActorId === moment.ownerRuntimeActorId
        ))
        keeperEntry?.entity?.forceTrap?.(pitch.ball)
      }
    } catch {
      // 传送失败不阻塞场景准备：脚本仍按标准瞬间生成
    }
  }

  useEffect(() => {
    if (bootedRef.current) return undefined
    bootedRef.current = true
    bootHappySeedMatch({
      technicalLab: true,
      red: params.get('red') || 'france',
      blue: params.get('blue') || 'brazil',
      time: 3,
      ai: 2,
    }).then(() => {
      setStatus('Runtime 已就绪，选择场景后点击“摆入场景”')
      setMatchSnapshot(getSnapshot())
    }).catch((bootError) => {
      console.error(bootError)
      setError(bootError.message || '比赛 Runtime 启动失败')
    })
    return () => cancelFormalCoachDecision()
  }, [params])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMatchSnapshot(getSnapshot())
      const nextDirectorSnapshot = getDecisionDirectorSnapshot()
      setDirectorSnapshot(nextDirectorSnapshot)
      setPhase(nextDirectorSnapshot?.phase || 'idle')
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => subscribeToRuntimeMatchEvents((event) => {
    if (event.detail?.decision) {
      setRuntimeDecisionEvents((current) => [...current, {
        id: event.id,
        type: event.type,
        actorRuntimeId: event.primaryRuntimeActorId || null,
        sourceEventId: event.sourceEventId || null,
        scenarioId: event.detail.scenarioId || null,
        choiceId: event.detail.choiceId || null,
        role: event.detail.role || null,
      }].slice(-12))
    }
    const artwork = getMatchEventArtwork(event)
    if (!artwork) return
    if (eventArtworkTimerRef.current) window.clearTimeout(eventArtworkTimerRef.current)
    setEventArtwork(artwork)
    eventArtworkTimerRef.current = window.setTimeout(() => {
      setEventArtwork((current) => current?.eventId === artwork.eventId ? null : current)
      eventArtworkTimerRef.current = null
    }, event.type === 'card' ? 2100 : 1700)
  }), [])

  useEffect(() => () => {
    if (eventArtworkTimerRef.current) window.clearTimeout(eventArtworkTimerRef.current)
  }, [])

  const selectScenario = (nextScenarioId) => {
    cancelFormalCoachDecision()
    setDecision(null)
    setPreparedScript(null)
    setExecutionReport(null)
    setRuntimeDecisionEvents([])
    setScenarioId(nextScenarioId)
    setChoiceId('')
    setOutcomeId('')
    setPhase('idle')
    setError('')
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('scenario', nextScenarioId)
    window.history.replaceState({}, '', nextUrl)
  }

  const prepare = async () => {
    try {
      setError('')
      cancelFormalCoachDecision()
      setStatus('正在按场景合同摆放 22 人与足球…')
      const nextDecision = createFormalCoachDecision(selectedIndex, {
        technicalCatalog: true,
        scenarioId: scenario.id,
        minute: matchSnapshot.minute || 45,
      })
      const captured = buildDecisionSceneTestMoment(scenario.id, actorSource)
      window.__happySeedWeather = decisionSceneTestWeather(scenario.id)
      teleportRuntimeToMoment(captured)
      setPhase('staging')
      const prepared = await prepareFormalCoachDecision(
        nextDecision,
        captured,
        sourceEventFor(scenario.id),
      )
      setDecision(nextDecision)
      setPreparedScript(prepared.script)
      setExecutionReport(null)
      setRuntimeDecisionEvents([])
      const preparedChoice = nextDecision.choices.find((choice) => choice.id === selectedChoice.id)
        || nextDecision.choices[0]
      const preparedOutcome = preparedChoice.possible_outcomes.includes(selectedOutcome)
        ? selectedOutcome
        : preparedChoice.possible_outcomes[0]
      setChoiceId(preparedChoice.id)
      setOutcomeId(preparedOutcome)
      setPhase('choosing')
      setStatus(`已摆入：${scenario.trigger}`)
    } catch (prepareError) {
      cancelFormalCoachDecision()
      setPhase('idle')
      setError(prepareError.message || '场景准备失败')
    }
  }

  const execute = async () => {
    if (!decision) return
    try {
      setError('')
      setPhase('executing')
      const execution = executeFormalCoachDecisionChoice(decision, selectedChoice.id, {
        outcomeOverride: selectedOutcome,
      })
      const settled = await withDecisionWatchdog(execution.settled)
      setPhase('settled')
      await withDecisionWatchdog(execution.completed)
      setExecutionReport(settled.resolution)
      setDecision(null)
      setPhase('idle')
      setStatus(settled.resolution.resultText)
    } catch (executeError) {
      if (executeError?.recovered) {
        cancelFormalCoachDecision()
        setDecision(null)
        setPhase('idle')
      }
      setError(executeError.message || '结果执行失败')
    }
  }

  const preparedChoiceScript = preparedScript?.choices.find((item) => (
    item.id === selectedChoice.id
  ))
  const preparedOutcomeScript = preparedChoiceScript?.outcomes?.[selectedOutcome]
  const expectedRuntimeEvents = preparedOutcomeScript
    ? [
      preparedOutcomeScript.runtimeBallEventType,
      ...(preparedOutcomeScript.secondaryRuntimeEvents || []).map((event) => event.type),
    ].filter(Boolean)
    : []
  const actualRuntimeEvents = runtimeDecisionEvents
    .filter((event) => (
      event.scenarioId === scenario.id && event.choiceId === selectedChoice.id
    ))
  const [catalogOpen, setCatalogOpen] = useState(true)
  const phaseLabel = {
    idle: '待摆入',
    staging: '准备',
    choosing: '选择',
    executing: '执行',
    settled: '完成',
    completed: '完成',
    cancelled: '已取消',
  }[phase] || phase

  return (
    <main className="decision-review">
      <div id="gui" className="decision-review-runtime" aria-hidden="true">
        <canvas id="forceRefreshCanvas1" width="1" height="1" />
        <canvas id="forceRefreshCanvas2" width="1" height="1" />
      </div>

      {eventArtwork && (
        <aside
          className="decision-review-event-artwork"
          data-event-artwork={eventArtwork.label}
          aria-label={`${eventArtwork.minute} 分钟 ${eventArtwork.label}`}
        >
          <img src={eventArtwork.src} alt="" />
          <span><strong>{eventArtwork.label}</strong><small>{eventArtwork.minute}&apos;</small></span>
        </aside>
      )}

      <div className="decision-review-topbar">
        <span className="decision-review-score" aria-label="当前比赛比分">
          {matchSnapshot.red?.name || '法国'} <b>{matchSnapshot.red?.score || 0} : {matchSnapshot.blue?.score || 0}</b> {matchSnapshot.blue?.name || '巴西'} · {matchSnapshot.minute || 0}&apos;
        </span>
        <a href="/happyseed-runtime.html" className="decision-review-exit">返回正式比赛</a>
      </div>

      <button
        type="button"
        className={`decision-review-catalog-toggle${catalogOpen ? ' is-open' : ''}`}
        onClick={() => setCatalogOpen((open) => !open)}
        aria-expanded={catalogOpen}
      >
        场景目录 · {String(selectedIndex + 1).padStart(2, '0')}/53
      </button>
      {catalogOpen && (
        <aside className="decision-review-catalog" aria-label="53 项决策目录">
          <div className="decision-review-list">
            {DECISION_LIBRARY.map((item, index) => {
              const itemContract = getFormalDecisionSceneContractV3(item.id)
              const itemMode = MODE_META[itemContract.mode]?.[0] || '待校准'
              return (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === scenario.id ? 'is-active' : ''}
                  onClick={() => selectScenario(item.id)}
                >
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <span><strong>{item.trigger}</strong><small>{itemMode}</small></span>
                </button>
              )
            })}
          </div>
        </aside>
      )}

      <aside className="decision-review-heading broadcast-decision-v3 is-right" aria-label="当前场景">
        <div className="broadcast-decision-heading">
          <span>{modeMeta[0]} · {String(selectedIndex + 1).padStart(2, '0')}/53</span>
          <strong>{scenario.trigger}</strong>
        </div>
        <div className={`broadcast-stopwatch${['choosing', 'executing'].includes(phase) ? ' is-running' : ''}`}>
          <span className="broadcast-stopwatch-crown" aria-hidden="true" />
          <span className="broadcast-stopwatch-face" aria-hidden="true"><i key={phase} /></span>
          <time aria-label={`当前阶段 ${phaseLabel}`}>{phaseLabel}</time>
        </div>
      </aside>

      <div className="decision-review-rail runtime-world-choices is-right">
        {scenario.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={`runtime-world-choice${selectedChoice.id === choice.id ? ' is-selected' : ''}`}
            onClick={() => {
              setChoiceId(choice.id)
              setOutcomeId(choice.possible_outcomes[0])
            }}
          >
            <strong>{choice.label}</strong>
            <span>{interpolateReviewCopy(choice.desc)}</span>
            <small><b>风险</b>{interpolateReviewCopy(choice.risk)}</small>
            <small className="is-reward"><b>收益</b>{interpolateReviewCopy(choice.reward)}</small>
            {choice.successHint && <em>{interpolateReviewCopy(choice.successHint)}</em>}
          </button>
        ))}

        <article className="decision-review-lab-card">
          <dl>
            <div>
              <dt>执行顺序</dt>
              <dd>{executionSummary(contract, selectedChoice.id)}</dd>
            </div>
            {preparedScript && (
              <div>
                <dt>运行方式</dt>
                <dd>{preparedScript.choices.find((item) => item.id === selectedChoice.id)
                  ?.outcomes?.[selectedOutcome]?.executionMode || 'semantic-action'}</dd>
              </div>
            )}
            {preparedOutcomeScript?.liveShot && (
              <div>
                <dt>原生踢球</dt>
                <dd>
                  {`力量 ${preparedOutcomeScript.liveShot.power} · 仰角 ${preparedOutcomeScript.liveShot.elevate}rad · 瞄点 [${preparedOutcomeScript.liveShot.aim.map((v) => Number(v).toFixed(2)).join(', ')}]`}
                </dd>
              </div>
            )}
            {preparedOutcomeScript && (
              <div>
                <dt>事件合同</dt>
                <dd>{expectedRuntimeEvents.length
                  ? expectedRuntimeEvents.join(' → ')
                  : preparedOutcomeScript.carriesBall
                    ? '持球移动，终点由死球或规则副作用接管'
                    : '规则结果，无足球事件'}</dd>
              </div>
            )}
          </dl>
          <label>
            验收结果分支
            <select value={selectedOutcome} onChange={(event) => setOutcomeId(event.target.value)}>
              {[...new Set(selectedChoice.possible_outcomes)].map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}{decision ? ` · ${resolveFormalCoachDecisionRule(decision, selectedChoice.id, {
                    outcomeOverride: outcome,
                  }).resultText}` : ''}
                </option>
              ))}
            </select>
          </label>
          {executionReport && (
            <div
              className="decision-review-execution-report"
              data-expected-runtime-events={expectedRuntimeEvents.join(',')}
              data-actual-runtime-events={actualRuntimeEvents.map((event) => event.type).join(',')}
              data-final-source-actor={preparedOutcomeScript?.sourceRuntimeActorId || ''}
              data-initial-source-actor={preparedOutcomeScript?.initialSourceRuntimeActorId || ''}
            >
              <strong>本次实际落地</strong>
              <p>{executionReport.resultText}</p>
              <small>
                {executionReport.runtimeEffect?.type === 'substitution'
                  ? `已完成真实换人：${executionReport.runtimeEffect.incoming.name} 替下 ${executionReport.runtimeEffect.outgoing.name}`
                  : executionReport.runtimeEffect?.type === 'corner-restart'
                    ? `已进入真实角球重开：${executionReport.runtimeEffect.side === 'red' ? '本方' : '对方'}主罚`
                  : `已发出 ${executionReport.runtimeConsequences?.length || 0} 条同源比赛事件`}
              </small>
              <small className="decision-review-runtime-trace">
                场内事件：{actualRuntimeEvents.length
                  ? actualRuntimeEvents.map((event) => event.type).join(' → ')
                  : preparedOutcomeScript?.carriesBall
                    ? '持球位移已执行，未伪造额外触球事件'
                    : '无足球事件（仅规则或人员副作用）'}
              </small>
              {directorSnapshot?.performedActions && (
                <small className="decision-review-runtime-trace">
                  动作 cue：{Object.values(directorSnapshot.performedActions).join(' → ') || '无角色动作'}
                </small>
              )}
            </div>
          )}
          <div className="decision-review-actions">
            <button type="button" className="is-secondary" onClick={() => setZoom(0.82)}>全场</button>
            <button type="button" className="is-secondary" onClick={resetZoom}>复位</button>
            <button type="button" onClick={prepare} disabled={!['idle', 'completed', 'cancelled'].includes(phase)}>
              摆入场景
            </button>
            <button type="button" className="is-primary" onClick={execute} disabled={!decision || phase !== 'choosing'}>
              执行所选结果
            </button>
          </div>
          <div className={`decision-review-status ${error ? 'is-error' : ''}`}>
            {error || `${status} · 导演状态 ${phase}`}
          </div>
        </article>
      </div>
    </main>
  )
}
