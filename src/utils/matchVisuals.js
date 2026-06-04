const POSITION_FALLBACKS = {
  GK: { x: 50, y: 8 },
  DF: { x: 50, y: 28 },
  MF: { x: 50, y: 50 },
  FW: { x: 50, y: 72 },
}

export const BALL_ZONES = {
  buildup: { x: 42, y: 30 },
  midfield: { x: 50, y: 52 },
  left_attack: { x: 24, y: 74 },
  right_attack: { x: 76, y: 74 },
  box: { x: 52, y: 86 },
  defend: { x: 50, y: 28 },
}

export const SUPPORTED_ANIMATION_FRAME_TYPES = new Set([
  'PAUSE_FOR_CHOICE',
  'TEAM_PUSH_UP',
  'TEAM_PUSH_DOWN',
  'GOAL_EFFECT',
  'OPPONENT_GOAL_EFFECT',
  'CARD_EFFECT',
  'FOUL_EFFECT',
  'WALL_FORM',
  'PENALTY_MARK',
  'shot',
  'pass',
  'shot_miss',
  'save_dive',
  'cross',
  'freekick_curve',
  'freekick_over',
  'tackle_success',
  'save_rush',
  'claim_ball',
  'slide_tackle',
  'press_success',
  'escape',
  'soft_foul',
  'walk_off',
  'run_on',
  'energetic_run',
  'counter',
  'penalty_shot',
  'dive_right',
  'dive_left',
  'penalty_post',
  'clearance',
  'block',
  'save',
  'claim',
  'steal',
  'fresh_run',
  'loose_ball',
  'touch',
  'through',
  'direct',
  'safe_pass',
  'header_shot',
  'header_wide',
  'wall_block',
  'recycle',
])

function getPosition(player) {
  return player?.pos || player?.position
}

function byPosition(players, position) {
  return players.find(player => getPosition(player) === position)
}

function outfield(players) {
  return players.filter(player => getPosition(player) !== 'GK')
}

function firstAvailable(...players) {
  return players.find(Boolean)
}

function canvasName(player, teamSide) {
  if (!player) return null
  return teamSide === 'opponent' ? `opp_${player.name}` : player.name
}

export function buildAnimationActors(scenario, keyPlayers = {}, myLineup = [], opponentLineup = []) {
  const myOutfield = outfield(myLineup)
  const oppOutfield = outfield(opponentLineup)
  const myPrimary = firstAvailable(keyPlayers.default, myOutfield[0], myLineup[0])
  const mySecond = firstAvailable(
    keyPlayers.second,
    myOutfield.find(player => player.id !== myPrimary?.id),
    myOutfield[1],
    myPrimary,
  )
  const opponentGK = byPosition(opponentLineup, 'GK') || opponentLineup[0]
  const opponentPrimary = firstAvailable(
    oppOutfield[0],
    opponentLineup.find(player => player.id !== opponentGK?.id),
    opponentGK,
  )

  const actors = [myPrimary, mySecond]
  actors.my = [myPrimary, mySecond]
  actors.opponent = [opponentPrimary, opponentGK || opponentPrimary]
  actors.canvas = {
    myPrimary: canvasName(myPrimary, 'my'),
    mySecond: canvasName(mySecond, 'my'),
    opponentPrimary: canvasName(opponentPrimary, 'opponent'),
    opponentGK: canvasName(opponentGK || opponentPrimary, 'opponent'),
  }

  if (scenario?.animation_type === 'penalty_shootout') {
    actors[1] = opponentGK || opponentPrimary
  }

  return actors
}

function findByIdOrName(players, id, name) {
  return players.find(player => (id && player.id === id) || (name && player.name === name))
}

export function createVisualEvent(event, myPlayers = [], opponentPlayers = []) {
  const visual = event?.visual || {}
  const teamSide = visual.teamSide || event?.teamSide || 'my'
  const actorPool = teamSide === 'opponent' ? opponentPlayers : myPlayers
  const supportPool = teamSide === 'opponent' ? opponentPlayers : myPlayers
  const opponentPool = teamSide === 'opponent' ? myPlayers : opponentPlayers
  const actor = findByIdOrName(actorPool, visual.actorId || event?.playerId, event?.playerName) || actorPool[0]
  const support = findByIdOrName(supportPool, visual.supportId, visual.supportName)
    || supportPool.find(player => player.id !== actor?.id && getPosition(player) !== 'GK')
    || actor
  const opponent = findByIdOrName(opponentPool, visual.opponentId, visual.opponentName)
    || opponentPool.find(player => getPosition(player) !== 'GK')
    || opponentPool[0]

  return {
    visualKind: visual.visualKind || event?.type || 'midfield',
    teamSide,
    ballZone: visual.ballZone || 'midfield',
    actor,
    support,
    opponent,
    actorName: canvasName(actor, teamSide),
    supportName: canvasName(support, teamSide),
    opponentName: canvasName(opponent, teamSide === 'opponent' ? 'my' : 'opponent'),
  }
}

function zoneBias(team, zone) {
  const target = BALL_ZONES[zone] || BALL_ZONES.midfield
  const teamDirection = team === 'my' ? 1 : -1
  return {
    x: (target.x - 50) * 0.12,
    y: (target.y - 50) * 0.10 * teamDirection,
  }
}

export function createAmbientTargets(state = {}) {
  const positions = state.playerPositions || {}
  const zone = state.ballZone || 'midfield'
  const phase = state.phase || 0
  const targets = {}

  Object.entries(positions).forEach(([name, pos], index) => {
    const fallback = POSITION_FALLBACKS[pos.position] || { x: pos.x, y: pos.y }
    const bias = zoneBias(pos.team, zone)
    const wave = Math.sin(phase + index * 0.85)
    const lane = Math.cos(phase * 0.7 + index * 0.55)
    targets[name] = {
      x: Math.max(5, Math.min(95, (pos.anchorX ?? fallback.x) + bias.x + wave * 1.8)),
      y: Math.max(5, Math.min(95, (pos.anchorY ?? fallback.y) + bias.y + lane * 1.4)),
    }
  })

  return targets
}

export function collectUnsupportedAnimationFrameTypes(templates) {
  const unsupported = new Set()
  Object.values(templates).forEach((template) => {
    const frameGroups = [
      template.keyframes || [],
      ...Object.values(template.result_animations || {}),
    ]
    frameGroups.flat().forEach((frame) => {
      if (frame?.type && !SUPPORTED_ANIMATION_FRAME_TYPES.has(frame.type)) {
        unsupported.add(frame.type)
      }
    })
  })
  return [...unsupported].sort()
}
