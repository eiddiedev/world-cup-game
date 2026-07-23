import { prepareTeamPlayers } from './playerBalance.js'

/**
 * 32 支对手国家队（非 playable）。
 * 比赛中作为蓝队渲染：穿自己的主场色，使用程序化生成的简易阵容。
 * baseRating 分档：强 ~80 / 中 ~74 / 弱 ~68。
 */
const OPPONENT_DEFS = [
  // A 组
  { id: 'southafrica', name: '南非', group: 'A', budget: 1500, baseRating: 68, formation: '4-3-3' },
  { id: 'southkorea', name: '韩国', group: 'A', budget: 1650, baseRating: 74, formation: '4-3-3' },
  { id: 'czech', name: '捷克', group: 'A', budget: 1600, baseRating: 74, formation: '4-4-2' },
  // B 组
  { id: 'bosnia', name: '波黑', group: 'B', budget: 1550, baseRating: 74, formation: '4-3-3' },
  { id: 'qatar', name: '卡塔尔', group: 'B', budget: 1400, baseRating: 68, formation: '5-3-2' },
  { id: 'switzerland', name: '瑞士', group: 'B', budget: 1700, baseRating: 74, formation: '4-3-3' },
  // C 组
  { id: 'haiti', name: '海地', group: 'C', budget: 1300, baseRating: 68, formation: '5-3-2' },
  { id: 'scotland', name: '苏格兰', group: 'C', budget: 1550, baseRating: 74, formation: '4-4-2' },
  // D 组
  { id: 'paraguay', name: '巴拉圭', group: 'D', budget: 1500, baseRating: 74, formation: '4-4-2' },
  { id: 'australia', name: '澳大利亚', group: 'D', budget: 1600, baseRating: 74, formation: '4-3-3' },
  { id: 'turkey', name: '土耳其', group: 'D', budget: 1650, baseRating: 74, formation: '4-3-3' },
  // E 组
  { id: 'ivorycoast', name: '科特迪瓦', group: 'E', budget: 1550, baseRating: 74, formation: '4-3-3' },
  { id: 'ecuador', name: '厄瓜多尔', group: 'E', budget: 1550, baseRating: 74, formation: '4-4-2' },
  // F 组
  { id: 'netherlands', name: '荷兰', group: 'F', budget: 1900, baseRating: 80, formation: '4-3-3' },
  { id: 'sweden', name: '瑞典', group: 'F', budget: 1650, baseRating: 74, formation: '4-4-2' },
  { id: 'tunisia', name: '突尼斯', group: 'F', budget: 1450, baseRating: 68, formation: '5-3-2' },
  // G 组
  { id: 'belgium', name: '比利时', group: 'G', budget: 1850, baseRating: 80, formation: '4-3-3' },
  { id: 'egypt', name: '埃及', group: 'G', budget: 1550, baseRating: 74, formation: '4-3-3' },
  { id: 'iran', name: '伊朗', group: 'G', budget: 1500, baseRating: 74, formation: '4-4-2' },
  { id: 'newzealand', name: '新西兰', group: 'G', budget: 1300, baseRating: 68, formation: '5-3-2' },
  // H 组
  { id: 'saudi', name: '沙特', group: 'H', budget: 1450, baseRating: 68, formation: '4-3-3' },
  { id: 'uruguay', name: '乌拉圭', group: 'H', budget: 1850, baseRating: 80, formation: '4-3-3' },
  // I 组
  { id: 'senegal', name: '塞内加尔', group: 'I', budget: 1650, baseRating: 74, formation: '4-3-3' },
  { id: 'iraq', name: '伊拉克', group: 'I', budget: 1400, baseRating: 68, formation: '5-3-2' },
  // J 组
  { id: 'algeria', name: '阿尔及利亚', group: 'J', budget: 1500, baseRating: 74, formation: '4-3-3' },
  { id: 'austria', name: '奥地利', group: 'J', budget: 1600, baseRating: 74, formation: '4-3-3' },
  { id: 'jordan', name: '约旦', group: 'J', budget: 1350, baseRating: 68, formation: '5-3-2' },
  // K 组
  { id: 'congo', name: '民主刚果', group: 'K', budget: 1450, baseRating: 68, formation: '4-4-2' },
  { id: 'uzbekistan', name: '乌兹别克斯坦', group: 'K', budget: 1400, baseRating: 68, formation: '4-4-2' },
  // L 组
  { id: 'croatia', name: '克罗地亚', group: 'L', budget: 1800, baseRating: 80, formation: '4-3-3' },
  { id: 'panama', name: '巴拿马', group: 'L', budget: 1400, baseRating: 68, formation: '5-3-2' },
  { id: 'ghana', name: '加纳', group: 'L', budget: 1500, baseRating: 74, formation: '4-3-3' },
]

const POSITION_NAMES = {
  GK: ['主力门将', '替补门将'],
  DF: ['主力中卫', '边路后卫', '盯人中卫', '出球后卫', '左后卫', '右后卫', '轮换后卫'],
  MF: ['主力后腰', '组织核心', '跑动中场', '前腰', '边前卫', '拦截中场', '轮换中场'],
  FW: ['主力中锋', '速度边锋', '影锋', '左边锋', '右边锋', '支点前锋', '轮换前锋'],
}

const POSITION_COUNTS = { GK: 2, DF: 7, MF: 7, FW: 7 }

// 各位置五维相对 baseRating 的偏移
const POSITION_BIAS = {
  GK: { spd: -15, phy: 2, tec: -10, def: 8, sta: 0 },
  DF: { spd: -3, phy: 3, tec: -5, def: 6, sta: 0 },
  MF: { spd: 0, phy: 0, tec: 4, def: -2, sta: 2 },
  FW: { spd: 4, phy: 0, tec: 3, def: -12, sta: 0 },
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

// 基于球队 id 的确定性伪随机，保证同一队每次生成结果一致
function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function hashString(value) {
  return [...String(value)].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7)
}

function generateOpponentRoster(teamId, baseRating) {
  const rand = seededRandom(hashString(teamId))
  const players = []
  const numbers = { GK: [1, 12], DF: [2, 3, 4, 5, 13, 15, 22], MF: [6, 7, 8, 10, 14, 16, 20], FW: [9, 11, 17, 18, 19, 21, 23] }

  for (const position of ['GK', 'DF', 'MF', 'FW']) {
    const bias = POSITION_BIAS[position]
    for (let index = 0; index < POSITION_COUNTS[position]; index += 1) {
      const jitter = () => Math.floor(rand() * 7) - 3
      const rating = clamp(baseRating + jitter() - (index > 2 ? 4 : 0), 55, 92)
      const name = POSITION_NAMES[position][index]
      players.push({
        id: `${teamId}_op_${position.toLowerCase()}_${String(index + 1).padStart(2, '0')}`,
        name,
        referenceName: '',
        position,
        cardTier: '普',
        isGolden: false,
        number: numbers[position][index],
        spd: clamp(baseRating + bias.spd + jitter(), 40, 95),
        phy: clamp(baseRating + bias.phy + jitter(), 40, 95),
        tec: clamp(baseRating + bias.tec + jitter(), 40, 95),
        def: clamp(baseRating + bias.def + jitter(), 30, 95),
        sta: clamp(baseRating + bias.sta + jitter(), 60, 95),
        star: rating >= baseRating + 2 ? 4 : rating >= baseRating - 4 ? 3 : 2,
        price: Math.max(28, Math.round(30 + (rating - 55) * 3.2)),
        description: '对手国家队球员',
        height: `${position === 'GK' ? 188 : position === 'DF' ? 184 : position === 'MF' ? 179 : 181}cm`,
        weight: `${position === 'GK' ? 82 : position === 'DF' ? 78 : position === 'MF' ? 73 : 75}kg`,
        age: 24 + Math.floor(rand() * 8),
        avatar: '/assets/player-placeholder.png',
      })
    }
  }
  return players
}

export const opponentTeams = OPPONENT_DEFS.map((def) => ({
  ...def,
  defaultFormation: def.formation,
  styleTags: ['均衡'],
  players: prepareTeamPlayers(generateOpponentRoster(def.id, def.baseRating), def.id, def.budget),
}))

export function getOpponentTeamById(teamIdOrName) {
  return opponentTeams.find((team) => team.id === teamIdOrName || team.name === teamIdOrName) || null
}
