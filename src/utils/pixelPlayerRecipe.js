import { getTeamKit } from '../data/teamKits.js'

export const PIXEL_PLAYER_ACTIONS = [
  'idle',
  'run',
  'dribble',
  'pass',
  'shoot',
  'tackle',
  'save',
]

export const PIXEL_PLAYER_FUTURE_ACTIONS = [
  'jog',
  'sprint',
  'cross',
  'header',
  'block',
  'fall',
  'celebrate',
  'complain',
]

const ACTION_ALIASES = {
  jog: 'run',
}

const BASE_FRAME = {
  width: 32,
  height: 40,
  scale: 4,
}

const PART_SET_ID = 'paper-doll-v0-32x40'

const SKINS = ['#D49A62', '#B87545', '#8D5937', '#E3B37A', '#6F432B']
const HAIR = ['#161412', '#3D2B1F', '#9A6B2F', '#111111']

function normalizeNumber(number) {
  const value = Number.parseInt(number, 10)
  if (!Number.isFinite(value)) return '?'
  return String(Math.max(0, Math.min(99, value)))
}

function buildLayer(id, box, color, options = {}) {
  return {
    id,
    color,
    ...box,
    ...options,
  }
}

export function buildPixelPlayerModel({
  teamId = 'france',
  number = 10,
  role = 'outfield',
  action = 'idle',
  skinIndex = 0,
  hairIndex = 0,
} = {}) {
  const teamKit = getTeamKit(teamId)
  const isGoalkeeper = role === 'goalkeeper'
  const kit = {
    ...teamKit,
    shirt: isGoalkeeper ? teamKit.goalkeeper : teamKit.shirt,
  }
  const skin = SKINS[skinIndex % SKINS.length]
  const hair = HAIR[hairIndex % HAIR.length]
  const requestedAction = ACTION_ALIASES[action] || action
  const actionId = PIXEL_PLAYER_ACTIONS.includes(requestedAction) ? requestedAction : 'idle'
  const playerNumber = normalizeNumber(number)

  const layers = [
    buildLayer('shadow', { x: 7, y: 35, w: 18, h: 3 }, 'rgba(0,0,0,0.26)', { shape: 'oval' }),
    buildLayer('leftLeg', { x: 10, y: 26, w: 4, h: 8 }, kit.socks, { part: 'leg' }),
    buildLayer('rightLeg', { x: 18, y: 26, w: 4, h: 8 }, kit.socks, { part: 'leg' }),
    buildLayer('shorts', { x: 9, y: 23, w: 14, h: 5 }, kit.shorts),
    buildLayer('boots', { x: 8, y: 33, w: 16, h: 3 }, '#111111', { part: 'boots' }),
    buildLayer('leftArm', { x: 5, y: 16, w: 5, h: 10 }, skin, { part: 'arm' }),
    buildLayer('rightArm', { x: 22, y: 16, w: 5, h: 10 }, skin, { part: 'arm' }),
    buildLayer('shirt', { x: 9, y: 15, w: 14, h: 10 }, kit.shirt, { part: 'torso' }),
    buildLayer('body', { x: 10, y: 16, w: 12, h: 8 }, kit.shirt, { part: 'torsoCore' }),
    buildLayer('shirtAccent', { x: 14, y: 16, w: 4, h: 4 }, kit.accent),
    buildLayer('neck', { x: 14, y: 12, w: 4, h: 4 }, skin),
    buildLayer('head', { x: 10, y: 5, w: 12, h: 10 }, skin, { shape: 'head' }),
    buildLayer('hair', { x: 10, y: 3, w: 12, h: 5 }, hair, { shape: 'hair' }),
    buildLayer('leftEye', { x: 13, y: 9, w: 2, h: 3 }, '#111111'),
    buildLayer('rightEye', { x: 18, y: 9, w: 2, h: 3 }, '#111111'),
    {
      id: 'number',
      type: 'text',
      text: playerNumber,
      x: 16,
      y: 20,
      color: '#FFFFFF',
      stroke: '#1B3764',
    },
  ]

  if (isGoalkeeper) {
    layers.splice(7, 0, buildLayer('gloves', { x: 4, y: 24, w: 24, h: 3 }, '#F4F0E8', { part: 'gloves' }))
  }

  return {
    partSetId: PART_SET_ID,
    baseFrame: BASE_FRAME,
    teamId,
    role,
    action: actionId,
    kit,
    layers,
    numberLayer: layers.find(layer => layer.id === 'number'),
    runtimeRecipe: {
      partSetId: PART_SET_ID,
      teamId,
      role,
      number: playerNumber,
      action: actionId,
      palette: {
        shirt: kit.shirt,
        accent: kit.accent,
        shorts: kit.shorts,
        socks: kit.socks,
        boots: '#111111',
        skin,
        hair,
      },
    },
  }
}

export function getPixelPlayerProductionRules() {
  return {
    baseFrame: BASE_FRAME,
    partSetId: PART_SET_ID,
    requiredActions: PIXEL_PLAYER_ACTIONS,
    futureActions: PIXEL_PLAYER_FUTURE_ACTIONS,
    packageBudgetMb: {
      targetMin: 80,
      targetMax: 120,
      hardMax: 150,
      platformLimit: 200,
    },
    estimatedSavings: {
      currentWholePlayerPngCount: 154,
      currentWholePlayerPngMb: 10.99,
      currentWholePlayerPngAverageKb: 73.1,
      projectedWholePlayerPngMbFor380Players: 27.1,
      projectedModularPlayerMb: 3.5,
      projectedSavingsVs380WholePngPercent: 87,
      note: '154 张现有整图约 11MB；若 10 队 35-40 人继续整图，约 27MB 起步。纸娃娃把增长从按球员人数变成按部件/球衣/动作增长。',
    },
    runtimeReuse: {
      modes: ['coach', 'player', 'penalty'],
      sharedAssets: ['pitch', 'paperDollPlayer', 'ball', 'animationTimelines', 'teamKits'],
      rule: '所有模式共用 2.5D Match Runtime 的球场、小人、足球、动作时间线和球队数据；模式只传入不同控制输入。',
    },
    networkingBoundary: '联网只用于火山引擎 AI 接入，不做 WebSocket，不做实时 PVP。',
    naming: {
      playerPart: 'pixel/player/{partSetId}/{part}/{direction}/{variant}.png',
      teamKit: 'pixel/kits/{teamId}/{kitType}/{part}.png',
      numberGlyph: 'pixel/numbers/{digit}.png',
      exportedSheet: 'pixel/exports/{teamId}/{role}/{action}_{direction}_{frame}.png',
      recipe: 'pixel/recipes/{teamId}/{playerId}.json',
    },
    batchSteps: [
      '建立统一 32x40 基础帧，所有部件以脚底中心为锚点。',
      '为每名球员生成 spriteRecipe：肤色、发型、号码、role、teamId。',
      '从 teamKits 调色板生成 home、away、goalkeeper 三套球衣。',
      '逐动作导出 idle、run、dribble、pass、shoot、tackle、save 的 4 帧或 6 帧序列。',
      '运行可读性检查：缩放到比赛尺寸后号码仍能读出，双方球衣不撞色。',
      '教练模式、球员模式、点球模式只切换输入/AI，不复制小人、球场、足球或球队数据。',
    ],
    artList: [
      '头部：front、left、right、back 四方向。',
      '身体：普通球员球衣、门将服、球裤、球袜。',
      '四肢：左右手臂、左右腿、手、门将手套。',
      '装备：球鞋、阴影、足球、号码 0-9 字形。',
      '动作：idle、run、dribble、pass、shoot、tackle、save；后续再补 sprint、cross、header、block、fall、celebrate。',
    ],
  }
}
