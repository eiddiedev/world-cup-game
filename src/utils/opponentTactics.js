import { FORMATION_TACTICS } from '../data/formationTactics.js'
import { TEAM_SCHEDULES } from '../data/schedules.js'
import {
  getTeamDefaultFormation,
  hasTeamDefaultFormation,
} from '../data/teamFormations.js'

const TEAM_FORMATIONS = {
  法国: '4-2-3-1',
  巴西: '4-3-3',
  阿根廷: '4-3-2-1',
  葡萄牙: '4-3-3',
  德国: '4-2-3-1',
  日本: '4-1-4-1',
  挪威: '4-4-1-1',
  摩洛哥: '5-3-2',
  新西兰: '5-3-2',
  库拉索: '4-4-2',
  伊拉克: '4-4-2',
  塞内加尔: '4-3-3',
  海地: '5-3-2',
  苏格兰: '3-5-2',
  约旦: '5-3-2',
  奥地利: '4-2-3-1',
  阿尔及利亚: '4-3-3',
  刚果民主共和国: '4-4-2',
  乌兹别克斯坦: '4-1-4-1',
  哥伦比亚: '4-2-3-1',
  科特迪瓦: '4-3-3',
  厄瓜多尔: '4-3-3',
  荷兰: '4-3-3',
  突尼斯: '5-3-2',
  瑞典: '4-4-2',
  埃及: '4-2-3-1',
  伊朗: '4-4-2',
  比利时: '3-4-3',
  西班牙: '4-3-3',
  英格兰: '4-2-3-1',
  克罗地亚: '4-3-2-1',
  乌拉圭: '4-4-2',
  墨西哥: '4-3-3',
  美国: '4-3-3',
  瑞士: '3-4-3',
  韩国: '4-2-3-1',
  澳大利亚: '4-4-2',
  土耳其: '4-2-3-1',
  加拿大: '3-5-2',
  南非: '4-3-3',
  卡塔尔: '5-3-2',
  巴拉圭: '4-4-2',
}

const ROLE_NAMES = {
  GK: ['门线守护者'],
  DF: ['左路铁闸', '盯人中卫', '制空中卫', '右路铁闸', '防线清道夫'],
  MF: ['防守屏障', '节拍器', '推进核心', '左路引擎', '右路引擎'],
  FW: ['左翼突击手', '禁区终结者', '右翼突击手'],
}

const ROLE_NUMBERS = {
  GK: [1],
  DF: [3, 4, 5, 2, 15],
  MF: [6, 8, 10, 14, 18],
  FW: [11, 9, 7],
}

const STRENGTH_BASE = {
  weak: 66,
  medium: 75,
  strong: 84,
}

function hashSeed(value) {
  return String(value).split('').reduce((seed, char) => ((seed * 31) + char.charCodeAt(0)) >>> 0, 2166136261)
}

function seededOffset(seed, index, spread = 9) {
  const mixed = Math.sin((seed + index * 97) * 12.9898) * 43758.5453
  return Math.floor((mixed - Math.floor(mixed)) * spread) - Math.floor(spread / 2)
}

function clamp(value, min = 45, max = 94) {
  return Math.min(max, Math.max(min, value))
}

function getFormation(teamName) {
  if (hasTeamDefaultFormation(teamName)) return getTeamDefaultFormation(teamName)
  if (TEAM_FORMATIONS[teamName]) return TEAM_FORMATIONS[teamName]
  const formations = Object.keys(FORMATION_TACTICS)
  return formations[hashSeed(teamName) % formations.length]
}

function getPositionScore(player, assignedPosition) {
  if (assignedPosition === 'GK') return (player.def || 60) * 0.55 + (player.phy || 60) * 0.25 + (player.rating || 60) * 0.20
  if (assignedPosition === 'DF') return (player.def || 60) * 0.48 + (player.phy || 60) * 0.20 + (player.rating || 60) * 0.32
  if (assignedPosition === 'MF') return (player.tec || 60) * 0.34 + (player.sta || 60) * 0.18 + (player.rating || 60) * 0.48
  return (player.tec || 60) * 0.30 + (player.spd || 60) * 0.22 + (player.rating || 60) * 0.48
}

function selectBestEleven(players, formation) {
  const counts = FORMATION_TACTICS[formation]?.counts || FORMATION_TACTICS['4-3-3'].counts
  const selectedIds = new Set()
  const lineup = []

  Object.entries(counts).forEach(([position, count]) => {
    const candidates = [...players]
      .filter(player => (player.position || player.pos) === position && !selectedIds.has(player.id))
      .sort((a, b) => getPositionScore(b, position) - getPositionScore(a, position))
    candidates.slice(0, count).forEach(player => {
      selectedIds.add(player.id)
      lineup.push({ ...player, assignedPosition: position, pos: position })
    })
  })

  if (lineup.length < 11) {
    [...players]
      .filter(player => !selectedIds.has(player.id))
      .sort((a, b) => (b.rating || 60) - (a.rating || 60))
      .slice(0, 11 - lineup.length)
      .forEach(player => lineup.push({ ...player, assignedPosition: player.position || player.pos, pos: player.position || player.pos }))
  }

  return lineup.slice(0, 11)
}

function buildGeneratedLineup(teamName, formation, strength) {
  const seed = hashSeed(`${teamName}-${strength}`)
  const base = STRENGTH_BASE[strength] || STRENGTH_BASE.medium
  const counts = FORMATION_TACTICS[formation]?.counts || FORMATION_TACTICS['4-3-3'].counts
  let playerIndex = 0

  return Object.entries(counts).flatMap(([position, count]) => (
    Array.from({ length: count }, (_, roleIndex) => {
      const rating = clamp(base + seededOffset(seed, playerIndex, 9), 55, 91)
      const roleName = ROLE_NAMES[position][roleIndex] || `${position}轮换`
      const number = ROLE_NUMBERS[position][roleIndex] || 20 + playerIndex
      const positionBoost = position === 'GK'
        ? { spd: -12, phy: 5, tec: -4, def: 10 }
        : position === 'DF'
          ? { spd: 0, phy: 5, tec: -4, def: 9 }
          : position === 'MF'
            ? { spd: 1, phy: 0, tec: 7, def: 1 }
            : { spd: 7, phy: 2, tec: 6, def: -16 }
      const player = {
        id: `opponent-${hashSeed(teamName)}-${position}-${roleIndex}`,
        name: roleName,
        teamName,
        position,
        assignedPosition: position,
        pos: position,
        number,
        rating,
        spd: clamp(rating + positionBoost.spd + seededOffset(seed, playerIndex + 11, 7)),
        phy: clamp(rating + positionBoost.phy + seededOffset(seed, playerIndex + 17, 7)),
        tec: clamp(rating + positionBoost.tec + seededOffset(seed, playerIndex + 23, 7)),
        def: clamp(rating + positionBoost.def + seededOffset(seed, playerIndex + 29, 7)),
        sta: clamp(rating + 4 + seededOffset(seed, playerIndex + 31, 7)),
        star: rating >= 87 ? 4 : rating >= 79 ? 3 : rating >= 70 ? 2 : 1,
        form: 80,
        description: `${teamName}固定战术阵容中的${roleName}。`,
        isGolden: false,
      }
      playerIndex += 1
      return player
    })
  ))
}

export function getOpponentMatchSetup(teamName, teamData, opponentStrength = 'medium') {
  const formation = getFormation(teamName)
  const lineup = teamData?.players?.length
    ? selectBestEleven(teamData.players, formation)
    : buildGeneratedLineup(teamName, formation, opponentStrength)
  return {
    teamName,
    formation,
    lineup,
    tactics: FORMATION_TACTICS[formation],
  }
}

export function resolveOpponentStrength(teamId, opponentName, teamData) {
  const scheduledMatch = TEAM_SCHEDULES[teamId]?.groupStage?.find(
    match => match.opponent === opponentName,
  )

  if (scheduledMatch?.opponentStrength) return scheduledMatch.opponentStrength

  const difficulty = teamData?.difficulty
  if (difficulty != null) {
    if (difficulty <= 2) return 'strong'
    if (difficulty >= 5) return 'weak'
  }

  return 'medium'
}
