/**
 * 播报引擎 — 比赛实时事件播报
 * 包含：常规动作、犯规、黄红牌、角球、任意球、边线球、门球、越位、受伤
 */

// ── 播报模板库 ──

const ACTIONS = [
  ({ a, b }) => `${a}正在带球推进，${b}立刻上前封堵`,
  ({ a, b }) => `${a}横向拉开角度，${b}贴身抢断`,
  ({ a }) => `${a}观察身后空当，送出一脚直塞`,
  ({ a, b }) => `${a}边路加速传中，${b}回防到禁区前沿`,
  ({ a, b }) => `${a}中路稳住节奏，${b}卡住传球线路`,
  ({ a, b }) => `${a}完成一次抢断，${b}马上反抢`,
  ({ a, b }) => `${a}斜传转移到弱侧，${b}快速补位`,
  ({ a, b }) => `${a}护住球权继续推进，${b}选择延缓进攻`,
  ({ a }) => `${a}中场一脚长传，球飞向前场`,
  ({ a, b }) => `${a}和${b}在中场展开激烈拼抢`,
  ({ a }) => `${a}接到队友回做球，调整后准备起脚`,
  ({ a, b }) => `${a}试图突破，${b}用身体卡住位置`,
  ({ a }) => `${a}在后场从容控球，等待队友跑位`,
  ({ a, b }) => `${a}送出过顶球，${b}奋力追赶`,
  ({ a }) => `${a}一脚出球，快速转移方向`,
]

const FOULS = [
  ({ a, b }) => `${a}对${b}犯规！裁判鸣哨`,
  ({ a, b }) => `${a}在拼抢中踢倒了${b}，犯规！`,
  ({ a, b }) => `${a}从身后拉倒${b}，裁判吹罚犯规`,
  ({ a, b }) => `${a}肘击${b}，裁判立即鸣哨`,
  ({ a, b }) => `${a}铲球动作过大，放倒了${b}，犯规！`,
  ({ a, b }) => `${a}推倒了${b}，任意球`,
  ({ a, b }) => `${a}对${b}做出危险动作，犯规！`,
]

const YELLOW_CARDS = [
  ({ a }) => `🟨 ${a}被出示黄牌！`,
  ({ a }) => `🟨 裁判向${a}出示黄牌警告`,
  ({ a }) => `🟨 ${a}犯规动作过大，黄牌！`,
  ({ a }) => `🟨 ${a}因为抗议判罚吃到黄牌`,
  ({ a }) => `🟨 ${a}战术犯规，裁判掏出黄牌`,
]

const RED_CARDS = [
  ({ a }) => `🟥 ${a}被红牌罚下！`,
  ({ a }) => `🟥 裁判直接出示红牌！${a}被罚下场！`,
  ({ a }) => `🟥 ${a}严重犯规，红牌！球队少一人作战！`,
]

const CORNERS = [
  ({ a }) => `角球！${a}将球踢向禁区`,
  ({ a }) => `${a}主罚角球，球旋向门前`,
  () => `角球！禁区内人头攒动`,
  ({ a }) => `${a}开出角球，门将出击将球击出`,
  () => `角球机会！进攻方全部压上`,
]

const THROW_INS = [
  ({ a }) => `${a}掷出边线球`,
  ({ a }) => `${a}快速掷出边线球，保持进攻节奏`,
  ({ a }) => `${a}将球掷给队友`,
  () => `边线球`,
]

const GOAL_KICKS = [
  ({ a }) => `${a}开出球门球`,
  ({ a }) => `门将${a}大脚开出球门球`,
  () => `球门球，门将从容开出`,
]

const OFFSIDES = [
  ({ a }) => `越位！${a}启动太早了`,
  ({ a }) => `${a}越位在先，进攻无效`,
  ({ a }) => `边裁举旗，${a}越位了`,
  () => `越位！裁判判罚越位`,
]

const INJURIES = [
  ({ a }) => `${a}倒地了，看起来有些不适`,
  ({ a }) => `${a}在拼抢中受伤，队医进场`,
  ({ a }) => `${a}捂着膝盖，希望没有大碍`,
  ({ a }) => `${a}请求治疗，比赛暂停`,
]

const GOALKEEPER_EVENTS = [
  ({ a }) => `门将${a}稳稳将球没收`,
  ({ a }) => `${a}飞身将球扑出底线！`,
  ({ a }) => `门将${a}出击将球抱住`,
  ({ a }) => `${a}精彩的扑救！力保球门不失`,
]

const MIDFIELD_BATTLES = [
  ({ a, b }) => `${a}和${b}在中场展开肉搏战`,
  ({ a, b }) => `${a}试图传球，${b}飞身封堵`,
  ({ a, b }) => `${a}控球，${b}不断施压`,
  ({ a }) => `${a}在中场拿球，观察前场跑位`,
]

// ── 辅助函数 ──

function playerLabel(player, fallbackNumber, sideLabel = '') {
  const number = player?.number || fallbackNumber
  return `${sideLabel}${number}号`
}

function sideAwareLabel(player, myPlayers = [], opponentPlayers = [], fallbackNumber) {
  const isMy = myPlayers.includes(player) || myPlayers.some(p => p.id && p.id === player?.id)
  const isOpponent = opponentPlayers.includes(player) || opponentPlayers.some(p => p.id && p.id === player?.id)
  return playerLabel(player, fallbackNumber, isMy ? '本方' : isOpponent ? '对方' : '')
}

function pick(list, seed) {
  if (!list.length) return null
  return list[Math.abs(seed) % list.length]
}

function pickRandom(list, randomFn = Math.random) {
  if (!list.length) return null
  return list[Math.floor(randomFn() * list.length)]
}

function visualPayload(visualKind, actor, support, opponent, teamSide = 'my', ballZone = 'midfield') {
  return {
    visualKind,
    actorId: actor?.id,
    supportId: support?.id,
    opponentId: opponent?.id,
    actorNumber: actor?.number,
    supportNumber: support?.number,
    opponentNumber: opponent?.number,
    teamSide,
    ballZone,
  }
}

// ── 导出函数 ──

export function createOpeningCommentary(teamName, opponentName) {
  return `0' ${teamName}开球，${opponentName}阵型回收，比赛开始`
}

/**
 * 生成常规播报事件（无决策）
 * @returns {{ text: string, color: string, type: string }}
 */
export function generateCommentaryEvent(minute, myPlayers = [], opponentPlayers = []) {
  const myOutfield = myPlayers.filter(p => (p.pos || p.position) !== 'GK')
  const oppOutfield = opponentPlayers.filter(p => (p.pos || p.position) !== 'GK')
  const allPlayers = [...myOutfield, ...oppOutfield].filter(Boolean)
  const first = pick(myOutfield.length ? myOutfield : allPlayers, minute + allPlayers.length) || { number: 2 }
  const second = pick(myOutfield.filter(p => p.id !== first?.id).length ? myOutfield.filter(p => p.id !== first?.id) : allPlayers, minute * 3 + 1) || { number: 3 }
  const defender = pick(oppOutfield.length ? oppOutfield : allPlayers, minute * 5 + 2) || { number: 4 }
  const visualKinds = ['dribble', 'pass', 'through', 'cross', 'midfield']
  const visualKind = visualKinds[Math.abs(minute) % visualKinds.length]
  const ballZone = visualKind === 'cross' ? 'right_attack' : visualKind === 'through' ? 'box' : 'midfield'
  const beats = [
    `${sideAwareLabel(first, myPlayers, opponentPlayers, 2)}正在带球推进`,
    `${sideAwareLabel(second, myPlayers, opponentPlayers, 3)}前插接应`,
    `${sideAwareLabel(defender, myPlayers, opponentPlayers, 4)}上前封堵`,
  ]
  const actionText = beats.join(' → ')
  const fallbackAction = ACTIONS[Math.abs(minute) % ACTIONS.length]
  return {
    text: `${minute}' ${actionText || fallbackAction({
      a: sideAwareLabel(first, myPlayers, opponentPlayers, 2),
      b: sideAwareLabel(second, myPlayers, opponentPlayers, 3),
    })}`,
    color: 'var(--pixel-bg)',
    type: 'action',
    visual: visualPayload(visualKind, first, second, defender, 'my', ballZone),
  }
}

/**
 * 生成随机比赛事件（犯规、牌、角球、边线球等）
 * @param {number} minute
 * @param {Array} myPlayers
 * @param {Array} opponentPlayers
 * @returns {{ text: string, color: string, type: string, statsUpdate: Object }}
 */
export function generateRandomMatchEvent(minute, myPlayers = [], opponentPlayers = [], randomFn = Math.random) {
  const myOutfield = myPlayers.filter(p => (p.pos || p.position) !== 'GK')
  const oppOutfield = opponentPlayers.filter(p => (p.pos || p.position) !== 'GK')
  const allPlayers = [...myOutfield, ...oppOutfield].filter(Boolean)
  const safeAllPlayers = allPlayers.length ? allPlayers : [...myPlayers, ...opponentPlayers].filter(Boolean)
  const myGK = myPlayers.find(p => (p.pos || p.position) === 'GK')
  const oppGK = opponentPlayers.find(p => (p.pos || p.position) === 'GK')
  const getTeamSide = (player) => {
    if (!player) return null
    if (myPlayers.includes(player) || myPlayers.some(p => p.id && p.id === player.id)) return 'my'
    if (opponentPlayers.includes(player) || opponentPlayers.some(p => p.id && p.id === player.id)) return 'opponent'
    return null
  }

  // 按权重随机选择事件类型
  const roll = randomFn()
  let eventType, text, color, actor, supportActor, teamSide
  let statsUpdate = {}

  if (roll < 0.25) {
    // 犯规 (25%)
    const a = pickRandom(oppOutfield.length ? oppOutfield : safeAllPlayers, randomFn)
    const b = pickRandom(myOutfield.length ? myOutfield : safeAllPlayers, randomFn)
    const foulText = pickRandom(FOULS, randomFn)
    actor = a
    supportActor = b
    teamSide = getTeamSide(actor)
    text = `${minute}' ${foulText({ a: sideAwareLabel(a, myPlayers, opponentPlayers), b: sideAwareLabel(b, myPlayers, opponentPlayers) })}`
    color = '#ff6644'
    eventType = 'foul'
    statsUpdate = { fouls: 1 }

    const cardRoll = randomFn()
    // 直接红牌很少见，但必须能进入完整事件链路
    if (cardRoll < 0.025) {
      const cardText = pickRandom(RED_CARDS, randomFn)
      text += ` ${cardText({ a: sideAwareLabel(a, myPlayers, opponentPlayers) })}`
      color = '#ff4444'
      eventType = 'red_card'
      statsUpdate = { fouls: 1, redCards: 1 }
    } else if (cardRoll < 0.36) {
      const cardText = pickRandom(YELLOW_CARDS, randomFn)
      text += ` ${cardText({ a: sideAwareLabel(a, myPlayers, opponentPlayers) })}`
      color = '#ffcc00'
      eventType = 'yellow_card'
      statsUpdate = { fouls: 1, yellowCards: 1 }
    }
  } else if (roll < 0.35) {
    // 角球 (10%)
    const cornerText = pickRandom(CORNERS, randomFn)
    const a = pickRandom(myOutfield.length ? myOutfield : safeAllPlayers, randomFn)
    actor = a
    supportActor = myOutfield.find(p => p.id !== actor?.id)
    teamSide = getTeamSide(actor)
    text = `${minute}' ${cornerText({ a: sideAwareLabel(a, myPlayers, opponentPlayers) })}`
    color = 'var(--pixel-gold)'
    eventType = 'corner'
    statsUpdate = { corners: 1 }
  } else if (roll < 0.50) {
    // 边线球 (15%)
    const throwText = pickRandom(THROW_INS, randomFn)
    const a = pickRandom(safeAllPlayers, randomFn)
    actor = a
    supportActor = safeAllPlayers.find(p => p.id !== actor?.id)
    teamSide = getTeamSide(actor)
    text = `${minute}' ${throwText({ a: sideAwareLabel(a, myPlayers, opponentPlayers) })}`
    color = 'var(--pixel-bg)'
    eventType = 'throw_in'
  } else if (roll < 0.58) {
    // 门球 (8%)
    const gkText = pickRandom(GOAL_KICKS, randomFn)
    const gk = pickRandom([myGK, oppGK].filter(Boolean), randomFn)
    actor = gk
    teamSide = getTeamSide(actor)
    supportActor = teamSide === 'my' ? myOutfield[0] : oppOutfield[0]
    text = `${minute}' ${gkText({ a: sideAwareLabel(gk || { number: 1 }, myPlayers, opponentPlayers) })}`
    color = 'var(--pixel-bg)'
    eventType = 'goal_kick'
  } else if (roll < 0.65) {
    // 越位 (7%)
    const offText = pickRandom(OFFSIDES, randomFn)
    const a = pickRandom(myOutfield.length ? myOutfield : safeAllPlayers, randomFn)
    actor = a
    supportActor = myOutfield.find(p => p.id !== actor?.id)
    teamSide = getTeamSide(actor)
    text = `${minute}' ${offText({ a: sideAwareLabel(a, myPlayers, opponentPlayers) })}`
    color = '#ff8844'
    eventType = 'offside'
  } else if (roll < 0.70 && minute > 20) {
    // 门将扑救 (5%, 20分钟后)
    const gkEvtText = pickRandom(GOALKEEPER_EVENTS, randomFn)
    const gk = pickRandom([myGK, oppGK].filter(Boolean), randomFn)
    actor = gk
    teamSide = getTeamSide(actor)
    supportActor = teamSide === 'my' ? myOutfield[0] : oppOutfield[0]
    text = `${minute}' ${gkEvtText({ a: sideAwareLabel(gk || { number: 1 }, myPlayers, opponentPlayers) })}`
    color = '#44aaff'
    eventType = 'gk_save'
  } else if (roll < 0.73 && minute > 30) {
    // 受伤 (3%, 30分钟后)
    const injText = pickRandom(INJURIES, randomFn)
    const a = pickRandom(safeAllPlayers, randomFn)
    actor = a
    supportActor = safeAllPlayers.find(p => p.id !== actor?.id)
    teamSide = getTeamSide(actor)
    text = `${minute}' ${injText({ a: sideAwareLabel(a, myPlayers, opponentPlayers) })}`
    color = '#ff4444'
    eventType = 'injury'
  } else {
    // 中场拼抢 (剩余)
    const midText = pickRandom(MIDFIELD_BATTLES, randomFn)
    const a = pickRandom(safeAllPlayers, randomFn)
    const b = pickRandom(safeAllPlayers, randomFn)
    actor = a
    supportActor = b
    teamSide = getTeamSide(actor)
    text = `${minute}' ${midText({ a: sideAwareLabel(a, myPlayers, opponentPlayers), b: sideAwareLabel(b, myPlayers, opponentPlayers) })}`
    color = 'var(--pixel-bg)'
    eventType = 'midfield'
  }

  return {
    text,
    color,
    type: eventType,
    statsUpdate,
    playerId: actor?.id,
    playerName: actor?.name || playerLabel(actor),
    playerNumber: actor?.number,
    teamSide,
    visual: visualPayload(
      eventType,
      actor,
      supportActor || (teamSide === 'my' ? myOutfield.find(p => p.id !== actor?.id) : oppOutfield.find(p => p.id !== actor?.id)),
      teamSide === 'my' ? oppOutfield[0] : myOutfield[0],
      teamSide,
      eventType === 'corner' ? 'box'
        : eventType === 'throw_in' ? 'right_attack'
          : eventType === 'goal_kick' || eventType === 'gk_save' ? 'defend'
            : eventType === 'offside' ? 'box'
              : 'midfield',
    ),
  }
}
