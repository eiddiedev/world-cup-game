const SIDES = ['red', 'blue']
const POSITION_ORDER = ['GK', 'DF', 'MF', 'FW']
const UNAVAILABLE_STATUSES = new Set([
  'injured',
  'suspended',
  'unavailable',
  'red-carded',
  'substituted',
])

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function percent(completed, attempted) {
  const total = number(attempted)
  if (total <= 0) return 0
  return Math.round((number(completed) / total) * 100)
}

function authorityStats(visualEvents, side) {
  const stats = visualEvents?.authority?.stats?.[side] || {}
  return {
    shots: number(stats.shots),
    shotsOnTarget: number(stats.shotsOnTarget),
    passAccuracy: percent(stats.passesCompleted, stats.passesAttempted),
    passesCompleted: number(stats.passesCompleted),
    passesAttempted: number(stats.passesAttempted),
    corners: number(stats.corners),
    fouls: number(stats.fouls),
    yellowCards: number(stats.yellowCards),
    redCards: number(stats.redCards),
  }
}

function broadcastCommentary(visualEvents) {
  const events = [...(visualEvents?.events || [])]
    .sort((left, right) => left.sequence - right.sequence)
  const completed = new Set(visualEvents?.completedEventIds || [])
  const completedLines = events
    .filter((event) => completed.has(event.id))
    .map((event) => ({
      id: `${event.id}:result`,
      eventId: event.id,
      minute: event.minute,
      type: event.type,
      tone: event.outcome?.scoreDelta?.red || event.outcome?.scoreDelta?.blue
        ? 'goal'
        : event.type === 'penalty_area_foul'
          ? 'danger'
          : 'standard',
      text: event.commentary.result,
    }))
  const active = events.find((event) => event.id === visualEvents?.activeEventId)
  if (!active) return completedLines.slice(-3)

  return [
    ...completedLines.slice(-2),
    {
      id: `${active.id}:prelude`,
      eventId: active.id,
      minute: active.minute,
      type: active.type,
      tone: 'live',
      text: active.commentary.prelude,
    },
  ]
}

function formalSessionStats(session, snapshot, side) {
  const authored = session?.stats?.[side] || {}
  const runtimeShots = Number(session?.runtime?.shots?.[side] || snapshot?.[side]?.shots || 0)
  const runtimePasses = Number(session?.runtime?.passes?.[side] || snapshot?.[side]?.passes || 0)
  const passesAttempted = Math.max(Number(authored.passesAttempted || 0), runtimePasses)
  const passesCompleted = Math.max(
    Number(authored.passesCompleted || 0),
    Math.round(runtimePasses * 0.82),
  )
  const shots = Math.max(Number(authored.shots || 0), runtimeShots)
  return {
    shots,
    shotsOnTarget: Math.min(
      shots,
      Math.max(Number(authored.shotsOnTarget || 0), Math.round(runtimeShots * 0.56)),
    ),
    passAccuracy: percent(passesCompleted, passesAttempted),
    passesCompleted,
    passesAttempted,
    corners: Number(authored.corners || 0),
    fouls: Number(authored.fouls || 0),
    yellowCards: Number(authored.yellowCards || 0),
    redCards: Number(authored.redCards || 0),
  }
}

function formalSessionCommentary(session) {
  return (session?.commentary || []).slice(-4).map((line) => ({ ...line }))
}

export function buildMatchBroadcastView(snapshot = {}, visualEvents = {}, session = null) {
  const authorityScore = session?.score || visualEvents?.authority?.score || { red: 0, blue: 0 }
  const teams = Object.fromEntries(SIDES.map((side) => [side, {
    name: session
      ? side === 'red' ? session.teamName : session.opponentName
      : snapshot?.[side]?.name || (side === 'red' ? '本方' : '对手'),
    score: number(authorityScore[side]),
    possession: number(session?.runtime?.possession?.[side] ?? snapshot?.[side]?.possession),
    playerCount: number(snapshot?.[side]?.playerCount),
    ...(session ? formalSessionStats(session, snapshot, side) : authorityStats(visualEvents, side)),
  }]))

  return {
    minute: number(session?.minute ?? snapshot?.minute),
    clock: snapshot?.clock || null,
    teams,
    commentary: session ? formalSessionCommentary(session) : broadcastCommentary(visualEvents),
    activeEventId: visualEvents?.activeEventId || null,
    completedCount: session ? session.decisions.length : number(visualEvents?.completedCount),
    totalCount: session ? session.targetDecisionCount : number(visualEvents?.totalCount),
    status: session?.status || visualEvents?.status || 'loading',
    scoreAuthority: session ? 'formal-match-session' : 'gameplay-layer',
  }
}

function positionRank(player) {
  const position = player.assignedPosition || player.naturalPosition || player.position || 'MF'
  return POSITION_ORDER.indexOf(position)
}

export function buildBroadcastSubstitutionBoard(actorSnapshot = {}, options = {}) {
  const side = options.side === 'blue' ? 'blue' : 'red'
  const active = (actorSnapshot.actors || [])
    .filter((actor) => actor.side === side && actor.state?.onPitch)
    .sort((left, right) => (
      positionRank(left) - positionRank(right)
      || left.number - right.number
    ))
  const selectedOut = active.find((actor) => actor.playerId === options.outPlayerId) || null
  const bench = (actorSnapshot.sides?.[side]?.bench || [])
    .filter((player) => (
      player.state?.status === 'bench'
      && !UNAVAILABLE_STATUSES.has(player.sourceStatus)
      && !UNAVAILABLE_STATUSES.has(player.state?.status)
    ))
    .filter((player) => (
      !selectedOut
      || selectedOut.isGoalkeeper === (player.naturalPosition === 'GK')
    ))
    .sort((left, right) => (
      positionRank(left) - positionRank(right)
      || left.number - right.number
    ))

  return {
    side,
    active,
    bench,
    selectedOut,
    selectedIn: bench.find((player) => player.playerId === options.inPlayerId) || null,
    canConfirm: Boolean(
      selectedOut
      && bench.some((player) => player.playerId === options.inPlayerId)
    ),
    substitutionsMade: actorSnapshot.sides?.[side]?.substitutionHistory?.length || 0,
  }
}
