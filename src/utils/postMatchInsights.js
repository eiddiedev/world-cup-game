export function buildPostMatchInsights(result, teamName) {
  const { homeScore, awayScore, stats = {}, decisions = [] } = result
  const isWin = homeScore > awayScore
  const isDraw = homeScore === awayScore
  const diff = Math.abs(homeScore - awayScore)
  const parts = []

  if (isWin) {
    if (diff >= 3) parts.push(`${teamName}取得了一场酣畅淋漓的大胜。`)
    else if (diff === 2) parts.push(`${teamName}稳稳拿下比赛。`)
    else parts.push(`${teamName}艰难取胜。`)
  } else if (isDraw) {
    parts.push('双方势均力敌，握手言和。')
  } else if (diff >= 3) {
    parts.push(`${teamName}遭遇惨败。`)
  } else {
    parts.push(`${teamName}遗憾落败。`)
  }

  if ((stats.myShots || 0) > (stats.oppShots || 0) + 5) {
    parts.push(`全场射门${stats.myShots}次，进攻主动权明显。`)
  } else if ((stats.oppShots || 0) > (stats.myShots || 0) + 5) {
    parts.push('对手获得了更多射门，防线承受了较大压力。')
  }
  if ((stats.myXG || 0) > homeScore + 1) parts.push(`创造了${stats.myXG}预期进球，但终结效率仍有提升空间。`)
  else if ((stats.myXG || 0) < homeScore - 0.5) parts.push('实际进球高于机会质量，临门一脚非常高效。')
  if (decisions.length > 0) {
    const successfulDecisions = decisions.filter(decision => decision.isSuccess).length
    parts.push(`本场完成${decisions.length}次临场决策，其中${successfulDecisions}次取得正面结果。`)
  }

  const decisionItems = decisions.slice(-6).map(decision => {
    const situation = decision.situation?.replace(/\{[^}]+\}/g, '').slice(0, 28) || '关键回合'
    return `${decision.minute ?? 0}′ ${situation}｜选择“${decision.choiceLabel}”：${decision.resultText}`
  })

  const advice = []
  if ((stats.myXG || 0) > homeScore + 0.8) advice.push('下一场可以优先选择更稳妥的射门方式，减少低质量强行打门。')
  if ((stats.oppXG || 0) > (stats.myXG || 0)) advice.push('对手机会质量更高，建议增加正牌后卫并减少后场冒险出球。')
  if ((stats.possession || 50) < 43) advice.push('控球偏低，中场需要更多接应点，避免比赛长期处于被动。')
  if ((stats.yellowCards || 0) >= 2 || (stats.redCards || 0) > 0) advice.push('本场纪律风险偏高，禁区附近应减少放铲和战术犯规。')
  if (decisions.some(decision => !decision.isSuccess && /犯规|放铲|假摔|冒险/.test(`${decision.situation}${decision.choiceLabel}`))) {
    advice.push('高风险决策已经付出代价，领先或局势稳定时更适合选择保守处理。')
  }
  if (advice.length === 0) advice.push('整体执行稳定，下一场继续根据比分和体力及时调整阵型与换人。')

  return { summary: parts.join(''), decisionItems, advice: advice.slice(0, 3) }
}
