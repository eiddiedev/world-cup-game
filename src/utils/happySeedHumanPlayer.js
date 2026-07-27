import { getTeamKit } from '../data/teamKits.js'

export const HAPPYSEED_HUMAN_PART_SET_ID = 'happyseed-human-v4'
const PIXEL_PREFIX = __DOUYIN_BUILD__ ? './pixel' : '/pixel'

export const HAPPYSEED_PLAYER_BONES = [
  'root',
  'pelvis',
  'chest',
  'leg_left',
  'leg_right',
  'arm_left',
  'arm_right',
  'leg_left_calf',
  'leg_right_calf',
  'neck',
  'hand_left',
  'hand_right',
  'head',
  'leg_left_foot',
  'leg_right_foot',
  'hand_right_accessory',
  'prop_anchor',
]

export const HAPPYSEED_PLAYER_SLOTS = [
  'arm_left',
  'hand_left',
  'hand_left_glove',
  'arm_left_sleeve',
  'leg_left_knee',
  'leg_left_sock',
  'leg_left_shoe',
  'leg_left_shorts',
  'leg_right_knee',
  'leg_right_shorts',
  'pelvis_shorts',
  'leg_right_sock',
  'leg_right_shoe',
  'number',
  'chest_shirt',
  'neck',
  'head',
  'eyebrows',
  'face_accessory_3',
  'face_accessory_2',
  'mouth',
  'face_accessory_1',
  'eyes',
  'nose',
  'hair_accessory_1',
  'hair',
  'prop_anchor',
  'hand_right_accessory',
  'hand_right',
  'arm_right',
  'arm_right_sleeve',
  'hand_right_glove',
]

export const HAPPYSEED_SLOT_TEXTURE_SIZES = Object.freeze({
  arm_left: [14, 11],
  arm_right: [15, 17],
  hand_left: [25, 28],
  hand_right: [23, 38],
  head_front: [81, 77],
  head_back: [81, 77],
  knee: [8, 9],
  neck: [20, 18],
  sleeve_left: [14, 22],
  sleeve_right: [23, 18],
  shirt_front: [56, 52],
  shirt_back: [56, 52],
  shorts: [55, 8],
  shorts_leg: [12, 16],
  socks: [11, 14],
  shoes: [16, 6],
  glove_left: [26, 24],
  glove_right: [26, 25],
  number: [33, 18],
})

export const HAPPYSEED_HUMAN_ACTIONS = Object.freeze([
  {
    id: 'idle',
    label: '站立',
    runtimeState: 'WaitForOthers',
    runtimeAnimations: ['idle', 'idle_back'],
    speed: 0,
    loop: true,
  },
  {
    id: 'run',
    label: '跑动',
    runtimeState: 'Run',
    runtimeAnimations: ['run', 'run_back'],
    speed: 3.2,
    loop: true,
  },
  {
    id: 'sprint',
    label: '冲刺',
    runtimeState: 'Run',
    runtimeAnimations: ['sprint', 'sprint_back'],
    speed: 7.2,
    loop: true,
  },
  {
    id: 'dribble',
    label: '带球',
    runtimeState: 'Run',
    runtimeAnimations: ['run', 'run_back'],
    speed: 2.8,
    ballMode: 'at-foot',
    loop: true,
  },
  {
    id: 'pass',
    label: '传球',
    runtimeState: 'Kick',
    runtimeAnimations: ['shoot', 'shoot_back'],
    speed: 0,
    ballMode: 'pass',
  },
  {
    id: 'shoot',
    label: '射门',
    runtimeState: 'DirectShot',
    runtimeAnimations: ['shoot', 'shoot_back'],
    speed: 0,
    ballMode: 'shot',
  },
  {
    id: 'slide',
    label: '铲球',
    runtimeState: 'Slide',
    runtimeAnimations: ['slide', 'slide_back'],
    speed: 4.2,
  },
  {
    id: 'fall',
    label: '倒地',
    runtimeState: 'Hit',
    runtimeStateData: [false, 1.2, false],
    runtimeAnimations: ['fall_forward', 'laying_on_stomach'],
    speed: 2.2,
  },
  {
    id: 'stand_up',
    label: '起身',
    runtimeState: 'Hit',
    runtimeStateData: [false, 0.15, false],
    runtimeAnimations: ['stand_up_from_stomach', 'stand_up_from_sitting'],
    speed: 0,
  },
  {
    id: 'celebrate',
    label: '庆祝',
    runtimeState: 'GoalCelebrationDance',
    runtimeAnimations: ['dance', 'dance_back', 'knee_slide', 'waving'],
    speed: 0,
  },
  {
    id: 'goalkeeper_save',
    label: '门将扑救',
    runtimeState: 'AIGoalkeeperJumpToBall',
    runtimeAnimations: ['jump', 'jump_back', 'hands_in_front'],
    speed: 0,
    ballMode: 'save',
    goalkeeperOnly: true,
  },
])

const SAMPLE_PROFILE_DEFINITIONS = Object.freeze([
  {
    id: 'france-outfield',
    label: '法国普通球员 · 10',
    shortLabel: 'FRA 10',
    teamId: 'france',
    role: 'outfield',
    number: 10,
    kitType: 'home',
    appearance: {
      skin: '#C8793D',
      skinHighlight: '#E39B58',
      skinShadow: '#8D4826',
      hair: '#20140E',
      hairHighlight: '#50301D',
      beard: false,
    },
    previewOffset: { x: -1.4, y: -1.1 },
  },
  {
    id: 'brazil-outfield',
    label: '巴西普通球员 · 9',
    shortLabel: 'BRA 9',
    teamId: 'brazil',
    role: 'outfield',
    number: 9,
    kitType: 'home',
    appearance: {
      skin: '#A95C31',
      skinHighlight: '#CE7C43',
      skinShadow: '#74351F',
      hair: '#E4C07A',
      hairHighlight: '#FFF0B1',
      beard: true,
    },
    previewOffset: { x: 1.4, y: -1.1 },
  },
  {
    id: 'france-goalkeeper',
    label: '法国门将 · 1',
    shortLabel: 'FRA GK 1',
    teamId: 'france',
    role: 'goalkeeper',
    number: 1,
    kitType: 'goalkeeper',
    appearance: {
      skin: '#D79962',
      skinHighlight: '#F0B982',
      skinShadow: '#925735',
      hair: '#17130F',
      hairHighlight: '#40352A',
      beard: true,
    },
    previewOffset: { x: 0, y: 1.3 },
  },
])

function colorLuminance(hex = '#111111') {
  const normalized = String(hex).replace('#', '')
  const [red, green, blue] = [0, 2, 4].map((index) => (
    Number.parseInt(normalized.slice(index, index + 2), 16) || 0
  ))
  return (red * 0.299) + (green * 0.587) + (blue * 0.114)
}

export function buildHappySeedKitPalette(teamId, role, kitVariant = 'home') {
  const teamKit = getTeamKit(teamId)
  const goalkeeper = role === 'goalkeeper'
  const sourceKit = kitVariant === 'away' ? teamKit.away : teamKit
  const shirt = goalkeeper ? sourceKit.goalkeeper : sourceKit.shirt
  const lightShirt = colorLuminance(shirt) >= 145

  return {
    shirt,
    accent: goalkeeper
      ? (lightShirt ? '#202A34' : '#F8F2E2')
      : sourceKit.accent,
    shorts: goalkeeper ? shirt : sourceKit.shorts,
    socks: goalkeeper ? shirt : sourceKit.socks,
    boots: '#161412',
    number: lightShirt ? '#17212B' : '#F8F2E2',
    numberStroke: lightShirt ? '#F8F2E2' : '#17212B',
    gloves: '#F8F2E2',
  }
}

export function buildHappySeedHumanRecipe(profileId) {
  const profile = SAMPLE_PROFILE_DEFINITIONS.find((item) => item.id === profileId)
  if (!profile) throw new Error(`未知的人类骨架样板：${profileId}`)

  const playerAssetRoot = `/pixel/player/${HAPPYSEED_HUMAN_PART_SET_ID}/${profile.id}`
  const kitAssetRoot = `/pixel/kits/${profile.teamId}/${profile.kitType}/${HAPPYSEED_HUMAN_PART_SET_ID}`
  const numberAsset = `/pixel/numbers/${HAPPYSEED_HUMAN_PART_SET_ID}/${profile.number}.png`

  return {
    schemaVersion: 'happyseed-human-runtime-recipe-v1',
    partSetId: HAPPYSEED_HUMAN_PART_SET_ID,
    ...profile,
    palette: buildHappySeedKitPalette(profile.teamId, profile.role, profile.kitType),
    assets: {
      playerRoot: playerAssetRoot,
      kitRoot: kitAssetRoot,
      number: numberAsset,
      headFront: `${playerAssetRoot}/head_front.png`,
      headBack: `${playerAssetRoot}/head_back.png`,
    },
    compatibility: {
      sourceSkeleton: '/match-runtime-min/data/player.json',
      anchor: 'root-footline',
      frontFacingValue: 1,
      backFacingValue: -1,
      horizontalFlip: 'spine-scale-x',
      modeScope: ['coach', 'player', 'penalty'],
    },
  }
}

export function getHappySeedHumanRecipes() {
  return SAMPLE_PROFILE_DEFINITIONS.map((profile) => buildHappySeedHumanRecipe(profile.id))
}

export function validateHappySeedHumanRecipe(recipe) {
  const errors = []
  if (recipe?.schemaVersion !== 'happyseed-human-runtime-recipe-v1') errors.push('schemaVersion')
  if (recipe?.partSetId !== HAPPYSEED_HUMAN_PART_SET_ID) errors.push('partSetId')
  if (!['outfield', 'goalkeeper'].includes(recipe?.role)) errors.push('role')
  if (!Number.isInteger(recipe?.number) || recipe.number < 1 || recipe.number > 99) errors.push('number')
  if (!recipe?.assets?.playerRoot?.startsWith(`${PIXEL_PREFIX}/player/`)) errors.push('assets.playerRoot')
  if (!recipe?.assets?.kitRoot?.startsWith(`${PIXEL_PREFIX}/kits/`)) errors.push('assets.kitRoot')
  if (!recipe?.assets?.number?.startsWith(`${PIXEL_PREFIX}/numbers/`)) errors.push('assets.number')
  if (recipe?.compatibility?.anchor !== 'root-footline') errors.push('compatibility.anchor')
  return { valid: errors.length === 0, errors }
}

export function getHappySeedHumanCompatibilityContract() {
  return {
    source: '/match-runtime-min/data/player.json',
    spineVersion: '2.1.27',
    skeletonBounds: { width: 123.69, height: 202.3 },
    anchor: {
      strategy: 'root-footline',
      note: '保留原 root/pelvis 世界坐标；所有替换纹理沿用附件 x/y/rotation，不新增逐动作偏移。',
    },
    bones: HAPPYSEED_PLAYER_BONES,
    slots: HAPPYSEED_PLAYER_SLOTS,
    slotTextureSizes: HAPPYSEED_SLOT_TEXTURE_SIZES,
    actions: HAPPYSEED_HUMAN_ACTIONS,
    directions: {
      front: { facingCamera: true, attachmentSuffix: 'front' },
      back: { facingCamera: false, attachmentSuffix: 'back' },
      leftRight: { implementation: 'spine-scale-x', duplicateTextures: false },
    },
    occlusion: {
      strategy: 'preserve-runtime-draw-order',
      backAttachments: ['head_back', 'shirt_back', 'hair_back'],
      frontAttachments: ['head_front', 'shirt_front', 'hair_front'],
    },
    hiddenAnimalFaceSlots: [
      'eyebrows',
      'eyes',
      'mouth',
      'nose',
      'hair',
      'hair_accessory_1',
      'face_accessory_1',
      'face_accessory_2',
      'face_accessory_3',
    ],
    samples: getHappySeedHumanRecipes(),
  }
}
