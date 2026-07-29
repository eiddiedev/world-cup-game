// 正式作品里的教练模式必须始终保留场内决策。events / decisions 是历史实验室
// 调试参数，线上容器也可能带同名查询参数，因此只能在开发环境中读取。
export function shouldEnableCoachDecisions(
  gameMode = 'coach',
  params = new URLSearchParams(),
  allowDebugOverrides = false,
) {
  if (gameMode === 'player') return false
  if (!allowDebugOverrides) return true
  return (
    params.get('events') !== 'manual'
    && params.get('events') !== 'auto'
    && params.get('decisions') !== 'off'
  )
}
