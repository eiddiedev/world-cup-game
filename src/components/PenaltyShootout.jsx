import React, { useEffect, useMemo, useRef, useState } from 'react'
import { audioManager } from '../utils/audioManager'
import {
  getShootoutWinner,
  pickAiKeeperZone,
  pickAiShooterZone,
  resolveShootoutAttempt,
} from '../utils/penaltyShootout.js'
import '../styles/happySeedBroadcastV2.css'

// —— 画布与场景（背景图原生分辨率 1672×941，cover 铺满全屏）——
const LOGICAL_WIDTH = 1672
const LOGICAL_HEIGHT = 941
const GOAL = { x: 448, y: 231, w: 776, h: 258 }
const SPOT = { x: 836, y: 640 }
// 锚点：height 为人物可见身高（头顶到脚底，画布像素）
const KEEPER_ANCHOR = { feetX: 836, feetY: 492, height: 200 }
const KICKER_ANCHOR = { feetX: 610, feetY: 792, height: 330 }

// —— 逐帧节奏（用户规格：每帧 60~80ms，取 70ms）——
const KICKER_FRAME_MS = 70
const BALL_LAUNCH_MS = 285 // 对应 P6 射门帧
const KEEPER_WAIT_MIN = 100
const KEEPER_WAIT_SPAN = 150
const GOAL_FLASH_MS = 300 // 进球后球网鼓起（背景2）时长
const PROMPT_DURATION = 1150
const RESULT_DURATION = 950
const COMPLETE_DELAY = 1500
const KEEPER_COUNTDOWN = 3000
const MIN_SWIPE = 24
const POWER_LIMIT = 430 // 超过才算发力过猛打飞（降低打飞频率）
const DIVE_TRAVEL_MS = 320 // 门将身体横移到位的时长
const DIVE_TRAVEL_RATIO = 0.45 // 横移幅度（避免覆盖半个球门）
const HITBOX_INSET = 0.30 // 碰撞体积横向收紧比例（只算躯干核心）

const ASSET_ROOT = '/assets/shootout'
const SPRITE_SOURCES = {
  bg1: `${ASSET_ROOT}/bg1.png`,
  bg2: `${ASSET_ROOT}/bg2.png`,
  ball: `${ASSET_ROOT}/ball.png`,
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`p${i + 1}`, `${ASSET_ROOT}/p${i + 1}.png`])),
  ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`gk${i + 1}`, `${ASSET_ROOT}/gk${i + 1}.png`])),
}
const KICKER_SEQUENCE = ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
// 原生 GK2-5 是向右扑；左扑用镜像（scaleX(-1) 预渲染）
const RIGHT_DIVE = ['gk2', 'gk3', 'gk4', 'gk5']
const LEFT_DIVE = ['gk2R', 'gk3R', 'gk4R', 'gk5R']

const ZONE_COLUMNS = ['left', 'center', 'right']

const getPosition = player => player?.pos || player?.position

function pickGoalkeeper(lineup = []) {
  return lineup.find(player => getPosition(player) === 'GK') || lineup[0]
}

function pickShooter(lineup = [], index = 0) {
  const candidates = lineup
    .filter(player => getPosition(player) !== 'GK')
    .sort((a, b) => (
      (b.tec || b.rating || 70) + (b.att || 0)
      - (a.tec || a.rating || 70) - (a.att || 0)
    ))
  return candidates[index % Math.max(1, candidates.length)] || lineup[0]
}

function zoneFromSwipe(dx, dy) {
  const column = Math.abs(dx) < 36 ? 'center' : dx < 0 ? 'left' : 'right'
  const row = dy < -12 ? 'top' : 'bottom'
  return `${column}-${row}`
}

function zoneRect(zone) {
  const [column, row] = zone.split('-')
  const columnIndex = Math.max(0, ZONE_COLUMNS.indexOf(column))
  const rowIndex = row === 'top' ? 0 : 1
  const w = GOAL.w / 3
  const h = GOAL.h / 2
  return { x: GOAL.x + columnIndex * w, y: GOAL.y + rowIndex * h, w, h }
}

// —— 弹道：点球点 → 目标区域内随机点的直线（松手后才显示）——
function trajectoryFor(zone, jitter = 0) {
  const rect = zoneRect(zone)
  const end = {
    x: rect.x + rect.w / 2 + jitter * rect.w * 0.3,
    y: rect.y + rect.h / 2 + jitter * rect.h * 0.24,
  }
  return {
    start: { ...SPOT },
    ctrl: { x: (SPOT.x + end.x) / 2, y: (SPOT.y + end.y) / 2 },
    end,
  }
}

function bezierPoint(traj, t) {
  const u = 1 - t
  return {
    x: u * u * traj.start.x + 2 * u * t * traj.ctrl.x + t * t * traj.end.x,
    y: u * u * traj.start.y + 2 * u * t * traj.ctrl.y + t * t * traj.end.y,
  }
}

// 打飞：从点球点沿滑动方向直线偏出（飞过横梁或偏出两侧），不走弧线
function missTrajectory(dx, dy) {
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const end = { x: SPOT.x + ux * 860, y: SPOT.y + uy * 860 }
  return {
    start: { ...SPOT },
    ctrl: { x: (SPOT.x + end.x) / 2, y: (SPOT.y + end.y) / 2 },
    end,
  }
}

// 门将扑救线：从门将站位（身体中部）直指扑救区域中心，松手后才显示
function diveTrajectory(zone) {
  const rect = zoneRect(zone)
  const end = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
  const start = {
    x: KEEPER_ANCHOR.feetX,
    y: KEEPER_ANCHOR.feetY - KEEPER_ANCHOR.height * 0.55,
  }
  return {
    start,
    ctrl: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    end,
  }
}

function drawTrajectory(ctx, traj, color, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  for (let i = 1; i <= 24; i += 1) {
    const point = bezierPoint(traj, i / 24)
    ctx.fillRect(Math.round(point.x) - 3, Math.round(point.y) - 3, 6, 6)
  }
  ctx.restore()
}

// 加载期计算每个精灵的不透明像素包围盒（用于精确踩地和门将碰撞体积）
function spriteMetrics(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, img.width, img.height).data
  let x0 = img.width
  let y0 = img.height
  let x1 = 0
  let y1 = 0
  for (let y = 0; y < img.height; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      if (data[(y * img.width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return {
    x0: x0 / img.width,
    y0: y0 / img.height,
    x1: x1 / img.width,
    y1: y1 / img.height,
  }
}

function mirrorMetrics(metrics) {
  return { x0: 1 - metrics.x1, y0: metrics.y0, x1: 1 - metrics.x0, y1: metrics.y1 }
}

function flipImage(img) {
  const flipped = document.createElement('canvas')
  flipped.width = img.width
  flipped.height = img.height
  const ctx = flipped.getContext('2d')
  ctx.translate(img.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(img, 0, 0)
  return flipped
}

// RGB <-> HSL（球衣调色用）
function rgbToHsl(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let rgb
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const m = l - c / 2
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ]
}

// 球衣换色：按色相区间识别球衣主色并整体偏移，保留明暗（像素阴影）
// 皮肤/头发/黑白灰不受影响（色相不在区间或饱和度太低）
const RECOLOR_RULES = {
  // 罚球手：黄衫 -> 红色，蓝裤 -> 浅灰
  p: [
    { from: [42, 78], to: 356 },
    { from: [195, 255], desaturate: true },
  ],
  // 门将：绿衣 -> 红色
  gk: [{ from: [90, 172], to: 352 }],
}

function recolorSprite(img, rules) {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, img.width, img.height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 16) continue
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
    if (s < 0.22) continue // 黑白灰跳过
    for (const rule of rules) {
      if (h < rule.from[0] || h > rule.from[1]) continue
      const [nr, ng, nb] = rule.desaturate
        ? hslToRgb(h, Math.min(0.08, s), Math.min(0.92, l + 0.22))
        : hslToRgb(rule.to, s, l)
      data[i] = nr
      data[i + 1] = ng
      data[i + 2] = nb
      break
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function drawSprite(ctx, img, metrics, scale, feetX, feetY) {
  if (!img || !metrics) return
  const dw = img.width * scale
  const dh = img.height * scale
  const cxFrac = (metrics.x0 + metrics.x1) / 2
  ctx.drawImage(img, feetX - cxFrac * dw, feetY - metrics.y1 * dh, dw, dh)
}

// 门将碰撞体积：当前帧人物实体区域（胳膊腿边缘宽容收紧）
function keeperHitbox(frameKey, anchor, images, metrics, scale) {
  const img = images[frameKey]
  const m = metrics[frameKey]
  if (!img || !m) return null
  const dw = img.width * scale
  const dh = img.height * scale
  const cxFrac = (m.x0 + m.x1) / 2
  const insetX = (m.x1 - m.x0) * dw * HITBOX_INSET
  return {
    x0: anchor.feetX - cxFrac * dw + m.x0 * dw + insetX,
    x1: anchor.feetX - cxFrac * dw + m.x1 * dw - insetX,
    y0: anchor.feetY - m.y1 * dh + m.y0 * dh,
    y1: anchor.feetY,
  }
}

export default function PenaltyShootout({
  homeTeam,
  awayTeam,
  homeLineup = [],
  awayLineup = [],
  onComplete,
  onExit,
}) {
  const canvasRef = useRef(null)
  const countdownBarRef = useRef(null)
  const rafRef = useRef(null)
  const timersRef = useRef([])
  const onCompleteRef = useRef(onComplete)
  const imagesRef = useRef(null)
  const metricsRef = useRef(null)
  const scalesRef = useRef({ p: 1, gk: 1 })
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0, dpr: 1 })
  const sceneRef = useRef({
    phase: 'loading',
    mode: 'shoot',
    kick: null,
    drag: null,
    aimStart: 0,
    shots: [],
  })
  const [loaded, setLoaded] = useState(false)
  const [shots, setShots] = useState([])
  const [phase, setPhase] = useState('loading')
  const [promptText, setPromptText] = useState('')
  const [banner, setBanner] = useState(null)
  const [finishedWinner, setFinishedWinner] = useState(null)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const isHomeTurn = shots.length % 2 === 0
  const homeScore = shots.filter(shot => shot.team === 'home' && shot.scored).length
  const awayScore = shots.filter(shot => shot.team === 'away' && shot.scored).length
  const currentRound = Math.floor(shots.length / 2) + 1
  const roundCount = Math.max(5, currentRound)

  const schedule = (fn, delay) => {
    const id = setTimeout(fn, delay)
    timersRef.current.push(id)
    return id
  }

  const syncPhase = (nextPhase) => {
    sceneRef.current.phase = nextPhase
    setPhase(nextPhase)
  }

  const beginRound = () => {
    const scene = sceneRef.current
    const round = Math.floor(scene.shots.length / 2) + 1
    const homeShooting = scene.shots.length % 2 === 0
    scene.mode = homeShooting ? 'shoot' : 'keep'
    const homeKicks = scene.shots.filter(shot => shot.team === 'home').length
    const awayKicks = scene.shots.filter(shot => shot.team === 'away').length
    scene.shooter = homeShooting ? pickShooter(homeLineup, homeKicks) : pickShooter(awayLineup, awayKicks)
    scene.keeper = homeShooting ? pickGoalkeeper(awayLineup) : pickGoalkeeper(homeLineup)
    scene.kick = null
    scene.drag = null
    setBanner(null)
    syncPhase('prompt')
    setPromptText(`第 ${round} 轮 · ${homeShooting ? homeTeam : awayTeam}主罚`)
    schedule(() => {
      scene.aimStart = performance.now()
      syncPhase('aim')
    }, PROMPT_DURATION)
  }

  const settleAttempt = (attempt) => {
    const scene = sceneRef.current
    const shot = {
      round: Math.floor(scene.shots.length / 2) + 1,
      team: scene.mode === 'shoot' ? 'home' : 'away',
      scored: attempt.scored,
      saved: attempt.saved,
      missed: attempt.missed,
    }
    const nextShots = [...scene.shots, shot]
    scene.shots = nextShots
    setShots(nextShots)
    const winner = getShootoutWinner(nextShots)
    if (winner) {
      syncPhase('done')
      setFinishedWinner(winner)
      setBanner({
        type: 'winner',
        text: winner === 'home' ? `${homeTeam}晋级！` : `${awayTeam}晋级！`,
      })
      audioManager.playSound('whistle')
      schedule(() => onCompleteRef.current?.(winner), COMPLETE_DELAY)
    } else {
      beginRound()
    }
  }

  const onKickDone = (attempt) => {
    const scene = sceneRef.current
    // 球碰到门将身体（碰撞体积）一律算扑出，即使弹道原本通向其他区域
    const finalAttempt = scene.kick?.collision && !attempt.saved
      ? { ...attempt, scored: false, saved: true, missed: false }
      : attempt
    // 触球音效已在碰撞瞬间播放；同区扑出但无碰撞时这里补一声；
    // 点球大战进球只吹哨，不放人形庆祝声
    if (finalAttempt.scored) audioManager.playSound('whistle')
    else if (finalAttempt.saved && !scene.kick?.collision) audioManager.playSound('ballTouch')
    else if (finalAttempt.missed) audioManager.playSound('whistle')
    syncPhase('result')
    setBanner({
      type: finalAttempt.scored ? 'goal' : finalAttempt.saved ? 'save' : 'miss',
      text: finalAttempt.scored ? 'GOAL!' : finalAttempt.saved ? 'SAVE!' : 'MISS!',
    })
    schedule(() => settleAttempt(finalAttempt), RESULT_DURATION)
  }

  const commitSwipe = (dx, dy, length) => {
    const scene = sceneRef.current
    if (scene.phase !== 'aim') return
    const zone = zoneFromSwipe(dx, dy)
    const shooterTec = scene.shooter?.tec || scene.shooter?.rating || 70
    const keeperDef = scene.keeper?.def || scene.keeper?.rating || 70

    let shooterZone
    let keeperZone
    let overpowered
    let power
    if (scene.mode === 'shoot') {
      shooterZone = zone
      overpowered = length > POWER_LIMIT
      power = Math.min(1, length / POWER_LIMIT)
      keeperZone = pickAiKeeperZone(keeperDef, Math.random)
    } else {
      keeperZone = zone
      const aiPick = pickAiShooterZone(shooterTec, Math.random)
      shooterZone = aiPick.zone
      overpowered = aiPick.overpowered
      power = 0.55 + Math.random() * 0.3
    }

    const attempt = resolveShootoutAttempt({
      shooterZone,
      keeperZone,
      overpowered,
      shooterTec,
      keeperDef,
      random: Math.random,
    })

    const flightMs = 560 - 300 * Math.max(0.25, power)
    scene.drag = null
    scene.kick = {
      start: performance.now(),
      keeperWait: KEEPER_WAIT_MIN + Math.random() * KEEPER_WAIT_SPAN,
      flightMs,
      flightT: 1,
      traj: overpowered
        ? (scene.mode === 'shoot'
          ? missTrajectory(dx, dy)
          : (() => {
            const zone = zoneRect(shooterZone)
            return missTrajectory(
              zone.x + zone.w / 2 - SPOT.x,
              (zone.y + zone.h / 2 - SPOT.y) * (shooterZone.endsWith('top') ? 2.2 : 1.3),
            )
          })())
        : trajectoryFor(shooterZone, Math.random() * 2 - 1),
      shooterZone,
      keeperZone,
      collision: null,
      attempt,
    }
    syncPhase('kick')
    // P6 出脚瞬间播放触球音
    schedule(() => audioManager.playSound('ballShot'), BALL_LAUNCH_MS)
    schedule(() => onKickDone(attempt), BALL_LAUNCH_MS + flightMs * scene.kick.flightT)
  }

  // —— 预加载素材 + 人物包围盒 + 左扑镜像 + 客队球衣换色 ——
  useEffect(() => {
    let cancelled = false
    const entries = Object.entries(SPRITE_SOURCES)
    Promise.all(entries.map(([key, src]) => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve([key, img])
      img.onerror = () => resolve([key, null])
      img.src = src
    }))).then((pairs) => {
      if (cancelled) return
      const images = Object.fromEntries(pairs)
      const metrics = Object.fromEntries(pairs.map(([key, img]) => [
        key,
        img && !['bg1', 'bg2', 'ball'].includes(key) ? spriteMetrics(img) : null,
      ]))
      // 左扑镜像
      RIGHT_DIVE.forEach((key, index) => {
        if (!images[key]) return
        const flippedKey = LEFT_DIVE[index]
        images[flippedKey] = flipImage(images[key])
        metrics[flippedKey] = mirrorMetrics(metrics[key])
      })
      // 客队换色：A_ 前缀（含左扑镜像）
      const recolorKeys = [
        ...KICKER_SEQUENCE.map(k => [k, 'p']),
        ['p1', 'p'],
        ...RIGHT_DIVE.map(k => [k, 'gk']),
        ['gk1', 'gk'],
        ['gk6', 'gk'],
        ['gk7', 'gk'],
      ]
      recolorKeys.forEach(([key, set]) => {
        if (!images[key]) return
        images[`A_${key}`] = recolorSprite(images[key], RECOLOR_RULES[set])
        metrics[`A_${key}`] = metrics[key]
      })
      RIGHT_DIVE.forEach((key, index) => {
        if (!images[`A_${key}`]) return
        const flippedKey = `A_${LEFT_DIVE[index]}`
        images[flippedKey] = flipImage(images[`A_${key}`])
        metrics[flippedKey] = mirrorMetrics(metrics[key])
      })
      // 统一缩放：以该套系的站立帧为基准，所有帧同一比例，不再逐帧缩放
      if (images.p1 && metrics.p1) {
        scalesRef.current.p = KICKER_ANCHOR.height
          / ((metrics.p1.y1 - metrics.p1.y0) * images.p1.height)
      }
      if (images.gk1 && metrics.gk1) {
        scalesRef.current.gk = KEEPER_ANCHOR.height
          / ((metrics.gk1.y1 - metrics.gk1.y0) * images.gk1.height)
      }
      imagesRef.current = images
      metricsRef.current = metrics
      setLoaded(true)
      beginRound()
    })
    return () => { cancelled = true }
  }, [])

  // —— 渲染循环 ——
  useEffect(() => {
    if (!loaded) return undefined
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return undefined

    const render = (now) => {
      const scene = sceneRef.current
      const images = imagesRef.current || {}
      const metrics = metricsRef.current || {}
      // cover 变换：场景铺满全屏，超出部分居中裁切
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const bw = Math.max(1, Math.round(rect.width * dpr))
      const bh = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      const scale = Math.max(bw / LOGICAL_WIDTH, bh / LOGICAL_HEIGHT)
      const view = {
        scale,
        ox: (bw - LOGICAL_WIDTH * scale) / 2,
        oy: (bh - LOGICAL_HEIGHT * scale) / 2,
        dpr,
        cssWidth: rect.width,
        cssHeight: rect.height,
      }
      viewRef.current = view
      ctx.setTransform(scale, 0, 0, scale, view.ox, view.oy)
      ctx.imageSmoothingEnabled = false

      const kick = scene.kick
      const elapsed = kick ? now - kick.start : 0

      // 背景：进球后 300ms 内球网鼓起（背景2）
      const goalFlash = kick?.attempt.scored && !kick.collision
        && elapsed > BALL_LAUNCH_MS + kick.flightMs
        && elapsed < BALL_LAUNCH_MS + kick.flightMs + GOAL_FLASH_MS
      const bg = images[goalFlash ? 'bg2' : 'bg1'] || images.bg1
      if (bg) ctx.drawImage(bg, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)

      // 松手后才显示方向线：从点球点直指目标区域的直线（滑动中不显示，避免提前泄露）
      if (kick && ['kick', 'result'].includes(scene.phase)) {
        drawTrajectory(
          ctx,
          kick.traj,
          kick.attempt.missed ? '#ff5e64' : scene.mode === 'shoot' ? '#18e1d1' : '#ffd43f',
          0.75,
        )
        // 门将视角：额外绘制一条扑救方向线（玩家滑动方向），门将沿此线扑救
        if (scene.mode === 'keep') {
          drawTrajectory(ctx, diveTrajectory(kick.keeperZone), '#18e1d1', 0.75)
        }
      }

      // 双方配色：我方原色，客队换色（A_ 前缀）
      const keeperPrefix = scene.mode === 'shoot' ? 'A_' : ''
      const kickerPrefix = scene.mode === 'shoot' ? '' : 'A_'

      // 门将：待机 GK1；扑救时身体先横移再逐帧伸展（碰撞体积跟随身体）
      let keeperFrame = `${keeperPrefix}gk1`
      let keeperAnchor = KEEPER_ANCHOR
      if (kick) {
        const keeperElapsed = elapsed - kick.keeperWait
        if (keeperElapsed >= 0) {
          const zoneCenter = zoneRect(kick.keeperZone)
          const targetX = zoneCenter.x + zoneCenter.w / 2
          const travel = Math.min(1, keeperElapsed / DIVE_TRAVEL_MS)
          const ease = 1 - (1 - travel) * (1 - travel)
          keeperAnchor = {
            ...KEEPER_ANCHOR,
            feetX: KEEPER_ANCHOR.feetX
              + (targetX - KEEPER_ANCHOR.feetX) * DIVE_TRAVEL_RATIO * ease,
            feetY: KEEPER_ANCHOR.feetY - (kick.keeperZone.endsWith('top') ? 28 : 0) * ease,
          }
          const isLeft = kick.keeperZone.startsWith('left')
          const isCenter = kick.keeperZone.startsWith('center')
          const resultAt = BALL_LAUNCH_MS + kick.flightMs * kick.flightT + 120
          if (isCenter) {
            keeperFrame = keeperElapsed < 130
              ? `${keeperPrefix}gk2`
              : `${keeperPrefix}${kick.keeperZone.endsWith('top') ? 'gk6' : 'gk7'}`
          } else {
            const seq = isLeft ? LEFT_DIVE : RIGHT_DIVE
            if (keeperElapsed < 130) keeperFrame = `${keeperPrefix}${seq[0]}`
            else if (keeperElapsed < 260) keeperFrame = `${keeperPrefix}${seq[1]}`
            else if (elapsed < resultAt) keeperFrame = `${keeperPrefix}${seq[2]}`
            else keeperFrame = `${keeperPrefix}${seq[3]}`
          }
        }
      }
      drawSprite(ctx, images[keeperFrame], metrics[keeperFrame], scalesRef.current.gk,
        keeperAnchor.feetX, keeperAnchor.feetY)

      // 罚球手：待机 P1；松手后 P2→P8 逐帧播放，结束保持 P8
      let kickerFrame = `${kickerPrefix}p1`
      if (kick) {
        const index = Math.min(
          KICKER_SEQUENCE.length - 1,
          Math.floor(elapsed / KICKER_FRAME_MS),
        )
        kickerFrame = `${kickerPrefix}${KICKER_SEQUENCE[index]}`
      }
      drawSprite(ctx, images[kickerFrame], metrics[kickerFrame], scalesRef.current.p,
        KICKER_ANCHOR.feetX, KICKER_ANCHOR.feetY)

      // 足球：P6 帧出脚，沿弹道匀速飞行；碰到门将身体即被没收（触球音效）
      if (images.ball) {
        let ball = { x: SPOT.x, y: SPOT.y, scale: 1 }
        if (kick && elapsed >= BALL_LAUNCH_MS) {
          let t = Math.min(kick.flightT, (elapsed - BALL_LAUNCH_MS) / kick.flightMs)
          if (kick.collision) {
            t = kick.collision.t
          } else {
            const hitbox = keeperHitbox(keeperFrame, keeperAnchor, images, metrics,
              scalesRef.current.gk)
            const point = bezierPoint(kick.traj, t)
            if (hitbox && t > 0.4 && point.x >= hitbox.x0 && point.x <= hitbox.x1
              && point.y >= hitbox.y0 && point.y <= hitbox.y1) {
              kick.collision = { t }
              audioManager.playSound('ballTouch') // 门将触球瞬间的触球音
            }
          }
          const point = bezierPoint(kick.traj, t)
          ball = { x: point.x, y: point.y, scale: 1 - 0.3 * Math.min(1, t) }
        }
        const ballW = 54 * ball.scale
        const ballH = (images.ball.height / images.ball.width) * ballW
        ctx.drawImage(images.ball, ball.x - ballW / 2, ball.y - ballH / 2, ballW, ballH)
      }

      if (scene.phase === 'aim' && scene.mode === 'keep' && countdownBarRef.current) {
        const remaining = Math.max(0, KEEPER_COUNTDOWN - (now - scene.aimStart))
        countdownBarRef.current.style.width = `${(remaining / KEEPER_COUNTDOWN) * 100}%`
        if (remaining <= 0) commitSwipe(0, 0, 0)
      }

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [loaded])

  useEffect(() => () => {
    timersRef.current.forEach(id => clearTimeout(id))
    timersRef.current = []
  }, [])

  const pointerPosition = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const view = viewRef.current
    return {
      x: ((event.clientX - rect.left) * view.dpr - view.ox) / view.scale,
      y: ((event.clientY - rect.top) * view.dpr - view.oy) / view.scale,
    }
  }

  const handlePointerDown = (event) => {
    if (sceneRef.current.phase !== 'aim') return
    event.preventDefault()
    canvasRef.current.setPointerCapture?.(event.pointerId)
    const point = pointerPosition(event)
    sceneRef.current.drag = { active: true, sx: point.x, sy: point.y, cx: point.x, cy: point.y }
  }

  const handlePointerMove = (event) => {
    const drag = sceneRef.current.drag
    if (!drag?.active) return
    const point = pointerPosition(event)
    drag.cx = point.x
    drag.cy = point.y
  }

  const handlePointerUp = (event) => {
    const drag = sceneRef.current.drag
    if (!drag?.active) return
    const point = pointerPosition(event)
    const dx = point.x - drag.sx
    const dy = point.y - drag.sy
    const length = Math.hypot(dx, dy)
    drag.active = false
    if (length >= MIN_SWIPE) commitSwipe(dx, dy, length)
    else sceneRef.current.drag = null
  }

  const roundMarkers = useMemo(() => (
    Array.from({ length: roundCount }, (_, index) => {
      const round = index + 1
      const homeShot = shots.find(shot => shot.round === round && shot.team === 'home')
      const awayShot = shots.find(shot => shot.round === round && shot.team === 'away')
      return { round, homeShot, awayShot }
    })
  ), [roundCount, shots])

  const markerDots = (team) => roundMarkers.map(({ round, homeShot, awayShot }) => {
    const shot = team === 'home' ? homeShot : awayShot
    const cls = shot ? (shot.scored ? 'is-goal' : 'is-miss') : ''
    return (
      <span key={`${team}-${round}`} className={`penalty-dot ${cls}`}>
        {shot && !shot.scored ? '✕' : ''}
      </span>
    )
  })

  return (
    <div className="penalty-screen" role="dialog" aria-label="点球大战">
      {onExit && (
        <button type="button" className="penalty-exit-button" onClick={onExit} aria-label="返回主页">
          ←
        </button>
      )}
      <canvas
        ref={canvasRef}
        className="penalty-canvas"
        aria-label="点球大战球场"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {!loaded && <div className="penalty-prompt">正在加载点球素材…</div>}
      {loaded && phase === 'prompt' && !finishedWinner && (
        <div className="penalty-prompt">{promptText}</div>
      )}
      {banner && (
        <div className={`penalty-banner penalty-banner--${banner.type}`}>{banner.text}</div>
      )}

      {!finishedWinner && (
        <div className="penalty-hint">
          <span className="penalty-hint-text">
            {isHomeTurn ? '滑动射门！' : '滑动扑救！'}
          </span>
          {!isHomeTurn && phase === 'aim' && (
            <div className="penalty-countdown" aria-label="扑救倒计时">
              <i ref={countdownBarRef} />
            </div>
          )}
        </div>
      )}

      <div className="penalty-corner penalty-corner--home">
        <img src={`/assets/国旗/${homeTeam}.png`} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <strong className="penalty-corner-score">{homeScore}</strong>
        <div className="penalty-dots">{markerDots('home')}</div>
      </div>
      <div className="penalty-corner penalty-corner--away">
        <div className="penalty-dots">{markerDots('away')}</div>
        <strong className="penalty-corner-score">{awayScore}</strong>
        <img src={`/assets/国旗/${awayTeam}.png`} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      </div>
    </div>
  )
}
