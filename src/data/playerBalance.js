import { ROSTER_POOL_RULES, buildVisualRecipeId } from './teamDataSchema.js'

const GOLDEN_SKILLS = {
  世一腰: '控场王冠：中场调度与拦截节点技术判定大幅提升，全队连续传球后关键一传更稳。',
  潘帕球王: '绝境球王：落后时射门、直塞、任意球节点全面提升，加时赛再额外加成。',
  法国超跑: '纵深爆破：反击与身后球节点速度判定大幅提升，单刀成功率显著加成。',
  大英巴图鲁: '二次进攻：禁区射门与定位球抢点身体判定提升，补射、二点球更稳。',
  桑巴舞者: '桑巴单挑：1v1盘带节点技术判定大幅提升，边路突破更容易制造犯规。',
  边路游龙: '关键先生：75分钟后射门、争顶节点身体与技术提升，关键时刻临时加成。',
  战车门卫: '清道夫门将：对手直塞/单刀节点可提前出击，扑救判定提升但失败风险更高。',
  蓝武左刃: '蓝武快刃：高压逼抢与狭小空间节点技术提升，边路内切射门更稳。',
  沙漠飞翼: '沙漠反击：边路推进与回追防守提升，抢断后反击传中更准。',
  魔人布欧: '禁区引力：直塞、抢点、禁区射门节点身体提升，射门成功率大幅提升。',
  咖啡飞翼: '咖啡旋律：边路冲击与前场创造力节点技术提升，传中与直塞更准。',
  美国队长: '主场浪潮：主场作战时速度与射门判定额外加成，前场压迫更凶狠。',
  加拿大超跑: '枫叶快攻：抢断后快速转换节点速度爆发，反击单刀成功率提升。',
  绿鹰中锋: '高原节奏：中锋抢点与连续跑动节点身体提升，主场气势额外加成。',
  草根门神: '蓝鲨门线：门线反应与单刀扑救判定大幅提升，弱队防线更稳。',
  海岛门神: '海岛门线：门将扑救与大赛关键节点判定提升，弱队上限核心。',
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
    // 新球队暂无专属立绘，复用库拉索的通用头像
    spain: '库拉索',
    england: '库拉索',
    usa: '库拉索',
    canada: '库拉索',
    mexico: '库拉索',
    colombia: '库拉索',
    capeverde: '库拉索',
  }
  return map[teamId] || teamId
}

function clamp(value, min = 35, max = 99) {
  return Math.max(min, Math.min(max, value))
}

function ratingClamp(value) {
  return Math.round(clamp(value, 0, 99))
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
  // 卡级兼容派生：优先读 cardTier（金/银/普），并由此派生 isGolden
  const cardTier = player.cardTier || (player.isGolden ? '金' : '普')
  const isGolden = cardTier === '金'

  return {
    ...player,
    id: playerId,
    teamId,
    cardTier,
    isGolden,
    nickname: player.nickname || player.name,
    position,
    pos: position,
    secondaryPositions: getSecondaryPositions({ ...player, position }),
    age: player.age || (isGolden ? 28 : rating >= 84 ? 27 : rating >= 76 ? 25 : 22),
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
    hiddenTraits: player.hiddenTraits || (isGolden ? [GOLDEN_SKILLS[player.name]].filter(Boolean) : []),
    hiddenSkill: isGolden ? GOLDEN_SKILLS[player.name] : player.hiddenSkill,
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

export function prepareTeamPlayers(players, teamId, _budget) {
  // 2026新体系：每队固定24人候选池、价格由策划稿指定，
  // 不再补齐到38人、不再按预算曲线重算价格，仅做字段规范化。
  return players.map(player => normalizePlayer(player, teamId))
}
