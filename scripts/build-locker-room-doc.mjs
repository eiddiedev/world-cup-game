#!/usr/bin/env node
/**
 * 从 src/data/lockerRoomDecisions.js 生成场景审阅文档 docs/locker-room-decisions.md
 * 用法：node scripts/build-locker-room-doc.mjs
 */
import { writeFileSync } from 'node:fs'
import { LOCKER_ROOM_DECISIONS } from '../src/data/lockerRoomDecisions.js'

const PHASE_META = {
  prematch: ['赛前', '开球前的更衣室'],
  halftime: ['中场休息', '45 分钟半场更衣室（自动暂停）'],
  extratime: ['加时中场', '90 分钟加时中场'],
  shootout: ['点球大战前', '点球大战前的准备阶段'],
}
const SCOPE_LABELS = {
  all: '全队',
  random: '随机一人',
  defense: '防线',
  attack: '锋线',
  primary: '核心',
}
const FIELD_LABELS = { morale: '士气', form: '状态', stamina: '体能' }
const WEIGHTS = { morale: 1, form: 1.2, stamina: 1.5 }

function effectText(choice) {
  return choice.effects.map((effect) => {
    const parts = Object.entries(FIELD_LABELS)
      .filter(([field]) => effect[field])
      .map(([field, label]) => `${label}${effect[field] > 0 ? '+' : ''}${effect[field]}`)
    return `${SCOPE_LABELS[effect.scope] || effect.scope} ${parts.join(' · ')}`
  }).join('；')
}

// 与游戏一致的语义红绿判定：加权净值（防线/锋线按 11 人摊）
function sentiment(choice) {
  let net = 0
  for (const effect of choice.effects) {
    const value = (effect.morale || 0) * WEIGHTS.morale
      + (effect.form || 0) * WEIGHTS.form
      + (effect.stamina || 0) * WEIGHTS.stamina
    const share = { all: 1, defense: 4 / 11, attack: 5 / 11, primary: 1 / 11, random: 1 / 11 }[effect.scope] ?? 1
    net += value * share
  }
  return net >= 0 ? '🟩 正向' : '🟥 负向'
}

const lines = [
  '# 更衣室决策场景总览（42 个）',
  '',
  '> 自动生成自 `src/data/lockerRoomDecisions.js`，重新生成：`node scripts/build-locker-room-doc.mjs`。',
  '> 红绿为该选项的语义极性（加权效果净值），选择前对玩家隐藏，选完才揭示。',
  '',
]

for (const [phase, [label, desc]] of Object.entries(PHASE_META)) {
  const scenarios = LOCKER_ROOM_DECISIONS.filter((scenario) => (
    (scenario.phases || [scenario.phase]).includes(phase)
  ))
  lines.push(`## ${label}（${desc}）— ${scenarios.length} 个场景`)
  lines.push('')
  for (const scenario of scenarios) {
    const sharedTag = (scenario.phases || []).length > 1
      ? `（混用：${scenario.phases.map((item) => PHASE_META[item][0]).join('/')}）`
      : ''
    lines.push(`### ${scenario.title} ${sharedTag}`)
    lines.push('')
    lines.push(`> ${scenario.situation}`)
    lines.push('')
    lines.push('| 选择 | 说明 | 效果 | 极性 | 结果文案 |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const choice of scenario.choices) {
      lines.push(`| ${choice.label} | ${choice.desc} | ${effectText(choice)} | ${sentiment(choice)} | ${choice.result} |`)
    }
    lines.push('')
  }
}

writeFileSync('docs/locker-room-decisions.md', `${lines.join('\n')}\n`, 'utf8')
console.log(`已生成 docs/locker-room-decisions.md（${LOCKER_ROOM_DECISIONS.length} 个场景）`)
