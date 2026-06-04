const KNOCKOUT_ORDER = ['r16', 'qf', 'sf', 'final']

export function isKnockoutRun(run) {
  return Boolean(run?.isKnockoutMatch || run?.knockoutRound)
}

export function getNextKnockoutRound(round) {
  const index = KNOCKOUT_ORDER.indexOf(round || 'r16')
  return KNOCKOUT_ORDER[index + 1] || null
}

export function getNextRunAfterMatch(run) {
  if (!run) return run

  if (isKnockoutRun(run)) {
    const result = run.lastMatchResult?.result
    const nextRound = getNextKnockoutRound(run.knockoutRound)
    if (result === 'loss' || !nextRound) {
      return {
        ...run,
        stage: 'ending',
        isKnockoutMatch: false,
      }
    }

    return {
      ...run,
      stage: 'tournament',
      knockoutRound: nextRound,
      isKnockoutMatch: false,
    }
  }

  return {
    ...run,
    stage: 'tournament',
    matchIndex: (run.matchIndex || 0) + 1,
    isKnockoutMatch: false,
  }
}
