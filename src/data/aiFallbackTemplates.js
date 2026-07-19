import { AI_ENHANCEMENT_SCENES } from './aiEnhancement.js'

function getTeamName(team, fallback) {
  return team?.name || team?.nameEn || team?.id || fallback
}

function getLastEventText(recentEvents) {
  const event = recentEvents.at(-1)
  return event?.text || event?.commentary || event?.label || '比赛正在按既定节奏推进'
}

function buildScoutFallback(request) {
  const player = getTeamName(request.playerTeam, '我方')
  const opponent = getTeamName(request.opponentTeam, '待定对手')
  const formation = request.opponentTeam?.formation || request.matchSnapshot?.opponentFormation || '未知阵型'
  return {
    title: `${opponent}赛前球探摘要`,
    summary: `${player}应先确认对手阵型和强侧，再决定是否主动压上。`,
    items: [
      `阵型观察：${opponent}当前记录为${formation}。`,
      '防守准备：优先保护中路与二点球，避免开局阵型被拉散。',
      '进攻准备：先用稳妥传递识别对手压迫方向，再寻找弱侧空间。',
    ],
  }
}

function buildTacticsFallback(request) {
  const opponent = getTeamName(request.opponentTeam, '对手')
  const style = request.opponentTeam?.styleTags?.join('、') || request.opponentTeam?.style || '均衡推进'
  return {
    title: `${opponent}战术模拟`,
    summary: `本地模型按“${style}”生成三段式比赛预案。`,
    items: [
      '开局：对手可能先稳定阵型，再寻找边路推进机会。',
      '落后：对手会增加前场投入，身后空间随之扩大。',
      '领先：对手更可能收缩保护禁区，反击成为主要威胁。',
    ],
  }
}

function buildCommentaryFallback(request) {
  const latest = getLastEventText(request.recentEvents)
  return {
    title: '动态解说候选',
    summary: latest,
    items: [
      `场上焦点：${latest}。`,
      '双方仍在争夺下一次向前推进的空间。',
      '这段播报来自本地模板，不会暂停或等待网络。',
    ],
  }
}

function buildCoachFallback(request) {
  const formation = request.matchSnapshot?.formation || request.playerTeam?.formation || '当前阵型'
  const lowStaminaCount = Number(request.matchSnapshot?.lowStaminaCount || 0)
  return {
    title: '教练组准备建议',
    summary: `${formation}可以继续使用，但要同步检查体能与位置覆盖。`,
    items: [
      lowStaminaCount > 0
        ? `体能提醒：有${lowStaminaCount}名球员需要轮换或恢复。`
        : '体能提醒：当前没有记录到必须处理的低体能球员。',
      '阵容提醒：门将和中轴线位置优先保持稳定。',
      '公平说明：建议不会自动改写选择成功率或比赛结果。',
    ],
  }
}

function buildPostMatchFallback(request) {
  const snapshot = request.matchSnapshot || {}
  const score = Number.isFinite(snapshot.homeScore) && Number.isFinite(snapshot.awayScore)
    ? `${snapshot.homeScore}-${snapshot.awayScore}`
    : '比分未记录'
  const shots = snapshot.stats?.myShots
  const onTarget = snapshot.stats?.myShotsOnTarget
  return {
    title: '赛后本地复盘',
    summary: `本场结果为${score}，复盘重点放在机会质量与下一场恢复。`,
    items: [
      Number.isFinite(shots) ? `进攻数据：${shots}次射门，${onTarget || 0}次射正。` : '进攻数据：等待完整比赛统计。',
      request.recentEvents.length > 0 ? `关键记录：${getLastEventText(request.recentEvents)}。` : '关键记录：本场没有可用的决策事件。',
      '下一场：先处理伤停与体能，再调整阵型和首发。',
    ],
  }
}

function buildChallengeFallback(request) {
  const player = getTeamName(request.playerTeam, '当前球队')
  const opponent = getTeamName(request.opponentTeam, 'AI 对手')
  return {
    title: '本地挑战：逆风守线',
    summary: `${player}对阵${opponent}，以单机规则完成指定目标。`,
    items: [
      '限制：不使用金卡球星完成首发。',
      '目标：在不吃红牌的前提下完成比赛。',
      '奖励占位：声望与训练道具，不直接奖励进球或胜利。',
    ],
  }
}

const FALLBACK_BUILDERS = {
  [AI_ENHANCEMENT_SCENES.PRE_MATCH_SCOUT]: buildScoutFallback,
  [AI_ENHANCEMENT_SCENES.OPPONENT_TACTICS_SIMULATION]: buildTacticsFallback,
  [AI_ENHANCEMENT_SCENES.DYNAMIC_COMMENTARY]: buildCommentaryFallback,
  [AI_ENHANCEMENT_SCENES.COACH_ADVICE]: buildCoachFallback,
  [AI_ENHANCEMENT_SCENES.POST_MATCH_REVIEW]: buildPostMatchFallback,
  [AI_ENHANCEMENT_SCENES.GENERATED_CHALLENGE]: buildChallengeFallback,
}

export function buildLocalAiFallback(request, fallbackReason = 'provider_not_configured') {
  const content = FALLBACK_BUILDERS[request.scene](request)
  return {
    scene: request.scene,
    source: 'local-fallback',
    provider: 'local-template',
    fallbackReason,
    locale: request.locale,
    ...content,
  }
}
