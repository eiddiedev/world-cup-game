import React, { useCallback, useEffect, useRef, useState } from 'react'
import { teams } from '../data/teams'
import { HappySeedMatchBroadcast } from './HappySeedMatchBroadcast.jsx'
import {
  configureTrainingRuntime,
  shutdownMatchRuntime,
} from '../services/happySeedMatchRuntime'
import { audioManager } from '../utils/audioManager'
import '../styles/trainingGround.css'

/**
 * 训练基地使用 Runtime 的自由训练配置：
 *   - 默认只让玩家和两名门将在 pitch 中；
 *   - 可选加入一名对方防守球员；
 *   - 进球或出界后直接把球交还给玩家。
 */

const DEAD_BALL_STATES = new Set([
  'BallOutOfPlay',
  'Corner',
  'ThrowIn',
  'GoalKick',
  'Kickoff',
  'Goal',
  'GoalCelebration',
  'HalfEnded',
  'ChangeSides',
  'EndMatch',
])

export default function TrainingGround({ saveData, navigateTo, updateSaveData }) {
  const teamId = saveData?.currentRun?.teamId || 'france'
  const team = teams.find((t) => t.id === teamId) || teams[0]

  const [hasDefender, setHasDefender] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const hookedRef = useRef(false)
  const visibleSetRef = useRef(new Set())
  const hasDefenderRef = useRef(false)
  const resetTimerRef = useRef(null)
  const noticeTimerRef = useRef(null)
  const restoreRenderRef = useRef(null)
  const lastDeadBallStateRef = useRef('')

  // 挂载：body标记 + 关闭球场欢呼
  useEffect(() => {
    document.body.classList.add('training-mode')
    const prev = audioManager.stadiumEnabled
    audioManager.stadiumEnabled = false
    audioManager.stopCrowdAmbient()
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
      restoreRenderRef.current?.()
      document.body.classList.remove('training-mode')
      audioManager.stadiumEnabled = prev
      if (prev && audioManager.soundEnabled) audioManager.startCrowdAmbient()
    }
  }, [])

  // 轮询等待引擎就绪，然后安装 render hook
  useEffect(() => {
    let attempts = 0
    const poll = setInterval(() => {
      attempts++
      const game = window.__matchGame
      if (
        !game?.renderer
        || !game?.stadium?.players
        || !game?.allPlayers?.length
        || typeof window.__happySeedConfigureTraining !== 'function'
      ) {
        if (attempts > 1200) clearInterval(poll)
        return
      }
      if (!hookedRef.current) {
        hookedRef.current = true
        clearInterval(poll)
        // 跳过intro相机
        window.__introStart = 0
        if (window.__matchZoom?.reset) window.__matchZoom.reset()
        const canvas = game.renderer.view
        if (canvas) { canvas.style.display = 'block'; canvas.style.opacity = '1' }
        restoreRenderRef.current = installHook(game)
        const configured = configureTrainingRuntime({
          defender: false,
          initial: true,
          resetBall: true,
        })
        if (!configured) {
          restoreRenderRef.current?.()
          restoreRenderRef.current = null
          return
        }
        visibleSetRef.current = new Set(configured.visibleIndices)
        setReady(true)
      }
    }, 50)
    return () => clearInterval(poll)
  }, [])

  const installHook = useCallback((game) => {
    const renderer = game.renderer
    const origRender = renderer.render.bind(renderer)

    function trainingRender(stage, ...args) {
      const pitch = game.pitch
      const players = game.stadium?.players
      const allPlayers = game.allPlayers
      if (!pitch || !players || !allPlayers) {
        origRender(stage, ...args)
        return
      }

      const vis = visibleSetRef.current

      // 训练没有中场和终场；保持底层实时状态，但不让隐藏的正式比赛时钟走完。
      if (Number(pitch.matchTime || 0) > 10) {
        try { pitch.matchTime = 0 } catch { /* Some Runtime builds expose a readonly clock. */ }
      }

      for (let i = 0; i < players.length; i++) {
        const sprite = players[i]
        if (!sprite) continue

        sprite.visible = vis.has(i)
        sprite.alpha = vis.has(i) ? 1 : 0
      }

      // 标签同步
      const entries = game.stadium._happySeedActorEntries
      if (entries) {
        for (const entry of entries) {
          if (!entry?.label) continue
          const ri = entry.actor?.runtimeIndex
          entry.label.visible = vis.has(ri)
          entry.label.alpha = vis.has(ri) ? 1 : 0
        }
      }

      const stateName = pitch.states?.current?.name || ''
      const ballX = Number(pitch.ball?.position?.x)
      const ballY = Number(pitch.ball?.position?.y)
      const pitchWidth = Number(pitch.width || 100)
      const pitchHeight = Number(pitch.height || 60)
      const outsidePitch = Number.isFinite(ballX) && Number.isFinite(ballY) && (
        ballX < -0.25
        || ballX > pitchWidth + 0.25
        || ballY < -0.25
        || ballY > pitchHeight + 0.25
      )
      const deadBallKey = DEAD_BALL_STATES.has(stateName)
        ? stateName
        : outsidePitch ? 'OutsidePitch' : ''
      if (deadBallKey && lastDeadBallStateRef.current !== deadBallKey) {
        lastDeadBallStateRef.current = deadBallKey
        const goal = stateName === 'Goal' || stateName === 'GoalCelebration'
        if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = window.setTimeout(() => {
          const result = configureTrainingRuntime({
            defender: hasDefenderRef.current,
            resetBall: true,
          })
          if (result) visibleSetRef.current = new Set(result.visibleIndices)
          setNotice(goal ? '进球！足球已回到脚下' : '足球出界，已回到脚下')
          if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
          noticeTimerRef.current = window.setTimeout(() => setNotice(''), 1600)
          resetTimerRef.current = null
        }, goal ? 650 : 0)
      } else if (!deadBallKey) {
        lastDeadBallStateRef.current = ''
      }

      origRender(stage, ...args)
    }
    renderer.render = trainingRender

    return () => {
      if (renderer.render === trainingRender) renderer.render = origRender
    }
  }, [])

  // 添加防守
  const addDefender = useCallback(() => {
    const next = !hasDefender
    const result = configureTrainingRuntime({ defender: next })
    if (!result) return
    hasDefenderRef.current = next
    setHasDefender(next)
    visibleSetRef.current = new Set(result.visibleIndices)
    setNotice(next ? '防守球员已入场' : '防守球员已离场')
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 1200)
  }, [hasDefender])

  // 退出训练
  const startMatch = useCallback(() => {
    if (saveData?.currentRun) {
      updateSaveData({ ...saveData, currentRun: { ...saveData.currentRun, trainingCompleted: true } })
    }
    shutdownMatchRuntime()
    navigateTo('tournament')
  }, [saveData, updateSaveData, navigateTo])

  const noopMatchComplete = useCallback(() => {}, [])

  return (
    <>
      <HappySeedMatchBroadcast saveData={saveData} onMatchComplete={noopMatchComplete} />

      <div className="tg-banner">
        <span className="tg-banner-title">训练基地</span>
        <span className="tg-banner-team">{team.name} · 熟悉操作</span>
      </div>

      {ready && (
        <div className="tg-hints tg-hints-persistent">
          <p className="tg-hints-title">操作说明</p>
          <div className="tg-hint-row">摇杆 = 移动球员</div>
          <div className="tg-hint-row">射门 = 长按蓄力 + 摇杆瞄准方向</div>
          <div className="tg-hint-row">传球 = 短传</div>
          <div className="tg-hint-row">铲球 = 滑铲断球</div>
          <div className="tg-hint-row">压迫 = 加速逼抢 / 防空争顶</div>
        </div>
      )}

      {notice && <div className="tg-notice" role="status">{notice}</div>}

      <div className="tg-top-actions">
        <button
          type="button"
          className={`tg-btn tg-btn-add${hasDefender ? ' is-done' : ''}`}
          onClick={addDefender}
        >
          {hasDefender ? '移除防守' : '添加防守'}
        </button>
        <button type="button" className="tg-btn tg-btn-start" onClick={startMatch}>
          开始比赛
        </button>
      </div>
    </>
  )
}
