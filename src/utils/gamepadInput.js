/**
 * 桌面手柄输入管理器
 *
 * 通过浏览器 Gamepad API 轮询物理手柄，按 PS5 键位约定
 * 把摇杆/按键映射到统一输入通道 window.__touchInput（经 updatePlayerInput）。
 *
 * 键位映射（PS5 标准布局，4键上下文复用）：
 *   ×(button0) = 有球:传球 / 无球:切换球员
 *   ○(button1) = 射门（有球无球通用，引擎自动判断头球/射门）
 *   □(button2) = 有球:挑传 / 无球:铲球
 *   △(button3) = 有球:护球 / 无球:压迫(加速逼抢/防空争顶)
 *   左摇杆推满(>85%) = 加速
 *   十字键 button12-15 = 移动
 *
 * 加速由摇杆推满自动触发。
 */
import { updatePlayerInput } from '../services/happySeedMatchRuntime'

const BTN = {
  CROSS: 0,
  CIRCLE: 1,
  SQUARE: 2,
  TRIANGLE: 3,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
}

const STICK_DEADZONE = 0.15
const SPRINT_THRESHOLD = 0.85

let rafId = null
let prevButtons = {}

export function getPlayerHasBall() {
  try {
    const game = window.__matchGame
    if (!game || !game.pitch) return false
    const ball = game.pitch.ball
    if (!ball) return false
    if (ball.owner && ball.owner.user) return true
    if (ball.inHands && ball.inHands.user) return true
    return false
  } catch {
    return false
  }
}

export const gamepadVisualState = {
  vx: 0, vy: 0,
  shoot: false, sprint: false,
  pass: false, tackle: false, lob: false,
  switchPlayer: false,
  hasBall: false,
  active: false,
}

function getActiveGamepad() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  const pads = navigator.getGamepads()
  for (let i = 0; i < pads.length; i += 1) {
    const pad = pads[i]
    if (pad && pad.connected) return pad
  }
  return null
}

function pressed(pad, index) {
  const button = pad.buttons[index]
  return Boolean(button && (button.pressed || button.value > 0.5))
}

function pollGamepad() {
  const pad = getActiveGamepad()
  if (!pad) {
    prevButtons = {}
    gamepadVisualState.active = false
    rafId = requestAnimationFrame(pollGamepad)
    return
  }

  const isDown = (index) => pressed(pad, index)
  const justPressed = (index) => isDown(index) && !prevButtons[index]

  let vx = Number(pad.axes[0]) || 0
  let vy = Number(pad.axes[1]) || 0
  if (Math.abs(vx) < STICK_DEADZONE) vx = 0
  if (Math.abs(vy) < STICK_DEADZONE) vy = 0
  if (isDown(BTN.DPAD_LEFT)) vx = -1
  if (isDown(BTN.DPAD_RIGHT)) vx = 1
  if (isDown(BTN.DPAD_UP)) vy = -1
  if (isDown(BTN.DPAD_DOWN)) vy = 1

  const stickMag = Math.hypot(vx, vy)
  const isSprint = stickMag >= SPRINT_THRESHOLD
  const hasBall = getPlayerHasBall()

  const patch = {
    vx,
    vy,
    shoot: isDown(BTN.CIRCLE),
    sprint: isSprint,
  }

  if (hasBall) {
    if (justPressed(BTN.CROSS)) patch.pass = true
    if (justPressed(BTN.SQUARE)) patch.lob = true
  } else {
    if (justPressed(BTN.CROSS)) patch.switchPlayer = true
    if (justPressed(BTN.SQUARE)) patch.tackle = true
    // △ = 压迫/防空（持续加速逼抢，靠近高空球自动头球）
    if (isDown(BTN.TRIANGLE)) patch.sprint = true
  }

  updatePlayerInput(patch)

  gamepadVisualState.vx = vx
  gamepadVisualState.vy = vy
  gamepadVisualState.shoot = isDown(BTN.CIRCLE)
  gamepadVisualState.sprint = isSprint
  gamepadVisualState.hasBall = hasBall
  gamepadVisualState.pass = hasBall && justPressed(BTN.CROSS)
  gamepadVisualState.switchPlayer = !hasBall && justPressed(BTN.CROSS)
  gamepadVisualState.lob = hasBall && justPressed(BTN.SQUARE)
  gamepadVisualState.tackle = !hasBall && justPressed(BTN.SQUARE)
  gamepadVisualState.active = true

  const next = {}
  for (let i = 0; i < pad.buttons.length; i += 1) next[i] = isDown(i)
  prevButtons = next

  rafId = requestAnimationFrame(pollGamepad)
}

export function startGamepadInput() {
  if (rafId != null) return
  prevButtons = {}
  rafId = requestAnimationFrame(pollGamepad)
}

export function stopGamepadInput() {
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  prevButtons = {}
  gamepadVisualState.active = false
}
