import React, { useEffect, useRef, useState } from 'react'
import { updatePlayerInput } from '../services/happySeedMatchRuntime'
import { gamepadVisualState, getPlayerHasBall } from '../utils/gamepadInput'
import '../styles/playerControls.css'

/**
 * 虚拟控件（球员模式）— 桌面+移动端均显示
 *
 * 键位布局（4键上下文复用）：
 *   下(×) = 有球:传球 / 无球:切人
 *   右(○) = 射门（通用，长按蓄力+摇杆瞄准方向）
 *   上(△) = 有球:护球 / 无球:压迫（加速逼抢/防空争顶）
 *   左(□) = 有球:挑传 / 无球:铲球
 *   摇杆推满(>85%) = 加速
 *
 * 按钮标签根据有球/无球实时切换。
 */

const JOYSTICK_RADIUS = 56
const SPRINT_THRESHOLD = 0.85

function useHasBall() {
  const [hasBall, setHasBall] = useState(false)
  useEffect(() => {
    let raf = null
    const tick = () => {
      const hb = gamepadVisualState.active ? gamepadVisualState.hasBall : getPlayerHasBall()
      setHasBall(hb)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return hasBall
}

function Joystick() {
  const baseRef = useRef(null)
  const pointerIdRef = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [sprinting, setSprinting] = useState(false)
  const touchActiveRef = useRef(false)

  useEffect(() => {
    let raf = null
    const tick = () => {
      if (!touchActiveRef.current && gamepadVisualState.active) {
        const max = JOYSTICK_RADIUS
        const vx = gamepadVisualState.vx
        const vy = gamepadVisualState.vy
        setKnob({
          x: Math.max(-max, Math.min(max, vx * max)),
          y: Math.max(-max, Math.min(max, vy * max)),
        })
        setSprinting(Math.hypot(vx, vy) >= SPRINT_THRESHOLD)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const applyVector = (clientX, clientY) => {
    const base = baseRef.current
    if (!base) return
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = clientX - cx
    let dy = clientY - cy
    const dist = Math.hypot(dx, dy)
    const max = JOYSTICK_RADIUS
    if (dist > max) {
      dx = (dx / dist) * max
      dy = (dy / dist) * max
    }
    setKnob({ x: dx, y: dy })
    const nx = dx / max
    const ny = dy / max
    const isSprint = Math.hypot(nx, ny) >= SPRINT_THRESHOLD
    setSprinting(isSprint)
    updatePlayerInput({ vx: nx, vy: ny, sprint: isSprint })
  }

  const reset = () => {
    pointerIdRef.current = null
    touchActiveRef.current = false
    setKnob({ x: 0, y: 0 })
    setSprinting(false)
    updatePlayerInput({ vx: 0, vy: 0, sprint: false })
  }

  const onPointerDown = (event) => {
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    touchActiveRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    applyVector(event.clientX, event.clientY)
  }

  const onPointerMove = (event) => {
    if (pointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    applyVector(event.clientX, event.clientY)
  }

  const onPointerUp = (event) => {
    if (pointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    reset()
  }

  return (
    <div
      ref={baseRef}
      className={`pc-joystick-base${sprinting ? ' is-sprinting' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pc-joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  )
}

/**
 * 上下文感知动作按钮
 * @param {'pass'|'shoot'|'lob'|'tackle'|'switchPlayer'} withBallAction 有球时发送的信号
 * @param {'pass'|'shoot'|'lob'|'tackle'|'switchPlayer'} noBallAction 无球时发送的信号
 * @param {boolean} hold 是否持续按住
 */
function ActionButton({ labelWithBall, labelNoBall, className, withBallAction, noBallAction, hold, hasBall }) {
  const [pressed, setPressed] = useState(false)
  const label = hasBall ? labelWithBall : labelNoBall
  const action = hasBall ? withBallAction : noBallAction

  // 桌面端手柄高亮
  useEffect(() => {
    let raf = null
    const tick = () => {
      if (gamepadVisualState.active) {
        setPressed(Boolean(gamepadVisualState[action]))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [action])

  const press = (event) => {
    event.preventDefault()
    setPressed(true)
    updatePlayerInput({ [action]: true })
  }
  const release = (event) => {
    event.preventDefault()
    setPressed(false)
    if (!hold) return
    updatePlayerInput({ [action]: false })
  }

  return (
    <button
      type="button"
      className={`pc-action ${className || ''} ${pressed ? 'is-pressed' : ''}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      {label}
    </button>
  )
}

export default function PlayerControls() {
  const hasBall = useHasBall()

  return (
    <div className="player-controls" aria-label="球员操作区">
      <div className="pc-left">
        <Joystick />
      </div>
      <div className="pc-right">
        <div className="pc-dpad">
          {/* 上(△): 有球=护球 / 无球=压迫（加速逼抢/防空） */}
          <ActionButton
            labelWithBall="护球" labelNoBall="压迫"
            className="pc-btn-top"
            withBallAction="sprint" noBallAction="sprint"
            hold hasBall={hasBall}
          />
          {/* 左(□): 有球=挑传 / 无球=铲球 */}
          <ActionButton
            labelWithBall="挑传" labelNoBall="铲球"
            className="pc-btn-left"
            withBallAction="lob" noBallAction="tackle"
            hold={false} hasBall={hasBall}
          />
          {/* 右(○): 射门（通用） */}
          <ActionButton
            labelWithBall="射门" labelNoBall="射门"
            className="pc-btn-right"
            withBallAction="shoot" noBallAction="shoot"
            hold hasBall={hasBall}
          />
          {/* 下(×): 有球=传球 / 无球=切人 */}
          <ActionButton
            labelWithBall="传球" labelNoBall="切人"
            className="pc-btn-bottom"
            withBallAction="pass" noBallAction="switchPlayer"
            hold={false} hasBall={hasBall}
          />
        </div>
      </div>
    </div>
  )
}
