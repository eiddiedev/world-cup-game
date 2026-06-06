const BASE_KITS = {
  france: {
    names: ['法国'],
    shirt: '#1F4AA8',
    accent: '#D9E5FF',
    shorts: '#F4F0E8',
    socks: '#B34235',
    goalkeeper: '#D6A51F',
    away: { shirt: '#F4F0E8', accent: '#1F4AA8', shorts: '#1F4AA8', socks: '#F4F0E8', goalkeeper: '#52A447' },
  },
  brazil: {
    names: ['巴西'],
    shirt: '#F5D742',
    accent: '#2D8A4E',
    shorts: '#174FBC',
    socks: '#F4F0E8',
    goalkeeper: '#111111',
    away: { shirt: '#174FBC', accent: '#F4F0E8', shorts: '#F4F0E8', socks: '#174FBC', goalkeeper: '#52A447' },
  },
  argentina: {
    names: ['阿根廷'],
    shirt: '#72C8F0',
    accent: '#F4F0E8',
    shorts: '#F4F0E8',
    socks: '#72C8F0',
    goalkeeper: '#52A447',
    away: { shirt: '#263B78', accent: '#72C8F0', shorts: '#263B78', socks: '#263B78', goalkeeper: '#D6A51F' },
  },
  portugal: {
    names: ['葡萄牙'],
    shirt: '#B51D2A',
    accent: '#2D8A4E',
    shorts: '#174F3A',
    socks: '#B51D2A',
    goalkeeper: '#D6A51F',
    away: { shirt: '#F4F0E8', accent: '#B51D2A', shorts: '#F4F0E8', socks: '#F4F0E8', goalkeeper: '#52A447' },
  },
  germany: {
    names: ['德国'],
    shirt: '#F4F0E8',
    accent: '#111111',
    shorts: '#111111',
    socks: '#F4F0E8',
    goalkeeper: '#52A447',
    away: { shirt: '#B34235', accent: '#111111', shorts: '#B34235', socks: '#B34235', goalkeeper: '#D6A51F' },
  },
  japan: {
    names: ['日本'],
    shirt: '#174FBC',
    accent: '#F4F0E8',
    shorts: '#174FBC',
    socks: '#174FBC',
    goalkeeper: '#D6A51F',
    away: { shirt: '#F4F0E8', accent: '#174FBC', shorts: '#F4F0E8', socks: '#F4F0E8', goalkeeper: '#52A447' },
  },
  norway: {
    names: ['挪威'],
    shirt: '#C8313D',
    accent: '#F4F0E8',
    shorts: '#263B78',
    socks: '#C8313D',
    goalkeeper: '#52A447',
    away: { shirt: '#F4F0E8', accent: '#C8313D', shorts: '#F4F0E8', socks: '#F4F0E8', goalkeeper: '#D6A51F' },
  },
  morocco: {
    names: ['摩洛哥'],
    shirt: '#8B1D32',
    accent: '#2D8A4E',
    shorts: '#8B1D32',
    socks: '#8B1D32',
    goalkeeper: '#D6A51F',
    away: { shirt: '#F4F0E8', accent: '#2D8A4E', shorts: '#F4F0E8', socks: '#F4F0E8', goalkeeper: '#52A447' },
  },
  newzealand: {
    names: ['新西兰'],
    shirt: '#F4F0E8',
    accent: '#111111',
    shorts: '#F4F0E8',
    socks: '#F4F0E8',
    goalkeeper: '#D6A51F',
    away: { shirt: '#111111', accent: '#F4F0E8', shorts: '#111111', socks: '#111111', goalkeeper: '#52A447' },
  },
  curacao: {
    names: ['库拉索'],
    shirt: '#1267B4',
    accent: '#F5D742',
    shorts: '#1267B4',
    socks: '#1267B4',
    goalkeeper: '#D6A51F',
    away: { shirt: '#F5D742', accent: '#1267B4', shorts: '#F5D742', socks: '#F5D742', goalkeeper: '#52A447' },
  },
}

const NAME_TO_ID = Object.entries(BASE_KITS).reduce((map, [id, kit]) => {
  map[id] = id
  kit.names.forEach(name => { map[name] = id })
  return map
}, {})

const FALLBACK_PALETTES = [
  ['#B34235', '#F4F0E8', '#263B78'],
  ['#2D8A4E', '#F5D742', '#F4F0E8'],
  ['#F4F0E8', '#263B78', '#B34235'],
  ['#D6A51F', '#263B78', '#F4F0E8'],
  ['#6E4A8E', '#F4F0E8', '#111111'],
]

function hashName(value = '') {
  return [...String(value)].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7)
}

function fallbackKit(teamIdOrName) {
  const palette = FALLBACK_PALETTES[hashName(teamIdOrName) % FALLBACK_PALETTES.length]
  return {
    shirt: palette[0],
    accent: palette[1],
    shorts: palette[2],
    socks: palette[0],
    goalkeeper: '#52A447',
    away: {
      shirt: palette[1],
      accent: palette[0],
      shorts: palette[1],
      socks: palette[1],
      goalkeeper: '#D6A51F',
    },
  }
}

export function getTeamKit(teamIdOrName) {
  const id = NAME_TO_ID[teamIdOrName]
  return BASE_KITS[id] || fallbackKit(teamIdOrName)
}

function colorDistance(first, second) {
  const parse = value => [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16))
  const [r1, g1, b1] = parse(first)
  const [r2, g2, b2] = parse(second)
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

export function getMatchKits(homeTeam, awayTeam) {
  const home = getTeamKit(homeTeam)
  const awayBase = getTeamKit(awayTeam)
  const away = colorDistance(home.shirt, awayBase.shirt) < 110
    ? awayBase.away
    : awayBase
  return { home, away }
}

export const PLAYABLE_TEAM_KITS = BASE_KITS
