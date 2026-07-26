import { getLogisticsModifiers } from './logisticsEffects.js'

const KNOCKOUT_ORDER = ['r32', 'r16', 'qf', 'sf', 'final']
const BETWEEN_MATCH_STAMINA_RECOVERY = 10

function recoverBetweenMatches(run) {
  // 后勤医疗团队加成
  const modifiers = getLogisticsModifiers(run.logisticsLevels)
  const recoveryAmount = BETWEEN_MATCH_STAMINA_RECOVERY + modifiers.staminaRecoveryBonus

  const playerStatuses = Object.fromEntries(Object.entries(run.playerStatuses || {}).map(
    ([playerId, stamina]) => [playerId, Math.min(100, Number(stamina || 0) + recoveryAmount)],
  ))
  const playerMatchStates = Object.fromEntries(Object.entries(run.playerMatchStates || {}).map(
    ([playerId, state]) => [playerId, {
      ...state,
      stamina: playerStatuses[playerId] ?? state.stamina,
    }],
  ))
  return { ...run, playerStatuses, playerMatchStates }
}

function isKnockoutRun(run) {
  return Boolean(run?.isKnockoutMatch || run?.knockoutRound)
}

function getNextKnockoutRound(round) {
  const index = KNOCKOUT_ORDER.indexOf(round || 'r32')
  return KNOCKOUT_ORDER[index + 1] || null
}

export function getNextRunAfterMatch(run) {
  if (!run) return run
  const recoveredRun = recoverBetweenMatches(run)

  if (isKnockoutRun(recoveredRun)) {
    const result = recoveredRun.lastMatchResult?.result
    const nextRound = getNextKnockoutRound(recoveredRun.knockoutRound)
    if (result === 'loss' || !nextRound) {
      return {
        ...recoveredRun,
        stage: 'ending',
        isKnockoutMatch: false,
      }
    }

    return {
      ...recoveredRun,
      stage: 'tournament',
      knockoutRound: nextRound,
      isKnockoutMatch: false,
    }
  }

  return {
    ...recoveredRun,
    stage: 'tournament',
    matchIndex: (recoveredRun.matchIndex || 0) + 1,
    isKnockoutMatch: false,
  }
}
