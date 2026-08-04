import {
  HAPPYSEED_HUMAN_ACTIONS,
  getHappySeedHumanRecipes,
} from '../utils/happySeedHumanPlayer.js'
import {
  HAPPYSEED_STADIUM_CAMERA_PRESETS,
  HAPPYSEED_STADIUM_LAYERS,
  HAPPYSEED_PIXEL_STADIUM_ASSETS,
  getHappySeedPixelStadiumContract,
} from '../utils/happySeedPixelStadium.js'
import { COMPETITION_BRAND } from '@competition-brand'
import {
  buildHappySeedRuntimeActorConfig,
  getHappySeedRuntimeActorSnapshot as getActorContractSnapshot,
} from '../utils/happySeedRuntimeActors.js'
import {
  applyMatchVisualEventAuthority,
  buildRepresentativeMatchVisualEvents,
  createMatchVisualAuthorityState,
  createMatchVisualEventQueue,
} from '../utils/matchVisualEvent.js'
import {
  FORMAL_COACH_DECISION_CATALOG,
  FORMAL_COACH_DECISION_SEQUENCE,
  FORMAL_COACH_RUNTIME_V2_SEQUENCE,
  buildFormalCoachDecision,
  createFormalCoachDecisionPreludeVisualEvent,
  findConservativeFormalCoachChoice,
  resolveFormalCoachDecision,
  resolveFormalCoachDecisionRule,
} from '../utils/formalCoachDecision.js'
import {
  isDangerousFreeKickRuntimeMomentEligible,
} from '../utils/decisionSceneScriptV2.js'
import {
  buildFormalDecisionSceneScriptV3,
  validateDecisionSceneScriptV3,
} from '../utils/decisionSceneScriptV3.js'
import { getFormalDecisionSceneContractV3 } from '../utils/formalDecisionSceneCatalogV3.js'
import {
  createMatchRuntimeEvent,
  validateMatchRuntimeEventV1,
} from '../utils/matchRuntimeEvent.js'
import { runtimeMatchMinute } from '../utils/matchClock.js'
import { preloadAssetUrls } from '../utils/visualAssetLoader.js'
import { CURRENT_VARIANT } from '../config/runtime.js'
import { getPlayerModeDemoAssistProfile } from '../utils/playerModeDemoAssist.js'

const RUNTIME_BASE = __DOUYIN_BUILD__ ? './match-runtime-min' : '/match-runtime-min'

const SCRIPT_PATHS = __DOUYIN_BUILD__ ? [] : [
  'shim-early.js',
  'vendor/pixi.min.js',
  'vendor/swig.min.js',
  'shim.js',
  'scripts/match.rebuilt.js',
  'happyseed/runtime-v2.js?v=13',
  'happyseed/runtime-v3.js?v=14',
  'standalone-match.js?v=46',
]

const MATCH_EVENTS = [
  'ab-load-stage',
  'ab-load-progress',
  'ab-match-started',
  'ab-human-slice-ready',
  'ab-human-slice-action',
  'ab-stadium-slice-ready',
  'ab-stadium-camera',
  'ab-runtime-actors-ready',
  'ab-runtime-actor-state',
  'ab-runtime-substitution',
  'ab-match-visual-events-ready',
  'ab-match-visual-event-started',
  'ab-match-visual-event-completed',
  'ab-decision-director-ready',
  'ab-decision-director-phase',
  'ab-decision-director-prepared',
  'ab-decision-director-choices',
  'ab-decision-choice-selected',
  'ab-decision-director-settled',
  'ab-decision-director-completed',
  'ab-decision-director-cancelled',
  'ab-runtime-match-event',
  'ab-kickoff-played',
  'ab-goal',
  'ab-match-ended',
]

let bootPromise = null
let dataCachePromise = null
let runtimeCorePromise = null
let runtimeSessionWarmPromise = null
let runtimeShutdownEpoch = 0
let speed = 1
let matchDurationMinutes = 3
let selectedTeams = { red: 'france', blue: 'brazil' }
let eventSequence = 0
let runtimeActorConfig = null
let representativeVisualEvents = []
let matchVisualEventQueue = null
let matchVisualAuthorityState = createMatchVisualAuthorityState()
let coachDecisionVisualEvents = []
let visualPresentationMode = 'representative'
let coachDecisionPlanLength = FORMAL_COACH_DECISION_SEQUENCE.length
let formalDecisionEvents = []
let formalCompletedEventIds = []
let formalActiveEventId = null
let formalDecisionStatus = 'loading'
let formalAuthorityApplied = new Set()
let appliedDisciplineEventIds = new Set()
let formalPreparedDecisionScript = null
let naturalDecisionOpportunityState = {
  eligibleOwnerKey: null,
  resolved: false,
  attempts: 0,
  lastChance: null,
  lastMoment: null,
}

const TEAM_LABELS = {
  argentina: '阿根廷',
  brazil: '巴西',
  england: '英格兰',
  france: '法国',
  germany: '德国',
  portugal: '葡萄牙',
  spain: '西班牙',
  usa: '美国',
}

function ensureRuntimeSettings() {
  if (document.querySelector('script[data-happyseed-settings]')) return

  const settings = document.createElement('script')
  settings.type = 'application/vnd.core-settings+json'
  settings.dataset.happyseedSettings = 'true'
  settings.textContent = JSON.stringify({
    DATA_PREFIX: 'match-runtime-min/data',
    DEBUG: false,
  })
  document.body.appendChild(settings)
}

function loadScript(path) {
  const src = `${RUNTIME_BASE}/${path}`
  const existing = document.querySelector(`script[data-happyseed-script="${path}"]`)
  if (existing?.dataset.loaded === 'true') return Promise.resolve()

  return new Promise((resolve, reject) => {
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.dataset.happyseedScript = path
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', () => {
      reject(new Error(`运行时脚本加载失败：${src}`))
    }, { once: true })
    document.body.appendChild(script)
  })
}

async function preloadDataCaches() {
  if (window.__dataBundleCache && window.__dirlistCache) return
  if (dataCachePromise) return dataCachePromise
  if (__DOUYIN_BUILD__) {
    // 互动空间不再进入模式后动态追加脚本。构建产物会把数据与引擎
    // 合并成一个 defer 脚本，在首轮静态加载时按固定顺序完成注入。
    dataCachePromise = Promise.resolve().then(() => {
      if (!window.__dataBundleCache || !window.__dirlistCache) {
        throw new Error('互动空间比赛引擎静态包未完成注入')
      }
    }).catch((error) => {
      dataCachePromise = null
      throw error
    })
    return dataCachePromise
  }

  dataCachePromise = (async () => {
    const [bundleResponse, dirlistResponse] = await Promise.all([
      fetch(`${RUNTIME_BASE}/__data-bundle.json`, { cache: 'force-cache' }),
      fetch(`${RUNTIME_BASE}/__dirlist.json`, { cache: 'force-cache' }),
    ])

    if (!bundleResponse.ok) {
      throw new Error(`比赛数据包加载失败：HTTP ${bundleResponse.status}`)
    }

    window.__dataBundleCache = await bundleResponse.text()
    if (dirlistResponse.ok) window.__dirlistCache = await dirlistResponse.text()
  })().catch((error) => {
    dataCachePromise = null
    throw error
  })
  return dataCachePromise
}

const BODY_PART_FILES = [
  'arm_left.png', 'arm_right.png', 'hand_left.png', 'hand_right.png',
  'knee.png', 'neck.png', 'head_front.png', 'head_back.png',
]

const KIT_PART_FILES = [
  'sleeve_left.png', 'sleeve_right.png', 'shorts.png', 'shorts_leg.png',
  'socks.png', 'shoes.png', 'shirt_front.png', 'shirt_back.png',
]

export function collectHappySeedMatchAssetUrls(config) {
  const urls = new Set(Object.values(HAPPYSEED_PIXEL_STADIUM_ASSETS))
  const bindings = [
    ...(config?.actors || []),
    ...(config?.sides?.red?.bench || []),
    ...(config?.sides?.blue?.bench || []),
  ]

  bindings.forEach((binding) => {
    const visual = binding?.visual || binding?.business?.visual
    if (!visual) return
    if (visual.number) urls.add(visual.number)
    if (visual.playerRoot) BODY_PART_FILES.forEach((file) => urls.add(`${visual.playerRoot}/${file}`))
    if (visual.kitRoot) KIT_PART_FILES.forEach((file) => urls.add(`${visual.kitRoot}/${file}`))
    if (visual.kitRoot && visual.role === 'goalkeeper') {
      urls.add(`${visual.kitRoot}/hand_left.png`)
      urls.add(`${visual.kitRoot}/hand_right.png`)
    }
  })
  return [...urls]
}

export function preloadHappySeedRuntimeCore({ onProgress } = {}) {
  if (runtimeCorePromise) return runtimeCorePromise
  runtimeCorePromise = (async () => {
    ensureRuntimeSettings()
    onProgress?.(8, '正在读取比赛数据')
    await Promise.all([
      preloadDataCaches(),
      preloadAssetUrls(Object.values(HAPPYSEED_PIXEL_STADIUM_ASSETS), {
        concurrency: 4,
        onProgress: ({ percent }) => onProgress?.(8 + Math.round(percent * 0.34), COMPETITION_BRAND.matchLoading),
      }),
    ])
    onProgress?.(45, '正在启动比赛引擎')
    for (let index = 0; index < SCRIPT_PATHS.length; index += 1) {
      await loadScript(SCRIPT_PATHS[index])
      onProgress?.(45 + Math.round(((index + 1) / SCRIPT_PATHS.length) * 25), '正在启动比赛引擎')
    }
    onProgress?.(70, '比赛引擎准备完成')
  })().catch((error) => {
    runtimeCorePromise = null
    throw error
  })
  return runtimeCorePromise
}

export async function preloadHappySeedMatchAssets(options = {}, {
  onProgress,
  assetConcurrency = 10,
} = {}) {
  await preloadHappySeedRuntimeCore({ onProgress })
  const config = buildHappySeedRuntimeActorConfig({
    ...options,
    red: options.red || 'france',
    blue: options.blue || 'brazil',
  })
  const urls = collectHappySeedMatchAssetUrls(config)
  await preloadAssetUrls(urls, {
    concurrency: assetConcurrency,
    onProgress: ({ percent }) => onProgress?.(70 + Math.round(percent * 0.25), '正在装配双方球员'),
  })
  onProgress?.(95, '正在布置比赛现场')
  return config
}

function waitForMatchStart(timeoutMs = 30000, waitForNextStart = false) {
  return new Promise((resolve, reject) => {
    if (!waitForNextStart && window.__matchGame?.pitch?.matchStarted) {
      resolve(getSnapshot())
      return
    }

    const timer = window.setTimeout(() => {
      window.removeEventListener('ab-match-started', handleStarted)
      reject(new Error('比赛引擎启动超时'))
    }, timeoutMs)

    function handleStarted() {
      window.clearTimeout(timer)
      resolve(getSnapshot())
    }

    window.addEventListener('ab-match-started', handleStarted, { once: true })
  })
}

export function getGame() {
  return window.__matchGame || null
}

export function getPitch() {
  return getGame()?.pitch || null
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0))
}

function distanceBetween(left, right) {
  return Math.hypot(
    Number(left?.position?.x || 0) - Number(right?.x || 0),
    Number(left?.position?.y || 0) - Number(right?.y || 0),
  )
}

export function captureFormalMatchRuntimeMoment({ allowPaused = false } = {}) {
  const game = getGame()
  const pitch = getPitch()
  if (
    !game?.allPlayers?.length
    || !pitch
    || (!allowPaused && !pitch.matchStarted)
    || !runtimeActorConfig?.actors?.length
  ) return null

  const entityById = new Map(game.allPlayers.map((player) => [player.id, player]))
  const activeActors = runtimeActorConfig.actors.filter((actor) => actor.state?.onPitch)
  const liveEntryByActorId = new Map(
    (game.stadium?._happySeedActorEntries || [])
      .filter((entry) => entry?.actor?.runtimeActorId && entry?.entity)
      .map((entry) => [entry.actor.runtimeActorId, entry]),
  )
  const entityForActor = (actor) => (
    liveEntryByActorId.get(actor.runtimeActorId)?.entity
    || entityById.get(actor.runtimeEntityId)
    || game.allPlayers[actor.runtimeIndex]
    || null
  )
  const actorPositions = activeActors.map((actor) => {
    const entity = entityForActor(actor)
    if (!entity?.position) return null
    return {
      runtimeActorId: actor.runtimeActorId,
      normalized: [
        clamp(entity.position.x / pitch.width, 0, 1),
        clamp(entity.position.y / pitch.height, 0, 1),
      ],
      facing: Number(entity.heading?.x || 0) < 0 ? 'left' : 'right',
    }
  }).filter(Boolean)
  if (actorPositions.length < 18) return null

  const owner = pitch.ball.owner
    || game.allPlayers.find((player) => player.hasBall)
    || [...game.allPlayers]
      .filter((player) => player?.position)
      .sort((left, right) => (
        distanceBetween(left, pitch.ball.position) - distanceBetween(right, pitch.ball.position)
      ))[0]
  const ownerActor = activeActors.find((actor) => entityForActor(actor) === owner)
    || activeActors.find((actor) => entityForActor(actor)?.id === owner?.id)
  if (!ownerActor) return null
  const redActors = activeActors.filter((actor) => actor.side === 'red')
  const blueActors = activeActors.filter((actor) => actor.side === 'blue')
  const attackingActors = ownerActor.side === 'red' ? redActors : blueActors
  const defendingActors = ownerActor.side === 'red' ? blueActors : redActors
  const ballPosition = pitch.ball.position
  const attackingOptions = attackingActors
    .filter((actor) => actor.runtimeActorId !== ownerActor.runtimeActorId)
    .map((actor) => ({ actor, entity: entityForActor(actor) }))
    .filter((entry) => entry.entity?.position)
  const support = [...attackingOptions].sort((left, right) => (
    distanceBetween(left.entity, ballPosition) - distanceBetween(right.entity, ballPosition)
  ))[0]
  const idealAerialTarget = {
    x: pitch.width * (ownerActor.side === 'red' ? 0.9 : 0.1),
    y: pitch.height * (ballPosition.y / pitch.height > 0.5 ? 0.34 : 0.66),
  }
  const aerialTarget = [...attackingOptions].sort((left, right) => (
    distanceBetween(left.entity, idealAerialTarget)
    - distanceBetween(right.entity, idealAerialTarget)
  ))[0] || support
  const goalkeeper = defendingActors.find((actor) => actor.isGoalkeeper)
  const attackingGoalkeeper = attackingActors.find((actor) => actor.isGoalkeeper)
  const defenders = defendingActors
    .filter((actor) => !actor.isGoalkeeper)
    .map((actor) => ({ actor, entity: entityForActor(actor) }))
    .filter((entry) => entry.entity?.position)
    .sort((left, right) => (
      distanceBetween(left.entity, ballPosition) - distanceBetween(right.entity, ballPosition)
    ))
  if (!support || !aerialTarget || !goalkeeper || !attackingGoalkeeper || defenders.length < 4) return null
  const defendingGoalkeeperEntity = entityForActor(goalkeeper)
  const attackingGoalkeeperEntity = entityForActor(attackingGoalkeeper)
  if (!defendingGoalkeeperEntity?.position || !attackingGoalkeeperEntity?.position) return null
  const attackDirection = defendingGoalkeeperEntity.position.x >= attackingGoalkeeperEntity.position.x
    ? 1
    : -1

  return {
    schemaVersion: 'runtime-decision-moment-v1',
    capturedAtMatchTime: Number(pitch.matchTime || 0),
    runtimeState: pitch.states?.current?.name || 'Match',
    ballOutOfPlay: Boolean(pitch.ballOutOfPlay),
    attackingSide: ownerActor.side,
    attackDirection,
    ownerRuntimeActorId: ownerActor.runtimeActorId,
    ownerIsGoalkeeper: Boolean(ownerActor.isGoalkeeper),
    ballInHands: Boolean(pitch.ball.inHands || owner?.isGoalkeeper && owner?.hasBall),
    primaryRuntimeActorId: ownerActor.runtimeActorId,
    supportRuntimeActorId: support.actor.runtimeActorId,
    aerialTargetRuntimeActorId: aerialTarget.actor.runtimeActorId,
    goalkeeperRuntimeActorId: goalkeeper.runtimeActorId,
    ownGoalkeeperRuntimeActorId: attackingGoalkeeper.runtimeActorId,
    defenderRuntimeActorId: defenders[0].actor.runtimeActorId,
    wallActorIds: defenders.slice(0, 4).map((entry) => entry.actor.runtimeActorId),
    homeGoalkeeperRuntimeActorId: redActors.find((actor) => actor.isGoalkeeper)?.runtimeActorId || null,
    awayGoalkeeperRuntimeActorId: blueActors.find((actor) => actor.isGoalkeeper)?.runtimeActorId || null,
    goalAnchors: {
      attacking: [
        clamp(defendingGoalkeeperEntity.position.x / pitch.width, 0, 1),
        clamp(defendingGoalkeeperEntity.position.y / pitch.height, 0, 1),
      ],
      own: [
        clamp(attackingGoalkeeperEntity.position.x / pitch.width, 0, 1),
        clamp(attackingGoalkeeperEntity.position.y / pitch.height, 0, 1),
      ],
    },
    ball: {
      normalized: [
        clamp(ballPosition.x / pitch.width, 0, 1),
        clamp(ballPosition.y / pitch.height, 0, 1),
        0,
      ],
    },
    actorPositions,
    weather: window.__happySeedWeather || 'clear',
  }
}

function captureDangerousFreeKickRuntimeMoment() {
  const moment = captureFormalMatchRuntimeMoment()
  return moment?.attackingSide === 'red' && !moment.ballOutOfPlay ? moment : null
}

function naturalDecisionChance() {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const value = new URLSearchParams(window.location.search).get('naturalDecisionChance')
    if (value != null && value !== '') return clamp(Number(value), 0, 1)
  }
  return 0.62
}

export function getFormalCoachDecisionOpportunitySnapshot() {
  return {
    eligibleOwnerKey: naturalDecisionOpportunityState.eligibleOwnerKey,
    resolved: naturalDecisionOpportunityState.resolved,
    attempts: naturalDecisionOpportunityState.attempts,
    lastChance: naturalDecisionOpportunityState.lastChance,
    lastMoment: naturalDecisionOpportunityState.lastMoment,
  }
}

export function pollFormalCoachDecisionOpportunity() {
  if (
    naturalDecisionOpportunityState.resolved
    || getDecisionDirectorSnapshot().phase !== 'idle'
  ) return null
  const moment = captureDangerousFreeKickRuntimeMoment()
  if (!isDangerousFreeKickRuntimeMomentEligible(moment)) {
    naturalDecisionOpportunityState.eligibleOwnerKey = null
    return null
  }
  const ownerKey = moment.ownerRuntimeActorId
  if (naturalDecisionOpportunityState.eligibleOwnerKey === ownerKey) return null

  const chance = naturalDecisionChance()
  naturalDecisionOpportunityState.eligibleOwnerKey = ownerKey
  naturalDecisionOpportunityState.attempts += 1
  naturalDecisionOpportunityState.lastChance = chance
  naturalDecisionOpportunityState.lastMoment = moment
  if (Math.random() > chance) return null

  naturalDecisionOpportunityState.resolved = true
  formalDecisionStatus = 'opportunity-detected'
  return moment
}

export function getHumanSliceSnapshot() {
  return window.__happySeedHumanSlice?.getSnapshot?.() || {
    ready: false,
    action: 'run',
    actionLabel: '跑动',
    activeProfileId: 'france-outfield',
    facing: 'front',
    autoCycle: false,
    profileCount: 0,
    compatibleActionCount: HAPPYSEED_HUMAN_ACTIONS.length,
    profiles: [],
  }
}

export function getStadiumSceneSnapshot() {
  return window.__happySeedStadiumScene?.getSnapshot?.() || {
    ready: false,
    id: 'international-championship-day-v1',
    activeCamera: 'normal',
    cameraMode: 'ball',
    cameraTarget: { x: 0, y: 0 },
    draggable: true,
    zoom: 1,
    crowdMotion: true,
    crowdFrame: 0,
    baseRenderSize: { width: 4096, height: 2048 },
    runtimeDisplaySize: { width: 5120, height: 2560 },
    layerCount: HAPPYSEED_STADIUM_LAYERS.length,
    cameraPresetCount: HAPPYSEED_STADIUM_CAMERA_PRESETS.length,
    pixelGoalAtlasApplied: false,
    pixelBallTextureApplied: false,
    pixelBallOutputApplied: false,
    pixelDynamicNetApplied: false,
    pixelDynamicNetTriangleCount: 0,
    pixelDynamicNetStrandCount: 0,
    pixelDynamicNetDepthMode: 'aggregate-front-edge',
    preserves: {
      goalCollision: true,
      dynamicNet: true,
      camera: true,
      depthSort: true,
    },
  }
}

export function getRuntimeActorSnapshot() {
  return window.__happySeedRuntimeActors?.getSnapshot?.()
    || getActorContractSnapshot(runtimeActorConfig)
}

export function getDecisionDirectorSnapshot() {
  return window.__happySeedDecisionDirectorV3?.getSnapshot?.()
    || window.__happySeedDecisionDirectorV2?.getSnapshot?.() || {
    ready: false,
    phase: 'idle',
    scenarioId: null,
    selectedChoiceId: null,
    outcome: null,
    ballVisible: false,
    ballPosition: null,
    choiceLocked: false,
    performedActions: {},
    settleCount: 0,
    visibleChoiceIds: [],
  }
}

export function getMatchVisualEventSnapshot() {
  if (visualPresentationMode === 'coach-decision-v3') {
    const director = getDecisionDirectorSnapshot()
    return {
      ...director,
      ready: director.ready,
      status: formalDecisionStatus,
      activeEventId: formalActiveEventId,
      lastCompletedEventId: formalCompletedEventIds.at(-1) || null,
      completedEventIds: [...formalCompletedEventIds],
      completedCount: formalCompletedEventIds.length,
      totalCount: FORMAL_COACH_RUNTIME_V2_SEQUENCE.length,
      events: formalDecisionEvents,
      presentationMode: 'coach-decision-v3',
      authority: matchVisualAuthorityState,
    }
  }
  const runtimeSnapshot = window.__happySeedMatchVisualEvents?.getSnapshot?.() || {
    ready: false,
    status: 'loading',
    activeEventId: null,
    lastCompletedEventId: null,
    completedEventIds: [],
    completedCount: 0,
    totalCount: representativeVisualEvents.length,
    events: representativeVisualEvents,
  }
  const visibleEvents = visualPresentationMode === 'coach-decision'
    ? coachDecisionVisualEvents
    : representativeVisualEvents
  const visibleEventIds = new Set(visibleEvents.map((event) => event.id))
  const visibleCompletedEventIds = (runtimeSnapshot.completedEventIds || [])
    .filter((eventId) => visibleEventIds.has(eventId))
  return {
    ...runtimeSnapshot,
    completedEventIds: visibleCompletedEventIds,
    completedCount: visibleCompletedEventIds.length,
    totalCount: visualPresentationMode === 'coach-decision'
      ? coachDecisionPlanLength * 2
      : visibleEvents.length,
    events: visibleEvents,
    presentationMode: visualPresentationMode,
    queue: matchVisualEventQueue?.getSnapshot?.() || {
      status: 'idle',
      activeEventId: null,
      completedEventIds: [],
      queued: [],
    },
    authority: matchVisualAuthorityState,
  }
}

function teamLabel(teamSide, fallback) {
  const teamId = selectedTeams[teamSide]
  return TEAM_LABELS[teamId] || teamId || fallback
}

export function getSnapshot() {
  const game = getGame()
  const pitch = getPitch()
  const stoppageClock = window.__happySeedGetStoppageSnapshot?.() || null
  const stats = window.__matchStats || {}
  const redPossession = stats.red?.ownTicks || 0
  const bluePossession = stats.blue?.ownTicks || 0
  const totalPossession = redPossession + bluePossession
  const actorSnapshot = window.__happySeedRuntimeActors?.getSnapshot?.()
  const mappedRedPlayers = actorSnapshot?.actors?.filter?.((actor) => (
    actor.side === 'red' && actor.state?.onPitch
  )).length
  const mappedBluePlayers = actorSnapshot?.actors?.filter?.((actor) => (
    actor.side === 'blue' && actor.state?.onPitch
  )).length
  const redPlayers = game?.allPlayers?.filter?.((player) => player.team === pitch?.redTeam).length || 0
  const bluePlayers = game?.allPlayers?.filter?.((player) => player.team === pitch?.blueTeam).length || 0

  return {
    ready: Boolean(game && pitch),
    paused: Boolean(game?.paused || pitch?.paused),
    speed,
    minute: Number.isFinite(Number(stoppageClock?.minute))
      ? Number(stoppageClock.minute)
      : runtimeMatchMinute(pitch?.matchTime || 0, matchDurationMinutes),
    clock: stoppageClock,
    red: {
      name: teamLabel('red', '红队'),
      score: pitch?.redTeam?.score || 0,
      shots: stats.red?.shots || 0,
      passes: stats.red?.passes || 0,
      corners: stats.red?.corners || 0,
      playerCount: actorSnapshot?.ready
        ? mappedRedPlayers
        : redPlayers || pitch?.redTeam?.allPlayers?.length || pitch?.redTeam?.players?.length || 0,
      possession: totalPossession ? Math.round(redPossession / totalPossession * 100) : 50,
    },
    blue: {
      name: teamLabel('blue', '蓝队'),
      score: pitch?.blueTeam?.score || 0,
      shots: stats.blue?.shots || 0,
      passes: stats.blue?.passes || 0,
      corners: stats.blue?.corners || 0,
      playerCount: actorSnapshot?.ready
        ? mappedBluePlayers
        : bluePlayers || pitch?.blueTeam?.allPlayers?.length || pitch?.blueTeam?.players?.length || 0,
      possession: totalPossession ? Math.round(bluePossession / totalPossession * 100) : 50,
    },
  }
}

export function setRuntimeStoppageMinutes(half, minutes) {
  return Boolean(window.__happySeedSetStoppageMinutes?.({ half, minutes }))
}

// 平局进入加时赛（90-120，两段各 15 分钟），返回是否成功启动
export function startExtraTime() {
  return Boolean(window.__happySeedStartExtraTime?.())
}

export function setTeamTacticalStance(side, stance) {
  return Boolean(window.__happySeedSetTacticalStance?.(side, stance))
}

export function getTeamTacticalStance(side) {
  return window.__happySeedGetTacticalStance?.(side) || 'balanced'
}

export function subscribeToMatchEvents(listener) {
  const handlers = MATCH_EVENTS.map((eventName) => {
    const handler = (event) => listener({
      id: ++eventSequence,
      type: eventName,
      detail: event.detail,
      timestamp: Date.now(),
    })
    window.addEventListener(eventName, handler)
    return [eventName, handler]
  })

  return () => {
    handlers.forEach(([eventName, handler]) => {
      window.removeEventListener(eventName, handler)
    })
  }
}

export function subscribeToRuntimeMatchEvents(listener) {
  const handler = (nativeEvent) => {
    const event = createMatchRuntimeEvent(nativeEvent.detail || {})
    const validation = validateMatchRuntimeEventV1(event)
    if (!validation.valid) {
      console.error('[MatchRuntimeEventV1] invalid event', validation.errors, nativeEvent.detail)
      return
    }
    listener(event)
  }
  window.addEventListener('ab-runtime-match-event', handler)
  return () => window.removeEventListener('ab-runtime-match-event', handler)
}

export function applyRuntimeVarResult(event) {
  if (event?.type !== 'var-result') return false
  return Boolean(window.__happySeedApplyVarResult?.({
    id: event.id,
    sourceEventId: event.sourceEventId,
    scoringSide: event.detail?.scoringSide || event.side,
    outcome: event.detail?.outcome,
    reason: event.detail?.reason || null,
    penalty: event.detail?.penalty === true,
  }))
}

export function bootHappySeedMatch(options = {}) {
  // A previous React tree may have scheduled singleton cleanup during a route
  // transition (or StrictMode's development-only effect replay). Claim the
  // renderer before consulting bootPromise so a healthy in-flight Runtime can
  // never be left running behind a hidden canvas.
  retainMatchRuntime()
  if (bootPromise) {
    // A real match must not inherit the placeholder teams from an in-flight
    // home-screen warm-up. Wait for texture assembly, then reuse the loaded
    // Runtime through the normal restart path with the requested teams.
    if (runtimeSessionWarmPromise && !options.prewarmOnly) {
      return runtimeSessionWarmPromise.then(() => bootHappySeedMatch(options))
    }
    return bootPromise
  }

  bootPromise = (async () => {
    const restartingExistingRuntime = Boolean(window.__matchGame)
    if (restartingExistingRuntime) {
      try { window.__happySeedResetMatchLifecycle?.('react-boot') } catch {
        /* The standalone Runtime also repeats this reset before state.change. */
      }
      window.__matchGame.__happySeedTrainingActive = false
      window.__matchGame.__happySeedTrainingPlayerIndex = null
      window.__matchGame.__happySeedTrainingDefenderIndex = null
      try { window.__matchGame.resume() } catch { /* Runtime may still be loading. */ }
    }
    ensureRuntimeSettings()
    // 确保引擎 canvas 可见（上次卸载时可能被隐藏）
    const existingCanvas = window.__matchGame?.renderer?.view
    if (existingCanvas) existingCanvas.style.display = ''
    window.__happySeedInteractiveSpace = Boolean(__DOUYIN_BUILD__)
    window.__targetingMatchView = { ...CURRENT_VARIANT.matchView }
    window.__acPlay = Boolean(options.playerMode)
    window.__happySeedPlayerModeAssist = getPlayerModeDemoAssistProfile(options.playerMode)
    if (window.__happySeedPlayerModeAssist) {
      document.body.dataset.playerModePace = String(window.__happySeedPlayerModeAssist.speed)
    } else {
      delete document.body.dataset.playerModePace
    }
    let studioRecipe = null
    if (options.studioPreview) {
      try {
        studioRecipe = JSON.parse(window.sessionStorage.getItem('happyseed-player-studio-preview'))
      } catch {
        studioRecipe = null
      }
    }
    window.__happySeedHumanRecipes = studioRecipe
      ? [studioRecipe]
      : (options.humanRecipes || getHappySeedHumanRecipes())
    window.__happySeedHumanActions = HAPPYSEED_HUMAN_ACTIONS
    window.__happySeedPixelStadiumConfig = getHappySeedPixelStadiumContract()
    selectedTeams = {
      red: options.red || 'france',
      blue: options.blue || 'brazil',
    }
    runtimeActorConfig = await preloadHappySeedMatchAssets({
      ...options,
      ...selectedTeams,
    }, { onProgress: options.onProgress })
    representativeVisualEvents = buildRepresentativeMatchVisualEvents(runtimeActorConfig)
    matchVisualAuthorityState = createMatchVisualAuthorityState()
    matchVisualEventQueue = null
    coachDecisionVisualEvents = []
    formalDecisionEvents = []
    formalCompletedEventIds = []
    formalActiveEventId = null
    formalDecisionStatus = 'loading'
    formalAuthorityApplied = new Set()
    appliedDisciplineEventIds = new Set()
    formalPreparedDecisionScript = null
    naturalDecisionOpportunityState = {
      eligibleOwnerKey: null,
      resolved: false,
      attempts: 0,
      lastChance: null,
      lastMoment: null,
    }
    visualPresentationMode = options.technicalLab ? 'representative' : 'coach-decision-v3'
    coachDecisionPlanLength = FORMAL_COACH_RUNTIME_V2_SEQUENCE.length
    window.__happySeedRuntimeActorConfig = runtimeActorConfig
    window.__happySeedTechnicalLab = Boolean(options.technicalLab)
    window.__happySeedHumanSlicePreview = Boolean(options.humanSlicePreview)
    window.__happySeedStudioSoloPreview = Boolean(options.studioPreview)
    window.__happySeedStudioStillPreview = Boolean(options.studioStillPreview)
    window.__happySeedMatchRealtimeMinutes = Number(options.time) || 3
    if (options.technicalLab) {
      window.__happySeedMatchVisualEventConfig = {
        schemaVersion: 'match-visual-event-bridge-v1',
        events: representativeVisualEvents,
      }
    } else {
      delete window.__happySeedMatchVisualEventConfig
    }
    window.__matchFormations = options.formations || runtimeActorConfig.formations
    matchDurationMinutes = Number(options.time) || 3

    if (typeof window.__startStandaloneMatch !== 'function') {
      throw new Error('运行时已加载，但没有暴露 __startStandaloneMatch')
    }

    const started = waitForMatchStart(30000, restartingExistingRuntime)
    options.onProgress?.(96, '正在创建比赛现场')
    window.__startStandaloneMatch({
      red: selectedTeams.red,
      blue: selectedTeams.blue,
      stadium: options.stadium || 'international',
      ball: options.ball || 'classic_1',
      time: matchDurationMinutes,
      ai: options.ai ?? (options.playerMode ? 0 : 2),
      side: options.side || 'home',
    })
    if (options.prewarmOnly) {
      const warmCanvas = window.__matchGame?.renderer?.view
      if (warmCanvas) {
        warmCanvas.style.display = 'none'
        warmCanvas.setAttribute('aria-hidden', 'true')
      }
    }
    await started
    options.onProgress?.(99, '正在同步开球阵型')
    setSpeed(window.__happySeedPlayerModeAssist?.speed || 1)
    if (options.studioPreview) setZoom(2.4)
    else if (__DOUYIN_BUILD__ && !options.playerMode && !options.technicalLab) {
      setZoom(CURRENT_VARIANT.matchView.coachDefaultZoom)
    }
    if (!options.technicalLab) formalDecisionStatus = 'waiting-opportunity'
    window.addEventListener('ab-match-ended', () => {
      bootPromise = null
    }, { once: true })
    return getSnapshot()
  })().catch((error) => {
    bootPromise = null
    throw error
  })

  return bootPromise
}

/**
 * Assemble PIXI, stadium and the first kit textures while any edition is idle
 * on its home screen. This moves real initialization work; it never reports a
 * playable match until the Runtime's own start event fires.
 */
export function prewarmHappySeedRuntimeSession() {
  if (window.__matchGame?.__happySeedStandaloneLoaded) return Promise.resolve()
  if (runtimeSessionWarmPromise) return runtimeSessionWarmPromise

  runtimeSessionWarmPromise = bootHappySeedMatch({
    red: 'spain',
    blue: 'brazil',
    playerMode: true,
    ai: 0,
    time: 3,
    prewarmOnly: true,
  }).then(() => {
    shutdownMatchRuntime()
  }).finally(() => {
    runtimeSessionWarmPromise = null
  })

  return runtimeSessionWarmPromise
}

/**
 * 清除 bootPromise，允许下次 mount 时重新执行完整 boot 流程。
 * 用于比赛组件卸载后（如中途退出教练模式），防止旧 promise 阻塞新一轮启动。
 */
export function clearBootPromise() {
  bootPromise = null
}

function restoreMatchRuntimeCanvas() {
  const game = window.__matchGame
  const canvas = game?.renderer?.view
  if (!canvas) return false

  if (!canvas.isConnected) document.body.insertBefore(canvas, document.body.firstChild)
  canvas.style.removeProperty('display')
  canvas.style.removeProperty('opacity')
  canvas.removeAttribute('aria-hidden')
  return true
}

/**
 * Keep the singleton renderer alive for the current match screen.
 *
 * React StrictMode replays effects as mount -> cleanup -> mount in development.
 * The epoch makes the cleanup from that synthetic unmount cancellable, while
 * also covering an immediate real route transition into another Runtime view.
 */
export function retainMatchRuntime() {
  const epoch = ++runtimeShutdownEpoch
  restoreMatchRuntimeCanvas()

  window.requestAnimationFrame?.(() => {
    if (epoch !== runtimeShutdownEpoch) return
    restoreMatchRuntimeCanvas()
    try { window.__matchGame?.resize?.() } catch { /* Renderer may still be loading. */ }
  })
  return epoch
}

/**
 * Release after the current React commit. A same-commit remount can retain the
 * Runtime first, cancelling this release before the WebGL canvas is hidden.
 */
export function scheduleMatchRuntimeShutdown() {
  const epoch = ++runtimeShutdownEpoch
  queueMicrotask(() => {
    if (epoch === runtimeShutdownEpoch) shutdownMatchRuntime()
  })
  return epoch
}

/**
 * 关闭当前比赛运行时，释放引擎状态，允许下次重新 boot。
 * 用于训练基地退出时清理。
 */
export function shutdownMatchRuntime() {
  runtimeShutdownEpoch += 1
  bootPromise = null
  const game = window.__matchGame
  if (game) {
    try { window.__happySeedResetMatchLifecycle?.('react-shutdown') } catch {
      /* Continue hiding the renderer even when defensive cleanup reports an error. */
    }
    game.__happySeedTrainingActive = false
    game.__happySeedTrainingPlayerIndex = null
    game.__happySeedTrainingDefenderIndex = null
    if (game.pitch) {
      game.pitch.practice = false
    }
    for (const sprite of game.stadium?.players || []) {
      if (!sprite) continue
      sprite.visible = true
      sprite.alpha = 1
    }
    for (const entry of game.stadium?._happySeedActorEntries || []) {
      if (entry?.label) {
        entry.label.visible = true
        entry.label.alpha = 1
      }
    }
    try { game.pause() } catch { /* Runtime may already be stopped. */ }
    const canvas = game.renderer?.view
    if (canvas) canvas.style.display = 'none'
  }
  // 保留已经加载完成的引擎、纹理和数据缓存；下一局由
  // __startStandaloneMatch 直接切入一个全新的 StandaloneMatch 状态。
  // 不要再次调用单例 PIXI loader：它在 complete 后不会再次触发回调，
  // 旧实现因此永远停在退出时的最后一帧。
  if (window.__touchInput) {
    Object.assign(window.__touchInput, {
      active: false,
      vx: 0,
      vy: 0,
      shoot: false,
      sprint: false,
      pass: false,
      lob: false,
      switchPlayer: false,
      tackle: false,
    })
  }
  delete document.body.dataset.trainingRuntime
  delete document.body.dataset.trainingPitchPlayers
  delete document.body.dataset.trainingPitchState
  delete document.body.dataset.trainingPlayerControlled
  delete document.body.dataset.trainingPlayerPosition
  delete document.body.dataset.playerModePace
}

export function pauseMatch() {
  const game = getGame()
  if (!game) return false
  game.pause()
  return true
}

export function resumeMatch() {
  const game = getGame()
  if (!game) return false
  game.resume()
  return true
}

/**
 * 把已启动的正式比赛 Runtime 收敛为自由训练场。
 * 具体的球员移除和自由训练状态切换在 Runtime 内完成。
 */
export function configureTrainingRuntime(options = {}) {
  return window.__happySeedConfigureTraining?.(options) || null
}

export function setRuntimeGoalPresentationHold(active) {
  return Boolean(window.__happySeedSetGoalPresentationHold?.(Boolean(active)))
}

export function setSpeed(nextSpeed) {
  const game = getGame()
  const numericSpeed = Number(nextSpeed)
  if (!game || !Number.isFinite(numericSpeed)) return false
  speed = Math.min(3, Math.max(0.5, numericSpeed))
  game.timeScale = speed
  return true
}

export function setZoom(nextZoom) {
  if (!window.__matchZoom?.set) return false
  window.__matchZoom.set(nextZoom)
  return true
}

export function resetZoom() {
  window.__matchZoom?.reset?.()
}

export function setHumanSliceAction(actionId) {
  return Boolean(window.__happySeedHumanSlice?.setAction?.(actionId))
}

export function setHumanSliceProfile(profileId) {
  return Boolean(window.__happySeedHumanSlice?.setProfile?.(profileId))
}

export function setHumanSliceFacing(facing) {
  return Boolean(window.__happySeedHumanSlice?.setFacing?.(facing))
}

export function setHumanSliceAutoCycle(enabled) {
  return Boolean(window.__happySeedHumanSlice?.setAutoCycle?.(enabled))
}

export function setStadiumCameraPreset(presetId) {
  return Boolean(window.__happySeedStadiumScene?.setCameraPreset?.(presetId))
}

export function followStadiumBall() {
  return Boolean(window.__happySeedStadiumScene?.followBall?.())
}

export function panStadiumCamera(screenX, screenY) {
  return Boolean(window.__happySeedStadiumScene?.panBy?.(screenX, screenY))
}

export function resetStadiumCamera() {
  if (window.__happySeedStadiumScene?.resetCamera) {
    return Boolean(window.__happySeedStadiumScene.resetCamera())
  }
  resetZoom()
  return setStadiumCameraPreset('normal')
}

export function setStadiumCrowdMotion(enabled) {
  return Boolean(window.__happySeedStadiumScene?.setCrowdMotion?.(enabled))
}

function installLegacyShootoutPresentation() {
  const stadium = window.__matchGame?.stadium
  const entries = stadium?._happySeedActorEntries
  if (!stadium || !Array.isArray(entries) || entries.length === 0) return null
  if (stadium._happySeedLegacyShootoutPresentation) {
    return stadium._happySeedLegacyShootoutPresentation
  }

  const state = {
    active: false,
    attackingSide: 'red',
    shooterPlayerId: null,
    shadowVisibility: null,
    shadowChildVisibility: null,
  }

  const visibleEntries = () => {
    const shooter = entries.find((entry) => (
      entry?.actor?.side === state.attackingSide
      && String(entry.actor.playerId) === String(state.shooterPlayerId)
      && !entry.actor.isGoalkeeper
      && entry.actor.state?.onPitch !== false
    )) || entries.find((entry) => (
      entry?.actor?.side === state.attackingSide
      && !entry.actor.isGoalkeeper
      && entry.actor.state?.onPitch !== false
    ))
    const keeper = entries.find((entry) => (
      entry?.actor?.side !== state.attackingSide
      && entry.actor.isGoalkeeper
      && entry.actor.state?.onPitch !== false
    ))
    return new Set([shooter, keeper].filter(Boolean))
  }

  const enforce = () => {
    if (!state.active) return null
    const allowedEntries = visibleEntries()
    const allowedRenderers = new Set(
      [...allowedEntries].map((entry) => entry.renderer).filter(Boolean),
    )

    entries.forEach((entry) => {
      const visible = allowedEntries.has(entry)
      if (entry.renderer) entry.renderer.visible = visible
      if (entry.label) entry.label.visible = visible
      if (entry.eventRing) entry.eventRing.visible = false
    })
    // Some older Runtime builds keep a second list of player containers.
    // Applying the same allow-list there prevents a stale goalkeeper renderer.
    if (Array.isArray(stadium.players)) {
      stadium.players.forEach((renderer) => {
        if (renderer) renderer.visible = allowedRenderers.has(renderer)
      })
    }
    // Legacy Runtime renders every player's shadow into a separate batch,
    // so hiding the player container alone leaves 20 ghost shadows behind.
    // Runtime 的 autoShadows 并不保证按球员连续分组，按索引过滤会留下
    // 幽灵影子。点球大战只显示两名角色，直接关闭整个人物影子层最可靠。
    if (stadium.shadows) stadium.shadows.visible = false

    return {
      active: true,
      attackingSide: state.attackingSide,
      shooterPlayerId: state.shooterPlayerId,
      visibleCount: allowedEntries.size,
      goalSide: 'right',
      cameraMode: window.__happySeedStadiumScene?.getSnapshot?.().cameraMode || 'decision-director',
    }
  }

  const restore = () => {
    entries.forEach((entry) => {
      const visible = entry?.actor?.state?.onPitch !== false
      if (entry.renderer) entry.renderer.visible = visible
      if (entry.label) entry.label.visible = visible
      if (entry.eventRing) entry.eventRing.visible = false
    })
    if (stadium.shadows && state.shadowVisibility != null) {
      stadium.shadows.visible = state.shadowVisibility
    }
    const shadowChildren = stadium.shadows?.autoShadows?.children
    if (Array.isArray(shadowChildren) && state.shadowChildVisibility) {
      shadowChildren.forEach((shadow, index) => {
        if (shadow && state.shadowChildVisibility[index] != null) {
          shadow.visible = state.shadowChildVisibility[index]
        }
      })
    }
    state.active = false
    state.shooterPlayerId = null
    state.shadowVisibility = null
    state.shadowChildVisibility = null
    window.__happySeedReleaseShootoutActors?.()
    return true
  }

  const previousFrame = typeof stadium.frame === 'function' ? stadium.frame.bind(stadium) : null
  if (previousFrame) {
    stadium.frame = (frame) => {
      previousFrame(frame)
      enforce()
    }
  }

  const controller = {
    configure(payload = {}) {
      if (!state.active) {
        state.shadowVisibility = stadium.shadows ? stadium.shadows.visible !== false : null
        state.shadowChildVisibility = stadium.shadows?.autoShadows?.children
          ?.map((shadow) => shadow?.visible !== false) || null
      }
      state.active = true
      state.attackingSide = payload.attackingSide === 'blue' ? 'blue' : 'red'
      state.shooterPlayerId = payload.shooterPlayerId ?? null
      return enforce()
    },
    clear() {
      if (!state.active) return false
      return restore()
    },
    enforce,
  }
  stadium._happySeedLegacyShootoutPresentation = controller
  return controller
}

export function configureShootoutPresentation(payload) {
  const currentController = window.__happySeedShootoutPresentation
  // The plain Runtime script is not replaced by Vite HMR. Always attach the
  // compatibility controller as well so an already-open tab receives shadow
  // and actor cleanup without requiring a hard refresh. Camera, staging and
  // animation remain owned by the reused match_penalty DecisionDirector scene.
  const compatibilitySnapshot = installLegacyShootoutPresentation()?.configure(payload) || null
  // Configure native second: both controllers then save the original shadow
  // state in a deterministic order, and clear() can restore it correctly.
  const nativeSnapshot = currentController?.configure?.(payload) || null
  return nativeSnapshot || compatibilitySnapshot
}

export function clearShootoutPresentation() {
  const currentController = window.__happySeedShootoutPresentation
  const nativeCleared = Boolean(currentController?.clear?.())
  const compatibilityCleared = Boolean(
    window.__matchGame?.stadium?._happySeedLegacyShootoutPresentation?.clear?.(),
  )
  return nativeCleared || compatibilityCleared
}

export function selectRuntimeActor(runtimeActorId) {
  return Boolean(window.__happySeedRuntimeActors?.selectActor?.(runtimeActorId))
}

export function setRuntimeActorState(runtimeActorId, patch) {
  return Boolean(window.__happySeedRuntimeActors?.setActorState?.(runtimeActorId, patch))
}

export function applyRuntimeDisciplinaryCard(event) {
  if (event?.type !== 'card' || !event.id || !event.primaryRuntimeActorId) return event
  if (appliedDisciplineEventIds.has(event.id)) return event
  appliedDisciplineEventIds.add(event.id)
  const actor = getRuntimeActorSnapshot()?.actors?.find((candidate) => (
    candidate.runtimeActorId === event.primaryRuntimeActorId
  ))
  if (!actor || actor.state?.redCard) return event
  if (event.detail?.color === 'red') {
    setRuntimeActorState(event.primaryRuntimeActorId, { redCard: true })
    return event
  }
  const yellowCards = Math.min(2, Number(actor.state?.yellowCards || 0) + 1)
  const secondYellow = yellowCards >= 2
  setRuntimeActorState(event.primaryRuntimeActorId, {
    yellowCards,
    redCard: secondYellow,
  })
  return secondYellow
    ? {
      ...event,
      detail: {
        ...event.detail,
        color: 'red',
        secondYellow: true,
        dismissed: true,
      },
    }
    : event
}

export function substituteRuntimeActor(side, outPlayerId, inPlayerId) {
  return Boolean(window.__happySeedRuntimeActors?.substitute?.(
    side,
    outPlayerId,
    inPlayerId,
  ))
}

async function playVisualEventThroughRuntime(event, options = {}) {
  const runtimeBridge = window.__happySeedMatchVisualEvents
  if (!runtimeBridge?.play) throw new Error('MatchVisualEvent Runtime 桥尚未就绪')
  const result = await runtimeBridge.play(event)
  if (options.applyAuthority !== false) {
    matchVisualAuthorityState = applyMatchVisualEventAuthority(
      matchVisualAuthorityState,
      event,
    )
  }
  return result
}

export async function playMatchVisualEvent(eventId) {
  const event = representativeVisualEvents.find((candidate) => candidate.id === eventId)
  if (!event) throw new Error(`未知 MatchVisualEvent：${eventId}`)
  return playVisualEventThroughRuntime(event)
}

export function playRepresentativeMatchVisualEvents() {
  if (!matchVisualEventQueue) {
    matchVisualEventQueue = createMatchVisualEventQueue({
      playEvent: playVisualEventThroughRuntime,
    })
  }
  const completed = new Set(
    window.__happySeedMatchVisualEvents?.getSnapshot?.().completedEventIds || [],
  )
  matchVisualEventQueue.enqueue(
    representativeVisualEvents.filter((event) => !completed.has(event.id)),
  )
  return matchVisualEventQueue.drain()
}

export function resetRepresentativeMatchVisualEvents() {
  const reset = window.__happySeedMatchVisualEvents?.reset?.()
  if (!reset) return false
  matchVisualEventQueue = null
  matchVisualAuthorityState = createMatchVisualAuthorityState()
  coachDecisionVisualEvents = []
  visualPresentationMode = 'representative'
  coachDecisionPlanLength = FORMAL_COACH_DECISION_SEQUENCE.length
  return true
}

function registerCoachDecisionVisualEvent(event) {
  visualPresentationMode = 'coach-decision'
  if (!coachDecisionVisualEvents.some((candidate) => candidate.id === event.id)) {
    coachDecisionVisualEvents.push(event)
  }
  return event
}

export function createFormalCoachDecision(sequenceIndex, options = {}) {
  const schedule = options.technicalCatalog
    ? FORMAL_COACH_DECISION_CATALOG
    : FORMAL_COACH_RUNTIME_V2_SEQUENCE
  coachDecisionPlanLength = schedule.length
  const side = options.side === 'blue' ? 'blue' : 'red'
  const decision = buildFormalCoachDecision({
    actorSource: runtimeActorConfig,
    sequenceIndex,
    schedule,
    side,
    teamId: selectedTeams[side],
    opponentTeamId: selectedTeams[side === 'red' ? 'blue' : 'red'],
    scenarioId: options.scenarioId,
    minute: options.minute,
    label: options.label,
    preferredPlayerId: options.preferredPlayerId,
    authorityState: options.authorityState,
  })
  return decision && {
    ...decision,
    runtimeContext: options.runtimeContext || 'match',
  }
}

export function getConservativeFormalCoachChoice(decision) {
  const scenarioId = decision?.coachDecisionEvent?.sourceScenarioId
  const safeChoiceId = getFormalDecisionSceneContractV3(scenarioId)?.safeChoiceId
  return decision?.choices?.find((choice) => choice.id === safeChoiceId)
    || findConservativeFormalCoachChoice(decision)
}

function createFormalDecisionBroadcastEvent(decision, resolution = null) {
  const result = resolution?.result
  const scoreDelta = {
    red: 0,
    blue: 0,
  }
  return {
    id: `coach.${decision.coachDecisionEvent.sourceScenarioId}.${decision.sequenceNumber}`,
    sequence: decision.sequenceNumber,
    minute: decision.coachDecisionEvent.minute,
    type: decision.coachDecisionEvent.sourceScenarioId,
    label: decision.label,
    side: decision.side,
    actors: decision.coachDecisionEvent.keyPlayers,
    outcome: {
      id: result?.outcome || 'decision_pending',
      scoreDelta,
      statsDelta: resolution?.authorityDeltas?.statsDelta || {},
      opponentStatsDelta: resolution?.authorityDeltas?.opponentStatsDelta || {},
    },
    commentary: {
      prelude: decision.coachDecisionEvent.situation,
      result: resolution?.resultText || decision.coachDecisionEvent.situation,
      outcomeLabel: result?.outcome || '等待教练选择',
    },
    source: {
      sourceScenarioId: decision.coachDecisionEvent.sourceScenarioId,
      choiceId: resolution?.choice?.id || null,
    },
  }
}

function upsertFormalDecisionEvent(event) {
  const index = formalDecisionEvents.findIndex((candidate) => candidate.id === event.id)
  if (index >= 0) formalDecisionEvents[index] = event
  else formalDecisionEvents.push(event)
  return event
}

function getDevelopmentOutcomeOverride(decision, choiceId) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const outcome = new URLSearchParams(window.location.search).get('acceptanceOutcome')
  if (!outcome) return null
  const choice = decision.choices.find((candidate) => candidate.id === choiceId)
  if (!choice?.possible_outcomes?.includes(outcome)) return null
  return outcome
}

function applyFormalDecisionRuntimeEffect(effect, script) {
  if (effect === 'queue-corner-red' || effect === 'queue-corner-blue') {
    const side = effect.endsWith('blue') ? 'blue' : 'red'
    const applied = injectCorner(side)
    const result = { type: 'corner-restart', applied, side }
    window.dispatchEvent(new CustomEvent('ab-formal-decision-runtime-effect', { detail: result }))
    return result
  }
  if (effect !== 'auto-substitute-primary') return null
  const snapshot = getRuntimeActorSnapshot()
  const outgoingRuntimeActorId = script?.actors?.primary?.runtimeActorId
  const outgoing = snapshot?.actors?.find((actor) => (
    actor.runtimeActorId === outgoingRuntimeActorId && actor.side === 'red' && actor.state?.onPitch
  ))
  const bench = snapshot?.sides?.red?.bench || []
  if (!outgoing || !bench.length) {
    return { type: effect, applied: false, reason: 'no-eligible-player' }
  }
  const candidates = bench.filter((actor) => (
    actor.state?.status === 'bench'
    && (actor.naturalPosition === 'GK') === Boolean(outgoing.isGoalkeeper)
  ))
  const incoming = [...candidates].sort((left, right) => {
    const leftExact = left.naturalPosition === outgoing.assignedPosition
      || left.naturalPosition === outgoing.naturalPosition
    const rightExact = right.naturalPosition === outgoing.assignedPosition
      || right.naturalPosition === outgoing.naturalPosition
    if (leftExact !== rightExact) return leftExact ? -1 : 1
    return Number(right.state?.stamina || 0) - Number(left.state?.stamina || 0)
  })[0]
  if (!incoming || !substituteRuntimeActor('red', outgoing.playerId, incoming.playerId)) {
    return { type: effect, applied: false, reason: 'runtime-rejected' }
  }
  const result = {
    type: 'substitution',
    applied: true,
    outgoing: {
      playerId: outgoing.playerId,
      name: outgoing.name,
      number: outgoing.number,
    },
    incoming: {
      playerId: incoming.playerId,
      name: incoming.name,
      number: incoming.number,
    },
  }
  window.dispatchEvent(new CustomEvent('ab-formal-decision-runtime-effect', { detail: result }))
  return result
}

const DECISION_YELLOW_CARD_OUTCOMES = new Set([
  'yellow_card',
  'yellow_card_dissent',
  'yellow_card_dive',
  'yellow_card_penalty',
  'yellow_card_stop',
])

const DECISION_VAR_RESULT_CONTRACTS = Object.freeze({
  var_goal_review: Object.freeze({
    goal: ['valid', null],
    no_change: ['valid', null],
    yellow_card: ['valid', null],
    possession_kept: ['disallowed', 'attacking-foul'],
  }),
  var_offside_goal: Object.freeze({
    goal: ['valid', null],
    no_change: ['disallowed', 'offside'],
    shape_held: ['disallowed', 'offside'],
    yellow_card_dissent: ['disallowed', 'offside'],
  }),
  var_penalty_review: Object.freeze({
    penalty_awarded: ['penalty-awarded', null],
    play_continues: ['no-penalty', null],
    possession_maintained: ['no-penalty', null],
    yellow_card_dissent: ['no-penalty', null],
    shape_held: ['no-penalty', null],
    opponent_counter: ['no-penalty', null],
  }),
  handball_penalty_claim: Object.freeze({
    penalty_awarded: ['penalty-awarded', 'handball'],
    play_continues: ['no-penalty', null],
    possession_maintained: ['no-penalty', null],
    yellow_card_dissent: ['no-penalty', null],
  }),
  defensive_line_handball_var: Object.freeze({
    play_continues: ['no-penalty', null],
    shape_held: ['no-penalty', null],
    yellow_card_penalty: ['penalty-awarded', 'handball'],
    red_card_penalty: ['penalty-awarded', 'handball'],
  }),
})

function emitFormalDecisionRuntimeConsequences(script, choiceId, outcomeId) {
  const emit = window.__happySeedEmitRuntimeEvent
  const sourceEventId = script?.sourceEvent?.id
  if (typeof emit !== 'function' || !sourceEventId) return []
  const scenarioId = script.scenarioId
  const primary = script.actors?.primary
  const captain = script.actors?.captain || primary
  const opponent = script.actors?.opponent
  const events = []
  const push = (type, actor, payload = {}) => {
    const eventId = emit(type, actor?.runtimeActorId || null, {
      side: payload.side || actor?.side || 'red',
      sourceEventId: payload.sourceEventId || sourceEventId,
      detail: {
        decision: true,
        scenarioId,
        choiceId,
        outcome: outcomeId,
        ...payload.detail,
      },
    })
    if (eventId) events.push({ id: eventId, type })
  }

  const varContract = DECISION_VAR_RESULT_CONTRACTS[scenarioId]?.[outcomeId]
  if (varContract) {
    const [outcome, reason] = varContract
    const goalReview = ['var_goal_review', 'var_offside_goal'].includes(scenarioId)
    push('var-result', primary, {
      sourceEventId: goalReview ? script.sourceEvent.sourceEventId || sourceEventId : sourceEventId,
      detail: {
        reviewType: goalReview ? 'goal' : 'penalty',
        outcome,
        reason,
        scoringSide: script.sourceEvent.side || 'red',
      },
    })
  }

  if (['penalty_awarded', 'penalty_won', 'yellow_card_penalty', 'red_card_penalty'].includes(outcomeId)) {
    // `side` is the offending side; `awardedSide` owns the following kick.
    // Keeping those meanings distinct lets the staged penalty scene select
    // the correct taker instead of only narrating a penalty that never occurs.
    push('penalty', opponent || primary, { side: 'blue', detail: { awardedSide: 'red' } })
    // freeze-incident 模式下判罚点球：标记脚本禁止恢复比赛，
    // 否则冻结瞬间的射门会继续飞入球网导致进球+点球双重计算
    if (script.mode === 'freeze-incident') {
      script.__suppressResumeForPenalty = true
    }
  }
  if (DECISION_YELLOW_CARD_OUTCOMES.has(outcomeId)) {
    const bookedActor = outcomeId === 'yellow_card_dissent' ? captain : primary
    push('card', bookedActor, { detail: { color: 'yellow' } })
  }
  if (outcomeId === 'yellow_card_opponent') {
    push('card', opponent, { side: 'blue', detail: { color: 'yellow' } })
  }
  if (outcomeId === 'red_card_penalty') {
    push('card', primary, { detail: { color: 'red' } })
  }
  if (outcomeId === 'red_card_second_yellow') {
    push('card', primary, { detail: { color: 'yellow', secondYellow: true } })
  }
  if (['freekick_against', 'foul'].includes(outcomeId)) {
    push('foul', primary, { side: 'red', detail: { awardedSide: 'blue' } })
  }
  if (outcomeId === 'throw_violation') {
    push('throw-in-violation', primary, { side: 'red', detail: { awardedSide: 'blue' } })
  }
  if (outcomeId === 'offside' || outcomeId === 'offside_fail_solo') {
    push('offside', primary, { side: 'red' })
  }
  if (outcomeId === 'offside_success') {
    push('offside', opponent, { side: 'blue' })
  }
  return events
}

export async function prepareFormalCoachDecision(decision, runtimeMoment, sourceEvent = null) {
  const director = window.__happySeedDecisionDirectorV3
  if (!director?.prepare) throw new Error('DecisionDirectorV3 Runtime 尚未就绪')
  const script = buildFormalDecisionSceneScriptV3(
    decision,
    runtimeActorConfig,
    runtimeMoment,
    sourceEvent,
  )
  const validation = validateDecisionSceneScriptV3(script, decision)
  if (!validation.valid) {
    throw new Error(`DecisionSceneScriptV3 校验失败：${validation.errors.join(', ')}`)
  }
  visualPresentationMode = 'coach-decision-v3'
  formalDecisionStatus = 'staging'
  formalPreparedDecisionScript = script
  const event = upsertFormalDecisionEvent(createFormalDecisionBroadcastEvent(decision))
  formalActiveEventId = event.id
  const prepared = await director.prepare(script)
  if (prepared?.cancelled) {
    formalActiveEventId = null
    formalDecisionStatus = 'cancelled'
    formalPreparedDecisionScript = null
    throw Object.assign(
      new Error('决策准备被中断，已恢复比赛'),
      { recovered: true },
    )
  }
  formalDecisionStatus = 'choosing'
  return { decision, script, snapshot: getDecisionDirectorSnapshot() }
}

export function subscribeToRuntimeDecisionChoices(listener) {
  const handler = (event) => listener({
    choiceId: event.detail?.choiceId,
    scenarioId: event.detail?.scenarioId,
    snapshot: event.detail?.snapshot || getDecisionDirectorSnapshot(),
  })
  window.addEventListener('ab-decision-choice-selected', handler)
  return () => window.removeEventListener('ab-decision-choice-selected', handler)
}

export function setFormalCoachDecisionChoiceHover(choiceId, active) {
  window.dispatchEvent(new CustomEvent('ab-decision-choice-hover', {
    detail: { choiceId, active: Boolean(active) },
  }))
}

// 决策播放看门狗：导演任何环节卡死都不能拖住整场比赛，
// 超时后以 { recovered: true } 拒绝，调用方据此取消导演并恢复比赛
export const DECISION_PLAYBACK_TIMEOUT_MS = 12000
export function withDecisionWatchdog(promise) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(Object.assign(
        new Error('决策播放超时，已恢复原状继续比赛'),
        { recovered: true },
      ))
    }, DECISION_PLAYBACK_TIMEOUT_MS)
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value) },
      (error) => { window.clearTimeout(timer); reject(error) },
    )
  })
}

export function executeFormalCoachDecisionChoice(decision, choiceId, options = {}) {
  const director = window.__happySeedDecisionDirectorV3
  if (!director?.execute) throw new Error('DecisionDirectorV3 Runtime 尚未就绪')
  const requestedOutcome = options.outcomeOverride
  const outcomeOverride = requestedOutcome
    && decision?.choices?.find((choice) => choice.id === choiceId)
      ?.possible_outcomes?.includes(requestedOutcome)
    ? requestedOutcome
    : getDevelopmentOutcomeOverride(decision, choiceId)
  const ruleResolution = resolveFormalCoachDecisionRule(decision, choiceId, {
    outcomeOverride,
  })
  const scriptedOutcome = formalPreparedDecisionScript?.choices
    ?.find((choice) => choice.id === choiceId)
    ?.outcomes?.[ruleResolution.result.outcome]
  const resolution = {
    ...ruleResolution,
    resultText: scriptedOutcome?.feedbackMode === 'rule-result'
      ? ruleResolution.resultText
      : scriptedOutcome?.commentaryText || ruleResolution.resultText,
    requiresRuntimeGoal: Boolean(scriptedOutcome?.requiresRuntimeGoal),
    executionTerminal: scriptedOutcome?.terminal || null,
  }
  const event = upsertFormalDecisionEvent(
    createFormalDecisionBroadcastEvent(decision, resolution),
  )
  formalActiveEventId = event.id
  formalDecisionStatus = 'executing'
  const execution = director.execute({
    choiceId,
    outcome: resolution.result.outcome,
  })

  const settled = execution.settled.then((runtimeResult) => {
    if (runtimeResult?.cancelled) {
      throw Object.assign(
        new Error('决策播放被中断，已恢复比赛'),
        { recovered: true },
      )
    }
    const runtimeEffect = applyFormalDecisionRuntimeEffect(
      scriptedOutcome?.runtimeEffect,
      formalPreparedDecisionScript,
    )
    if (runtimeEffect) {
      resolution.runtimeEffect = runtimeEffect
      if (runtimeEffect.type === 'substitution') {
        resolution.resultText = runtimeEffect.applied
          ? `换人完成：${runtimeEffect.incoming.number}号${runtimeEffect.incoming.name}替下${runtimeEffect.outgoing.number}号${runtimeEffect.outgoing.name}。${resolution.resultText}`
          : `换人指令未能执行：当前替补席没有符合位置资格的球员。${resolution.resultText}`
      } else if (runtimeEffect.type === 'corner-restart') {
        resolution.resultText = runtimeEffect.applied
          ? `${runtimeEffect.side === 'red' ? '本方' : '对方'}获得角球，比赛将从对应角旗区继续。${resolution.resultText}`
          : `角球重开未能进入 Runtime 状态。${resolution.resultText}`
      }
    }
    resolution.runtimeConsequences = emitFormalDecisionRuntimeConsequences(
      formalPreparedDecisionScript,
      choiceId,
      resolution.result.outcome,
    )
    upsertFormalDecisionEvent(createFormalDecisionBroadcastEvent(decision, resolution))
    if (!formalAuthorityApplied.has(event.id)) {
      matchVisualAuthorityState = applyMatchVisualEventAuthority(
        matchVisualAuthorityState,
        event,
      )
      formalAuthorityApplied.add(event.id)
      if (!formalCompletedEventIds.includes(event.id)) formalCompletedEventIds.push(event.id)
    }
    formalActiveEventId = null
    formalDecisionStatus = 'settled'
    if (
      options.commitRuntimeGoal !== false
      && resolution.requiresRuntimeGoal
      && typeof execution.commitGoal === 'function'
    ) {
      window.setTimeout(() => {
        const committed = execution.commitGoal()
        if (!committed) {
          console.error('[DecisionDirectorV3] 足球未到达有效门线终点，拒绝提交进球')
        }
      }, 0)
    }
    return { resolution, runtime: runtimeResult, event }
  })

  const completed = execution.completed.then((runtimeResult) => {
    formalDecisionStatus = runtimeResult.cancelled ? 'cancelled' : 'completed'
    formalPreparedDecisionScript = null
    return { resolution, runtime: runtimeResult, event }
  })

  return { resolution, settled, completed }
}

export function cancelFormalCoachDecision() {
  const director = window.__happySeedDecisionDirectorV3
  const cancelled = Boolean(director?.cancel?.())
  const recovered = cancelled ? true : Boolean(director?.recover?.())
  if (cancelled || recovered) {
    formalActiveEventId = null
    formalDecisionStatus = 'cancelled'
    formalPreparedDecisionScript = null
  }
  return cancelled || recovered
}

export async function playFormalCoachDecisionPrelude(decision) {
  const event = registerCoachDecisionVisualEvent(
    createFormalCoachDecisionPreludeVisualEvent(decision, runtimeActorConfig),
  )
  await playVisualEventThroughRuntime(event, { applyAuthority: false })
  return event
}

export async function resolveAndPlayFormalCoachDecision(decision, choiceId) {
  const resolution = resolveFormalCoachDecision(
    decision,
    choiceId,
    runtimeActorConfig,
  )
  registerCoachDecisionVisualEvent(resolution.visualEvent)
  await playVisualEventThroughRuntime(resolution.visualEvent)
  return resolution
}

export function updatePlayerInput(patch) {
  if (!window.__touchInput) return false
  Object.assign(window.__touchInput, patch, { active: true })
  return true
}

export function releasePlayerInput() {
  if (!window.__touchInput) return
  Object.assign(window.__touchInput, {
    active: true,
    vx: 0,
    vy: 0,
    shoot: false,
    sprint: false,
    pass: false,
    lob: false,
    switchPlayer: false,
    tackle: false,
  })
}

export function injectCorner(teamSide = 'red') {
  const pitch = getPitch()
  if (!pitch || typeof window.require !== 'function') return false

  try {
    const { Pitch } = window.require('pitch')
    const point2 = window.require('core/math/point2')
    const team = teamSide === 'blue' ? pitch.blueTeam : pitch.redTeam
    const attackingRight = team === pitch.redTeam
    const position = point2.create(
      attackingRight ? pitch.width - 0.1 : 0.1,
      pitch.random?.boolean?.() ? 0.1 : pitch.height - 0.1,
    )

    pitch.states
      .change(Pitch.states.BallOutOfPlay, 0.15)
      .queue(Pitch.states.Corner, position, team)
    return true
  } catch (error) {
    console.error('[happyseed-adapter] 角球注入失败', error)
    return false
  }
}
