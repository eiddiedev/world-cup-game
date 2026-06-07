import {
  KNOCKOUT_CANDIDATES,
  getFallbackKnockoutOpponents,
  sanitizeKnockoutOpponents,
} from '../utils/knockoutResolver'

const API_URL = 'https://api.aipai.pro/v1/chat/completions'
const API_KEY = import.meta.env.VITE_AIPAI_API_KEY
const MODEL = 'deepseek-chat'

async function callAI(systemPrompt, userMessage, temperature = 0.8) {
  if (!API_KEY) return null

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
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
    })

    if (!response.ok) return null

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    const jsonMatch = content?.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch {
    return null
  }
}

const KNOCKOUT_SYSTEM = `你是世界杯淘汰赛抽签与赛果模拟AI。
根据玩家球队、小组排名和候选国家，生成具体淘汰赛对手。
必须从候选国家中选择，不要输出"待定"、"A组第2"等占位。
严格输出JSON。`

export async function generateKnockoutOpponents(context) {
  const fallback = getFallbackKnockoutOpponents(context)
  const candidates = KNOCKOUT_CANDIDATES.filter(name => name !== context.teamName)
  const userMessage = `玩家球队: ${context.teamName}
小组: ${context.group}
小组排名: 第${context.playerRank}名
可选国家: ${candidates.join('、')}

请模拟其他小组和淘汰赛潜在路径，输出格式:
{
  "r16": "16强具体对手国家",
  "qf": "8强具体对手国家",
  "sf": "4强具体对手国家",
  "final": "决赛具体对手国家"
}`

  const result = await callAI(KNOCKOUT_SYSTEM, userMessage, 0.85)
  return sanitizeKnockoutOpponents(result, fallback, context.teamName)
}
