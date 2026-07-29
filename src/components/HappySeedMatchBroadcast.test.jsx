/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildHappySeedRuntimeActorConfig,
  getHappySeedRuntimeActorSnapshot,
} from '../utils/happySeedRuntimeActors.js'
import {
  applyMatchVisualEventAuthority,
  buildRepresentativeMatchVisualEvents,
  createMatchVisualAuthorityState,
} from '../utils/matchVisualEvent.js'
import { audioManager } from '../utils/audioManager.js'

const serviceMocks = vi.hoisted(() => ({
  applyRuntimeDisciplinaryCard: vi.fn((event) => event),
  applyRuntimeVarResult: vi.fn(() => true),
  bootHappySeedMatch: vi.fn(() => Promise.resolve()),
  cancelFormalCoachDecision: vi.fn(() => true),
  captureFormalMatchRuntimeMoment: vi.fn(),
  createFormalCoachDecision: vi.fn(),
  executeFormalCoachDecisionChoice: vi.fn(),
  followStadiumBall: vi.fn(() => true),
  getConservativeFormalCoachChoice: vi.fn(),
  getMatchVisualEventSnapshot: vi.fn(),
  getRuntimeActorSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  getStadiumSceneSnapshot: vi.fn(),
  pauseMatch: vi.fn(),
  pollFormalCoachDecisionOpportunity: vi.fn(),
  prepareFormalCoachDecision: vi.fn(() => Promise.resolve()),
  resetStadiumCamera: vi.fn(() => true),
  resumeMatch: vi.fn(),
  setSpeed: vi.fn(),
  setFormalCoachDecisionChoiceHover: vi.fn(),
  setRuntimeStoppageMinutes: vi.fn(() => true),
  setTeamTacticalStance: vi.fn(() => true),
  getTeamTacticalStance: vi.fn(() => 'balanced'),
  setRuntimeActorState: vi.fn(() => true),
  setRuntimeGoalPresentationHold: vi.fn(() => true),
  setStadiumCrowdMotion: vi.fn(),
  setZoom: vi.fn(() => true),
  retainMatchRuntime: vi.fn(),
  scheduleMatchRuntimeShutdown: vi.fn(),
  subscribeToMatchEvents: vi.fn(() => () => {}),
  subscribeToRuntimeDecisionChoices: vi.fn(() => () => {}),
  withDecisionWatchdog: vi.fn((promise) => promise),
  subscribeToRuntimeMatchEvents: vi.fn((listener) => {
    listener({
      schemaVersion: 'match-runtime-event-v1',
      id: 'runtime.test.contact',
      type: 'tackle-contact',
      frameId: 120,
      matchTime: 800,
      minute: 19,
      side: 'blue',
      actorRuntimeIds: ['red-1', 'blue-1'],
      primaryRuntimeActorId: 'blue-1',
      secondaryRuntimeActorId: 'red-1',
      ball: { before: [0.68, 0.5, 0], after: [0.68, 0.5, 0] },
      runtimeStateBefore: 'Match',
      runtimeStateAfter: 'Match',
      detail: { contact: 'slide-hit' },
    })
    return () => {}
  }),
  substituteRuntimeActor: vi.fn(() => true),
}))

vi.mock('../services/happySeedMatchRuntime.js', () => serviceMocks)

import { HappySeedMatchBroadcast } from './HappySeedMatchBroadcast.jsx'

describe('HappySeed formal match broadcast', () => {
  const actorConfig = buildHappySeedRuntimeActorConfig()
  const actorSnapshot = {
    ...getHappySeedRuntimeActorSnapshot(actorConfig),
    ready: true,
  }
  const events = buildRepresentativeMatchVisualEvents(actorConfig)
  const authority = events.slice(0, 2).reduce(
    applyMatchVisualEventAuthority,
    createMatchVisualAuthorityState(),
  )
  const visualSnapshot = {
    ready: true,
    status: 'completed',
    activeEventId: null,
    lastCompletedEventId: events[1].id,
    completedEventIds: events.slice(0, 2).map((event) => event.id),
    completedCount: 2,
    totalCount: 5,
    events,
    authority,
  }
  const formalDecision = {
    id: 'coach.freekick_dangerous.france.44',
    label: '危险任意球',
    sequenceIndex: 0,
    sequenceNumber: 1,
    situation: '44分钟，法国在禁区外获得危险任意球。',
    coachDecisionEvent: {
      timeoutSeconds: 4,
      sourceScenarioId: 'freekick_dangerous',
      type: 'dangerous_free_kick',
    },
    choices: [
      {
        id: 'direct_freekick',
        label: '直接射门',
        desc: '直接弯射绕过人墙。',
        risk: '可能撞墙或打高',
        reward: '直接得分',
        successHint: '把握较大',
      },
      {
        id: 'freekick_cross',
        label: '传中争顶',
        desc: '高球传入禁区。',
        risk: '可能被解围',
        reward: '利用争顶优势',
        successHint: '各有胜负',
      },
      {
        id: 'short_freekick',
        label: '短传重组',
        desc: '短传给邻近队友。',
        risk: '放弃直接机会',
        reward: '继续保持球权',
        successHint: '风险较高',
      },
    ],
  }
  const runtimeMoment = {
    schemaVersion: 'runtime-decision-moment-v1',
    attackingSide: 'red',
    ownerRuntimeActorId: 'red-1',
    ball: { normalized: [0.68, 0.5, 0] },
  }
  const decisionHitZones = formalDecision.choices.map((choice, index) => ({
    id: choice.id,
    centerX: 220 + index * 220,
    centerY: 210 + index * 30,
    width: 220,
    height: 90,
  }))

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
    audioManager.userUnlocked = true
    window.history.replaceState({}, '', '/happyseed-runtime.html?events=manual')
    serviceMocks.getSnapshot.mockReturnValue({
      minute: 19,
      red: { name: '法国', score: 0, possession: 56, playerCount: 11 },
      blue: { name: '巴西', score: 0, possession: 44, playerCount: 11 },
    })
    serviceMocks.getMatchVisualEventSnapshot.mockReturnValue(visualSnapshot)
    serviceMocks.getRuntimeActorSnapshot.mockReturnValue(actorSnapshot)
    serviceMocks.getStadiumSceneSnapshot.mockReturnValue({
      ready: true,
      cameraMode: 'ball',
      zoom: 1,
      draggable: true,
      pixelGoalAtlasApplied: true,
      pixelBallTextureApplied: true,
      pixelBallOutputApplied: true,
      pixelDynamicNetApplied: true,
      pixelDynamicNetTriangleCount: 204,
      pixelDynamicNetStrandCount: 116,
    })
    serviceMocks.createFormalCoachDecision.mockReturnValue(formalDecision)
    serviceMocks.captureFormalMatchRuntimeMoment.mockReturnValue(null)
    serviceMocks.pollFormalCoachDecisionOpportunity.mockReturnValue(null)
    serviceMocks.getConservativeFormalCoachChoice.mockReturnValue(formalDecision.choices[0])
    serviceMocks.executeFormalCoachDecisionChoice.mockReturnValue({
      settled: Promise.resolve({
        resolution: {
          choice: formalDecision.choices[0],
          result: {
            outcome: 'goal_freekick',
            isSuccess: true,
            homeScoreChange: 1,
            awayScoreChange: 0,
          },
          resultText: '任意球绕过人墙直挂死角！',
          authorityDeltas: { statsDelta: { shots: 1 }, opponentStatsDelta: {} },
        },
      }),
      completed: Promise.resolve({ completed: true }),
    })
  })

  it('claims the singleton Runtime and schedules safe cleanup on unmount', () => {
    const { unmount } = render(<HappySeedMatchBroadcast />)

    expect(serviceMocks.retainMatchRuntime).toHaveBeenCalledOnce()
    unmount()

    expect(serviceMocks.scheduleMatchRuntimeShutdown).toHaveBeenCalledOnce()
  })

  it('reclaims the Runtime after StrictMode replays the mount effect', () => {
    const lifecycle = []
    serviceMocks.retainMatchRuntime.mockImplementation(() => lifecycle.push('retain'))
    serviceMocks.scheduleMatchRuntimeShutdown.mockImplementation(() => lifecycle.push('release'))

    render(
      <React.StrictMode>
        <HappySeedMatchBroadcast />
      </React.StrictMode>,
    )

    expect(lifecycle.slice(0, 3)).toEqual(['retain', 'release', 'retain'])
  })

  it('renders the full-screen broadcast score and same-event commentary', async () => {
    render(<HappySeedMatchBroadcast />)

    expect(screen.getByRole('banner', { name: '比赛比分' })).toHaveTextContent('法国')
    expect(screen.getByRole('banner', { name: '比赛比分' })).toHaveTextContent('0')
    expect(screen.getByAltText('法国国旗')).toHaveAttribute('src', '/assets/国旗/法国.png')
    expect(screen.getByAltText('巴西国旗')).toHaveAttribute('src', '/assets/国旗/巴西.png')
    expect(document.querySelector('.broadcast-cup-mark img')).toHaveAttribute(
      'src',
      '/assets/hud/world-cup-trophy.png',
    )
    expect(document.querySelector('main')).toHaveAttribute('data-pixel-goal-atlas', 'true')
    expect(document.querySelector('main')).toHaveAttribute('data-pixel-ball-texture', 'true')
    expect(document.querySelector('main')).toHaveAttribute('data-pixel-ball-output', 'true')
    expect(document.querySelector('main')).toHaveAttribute('data-pixel-dynamic-net', 'true')
    expect(document.querySelector('main')).toHaveAttribute('data-pixel-dynamic-net-triangles', '204')
    expect(document.querySelector('main')).toHaveAttribute('data-pixel-dynamic-net-strands', '116')
    expect(document.querySelector('main')).toHaveAttribute('data-runtime-player-scale', '0.62')
    expect(document.querySelector('main')).toHaveAttribute(
      'data-runtime-player-root',
      expect.stringContaining('/happyseed-human-v4/'),
    )
    expect(screen.getByLabelText('比赛播报')).toHaveTextContent('准备开球')
    await waitFor(() => expect(serviceMocks.bootHappySeedMatch).toHaveBeenCalledTimes(1))
    expect(serviceMocks.setRuntimeStoppageMinutes).toHaveBeenCalledWith(1, 1)
  })

  it('holds a direct goal on its pixel artwork before releasing the restart', async () => {
    vi.useFakeTimers()
    serviceMocks.subscribeToRuntimeMatchEvents.mockImplementationOnce((listener) => {
      listener({
        schemaVersion: 'match-runtime-event-v1',
        id: 'runtime.goal.direct',
        type: 'goal',
        frameId: 1860,
        matchTime: 2480,
        minute: 31,
        side: 'red',
        actorRuntimeIds: ['red-1'],
        primaryRuntimeActorId: 'red-1',
        secondaryRuntimeActorId: null,
        ball: { before: [0.9, 0.5, 0], after: [0.94, 0.5, 0] },
        runtimeStateBefore: 'Match',
        runtimeStateAfter: 'Goal',
        detail: { forceVarReview: false, score: [1, 0] },
      })
      return () => {}
    })
    render(<HappySeedMatchBroadcast />)
    await act(async () => {})

    // 进球播报图片延迟 1 秒出现（等球完全进网）
    expect(document.querySelector('.broadcast-event-artwork')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(document.querySelector('.broadcast-event-artwork'))
      .toHaveAttribute('data-event-artwork', '进球')
    expect(document.querySelector('.broadcast-event-artwork'))
      .toHaveTextContent('皮球越过门线，进球！')
    expect(serviceMocks.setRuntimeGoalPresentationHold).toHaveBeenCalledWith(true)

    // 定格与进球图片同帧（t=1000）开始，持续 3200ms，到 t=4200 才释放重启
    await act(async () => { vi.advanceTimersByTime(3199) })
    expect(serviceMocks.setRuntimeGoalPresentationHold).not.toHaveBeenCalledWith(false)
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(serviceMocks.setRuntimeGoalPresentationHold).toHaveBeenCalledWith(false)
  })

  it('keeps VAR frozen through checking and the NO GOAL result screen', async () => {
    vi.useFakeTimers()
    serviceMocks.subscribeToRuntimeMatchEvents.mockImplementationOnce((listener) => {
      listener({
        schemaVersion: 'match-runtime-event-v1',
        id: 'runtime.goal.reviewed',
        type: 'goal',
        frameId: 4020,
        matchTime: 5360,
        minute: 67,
        side: 'red',
        actorRuntimeIds: ['red-1'],
        primaryRuntimeActorId: 'red-1',
        secondaryRuntimeActorId: null,
        ball: { before: [0.9, 0.5, 0], after: [0.94, 0.5, 0] },
        runtimeStateBefore: 'Match',
        runtimeStateAfter: 'Goal',
        detail: { forceVarReview: true, forceVarOutcome: 'disallowed', score: [1, 0] },
      })
      return () => {}
    })
    render(<HappySeedMatchBroadcast />)
    await act(async () => {})

    // VAR 检查画面延迟 1 秒出现
    expect(document.querySelector('.broadcast-event-artwork')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(document.querySelector('.broadcast-event-artwork'))
      .toHaveAttribute('data-event-artwork', '检查 VAR 中')
    expect(document.querySelector('.broadcast-event-artwork'))
      .toHaveAttribute('data-event-artwork-src', '/assets/比赛事件/VAR.png')

    await act(async () => { vi.advanceTimersByTime(2800) })
    expect(document.querySelector('.broadcast-event-artwork'))
      .toHaveAttribute('data-event-artwork', 'NO GOAL')
    expect(serviceMocks.applyRuntimeVarResult).toHaveBeenCalledWith(expect.objectContaining({
      type: 'var-result',
      detail: expect.objectContaining({ outcome: 'disallowed' }),
    }))
    expect(serviceMocks.setRuntimeGoalPresentationHold).not.toHaveBeenCalledWith(false)

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(serviceMocks.setRuntimeGoalPresentationHold).toHaveBeenCalledWith(false)
  })

  it('holds kickoff behind one explicit audio gesture when the standalone page is still locked', async () => {
    audioManager.userUnlocked = false
    const unlockSpy = vi.spyOn(audioManager, 'unlock')
    render(<HappySeedMatchBroadcast />)

    expect(serviceMocks.bootHappySeedMatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /点击开赛/ }))
    await waitFor(() => expect(serviceMocks.bootHappySeedMatch).toHaveBeenCalledTimes(1))
    expect(unlockSpy).toHaveBeenCalledTimes(1)
    unlockSpy.mockRestore()
  })

  it('centers the authored goalkeeper-save artwork with a pixel event headline', async () => {
    serviceMocks.subscribeToRuntimeMatchEvents.mockImplementationOnce((listener) => {
      listener({
        schemaVersion: 'match-runtime-event-v1',
        id: 'runtime.save.keeper-hold',
        sourceEventId: 'runtime.shot.keeper-hold',
        type: 'save',
        minute: 23,
        side: 'red',
        primaryRuntimeActorId: 'red-1',
        actorRuntimeIds: ['red-1'],
        ball: { before: [0.08, 0.5, 0.3], after: [0.06, 0.5, 0.2] },
        runtimeStateBefore: 'Match',
        runtimeStateAfter: 'Match',
        detail: { shotEventId: 'runtime.shot.keeper-hold', saveKind: 'held' },
      })
      return () => {}
    })
    render(<HappySeedMatchBroadcast />)
    await act(async () => {})

    const artwork = document.querySelector('.broadcast-event-artwork')
    expect(artwork).toHaveAttribute('data-event-artwork', '关键扑救')
    expect(artwork).toHaveAttribute('data-event-artwork-src', '/assets/比赛事件/扑出.png')
    expect(artwork).toHaveTextContent('门将完成关键扑救！')
  })

  it('expands disciplinary stats from the scoreboard instead of a separate control', () => {
    render(<HappySeedMatchBroadcast />)
    expect(screen.queryByLabelText('精简比赛统计')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '展开比赛数据' }))
    expect(screen.getByRole('button', { name: '展开比赛数据' })).toHaveTextContent('查看详情')
    expect(screen.getByLabelText('精简比赛统计')).toHaveTextContent('控球率')
    expect(screen.getByLabelText('精简比赛统计')).toHaveTextContent('射正')
    expect(screen.getByLabelText('精简比赛统计')).toHaveTextContent('角球')
    expect(screen.getByLabelText('精简比赛统计')).toHaveTextContent('犯规')
    expect(screen.getByLabelText('精简比赛统计')).toHaveTextContent('黄牌')
    expect(screen.getByLabelText('精简比赛统计')).toHaveTextContent('红牌')
    expect(document.querySelector('.broadcast-scoreboard-arrow')).toHaveTextContent('▼')
    expect(screen.queryByRole('button', { name: '数据' })).not.toBeInTheDocument()
  })

  it('keeps only pause and speed in the top-right match controls', () => {
    render(<HappySeedMatchBroadcast />)

    const controls = screen.getByRole('navigation', { name: '比赛控制' })
    expect(controls.querySelectorAll('button')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: /暂停/ }))
    fireEvent.click(screen.getByRole('button', { name: '1×' }))
    expect(serviceMocks.pauseMatch).toHaveBeenCalledTimes(1)
    expect(serviceMocks.setSpeed).toHaveBeenCalledWith(2)
    expect(screen.queryByRole('navigation', { name: '自由镜头控制' })).not.toBeInTheDocument()
  })

  it('adjusts tactical stance with a score-based recommendation', async () => {
    render(<HappySeedMatchBroadcast />)

    fireEvent.click(screen.getByRole('button', { name: /战术.*攻守平衡/ }))
    const drawer = screen.getByLabelText('战术调整')
    expect(drawer).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^攻守平衡/ })).toHaveTextContent('推荐')
    expect(screen.getByRole('button', { name: /稳守反击/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /全员防守/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /进攻主导/ }))
    expect(serviceMocks.setTeamTacticalStance).toHaveBeenCalledWith('red', 'attack')
    expect(screen.queryByLabelText('战术调整')).not.toBeInTheDocument()
    await waitFor(() => expect(
      screen.getByRole('button', { name: /战术.*进攻主导/ }),
    ).toBeInTheDocument())
  })

  it('supports the mobile two-step substitution flow with exact business IDs', () => {
    render(<HappySeedMatchBroadcast />)
    fireEvent.click(screen.getByRole('button', { name: /换人.*3 次.*5 人/ }))
    expect(screen.getByLabelText('场上阵型')).toBeInTheDocument()

    const outgoing = actorSnapshot.actors.find((actor) => (
      actor.side === 'red' && actor.state.onPitch && !actor.isGoalkeeper
    ))
    const incoming = actorSnapshot.sides.red.bench.find((player) => (
      player.naturalPosition !== 'GK'
    ))
    fireEvent.click(screen.getByRole('button', {
      name: `场上 #${outgoing.number} ${outgoing.name} ${outgoing.assignedPosition} 体力 ${outgoing.state.stamina}`,
    }))
    fireEvent.click(screen.getByRole('button', {
      name: `替补 #${incoming.number} ${incoming.name} ${incoming.naturalPosition} 体力 ${incoming.state.stamina}`,
    }))
    expect(serviceMocks.substituteRuntimeActor).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /确认换人.*1 人/ }))

    expect(serviceMocks.substituteRuntimeActor).toHaveBeenCalledWith(
      'red',
      outgoing.playerId,
      incoming.playerId,
    )
    expect(screen.queryByLabelText('换人调整')).not.toBeInTheDocument()
  })

  it('queues multiple dragged substitutions and commits them in one window', () => {
    render(<HappySeedMatchBroadcast />)
    fireEvent.click(screen.getByRole('button', { name: /换人.*3 次.*5 人/ }))

    const bench = actorSnapshot.sides.red.bench
    const onPitch = actorSnapshot.actors.filter((actor) => (
      actor.side === 'red' && actor.state.onPitch
    ))
    // 选一个替补席至少2人、场上也至少2人的位置，保证能演示连续换人
    const targetPosition = ['MF', 'DF', 'FW'].find((position) => (
      bench.filter((player) => player.naturalPosition === position).length >= 2
      && onPitch.filter((actor) => actor.assignedPosition === position).length >= 2
    ))
    const outgoingPlayers = onPitch
      .filter((actor) => actor.assignedPosition === targetPosition)
      .slice(0, 2)
    const incomingPlayers = bench
      .filter((player) => player.naturalPosition === targetPosition)
      .slice(0, 2)

    outgoingPlayers.forEach((outgoing, index) => {
      const incoming = incomingPlayers[index]
      const transfer = {
        value: '',
        effectAllowed: 'none',
        setData(_type, value) { this.value = value },
        getData() { return this.value },
      }
      const benchPlayer = screen.getByRole('button', {
        name: `替补 #${incoming.number} ${incoming.name} ${incoming.naturalPosition} 体力 ${incoming.state.stamina}`,
      })
      const fieldPlayer = screen.getByRole('button', {
        name: `场上 #${outgoing.number} ${outgoing.name} ${outgoing.assignedPosition} 体力 ${outgoing.state.stamina}`,
      })
      fireEvent.dragStart(benchPlayer, { dataTransfer: transfer })
      fireEvent.dragOver(fieldPlayer, { dataTransfer: transfer })
      fireEvent.drop(fieldPlayer, { dataTransfer: transfer })
    })

    expect(serviceMocks.substituteRuntimeActor).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: /待换入/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /待换下/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /确认换人.*2 人/ }))

    expect(serviceMocks.substituteRuntimeActor).toHaveBeenCalledTimes(2)
    outgoingPlayers.forEach((outgoing, index) => {
      expect(serviceMocks.substituteRuntimeActor).toHaveBeenCalledWith(
        'red',
        outgoing.playerId,
        incomingPlayers[index].playerId,
      )
    })
    expect(screen.queryByLabelText('换人调整')).not.toBeInTheDocument()
  })

  it('prepares one in-field free-kick decision and reveals result only after settled', async () => {
    const soundSpy = vi.spyOn(audioManager, 'playSound')
    window.history.replaceState({}, '', '/happyseed-runtime.html?scenario=freekick_dangerous')
    serviceMocks.getMatchVisualEventSnapshot.mockReturnValue({
      ...visualSnapshot,
      status: 'ready',
      choiceHitZones: decisionHitZones,
      completedEventIds: [],
      completedCount: 0,
      authority: createMatchVisualAuthorityState(),
    })
    serviceMocks.captureFormalMatchRuntimeMoment.mockReturnValue(runtimeMoment)
    render(<HappySeedMatchBroadcast />)

    const decisionPanel = await screen.findByLabelText('限时教练决策')
    expect(decisionPanel).toHaveTextContent('危险任意球')
    expect(decisionPanel).toHaveTextContent('禁区前沿获得危险任意球')
    expect(decisionPanel.textContent).toMatch(/(1[5-9]|2[0-5])秒/)
    expect(soundSpy).toHaveBeenCalledWith('decisionTick')
    expect(serviceMocks.prepareFormalCoachDecision)
      .toHaveBeenCalledWith(
        formalDecision,
        runtimeMoment,
        expect.objectContaining({ type: 'foul', sourceEventId: 'runtime.test.contact' }),
      )
    expect(serviceMocks.pauseMatch).not.toHaveBeenCalled()

    const fieldChoices = screen.getByLabelText('场内决策选择')
    expect(fieldChoices).toHaveTextContent('风险')
    expect(fieldChoices).toHaveTextContent('可能撞墙或打高')
    const directChoice = screen.getByRole('button', { name: /直接射门.*风险：可能撞墙或打高/ })
    fireEvent.pointerEnter(directChoice)
    expect(serviceMocks.setFormalCoachDecisionChoiceHover)
      .toHaveBeenLastCalledWith('direct_freekick', true)
    fireEvent.pointerLeave(directChoice)
    expect(serviceMocks.setFormalCoachDecisionChoiceHover)
      .toHaveBeenLastCalledWith('direct_freekick', false)
    fireEvent.click(directChoice)
    await waitFor(() => expect(serviceMocks.executeFormalCoachDecisionChoice)
      .toHaveBeenCalledWith(formalDecision, 'direct_freekick'))
    expect(screen.queryByLabelText('限时教练决策')).not.toBeInTheDocument()
    expect(screen.getAllByText(/任意球绕过人墙直挂死角/).length).toBeGreaterThan(0)
  })

  it('consumes one substitution window when a decision completes a real substitution', async () => {
    window.history.replaceState({}, '', '/happyseed-runtime.html?scenario=freekick_dangerous')
    serviceMocks.getMatchVisualEventSnapshot.mockReturnValue({
      ...visualSnapshot,
      status: 'ready',
      choiceHitZones: decisionHitZones,
      completedEventIds: [],
      completedCount: 0,
      authority: createMatchVisualAuthorityState(),
    })
    serviceMocks.captureFormalMatchRuntimeMoment.mockReturnValue(runtimeMoment)
    serviceMocks.executeFormalCoachDecisionChoice.mockReturnValue({
      settled: Promise.resolve({
        resolution: {
          choice: formalDecision.choices[0],
          result: {
            outcome: 'sub_refresh',
            isSuccess: true,
            homeScoreChange: 0,
            awayScoreChange: 0,
          },
          resultText: '换人完成：5号边路悍将替下2号钢铁后卫，新上场球员体能充沛。',
          authorityDeltas: { statsDelta: {}, opponentStatsDelta: {} },
          runtimeEffect: {
            type: 'substitution',
            applied: true,
            outgoing: { playerId: 'france-df-2', name: '钢铁后卫', number: 2 },
            incoming: { playerId: 'france-mf-5', name: '边路悍将', number: 5 },
          },
        },
      }),
      completed: Promise.resolve({ completed: true }),
    })
    render(<HappySeedMatchBroadcast />)

    await screen.findByLabelText('限时教练决策')
    fireEvent.click(screen.getByRole('button', { name: /直接射门.*风险：可能撞墙或打高/ }))
    await waitFor(() => expect(
      screen.getByRole('button', { name: /换人.*2 次.*5 人/ }),
    ).toBeInTheDocument())
  })

  it('keeps substitution windows when a decision substitution has no eligible bench', async () => {
    window.history.replaceState({}, '', '/happyseed-runtime.html?scenario=freekick_dangerous')
    serviceMocks.getMatchVisualEventSnapshot.mockReturnValue({
      ...visualSnapshot,
      status: 'ready',
      choiceHitZones: decisionHitZones,
      completedEventIds: [],
      completedCount: 0,
      authority: createMatchVisualAuthorityState(),
    })
    serviceMocks.captureFormalMatchRuntimeMoment.mockReturnValue(runtimeMoment)
    serviceMocks.executeFormalCoachDecisionChoice.mockReturnValue({
      settled: Promise.resolve({
        resolution: {
          choice: formalDecision.choices[0],
          result: {
            outcome: 'sub_refresh',
            isSuccess: true,
            homeScoreChange: 0,
            awayScoreChange: 0,
          },
          resultText: '换人指令未能执行：当前替补席没有符合位置资格的球员。',
          authorityDeltas: { statsDelta: {}, opponentStatsDelta: {} },
          runtimeEffect: {
            type: 'substitution',
            applied: false,
            reason: 'no-eligible-player',
          },
        },
      }),
      completed: Promise.resolve({ completed: true }),
    })
    render(<HappySeedMatchBroadcast />)

    await screen.findByLabelText('限时教练决策')
    fireEvent.click(screen.getByRole('button', { name: /直接射门.*风险：可能撞墙或打高/ }))
    await waitFor(() => expect(serviceMocks.executeFormalCoachDecisionChoice)
      .toHaveBeenCalledWith(formalDecision, 'direct_freekick'))
    expect(screen.getByRole('button', { name: /换人.*3 次.*5 人/ })).toBeInTheDocument()
  })

  it('places the decision rail opposite a right-side field event', async () => {
    window.history.replaceState({}, '', '/happyseed-runtime.html?scenario=freekick_dangerous')
    serviceMocks.getMatchVisualEventSnapshot.mockReturnValue({
      ...visualSnapshot,
      status: 'ready',
      choiceHitZones: formalDecision.choices.map((choice, index) => ({
        id: choice.id,
        centerX: 780 + index * 40,
        centerY: 210,
        width: 180,
        height: 80,
      })),
      completedEventIds: [],
      completedCount: 0,
      authority: createMatchVisualAuthorityState(),
    })
    serviceMocks.captureFormalMatchRuntimeMoment.mockReturnValue(runtimeMoment)
    render(<HappySeedMatchBroadcast />)

    const decisionPanel = await screen.findByLabelText('限时教练决策')
    expect(decisionPanel).toHaveClass('is-left')
    expect(screen.getByLabelText('场内决策选择')).toHaveClass('is-left')
  })

  it('ignores the retired decisionCatalog parameter in the formal Runtime entry', async () => {
    window.history.replaceState(
      {},
      '',
      '/happyseed-runtime.html?decisionCatalog=1&scenario=freekick_dangerous',
    )
    serviceMocks.getMatchVisualEventSnapshot.mockReturnValue({
      ...visualSnapshot,
      status: 'ready',
      choiceHitZones: decisionHitZones,
      completedEventIds: [],
      completedCount: 0,
      authority: createMatchVisualAuthorityState(),
    })
    serviceMocks.captureFormalMatchRuntimeMoment.mockReturnValue(runtimeMoment)
    const { container } = render(<HappySeedMatchBroadcast />)
    const decisionPanel = await screen.findByLabelText('限时教练决策')

    expect(decisionPanel).toHaveTextContent('危险任意球')
    expect(serviceMocks.createFormalCoachDecision)
      .toHaveBeenCalledWith(0, expect.objectContaining({ minute: 19 }))
    expect(container.querySelector('main')).not.toHaveAttribute('data-decision-catalog')
    expect(container.querySelector('main')).toHaveAttribute(
      'data-decision-scenario',
      'freekick_dangerous',
    )
  })
})
