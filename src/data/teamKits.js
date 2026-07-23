// 对手队球衣：只给主场色，away 复用主场色（对手恒穿主场色）
function opponentKit(names, shirt, accent, shorts, socks) {
  const shortColor = shorts || shirt
  const sockColor = socks || shirt
  return {
    names,
    shirt,
    accent,
    shorts: shortColor,
    socks: sockColor,
    goalkeeper: '#52A447',
    away: { shirt, accent, shorts: shortColor, socks: sockColor, goalkeeper: '#D6A51F' },
  }
}

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
  spain: {
    names: ['西班牙'],
    shirt: '#C60B1E',
    accent: '#F5D742',
    shorts: '#174FBC',
    socks: '#C60B1E',
    goalkeeper: '#52A447',
    away: { shirt: '#F4F0E8', accent: '#C60B1E', shorts: '#F4F0E8', socks: '#F4F0E8', goalkeeper: '#D6A51F' },
  },
  england: {
    names: ['英格兰'],
    shirt: '#F4F0E8',
    accent: '#C8313D',
    shorts: '#263B78',
    socks: '#F4F0E8',
    goalkeeper: '#52A447',
    away: { shirt: '#C8313D', accent: '#F4F0E8', shorts: '#F4F0E8', socks: '#C8313D', goalkeeper: '#D6A51F' },
  },
  usa: {
    names: ['美国'],
    shirt: '#F4F0E8',
    accent: '#3C3B6E',
    shorts: '#3C3B6E',
    socks: '#B34235',
    goalkeeper: '#52A447',
    away: { shirt: '#3C3B6E', accent: '#F4F0E8', shorts: '#F4F0E8', socks: '#3C3B6E', goalkeeper: '#D6A51F' },
  },
  canada: {
    names: ['加拿大'],
    shirt: '#D52B1E',
    accent: '#F4F0E8',
    shorts: '#F4F0E8',
    socks: '#D52B1E',
    goalkeeper: '#52A447',
    away: { shirt: '#F4F0E8', accent: '#D52B1E', shorts: '#D52B1E', socks: '#F4F0E8', goalkeeper: '#D6A51F' },
  },
  mexico: {
    names: ['墨西哥'],
    shirt: '#006847',
    accent: '#F4F0E8',
    shorts: '#F4F0E8',
    socks: '#006847',
    goalkeeper: '#D6A51F',
    away: { shirt: '#F4F0E8', accent: '#006847', shorts: '#006847', socks: '#F4F0E8', goalkeeper: '#52A447' },
  },
  colombia: {
    names: ['哥伦比亚'],
    shirt: '#FCD116',
    accent: '#003893',
    shorts: '#003893',
    socks: '#C8313D',
    goalkeeper: '#52A447',
    away: { shirt: '#003893', accent: '#FCD116', shorts: '#F4F0E8', socks: '#003893', goalkeeper: '#D6A51F' },
  },
  capeverde: {
    names: ['佛得角'],
    shirt: '#003893',
    accent: '#F5D742',
    shorts: '#F4F0E8',
    socks: '#003893',
    goalkeeper: '#D6A51F',
    away: { shirt: '#F4F0E8', accent: '#003893', shorts: '#003893', socks: '#F4F0E8', goalkeeper: '#52A447' },
  },
  // ===== 32 支对手国家队（主场色）=====
  southafrica: opponentKit(['南非'], '#FFB612', '#007A4D', '#007A4D', '#FFB612'),
  southkorea: opponentKit(['韩国'], '#C60C30', '#F4F0E8'),
  czech: opponentKit(['捷克'], '#D7141A', '#F4F0E8'),
  bosnia: opponentKit(['波黑'], '#002395', '#F5D742'),
  qatar: opponentKit(['卡塔尔'], '#8A1538', '#F4F0E8'),
  switzerland: opponentKit(['瑞士'], '#FF0000', '#F4F0E8'),
  haiti: opponentKit(['海地'], '#00209F', '#C60C30'),
  scotland: opponentKit(['苏格兰'], '#003399', '#F4F0E8'),
  paraguay: opponentKit(['巴拉圭'], '#D52B1E', '#F4F0E8'),
  australia: opponentKit(['澳大利亚'], '#FFCD00', '#00843D', '#FFCD00', '#FFCD00'),
  turkey: opponentKit(['土耳其'], '#E30A17', '#F4F0E8'),
  ivorycoast: opponentKit(['科特迪瓦'], '#F77F00', '#009A44'),
  ecuador: opponentKit(['厄瓜多尔'], '#FFD100', '#0033A0', '#0033A0', '#FFD100'),
  netherlands: opponentKit(['荷兰'], '#FF6600', '#F4F0E8'),
  sweden: opponentKit(['瑞典'], '#006AA7', '#F5D742'),
  tunisia: opponentKit(['突尼斯'], '#E70013', '#F4F0E8'),
  belgium: opponentKit(['比利时'], '#D20F1A', '#F5D742'),
  egypt: opponentKit(['埃及'], '#CE1126', '#F4F0E8'),
  iran: opponentKit(['伊朗'], '#239F40', '#F4F0E8'),
  saudi: opponentKit(['沙特'], '#006C35', '#F4F0E8'),
  uruguay: opponentKit(['乌拉圭'], '#75AADB', '#F4F0E8'),
  senegal: opponentKit(['塞内加尔'], '#00853F', '#F5D742'),
  iraq: opponentKit(['伊拉克'], '#007A3D', '#F4F0E8'),
  algeria: opponentKit(['阿尔及利亚'], '#006233', '#F4F0E8'),
  austria: opponentKit(['奥地利'], '#EF3340', '#F4F0E8'),
  jordan: opponentKit(['约旦'], '#CE1126', '#F4F0E8'),
  congo: opponentKit(['民主刚果'], '#007FFF', '#F5D742'),
  uzbekistan: opponentKit(['乌兹别克斯坦'], '#0099B5', '#F4F0E8'),
  croatia: opponentKit(['克罗地亚'], '#FF0000', '#F4F0E8'),
  panama: opponentKit(['巴拿马'], '#D21034', '#F4F0E8'),
  ghana: opponentKit(['加纳'], '#CE1126', '#F5D742', '#006B3F', '#CE1126'),
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
