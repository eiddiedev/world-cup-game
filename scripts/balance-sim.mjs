#!/usr/bin/env node
/**
 * 剑指美加墨 — 数值平衡 Monte Carlo 模拟 (自包含版)
 *
 * 运行方式:
 *   node scripts/balance-sim.mjs --teams france,curacao --runs 20 --strategy balanced
 *   node scripts/balance-sim.mjs --teams all --runs 100 --strategy balanced
 *   node scripts/balance-sim.mjs --teams france,curacao --runs 300 --strategy strongest
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── 参数解析 ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const rawTeamIds = getArg('teams', 'france,curacao');
const totalRuns = parseInt(getArg('runs', '20'), 10);
const strategy = getArg('strategy', 'balanced');

// ─── 从源码加载球员数据 ──────────────────────────────────────────────────────

function loadPlayerData() {
  const playersDir = join(ROOT, 'src/data/players');
  const files = ['france.js', 'brazil.js', 'argentina.js', 'portugal.js', 'germany.js',
    'japan.js', 'norway.js', 'morocco.js', 'newzealand.js', 'curacao.js'];

  const allPlayers = {};
  for (const file of files) {
    try {
      const content = readFileSync(join(playersDir, file), 'utf-8');
      // 提取 export const xxxPlayers = [...]
      const match = content.match(/export\s+const\s+(\w+Players)\s*=\s*\[/);
      if (!match) continue;
      const varName = match[1];
      // 使用 eval 加载（受限环境）
      const arrayStart = content.indexOf('[');
      const arrayEnd = content.lastIndexOf(']');
      const arrayStr = content.slice(arrayStart, arrayEnd + 1);
      // 替换 export 语句
      const evalCode = `const ${varName} = ${arrayStr}; ${varName};`;
      allPlayers[file.replace('.js', '')] = eval(evalCode);
    } catch (e) {
      console.error(`  ⚠️ 加载 ${file} 失败: ${e.message}`);
    }
  }
  return allPlayers;
}

// ─── 球队定义 ────────────────────────────────────────────────────────────────

const TEAM_DEFS = {
  france: { name: '法国', difficulty: 1, budget: 2300, skill: '巴黎之魂' },
  brazil: { name: '巴西', difficulty: 1, budget: 2250, skill: '桑巴节奏' },
  argentina: { name: '阿根廷', difficulty: 2, budget: 2100, skill: '绝境反击' },
  portugal: { name: '葡萄牙', difficulty: 2, budget: 2050, skill: 'CR光环' },
  germany: { name: '德国', difficulty: 3, budget: 1950, skill: '日耳曼机器' },
  japan: { name: '日本', difficulty: 3, budget: 1850, skill: '高压逼抢' },
  norway: { name: '挪威', difficulty: 4, budget: 1700, skill: '北欧巨人' },
  morocco: { name: '摩洛哥', difficulty: 4, budget: 1800, skill: '沙漠之狐' },
  newzealand: { name: '新西兰', difficulty: 5, budget: 1280, skill: '全黑魂' },
  curacao: { name: '库拉索', difficulty: 5, budget: 1170, skill: '海岛之心' },
};

const TEAM_SCHEDULES = {
  france: [
    { round: 1, opponent: '伊拉克', strength: 'weak' },
    { round: 2, opponent: '塞内加尔', strength: 'medium' },
    { round: 3, opponent: '挪威', strength: 'medium' },
  ],
  brazil: [
    { round: 1, opponent: '摩洛哥', strength: 'strong' },
    { round: 2, opponent: '海地', strength: 'weak' },
    { round: 3, opponent: '苏格兰', strength: 'medium' },
  ],
  argentina: [
    { round: 1, opponent: '约旦', strength: 'weak' },
    { round: 2, opponent: '奥地利', strength: 'medium' },
    { round: 3, opponent: '阿尔及利亚', strength: 'medium' },
  ],
  portugal: [
    { round: 1, opponent: '刚果民主共和国', strength: 'weak' },
    { round: 2, opponent: '乌兹别克斯坦', strength: 'medium' },
    { round: 3, opponent: '哥伦比亚', strength: 'strong' },
  ],
  germany: [
    { round: 1, opponent: '库拉索', strength: 'weak' },
    { round: 2, opponent: '科特迪瓦', strength: 'medium' },
    { round: 3, opponent: '厄瓜多尔', strength: 'medium' },
  ],
  japan: [
    { round: 1, opponent: '荷兰', strength: 'strong' },
    { round: 2, opponent: '突尼斯', strength: 'medium' },
    { round: 3, opponent: '瑞典', strength: 'medium' },
  ],
  norway: [
    { round: 1, opponent: '塞内加尔', strength: 'medium' },
    { round: 2, opponent: '伊拉克', strength: 'weak' },
    { round: 3, opponent: '法国', strength: 'strong' },
  ],
  morocco: [
    { round: 1, opponent: '巴西', strength: 'strong' },
    { round: 2, opponent: '海地', strength: 'weak' },
    { round: 3, opponent: '苏格兰', strength: 'medium' },
  ],
  newzealand: [
    { round: 1, opponent: '比利时', strength: 'strong' },
    { round: 2, opponent: '埃及', strength: 'medium' },
    { round: 3, opponent: '伊朗', strength: 'medium' },
  ],
  curacao: [
    { round: 1, opponent: '德国', strength: 'strong' },
    { round: 2, opponent: '科特迪瓦', strength: 'medium' },
    { round: 3, opponent: '厄瓜多尔', strength: 'medium' },
  ],
};

// ─── 决策库（从源码提取关键数据） ────────────────────────────────────────────

const DECISION_SCENARIOS = {
  attack: [
    { id: 'solo_run', weight: 0.18, outcomes: ['goal', 'goal', 'goal', 'saved', 'miss'] },
    { id: 'cross', weight: 0.20, outcomes: ['goal', 'goal', 'saved', 'cleared'] },
    { id: 'counter', weight: 0.15, outcomes: ['goal', 'goal', 'tackled', 'saved'] },
    { id: 'through_ball', weight: 0.12, outcomes: ['goal', 'goal', 'offside', 'gk_claim'] },
    { id: 'freekick', weight: 0.08, outcomes: ['goal', 'saved', 'wall', 'miss'] },
    { id: 'long_shot', weight: 0.08, outcomes: ['goal', 'saved', 'miss', 'miss'] },
    { id: 'corner', weight: 0.07, outcomes: ['goal', 'saved', 'cleared', 'cleared'] },
    { id: 'press', weight: 0.07, outcomes: ['intercept', 'failed', 'cleared'] },
    { id: 'foul_risk', weight: 0.05, outcomes: ['tackle', 'yellow', 'miss', 'red'] },
  ],
  defend: [
    { id: 'foul_risk', weight: 0.20, outcomes: ['safe', 'yellow', 'goal_against', 'red'] },
    { id: 'gk_one_on_one', weight: 0.15, outcomes: ['save', 'goal_against', 'claim'] },
    { id: 'last_man', weight: 0.12, outcomes: ['safe', 'red', 'goal_against'] },
    { id: 'tactical_foul', weight: 0.15, outcomes: ['safe', 'yellow', 'goal_against'] },
    { id: 'aerial', weight: 0.10, outcomes: ['safe', 'goal_against', 'cleared'] },
    { id: 'offside', weight: 0.10, outcomes: ['safe', 'goal_against', 'intercept'] },
    { id: 'counter', weight: 0.10, outcomes: ['goal', 'tackled', 'saved'] },
    { id: 'sub', weight: 0.08, outcomes: ['positive', 'neutral', 'negative'] },
  ],
};

const GOAL_OUTCOMES = new Set([
  'goal', 'goal_chip', 'goal_header', 'goal_freekick', 'goal_long',
  'goal_panenka', 'goal_power', 'goal_assist', 'goal_tap_in', 'goal_volley',
  'comeback_goal', 'late_equalizer', 'sealed_win', 'golden_goal',
]);
const GOAL_AGAINST_OUTCOMES = new Set(['goal_against', 'counter_sealed', 'counter_golden_goal']);

// ─── 阵型系数 ────────────────────────────────────────────────────────────────

const FORMATIONS = {
  '4-3-3': { attack: 1.15, defense: 0.95, midfield: 1.0 },
  '4-4-2': { attack: 1.0, defense: 1.0, midfield: 1.1 },
  '3-4-3': { attack: 1.25, defense: 0.8, midfield: 1.05 },
  '5-4-1': { attack: 0.8, defense: 1.25, midfield: 1.05 },
};

// ─── 核心数学函数（与 game 完全一致） ─────────────────────────────────────────

function calcSuccessProb(choice, keyPlayer, isKnockout, opponentAvgDef = 70, teamDepthBonus = 0) {
  if (!keyPlayer) return 0.5;

  const formMult = Math.max(0.75, (keyPlayer.sta || 80) / 100);
  const clutchMap = { 5: 1.20, 4: 1.12, 3: 1.05, 2: 1.00, 1: 0.92 };
  const clutchMult = isKnockout ? (clutchMap[keyPlayer.star || 3] ?? 1.0) : 1.0;

  const attrs = [
    { value: keyPlayer.tec || 70, weight: 0.35 },
    { value: keyPlayer.spd || 70, weight: 0.25 },
    { value: keyPlayer.phy || 70, weight: 0.20 },
    { value: keyPlayer.def || 70, weight: 0.10 },
    { value: keyPlayer.sta || 80, weight: 0.10 },
  ];
  let weightedSum = 0, totalWeight = 0;
  for (const { value, weight } of attrs) {
    weightedSum += value * weight;
    totalWeight += weight;
  }
  const normalizedAttr = weightedSum / totalWeight;

  const attrDiff = normalizedAttr - opponentAvgDef;
  const opponentMult = Math.min(1.12, Math.max(0.85, 1.0 + attrDiff * 0.003));

  const baseProb = 0.30 + (normalizedAttr / 99) * 0.60;
  const goldenMult = keyPlayer.isGolden ? 1.08 : 1.0;

  return Math.min(0.90, Math.max(0.10, baseProb * formMult * clutchMult * goldenMult * opponentMult + teamDepthBonus));
}

function resolveOutcome(outcomes, successProb) {
  const roll = Math.random();
  const isSuccess = roll < successProb;
  const mid = Math.ceil(outcomes.length / 2);
  const pool = isSuccess ? outcomes.slice(0, mid) : outcomes.slice(mid);
  return pool[Math.floor(Math.random() * pool.length)];
}

function weightedRandom(pool) {
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of pool) {
    r -= w;
    if (r <= 0) return id;
  }
  return pool[0][0];
}

// ─── 选人策略 ────────────────────────────────────────────────────────────────

function selectPlayersStrongest(players, budget) {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const selected = [];
  let spent = 0;

  const gks = sorted.filter(p => p.position === 'GK');
  if (gks.length > 0 && spent + gks[0].price <= budget) {
    selected.push(gks[0]);
    spent += gks[0].price;
  }

  for (const p of sorted) {
    if (selected.find(s => s.id === p.id)) continue;
    if (spent + p.price > budget) continue;
    if (selected.length >= 13) break;
    selected.push(p);
    spent += p.price;
  }

  return { players: selected, spent };
}

function selectPlayersBalanced(players, budget) {
  const byPos = { GK: [], DF: [], MF: [], FW: [] };
  players.forEach(p => { if (byPos[p.position]) byPos[p.position].push(p); });
  Object.values(byPos).forEach(arr => arr.sort((a, b) => b.rating - a.rating));

  const selected = [];
  let spent = 0;

  const targets = { GK: 1, DF: 4, MF: 4, FW: 2 };
  for (const [pos, count] of Object.entries(targets)) {
    let added = 0;
    for (const p of byPos[pos]) {
      if (added >= count) break;
      if (spent + p.price > budget) continue;
      selected.push(p);
      spent += p.price;
      added++;
    }
  }

  const remaining = players.filter(p => !selected.find(s => s.id === p.id))
    .sort((a, b) => b.rating - a.rating);
  for (const p of remaining) {
    if (spent + p.price > budget) continue;
    if (selected.length >= 15) break;
    selected.push(p);
    spent += p.price;
  }

  return { players: selected, spent };
}

function selectPlayersCheap(players, budget) {
  const sorted = [...players].sort((a, b) => a.price - b.price);
  const selected = [];
  let spent = 0;

  const gks = sorted.filter(p => p.position === 'GK');
  if (gks.length > 0) {
    selected.push(gks[0]);
    spent += gks[0].price;
  }

  for (const p of sorted) {
    if (selected.find(s => s.id === p.id)) continue;
    if (spent + p.price > budget) continue;
    if (selected.length >= 18) break;
    selected.push(p);
    spent += p.price;
  }

  return { players: selected, spent };
}

function selectPlayers(players, budget, strat) {
  switch (strat) {
    case 'strongest': return selectPlayersStrongest(players, budget);
    case 'cheap': return selectPlayersCheap(players, budget);
    default: return selectPlayersBalanced(players, budget);
  }
}

// ─── 阵容排列 ────────────────────────────────────────────────────────────────

function pickLineup(roster) {
  const byPos = { GK: [], DF: [], MF: [], FW: [] };
  roster.forEach(p => { if (byPos[p.position]) byPos[p.position].push(p); });
  Object.values(byPos).forEach(arr => arr.sort((a, b) => b.rating - a.rating));

  const lineup = [];
  if (byPos.GK.length > 0) lineup.push(byPos.GK[0]);
  for (const p of byPos.DF.slice(0, 4)) lineup.push(p);
  for (const p of byPos.MF.slice(0, 3)) lineup.push(p);
  for (const p of byPos.FW.slice(0, 3)) lineup.push(p);

  const remaining = roster.filter(p => !lineup.find(l => l.id === p.id))
    .sort((a, b) => b.rating - a.rating);
  while (lineup.length < 11 && remaining.length > 0) lineup.push(remaining.shift());

  return lineup;
}

// ─── 对手生成 ────────────────────────────────────────────────────────────────

function getOpponentPlayers(strength) {
  const ranges = {
    weak: { spd: [50, 70], phy: [50, 70], tec: [50, 70], def: [50, 70], sta: [65, 80], star: [1, 2] },
    medium: { spd: [58, 83], phy: [58, 83], tec: [58, 83], def: [58, 83], sta: [70, 85], star: [2, 3] },
    strong: { spd: [65, 90], phy: [65, 85], tec: [65, 90], def: [65, 83], sta: [75, 90], star: [3, 4] },
  }[strength] || { spd: [62, 80], phy: [62, 78], tec: [60, 78], def: [62, 80], sta: [70, 85], star: [2, 4] };

  const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const positions = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'];

  return positions.map((pos, i) => ({
    id: `opp_${strength}_${i}`,
    name: `${strength}_${i}`,
    position: pos,
    spd: rand(ranges.spd[0], ranges.spd[1]),
    phy: rand(ranges.phy[0], ranges.phy[1]),
    tec: rand(ranges.tec[0], ranges.tec[1]),
    def: rand(ranges.def[0], ranges.def[1]),
    sta: rand(ranges.sta[0], ranges.sta[1]),
    star: rand(ranges.star[0], ranges.star[1]),
    isGolden: false,
  }));
}

// ─── 单场模拟（完全复刻游戏逻辑） ────────────────────────────────────────────

function selectKeyPlayer(lineup, scenarioType) {
  const getPos = p => p.position || p.pos;
  const outfield = lineup.filter(p => getPos(p) !== 'GK');

  if (scenarioType === 'attack') {
    // 选最快的前锋或技术最好的中场
    const fw = outfield.filter(p => getPos(p) === 'FW');
    const mf = outfield.filter(p => getPos(p) === 'MF');
    const candidates = fw.length > 0 ? fw : mf;
    return candidates.reduce((best, p) => {
      const score = (p.spd || 70) * 0.5 + (p.tec || 70) * 0.3 + (p.sta || 80) * 0.2;
      const bestScore = (best.spd || 70) * 0.5 + (best.tec || 70) * 0.3 + (best.sta || 80) * 0.2;
      return score > bestScore ? p : best;
    }, candidates[0] || lineup[0]);
  } else {
    // 防守：选防守最好的后卫或中场
    const df = outfield.filter(p => getPos(p) === 'DF');
    const mf = outfield.filter(p => getPos(p) === 'MF');
    const candidates = df.length > 0 ? df : mf;
    return candidates.reduce((best, p) => {
      const score = (p.def || 70) * 0.5 + (p.phy || 70) * 0.3 + (p.sta || 80) * 0.2;
      const bestScore = (best.def || 70) * 0.5 + (best.phy || 70) * 0.3 + (best.sta || 80) * 0.2;
      return score > bestScore ? p : best;
    }, candidates[0] || lineup[0]);
  }
}

function simulateOneMatch(myLineup, opponentLineup, isKnockout) {
  let homeScore = 0;
  let awayScore = 0;
  let decisionsCount = 0;
  let penaltyCount = 0;

  const myAttack = myLineup.reduce((s, p) => s + (p.tec || 70) + (p.spd || 70), 0) / myLineup.length;
  const myDefense = myLineup.reduce((s, p) => s + (p.def || 70) + (p.phy || 70), 0) / myLineup.length;
  const oppAttack = opponentLineup.reduce((s, p) => s + (p.tec || 70) + (p.spd || 70), 0) / opponentLineup.length;
  const oppDefense = opponentLineup.reduce((s, p) => s + (p.def || 70) + (p.phy || 70), 0) / opponentLineup.length;

  // 球队深度加成：全队平均rating越高，加成越大（max +0.06）
  const myAvgRating = myLineup.reduce((s, p) => s + (p.rating || 70), 0) / myLineup.length;
  const oppAvgRating = opponentLineup.reduce((s, p) => s + (p.rating || 70), 0) / opponentLineup.length;
  const myDepthBonus = Math.max(0, (myAvgRating - 70) * 0.006);
  const oppDepthBonus = Math.max(0, (oppAvgRating - 70) * 0.006);

  let triggeredFirst = 0, triggeredSecond = 0;
  let lastDecisionMinute = -Infinity;

  for (let minute = 0; minute <= 90; minute++) {
    const half = minute <= 45 ? 'first' : 'second';
    const triggered = half === 'first' ? triggeredFirst : triggeredSecond;

    // 复刻 shouldTriggerDecision 逻辑
    if (minute >= 15 && triggered < 3 && minute - lastDecisionMinute >= 12 && Math.random() < 0.025) {
      if (half === 'first') triggeredFirst++;
      else triggeredSecond++;
      lastDecisionMinute = minute;
      decisionsCount++;

      // 选择场景类型
      const attackAdvantage = myAttack > oppDefense * 1.05;
      const pool = attackAdvantage ? DECISION_SCENARIOS.attack : DECISION_SCENARIOS.defend;
      const scenarioId = weightedRandom(pool.map(s => [s.id, s.weight]));
      const scenario = pool.find(s => s.id === scenarioId) || pool[0];

      // 选择关键球员
      const keyPlayer = selectKeyPlayer(myLineup, attackAdvantage ? 'attack' : 'defend');

      // 计算成功概率（考虑对手防守质量）
      const successProb = calcSuccessProb({}, keyPlayer, isKnockout, oppDefense, myDepthBonus);

      // 解析结果
      const outcome = resolveOutcome(scenario.outcomes, successProb);

      // 判定进球
      if (outcome === 'goal' || GOAL_OUTCOMES.has(outcome)) homeScore++;
      if (outcome === 'goal_against' || GOAL_AGAINST_OUTCOMES.has(outcome)) awayScore++;

      // 对手也有决策机会（25%概率）
      if (Math.random() < 0.25) {
        const oppAttackAdvantage = oppAttack > myDefense * 1.05;
        const oppPool = oppAttackAdvantage ? DECISION_SCENARIOS.attack : DECISION_SCENARIOS.defend;
        const oppScenarioId = weightedRandom(oppPool.map(s => [s.id, s.weight]));
        const oppScenario = oppPool.find(s => s.id === oppScenarioId) || oppPool[0];
        const oppKeyPlayer = selectKeyPlayer(opponentLineup, oppAttackAdvantage ? 'attack' : 'defend');
        const oppSuccessProb = calcSuccessProb({}, oppKeyPlayer, isKnockout, myDefense, oppDepthBonus);
        const oppOutcome = resolveOutcome(oppScenario.outcomes, oppSuccessProb);

        // 对手进球：attack场景下goal代表对手进球
        if (oppOutcome === 'goal' || GOAL_OUTCOMES.has(oppOutcome)) awayScore++;
        if (oppOutcome === 'goal_against' || GOAL_AGAINST_OUTCOMES.has(oppOutcome)) homeScore++;
      }
    }
  }

  // 淘汰赛平局 → 加时
  if (isKnockout && homeScore === awayScore) {
    for (let minute = 91; minute <= 105; minute += 7) {
      if (Math.random() < 0.35) {
        const keyPlayer = selectKeyPlayer(myLineup, 'attack');
        const successProb = calcSuccessProb({}, keyPlayer, true, oppDefense, myDepthBonus);
        if (Math.random() < successProb * 0.4) homeScore++;
      }
      if (Math.random() < 0.25) {
        const oppKeyPlayer = selectKeyPlayer(opponentLineup, 'attack');
        const oppSuccessProb = calcSuccessProb({}, oppKeyPlayer, true, myDefense, oppDepthBonus);
        if (Math.random() < oppSuccessProb * 0.3) awayScore++;
      }
    }
  }

  // 仍然平局 → 点球
  if (isKnockout && homeScore === awayScore) {
    penaltyCount++;
    const mySkill = myLineup.reduce((s, p) => s + (p.star || 3) * 0.08 + (p.sta || 80) * 0.002, 0) / myLineup.length;
    const oppSkill = opponentLineup.reduce((s, p) => s + (p.star || 3) * 0.08 + (p.sta || 80) * 0.002, 0) / opponentLineup.length;
    if (Math.random() < 0.45 + mySkill - oppSkill) homeScore++;
    else awayScore++;
  }

  return { homeScore, awayScore, decisionsCount, penaltyCount };
}

// ─── 小组赛模拟 ──────────────────────────────────────────────────────────────

function simulateGroupStage(teamId, roster) {
  const schedule = TEAM_SCHEDULES[teamId];
  if (!schedule) return null;

  const lineup = pickLineup(roster);
  const results = [];
  let totalGoals = 0, totalGoalsAgainst = 0, totalDecisions = 0;

  for (const match of schedule) {
    const oppPlayers = getOpponentPlayers(match.strength);
    const result = simulateOneMatch(lineup, oppPlayers, false);

    results.push({
      opponent: match.opponent,
      strength: match.strength,
      myGoals: result.homeScore,
      oppGoals: result.awayScore,
      result: result.homeScore > result.awayScore ? 'W' : result.homeScore < result.awayScore ? 'L' : 'D',
      decisions: result.decisionsCount,
    });

    totalGoals += result.homeScore;
    totalGoalsAgainst += result.awayScore;
    totalDecisions += result.decisionsCount;
  }

  let points = 0, wins = 0, draws = 0, losses = 0, goalDiff = 0;
  for (const r of results) {
    if (r.result === 'W') { points += 3; wins++; }
    else if (r.result === 'D') { points += 1; draws++; }
    else losses++;
    goalDiff += r.myGoals - r.oppGoals;
  }

  // 模拟同组对手积分
  const otherPoints = schedule.map(m => {
    const base = m.strength === 'weak' ? 4 : m.strength === 'medium' ? 5 : 7;
    return base + Math.floor(Math.random() * 4) - 1;
  });
  const allPoints = [points, ...otherPoints].sort((a, b) => b - a);
  const playerRank = allPoints.indexOf(points) + 1;
  const advanced = playerRank <= 2;

  return { results, points, wins, draws, losses, goalDiff, totalGoals, totalGoalsAgainst, totalDecisions, advanced, playerRank };
}

// ─── 淘汰赛模拟 ──────────────────────────────────────────────────────────────

function simulateKnockout(roster, round) {
  const lineup = pickLineup(roster);
  const strengthMap = { r16: 'medium', qf: 'medium', sf: 'strong', final: 'strong' };
  const oppPlayers = getOpponentPlayers(strengthMap[round] || 'medium');
  const result = simulateOneMatch(lineup, oppPlayers, true);

  return {
    round,
    myGoals: result.homeScore,
    oppGoals: result.awayScore,
    won: result.homeScore > result.awayScore,
    decisions: result.decisionsCount,
    penalty: result.penaltyCount > 0,
  };
}

// ─── 完整世界杯模拟 ──────────────────────────────────────────────────────────

function simulateWorldCup(teamId, players, budget, strat) {
  const { players: roster, spent } = selectPlayers(players, budget, strat);

  const group = simulateGroupStage(teamId, roster);
  if (!group) return null;

  let finalStage = 'group';
  const knockoutResults = [];
  let totalDecisions = group.totalDecisions;
  let totalPenalties = 0;

  if (group.advanced) {
    const rounds = ['r16', 'qf', 'sf', 'final'];
    for (const round of rounds) {
      const kr = simulateKnockout(roster, round);
      knockoutResults.push(kr);
      totalDecisions += kr.decisions;
      if (kr.penalty) totalPenalties++;

      if (!kr.won) {
        finalStage = round;
        break;
      }
      finalStage = round === 'final' ? 'champion' : round;
    }
  }

  return {
    teamId, rosterSize: roster.length, budgetUsed: spent,
    budgetTotal: budget, budgetUsage: Math.round((spent / budget) * 100),
    group, finalStage, knockoutResults, totalDecisions, totalPenalties,
  };
}

// ─── 主程序 ──────────────────────────────────────────────────────────────────

console.log(`\n⚽ 剑指美加墨 — 数值平衡 Monte Carlo 模拟`);
console.log(`━`.repeat(60));

const playerData = loadPlayerData();
const teamIds = rawTeamIds === 'all'
  ? Object.keys(TEAM_DEFS)
  : rawTeamIds.split(',');

console.log(`球队: ${teamIds.map(id => TEAM_DEFS[id]?.name || id).join(', ')}`);
console.log(`模拟次数: ${totalRuns}`);
console.log(`选人策略: ${strategy}`);
console.log(`━`.repeat(60));

const allResults = {};

for (const teamId of teamIds) {
  const teamDef = TEAM_DEFS[teamId];
  if (!teamDef) { console.error(`❌ 未找到球队: ${teamId}`); continue; }

  const players = playerData[teamId];
  if (!players || players.length === 0) {
    console.error(`❌ 未找到球员数据: ${teamId}`);
    continue;
  }

  console.log(`\n🏟️  模拟 ${teamDef.name} (${teamId}) — ${players.length} 名球员, 预算 ${teamDef.budget} ...`);
  const results = [];

  for (let i = 0; i < totalRuns; i++) {
    const result = simulateWorldCup(teamId, players, teamDef.budget, strategy);
    if (result) results.push(result);
  }

  const n = results.length;
  if (n === 0) continue;

  const stats = {
    teamId, teamName: teamDef.name, runs: n, strategy,
    budget: teamDef.budget, difficulty: teamDef.difficulty,
    groupAdvance: results.filter(r => r.group.advanced).length,
    r16: results.filter(r => r.finalStage === 'r16').length,
    qf: results.filter(r => r.finalStage === 'qf').length,
    sf: results.filter(r => r.finalStage === 'sf').length,
    finalist: results.filter(r => r.finalStage === 'final').length,
    champion: results.filter(r => r.finalStage === 'champion').length,
  };

  stats.groupAdvanceRate = (stats.groupAdvance / n * 100).toFixed(1);
  stats.r16Rate = (stats.r16 / n * 100).toFixed(1);
  stats.qfRate = (stats.qf / n * 100).toFixed(1);
  stats.sfRate = (stats.sf / n * 100).toFixed(1);
  stats.finalistRate = (stats.finalist / n * 100).toFixed(1);
  stats.championRate = (stats.champion / n * 100).toFixed(1);
  stats.avgGoals = (results.reduce((s, r) => s + r.group.totalGoals, 0) / n).toFixed(2);
  stats.avgGoalsAgainst = (results.reduce((s, r) => s + r.group.totalGoalsAgainst, 0) / n).toFixed(2);
  stats.avgGoalDiff = (results.reduce((s, r) => s + r.group.goalDiff, 0) / n).toFixed(2);
  stats.avgDecisions = (results.reduce((s, r) => s + r.totalDecisions, 0) / n).toFixed(1);
  stats.avgRosterSize = (results.reduce((s, r) => s + r.rosterSize, 0) / n).toFixed(1);
  stats.avgBudgetUsage = (results.reduce((s, r) => s + r.budgetUsage, 0) / n).toFixed(1);
  stats.totalPenalties = results.reduce((s, r) => s + r.totalPenalties, 0);
  stats.groupPoints = (results.reduce((s, r) => s + r.group.points, 0) / n).toFixed(1);
  stats.groupWins = (results.reduce((s, r) => s + r.group.wins, 0) / n).toFixed(1);
  stats.groupDraws = (results.reduce((s, r) => s + r.group.draws, 0) / n).toFixed(1);
  stats.groupLosses = (results.reduce((s, r) => s + r.group.losses, 0) / n).toFixed(1);

  allResults[teamId] = { results, stats };

  console.log(`\n  📊 ${teamDef.name} — ${n} 次模拟:`);
  console.log(`  小组出线率: ${stats.groupAdvanceRate}% (平均积分 ${stats.groupPoints})`);
  console.log(`  淘汰赛: 16强 ${stats.r16Rate}% | 8强 ${stats.qfRate}% | 4强 ${stats.sfRate}% | 决赛 ${stats.finalistRate}% | 冠军 ${stats.championRate}%`);
  console.log(`  场均进球: ${stats.avgGoals} | 场均失球: ${stats.avgGoalsAgainst} | 场均净胜: ${stats.avgGoalDiff}`);
  console.log(`  决策均值: ${stats.avgDecisions} | 点球大战: ${stats.totalPenalties} 次`);
  console.log(`  阵容: ${stats.avgRosterSize} 人 | 预算使用: ${stats.avgBudgetUsage}%`);
}

// ─── 汇总表格 ────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(110)}`);
console.log(`📊 汇总表格 — ${strategy} 策略, ${totalRuns} 次模拟`);
console.log(`${'═'.repeat(110)}`);
console.log(`| 球队     | 出线率  | 16强   | 8强    | 4强    | 决赛   | 冠军   | 场均进球 | 场均失球 | 决策数 | 阵容 | 预算% |`);
console.log(`|----------|---------|--------|--------|--------|--------|--------|----------|----------|--------|------|-------|`);

for (const teamId of teamIds) {
  const s = allResults[teamId]?.stats;
  if (!s) continue;
  console.log(`| ${s.teamName.padEnd(8)} | ${String(s.groupAdvanceRate + '%').padStart(7)} | ${String(s.r16Rate + '%').padStart(6)} | ${String(s.qfRate + '%').padStart(6)} | ${String(s.sfRate + '%').padStart(6)} | ${String(s.finalistRate + '%').padStart(6)} | ${String(s.championRate + '%').padStart(6)} | ${String(s.avgGoals).padStart(8)} | ${String(s.avgGoalsAgainst).padStart(8)} | ${String(s.avgDecisions).padStart(6)} | ${String(s.avgRosterSize).padStart(4)} | ${String(s.avgBudgetUsage + '%').padStart(5)} |`);
}

// ─── 写入报告 ────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);
const reportDir = join(ROOT, 'docs/balance');
mkdirSync(reportDir, { recursive: true });

let report = `# 数值平衡报告 — ${today}\n\n`;
report += `- **模拟次数**: ${totalRuns}\n`;
report += `- **选人策略**: ${strategy}\n`;
report += `- **测试球队**: ${teamIds.map(id => TEAM_DEFS[id]?.name || id).join(', ')}\n\n`;

report += `## 汇总\n\n`;
report += `| 球队 | 出线率 | 16强 | 8强 | 4强 | 决赛 | 冠军 | 场均进球 | 场均失球 | 决策数 | 阵容 | 预算% |\n`;
report += `|------|--------|------|-----|-----|------|------|----------|----------|--------|------|-------|\n`;
for (const teamId of teamIds) {
  const s = allResults[teamId]?.stats;
  if (!s) continue;
  report += `| ${s.teamName} | ${s.groupAdvanceRate}% | ${s.r16Rate}% | ${s.qfRate}% | ${s.sfRate}% | ${s.finalistRate}% | ${s.championRate}% | ${s.avgGoals} | ${s.avgGoalsAgainst} | ${s.avgDecisions} | ${s.avgRosterSize} | ${s.avgBudgetUsage}% |\n`;
}

report += `\n## 详细数据\n\n`;
for (const teamId of teamIds) {
  const data = allResults[teamId];
  if (!data) continue;
  const s = data.stats;
  report += `### ${s.teamName} (${teamId})\n\n`;
  report += `- 难度: ${'★'.repeat(s.difficulty)}${'☆'.repeat(5 - s.difficulty)}\n`;
  report += `- 预算: ${s.budget}\n`;
  report += `- 模拟次数: ${s.runs}\n`;
  report += `- 小组出线率: ${s.groupAdvanceRate}%\n`;
  report += `- 平均积分: ${s.groupPoints} (胜${s.groupWins} 平${s.groupDraws} 负${s.groupLosses})\n`;
  report += `- 场均进球: ${s.avgGoals} | 场均失球: ${s.avgGoalsAgainst} | 净胜: ${s.avgGoalDiff}\n`;
  report += `- 决策触发均值: ${s.avgDecisions} | 点球大战: ${s.totalPenalties} 次\n`;
  report += `- 平均阵容: ${s.avgRosterSize} 人 | 预算使用: ${s.avgBudgetUsage}%\n`;
  report += `- 淘汰赛路径:\n`;
  report += `  - 小组出局: ${(100 - parseFloat(s.groupAdvanceRate)).toFixed(1)}%\n`;
  report += `  - 16强: ${s.r16Rate}% | 8强: ${s.qfRate}% | 4强: ${s.sfRate}% | 决赛: ${s.finalistRate}% | 冠军: ${s.championRate}%\n\n`;
}

report += `## 平衡性检查\n\n`;

const fr = allResults['france']?.stats;
const cu = allResults['curacao']?.stats;

if (fr) {
  const v = parseFloat(fr.championRate);
  report += `### 法国夺冠率: ${fr.championRate}% (目标 60-85%)\n`;
  report += v >= 60 && v <= 85 ? `- ✅ 在目标区间\n\n` : v < 60 ? `- ⚠️ 偏弱\n\n` : `- ⚠️ 偏强\n\n`;
}
if (cu) {
  const v = parseFloat(cu.championRate);
  report += `### 库拉索夺冠率: ${cu.championRate}% (目标 0-2%)\n`;
  report += v <= 2 ? `- ✅ 在目标区间\n\n` : `- ⚠️ 偏高，弱队upset过多\n\n`;
}

report += `### 进球数\n`;
for (const teamId of teamIds) {
  const s = allResults[teamId]?.stats;
  if (!s) continue;
  const v = parseFloat(s.avgGoals);
  report += v < 1.0 ? `- ⚠️ ${s.teamName} 场均 ${s.avgGoals} 偏低\n`
    : v > 4.0 ? `- ⚠️ ${s.teamName} 场均 ${s.avgGoals} 偏高\n`
    : `- ✅ ${s.teamName} 场均 ${s.avgGoals}\n`;
}

if (fr && cu) {
  const gap = parseFloat(fr.championRate) - parseFloat(cu.championRate);
  report += `\n### 强弱差距: ${gap.toFixed(1)}% (目标 ≥50%)\n`;
  report += gap >= 50 ? `- ✅ 差距明显\n` : `- ⚠️ 差距不足\n`;
}

report += `\n---\n*生成时间: ${new Date().toISOString()}*\n`;

const reportPath = join(reportDir, `${today}-balance-report.md`);
writeFileSync(reportPath, report, 'utf-8');
console.log(`\n📝 报告已写入: ${reportPath}`);
