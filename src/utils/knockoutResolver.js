/**
 * 淘汰赛对手解析器
 * 模拟全部 48 队小组赛 + 32 强淘汰赛 bracket，
 * 根据玩家所在小组及排名，推演出每一轮的对手。
 */

// ─── 48 队分组（2026 世界杯真实分组） ────────────────────────────────────────
const GROUPS = {
  A: ['墨西哥', '南非', '韩国', '捷克'],
  B: ['加拿大', '波黑', '卡塔尔', '瑞士'],
  C: ['巴西', '摩洛哥', '海地', '苏格兰'],
  D: ['美国', '巴拉圭', '澳大利亚', '土耳其'],
  E: ['德国', '库拉索', '科特迪瓦', '厄瓜多尔'],
  F: ['日本', '荷兰', '突尼斯', '瑞典'],
  G: ['新西兰', '埃及', '伊朗', '比利时'],
  H: ['西班牙', '佛得角', '沙特', '乌拉圭'],
  I: ['法国', '伊拉克', '塞内加尔', '挪威'],
  J: ['阿根廷', '约旦', '奥地利', '阿尔及利亚'],
  K: ['葡萄牙', '刚果民主共和国', '乌兹别克斯坦', '哥伦比亚'],
  L: ['英格兰', '克罗地亚', '巴拿马', '加纳'],
}

// ─── 球队实力评分（0-100） ────────────────────────────────────────────────────
const STRENGTH = {
  // 顶级
  '西班牙': 96, '法国': 95, '巴西': 93, '阿根廷': 92, '英格兰': 91, '葡萄牙': 90,
  // 强队
  '德国': 88, '荷兰': 87, '比利时': 86, '日本': 85, '克罗地亚': 84, '哥伦比亚': 83,
  '乌拉圭': 82, '摩洛哥': 81, '挪威': 80, '美国': 79, '瑞士': 78, '墨西哥': 77,
  // 中等
  '塞内加尔': 76, '韩国': 75, '澳大利亚': 74, '土耳其': 73, '埃及': 72, '瑞典': 71,
  '奥地利': 70, '加拿大': 69, '厄瓜多尔': 68, '科特迪瓦': 67, '巴拉圭': 66, '突尼斯': 65,
  '阿尔及利亚': 64, '苏格兰': 63, '捷克': 62, '波黑': 61, '加纳': 60, '伊朗': 59,
  // 较弱
  '新西兰': 57, '库拉索': 55, '佛得角': 54, '沙特': 53, '卡塔尔': 52, '巴拿马': 51,
  '伊拉克': 50, '约旦': 48, '乌兹别克斯坦': 47, '刚果民主共和国': 46, '海地': 44,
  '南非': 43,
}

const GROUP_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function makeRng(seed) {
  let s = Math.abs(seed | 0) || 1
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5
    return ((s >>> 0) % 10000) / 10000
  }
}

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return h
}

/** 模拟单场比赛，返回胜者名（平局随机决出） */
function simMatch(nameA, nameB, rng) {
  const sA = STRENGTH[nameA] ?? 50
  const sB = STRENGTH[nameB] ?? 50
  const diff = sA - sB
  const pA = 1 / (1 + Math.exp(-diff / 18))
  const r = rng()
  if (r < pA * 0.72) return nameA        // A 常规胜
  if (r < pA * 0.72 + (1 - pA) * 0.72) return nameB  // B 常规胜
  return rng() < pA ? nameA : nameB      // 平局随机
}

/** 模拟一组小组赛，返回按积分排序的 4 队数组 [{name, pts, gd}] */
function simGroup(teams, rng) {
  const stats = Object.fromEntries(teams.map(t => [t, { name: t, pts: 0, gd: 0 }]))
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const winner = simMatch(teams[i], teams[j], rng)
      const gA = 1 + Math.floor(rng() * 3)
      const gB = 1 + Math.floor(rng() * 3)
      if (winner === teams[i]) {
        stats[teams[i]].pts += 3
        stats[teams[i]].gd += gA
        stats[teams[j]].gd -= gA
      } else if (winner === teams[j]) {
        stats[teams[j]].pts += 3
        stats[teams[j]].gd += gB
        stats[teams[i]].gd -= gB
      } else {
        stats[teams[i]].pts += 1
        stats[teams[j]].pts += 1
      }
    }
  }
  return Object.values(stats).sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.gd - a.gd)
}

// ─── 主函数 ───────────────────────────────────────────────────────────────────

export function getFallbackKnockoutOpponents({ teamId, teamName, group, playerRank }) {
  const validRank = (playerRank >= 1 && playerRank <= 3) ? playerRank : 1
  const seed = hashStr(`${teamId}-${group}-bracket-v2`)
  const rng = makeRng(seed)

  // 1. 模拟所有小组赛
  const groupResults = {}   // { A: [{name,pts,gd},...], ... }
  for (const g of GROUP_ORDER) {
    groupResults[g] = simGroup(GROUPS[g], rng)
  }

  // 2. 覆盖玩家所在小组：强制玩家排名 = validRank
  if (group && groupResults[group]) {
    const gr = groupResults[group]
    const pIdx = gr.findIndex(t => t.name === teamName)
    if (pIdx !== -1 && pIdx !== validRank - 1) {
      const [p] = gr.splice(pIdx, 1)
      gr.splice(validRank - 1, 0, p)
    }
  }

  // 3. 收集 32 队种子列表
  //    种子 1-12  = 各组第 1 名
  //    种子 13-24 = 各组第 2 名
  //    种子 25-32 = 8 个积分最高的第 3 名
  const firsts  = GROUP_ORDER.map(g => groupResults[g][0])
  const seconds = GROUP_ORDER.map(g => groupResults[g][1])
  const thirds  = GROUP_ORDER.map(g => groupResults[g][2])
    .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.gd - a.gd)
    .slice(0, 8)

  const seeds32 = [...firsts, ...seconds, ...thirds]  // length = 32

  // 4. 找到玩家在种子列表中的位置（0-based）
  const playerSeedIdx = seeds32.findIndex(t => t.name === teamName)
  if (playerSeedIdx === -1) {
    // 玩家未出线（第 3 名且积分不够），返回空
    return { r32: '待定', r16: '待定', qf: '待定', sf: '待定', final: '待定' }
  }

  // 5. 模拟整个 bracket，追踪玩家路径
  function simRound(pairs, currentSeeds) {
    return pairs.map(([iA, iB]) => {
      const nA = currentSeeds[iA]?.name
      const nB = currentSeeds[iB]?.name
      if (!nA) return iB
      if (!nB) return iA
      const winner = simMatch(nA, nB, rng)
      return winner === nA ? iA : iB
    })
  }

  // 找到玩家在当前轮次中的 pair index
  function findPlayerPairIdx(playerIdx, pairs) {
    return pairs.findIndex(([a, b]) => a === playerIdx || b === playerIdx)
  }

  // 玩家对手 = 同一 pair 中的另一个 seed
  function getPairOpponent(playerIdx, pairs, currentSeeds) {
    const pair = pairs.find(([a, b]) => a === playerIdx || b === playerIdx)
    if (!pair) return null
    const oppIdx = pair[0] === playerIdx ? pair[1] : pair[0]
    return currentSeeds[oppIdx]?.name || null
  }

  const opponents = {}
  let currentSeeds = seeds32.map(s => ({ ...s }))  // 可变副本
  let currentPlayerIdx = playerSeedIdx
  const roundKeys = ['r32', 'r16', 'qf', 'sf', 'final']

  for (let round = 0; round < 5; round++) {
    const n = currentSeeds.length
    const pairs = Array.from({ length: n / 2 }, (_, i) => [i, n - 1 - i])

    // 记录玩家本轮对手
    const oppName = getPairOpponent(currentPlayerIdx, pairs, currentSeeds)
    opponents[roundKeys[round]] = oppName || '待定'

    // 模拟本轮所有比赛
    const winners = simRound(pairs, currentSeeds)

    // 玩家强制晋级：覆盖 winners 中玩家所在 pair 的结果
    const playerPairIdx = findPlayerPairIdx(currentPlayerIdx, pairs)
    if (playerPairIdx === -1) break
    winners[playerPairIdx] = currentPlayerIdx

    // 下一轮种子列表
    const nextSeeds = winners.map(wIdx => currentSeeds[wIdx])
    currentPlayerIdx = playerPairIdx  // 玩家在下一轮的 index = pairIdx
    currentSeeds = nextSeeds

    if (currentSeeds.length <= 1) break
  }

  return opponents
}

export function sanitizeKnockoutOpponents(raw, fallback, teamName) {
  const blocked = new Set(['待定', 'A组第2', 'A组第1', teamName, '', undefined, null])
  const roundKeys = ['r32', 'r16', 'qf', 'sf', 'final']
  return roundKeys.reduce((acc, key) => {
    const candidate = raw?.[key]
    acc[key] = blocked.has(candidate) ? fallback[key] : candidate
    return acc
  }, {})
}

// 保留旧导出名，兼容现有 import
export const KNOCKOUT_CANDIDATES = []
