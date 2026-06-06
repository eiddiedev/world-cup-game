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

const TARGET_POSITION_COUNTS = {
  GK: 2,
  FW: 7,
  MF: 7,
  DF: 8,
}

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

function buildReservePlayer(teamId, position, index, template) {
  const assetTeam = getTeamAssetName(teamId)
  const baseRating = Math.max(58, Math.min(72, (template?.rating || 68) - 4))
  const number = 41 + index
  const name = `预备${position === 'DF' ? '后卫' : position === 'MF' ? '中场' : position === 'FW' ? '前锋' : '门将'}${String.fromCharCode(67 + index)}`

  return {
    id: `${teamId}_${name}`,
    name,
    position,
    number,
    rating: baseRating,
    price: Math.max(40, Math.round((template?.price || 80) * 0.72)),
    spd: Math.max(45, (template?.spd || 68) - 4),
    phy: Math.max(45, (template?.phy || 68) - 4),
    tec: Math.max(45, (template?.tec || 68) - 4),
    def: position === 'DF' ? Math.max(65, (template?.def || 76) - 2) : Math.max(35, (template?.def || 60) - 4),
    sta: Math.max(70, template?.sta || 82),
    star: Math.max(1, Math.min(3, template?.star || 3)),
    form: 80,
    height: template?.height || '182cm',
    weight: template?.weight || '78kg',
    description: '低价轮换球员，用来补足大名单和应对连续作战。',
    isGolden: false,
    avatar: `/assets/${assetTeam}/${FALLBACK_AVATAR_BY_POSITION[position]}`,
  }
}

function ensureRosterSize(players, teamId) {
  const normalized = players.map((player) => ({
    ...player,
    pos: player.position,
    hiddenSkill: player.isGolden ? GOLDEN_SKILLS[player.name] : player.hiddenSkill,
  }))

  for (const [position, targetCount] of Object.entries(TARGET_POSITION_COUNTS)) {
    while (normalized.filter((player) => player.position === position).length < targetCount) {
      const samePosition = normalized.filter((player) => player.position === position)
      const template = samePosition[samePosition.length - 1] || normalized[normalized.length - 1]
      normalized.push(buildReservePlayer(teamId, position, normalized.length, template))
    }
  }

  return normalized.slice(0, 24)
}

function sum(players) {
  return players.reduce((total, player) => total + player.price, 0)
}

function rebalancePrices(players, budget) {
  const byPrice = [...players].sort((a, b) => b.price - a.price)
  const descendingPrices = [
    0.095, 0.09, 0.085, 0.08, 0.075, 0.072, 0.068, 0.064,
    0.06, 0.056, 0.052, 0.048, 0.044, 0.040, 0.038, 0.036,
    0.034, 0.032, 0.080, 0.078, 0.076, 0.074, 0.072, 0.070,
  ].map((ratio) => Math.max(38, Math.round(budget * ratio)))

  byPrice.forEach((player, index) => {
    player.price = descendingPrices[index]
  })

  const cheapest = [...players].sort((a, b) => a.price - b.price)
  while (sum(cheapest.slice(0, 18)) > budget) {
    cheapest.slice(0, 18).forEach((player) => {
      player.price = Math.max(35, player.price - 1)
    })
  }
  while (sum(cheapest.slice(0, 19)) <= budget) {
    cheapest[18].price += 1
  }

  return players
}

export function prepareTeamPlayers(players, teamId, budget) {
  const roster = ensureRosterSize(players, teamId)
  return rebalancePrices(roster, budget)
}

export function getGoldenSkill(player) {
  return GOLDEN_SKILLS[player?.name] || player?.hiddenSkill || null
}
