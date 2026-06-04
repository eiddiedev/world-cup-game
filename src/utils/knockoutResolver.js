export const KNOCKOUT_CANDIDATES = [
  '西班牙', '英格兰', '荷兰', '比利时', '克罗地亚', '乌拉圭', '墨西哥', '美国',
  '瑞士', '哥伦比亚', '厄瓜多尔', '科特迪瓦', '塞内加尔', '奥地利', '瑞典', '埃及',
  '伊朗', '韩国', '澳大利亚', '土耳其', '加拿大', '南非', '卡塔尔', '巴拉圭',
]

const ROUND_KEYS = ['r16', 'qf', 'sf', 'final']

function hashSeed(input) {
  return String(input).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

export function getFallbackKnockoutOpponents({ teamId, teamName, group, playerRank }) {
  const seed = hashSeed(`${teamId}-${teamName}-${group}-${playerRank}`)
  const excluded = new Set([teamName])
  const pool = KNOCKOUT_CANDIDATES.filter(name => !excluded.has(name))
  const offset = seed % pool.length
  return ROUND_KEYS.reduce((acc, key, index) => {
    acc[key] = pool[(offset + index * 5) % pool.length]
    return acc
  }, {})
}

export function sanitizeKnockoutOpponents(raw, fallback, teamName) {
  const blocked = new Set(['待定', 'A组第2', 'A组第1', teamName, '', undefined, null])
  return ROUND_KEYS.reduce((acc, key) => {
    const candidate = raw?.[key]
    acc[key] = blocked.has(candidate) ? fallback[key] : candidate
    return acc
  }, {})
}
