import { ROSTER_POOL_RULES, buildVisualRecipeId } from './teamDataSchema.js'

const GOLDEN_SKILLS = {
  法国超跑: '终点冲刺：反击、身后球、单刀节点速度判定提升，射门成功率小幅提升。',
  桑巴舞者: '桑巴单挑：1v1盘带节点技术判定提升，同时更容易制造任意球。',
  当世球王: '最后一传：禁区前沿技术判定提升，成功后队友下一脚射门更稳。',
  边路游龙: '终局头槌：75分钟后传中、定位球、争顶节点身体提升，关键时刻临时加成。',
  战车门卫: '清道夫门将：对手直塞/单刀节点可提前出击，扑救判定提升但失败风险更高。',
  蓝武锋魂: '小空间转身：高压逼抢和狭小空间节点技术提升，丢球风险降低。',
  北欧魔人: '禁区引力：直塞、抢点、禁区射门节点身体提升，射门成功率提升。',
  北非之狐: '右路弹射：边路推进和回追防守提升，成功后下一次传中更准。',
  全白重炮: '全白支点：传中、高空球、二点球节点身体提升，队友补射更稳。',
  蓝浪飞翼: '加勒比闪击：替补登场后短时间速度提升，点球大战胆量提升。',
}

const TARGET_POSITION_COUNTS = ROSTER_POOL_RULES.positionTargets

export const ROSTER_POOL_SIZE = Object.values(TARGET_POSITION_COUNTS).reduce(
  (total, count) => total + count,
  0,
)

const FALLBACK_AVATAR_BY_POSITION = {
  GK: 'gk2.png',
  FW: 'slice_08.png',
  MF: 'slice_17.png',
  DF: 'slice_21.png',
}

function getTeamAssetName(teamId) {
  const map = {
    france: '法国',
    brazil: '巴西',
    argentina: '阿根廷',
    portugal: '葡萄牙',
    germany: '德国',
    japan: '日本',
    norway: '挪威',
    morocco: '摩洛哥',
    newzealand: '新西兰',
    curacao: '库拉索',
  }
  return map[teamId] || teamId
}

const POSITION_LABELS = {
  GK: '门将',
  DF: '后卫',
  MF: '中场',
  FW: '前锋',
}

const RESERVE_ARCHETYPES = {
  GK: ['扑救型', '出击型', '替补型', '青年型'],
  DF: ['边卫', '中卫', '盯人', '清球', '轮换'],
  MF: ['后腰', '组织', '跑动', '前腰', '轮换'],
  FW: ['边锋', '中锋', '影锋', '冲刺', '轮换'],
}

function clamp(value, min = 35, max = 99) {
  return Math.max(min, Math.min(max, value))
}

function ratingClamp(value) {
  return Math.round(clamp(value, 0, 99))
}

function buildReservePlayer(teamId, position, index, template, generatedIndex) {
  const assetTeam = getTeamAssetName(teamId)
  const reserveSerial = index + 1
  const archetypes = RESERVE_ARCHETYPES[position] || RESERVE_ARCHETYPES.MF
  const archetype = archetypes[index % archetypes.length]
  const baseRating = clamp((template?.rating || 68) - 5 - (index % 3), 58, 76)
  const number = 41 + generatedIndex
  const name = `扩编${archetype}${POSITION_LABELS[position] || position}${reserveSerial}`
  const spd = clamp((template?.spd || 68) - 4 + (position === 'FW' ? 2 : 0))
  const phy = clamp((template?.phy || 68) - 3 + (position === 'DF' ? 2 : 0))
  const tec = clamp((template?.tec || 68) - 4 + (position === 'MF' ? 3 : 0))
  const def = position === 'GK'
    ? clamp((template?.def || 78) - 3, 62, 86)
    : position === 'DF'
      ? clamp((template?.def || 76) - 2, 64, 86)
      : position === 'MF'
        ? clamp((template?.def || 62) - 2, 50, 78)
        : clamp((template?.def || 44) - 2, 34, 62)

  return {
    id: `${teamId}_placeholder_${position.toLowerCase()}_${String(reserveSerial).padStart(2, '0')}`,
    name,
    position,
    number,
    rating: baseRating,
    price: Math.max(28, Math.round((template?.price || 80) * 0.58)),
    spd,
    phy,
    tec,
    def,
    sta: clamp((template?.sta || 82) - (index % 2), 70, 92),
    star: Math.max(1, Math.min(3, template?.star || 3)),
    form: 80,
    height: template?.height || '182cm',
    weight: template?.weight || '78kg',
    description: '扩编大名单轮换球员，用来补足征召池和应对连续作战。',
    isGolden: false,
    isPlaceholder: true,
    dataOrigin: 'generated-placeholder',
    avatar: `/assets/${assetTeam}/${FALLBACK_AVATAR_BY_POSITION[position]}`,
  }
}

function ensureRosterSize(players, teamId) {
  const normalized = players.map((player) => normalizePlayer(player, teamId))
  let generatedIndex = 0

  for (const [position, targetCount] of Object.entries(TARGET_POSITION_COUNTS)) {
    while (normalized.filter((player) => player.position === position).length < targetCount) {
      const samePosition = normalized.filter((player) => player.position === position)
      const template = samePosition[samePosition.length - 1] || normalized[normalized.length - 1]
      const reserve = buildReservePlayer(teamId, position, samePosition.length, template, generatedIndex)
      normalized.push(normalizePlayer(reserve, teamId))
      generatedIndex += 1
    }
  }

  return normalized.slice(0, ROSTER_POOL_SIZE)
}

function sum(players) {
  return players.reduce((total, player) => total + player.price, 0)
}

const POSITION_VALUE_WEIGHTS = {
  GK: { def: 0.46, phy: 0.16, sta: 0.12, tec: 0.08, spd: 0.06 },
  DF: { def: 0.38, phy: 0.18, sta: 0.14, spd: 0.12, tec: 0.08 },
  MF: { tec: 0.30, sta: 0.18, def: 0.14, spd: 0.12, phy: 0.08 },
  FW: { tec: 0.28, spd: 0.22, phy: 0.12, sta: 0.10, def: 0.02 },
}

function getSecondaryPositions(player) {
  if (player.secondaryPositions?.length) return player.secondaryPositions
  if (player.position === 'DF') return ['MF']
  if (player.position === 'MF') return ['DF', 'FW']
  if (player.position === 'FW') return ['MF']
  return []
}

function buildOperationAttributes({
  position,
  speed,
  physical,
  technique,
  defense,
  stamina,
  shooting,
  passing,
  dribbling,
  goalkeeper,
}) {
  const isGoalkeeper = position === 'GK'
  return {
    ballControl: ratingClamp(dribbling * 0.5 + technique * 0.3 + speed * 0.1 + stamina * 0.1),
    turning: ratingClamp(technique * 0.42 + speed * 0.28 + dribbling * 0.2 + stamina * 0.1),
    sprint: ratingClamp(speed * 0.68 + stamina * 0.2 + physical * 0.12),
    passing: ratingClamp(passing * 0.62 + technique * 0.24 + stamina * 0.14),
    shooting: ratingClamp(shooting * 0.62 + technique * 0.2 + physical * 0.1 + stamina * 0.08),
    tackling: ratingClamp(defense * 0.58 + physical * 0.22 + speed * 0.1 + stamina * 0.1),
    saving: ratingClamp(isGoalkeeper ? goalkeeper * 0.68 + defense * 0.2 + physical * 0.12 : defense * 0.4),
  }
}

function normalizePlayer(player, teamId) {
  const playerId = player.id || `${teamId}_player_${player.number || 'unknown'}`
  const position = player.position || player.pos || 'MF'
  const speed = player.speed ?? player.spd ?? 65
  const physical = player.physical ?? player.phy ?? 65
  const technique = player.technique ?? player.tec ?? 65
  const defense = player.defense ?? player.def ?? 55
  const stamina = player.stamina ?? player.sta ?? 80
  const rating = player.rating || Math.round((speed + physical + technique + defense + stamina) / 5)
  const potential = player.potential || clamp(rating + (rating < 80 ? 6 : 3), rating, 99)
  const assetTeam = getTeamAssetName(teamId)
  const shooting = player.shooting || ratingClamp(position === 'FW' ? technique + 4 : position === 'MF' ? technique - 4 : technique - 18)
  const passing = player.passing || ratingClamp(position === 'MF' ? technique + 4 : technique)
  const dribbling = player.dribbling || ratingClamp(position === 'FW' ? technique + 2 : technique)
  const setPiece = player.setPiece || ratingClamp(technique - 2)
  const penalty = player.penalty || ratingClamp((player.star || 3) * 8 + technique * 0.62)
  const goalkeeper = player.goalkeeper || (position === 'GK' ? defense : 10)
  const generatedOperationAttributes = buildOperationAttributes({
    position,
    speed,
    physical,
    technique,
    defense,
    stamina,
    shooting,
    passing,
    dribbling,
    goalkeeper,
  })
  const operationAttributes = {
    ...generatedOperationAttributes,
    ...(player.operationAttributes || {}),
  }
  const visualRecipeId = player.visualRecipeId || buildVisualRecipeId(teamId, playerId)
  const spriteRecipe = {
    team: assetTeam,
    teamId,
    role: position,
    kit: position === 'GK' ? 'goalkeeper' : 'home',
    avatar: player.avatar || `/assets/${assetTeam}/${FALLBACK_AVATAR_BY_POSITION[position]}`,
    ...(player.spriteRecipe || {}),
    visualRecipeId,
  }

  return {
    ...player,
    id: playerId,
    teamId,
    nickname: player.nickname || player.name,
    position,
    pos: position,
    secondaryPositions: getSecondaryPositions({ ...player, position }),
    age: player.age || (player.isGolden ? 28 : rating >= 84 ? 27 : rating >= 76 ? 25 : 22),
    height: player.height || '182cm',
    weight: player.weight || '78kg',
    foot: player.foot || (position === 'GK' ? '右脚' : '双脚'),
    clubTag: player.clubTag || (rating >= 86 ? '豪门主力' : rating >= 78 ? '五大联赛' : '国家队轮换'),
    rating,
    potential,
    status: player.status || 'available',
    stamina,
    morale: player.morale || 80,
    form: player.form ?? 80,
    speed,
    physical,
    technique,
    defense,
    shooting,
    passing,
    dribbling,
    setPiece,
    penalty,
    goalkeeper,
    operationAttributes,
    control: operationAttributes.ballControl,
    turning: operationAttributes.turning,
    sprint: operationAttributes.sprint,
    pass: operationAttributes.passing,
    shoot: operationAttributes.shooting,
    tackle: operationAttributes.tackling,
    hiddenTraits: player.hiddenTraits || (player.isGolden ? [GOLDEN_SKILLS[player.name]].filter(Boolean) : []),
    hiddenSkill: player.isGolden ? GOLDEN_SKILLS[player.name] : player.hiddenSkill,
    visualRecipeId,
    spriteRecipe,
    portraitRecipe: player.portraitRecipe || {
      source: player.avatar || `/assets/${assetTeam}/${FALLBACK_AVATAR_BY_POSITION[position]}`,
      frame: player.isGolden ? 'gold' : 'standard',
    },
    dataOrigin: player.dataOrigin || 'source',
    isPlaceholder: player.isPlaceholder === true,
  }
}

export function getPlayerMarketScore(player) {
  const position = player.position || player.pos || 'MF'
  const weights = POSITION_VALUE_WEIGHTS[position] || POSITION_VALUE_WEIGHTS.MF
  const attributeScore = Object.entries(weights).reduce(
    (total, [attribute, weight]) => total + (player[attribute] || 60) * weight,
    0,
  )
  const ratingScore = (player.rating || 60) * 0.58
  const starBonus = Math.max(0, (player.star || 1) - 2) * 1.5
  const goldenBonus = player.isGolden ? 4 : 0
  return Math.round((ratingScore + attributeScore + starBonus + goldenBonus) * 100) / 100
}

function rebalancePrices(players, budget) {
  const byValue = [...players].sort((a, b) => {
    const scoreDiff = getPlayerMarketScore(b) - getPlayerMarketScore(a)
    return scoreDiff || (b.rating || 0) - (a.rating || 0)
  })
  const priceCurve = [
    0.086, 0.082, 0.079, 0.076, 0.073, 0.070, 0.067, 0.064,
    0.061, 0.058, 0.055, 0.052, 0.049, 0.046, 0.044, 0.042,
    0.040, 0.038, 0.036, 0.034, 0.032, 0.030, 0.029, 0.028,
    0.027, 0.026, 0.025, 0.024, 0.023, 0.022, 0.021, 0.020,
    0.019, 0.018, 0.017, 0.016, 0.015, 0.014,
  ]
  const descendingPrices = priceCurve
    .slice(0, byValue.length)
    .map((ratio) => Math.max(24, Math.round(budget * ratio)))

  byValue.forEach((player, index) => {
    player.price = descendingPrices[index]
  })

  const cheapest = [...players].sort((a, b) => a.price - b.price)
  while (sum(cheapest.slice(0, ROSTER_POOL_RULES.nationalSquadSize)) > budget) {
    cheapest.slice(0, ROSTER_POOL_RULES.nationalSquadSize).forEach((player) => {
      player.price = Math.max(20, player.price - 1)
    })
  }

  return players
}

export function prepareTeamPlayers(players, teamId, budget) {
  const roster = ensureRosterSize(players, teamId)
  return rebalancePrices(roster, budget)
}
