/**
 * 决策系统 — 本地计算，不依赖AI
 * 负责：场景选择、概率计算、结果解析
 */

import { DECISION_LIBRARY } from '../data/decisionLibrary.js';

/**
 * 计算某个选项的成功概率
 * @param {Object} choice - 选项配置
 * @param {Object} keyPlayer - 执行球员
 * @param {boolean} isKnockout - 是否淘汰赛
 * @param {boolean} isExtraTime - 是否加时
 * @param {number} opponentAvgDef - 对手平均防守值 (默认70)
 * @param {number} teamDepthBonus - 球队深度加成 (0-0.08，默认0)
 */
function calcSuccessProb(
  choice,
  keyPlayer,
  isKnockout,
  isExtraTime,
  opponentAvgDef = 70,
  teamDepthBonus = 0,
  teamDifficulty = 3,
) {
  if (!keyPlayer) return 0.5;

  const formMult = Math.max(0.75, (keyPlayer.sta || 80) / 100);

  // 淘汰赛/加时赛关键时刻系数
  const clutchMap = { 5: 1.20, 4: 1.12, 3: 1.05, 2: 1.00, 1: 0.92 };
  const clutchStars = keyPlayer.star || 3;
  const clutchMult = (isKnockout || isExtraTime)
    ? (clutchMap[clutchStars] ?? 1.0)
    : 1.0;

  // 按公式加权求和
  let weightedSum = 0;
  let totalWeight = 0;
  for (const { attr, weight } of choice.weight_formula) {
    let value;
    if (attr === 'height') {
      const height = typeof keyPlayer.height === 'string'
        ? Number.parseInt(keyPlayer.height, 10)
        : keyPlayer.height;
      value = height ? Math.min(99, height - 160) : 50;
    } else if (attr === 'form') {
      value = keyPlayer.sta || 80;
    } else {
      value = keyPlayer[attr] ?? 70;
    }
    weightedSum += value * weight;
    totalWeight += weight;
  }
  const normalizedAttr = totalWeight > 0 ? weightedSum / totalWeight : 70;

  // 对手质量修正：温和版
  const attrDiff = normalizedAttr - opponentAvgDef;
  const opponentMult = Math.min(1.12, Math.max(0.85, 1.0 + attrDiff * 0.003));

  // 基础成功率
  const baseProb = 0.30 + (normalizedAttr / 99) * 0.60;

  // 最终概率
  const goldenMult = keyPlayer.isGolden ? 1.08 : 1.0;
  const difficultyModifier = {
    1: 0.04,
    2: 0.02,
    3: 0,
    4: -0.08,
    5: -0.22,
  }[teamDifficulty] ?? 0;
  return Math.min(0.90, Math.max(0.10, baseProb * formMult * clutchMult * goldenMult * opponentMult + teamDepthBonus + difficultyModifier));
}

/**
 * 根据选择结果决定outcome类型
 */
function resolveOutcome(choice, successProb) {
  const roll = Math.random();
  const isSuccess = roll < successProb;
  const outcomes = choice.possible_outcomes;
  const mid = Math.ceil(outcomes.length / 2);
  const pool = isSuccess
    ? outcomes.slice(0, mid)
    : outcomes.slice(mid);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 根据比赛局势选择合适的决策场景
 */
export function selectScenario(minute, gameState) {
  const { scoreDiff, isExtraTime } = gameState;

  // 特殊场景优先
  if (isExtraTime && minute >= 115)
    return findScenario('extra_time_penalty_shootout_prep');
  if (scoreDiff > 0 && minute >= 78)
    return findScenario('leading_protect');
  if (scoreDiff < 0 && minute >= 75)
    return findScenario('trailing_last_ten');

  // 按局势分配权重
  const attackAdvantage = (gameState.myAttack || 70) > (gameState.oppDefense || 70) * 1.05;

  const pool = [];
  if (attackAdvantage) {
    pool.push(['solo_run_penalty', 0.16]);
    pool.push(['penalty_area_cross', 0.14]);
    pool.push(['counter_attack_3v2', 0.12]);
    pool.push(['through_ball_chance', 0.10]);
    pool.push(['freekick_dangerous', 0.09]);
    pool.push(['long_shot_opportunity', 0.07]);
    pool.push(['header_corner', 0.06]);
    pool.push(['midfield_press_trigger', 0.05]);
    pool.push(['penalty_area_foul_risk', 0.12]);
    pool.push(['indirect_freekick_box', 0.08]);
    pool.push(['match_penalty', 0.18]);
    pool.push(['defender_last_ditch', 0.04]);
    pool.push(['throwin_attack', 0.04]);
    pool.push(['var_goal_review', 0.03]);
    pool.push(['penalty_area_dive', 0.13]);
    pool.push(['var_penalty_review', 0.10]);
    pool.push(['keeper_distribution', 0.03]);
    pool.push(['midfield_second_ball', 0.04]);
    pool.push(['box_scramble_clearance', 0.03]);
    pool.push(['box_second_ball_chaos', 0.03]);
  } else {
    pool.push(['penalty_area_foul_risk', 0.18]);
    pool.push(['gk_one_on_one', 0.12]);
    pool.push(['last_defender_tackle', 0.10]);
    pool.push(['tactical_foul_counter', 0.12]);
    pool.push(['aerial_duel_corner_defending', 0.08]);
    pool.push(['defend_dangerous_freekick', 0.11]);
    pool.push(['offside_trap', 0.08]);
    pool.push(['counter_attack_3v2', 0.08]);
    pool.push(['stamina_collapse_sub', 0.06]);
    pool.push(['defender_last_ditch', 0.08]);
    pool.push(['match_penalty', 0.07]);
    pool.push(['indirect_freekick_box', 0.06]);
    pool.push(['throwin_attack', 0.03]);
    pool.push(['keeper_distribution', 0.05]);
    pool.push(['midfield_second_ball', 0.05]);
    pool.push(['box_scramble_clearance', 0.06]);
    pool.push(['var_goal_review', 0.02]);
  }

  const scenarioId = weightedRandom(pool);
  return findScenario(scenarioId);
}

function findScenario(id) {
  return DECISION_LIBRARY.find(s => s.id === id) || DECISION_LIBRARY[0];
}

/**
 * 选择关键球员
 */
export function selectKeyPlayers(scenario, lineup) {
  const getPos = (player) => player?.position || player?.pos;
  const fallback = lineup[0] || { name: '球员', position: 'FW', number: 10, sta: 80, tec: 70, spd: 70, phy: 70, def: 70 };
  const topPlayer = (pos, scoreFn) => {
    const filtered = lineup.filter(p => getPos(p) === pos);
    if (!filtered.length) return fallback;
    return filtered.reduce((best, p) => (scoreFn(p) > scoreFn(best)) ? p : best);
  };

  const worstForm = () => {
    const outfield = lineup.filter(p => getPos(p) !== 'GK');
    if (!outfield.length) return fallback;
    return outfield.reduce((worst, p) => (p.sta || 80) < (worst.sta || 80) ? p : worst);
  };

  const fwBySpd = topPlayer('FW', p => (p.spd || 70) * ((p.sta || 80) / 100));
  const fwByTec = topPlayer('FW', p => (p.tec || 70) * ((p.sta || 80) / 100));
  const fwByPhy = topPlayer('FW', p => p.phy || 70);
  const mfByTec = topPlayer('MF', p => (p.tec || 70) * ((p.sta || 80) / 100));
  const mfByDef = topPlayer('MF', p => (p.def || 70) * ((p.sta || 80) / 100));
  const dfByDef = topPlayer('DF', p => (p.def || 70) * ((p.sta || 80) / 100));
  const dfByPhy = topPlayer('DF', p => p.phy || 70);
  const gk = lineup.find(p => getPos(p) === 'GK') || fallback;

  const maps = {
    solo_run_penalty: { default: fwBySpd, second: mfByTec },
    penalty_area_cross: { default: mfByTec, second: fwByPhy },
    counter_attack_3v2: { default: fwBySpd, second: mfByTec },
    freekick_dangerous: { default: mfByTec },
    penalty_kick: { default: fwByTec },
    long_shot_opportunity: { default: mfByTec },
    header_corner: { default: fwByPhy, second: fwByTec },
    through_ball_chance: { default: mfByTec, second: fwBySpd },
    penalty_area_foul_risk: { default: dfByDef },
    gk_one_on_one: { default: gk },
    last_defender_tackle: { default: dfByDef },
    midfield_press_trigger: { default: mfByDef },
    tactical_foul_counter: { default: mfByDef },
    aerial_duel_corner_defending: { default: dfByPhy },
    offside_trap: { default: dfByDef },
    stamina_collapse_sub: { default: worstForm() },
    trailing_last_ten: { default: fwByTec },
    leading_protect: { default: mfByTec },
    extra_time_penalty_shootout_prep: { default: fwByTec },
    penalty_shootout_round: { default: fwByTec },
    indirect_freekick_box: { default: mfByTec, second: fwByPhy },
    match_penalty: { default: fwByTec },
    penalty_area_dive: { default: fwByTec, second: mfByTec },
    var_penalty_review: { default: fwByTec, second: mfByTec },
    defend_dangerous_freekick: { default: gk, second: dfByPhy },
    defender_last_ditch: { default: dfByDef },
    throwin_attack: { default: mfByTec, second: fwByPhy },
    var_goal_review: { default: fwByTec, second: mfByTec },
    keeper_distribution: { default: gk, second: fwByPhy },
    midfield_second_ball: { default: mfByDef, second: mfByTec },
    box_scramble_clearance: { default: dfByDef, second: gk },
    box_second_ball_chaos: { default: dfByDef, second: gk },
  };

  return maps[scenario.id] || { default: fwByTec };
}

/**
 * 填充模板中的占位符
 */
function fillTemplate(template, keyPlayers, gameState) {
  const playerName = keyPlayers.default?.name || keyPlayers.default?.player?.name || '队长';
  const player2Name = keyPlayers.second?.name || keyPlayers.second?.player?.name || '搭档';
  return template
    .replace(/\{player\}/g, playerName)
    .replace(/\{player2\}/g, player2Name)
    .replace(/\{opponent\}/g, (gameState.opponentName || '对方') + '前锋')
    .replace(/\{minute\}/g, String(gameState.minute || 60))
    .replace(/\{diff\}/g, String(Math.abs(gameState.scoreDiff || 0)))
    .replace(/\{remaining\}/g, String(90 - (gameState.minute || 60)))
    .replace(/\{score\}/g, `${gameState.myScore || 0}:${gameState.oppScore || 0}`);
}

/**
 * 加权随机选择
 */
function weightedRandom(pool) {
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of pool) {
    r -= w;
    if (r <= 0) return id;
  }
  return pool[0][0];
}

/**
 * 判断是否触发决策（全场约6次，最多8次）
 */
export function shouldTriggerDecision(
  minute,
  triggeredThisHalf,
  lastDecisionMinute = -Infinity,
  minGap = 8,
  randomFn = Math.random,
) {
  if (triggeredThisHalf >= 4) return false; // 每半场最多4次，全场6-8次
  if (minute < 8) return false;
  if (minute - lastDecisionMinute < minGap) return false;
  return randomFn() < 0.17;
}

/**
 * 执行完整的决策流程
 */
export function executeDecision(scenario, lineup, gameState) {
  const keyPlayers = selectKeyPlayers(scenario, lineup);
  const isKnockout = gameState.isKnockout || false;
  const isExtraTime = gameState.minute > 90;

  // 为每个选项计算成功概率和提示
  const enrichedChoices = scenario.choices.map(choice => {
    const keyPlayer = keyPlayers.default;
    const successProb = calcSuccessProb(
      choice,
      keyPlayer,
      isKnockout,
      isExtraTime,
      gameState.oppDefense || 70,
      0,
      gameState.teamDifficulty || 3,
    );
    return {
      ...choice,
      successProb,
      keyPlayerName: keyPlayer?.name || '队员',
      successHint: successProb > 0.70 ? '把握较大'
        : successProb > 0.50 ? '各有胜负'
        : successProb > 0.35 ? '风险较高'
        : '险中求胜',
    };
  });

  // 替换情境文字中的占位符
  const variant = scenario.situation_variants[
    Math.floor(Math.random() * scenario.situation_variants.length)
  ];
  const situation = fillTemplate(variant, keyPlayers, gameState);

  return {
    scenario,
    situation,
    choices: enrichedChoices,
    keyPlayers,
    animation_type: scenario.animation_type,
  };
}

/**
 * 解析玩家选择的结果
 */
export function resolveChoiceResult(choice, keyPlayer, gameState) {
  const isKnockout = gameState.isKnockout || false;
  const isExtraTime = gameState.minute > 90;
  const opponentAvgDef = gameState.oppDefense || 70;
  // 球队深度加成：全队平均rating越高，加成越大（max +0.06）
  const teamAvgRating = gameState.teamAvgRating || 70;
  const teamDepthBonus = Math.min(0.06, Math.max(0, (teamAvgRating - 70) * 0.006));
  const successProb = calcSuccessProb(
    choice,
    keyPlayer,
    isKnockout,
    isExtraTime,
    opponentAvgDef,
    teamDepthBonus,
    gameState.teamDifficulty || 3,
  );
  let outcome = resolveOutcome(choice, successProb);
  if (
    typeof choice.goal_conversion === 'number'
    && outcome.startsWith('goal')
    && Math.random() > choice.goal_conversion
  ) {
    outcome = choice.conversion_miss_outcome || 'saved';
  }
  const isSuccess = choice.possible_outcomes.indexOf(outcome) < Math.ceil(choice.possible_outcomes.length / 2);

  // 计算比分变化
  let homeScoreChange = 0;
  let awayScoreChange = 0;

  // 进球判定
  const goalOutcomes = ['goal', 'goal_chip', 'goal_header', 'goal_freekick', 'goal_long',
    'goal_panenka', 'goal_power', 'goal_assist', 'goal_tap_in', 'goal_volley',
    'goal_near_post', 'goal_second_ball', 'goal_far_header', 'goal_short_corner',
    'goal_through', 'goal_reorganized', 'goal_combo', 'goal_cross', 'goal_closer',
    'comeback_goal', 'late_equalizer', 'sealed_win', 'golden_goal', 'goal_placement'];
  const goalAgainstOutcomes = ['counter_sealed', 'counter_golden_goal', 'goal_against'];

  if (goalOutcomes.includes(outcome)) homeScoreChange = 1;
  if (goalAgainstOutcomes.includes(outcome) || outcome?.startsWith('opponent_goal')) awayScoreChange = 1;

  return {
    outcome,
    successProb,
    isSuccess,
    homeScoreChange,
    awayScoreChange,
  };
}

export function resolveMatchPenaltyChoice(choice, keyPlayer, gameState = {}, randomFn = Math.random) {
  const technique = keyPlayer?.tec || 70
  const composure = keyPlayer?.sta || 70
  const starBonus = Math.max(0, (keyPlayer?.star || 3) - 3) * 0.02
  const pressurePenalty = gameState.isKnockout || gameState.minute >= 75 ? 0.02 : 0
  const isPanenka = choice?.id === 'penalty_center'
  const baseGoalChance = isPanenka ? 0.64 : 0.76
  const goalChance = Math.min(
    isPanenka ? 0.80 : 0.90,
    Math.max(
      isPanenka ? 0.55 : 0.68,
      baseGoalChance
        + (technique - 70) * 0.003
        + (composure - 70) * 0.0015
        + starBonus
        - pressurePenalty,
    ),
  )
  const missChance = Math.min(
    isPanenka ? 0.12 : 0.08,
    Math.max(0.04, (isPanenka ? 0.09 : 0.06) - (technique - 70) * 0.001),
  )
  const roll = randomFn()
  let outcome

  if (roll < goalChance) {
    outcome = choice?.id === 'penalty_right'
      ? 'goal_power'
      : isPanenka ? 'goal_panenka' : 'goal_placement'
  } else if (roll >= 1 - missChance) {
    outcome = choice?.id === 'penalty_right'
      ? 'miss_wide_power'
      : isPanenka ? 'miss_panenka' : 'miss_post'
  } else {
    outcome = choice?.id === 'penalty_right'
      ? 'saved_power'
      : isPanenka ? 'saved_panenka' : 'saved_placement'
  }

  const scored = outcome.startsWith('goal')
  return {
    outcome,
    successProb: goalChance,
    isSuccess: scored,
    homeScoreChange: scored ? 1 : 0,
    awayScoreChange: 0,
  }
}

export function outcomeConcedesPenalty(outcome) {
  return typeof outcome === 'string' && outcome.includes('_penalty')
}

export function outcomeWinsPenalty(outcome) {
  return outcome === 'penalty_won' || outcome === 'penalty_awarded'
}

export function resolveDiveChoice(choice, keyPlayer, gameState = {}, randomFn = Math.random) {
  const technique = keyPlayer?.tec || 70
  const composure = keyPlayer?.sta || 70
  const starBonus = (keyPlayer?.star || 3) >= 4 ? 0.04 : 0
  const varPressure = gameState.isKnockout ? -0.03 : 0
  const basePenaltyProb = choice?.id === 'simulate_contact'
    ? 0.34 + (technique - 70) * 0.0045 + (composure - 70) * 0.002 + starBonus + varPressure
    : 0.10
  const penaltyProb = Math.min(0.58, Math.max(0.18, basePenaltyProb))
  const yellowProb = choice?.id === 'simulate_contact'
    ? Math.min(0.38, Math.max(0.12, 0.24 - (technique - 70) * 0.002))
    : 0.06
  const roll = randomFn()
  let outcome = 'play_on_lost'
  if (roll < penaltyProb) outcome = 'penalty_won'
  else if (roll > 1 - yellowProb) outcome = 'yellow_card_dive'
  else if (choice?.id !== 'simulate_contact') outcome = 'shot_blocked'

  return {
    outcome,
    successProb: penaltyProb,
    isSuccess: outcome === 'penalty_won',
    homeScoreChange: 0,
    awayScoreChange: 0,
  }
}

export function resolveOpponentPenaltyChoice(choice, goalkeeper, gameState = {}, randomFn = Math.random) {
  const keeperScore = (goalkeeper?.def || 70) * 0.55 + (goalkeeper?.spd || 70) * 0.25 + (goalkeeper?.sta || 70) * 0.20
  const defenseSupport = gameState.myDefense ? (gameState.myDefense - 70) * 0.002 : 0
  const pressurePenalty = gameState.isKnockout || gameState.minute >= 75 ? -0.03 : 0
  const saveProb = Math.min(0.58, Math.max(0.16, 0.30 + (keeperScore - 70) * 0.004 + defenseSupport + pressurePenalty))
  const saved = randomFn() < saveProb
  const side = choice?.side || 'center'
  return {
    outcome: saved ? `opponent_saved_${side}` : `opponent_goal_${side}`,
    successProb: saveProb,
    isSuccess: saved,
    homeScoreChange: 0,
    awayScoreChange: saved ? 0 : 1,
  }
}
