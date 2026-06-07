import { FORMATION_POSITIONS } from '../utils/formationPositions.js'
import { ANIMATION_TEMPLATES } from '../utils/animationTemplates.js'
import { getResultAnimationKey } from '../utils/animationResultMapper.js'
import { BALL_ZONES } from '../utils/matchVisuals.js'
import { MATCH_EVENT_ASSETS } from '../utils/matchEventVisuals.js'
import { createPitchBounds, tacticalToPhaserPoint } from '../utils/phaserPitch.js'
import { getBallAttachmentPoint, getDecisionBridge } from '../utils/liveMatchSimulation.js'

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
      this.ballOwnerName = null
      this.possessionTeam = 'my'
      this.animating = false
      this.ambientPhase = 0
      this.lastAmbientSwitch = 0
      this.lastAmbientAction = 0
      this.ballTransit = null
      this.simulationSpeed = 1
      this.lastFreekickX = 50
      this.lastFreekickY = 75
    }

    preload() {
      Object.entries(MATCH_EVENT_ASSETS).forEach(([key, src]) => {
        this.load.image(`event-${key}`, src)
      })
    }

    create() {
      this.pitch = createPitchBounds(this.scale.width, this.scale.height)
      this.drawPitch()
      this.createPlayerTextures()
      this.createBallTexture()
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
      const ctx = texture.context
      const shirt = isGoalkeeper ? kit.goalkeeper : kit.shirt

      ctx.imageSmoothingEnabled = false
      // Hair
      ctx.fillStyle = '#3D2B1F'
      ctx.fillRect(3, 0, 6, 2)
      // Face (skin) — no eyes drawn here, Phaser objects handle eyes
      ctx.fillStyle = '#D4A574'
      ctx.fillRect(3, 2, 6, 4)
      // Shirt
      ctx.fillStyle = shirt
      ctx.fillRect(1, 7, 10, 5)
      // Accent stripe
      ctx.fillStyle = kit.accent
      ctx.fillRect(4, 8, 4, 2)
      // Arms (skin)
      ctx.fillStyle = '#D4A574'
      ctx.fillRect(0, 7, 1, 4)
      ctx.fillRect(11, 7, 1, 4)
      // Shorts
      ctx.fillStyle = kit.shorts
      ctx.fillRect(2, 12, 4, 2)
      ctx.fillRect(6, 12, 4, 2)
      // Socks
      ctx.fillStyle = kit.socks
      ctx.fillRect(2, 14, 3, 2)
      ctx.fillRect(7, 14, 3, 2)
      // Boots
      ctx.fillStyle = '#111111'
      ctx.fillRect(1, 16, 4, 2)
      ctx.fillRect(7, 16, 4, 2)
      texture.refresh()
    }

    createBallTexture() {
      if (this.textures.exists('match-ball')) return
      const size = 12
      const texture = this.textures.createCanvas('match-ball', size, size)
      const ctx = texture.context
      ctx.imageSmoothingEnabled = false
      const c = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h) }
      const W = '#FFFFFF', G = '#C0C0C0', D = '#1B3764', B = '#888888'
      // Outline circle
      c(3,0,1,1,B); c(4,0,1,1,B); c(7,0,1,1,B); c(8,0,1,1,B)
      c(1,1,1,1,B); c(10,1,1,1,B)
      c(0,2,1,1,B); c(11,2,1,1,B)
      c(0,3,1,1,B); c(11,3,1,1,B)
      c(0,4,1,1,B); c(11,4,1,1,B)
      c(0,5,1,1,B); c(11,5,1,1,B)
      c(0,6,1,1,B); c(11,6,1,1,B)
      c(0,7,1,1,B); c(11,7,1,1,B)
      c(0,8,1,1,B); c(11,8,1,1,B)
      c(1,9,1,1,B); c(10,9,1,1,B)
      c(3,10,1,1,B); c(4,10,1,1,B); c(7,10,1,1,B); c(8,10,1,1,B)
      // White hexagon panels
      c(2,1,8,1,W); c(1,2,1,1,W); c(10,2,1,1,W)
      c(1,3,1,1,W); c(10,3,1,1,W)
      c(1,4,1,1,W); c(10,4,1,1,W)
      c(1,5,1,1,W); c(10,5,1,1,W)
      c(1,6,1,1,W); c(10,6,1,1,W)
      c(1,7,1,1,W); c(10,7,1,1,W)
      c(1,8,1,1,W); c(10,8,1,1,W)
      c(2,9,8,1,W)
      // Fill center white
      c(2,2,8,7,W)
      // Dark pentagon in center
      c(5,3,2,1,D); c(4,4,4,1,D); c(4,5,4,1,D); c(5,6,2,1,D)
      // Panel seam lines (light gray)
      c(3,1,1,1,G); c(8,1,1,1,G)
      c(2,2,1,1,G); c(9,2,1,1,G)
      c(2,7,1,1,G); c(9,7,1,1,G)
      c(3,9,1,1,G); c(8,9,1,1,G)
      // Highlight
      c(3,2,1,1,W); c(4,2,1,1,W)
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
            fontSize: `${Math.max(8, labelSize - 1)}px`,
            color: '#FFFFFF',
            stroke: '#1B3764',
            strokeThickness: 2,
          }).setOrigin(0.5).setDepth(7)
          const leftEye = this.add.rectangle(0, 0, 2, 4, 0x111111).setDepth(8)
          const rightEye = this.add.rectangle(0, 0, 2, 4, 0x111111).setDepth(8)
          this.playerObjects.set(name, {
            player,
            sprite,
            shadow,
            label,
            leftEye,
            rightEye,
            team,
            facing: team === 'my' ? 1 : -1,
          })
        })
      }

      addTeam(this.controller.myLineup, 'my')
      addTeam(this.controller.opponentLineup, 'opponent')
    }

    createBall() {
      this.ballShadow = this.add.ellipse(0, 0, 16, 7, 0x000000, 0.28).setDepth(8)
      this.ball = this.add.image(0, 0, 'match-ball')
        .setDisplaySize(Math.max(9, this.scale.height * 0.023), Math.max(9, this.scale.height * 0.023))
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
          targetX: slot[0],
          targetY: slot[1],
          vx: 0,
          vy: 0,
          position,
          team: 'my',
        }
      })

      this.controller.opponentLineup.forEach((player) => {
        const position = getPosition(player)
        const slot = awayPositions[position]?.[awayCounts[position] || 0]
        awayCounts[position] = (awayCounts[position] || 0) + 1
        if (!slot) return
        nextPositions[`opp_${player.name}`] = {
          x: 100 - slot[0],
          y: 100 - slot[1],
          anchorX: 100 - slot[0],
          anchorY: 100 - slot[1],
          targetX: 100 - slot[0],
          targetY: 100 - slot[1],
          vx: 0,
          vy: 0,
          position,
          team: 'opponent',
        }
      })

      this.playerPositions = nextPositions
      this.ballPosition = { x: 50, y: 50, lift: 0 }
      this.ballOwnerName = Object.keys(nextPositions).find(name => (
        nextPositions[name].team === 'my' && nextPositions[name].position === 'MF'
      )) || Object.keys(nextPositions).find(name => nextPositions[name].team === 'my') || null
      this.possessionTeam = 'my'
      this.ballTransit = null
      this.ballZone = 'midfield'
      this.syncObjects()
    }

    syncObjects() {
      this.playerObjects.forEach((objects, name) => {
        const position = this.playerPositions[name]
        if (!position) {
          objects.sprite.setVisible(false)
          objects.shadow.setVisible(false)
          objects.label.setVisible(false)
          objects.leftEye.setVisible(false)
          objects.rightEye.setVisible(false)
          return
        }
        const point = tacticalToPhaserPoint(position.x, position.y, this.pitch)
        const bob = this.controller.ambientEnabled && !this.animating
          ? Math.sin(this.ambientPhase * 5 + point.x * 0.025) * 1.2
          : 0
        objects.sprite.setPosition(point.x, point.y + bob)
        objects.shadow.setPosition(point.x + 2, point.y + 4)
        const displayHeight = objects.sprite.displayHeight
        objects.label.setPosition(point.x, point.y + bob - Math.max(8, displayHeight * 0.26))
        const ballPoint = tacticalToPhaserPoint(this.ballPosition.x, this.ballPosition.y, this.pitch)
        const eyeDirection = Math.sign(ballPoint.x - point.x) || objects.facing
        objects.facing = eyeDirection
        const eyeY = point.y + bob - Math.max(14, displayHeight * 0.62)
        const eyeShift = eyeDirection * Math.max(0.5, this.scale.height / 600)
        objects.leftEye.setPosition(point.x - 2 + eyeShift, eyeY)
        objects.rightEye.setPosition(point.x + 2 + eyeShift, eyeY)
      })

      const ballPoint = tacticalToPhaserPoint(this.ballPosition.x, this.ballPosition.y, this.pitch)
      this.ball.setPosition(ballPoint.x, ballPoint.y - this.ballPosition.lift)
      this.ballShadow.setPosition(ballPoint.x + 2, ballPoint.y + 4)
      this.ballShadow.setScale(Math.max(0.45, 1 - this.ballPosition.lift / 80))
    }

    update(time, delta) {
      this.ambientPhase = time / 900
      this.tickAmbient(time, delta)
      this.syncObjects()
    }

    tickAmbient(now, delta = 16) {
      if (!this.controller.ambientEnabled || this.animating) return
      const speed = this.controller.simulationSpeed || this.simulationSpeed || 1
      const frameSeconds = Math.min(0.05, delta / 1000) * speed
      const owner = this.ballOwnerName ? this.playerPositions[this.ballOwnerName] : null

      if (owner && now - this.lastAmbientAction > 1050 / speed) {
        this.chooseAmbientAction(now)
      }

      const ballY = owner?.y ?? this.ballPosition.y
      Object.entries(this.playerPositions).forEach(([name, position], index) => {
        if (this.lockedPlayers.has(name)) return
        const direction = position.team === 'my' ? 1 : -1
        const isOwner = name === this.ballOwnerName
        const isDefending = position.team !== this.possessionTeam
        const lateralWave = Math.sin(this.ambientPhase * 1.8 + index * 0.85)
          * (position.position === 'GK' ? 1.2 : 3.5)
        const teamPush = clamp((ballY - 50) * 0.25, -12, 12)
        let targetX = clamp(position.anchorX + lateralWave, 5, 95)
        let targetY = clamp(position.anchorY + teamPush, 5, 95)

        if (isOwner) {
          targetX = clamp(position.x + Math.sin(this.ambientPhase * 3.4) * 2.5, 7, 93)
          targetY = clamp(position.y + direction * 7, 6, 94)
        } else if (position.position === 'GK') {
          // GK stays near own goal — limited lateral movement, minimal forward push
          const gkAnchorX = position.anchorX
          const gkMinY = position.team === 'my' ? 4 : 85
          const gkMaxY = position.team === 'my' ? 18 : 96
          targetX = clamp(gkAnchorX + lateralWave * 0.6, 38, 62)
          targetY = clamp(position.anchorY + teamPush * 0.15, gkMinY, gkMaxY)
        } else if (isDefending && owner) {
          const distance = Math.hypot(position.x - owner.x, position.y - owner.y)
          if (distance < 25) {
            targetX = clamp(owner.x + (position.anchorX < owner.x ? -4 : 4), 5, 95)
            targetY = clamp(owner.y - direction * 3, 5, 95)
          }
        } else if (!isDefending) {
          targetY = clamp(targetY + direction * (position.position === 'FW' ? 6 : 3), 5, 95)
        }

        position.targetX = targetX
        position.targetY = targetY
        const acceleration = isOwner ? 22 : 14
        position.vx += (targetX - position.x) * acceleration * frameSeconds
        position.vy += (targetY - position.y) * acceleration * frameSeconds
        const maxSpeed = isOwner ? 11 : position.position === 'GK' ? 5 : 8.5
        const magnitude = Math.hypot(position.vx, position.vy)
        if (magnitude > maxSpeed) {
          position.vx = position.vx / magnitude * maxSpeed
          position.vy = position.vy / magnitude * maxSpeed
        }
        position.vx *= Math.pow(0.17, frameSeconds)
        position.vy *= Math.pow(0.17, frameSeconds)
        position.x = clamp(position.x + position.vx * frameSeconds, 4, 96)
        position.y = clamp(position.y + position.vy * frameSeconds, 4, 96)
      })

      if (this.ballTransit) {
        const transit = this.ballTransit
        transit.elapsed += delta * speed
        const progress = Math.min(1, transit.elapsed / transit.duration)
        const target = this.playerPositions[transit.targetName] || transit.target
        this.ballPosition.x = transit.start.x + (target.x - transit.start.x) * progress
        this.ballPosition.y = transit.start.y + (target.y - transit.start.y) * progress
        this.ballPosition.lift = Math.sin(progress * Math.PI) * transit.arc
        if (progress >= 1) {
          this.ballOwnerName = transit.targetName || null
          this.possessionTeam = target.team || this.possessionTeam
          this.ballTransit = null
        }
      } else if (owner) {
        const direction = owner.team === 'my' ? 1 : -1
        const attached = getBallAttachmentPoint(owner, direction)
        this.ballPosition.x += (attached.x - this.ballPosition.x) * 0.45
        this.ballPosition.y += (attached.y - this.ballPosition.y) * 0.45
        this.ballPosition.lift = Math.abs(Math.sin(this.ambientPhase * 8)) * 1.2
      }
    }

    chooseAmbientAction(now) {
      const owner = this.playerPositions[this.ballOwnerName]
      if (!owner) return
      const direction = owner.team === 'my' ? 1 : -1
      const teammates = Object.entries(this.playerPositions)
        .filter(([name, position]) => (
          name !== this.ballOwnerName
          && position.team === owner.team
          && position.position !== 'GK'
        ))
        .sort(([, a], [, b]) => (
          Math.abs(a.x - owner.x) + Math.abs(a.y - (owner.y + direction * 12))
          - Math.abs(b.x - owner.x) - Math.abs(b.y - (owner.y + direction * 12))
        ))
      const nearestDefender = Object.entries(this.playerPositions)
        .filter(([, position]) => position.team !== owner.team && position.position !== 'GK')
        .sort(([, a], [, b]) => (
          Math.hypot(a.x - owner.x, a.y - owner.y)
          - Math.hypot(b.x - owner.x, b.y - owner.y)
        ))[0]
      const pressured = nearestDefender && Math.hypot(
        nearestDefender[1].x - owner.x,
        nearestDefender[1].y - owner.y,
      ) < 10
      const nearGoal = owner.team === 'my' ? owner.y > 82 : owner.y < 18

      if ((pressured || nearGoal || Math.random() < 0.58) && teammates[0]) {
        const candidateCount = Math.min(3, teammates.length)
        this.startBallTransit(
          teammates[Math.floor(Math.random() * candidateCount)][0],
          nearGoal ? 360 : 520,
        )
      } else if (pressured && nearestDefender && Math.random() < 0.22) {
        this.startBallTransit(nearestDefender[0], 300)
      }
      this.lastAmbientAction = now
    }

    startBallTransit(targetName, duration = 480, arc = 4) {
      const target = this.playerPositions[targetName]
      if (!target) return
      this.ballTransit = {
        start: { x: this.ballPosition.x, y: this.ballPosition.y },
        targetName,
        target,
        duration,
        elapsed: 0,
        arc,
      }
      this.ballOwnerName = null
    }

    claimNearestBall(preferredTeam = null) {
      const candidates = Object.entries(this.playerPositions)
        .filter(([, position]) => !preferredTeam || position.team === preferredTeam)
        .sort(([, a], [, b]) => (
          Math.hypot(a.x - this.ballPosition.x, a.y - this.ballPosition.y)
          - Math.hypot(b.x - this.ballPosition.x, b.y - this.ballPosition.y)
        ))
      const [name, position] = candidates[0] || []
      if (!name || !position) return
      this.ballOwnerName = name
      this.possessionTeam = position.team
      const attached = getBallAttachmentPoint(position, position.team === 'my' ? 1 : -1)
      this.ballPosition = { ...attached, lift: 0 }
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
      this.ballOwnerName = null
      this.ballTransit = null
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
      if (moveTo === 'gk_rush') return { x: 50, y: 22 }
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
      await this.showCenteredEffect('goal', isOpponent ? '失球！' : '进球！', isOpponent ? '#B34235' : '#C99A2E', 1500)
    }

    showSaveEffect(eventAsset = false) {
      this.controller.onSaveEffect?.()
      return this.showCenteredEffect(eventAsset ? 'save' : null, '扑出！', '#F3E3B4', 900)
    }

    showCenteredEffect(assetKey, text, color, duration) {
      const objects = []
      if (assetKey && this.textures.exists(`event-${assetKey}`)) {
        const image = this.add.image(this.scale.width / 2, this.scale.height / 2, `event-${assetKey}`)
          .setDisplaySize(this.scale.height * 0.34, this.scale.height * 0.34)
          .setDepth(70)
        objects.push(image)
      }
      const label = this.add.text(this.scale.width / 2, this.scale.height / 2, text, {
        fontFamily: 'Zpix, monospace',
        fontSize: `${Math.floor(this.scale.height * 0.16)}px`,
        color,
        stroke: '#1B3764',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(72)
      objects.push(label)
      objects.forEach(object => object.setAlpha(0))
      this.tweens.add({
        targets: objects,
        alpha: 1,
        duration: 160,
        yoyo: true,
        hold: Math.max(100, duration - 320),
        onComplete: () => objects.forEach(object => object.destroy()),
      })
      return this.sleep(duration)
    }

    async showCard(color) {
      const key = color === 'yellow' ? 'yellowCard' : 'redCard'
      if (this.textures.exists(`event-${key}`)) {
        const image = this.add.image(this.scale.width / 2, this.scale.height / 2, `event-${key}`)
          .setDisplaySize(this.scale.height * 0.24, this.scale.height * 0.32)
          .setDepth(70)
        this.tweens.add({
          targets: image,
          alpha: 0,
          duration: 320,
          delay: 850,
          onComplete: () => image.destroy(),
        })
      }
      await this.sleep(1200)
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
      const bridge = getDecisionBridge(this.ballOwnerName, primaryName, this.playerPositions)
      const bridgeDuration = bridge.type === 'turnover' ? 820 : bridge.type === 'pass' ? 680 : 360
      const actions = [this.moveBall({ x: primary.x, y: primary.y }, bridgeDuration, 'pass')]
      const second = this.playerPositions[secondName]
      if (second && secondName !== primaryName) {
        actions.push(this.movePlayer(secondName, { x: clamp(primary.x + (second.x <= primary.x ? -8 : 8)), y: clamp(primary.y - 8) }, 520))
      }
      const opponent = this.playerPositions[opponentName]
      if (opponent) {
        actions.push(this.movePlayer(opponentName, { x: clamp(primary.x + (opponent.x <= primary.x ? -7 : 7)), y: clamp(primary.y + 7) }, 520))
      }
      await Promise.all(actions)
      this.ballOwnerName = primaryName
      this.possessionTeam = primary.team
      const attached = getBallAttachmentPoint(primary, primary.team === 'my' ? 1 : -1)
      this.ballPosition = { ...attached, lift: 0 }
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
      const preferredTeam = normalizedKey.includes('opponent_goal') || normalizedKey.includes('goal_against')
        ? 'my'
        : normalizedKey.includes('goal') || normalizedKey.includes('saved') || normalizedKey.includes('save')
          ? 'opponent'
          : null
      this.claimNearestBall(preferredTeam)
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
      this.possessionTeam = event.teamSide || 'my'
      const actor = this.playerPositions[actorName]
      const support = this.playerPositions[supportName]
      const opponent = this.playerPositions[opponentName]
      const direction = event.teamSide === 'opponent' ? -1 : 1
      const actions = []

      if (actor) {
        if (this.ballOwnerName !== actorName) {
          actions.push(this.moveBall({ x: actor.x, y: actor.y }, 520, 'pass'))
        }
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
        await Promise.all(actions)
        await this.moveBall({ x: support.x, y: support.y }, 420, event.visualKind)
        this.ballOwnerName = supportName
        this.possessionTeam = support.team
        return
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
      if (actor) this.ballOwnerName = actorName
    }

    setSimulationSpeed(speed = 1) {
      this.simulationSpeed = speed
      this.controller.simulationSpeed = speed
    }

    async preparePenalty({ shooterTeam = 'my', shooterName, goalkeeperName } = {}) {
      this.animating = true
      const isMyShot = shooterTeam === 'my'
      const shooterKey = isMyShot ? shooterName : `opp_${shooterName}`
      const goalkeeperKey = isMyShot ? `opp_${goalkeeperName}` : goalkeeperName
      const shooter = this.playerPositions[shooterKey]
      const goalkeeper = this.playerPositions[goalkeeperKey]
      if (!shooter || !goalkeeper) {
        this.animating = false
        return
      }
      this.playerObjects.forEach((objects, name) => {
        const visible = name === shooterKey || name === goalkeeperKey
        objects.sprite.setVisible(visible)
        objects.shadow.setVisible(visible)
        objects.label.setVisible(visible)
        objects.leftEye.setVisible(visible)
        objects.rightEye.setVisible(visible)
      })
      const shotY = isMyShot ? 88 : 12
      const goalY = isMyShot ? 96 : 4
      await Promise.all([
        this.movePlayer(shooterKey, { x: 50, y: shotY - (isMyShot ? 7 : -7) }, 520),
        this.movePlayer(goalkeeperKey, { x: 50, y: goalY }, 520),
      ])
      this.ballPosition = { x: 50, y: shotY, lift: 0 }
      this.ballOwnerName = null
      this.animating = false
    }

    async playPenaltyKick({
      shooterTeam = 'my',
      shooterName,
      goalkeeperName,
      shooterDirection = 'center',
      keeperDirection = 'center',
      scored = false,
      saved = false,
    } = {}) {
      const isMyShot = shooterTeam === 'my'
      const shooterKey = isMyShot ? shooterName : `opp_${shooterName}`
      const goalkeeperKey = isMyShot ? `opp_${goalkeeperName}` : goalkeeperName
      const shooter = this.playerPositions[shooterKey]
      const goalkeeper = this.playerPositions[goalkeeperKey]
      if (!shooter || !goalkeeper) return
      this.animating = true
      const shotX = shooterDirection === 'left' ? 36 : shooterDirection === 'right' ? 64 : 50
      const keeperX = keeperDirection === 'left' ? 38 : keeperDirection === 'right' ? 62 : 50
      const goalY = isMyShot ? 98 : 2
      const missY = isMyShot ? 101 : -1
      await Promise.all([
        this.movePlayer(shooterKey, { x: 50, y: isMyShot ? 86 : 14 }, 260, 'easeIn'),
        this.movePlayer(goalkeeperKey, { x: keeperX, y: isMyShot ? 95 : 5 }, 430, 'easeOut'),
        this.moveBall({
          x: saved ? keeperX : shotX,
          y: scored ? goalY : saved ? (isMyShot ? 94 : 6) : missY,
        }, 520, 'penalty_shot'),
      ])
      if (scored) await this.showGoalEffect(!isMyShot)
      else if (saved) await this.showSaveEffect(true)
      else await this.showCenteredEffect(null, '射失！', '#B34235', 850)
      this.animating = false
    }

    getState() {
      return {
        playerPositions: this.playerPositions,
        ballPosition: this.ballPosition,
        animating: this.animating,
        ballZone: this.ballZone,
        ballOwnerName: this.ballOwnerName,
        simulationSpeed: this.controller.simulationSpeed || this.simulationSpeed,
      }
    }
  }
}
