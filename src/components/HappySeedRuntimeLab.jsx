import { useEffect, useMemo, useRef, useState } from 'react'
import {
  bootHappySeedMatch,
  cancelFormalCoachDecision,
  captureFormalMatchRuntimeMoment,
  createFormalCoachDecision,
  executeFormalCoachDecisionChoice,
  getHumanSliceSnapshot,
  getMatchVisualEventSnapshot,
  getRuntimeActorSnapshot,
  getSnapshot,
  getStadiumSceneSnapshot,
  injectCorner,
  pauseMatch,
  prepareFormalCoachDecision,
  playMatchVisualEvent,
  playRepresentativeMatchVisualEvents,
  releasePlayerInput,
  resetZoom,
  resetRepresentativeMatchVisualEvents,
  resumeMatch,
  setSpeed,
  setHumanSliceAction,
  setHumanSliceAutoCycle,
  setHumanSliceFacing,
  setHumanSliceProfile,
  selectRuntimeActor,
  setRuntimeActorState,
  setStadiumCameraPreset,
  setStadiumCrowdMotion,
  setZoom,
  subscribeToMatchEvents,
  substituteRuntimeActor,
  updatePlayerInput,
  withDecisionWatchdog,
} from '../services/happySeedMatchRuntime'
import { HAPPYSEED_HUMAN_ACTIONS } from '../utils/happySeedHumanPlayer.js'
import { HAPPYSEED_STADIUM_CAMERA_PRESETS } from '../utils/happySeedPixelStadium.js'
import { DECISION_LIBRARY } from '../data/decisionLibrary.js'
import { getFormalDecisionSceneContractV3 } from '../utils/formalDecisionSceneCatalogV3.js'

const PLAYER_ACTIONS = [
  { label: '传球', input: { pass: true } },
  { label: '挑传', input: { lob: true } },
  { label: '射门', input: { shoot: true } },
  { label: '冲刺', input: { sprint: true } },
  { label: '切换', input: { switchPlayer: true } },
  { label: '铲球', input: { tackle: true } },
]

const EVENT_LABELS = {
  'ab-load-stage': '加载阶段',
  'ab-load-progress': '资源进度',
  'ab-match-started': '比赛开始',
  'ab-human-slice-ready': '人类骨架样板就绪',
  'ab-human-slice-action': '骨架动作切换',
  'ab-stadium-slice-ready': '像素球场切片就绪',
  'ab-stadium-camera': '场景镜头切换',
  'ab-runtime-actors-ready': '22 人业务映射就绪',
  'ab-runtime-actor-state': '球员状态已同步',
  'ab-runtime-substitution': '精确换人已同步',
  'ab-match-visual-events-ready': '统一事件桥就绪',
  'ab-match-visual-event-started': '代表事件开始',
  'ab-match-visual-event-completed': '代表事件完成',
  'ab-kickoff-played': '已经开球',
  'ab-goal': '进球事件',
  'ab-match-ended': '比赛结束',
}

function DirectionButton({ label, vx, vy }) {
  const start = (event) => {
    event.preventDefault()
    updatePlayerInput({ vx, vy })
  }
  const stop = (event) => {
    event.preventDefault()
    updatePlayerInput({ vx: 0, vy: 0 })
  }

  return (
    <button
      className={`runtime-direction runtime-direction-${label}`}
      type="button"
      aria-label={label}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
    >
      {label}
    </button>
  )
}

function ActionButton({ label, input }) {
  const press = (event) => {
    event.preventDefault()
    updatePlayerInput(input)
  }
  const release = (event) => {
    event.preventDefault()
    if (input.shoot || input.sprint) {
      updatePlayerInput({ shoot: false, sprint: false })
    }
  }

  return (
    <button
      className="runtime-action"
      type="button"
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      {label}
    </button>
  )
}

export default function HappySeedRuntimeLab() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const playerMode = params.get('play') === '1'
  const [status, setStatus] = useState('正在准备比赛数据…')
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(false)
  const [selectedSpeed, setSelectedSpeed] = useState(1)
  const [zoom, setZoomState] = useState(1)
  const [snapshot, setSnapshot] = useState(() => getSnapshot())
  const [humanSlice, setHumanSlice] = useState(() => getHumanSliceSnapshot())
  const [stadiumScene, setStadiumScene] = useState(() => getStadiumSceneSnapshot())
  const [runtimeActors, setRuntimeActors] = useState(() => getRuntimeActorSnapshot())
  const [visualEvents, setVisualEvents] = useState(() => getMatchVisualEventSnapshot())
  const [activeLabStage, setActiveLabStage] = useState('events')
  const [events, setEvents] = useState([])
  const [labScenarioId, setLabScenarioId] = useState(
    params.get('scenario') || DECISION_LIBRARY[0].id,
  )
  const [labChoiceId, setLabChoiceId] = useState('')
  const [labOutcomeId, setLabOutcomeId] = useState('')
  const [labDecision, setLabDecision] = useState(null)
  const [labDirectorPhase, setLabDirectorPhase] = useState('idle')
  const bootedRef = useRef(false)

  useEffect(() => {
    const unsubscribe = subscribeToMatchEvents((event) => {
      setEvents((current) => [event, ...current].slice(0, 7))
      if (event.type === 'ab-load-stage') setStatus(String(event.detail || '加载中'))
      if (event.type === 'ab-match-started') setStatus(playerMode ? '球员模式已就绪' : 'AI 对战已就绪')
    })

    return unsubscribe
  }, [playerMode])

  useEffect(() => {
    if (bootedRef.current) return undefined
    bootedRef.current = true

    bootHappySeedMatch({
      technicalLab: true,
      humanSlicePreview: true,
      red: params.get('red') || 'france',
      blue: params.get('blue') || 'brazil',
      playerMode,
      ai: params.has('ai') ? Number(params.get('ai')) : undefined,
      time: params.has('time') ? Number(params.get('time')) : 3,
    }).then(() => {
      setStatus(playerMode ? '球员模式已就绪' : 'AI 对战已就绪')
      setSnapshot(getSnapshot())
    }).catch((bootError) => {
      console.error(bootError)
      setError(bootError.message || '比赛引擎启动失败')
    })

    return () => releasePlayerInput()
  }, [params, playerMode])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSnapshot(getSnapshot())
      setHumanSlice(getHumanSliceSnapshot())
      setStadiumScene(getStadiumSceneSnapshot())
      setRuntimeActors(getRuntimeActorSnapshot())
      setVisualEvents(getMatchVisualEventSnapshot())
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  const togglePause = () => {
    const nextPaused = !paused
    if (nextPaused) pauseMatch()
    else resumeMatch()
    setPaused(nextPaused)
  }

  const handleCornerInjection = () => {
    if (injectCorner('red')) {
      setStatus('本方角球脚本已注入')
    } else {
      setError('角球脚本注入失败')
    }
  }

  const changeSpeed = (nextSpeed) => {
    setSpeed(nextSpeed)
    setSelectedSpeed(nextSpeed)
  }

  const changeZoom = (delta) => {
    const nextZoom = Math.min(1.8, Math.max(0.6, Number((zoom + delta).toFixed(1))))
    setZoom(nextZoom)
    setZoomState(nextZoom)
  }

  const toggleMode = () => {
    const nextParams = new URLSearchParams(window.location.search)
    if (playerMode) nextParams.delete('play')
    else nextParams.set('play', '1')
    window.location.search = nextParams.toString()
  }

  const changeHumanAction = (actionId) => {
    if (setHumanSliceAction(actionId)) setHumanSlice(getHumanSliceSnapshot())
  }

  const changeHumanProfile = (profileId) => {
    if (setHumanSliceProfile(profileId)) setHumanSlice(getHumanSliceSnapshot())
  }

  const changeHumanFacing = (facing) => {
    if (setHumanSliceFacing(facing)) setHumanSlice(getHumanSliceSnapshot())
  }

  const toggleHumanAutoCycle = () => {
    if (setHumanSliceAutoCycle(!humanSlice.autoCycle)) setHumanSlice(getHumanSliceSnapshot())
  }

  const changeStadiumCamera = (presetId) => {
    if (setStadiumCameraPreset(presetId)) setStadiumScene(getStadiumSceneSnapshot())
  }

  const toggleCrowdMotion = () => {
    if (setStadiumCrowdMotion(!stadiumScene.crowdMotion)) setStadiumScene(getStadiumSceneSnapshot())
  }

  const chooseRuntimeActor = (runtimeActorId) => {
    if (selectRuntimeActor(runtimeActorId)) setRuntimeActors(getRuntimeActorSnapshot())
  }

  const patchSelectedRuntimeActor = (patch) => {
    const runtimeActorId = runtimeActors.selectedRuntimeActorId
    if (runtimeActorId && setRuntimeActorState(runtimeActorId, patch)) {
      setRuntimeActors(getRuntimeActorSnapshot())
    }
  }

  const substituteSelectedRuntimeActor = () => {
    const selected = runtimeActors.selectedActor
    const sideData = runtimeActors.sides?.[selected?.side]
    const incoming = sideData?.bench?.find((player) => (
      (player.naturalPosition === 'GK') === selected?.isGoalkeeper
    ))
    if (!selected || !incoming) return
    if (substituteRuntimeActor(selected.side, selected.playerId, incoming.playerId)) {
      setRuntimeActors(getRuntimeActorSnapshot())
    }
  }

  const playOneVisualEvent = async (eventId) => {
    try {
      setError('')
      await playMatchVisualEvent(eventId)
      setVisualEvents(getMatchVisualEventSnapshot())
    } catch (eventError) {
      setError(eventError.message || '代表事件播放失败')
    }
  }

  const playAllVisualEvents = async () => {
    try {
      setError('')
      await playRepresentativeMatchVisualEvents()
      setVisualEvents(getMatchVisualEventSnapshot())
    } catch (eventError) {
      setError(eventError.message || '五事件队列播放失败')
    }
  }

  const resetVisualEvents = () => {
    if (resetRepresentativeMatchVisualEvents()) {
      setVisualEvents(getMatchVisualEventSnapshot())
      setError('')
    }
  }

  const selectedLabScenario = DECISION_LIBRARY.find((scenario) => (
    scenario.id === labScenarioId
  )) || DECISION_LIBRARY[0]
  const selectedLabChoice = selectedLabScenario.choices.find((choice) => (
    choice.id === labChoiceId
  )) || selectedLabScenario.choices[0]
  const selectedLabOutcome = selectedLabChoice.possible_outcomes.includes(labOutcomeId)
    ? labOutcomeId
    : selectedLabChoice.possible_outcomes[0]

  const prepareLabDecision = async () => {
    try {
      const runtimeMoment = captureFormalMatchRuntimeMoment()
      if (!runtimeMoment) throw new Error('等待 22 人与足球进入可采样状态')
      const decision = createFormalCoachDecision(0, {
        technicalCatalog: true,
        scenarioId: selectedLabScenario.id,
        minute: snapshot.minute,
      })
      const contract = getFormalDecisionSceneContractV3(selectedLabScenario.id)
      const sourceEvent = {
        id: `lab.${selectedLabScenario.id}.${Date.now()}`,
        type: contract.sourceEventTypes?.[0] || 'touch',
      }
      setLabDirectorPhase('staging')
      await prepareFormalCoachDecision(decision, runtimeMoment, sourceEvent)
      setLabDecision(decision)
      setLabChoiceId(decision.choices[0].id)
      setLabOutcomeId(decision.choices[0].possible_outcomes[0])
      setLabDirectorPhase('choosing')
      setStatus(`V3 Lab 已准备：${selectedLabScenario.trigger}`)
    } catch (directorError) {
      cancelFormalCoachDecision()
      setLabDirectorPhase('idle')
      setError(directorError.message || 'V3 场景准备失败')
    }
  }

  const executeLabDecision = async () => {
    if (!labDecision) return
    try {
      setLabDirectorPhase('executing')
      const execution = executeFormalCoachDecisionChoice(
        labDecision,
        selectedLabChoice.id,
        { outcomeOverride: selectedLabOutcome },
      )
      await withDecisionWatchdog(execution.settled)
      setLabDirectorPhase('settled')
      await withDecisionWatchdog(execution.completed)
      setLabDecision(null)
      setLabDirectorPhase('idle')
      setStatus(`V3 outcome 已执行：${selectedLabOutcome}`)
    } catch (directorError) {
      if (directorError?.recovered) {
        cancelFormalCoachDecision()
        setLabDecision(null)
        setLabDirectorPhase('idle')
      }
      setError(directorError.message || 'V3 outcome 执行失败')
    }
  }

  const inspectedVisualEvent = visualEvents.events.find((event) => (
    event.id === (visualEvents.activeEventId || visualEvents.lastCompletedEventId)
  )) || visualEvents.events[0]

  const activeStageMeta = activeLabStage === 'director'
    ? ['V3', '53 场景决策导演逐项验收']
    : activeLabStage === 'events'
    ? ['阶段 5', '统一 MatchVisualEvent']
    : activeLabStage === 'actors'
    ? ['阶段 4', '22 人角色数据映射']
    : activeLabStage === 'stadium'
      ? ['阶段 3', '像素球场场景切片']
      : ['阶段 2', '人类骨架兼容切片']

  return (
    <main className="happyseed-runtime-lab">
      <div id="gui" className="gui" aria-hidden="true">
        <canvas id="forceRefreshCanvas1" width="1" height="1" />
        <canvas id="forceRefreshCanvas2" width="1" height="1" />
      </div>

      <header className="runtime-scoreboard">
        <div className="runtime-team runtime-team-red">
          <strong>{snapshot.red.name}</strong>
          <span>{snapshot.red.possession}% 控球</span>
        </div>
        <div className="runtime-score">
          <strong>{snapshot.red.score} : {snapshot.blue.score}</strong>
          <span>{snapshot.minute}&apos;</span>
        </div>
        <div className="runtime-team runtime-team-blue">
          <strong>{snapshot.blue.name}</strong>
          <span>{snapshot.blue.possession}% 控球</span>
        </div>
      </header>

      <aside className="runtime-diagnostics" aria-live="polite">
        <div className="runtime-diagnostics-heading">
          <strong>运行时验证</strong>
          <span className={error ? 'runtime-status-error' : ''}>{error || status}</span>
        </div>
        <dl>
          <div><dt>阵容</dt><dd>{snapshot.red.playerCount} vs {snapshot.blue.playerCount}</dd></div>
          <div><dt>射门</dt><dd>{snapshot.red.shots} : {snapshot.blue.shots}</dd></div>
          <div><dt>传球</dt><dd>{snapshot.red.passes} : {snapshot.blue.passes}</dd></div>
          <div><dt>角球</dt><dd>{snapshot.red.corners} : {snapshot.blue.corners}</dd></div>
          <div><dt>模式</dt><dd>{playerMode ? '球员操控' : 'AI 观战'}</dd></div>
        </dl>
        <ol className="runtime-events">
          {events.map((event) => (
            <li key={event.id}>
              {EVENT_LABELS[event.type] || event.type}
            </li>
          ))}
        </ol>
      </aside>

      <aside className="runtime-slice-panel" aria-label="Match Runtime 分阶段验收">
        <div className="runtime-slice-panel-heading">
          <div>
            <span>{activeStageMeta[0]}</span>
            <strong>{activeStageMeta[1]}</strong>
          </div>
          <div className="runtime-slice-tabs" role="tablist" aria-label="验收阶段">
            <button
              type="button"
              role="tab"
              aria-selected={activeLabStage === 'director'}
              className={activeLabStage === 'director' ? 'is-active' : ''}
              onClick={() => setActiveLabStage('director')}
            >
              导演V3
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLabStage === 'events'}
              className={activeLabStage === 'events' ? 'is-active' : ''}
              onClick={() => setActiveLabStage('events')}
            >
              事件
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLabStage === 'actors'}
              className={activeLabStage === 'actors' ? 'is-active' : ''}
              onClick={() => setActiveLabStage('actors')}
            >
              角色
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLabStage === 'stadium'}
              className={activeLabStage === 'stadium' ? 'is-active' : ''}
              onClick={() => setActiveLabStage('stadium')}
            >
              场景
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLabStage === 'human'}
              className={activeLabStage === 'human' ? 'is-active' : ''}
              onClick={() => setActiveLabStage('human')}
            >
              人物
            </button>
          </div>
        </div>
        {activeLabStage === 'director' ? (
          <section className="runtime-v3-lab" aria-label="DecisionSceneScriptV3 逐项验收">
            <div className="runtime-v3-lab-grid">
              <label>
                <span>场景 · 53 项</span>
                <select
                  data-testid="v3-scenario-select"
                  value={selectedLabScenario.id}
                  disabled={labDirectorPhase !== 'idle'}
                  onChange={(event) => {
                    setLabScenarioId(event.target.value)
                    setLabChoiceId('')
                    setLabOutcomeId('')
                  }}
                >
                  {DECISION_LIBRARY.map((scenario) => (
                    <option value={scenario.id} key={scenario.id}>{scenario.id} · {scenario.trigger}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>选择 · 显式语义</span>
                <select
                  data-testid="v3-choice-select"
                  value={selectedLabChoice.id}
                  disabled={labDirectorPhase !== 'idle'}
                  onChange={(event) => {
                    setLabChoiceId(event.target.value)
                    setLabOutcomeId('')
                  }}
                >
                  {selectedLabScenario.choices.map((choice) => (
                    <option value={choice.id} key={choice.id}>{choice.id} · {choice.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Outcome · 171 项全覆盖</span>
                <select
                  data-testid="v3-outcome-select"
                  value={selectedLabOutcome}
                  disabled={labDirectorPhase !== 'idle'}
                  onChange={(event) => setLabOutcomeId(event.target.value)}
                >
                  {selectedLabChoice.possible_outcomes.map((outcome) => (
                    <option value={outcome} key={outcome}>{outcome}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="runtime-v3-lab-copy">
              <strong>{selectedLabScenario.trigger}</strong>
              <span>{selectedLabChoice.desc}</span>
              <small>风险：{selectedLabChoice.risk} · 收益：{selectedLabChoice.reward}</small>
            </div>
            <div className="runtime-v3-lab-actions">
              <button type="button" disabled={labDirectorPhase !== 'idle'} onClick={prepareLabDecision}>
                准备当前场景
              </button>
              <button type="button" disabled={labDirectorPhase !== 'choosing'} onClick={executeLabDecision}>
                执行指定 outcome
              </button>
              <button
                type="button"
                disabled={labDirectorPhase === 'idle'}
                onClick={() => {
                  cancelFormalCoachDecision()
                  setLabDecision(null)
                  setLabDirectorPhase('idle')
                }}
              >
                取消并恢复
              </button>
              <span>{labDirectorPhase}</span>
            </div>
          </section>
        ) : activeLabStage === 'events' ? (
          <section className="runtime-event-slice" aria-label="五个代表性 MatchVisualEvent 统一事件桥">
            <div className="runtime-event-summary">
              <strong>{visualEvents.ready ? 'EVENT BRIDGE · READY' : '正在装配统一事件桥…'}</strong>
              <span>{visualEvents.completedCount}/{visualEvents.totalCount} 完成 · {visualEvents.status}</span>
            </div>
            <div className="runtime-event-authority">
              <span>权威比分 {visualEvents.authority.score.red} : {visualEvents.authority.score.blue}</span>
              <span>单事件单结算 {visualEvents.authority.consumedEventIds.length}/5</span>
              <span>Runtime 改比分：禁止</span>
            </div>
            <div className="runtime-event-list" role="group" aria-label="五个代表事件">
              {visualEvents.events.map((event) => {
                const completed = visualEvents.completedEventIds.includes(event.id)
                const active = visualEvents.activeEventId === event.id
                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`${completed ? 'is-completed' : ''} ${active ? 'is-active' : ''}`}
                    disabled={!visualEvents.ready || visualEvents.status === 'playing' || completed}
                    onClick={() => playOneVisualEvent(event.id)}
                  >
                    <small>{event.sequence} · {event.type}</small>
                    <span>{event.label}</span>
                    <em>{active ? 'PLAYING' : completed ? 'DONE' : `${event.runtime.durationMs}ms`}</em>
                  </button>
                )
              })}
            </div>
            {inspectedVisualEvent && (
              <div className="runtime-event-inspector">
                <div>
                  <strong>{inspectedVisualEvent.commentary.prelude}</strong>
                  <span>{inspectedVisualEvent.commentary.result}</span>
                  <small>
                    {inspectedVisualEvent.actors.primary.runtimeActorId} → {inspectedVisualEvent.ball.targetRuntimeActorId} · {inspectedVisualEvent.ball.motion} · 禁止瞬移
                  </small>
                </div>
                <div className="runtime-event-actions">
                  <button
                    type="button"
                    disabled={!visualEvents.ready || visualEvents.status === 'playing' || visualEvents.completedCount > 0}
                    onClick={playAllVisualEvents}
                  >
                    顺序播放 5 事件
                  </button>
                  <button
                    type="button"
                    disabled={!visualEvents.ready || visualEvents.status === 'playing'}
                    onClick={resetVisualEvents}
                  >
                    重置事件
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : activeLabStage === 'actors' ? (
          <section className="runtime-actor-slice" aria-label="22 人业务球员与 Runtime actor 一一映射">
            <div className="runtime-actor-summary">
              <strong>
                {runtimeActors.ready ? 'MAPPING · READY' : '正在绑定既有 Runtime actor…'}
              </strong>
              <span>
                {runtimeActors.mappedActorCount}/22 映射 · {runtimeActors.uniquePlayerCount}/22 唯一 · {runtimeActors.activeActorCount} 在场
              </span>
            </div>
            <div className="runtime-actor-teams">
              {['red', 'blue'].map((side) => (
                <span key={side}>
                  {runtimeActors.sides?.[side]?.teamName || side} · {runtimeActors.sides?.[side]?.formation || '—'} · {runtimeActors.sides?.[side]?.bench?.length ?? 0} 替补
                </span>
              ))}
            </div>
            <div className="runtime-actor-grid" role="group" aria-label="Runtime actor 槽位">
              {runtimeActors.actors.map((actor) => (
                <button
                  key={actor.runtimeActorId}
                  type="button"
                  className={`${runtimeActors.selectedRuntimeActorId === actor.runtimeActorId ? 'is-active' : ''} ${actor.state.onPitch ? '' : 'is-off-pitch'}`}
                  onClick={() => chooseRuntimeActor(actor.runtimeActorId)}
                >
                  <small>{actor.runtimeActorId}</small>
                  <span>#{actor.number} {actor.name}</span>
                  <em>{actor.assignedPosition} · {actor.kitType}</em>
                </button>
              ))}
            </div>
            {runtimeActors.selectedActor && (
              <div className="runtime-actor-inspector">
                <div>
                  <strong>#{runtimeActors.selectedActor.number} {runtimeActors.selectedActor.name}</strong>
                  <small>{runtimeActors.selectedActor.playerId}</small>
                  <span>
                    {runtimeActors.selectedActor.assignedPosition} · 体力 {runtimeActors.selectedActor.state.stamina} · 黄牌 {runtimeActors.selectedActor.state.yellowCards} · {runtimeActors.selectedActor.state.status}
                  </span>
                </div>
                <div className="runtime-actor-actions" role="group" aria-label="精确角色状态操作">
                  <button
                    type="button"
                    disabled={!runtimeActors.selectedActor.state.onPitch}
                    onClick={() => patchSelectedRuntimeActor({
                      stamina: runtimeActors.selectedActor.state.stamina - 10,
                    })}
                  >
                    体力 -10
                  </button>
                  <button
                    type="button"
                    disabled={!runtimeActors.selectedActor.state.onPitch}
                    onClick={() => patchSelectedRuntimeActor({ yellowCards: 1 })}
                  >
                    黄牌
                  </button>
                  <button
                    type="button"
                    disabled={!runtimeActors.selectedActor.state.onPitch}
                    onClick={() => patchSelectedRuntimeActor({
                      injured: !runtimeActors.selectedActor.state.injured,
                    })}
                  >
                    {runtimeActors.selectedActor.state.injured ? '解除伤情' : '标记受伤'}
                  </button>
                  <button
                    type="button"
                    disabled={!runtimeActors.selectedActor.state.onPitch}
                    onClick={substituteSelectedRuntimeActor}
                  >
                    精确换人
                  </button>
                  <button
                    type="button"
                    className="runtime-actor-red-card"
                    disabled={!runtimeActors.selectedActor.state.onPitch}
                    onClick={() => patchSelectedRuntimeActor({ redCard: true })}
                  >
                    红牌离场
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : activeLabStage === 'stadium' ? (
          <section className="runtime-stadium-slice" aria-label="像素球场、看台与观众切片">
            <div className="runtime-stadium-meta">
              <span>{stadiumScene.ready ? 'WORLD CUP NIGHT · READY' : '正在装配分层场景…'}</span>
              <small>{stadiumScene.layerCount} 层 / {stadiumScene.cameraPresetCount} 镜头</small>
            </div>
            <div className="runtime-scene-preserves" aria-label="运行时保留项">
              <span>碰撞 ✓</span>
              <span>动态球网 ✓</span>
              <span>相机 ✓</span>
              <span>深度排序 ✓</span>
            </div>
            <div className="runtime-camera-presets" role="group" aria-label="场景镜头">
              {HAPPYSEED_STADIUM_CAMERA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={stadiumScene.activeCamera === preset.id ? 'is-active' : ''}
                  disabled={!stadiumScene.ready}
                  onClick={() => changeStadiumCamera(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="runtime-stadium-footer">
              <span>{stadiumScene.id}</span>
              <button
                type="button"
                className={stadiumScene.crowdMotion ? 'is-active' : ''}
                disabled={!stadiumScene.ready}
                onClick={toggleCrowdMotion}
              >
                观众动态 {stadiumScene.crowdMotion ? '开' : '关'}
              </button>
            </div>
          </section>
        ) : (
          <section className="runtime-human-slice-content" aria-label="人类像素球员骨架兼容性切片">
            <div className="runtime-human-slice-status">
              <small>{humanSlice.ready ? `${humanSlice.profileCount} 样板 / ${humanSlice.compatibleActionCount} 动作` : '正在装配原骨架…'}</small>
            </div>
            <div className="runtime-human-profile-strip" role="group" aria-label="人类角色样板">
              {humanSlice.profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className={humanSlice.activeProfileId === profile.id ? 'is-active' : ''}
                  disabled={!humanSlice.ready}
                  onClick={() => changeHumanProfile(profile.id)}
                >
                  {profile.role === 'goalkeeper' ? '法国门将' : profile.teamId === 'brazil' ? '巴西球员' : '法国球员'}
                </button>
              ))}
            </div>
            <div className="runtime-human-action-strip" role="group" aria-label="骨架动作">
              {HAPPYSEED_HUMAN_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={humanSlice.action === action.id ? 'is-active' : ''}
                  disabled={!humanSlice.ready}
                  onClick={() => changeHumanAction(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <div className="runtime-human-slice-footer">
              <div className="runtime-human-facing" role="group" aria-label="人物朝向">
                <button
                  type="button"
                  className={humanSlice.facing === 'front' ? 'is-active' : ''}
                  disabled={!humanSlice.ready}
                  onClick={() => changeHumanFacing('front')}
                >
                  正面
                </button>
                <button
                  type="button"
                  className={humanSlice.facing === 'back' ? 'is-active' : ''}
                  disabled={!humanSlice.ready}
                  onClick={() => changeHumanFacing('back')}
                >
                  背面
                </button>
              </div>
              <button
                type="button"
                className={humanSlice.autoCycle ? 'is-active' : ''}
                disabled={!humanSlice.ready}
                onClick={toggleHumanAutoCycle}
              >
                {humanSlice.autoCycle ? '停止巡检' : '自动巡检'}
              </button>
            </div>
          </section>
        )}
      </aside>

      <nav className="runtime-toolbar" aria-label="比赛引擎控制">
        <button type="button" onClick={togglePause}>{paused ? '继续' : '暂停'}</button>
        {[1, 2, 3].map((value) => (
          <button
            className={selectedSpeed === value ? 'is-active' : ''}
            key={value}
            type="button"
            onClick={() => changeSpeed(value)}
          >
            {value}x
          </button>
        ))}
        <button type="button" onClick={() => changeZoom(-0.1)}>镜头 -</button>
        <button type="button" onClick={() => changeZoom(0.1)}>镜头 +</button>
        <button type="button" onClick={() => { resetZoom(); setZoomState(1) }}>重置镜头</button>
        <button type="button" onClick={handleCornerInjection}>注入本方角球</button>
        <button type="button" onClick={toggleMode}>{playerMode ? '切到 AI 对战' : '切到球员模式'}</button>
      </nav>

      {playerMode && (
        <section className="runtime-player-controls" aria-label="球员操作区">
          <div className="runtime-dpad">
            <DirectionButton label="↑" vx={0} vy={-1} />
            <DirectionButton label="←" vx={-1} vy={0} />
            <DirectionButton label="↓" vx={0} vy={1} />
            <DirectionButton label="→" vx={1} vy={0} />
          </div>
          <div className="runtime-actions">
            {PLAYER_ACTIONS.map((action) => (
              <ActionButton key={action.label} {...action} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
