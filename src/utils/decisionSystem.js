/**
 * 决策系统 — 本地计算，不依赖AI
 * 负责：场景选择、概率计算、结果解析
 */

import { DECISION_LIBRARY } from '../data/decisionLibrary.js';
import { createCoachDecisionEvent } from './coachDecisionEvent.js';

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

  // 对手质量修正：实力差对决策结果的影响要可见
  const attrDiff = normalizedAttr - opponentAvgDef;
  const opponentMult = Math.min(1.18, Math.max(0.78, 1.0 + attrDiff * 0.005));

  // 基础成功率
  const baseProb = 0.22 + (normalizedAttr / 99) * 0.52;

  // 最终概率
  const goldenMult = keyPlayer.isGolden ? 1.08 : 1.0;
  const difficultyModifier = {
    1: 0.04,
    2: 0.02,
    3: 0,
    4: -0.08,
    5: -0.22,
  }[teamDifficulty] ?? 0;
  return Math.min(0.86, Math.max(0.08, baseProb * formMult * clutchMult * goldenMult * opponentMult + teamDepthBonus + difficultyModifier));
}

/**
 * 根据选择结果决定outcome类型
 */
function resolveOutcome(choice, successProb) {
  const roll = Math.random();
  const isSuccess = roll < successProb;
  const outcomes = choice.possible_outcomes;
  const mid = getSuccessOutcomeCount(outcomes);
  const pool = isSuccess
    ? outcomes.slice(0, mid)
    : outcomes.slice(mid);
  return weightedOutcome(pool);
}

function isNegativeOutcomeName(outcome) {
  if (typeof outcome !== 'string') return false;
  if (outcome.includes('red_card') || outcome.includes('_penalty')) return true;
  if (outcome.startsWith('opponent_goal') || outcome.includes('goal_against')) return true;
  if (/(miss|saved|blocked|cleared|intercepted|lost|fail|wrong|offside|tackled|foul|violation|partial)/.test(outcome)) return true;
  if (outcome.startsWith('counter_') && outcome !== 'counter_chance') return true;
  return false;
}

function getSuccessOutcomeCount(outcomes) {
  const firstNegativeIndex = outcomes.findIndex(isNegativeOutcomeName);
  if (firstNegativeIndex > 0) return firstNegativeIndex;
  if (outcomes.length <= 3) return 1;
  return Math.ceil(outcomes.length / 2);
}

function outcomeWeight(outcome) {
  if (typeof outcome !== 'string') return 1;
  if (outcome.includes('red_card')) return 0.02;
  if (outcome.includes('yellow_card') && outcome.includes('penalty')) return 0.58;
  if (outcome.includes('yellow_card')) return 0.72;
  if (outcome.includes('penalty')) return 0.76;
  return 1;
}

function weightedOutcome(pool) {
  const weighted = pool.map(outcome => [outcome, outcomeWeight(outcome)]);
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [outcome, weight] of weighted) {
    roll -= weight;
    if (roll <= 0) return outcome;
  }
  return weighted[0]?.[0];
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
    pool.push(['wing_overlap_cross', 0.05]);
    pool.push(['central_cutback_press', 0.05]);
    pool.push(['half_space_through_run', 0.05]);
    pool.push(['low_block_counter_launch', 0.04]);
    pool.push(['midfield_switch_play', 0.04]);
    pool.push(['handball_penalty_claim', 0.03]);
    pool.push(['second_ball_corner_attack', 0.04]);
    pool.push(['set_piece_rebound_shot', 0.03]);
    pool.push(['penalty_rebound_followup', 0.02]);
    pool.push(['high_press_trap', 0.04]);
    if (minute >= 82 && scoreDiff < 0) pool.push(['late_keeper_up_corner', 0.05]);
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
    pool.push(['fullback_recovery_run', 0.06]);
    pool.push(['keeper_sweeper_claim', 0.05]);
    pool.push(['var_offside_goal', 0.02]);
    pool.push(['defensive_line_handball_var', 0.04]);
    pool.push(['opponent_dangerous_freekick_wall', 0.06]);
    pool.push(['opponent_short_corner_defense', 0.04]);
    pool.push(['injury_play_on', 0.03]);
    pool.push(['yellow_card_dissent_control', 0.03]);
    pool.push(['second_yellow_warning', 0.04]);
    pool.push(['weather_slippery_tackle', 0.04]);
    pool.push(['high_press_trap', 0.03]);
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
  // Better fallback: pick highest-rated outfield player, then any player
  const bestOutfield = lineup.filter(p => getPos(p) !== 'GK').sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
  const fallback = bestOutfield || lineup[0] || { name: '队长', position: 'FW', number: 10, sta: 80, tec: 70, spd: 70, phy: 70, def: 70 };
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
    wing_overlap_cross: { default: mfByTec, second: fwByPhy },
    central_cutback_press: { default: mfByTec, second: fwByTec },
    half_space_through_run: { default: mfByTec, second: fwBySpd },
    low_block_counter_launch: { default: mfByTec, second: fwBySpd },
    high_press_trap: { default: mfByDef, second: fwBySpd },
    midfield_switch_play: { default: mfByTec, second: fwBySpd },
    fullback_recovery_run: { default: dfByDef, second: gk },
    keeper_sweeper_claim: { default: gk, second: dfByDef },
    var_offside_goal: { default: fwByTec, second: mfByTec },
    defensive_line_handball_var: { default: dfByDef, second: gk },
    handball_penalty_claim: { default: fwByTec, second: mfByTec },
    second_ball_corner_attack: { default: mfByTec, second: fwByPhy },
    opponent_dangerous_freekick_wall: { default: gk, second: dfByPhy },
    opponent_short_corner_defense: { default: dfByDef, second: gk },
    set_piece_rebound_shot: { default: mfByTec, second: fwByPhy },
    penalty_rebound_followup: { default: fwBySpd, second: mfByTec },
    injury_play_on: { default: worstForm() },
    yellow_card_dissent_control: { default: mfByTec },
    second_yellow_warning: { default: dfByDef },
    late_keeper_up_corner: { default: gk, second: fwByPhy },
    weather_slippery_tackle: { default: dfByDef },
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
export function executeDecision(scenario, lineup, gameState, options = {}) {
  let keyPlayers = selectKeyPlayers(scenario, lineup);
  const preferredPlayer = options.preferredPlayerId
    ? lineup.find(player => player.id === options.preferredPlayerId)
    : null;
  if (preferredPlayer) {
    keyPlayers = { ...keyPlayers, default: preferredPlayer };
  }
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
  const coachDecisionEvent = createCoachDecisionEvent({
    scenario,
    minute: gameState.minute,
    team: gameState.team,
    opponent: gameState.opponentName,
    keyPlayers,
    options: enrichedChoices,
    situation,
  });

  return {
    scenario,
    situation: coachDecisionEvent?.situation || situation,
    choices: enrichedChoices,
    keyPlayers,
    animation_type: scenario.animation_type,
    coachDecisionEvent,
  };
}

/**
 * 解析玩家选择的结果
 */
// 默认进球转化率：成功池里的 goal 结果不必然转化为进球，
// 让决策进球占全场进球的比例落在 25-35% 的真实区间。
// 选项可用 goal_conversion / conversion_miss_outcome 单独覆盖。
const DEFAULT_GOAL_CONVERSION = 0.62

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
  ) + Number(gameState.moraleBonus || 0);
  let outcome = resolveOutcome(choice, successProb);

  // 计算比分变化
  let homeScoreChange = 0;
  let awayScoreChange = 0;

  // 进球判定
  const goalOutcomes = ['goal', 'goal_chip', 'goal_header', 'goal_freekick', 'goal_long',
    'goal_panenka', 'goal_power', 'goal_assist', 'goal_tap_in', 'goal_volley',
    'goal_near_post', 'goal_second_ball', 'goal_far_header', 'goal_short_corner',
    'goal_through', 'goal_reorganized', 'goal_combo', 'goal_cross', 'goal_closer',
    'comeback_goal', 'late_equalizer', 'sealed_win', 'golden_goal', 'goal_placement'];
  const goalAgainstOutcomes = [
    'counter_sealed',
    'counter_equalizer',
    'counter_golden_goal',
    'goal_against',
    'goal_chip_over',
    'goal_corner',
    'goal_tight_angle',
    'goal_zone_gap',
  ];

  // 进球转化率与选择质量挂钩：高质量选择执行更到位，
  // 最优与最差选择的决策进球差距应显著（用户主导比赛走向）。
  // 只作用于本方进攻进球，不影响防守场景的失球判定。
  // 球队档位同时影响转化：弱队即使决策正确，执行成色也低于强队。
  // 未转化时必须落到该选项合法结果池内的未进分支，
  // 否则导演会因为结果分支不存在而冻结比赛。
  const baseConversion = typeof choice.goal_conversion === 'number'
    ? choice.goal_conversion
    : DEFAULT_GOAL_CONVERSION;
  const teamTierFactor = Math.min(1.25, Math.max(0.5, (teamAvgRating - 72) / 12));
  const goalConversion = Math.min(0.92, baseConversion * (successProb * 2.0 - 0.5) * teamTierFactor);
  if (goalOutcomes.includes(outcome) && Math.random() > goalConversion) {
    const missOutcome = choice.conversion_miss_outcome
      || choice.possible_outcomes.find((candidate) => (
        /saved|miss|blocked|post|wide|over|cleared|claim|punch|hit_wall|deflected/.test(candidate)
      ));
    if (missOutcome) outcome = missOutcome;
  }
  const isSuccess = choice.possible_outcomes.indexOf(outcome) < getSuccessOutcomeCount(choice.possible_outcomes);

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
