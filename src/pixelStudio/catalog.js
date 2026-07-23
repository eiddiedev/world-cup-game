const sequence = (prefix, count, label) => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${String(index + 1).padStart(2, '0')}`,
  label: `${label} ${String(index + 1).padStart(2, '0')}`,
  variant: index,
}))

export const STUDIO_TEAMS = Object.freeze([
  {
    id: 'spain', name: '西班牙', code: 'ESP', numberStyleId: 'spain-2026',
    kits: [
      ['home', '主场', '#C9152B', '#F2C84B', '#25366D', '#C9152B', 'shoulder'],
      ['away', '客场', '#C8E7EB', '#C9152B', '#C8E7EB', '#C8E7EB', 'wave'],
      ['goalkeeper', '门将', '#5BCB55', '#102E21', '#5BCB55', '#5BCB55', 'keeper'],
      ['away-goalkeeper', '备用门将', '#171A20', '#F2C84B', '#171A20', '#171A20', 'keeper'],
    ],
  },
  {
    id: 'argentina', name: '阿根廷', code: 'ARG', numberStyleId: 'argentina-2026',
    kits: [
      ['home', '主场', '#F4F0E8', '#6AC7EE', '#111820', '#F4F0E8', 'vertical'],
      ['away', '客场', '#263B78', '#6AC7EE', '#263B78', '#263B78', 'sash'],
      ['goalkeeper', '门将', '#4EC168', '#17212B', '#4EC168', '#4EC168', 'keeper'],
      ['away-goalkeeper', '备用门将', '#E49D36', '#17212B', '#E49D36', '#E49D36', 'keeper'],
    ],
  },
  {
    id: 'france', name: '法国', code: 'FRA', numberStyleId: 'france-2026',
    kits: [
      ['home', '主场', '#173F82', '#D7A542', '#F4F0E8', '#B3283A', 'pinstripe'],
      ['away', '客场', '#F4F0E8', '#173F82', '#173F82', '#F4F0E8', 'gradient-stripe'],
      ['goalkeeper', '门将', '#D1A21F', '#14262D', '#D1A21F', '#D1A21F', 'keeper'],
      ['away-goalkeeper', '备用门将', '#43A15D', '#F4F0E8', '#43A15D', '#43A15D', 'keeper'],
    ],
  },
  {
    id: 'england', name: '英格兰', code: 'ENG', numberStyleId: 'england-2026',
    kits: [
      ['home', '主场', '#F7F4EA', '#273B75', '#273B75', '#F7F4EA', 'collar'],
      ['away', '客场', '#A93248', '#F1C8D0', '#A93248', '#A93248', 'cross'],
      ['goalkeeper', '门将', '#E6D23A', '#1C2830', '#E6D23A', '#E6D23A', 'keeper'],
      ['away-goalkeeper', '备用门将', '#1B1E22', '#D8E2E7', '#1B1E22', '#1B1E22', 'keeper'],
    ],
  },
  {
    id: 'brazil', name: '巴西', code: 'BRA', numberStyleId: 'brazil-2026',
    kits: [
      ['home', '主场', '#F2D53D', '#2C914F', '#164BAE', '#F4F0E8', 'collar'],
      ['away', '客场', '#174FBC', '#F2D53D', '#F4F0E8', '#174FBC', 'star-field'],
      ['goalkeeper', '门将', '#151A20', '#F4F0E8', '#151A20', '#151A20', 'keeper'],
      ['away-goalkeeper', '备用门将', '#4AB164', '#12221A', '#4AB164', '#4AB164', 'keeper'],
    ],
  },
  {
    id: 'portugal', name: '葡萄牙', code: 'POR', numberStyleId: 'portugal-2026',
    kits: [
      ['home', '主场', '#B91F31', '#2C804A', '#174C39', '#B91F31', 'split'],
      ['away', '客场', '#F3EFE5', '#B91F31', '#F3EFE5', '#F3EFE5', 'cross'],
      ['goalkeeper', '门将', '#D4A520', '#202A34', '#D4A520', '#D4A520', 'keeper'],
      ['away-goalkeeper', '备用门将', '#4EA45B', '#F3EFE5', '#4EA45B', '#4EA45B', 'keeper'],
    ],
  },
  {
    id: 'germany', name: '德国', code: 'GER', numberStyleId: 'germany-2026',
    kits: [
      ['home', '主场', '#F4F0E8', '#111111', '#111111', '#F4F0E8', 'tricolor'],
      ['away', '客场', '#1B6B62', '#D8C86A', '#1B6B62', '#1B6B62', 'geometric'],
      ['goalkeeper', '门将', '#55A85B', '#11211A', '#55A85B', '#55A85B', 'keeper'],
      ['away-goalkeeper', '备用门将', '#9C3141', '#F4F0E8', '#9C3141', '#9C3141', 'keeper'],
    ],
  },
  {
    id: 'japan', name: '日本', code: 'JPN', numberStyleId: 'japan-2026',
    kits: [
      ['home', '主场', '#153E9D', '#F4F0E8', '#153E9D', '#153E9D', 'origami'],
      ['away', '客场', '#F4F0E8', '#E75B7A', '#F4F0E8', '#F4F0E8', 'mist'],
      ['goalkeeper', '门将', '#D0A720', '#19242B', '#D0A720', '#D0A720', 'keeper'],
      ['away-goalkeeper', '备用门将', '#39A768', '#F4F0E8', '#39A768', '#39A768', 'keeper'],
    ],
  },
  {
    id: 'morocco', name: '摩洛哥', code: 'MAR', numberStyleId: 'morocco-2026',
    kits: [
      ['home', '主场', '#A91F35', '#2C8A4B', '#A91F35', '#A91F35', 'chest-band'],
      ['away', '客场', '#F4F0E8', '#2C8A4B', '#F4F0E8', '#F4F0E8', 'mosaic'],
      ['goalkeeper', '门将', '#D6A51F', '#202A34', '#D6A51F', '#D6A51F', 'keeper'],
      ['away-goalkeeper', '备用门将', '#33383D', '#F4F0E8', '#33383D', '#33383D', 'keeper'],
    ],
  },
  {
    id: 'norway', name: '挪威', code: 'NOR', numberStyleId: 'norway-2026',
    kits: [
      ['home', '主场', '#C5263B', '#F4F0E8', '#213A74', '#C5263B', 'flag-cross'],
      ['away', '客场', '#15181D', '#C5263B', '#15181D', '#15181D', 'mountain'],
      ['goalkeeper', '门将', '#53A65C', '#17212B', '#53A65C', '#53A65C', 'keeper'],
      ['away-goalkeeper', '备用门将', '#5D87C5', '#F4F0E8', '#5D87C5', '#5D87C5', 'keeper'],
    ],
  },
  {
    id: 'colombia', name: '哥伦比亚', code: 'COL', numberStyleId: 'colombia-2026',
    kits: [
      ['home', '主场', '#F3D444', '#1D4EA4', '#1D4EA4', '#F3D444', 'sash'],
      ['away', '客场', '#22252B', '#E37F32', '#22252B', '#22252B', 'geometric'],
      ['goalkeeper', '门将', '#5EB861', '#15231A', '#5EB861', '#5EB861', 'keeper'],
      ['away-goalkeeper', '备用门将', '#D06383', '#F4F0E8', '#D06383', '#D06383', 'keeper'],
    ],
  },
  {
    id: 'usa', name: '美国', code: 'USA', numberStyleId: 'usa-2026',
    kits: [
      ['home', '主场', '#F4F0E8', '#C9273D', '#25366D', '#F4F0E8', 'horizontal'],
      ['away', '客场', '#25366D', '#C9273D', '#25366D', '#25366D', 'stars'],
      ['goalkeeper', '门将', '#E2C837', '#19242B', '#E2C837', '#E2C837', 'keeper'],
      ['away-goalkeeper', '备用门将', '#4AB15C', '#17212B', '#4AB15C', '#4AB15C', 'keeper'],
    ],
  },
  {
    id: 'canada', name: '加拿大', code: 'CAN', numberStyleId: 'canada-2026',
    kits: [
      ['home', '主场', '#C82137', '#F4F0E8', '#C82137', '#C82137', 'leaf'],
      ['away', '客场', '#F4F0E8', '#C82137', '#F4F0E8', '#F4F0E8', 'leaf'],
      ['goalkeeper', '门将', '#4EB45D', '#17212B', '#4EB45D', '#4EB45D', 'keeper'],
      ['away-goalkeeper', '备用门将', '#171A20', '#F4F0E8', '#171A20', '#171A20', 'keeper'],
    ],
  },
  {
    id: 'mexico', name: '墨西哥', code: 'MEX', numberStyleId: 'mexico-2026',
    kits: [
      ['home', '主场', '#17633E', '#E4C75A', '#F4F0E8', '#B32737', 'aztec'],
      ['away', '客场', '#171A20', '#D4A83A', '#171A20', '#171A20', 'aztec'],
      ['goalkeeper', '门将', '#E19B37', '#17212B', '#E19B37', '#E19B37', 'keeper'],
      ['away-goalkeeper', '备用门将', '#6A3E85', '#F4F0E8', '#6A3E85', '#6A3E85', 'keeper'],
    ],
  },
  {
    id: 'capeverde', name: '佛得角', code: 'CPV', numberStyleId: 'capeverde-2026',
    kits: [
      ['home', '主场', '#1958A6', '#F4F0E8', '#1958A6', '#1958A6', 'island-stars'],
      ['away', '客场', '#F4F0E8', '#1958A6', '#F4F0E8', '#F4F0E8', 'island-stars'],
      ['goalkeeper', '门将', '#53A95D', '#17212B', '#53A95D', '#53A95D', 'keeper'],
      ['away-goalkeeper', '备用门将', '#E0A437', '#17212B', '#E0A437', '#E0A437', 'keeper'],
    ],
  },
  {
    id: 'curacao', name: '库拉索', code: 'CUW', numberStyleId: 'curacao-2026',
    kits: [
      ['home', '主场', '#1267B4', '#F5D742', '#1267B4', '#1267B4', 'wave'],
      ['away', '客场', '#F5D742', '#1267B4', '#F5D742', '#F5D742', 'island'],
      ['goalkeeper', '门将', '#55AA5E', '#17212B', '#55AA5E', '#55AA5E', 'keeper'],
      ['away-goalkeeper', '备用门将', '#E26B36', '#17212B', '#E26B36', '#E26B36', 'keeper'],
    ],
  },
].map((team, teamIndex) => Object.freeze({
  ...team,
  markVariant: teamIndex,
  sourceUrls: [
    'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams',
    'https://vod.fifa.com/organisation/news/match-colour-designations-world-cup-2026-group-stage',
  ],
  licenseStatus: 'review-required',
  kits: team.kits.map(([id, label, shirt, accent, shorts, socks, pattern]) => Object.freeze({
    id,
    label,
    teamId: team.id,
    teamCode: team.code,
    markVariant: teamIndex,
    shirt,
    accent,
    shorts,
    socks,
    pattern,
    templateId: `${team.id}-${id}-2026`,
  })),
})))

export const SKIN_TONES = Object.freeze([
  ['skin-01', '#F5C58A', '#FFDEAE', '#C58553'],
  ['skin-02', '#E4AA70', '#F4C58D', '#AA693E'],
  ['skin-03', '#D79459', '#EFB77C', '#95552F'],
  ['skin-04', '#C8793D', '#E39B58', '#8D4826'],
  ['skin-05', '#AD6337', '#CE824D', '#783A24'],
  ['skin-06', '#89502F', '#AC6E43', '#5F3020'],
  ['skin-07', '#673B27', '#8D5A38', '#43251B'],
  ['skin-08', '#4A2B20', '#6B4330', '#2D1A15'],
].map(([id, base, highlight, shadow], index) => ({ id, label: `肤色 ${index + 1}`, base, highlight, shadow, variant: index })))

export const HAIR_COLORS = Object.freeze([
  '#15130F', '#281A12', '#4B2D1A', '#704221', '#9A632E', '#C68C42', '#E1BC72', '#F3D68B',
  '#5A3429', '#7D4031', '#A95439', '#D36E43', '#2B2B31', '#4A4D55', '#A6A29A', '#E5E2D8',
].map((color, index) => ({ id: `hair-color-${String(index + 1).padStart(2, '0')}`, label: `发色 ${index + 1}`, color, variant: index })))

export const APPEARANCE_CATALOG = Object.freeze({
  skinToneId: SKIN_TONES,
  faceId: sequence('face', 12, '脸型'),
  eyesId: sequence('eyes', 16, '眼睛'),
  eyebrowsId: sequence('brows', 12, '眉毛'),
  noseId: sequence('nose', 10, '鼻子'),
  mouthId: sequence('mouth', 12, '嘴型'),
  hairId: sequence('hair', 40, '发型'),
  hairColorId: HAIR_COLORS,
  beardId: [{ id: 'beard-none', label: '无胡须', variant: -1 }, ...sequence('beard', 20, '胡须')],
  accessoryIds: [{ id: 'accessory-none', label: '无配件', variant: -1 }, ...sequence('accessory', 8, '配件')],
  bootsId: sequence('boots', 12, '球鞋'),
  glovesId: sequence('gloves', 8, '手套'),
})

export const STUDIO_CATEGORY_LABELS = Object.freeze({
  faceId: '脸型',
  skinToneId: '肤色',
  hairId: '发型',
  hairColorId: '发色',
  beardId: '胡须',
  eyesId: '眼睛',
  eyebrowsId: '眉毛',
  noseId: '鼻子',
  mouthId: '嘴型',
  accessoryIds: '配件',
  bootsId: '球鞋',
  glovesId: '手套',
})

export const STUDIO_CATALOG_COUNTS = Object.freeze(Object.fromEntries(
  Object.entries(APPEARANCE_CATALOG).map(([key, values]) => [key, values.length]),
))

export function getStudioTeam(teamId) {
  return STUDIO_TEAMS.find((team) => team.id === teamId) || STUDIO_TEAMS[0]
}

export function getStudioKit(teamId, kitType = 'home') {
  const team = getStudioTeam(teamId)
  return team.kits.find((kit) => kit.id === kitType) || team.kits[0]
}

export function getCatalogItem(category, id) {
  return APPEARANCE_CATALOG[category]?.find((item) => item.id === id)
    || APPEARANCE_CATALOG[category]?.[0]
    || null
}
