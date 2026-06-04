/**
 * AI Service — DeepSeek V4 via aipai.pro
 * 仅负责：赛后战报、其他球队赛果、赛季叙事
 * 比赛中的决策系统已完全本地化
 */

import {
  KNOCKOUT_CANDIDATES,
  getFallbackKnockoutOpponents,
  sanitizeKnockoutOpponents,
} from '../utils/knockoutResolver';

const API_URL = 'https://api.aipai.pro/v1/chat/completions';
const API_KEY = import.meta.env.VITE_AIPAI_API_KEY;
const MODEL = 'deepseek-chat';

/**
 * 调用 DeepSeek API
 */
async function callAI(systemPrompt, userMessage, temperature = 0.8) {
  if (!API_KEY) return null;

  console.log('[AI] 调用 DeepSeek API...');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI] API返回错误:', response.status, errText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[AI] 调用失败:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// 赛后战报
// ─────────────────────────────────────────────

const REPORT_SYSTEM = `你是"剑指美加墨"世界杯策略游戏的赛后战报AI。
根据比赛数据生成赛后战报，包含标题、总结、球员评分和决策点评。
严格输出JSON格式。`;

/**
 * 生成赛后战报
 */
export async function generateMatchReport(matchData) {
  const { myTeam, opponent, finalScore, decisions, topPerformers } = matchData;

  const userMsg = `比赛: ${myTeam} vs ${opponent}
比分: ${finalScore.my} - ${finalScore.opponent}
结果: ${finalScore.my > finalScore.opponent ? '胜利' : finalScore.my < finalScore.opponent ? '失败' : '平局'}

球员表现前5名:
${(topPerformers || []).map(p => `- ${p.name}(${p.pos}) 状态${p.sta}`).join('\n')}

关键决策:
${(decisions || []).map(d => `- 第${d.minute}分钟: ${d.choice_label} → ${d.outcome}`).join('\n')}

请生成赛后战报。输出格式:
{
  "headline": "战报标题(15字以内)",
  "summary": "赛后总结(80-120字)",
  "player_ratings": [{"name":"球员名","rating":7.5,"comment":"点评(15字以内)"}],
  "decision_review": "决策复盘(50字以内)",
  "next_match_hint": "下场提示(25字以内)"
}`;

  const result = await callAI(REPORT_SYSTEM, userMsg, 0.7);
  if (result) return result;

  // Fallback
  const isWin = finalScore.my > finalScore.opponent;
  const isDraw = finalScore.my === finalScore.opponent;
  return {
    headline: isWin ? '精彩胜利！' : isDraw ? '握手言和' : '遗憾落败',
    summary: `${myTeam}在本场比赛中${isWin ? '表现出色，成功拿下三分' : isDraw ? '与对手战成平局，各取一分' : '不敌对手，遗憾告负'}。比赛中双方互有攻守，最终比分定格在${finalScore.my}:${finalScore.opponent}。`,
    player_ratings: (topPerformers || []).slice(0, 3).map(p => ({
      name: p.name,
      rating: (6 + Math.random() * 2.5).toFixed(1),
      comment: '表现稳定',
    })),
    decision_review: '关键时刻的决策对比赛走势产生了重要影响。',
    next_match_hint: '调整状态，准备下一场。',
  };
}

// ─────────────────────────────────────────────
// 其他球队赛果
// ─────────────────────────────────────────────

const MATCH_SIM_SYSTEM = `你是世界杯赛果模拟AI。
根据球队实力数据模拟比赛结果。
严格输出JSON。`;

/**
 * 模拟其他球队之间的比赛
 */
export async function simulateOtherMatch(team1Data, team2Data, context) {
  const userMsg = `【${team1Data.name}】实力${team1Data.rating}星
【${team2Data.name}】实力${team2Data.rating}星
赛制: ${context.stage}
${context.isKnockout ? '淘汰赛' : '小组赛'}

输出格式:
{
  "score": {"${team1Data.name}": 数字, "${team2Data.name}": 数字},
  "match_summary": "比赛简述(40字以内)"
}`;

  const result = await callAI(MATCH_SIM_SYSTEM, userMsg, 0.9);
  if (result) return result;

  // Fallback: 基于实力随机生成
  const diff = (team1Data.rating || 3) - (team2Data.rating || 3);
  const base = 0.45 + diff * 0.05;
  const r = Math.random();
  let s1, s2;
  if (r < base) {
    s1 = Math.floor(Math.random() * 3) + 1;
    s2 = Math.floor(Math.random() * s1);
  } else if (r < base + 0.25) {
    s1 = Math.floor(Math.random() * 2);
    s2 = s1;
  } else {
    s2 = Math.floor(Math.random() * 3) + 1;
    s1 = Math.floor(Math.random() * s2);
  }
  return {
    score: { [team1Data.name]: s1, [team2Data.name]: s2 },
    match_summary: `${team1Data.name}与${team2Data.name}的比赛${s1 > s2 ? team1Data.name + '获胜' : s2 > s1 ? team2Data.name + '获胜' : '以平局收场'}。`,
  };
}

// ─────────────────────────────────────────────
// 淘汰赛对手
// ─────────────────────────────────────────────

const KNOCKOUT_SYSTEM = `你是世界杯淘汰赛抽签与赛果模拟AI。
根据玩家球队、小组排名和候选国家，生成具体淘汰赛对手。
必须从候选国家中选择，不要输出"待定"、"A组第2"等占位。
严格输出JSON。`;

export async function generateKnockoutOpponents(context) {
  const fallback = getFallbackKnockoutOpponents(context);
  const userMsg = `玩家球队: ${context.teamName}
小组: ${context.group}
小组排名: 第${context.playerRank}名
可选国家: ${KNOCKOUT_CANDIDATES.filter(name => name !== context.teamName).join('、')}

请模拟其他小组和淘汰赛潜在路径，输出格式:
{
  "r16": "16强具体对手国家",
  "qf": "8强具体对手国家",
  "sf": "4强具体对手国家",
  "final": "决赛具体对手国家"
}`;

  const result = await callAI(KNOCKOUT_SYSTEM, userMsg, 0.85);
  return sanitizeKnockoutOpponents(result, fallback, context.teamName);
}

// ─────────────────────────────────────────────
// 赛季叙事
// ─────────────────────────────────────────────

const NARRATIVE_SYSTEM = `你是"剑指美加墨"世界杯叙事AI。
根据球队信息生成关键节点的叙事文字。
严格输出JSON。`;

/**
 * 生成关键节点叙事
 */
export async function generateNarrative(event, teamData) {
  const userMsg = `事件: ${event}
球队: ${teamData.name}（${teamData.rating}星难度）
战绩: ${teamData.record || '未知'}

输出格式:
{
  "title": "标题(10字以内)",
  "narrative": "叙事文字(80-120字，有情感张力)",
  "special_line": "经典台词(20字以内)"
}`;

  const result = await callAI(NARRATIVE_SYSTEM, userMsg, 0.8);
  if (result) return result;

  // Fallback
  const eventMap = {
    group_qualified: { title: '小组出线！', narrative: `${teamData.name}成功从小组赛中脱颖而出，晋级淘汰赛！`, special_line: '这只是开始！' },
    group_eliminated: { title: '遗憾出局', narrative: `${teamData.name}在小组赛中未能晋级，但球员们的拼搏精神值得尊敬。`, special_line: '虽败犹荣。' },
    round16_win: { title: '挺进八强！', narrative: `${teamData.name}在16强赛中胜出，距离大力神杯又近了一步！`, special_line: '我们的征途是星辰大海！' },
    final_win: { title: '世界冠军！', narrative: `${teamData.name}站在了世界之巅！这一刻将被永远铭记！`, special_line: '我们是冠军！' },
  };
  return eventMap[event] || {
    title: '比赛结束',
    narrative: `${teamData.name}的比赛结束了。`,
    special_line: '继续前进！',
  };
}
