import { getTeamById } from '../data/teams.js'
import { getTeamTacticalProfile } from '../data/teamFormations.js'
import { createNewRun } from './saveManager.js'
import { autoSetupPlayerRun, refreshPlayerLineup } from './playerModeSetup.js'

export const MINI_CUP_TEAM_IDS = Object.freeze(['spain', 'france', 'argentina', 'england'])

export const MINI_CUP_SEMIFINALS = Object.freeze([
  Object.freeze(['france', 'spain']),
  Object.freeze(['argentina', 'england']),
])

export const MINI_CUP_STRENGTH = Object.freeze({
  spain: 98,
  france: 97,
  argentina: 93,
  england: 92,
})

export const MINI_CUP_FORMATIONS = Object.freeze([
  '4-3-3',
  '4-2-3-1',
  '4-4-2',
  '3-5-2',
  '5-3-2',
])

export const MINI_CUP_SUPPORTS = Object.freeze([
  Object.freeze({
    id: 'analytics',
    name: '数据中心建议',
    icon: '/assets/后勤/数据分析中心.png',
    summary: '识别对手弱点，首发状态提升。',
    detail: '全队状态 +4，并解锁完整对手情报。',
    logisticsLevels: Object.freeze({ analytics: 3, scouting: 2 }),
    stateBonus: Object.freeze({ form: 4 }),
  }),
  Object.freeze({
    id: 'energy',
    name: '能量补给道具',
    icon: '/assets/后勤/营养团队.png',
    summary: '开局抢节奏，延缓连续作战疲劳。',
    detail: '全队开场体力 +8，赛后恢复得到加强。',
    logisticsLevels: Object.freeze({ nutrition: 3, medical: 2 }),
    stateBonus: Object.freeze({}),
  }),
  Object.freeze({
    id: 'psychology',
    name: '心理团队建议',
    icon: '/assets/后勤/心理团队.png',
    summary: '稳定淘汰赛心态，强化点球表现。',
    detail: '开场士气提升，点球稳定性 +25%。',
    logisticsLevels: Object.freeze({ psychology: 3 }),
    stateBonus: Object.freeze({}),
  }),
])

function stableHash(value = '') {
  return [...String(value)].reduce(
    (hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0,
    2166136261,
  )
}

function seededRoll(seed) {
  let state = stableHash(seed) || 1
  state = (state * 1664525 + 1013904223) >>> 0
  return state / 4294967296
}

export function getMiniCupSemifinal(teamId) {
  return MINI_CUP_SEMIFINALS.find((pair) => pair.includes(teamId)) || MINI_CUP_SEMIFINALS[0]
}

export function getMiniCupSemifinalOpponent(teamId) {
  const semifinal = getMiniCupSemifinal(teamId)
  return semifinal.find((id) => id !== teamId) || semifinal[1]
}

export function getOtherMiniCupSemifinal(teamId) {
  const own = getMiniCupSemifinal(teamId)
  return MINI_CUP_SEMIFINALS.find((pair) => pair !== own) || MINI_CUP_SEMIFINALS[1]
}

export function simulateMiniCupSemifinal(pair, seed) {
  const [homeId, awayId] = pair
  const homeStrength = MINI_CUP_STRENGTH[homeId] || 80
  const awayStrength = MINI_CUP_STRENGTH[awayId] || 80
  const homeChance = Math.max(0.32, Math.min(0.68, 0.5 + (homeStrength - awayStrength) * 0.018))
  return seededRoll(`${seed}:${homeId}:${awayId}`) < homeChance ? homeId : awayId
}

export function createMiniCupState(teamId, seed = Date.now()) {
  const ownSemifinal = getMiniCupSemifinal(teamId)
  const otherSemifinal = getOtherMiniCupSemifinal(teamId)
  return {
    schemaVersion: 'targeting-mini-cup-v1',
    seed,
    round: 'sf',
    status: 'preparing',
    ownSemifinal: [...ownSemifinal],
    otherSemifinal: [...otherSemifinal],
    otherSemifinalWinner: simulateMiniCupSemifinal(otherSemifinal, seed),
    selectedSupport: null,
    completedRounds: [],
  }
}

export function getMiniCupOpponentId(run) {
  if (run?.miniCup?.round === 'final') return run.miniCup.otherSemifinalWinner
  return getMiniCupSemifinalOpponent(run?.teamId)
}

export function createMiniCupRun(teamId, gameMode = 'coach', saveData = null, seed = Date.now()) {
  const baseRun = createNewRun(teamId, gameMode, saveData)
  const run = gameMode === 'player'
    ? autoSetupPlayerRun(baseRun, saveData)
    : baseRun
  const miniCup = createMiniCupState(teamId, seed)
  return {
    ...run,
    stage: gameMode === 'player' ? 'match' : 'recruitment',
    matchIndex: 0,
    knockoutRound: 'sf',
    isKnockoutMatch: gameMode === 'player',
    currentOpponent: getMiniCupSemifinalOpponent(teamId),
    logisticsLevels: run.logisticsLevels || {},
    miniCup,
  }
}

export function prepareMiniCupMatch(run, { formation, supportId }) {
  const support = MINI_CUP_SUPPORTS.find((candidate) => candidate.id === supportId)
  const refreshed = refreshPlayerLineup({ ...run, formation })
  return {
    ...refreshed,
    formation,
    currentOpponent: getMiniCupOpponentId(run),
    logisticsLevels: { ...(support?.logisticsLevels || {}) },
    stage: 'match',
    isKnockoutMatch: true,
    miniCup: {
      ...run.miniCup,
      status: 'playing',
      selectedSupport: support?.id || null,
    },
  }
}

export function buildMiniCupPlayerStates(run) {
  const support = MINI_CUP_SUPPORTS.find((candidate) => (
    candidate.id === run?.miniCup?.selectedSupport
  ))
  const stateBonus = support?.stateBonus || {}
  const roster = run?.roster || run?.purchasedPlayerIds || []
  return Object.fromEntries(roster.map((player) => {
    const previous = run?.playerMatchStates?.[player.id] || {}
    return [player.id, {
      ...previous,
      form: Math.min(99, Number(previous.form ?? player.form ?? 70) + Number(stateBonus.form || 0)),
    }]
  }))
}

export function advanceMiniCupAfterMatch(run) {
  if (!run?.miniCup) return run
  const result = run.lastMatchResult?.result
  const round = run.miniCup.round

  if (result !== 'win') {
    return {
      ...run,
      stage: 'ending',
      isKnockoutMatch: false,
      miniCup: {
        ...run.miniCup,
        status: 'eliminated',
        completedRounds: [...run.miniCup.completedRounds, round],
      },
    }
  }

  if (round === 'sf') {
    return {
      ...run,
      stage: 'lineup',
      matchIndex: 1,
      knockoutRound: 'final',
      isKnockoutMatch: false,
      currentOpponent: run.miniCup.otherSemifinalWinner,
      miniCup: {
        ...run.miniCup,
        round: 'final',
        status: 'preparing',
        selectedSupport: null,
        completedRounds: [...run.miniCup.completedRounds, 'sf'],
      },
    }
  }

  return {
    ...run,
    stage: 'ending',
    isKnockoutMatch: false,
    miniCup: {
      ...run.miniCup,
      status: 'champion',
      completedRounds: [...run.miniCup.completedRounds, 'final'],
    },
  }
}

export function getMiniCupIntel(opponentId) {
  const team = getTeamById(opponentId)
  const profile = getTeamTacticalProfile(opponentId)
  return {
    team,
    formation: profile.formation,
    styleTags: profile.styleTags,
    gameModel: profile.gameModel,
    strength: MINI_CUP_STRENGTH[opponentId] || 80,
  }
}
