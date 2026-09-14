// 临时素材录制权重：只改变指定对局的真实动作倾向，不直接写比分或统计。
export const COMPLIANT_CAPTURE_BIASES = Object.freeze({
  'germany-curacao-big-win': Object.freeze({
    id: 'germany-curacao-big-win',
    variantId: 'compliant-full',
    gameMode: 'coach',
    teamId: 'germany',
    opponentTeamId: 'curacao',
    tacticalStances: Object.freeze({ red: 'all-out-attack', blue: 'attack' }),
    shotBias: Object.freeze({
      red: Object.freeze({
        mode: 'goal-channel',
        chance: 0.68,
        catchUpChance: 0.18,
        softGoalTarget: 7,
        saturatedMultiplier: 0.18,
        speedScale: 1.08,
        spread: 0.32,
      }),
      blue: Object.freeze({
        mode: 'wide-channel',
        chance: 0.48,
        softGoalTarget: 1,
        saturatedMultiplier: 1.2,
        speedScale: 0.94,
        spread: 0.18,
      }),
    }),
  }),
  'capeverde-spain-clean-sheet': Object.freeze({
    id: 'capeverde-spain-clean-sheet',
    variantId: 'compliant-full',
    gameMode: 'coach',
    teamId: 'capeverde',
    opponentTeamId: 'spain',
    tacticalStances: Object.freeze({ red: 'park-bus', blue: 'all-out-attack' }),
    shotBias: Object.freeze({
      red: Object.freeze({
        mode: 'goal-channel',
        chance: 0.12,
        catchUpChance: 0.08,
        softGoalTarget: 1,
        saturatedMultiplier: 0.2,
        speedScale: 0.98,
        spread: 0.46,
      }),
      blue: Object.freeze({
        mode: 'keeper-channel',
        chance: 0.76,
        softGoalTarget: 0,
        saturatedMultiplier: 1.08,
        speedScale: 0.84,
        spread: 0.08,
      }),
    }),
  }),
})

export function resolveCompliantCaptureBias(options = {}) {
  return Object.values(COMPLIANT_CAPTURE_BIASES).find((profile) => (
    profile.variantId === options.variantId
    && profile.gameMode === options.gameMode
    && profile.teamId === options.teamId
    && profile.opponentTeamId === options.opponentTeamId
  )) || null
}
