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
export function calcSuccessProb(choice, keyPlayer, isKnockout, isExtraTime, opponentAvgDef = 70, teamDepthBonus = 0) {
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
  return Math.min(0.90, Math.max(0.10, baseProb * formMult * clutchMult * goldenMult * opponentMult + teamDepthBonus));
}

/**
 * 根据选择结果决定outcome类型
 */
export function resolveOutcome(choice, successProb) {
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
    pool.push(['solo_run_penalty', 0.14]);
    pool.push(['penalty_area_cross', 0.15]);
    pool.push(['counter_attack_3v2', 0.12]);
    pool.push(['through_ball_chance', 0.10]);
    pool.push(['freekick_dangerous', 0.08]);
    pool.push(['long_shot_opportunity', 0.07]);
    pool.push(['header_corner', 0.06]);
    pool.push(['midfield_press_trigger', 0.05]);
    pool.push(['penalty_area_foul_risk', 0.05]);
    pool.push(['indirect_freekick_box', 0.06]);
    pool.push(['match_penalty', 0.04]);
    pool.push(['defender_last_ditch', 0.04]);
    pool.push(['throwin_attack', 0.04]);
    pool.push(['var_goal_review', 0.03]);
    pool.push(['keeper_distribution', 0.03]);
    pool.push(['midfield_second_ball', 0.04]);
    pool.push(['box_scramble_clearance', 0.03]);
  } else {
    pool.push(['penalty_area_foul_risk', 0.15]);
    pool.push(['gk_one_on_one', 0.12]);
    pool.push(['last_defender_tackle', 0.10]);
    pool.push(['tactical_foul_counter', 0.12]);
    pool.push(['aerial_duel_corner_defending', 0.08]);
    pool.push(['offside_trap', 0.08]);
    pool.push(['counter_attack_3v2', 0.08]);
    pool.push(['stamina_collapse_sub', 0.06]);
    pool.push(['defender_last_ditch', 0.08]);
    pool.push(['match_penalty', 0.05]);
    pool.push(['indirect_freekick_box', 0.05]);
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
  const topPlayer = (pos, scoreFn) => {
    const filtered = lineup.filter(p => getPos(p) === pos);
    if (!filtered.length) return lineup[0];
    return filtered.reduce((best, p) => (scoreFn(p) > scoreFn(best)) ? p : best);
  };

  const worstForm = () => {
    return lineup
      .filter(p => getPos(p) !== 'GK')
      .reduce((worst, p) => (p.sta || 80) < (worst.sta || 80) ? p : worst);
  };

  const fwBySpd = topPlayer('FW', p => (p.spd || 70) * ((p.sta || 80) / 100));
  const fwByTec = topPlayer('FW', p => (p.tec || 70) * ((p.sta || 80) / 100));
  const fwByPhy = topPlayer('FW', p => p.phy || 70);
  const mfByTec = topPlayer('MF', p => (p.tec || 70) * ((p.sta || 80) / 100));
  const mfByDef = topPlayer('MF', p => (p.def || 70) * ((p.sta || 80) / 100));
  const dfByDef = topPlayer('DF', p => (p.def || 70) * ((p.sta || 80) / 100));
  const dfByPhy = topPlayer('DF', p => p.phy || 70);
  const gk = lineup.find(p => getPos(p) === 'GK') || lineup[0];

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
    defender_last_ditch: { default: dfByDef },
    throwin_attack: { default: mfByTec, second: fwByPhy },
    var_goal_review: { default: fwByTec, second: mfByTec },
    keeper_distribution: { default: gk, second: fwByPhy },
    midfield_second_ball: { default: mfByDef, second: mfByTec },
    box_scramble_clearance: { default: dfByDef, second: gk },
  };

  return maps[scenario.id] || { default: fwByTec };
}

/**
 * 填充模板中的占位符
 */
export function fillTemplate(template, keyPlayers, gameState) {
  return template
    .replace(/\{player\}/g, keyPlayers.default?.name || '队长')
    .replace(/\{player2\}/g, keyPlayers.second?.name || '搭档')
    .replace(/\{opponent\}/g, (gameState.opponentName || '对方') + '前锋')
    .replace(/\{minute\}/g, String(gameState.minute || 60))
    .replace(/\{diff\}/g, String(Math.abs(gameState.scoreDiff || 0)))
    .replace(/\{remaining\}/g, String(90 - (gameState.minute || 60)))
    .replace(/\{score\}/g, `${gameState.myScore || 0}:${gameState.oppScore || 0}`);
}

/**
 * 加权随机选择
 */
export function weightedRandom(pool) {
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of pool) {
    r -= w;
    if (r <= 0) return id;
  }
  return pool[0][0];
}

/**
 * 判断是否触发决策（全场5-6次）
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
  return randomFn() < 0.07;
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
    const successProb = calcSuccessProb(choice, keyPlayer, isKnockout, isExtraTime);
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
  const teamDepthBonus = Math.max(0, (teamAvgRating - 70) * 0.006);
  const successProb = calcSuccessProb(choice, keyPlayer, isKnockout, isExtraTime, opponentAvgDef, teamDepthBonus);
  const outcome = resolveOutcome(choice, successProb);
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
  if (goalAgainstOutcomes.includes(outcome)) awayScoreChange = 1;

  return {
    outcome,
    successProb,
    isSuccess,
    homeScoreChange,
    awayScoreChange,
  };
}
