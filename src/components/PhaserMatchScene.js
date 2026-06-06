import { FORMATION_POSITIONS } from '../utils/formationPositions.js'
import { ANIMATION_TEMPLATES } from '../utils/animationTemplates.js'
import { BALL_ASSET_SRC, getResultAnimationKey } from '../utils/animationResultMapper.js'
import { BALL_ZONES, createAmbientTargets } from '../utils/matchVisuals.js'
import { MATCH_EVENT_ASSETS } from '../utils/matchEventVisuals.js'
import { createPitchBounds, tacticalToPhaserPoint } from '../utils/phaserPitch.js'

const clamp = (value, min = 4, max = 96) => Math.max(min, Math.min(max, value))

function getPosition(player) {
  return player?.pos || player?.position
}

export function createPhaserMatchScene(Phaser, controller) {
  return class PhaserMatchScene extends Phaser.Scene {
    constructor() {
      super('MatchScene')
      this.controller = controller
      this.playerPositions = {}
      this.playerObjects = new Map()
      this.lockedPlayers = new Set()
      this.effects = []
      this.ballPosition = { x: 50, y: 50, lift: 0 }
      this.ballZone = 'midfield'
      this.ballCarrier = null
      this.possessionTeam = 'my'
      this.animating = false
      this.ambientPhase = 0
      this.lastAmbientSwitch = 0
      this.lastFreekickX = 50
      this.lastFreekickY = 75
      this.playerVelocities = {}
      this.kickCooldowns = {}
      this._ballTarget = null
    }

    preload() {
      this.load.image('match-ball', BALL_ASSET_SRC)
      Object.entries(MATCH_EVENT_ASSETS).forEach(([key, src]) => {
        this.load.image(`event-${key}`, src)
      })
    }

    create() {
      this.pitch = createPitchBounds(this.scale.width, this.scale.height)
      this.drawPitch()
      this.createPlayerTextures()
      this.createPlayers()
      this.createBall()
      this.resetPositions()
      this.controller.scene = this
      this.controller.resolveReady?.(this)
    }

    drawPitch() {
      const { x, y, width, height } = this.pitch
      const graphics = this.add.graphics().setDepth(0)
      const stripeWidth = width / 14

      for (let index = 0; index < 14; index += 1) {
        graphics.fillStyle(index % 2 === 0 ? 0x2d8a4e : 0x34975a)
        graphics.fillRect(x + index * stripeWidth, y, stripeWidth + 1, height)
      }

      graphics.lineStyle(Math.max(2, Math.round(this.scale.height / 240)), 0xf4f0e8, 1)
      graphics.strokeRect(x, y, width, height)
      graphics.lineBetween(x + width / 2, y, x + width / 2, y + height)
      graphics.strokeCircle(x + width / 2, y + height / 2, height * 0.14)
      graphics.fillStyle(0xf4f0e8, 1)
      graphics.fillCircle(x + width / 2, y + height / 2, 3)

      const penaltyWidth = width * 0.145
      const penaltyHeight = height * 0.5
      const penaltyY = y + (height - penaltyHeight) / 2
      graphics.strokeRect(x, penaltyY, penaltyWidth, penaltyHeight)
      graphics.strokeRect(x + width - penaltyWidth, penaltyY, penaltyWidth, penaltyHeight)

      const boxWidth = width * 0.058
      const boxHeight = height * 0.28
      const boxY = y + (height - boxHeight) / 2
      graphics.strokeRect(x, boxY, boxWidth, boxHeight)
      graphics.strokeRect(x + width - boxWidth, boxY, boxWidth, boxHeight)

      const goalWidth = Math.max(7, width * 0.012)
      const goalHeight = height * 0.23
      const goalY = y + (height - goalHeight) / 2
      graphics.fillStyle(0xf4f0e8, 0.35)
      graphics.fillRect(x - goalWidth, goalY, goalWidth, goalHeight)
      graphics.fillRect(x + width, goalY, goalWidth, goalHeight)
      graphics.lineStyle(2, 0xf4f0e8, 0.85)
      graphics.strokeRect(x - goalWidth, goalY, goalWidth, goalHeight)
      graphics.strokeRect(x + width, goalY, goalWidth, goalHeight)

      const net = this.add.graphics().setDepth(1)
      net.lineStyle(1, 0xf4f0e8, 0.28)
      for (let netY = goalY; netY <= goalY + goalHeight; netY += Math.max(5, height / 60)) {
        net.lineBetween(x - goalWidth, netY, x, netY)
        net.lineBetween(x + width, netY, x + width + goalWidth, netY)
      }
    }

    createPlayerTexture(key, kit, isGoalkeeper = false) {
      if (this.textures.exists(key)) return
      const texture = this.textures.createCanvas(key, 12, 18)
      const context = texture.context
      const shirt = isGoalkeeper ? kit.goalkeeper : kit.shirt

      context.imageSmoothingEnabled = false
      context.fillStyle = '#5B4630'
      context.fillRect(3, 0, 6, 2)
      context.fillStyle = '#C68642'
      context.fillRect(3, 2, 6, 5)
      context.fillStyle = '#111111'
      context.fillRect(4, 4, 1, 1)
      context.fillRect(7, 4, 1, 1)
      context.fillStyle = shirt
      context.fillRect(1, 7, 10, 6)
      context.fillStyle = kit.accent
      context.fillRect(4, 8, 4, 2)
      context.fillStyle = kit.shorts
      context.fillRect(2, 13, 4, 2)
      context.fillRect(6, 13, 4, 2)
      context.fillStyle = kit.socks
      context.fillRect(2, 15, 3, 2)
      context.fillRect(7, 15, 3, 2)
      context.fillStyle = '#111111'
      context.fillRect(1, 17, 4, 1)
      context.fillRect(7, 17, 4, 1)
      texture.refresh()
    }

    createPlayerTextures() {
      const { homeKit, awayKit } = this.controller
      this.createPlayerTexture('home-player', homeKit, false)
      this.createPlayerTexture('home-gk', homeKit, true)
      this.createPlayerTexture('away-player', awayKit, false)
      this.createPlayerTexture('away-gk', awayKit, true)
    }

    createPlayers() {
      const spriteScale = Math.max(1.8, this.scale.height / 235)
      const labelSize = Math.max(9, Math.round(this.scale.height / 48))

      const addTeam = (players, team) => {
        players.forEach((player) => {
          const name = team === 'my' ? player.name : `opp_${player.name}`
          const isGoalkeeper = getPosition(player) === 'GK'
          const texture = `${team === 'my' ? 'home' : 'away'}-${isGoalkeeper ? 'gk' : 'player'}`
          const shadow = this.add.ellipse(0, 0, 18 * spriteScale, 7 * spriteScale, 0x000000, 0.25).setDepth(3)
          const sprite = this.add.sprite(0, 0, texture)
            .setScale(spriteScale)
            .setOrigin(0.5, 0.82)
            .setDepth(5)
          const label = this.add.text(0, 0, String(player.number || (isGoalkeeper ? 1 : '?')), {
            fontFamily: 'Zpix, monospace',
            fontSize: `${labelSize}px`,
            color: team === 'my' ? '#F3E3B4' : '#FFFFFF',
            stroke: team === 'my' ? '#1B3764' : '#5B1E1E',
            strokeThickness: 3,
          }).setOrigin(0.5).setDepth(7)
          this.playerObjects.set(name, { player, sprite, shadow, label, team })
        })
      }

      addTeam(this.controller.myLineup, 'my')
      addTeam(this.controller.opponentLineup, 'opponent')
    }

    createBall() {
      this.ballShadow = this.add.ellipse(0, 0, 16, 7, 0x000000, 0.28).setDepth(8)
      this.ball = this.add.image(0, 0, 'match-ball')
        .setDisplaySize(Math.max(14, this.scale.height * 0.036), Math.max(14, this.scale.height * 0.036))
        .setDepth(20)
    }

    resetPositions() {
      const homePositions = FORMATION_POSITIONS[this.controller.formation] || FORMATION_POSITIONS['4-3-3']
      const awayPositions = FORMATION_POSITIONS[this.controller.opponentFormation] || FORMATION_POSITIONS['4-3-3']
      const homeCounts = { GK: 0, DF: 0, MF: 0, FW: 0 }
      const awayCounts = { GK: 0, DF: 0, MF: 0, FW: 0 }
      const nextPositions = {}

      this.controller.myLineup.forEach((player) => {
        const position = getPosition(player)
        const slot = homePositions[position]?.[homeCounts[position] || 0]
        homeCounts[position] = (homeCounts[position] || 0) + 1
        if (!slot) return
        nextPositions[player.name] = {
          x: slot[0],
          y: slot[1],
          anchorX: slot[0],
          anchorY: slot[1],
          position,
          team: 'my',
        }
        this.playerVelocities[player.name] = { vx: 0, vy: 0 }
        this.kickCooldowns[player.name] = 0
      })

      this.controller.opponentLineup.forEach((player) => {
        const position = getPosition(player)
        const slot = awayPositions[position]?.[awayCounts[position] || 0]
        awayCounts[position] = (awayCounts[position] || 0) + 1
        if (!slot) return
        const name = `opp_${player.name}`
        nextPositions[name] = {
          x: 100 - slot[0],
          y: 100 - slot[1],
          anchorX: 100 - slot[0],
          anchorY: 100 - slot[1],
          position,
          team: 'opponent',
        }
        this.playerVelocities[name] = { vx: 0, vy: 0 }
        this.kickCooldowns[name] = 0
      })

      this.playerPositions = nextPositions
      this.ballPosition = { x: 50, y: 50, lift: 0 }
      this.ballCarrier = null
      this.possessionTeam = 'my'

      // 开球：让一名前锋持球
      const myFWs = Object.entries(nextPositions).filter(([name, pos]) => pos.team === 'my' && pos.position === 'FW')
      if (myFWs.length > 0) {
        this.ballCarrier = myFWs[0][0]
      }

      this.syncObjects()
    }

    syncObjects() {
      this.playerObjects.forEach((objects, name) => {
        const position = this.playerPositions[name]
        if (!position) {
          objects.sprite.setVisible(false)
          objects.shadow.setVisible(false)
          objects.label.setVisible(false)
          return
        }
        const point = tacticalToPhaserPoint(position.x, position.y, this.pitch)
        const bob = this.controller.ambientEnabled && !this.animating
          ? Math.sin(this.ambientPhase * 5 + point.x * 0.025) * 1.2
          : 0
        objects.sprite.setPosition(point.x, point.y + bob)
        objects.shadow.setPosition(point.x + 2, point.y + 4)
        objects.label.setPosition(point.x, point.y - Math.max(19, this.scale.height * 0.047))
      })

      const ballPoint = tacticalToPhaserPoint(this.ballPosition.x, this.ballPosition.y, this.pitch)
      this.ball.setPosition(ballPoint.x, ballPoint.y - this.ballPosition.lift)
      this.ballShadow.setPosition(ballPoint.x + 2, ballPoint.y + 4)
      this.ballShadow.setScale(Math.max(0.45, 1 - this.ballPosition.lift / 80))
    }

    update(time, delta) {
      try {
        this.ambientPhase = time / 900
        const dt = Math.min((delta || 16.67) / 16.67, 3)
        this.tickAmbient(time, dt)
        this.syncObjects()
      } catch (e) {
        // 静默处理，防止崩溃
      }
    }

    tickAmbient(now, dt) {
      if (!this.controller.ambientEnabled) return
      if (this.animating) return

      try {
        // 更新踢球冷却
        Object.keys(this.kickCooldowns || {}).forEach(name => {
          if (this.kickCooldowns[name] > 0) this.kickCooldowns[name] -= dt
        })

        // AI 决策
        this.updateAI(dt)

        // 更新球员位置
        this.updatePlayerPositions(dt)

        // 更新球位置
        this.updateBall(dt)
      } catch (e) {
        // 静默处理
      }
    }

    updateAI(dt) {
      Object.entries(this.playerPositions).forEach(([name, position]) => {
        if (this.lockedPlayers.has(name)) return

        const isMy = position.team === 'my'
        const isGK = position.position === 'GK'
        const vel = this.playerVelocities[name] || { vx: 0, vy: 0 }
        const speed = isGK ? 0.6 : 1.2 + Math.random() * 0.3

        // 计算到球的距离
        const bx = this.ballPosition.x, by = this.ballPosition.y
        const dx = bx - position.x, dy = by - position.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        const isCarrier = name === this.ballCarrier
        const carrierPos = this.ballCarrier ? this.playerPositions[this.ballCarrier] : null
        const isTeammateOfCarrier = carrierPos && ((isMy && carrierPos.team === 'my') || (!isMy && carrierPos.team === 'opponent'))

        if (isCarrier) {
          // 持球 AI：带球推进
          this.handleBallCarrier(name, position, vel, speed, dt)
        } else if (isTeammateOfCarrier) {
          // 队友跑位
          this.handleTeammateMovement(name, position, vel, speed, dt)
        } else {
          // 防守/抢球
          this.handleDefensiveMovement(name, position, vel, speed, dist, dx, dy, dt)
        }

        this.playerVelocities[name] = vel
      })
    }

    handleBallCarrier(name, pos, vel, speed, dt) {
      const isMy = pos.team === 'my'
      const goalX = isMy ? 96 : 4
      const goalY = 50

      const toGoalX = goalX - pos.x
      const toGoalY = goalY - pos.y
      const toGoalDist = Math.sqrt(toGoalX * toGoalX + toGoalY * toGoalY)

      // 检查前方是否有对方球员
      let blocked = false
      Object.entries(this.playerPositions).forEach(([otherName, other]) => {
        if (otherName === name || other.team === pos.team || other.position === 'GK') return
        const ox = other.x - pos.x, oy = other.y - pos.y
        const od = Math.sqrt(ox * ox + oy * oy)
        if (od < 12 && Math.sign(ox) === Math.sign(toGoalX)) blocked = true
      })

      // 射门（距离球门近时）
      if (toGoalDist < 15 && this.kickCooldowns[name] <= 0) {
        this.shoot(name, pos, goalX, goalY)
        return
      }

      // 传球（被阻挡或随机）
      if (this.kickCooldowns[name] <= 0) {
        if (blocked && Math.random() < 0.04 * dt) {
          this.pass(name, pos)
          return
        }
        if (!blocked && Math.random() < 0.02 * dt) {
          this.pass(name, pos)
          return
        }
      }

      // 带球推进
      const ang = Math.atan2(toGoalY, toGoalX) + (Math.random() - 0.5) * 0.3
      vel.vx += Math.cos(ang) * speed * 0.12 * dt
      vel.vy += Math.sin(ang) * speed * 0.12 * dt
    }

    handleTeammateMovement(name, pos, vel, speed, dt) {
      const isMy = pos.team === 'my'
      const carrierPos = this.ballCarrier ? this.playerPositions[this.ballCarrier] : null

      let targetX = pos.anchorX
      let targetY = pos.anchorY

      // 前锋和中场前插
      if (['FW', 'MF'].includes(pos.position) && carrierPos) {
        const pushX = isMy ? 12 : -12
        targetX = pos.anchorX + pushX
        targetY = pos.anchorY + (Math.random() - 0.5) * 20
      }

      const dx = targetX - pos.x
      const dy = targetY - pos.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > 3) {
        vel.vx += (dx / d) * speed * 0.06 * dt
        vel.vy += (dy / d) * speed * 0.06 * dt
      }
    }

    handleDefensiveMovement(name, pos, vel, speed, dist, dx, dy, dt) {
      const isGK = pos.position === 'GK'
      const isMy = pos.team === 'my'

      if (isGK) {
        // 门将 AI：沿球门线跟踪球的 y 坐标
        const gkBaseX = isMy ? 6 : 94
        const targetY = clamp(this.ballPosition.y, 35, 65)
        vel.vx += (gkBaseX - pos.x) * 0.04 * dt
        vel.vy += (targetY - pos.y) * 0.05 * dt
      } else if (dist < 25) {
        // 追球
        vel.vx += (dx / dist) * speed * 0.1 * dt
        vel.vy += (dy / dist) * speed * 0.1 * dt
      } else {
        // 回位
        const rx = pos.anchorX - pos.x, ry = pos.anchorY - pos.y
        const rd = Math.sqrt(rx * rx + ry * ry)
        if (rd > 3) {
          vel.vx += (rx / rd) * speed * 0.05 * dt
          vel.vy += (ry / rd) * speed * 0.05 * dt
        }
      }

      // 抢断（距离近且对方持球）
      const carrierPos = this.ballCarrier ? this.playerPositions[this.ballCarrier] : null
      if (dist < 8 && carrierPos && carrierPos.team !== pos.team && this.kickCooldowns[name] <= 0) {
        if (Math.random() < 0.15) {
          this.tackle(name, pos)
        }
      }
    }

    shoot(name, pos, goalX, goalY) {
      const spread = (Math.random() - 0.5) * 15
      const ang = Math.atan2(goalY + spread - pos.y, goalX - pos.x)
      const power = 2.5 + Math.random() * 1.5

      this.ballPosition.lift = 5 + Math.random() * 10
      this.ballCarrier = null
      this.kickCooldowns[name] = 30

      // 球飞向球门（通过 updateBall 实现）
      this._ballTarget = { x: goalX, y: goalY + spread, power }
    }

    pass(name, pos) {
      const isMy = pos.team === 'my'
      // 找队友
      const teammates = Object.entries(this.playerPositions).filter(([n, p]) =>
        n !== name && p.team === pos.team && p.position !== 'GK'
      )
      if (teammates.length === 0) return

      // 选择最佳接球者（更靠前的）
      let bestTarget = null
      let bestScore = -Infinity
      teammates.forEach(([n, p]) => {
        const forwardBonus = isMy ? (p.x - pos.x) : (pos.x - p.x)
        const dist = Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2)
        const score = forwardBonus * 0.5 - dist * 0.1 + Math.random() * 10
        if (score > bestScore) {
          bestScore = score
          bestTarget = { name: n, pos: p }
        }
      })

      if (!bestTarget) return

      this.ballCarrier = null
      this.kickCooldowns[name] = 20

      // 球飞向队友
      this._ballTarget = { x: bestTarget.pos.x, y: bestTarget.pos.y, power: 1.5, newCarrier: bestTarget.name }
    }

    tackle(name, pos) {
      const prevCarrier = this.ballCarrier
      if (prevCarrier) {
        this.kickCooldowns[prevCarrier] = 30
      }
      this.ballCarrier = name
      this.kickCooldowns[name] = 15
      this.possessionTeam = pos.team
    }

    updatePlayerPositions(dt) {
      const friction = 0.92
      const maxSpeed = 2.5

      Object.entries(this.playerPositions).forEach(([name, position]) => {
        if (this.lockedPlayers.has(name)) return

        const vel = this.playerVelocities[name] || { vx: 0, vy: 0 }

        // 摩擦力
        vel.vx *= friction
        vel.vy *= friction

        // 速度限制
        const spd = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy)
        if (spd > maxSpeed) {
          vel.vx = (vel.vx / spd) * maxSpeed
          vel.vy = (vel.vy / spd) * maxSpeed
        }

        // 应用速度
        position.x += vel.vx * dt * 0.15
        position.y += vel.vy * dt * 0.15

        // 边界限制
        position.x = clamp(position.x, 2, 98)
        position.y = clamp(position.y, 5, 95)

        // 碰撞排斥
        Object.entries(this.playerPositions).forEach(([otherName, other]) => {
          if (otherName === name) return
          const cx = other.x - position.x, cy = other.y - position.y
          const cd = Math.sqrt(cx * cx + cy * cy)
          if (cd < 5 && cd > 0) {
            const push = (5 - cd) * 0.3
            position.x -= (cx / cd) * push
            position.y -= (cy / cd) * push
          }
        })
      })
    }

    updateBall(dt) {
      const friction = 0.985
      const speed = 0.12 * dt

      if (this.ballCarrier) {
        // 球跟随持球球员（吸附效果）
        const carrier = this.playerPositions[this.ballCarrier]
        if (carrier) {
          const targetX = carrier.x + (carrier.team === 'my' ? 2 : -2)
          const targetY = carrier.y + 1.5
          this.ballPosition.x += (targetX - this.ballPosition.x) * speed
          this.ballPosition.y += (targetY - this.ballPosition.y) * speed
          this.ballPosition.lift *= 0.85
        }
      } else if (this._ballTarget) {
        // 球飞向目标
        const target = this._ballTarget
        const dx = target.x - this.ballPosition.x
        const dy = target.y - this.ballPosition.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < 3) {
          // 到达目标
          if (target.newCarrier) {
            this.ballCarrier = target.newCarrier
            this.possessionTeam = this.playerPositions[target.newCarrier]?.team || 'my'
          }
          this._ballTarget = null
          this.ballPosition.lift *= 0.8
        } else {
          const power = target.power || 1.5
          this.ballPosition.x += (dx / dist) * power * dt * 0.2
          this.ballPosition.y += (dy / dist) * power * dt * 0.2
          this.ballPosition.lift *= 0.95
        }
      } else {
        // 无球状态：缓慢停止
        this.ballPosition.lift *= 0.9
      }
    }

    movePlayer(name, target, duration = 400, easing = 'Sine.easeInOut') {
      const position = this.playerPositions[name]
      if (!position) return Promise.resolve()
      this.lockedPlayers.add(name)
      return new Promise((resolve) => {
        this.tweens.add({
          targets: position,
          x: clamp(target.x),
          y: clamp(target.y),
          duration: Math.max(80, duration),
          ease: easing === 'linear' ? 'Linear' : easing === 'easeIn' ? 'Quad.easeIn' : easing === 'easeOut' ? 'Quad.easeOut' : 'Sine.easeInOut',
          onComplete: () => {
            this.time.delayedCall(120, () => this.lockedPlayers.delete(name))
            resolve()
          },
        })
      })
    }

    moveBall(target, duration = 320, type = 'pass') {
      const startLift = this.ballPosition.lift || 0
      const arc = ['pass', 'cross', 'freekick_curve', 'header_shot', 'penalty_shot'].includes(type)
        ? (type === 'cross' || type === 'header_shot' ? 30 : 16)
        : 0
      return new Promise((resolve) => {
        const progress = { value: 0 }
        this.tweens.add({
          targets: progress,
          value: 1,
          duration: Math.max(80, duration),
          ease: type === 'shot' ? 'Quad.easeIn' : 'Sine.easeInOut',
          onUpdate: () => {
            const value = progress.value
            this.ballPosition.x += (Number(target.x) - this.ballPosition.x) * Math.min(1, value * 0.28 + 0.08)
            this.ballPosition.y += (Number(target.y) - this.ballPosition.y) * Math.min(1, value * 0.28 + 0.08)
            this.ballPosition.lift = startLift * (1 - value) + Math.sin(value * Math.PI) * arc
          },
          onComplete: () => {
            this.ballPosition = { x: Number(target.x), y: Number(target.y), lift: 0 }
            resolve()
          },
        })
      })
    }

    getMyActor(actors, index = 0) {
      return actors?.my?.[index] || actors?.[index] || null
    }

    getOpponentActor(actors, index = 0) {
      return actors?.opponent?.[index] || actors?.[index] || null
    }

    getFrameTargetName(frame, actors) {
      if (frame.actor !== undefined) return this.getMyActor(actors, frame.actor)?.name || null
      if (frame.opponent !== undefined) {
        const opponent = this.getOpponentActor(actors, frame.opponent)
        return opponent ? `opp_${opponent.name}` : null
      }
      return null
    }

    resolveTarget(moveTo, actorName, actors) {
      const actor0 = this.getMyActor(actors, 0)
      const actor1 = this.getMyActor(actors, 1)
      if (typeof moveTo === 'object' && moveTo !== null) {
        let { x, y } = moveTo
        if (x === 'actor_x' && actorName) x = this.playerPositions[actorName]?.x ?? 50
        if (y === 'actor_y' && actorName) y = this.playerPositions[actorName]?.y ?? 50
        if (typeof x === 'string' && x.startsWith('actor_x+')) x = (this.playerPositions[actorName]?.x ?? 50) + Number.parseFloat(x.split('+')[1])
        if (x === 'actor0_x' && actor0) x = this.playerPositions[actor0.name]?.x ?? 50
        if (x === 'actor1_x' && actor1) x = this.playerPositions[actor1.name]?.x ?? 50
        if (x === 'target_x') x = this.playerPositions[actor1?.name]?.x ?? 50
        if (x === 'fk_x') x = this.lastFreekickX
        if (y === 'fk_y') y = this.lastFreekickY
        if (y === 'actor1_y' && actor1) y = this.playerPositions[actor1.name]?.y ?? 50
        if (y === 'target_y') y = this.playerPositions[actor1?.name]?.y ?? 50
        if (typeof y === 'string' && y.startsWith('fk_y+')) y = this.lastFreekickY + Number.parseFloat(y.split('+')[1])
        return { x: Number(x), y: Number(y) }
      }
      if (moveTo === 'penalty_area_edge') return { x: this.playerPositions[actorName]?.x ?? 50, y: 80 }
      if (moveTo === 'gk_rush') return { x: 50, y: 85 }
      if (moveTo === 'penalty_area_center') return { x: this.playerPositions[actorName]?.x ?? 50, y: 88 }
      return { x: 50, y: 50 }
    }

    sleep(milliseconds) {
      return new Promise((resolve) => this.time.delayedCall(milliseconds, resolve))
    }

    async playTeamShift(frame) {
      const direction = frame.type === 'TEAM_PUSH_UP' ? 1 : -1
      await Promise.all(Object.entries(this.playerPositions)
        .filter(([, position]) => position.team === 'my')
        .map(([name, position]) => this.movePlayer(name, {
          x: position.x,
          y: clamp(position.y + frame.delta_y * direction),
        }, frame.duration)))
    }

    async showGoalEffect(isOpponent) {
      if (isOpponent) this.controller.onOpponentGoalEffect?.()
      else this.controller.onGoalEffect?.()
      await this.showCenteredEffect('goal', isOpponent ? '失球！' : '进球！', isOpponent ? '#B34235' : '#C99A2E', 2200)
    }

    showSaveEffect(eventAsset = false) {
      this.controller.onSaveEffect?.()
      return this.showCenteredEffect(eventAsset ? 'save' : null, '扑出！', '#F3E3B4', 1600)
    }

    showCenteredEffect(assetKey, text, color, duration) {
      const objects = []
      const centerX = this.scale.width / 2
      const centerY = this.scale.height / 2
      const imgSize = this.scale.height * 0.28
      const fontSize = Math.floor(this.scale.height * 0.12)

      // 计算整体宽度，图片在左文字在右
      const hasImage = assetKey && this.textures.exists(`event-${assetKey}`)
      const gap = 12
      const textWidth = text.length * fontSize * 0.6
      const totalWidth = (hasImage ? imgSize + gap : 0) + textWidth
      const startX = centerX - totalWidth / 2

      if (hasImage) {
        const image = this.add.image(startX + imgSize / 2, centerY, `event-${assetKey}`)
          .setDisplaySize(imgSize, imgSize)
          .setDepth(70)
        objects.push(image)
      }

      const labelX = hasImage ? startX + imgSize + gap + textWidth / 2 : centerX
      const label = this.add.text(labelX, centerY, text, {
        fontFamily: 'Zpix, monospace',
        fontSize: `${fontSize}px`,
        color,
        stroke: '#1B3764',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(72)
      objects.push(label)

      objects.forEach(object => object.setAlpha(0))
      this.tweens.add({
        targets: objects,
        alpha: 1,
        duration: 200,
        yoyo: true,
        hold: Math.max(200, duration - 400),
        onComplete: () => objects.forEach(object => object.destroy()),
      })
      return this.sleep(duration)
    }

    async showCard(color) {
      const key = color === 'yellow' ? 'yellowCard' : 'redCard'
      const text = color === 'yellow' ? '黄牌！' : '红牌！'
      const textColor = color === 'yellow' ? '#FFD700' : '#FF4444'
      const objects = []
      const centerX = this.scale.width / 2
      const centerY = this.scale.height / 2
      const imgSize = this.scale.height * 0.22
      const fontSize = Math.floor(this.scale.height * 0.1)

      const hasImage = this.textures.exists(`event-${key}`)
      const gap = 12
      const textWidth = text.length * fontSize * 0.6
      const totalWidth = (hasImage ? imgSize + gap : 0) + textWidth
      const startX = centerX - totalWidth / 2

      if (hasImage) {
        const image = this.add.image(startX + imgSize / 2, centerY, `event-${key}`)
          .setDisplaySize(imgSize, imgSize * 1.3)
          .setDepth(70)
        objects.push(image)
      }

      const labelX = hasImage ? startX + imgSize + gap + textWidth / 2 : centerX
      const label = this.add.text(labelX, centerY, text, {
        fontFamily: 'Zpix, monospace',
        fontSize: `${fontSize}px`,
        color: textColor,
        stroke: '#1B3764',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(72)
      objects.push(label)

      objects.forEach(object => object.setAlpha(0))
      this.tweens.add({
        targets: objects,
        alpha: 1,
        duration: 200,
        yoyo: true,
        hold: 1400,
        onComplete: () => objects.forEach(object => object.destroy()),
      })
      await this.sleep(1800)
    }

    async showFoul(x = 50, y = 50) {
      const point = tacticalToPhaserPoint(x, y, this.pitch)
      const text = this.add.text(point.x, point.y, '犯规！', {
        fontFamily: 'Zpix, monospace',
        fontSize: `${Math.floor(this.scale.height * 0.09)}px`,
        color: '#B34235',
        stroke: '#1B3764',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(65)
      this.tweens.add({ targets: text, y: point.y - 28, alpha: 0, duration: 650, onComplete: () => text.destroy() })
      await this.sleep(680)
    }

    async showSpecialFrame(frame) {
      if (frame.type === 'WALL_FORM') {
        const target = this.resolveTarget({ x: frame.x, y: frame.y }, null, [])
        const point = tacticalToPhaserPoint(target.x, target.y, this.pitch)
        const wall = this.add.container(point.x, point.y).setDepth(30)
        for (let index = -2; index <= 2; index += 1) {
          wall.add(this.add.rectangle(index * 12, 0, 9, 22, 0xb34235).setStrokeStyle(2, 0x1b3764))
        }
        this.time.delayedCall(1400, () => wall.destroy())
        await this.sleep(160)
        return true
      }
      if (frame.type === 'PENALTY_MARK') {
        const point = tacticalToPhaserPoint(frame.x ?? 50, frame.y ?? 89, this.pitch)
        const mark = this.add.rectangle(point.x, point.y, 12, 12, 0xc99a2e).setStrokeStyle(2, 0x1b3764).setDepth(30)
        this.time.delayedCall(1300, () => mark.destroy())
        await this.sleep(120)
        return true
      }
      return false
    }

    animatePlayerAction(name, type, duration = 260) {
      const objects = this.playerObjects.get(name)
      if (!objects) return Promise.resolve()
      const { sprite } = objects
      const originalAngle = sprite.angle
      const originalScaleX = sprite.scaleX
      const originalScaleY = sprite.scaleY
      return new Promise((resolve) => {
        this.tweens.add({
          targets: sprite,
          angle: ['slide_tackle', 'save_dive', 'dive_left', 'dive_right'].includes(type)
            ? (type.includes('left') ? -70 : 70)
            : originalAngle,
          scaleX: type === 'header_shot' ? originalScaleX * 1.18 : originalScaleX,
          scaleY: type === 'header_shot' ? originalScaleY * 1.18 : originalScaleY,
          y: type === 'header_shot' ? sprite.y - 12 : sprite.y,
          duration: Math.max(100, duration / 2),
          yoyo: true,
          onComplete: () => {
            sprite.setAngle(originalAngle).setScale(originalScaleX, originalScaleY)
            resolve()
          },
        })
      })
    }

    async runFrame(frame, actors) {
      if (frame.type === 'GOAL_EFFECT') return this.showGoalEffect(false)
      if (frame.type === 'OPPONENT_GOAL_EFFECT') return this.showGoalEffect(true)
      if (frame.type === 'CARD_EFFECT') return this.showCard(frame.color)
      if (frame.type === 'FOUL_EFFECT') return this.showFoul(frame.x, frame.y)
      if (frame.type === 'TEAM_PUSH_UP' || frame.type === 'TEAM_PUSH_DOWN') return this.playTeamShift(frame)
      if (await this.showSpecialFrame(frame)) return

      const targetName = this.getFrameTargetName(frame, actors)
      const actorName = frame.actor !== undefined ? targetName : null
      const actions = []
      if (targetName && frame.moveTo) {
        actions.push(this.movePlayer(targetName, this.resolveTarget(frame.moveTo, actorName, actors), frame.duration, frame.easing))
      } else if (targetName && frame.type) {
        actions.push(this.animatePlayerAction(targetName, frame.type, frame.duration))
      }
      if (frame.ball && frame.moveTo) {
        actions.push(this.moveBall(this.resolveTarget(frame.moveTo, null, actors), frame.duration, frame.type))
      }
      await Promise.all(actions)
    }

    async runTimeline(frames, actors, { stopOnChoice = false } = {}) {
      this.animating = true
      const pauseFrame = stopOnChoice ? frames.find(frame => frame.type === 'PAUSE_FOR_CHOICE') : null
      const pauseAt = pauseFrame?.t ?? null
      const playableFrames = pauseAt === null
        ? frames
        : frames.filter(frame => frame.type !== 'PAUSE_FOR_CHOICE' && (frame.t || 0) < pauseAt)
      const tasks = playableFrames.map(async (frame) => {
        if (frame.t > 0) await this.sleep(frame.t)
        await this.runFrame(frame, actors)
      })
      if (pauseAt !== null) tasks.push(this.sleep(pauseAt))
      await Promise.all(tasks)
      this.animating = false
    }

    async bridgeToDecisionActor(actors) {
      const primaryName = actors?.canvas?.myPrimary || this.getMyActor(actors, 0)?.name
      const secondName = actors?.canvas?.mySecond || this.getMyActor(actors, 1)?.name
      const opponentName = actors?.canvas?.opponentPrimary
      const primary = this.playerPositions[primaryName]
      if (!primary) return
      this.animating = true
      this.ballZone = primary.position === 'GK' ? 'defend' : primary.y > 62 ? 'box' : 'midfield'
      this.ballCarrier = primaryName
      const actions = [this.moveBall({ x: primary.x, y: primary.y + (primary.team === 'my' ? 1.8 : -1.8) }, 520)]
      const second = this.playerPositions[secondName]
      if (second && secondName !== primaryName) {
        actions.push(this.movePlayer(secondName, { x: clamp(primary.x + (second.x <= primary.x ? -8 : 8)), y: clamp(primary.y - 8) }, 520))
      }
      const opponent = this.playerPositions[opponentName]
      if (opponent) {
        actions.push(this.movePlayer(opponentName, { x: clamp(primary.x + (opponent.x <= primary.x ? -7 : 7)), y: clamp(primary.y + 7) }, 520))
      }
      await Promise.all(actions)
    }

    async playEvent(eventType, actors) {
      const template = ANIMATION_TEMPLATES[eventType]
      if (!template) return
      await this.bridgeToDecisionActor(actors)
      await this.runTimeline(template.keyframes, actors, { stopOnChoice: true })
    }

    async playResult(eventType, resultKey, actors, options = {}) {
      const template = ANIMATION_TEMPLATES[eventType]
      const normalizedKey = getResultAnimationKey(eventType, resultKey)
      const frames = normalizedKey ? template?.result_animations?.[normalizedKey] : null
      if (!frames) return
      if (normalizedKey.includes('save') || normalizedKey.includes('saved') || normalizedKey.includes('claim')) {
        this.time.delayedCall(280, () => this.showSaveEffect(options.eventAsset !== false))
      }
      if (normalizedKey.includes('corner') || normalizedKey.includes('deflected')) {
        this.time.delayedCall(260, () => this.showCorner())
      }
      await this.runTimeline(frames, actors)
    }

    async showCorner() {
      if (!this.textures.exists('event-corner')) return
      const image = this.add.image(this.pitch.x + this.pitch.width - 28, this.pitch.y + 28, 'event-corner')
        .setDisplaySize(this.scale.height * 0.15, this.scale.height * 0.15)
        .setDepth(60)
      this.tweens.add({ targets: image, alpha: 0, duration: 320, delay: 760, onComplete: () => image.destroy() })
    }

    async playAmbientEvent(event) {
      if (!event) return
      const actorName = event.actorName
      const supportName = event.supportName
      const opponentName = event.opponentName
      this.ballZone = event.ballZone || 'midfield'
      this.ballCarrier = actorName || this.ballCarrier
      this.possessionTeam = event.teamSide || 'my'
      const actor = this.playerPositions[actorName]
      const support = this.playerPositions[supportName]
      const opponent = this.playerPositions[opponentName]
      const direction = event.teamSide === 'opponent' ? -1 : 1
      const actions = []

      if (actor) {
        actions.push(this.moveBall({ x: actor.x, y: actor.y + (actor.team === 'my' ? 1.8 : -1.8) }, 320))
        actions.push(this.movePlayer(actorName, { x: clamp(actor.x + (event.visualKind === 'cross' ? 8 : 2)), y: clamp(actor.y + direction * 5) }, 360, 'easeOut'))
      }
      if (support) {
        actions.push(this.movePlayer(supportName, { x: clamp(support.x + (event.visualKind === 'cross' ? 10 : 4)), y: clamp(support.y + direction * 6) }, 420))
      }
      if (opponent && actor) {
        actions.push(this.movePlayer(opponentName, { x: clamp(opponent.x + (actor.x - opponent.x) * 0.35), y: clamp(opponent.y + (actor.y - opponent.y) * 0.35) }, 380))
      }

      const zoneTarget = BALL_ZONES[event.ballZone] || BALL_ZONES.midfield
      if (['pass', 'through', 'cross', 'corner', 'throw_in'].includes(event.visualKind) && support) {
        actions.push(this.moveBall({ x: support.x, y: support.y }, 360, event.visualKind))
        this.ballCarrier = supportName
      } else if (event.visualKind === 'yellow_card' || event.visualKind === 'red_card') {
        this.showCard(event.visualKind === 'red_card' ? 'red' : 'yellow')
      } else if (event.visualKind === 'corner') {
        this.showCorner()
      } else if (['foul', 'injury'].includes(event.visualKind)) {
        this.showFoul(actor?.x || zoneTarget.x, actor?.y || zoneTarget.y)
      } else if (['goal_kick', 'gk_save'].includes(event.visualKind)) {
        actions.push(this.moveBall({ x: 50, y: event.teamSide === 'opponent' ? 72 : 28 }, 420, 'clearance'))
      } else {
        actions.push(this.moveBall(zoneTarget, 380))
      }
      await Promise.all(actions)
    }

    getState() {
      return {
        playerPositions: this.playerPositions,
        ballPosition: this.ballPosition,
        animating: this.animating,
        ballZone: this.ballZone,
        ballOwnerName: this.ballCarrier,
      }
    }
  }
}
