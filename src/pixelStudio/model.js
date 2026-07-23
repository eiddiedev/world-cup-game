import {
  APPEARANCE_CATALOG,
  STUDIO_TEAMS,
  getStudioKit,
  getStudioTeam,
} from './catalog.js'

export const STUDIO_AUTHORING_SCHEMA = 'happyseed-player-authoring-v1'
export const STUDIO_PART_SET_ID = 'happyseed-human-v4'
export const STUDIO_RUNTIME_SCHEMA = 'happyseed-human-runtime-recipe-v1'
export const STUDIO_SLOT_SIZES = Object.freeze({
  head_front: [81, 77],
  head_back: [81, 77],
  arm_left: [14, 11],
  arm_right: [15, 17],
  hand_left: [25, 28],
  hand_right: [23, 38],
  knee: [8, 9],
  neck: [20, 18],
  shirt_front: [56, 52],
  shirt_back: [56, 52],
  sleeve_left: [14, 22],
  sleeve_right: [23, 18],
  shorts: [55, 8],
  shorts_leg: [12, 16],
  socks: [11, 14],
  shoes: [16, 6],
  hand_left_glove: [26, 24],
  hand_right_glove: [26, 25],
  number: [33, 18],
})

function hashString(value = '') {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createSeededRandom(seed) {
  let state = hashString(seed) || 1
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)] || values[0]
}

export function createDefaultStudioRecipe(options = {}) {
  const team = getStudioTeam(options.teamId || 'france')
  const kitType = options.kitType || 'home'
  const number = Math.max(1, Math.min(99, Number(options.number) || 10))
  const playerId = options.playerId || `${team.id}_player_${number}`
  return {
    schemaVersion: STUDIO_AUTHORING_SCHEMA,
    partSetId: STUDIO_PART_SET_ID,
    playerId,
    teamId: team.id,
    role: options.role === 'goalkeeper' ? 'goalkeeper' : 'outfield',
    number,
    kitType,
    seed: Number(options.seed) || hashString(playerId),
    appearance: {
      skinToneId: 'skin-04',
      faceId: 'face-03',
      eyesId: 'eyes-07',
      eyebrowsId: 'brows-04',
      noseId: 'nose-02',
      mouthId: 'mouth-05',
      hairId: 'hair-18',
      hairColorId: 'hair-color-01',
      beardId: 'beard-none',
      accessoryIds: [],
      bootsId: 'boots-01',
      glovesId: 'gloves-01',
    },
    kit: {
      kitId: getStudioKit(team.id, kitType).templateId,
      numberStyleId: team.numberStyleId,
    },
    paintPatches: {},
    lockedParts: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }
}

export function randomizeStudioRecipe(recipe, options = {}) {
  const seed = options.seed ?? recipe.seed
  const random = createSeededRandom(`${recipe.playerId}:${seed}`)
  const locked = new Set(options.lockedParts || recipe.lockedParts || [])
  const appearance = { ...recipe.appearance }
  for (const [category, values] of Object.entries(APPEARANCE_CATALOG)) {
    if (locked.has(category)) continue
    const selected = pick(values, random)
    if (category === 'accessoryIds') {
      appearance.accessoryIds = selected.variant < 0 || random() < 0.56 ? [] : [selected.id]
    } else if (category === 'beardId') {
      appearance.beardId = random() < 0.35 ? 'beard-none' : selected.id
    } else {
      appearance[category] = selected.id
    }
  }
  return {
    ...recipe,
    seed: Number(seed),
    appearance,
    metadata: { ...recipe.metadata, updatedAt: new Date().toISOString() },
  }
}

export function appearanceSignature(recipe) {
  const appearance = recipe.appearance || {}
  return [
    appearance.skinToneId,
    appearance.faceId,
    appearance.eyesId,
    appearance.hairId,
    appearance.hairColorId,
    appearance.beardId,
    ...(appearance.accessoryIds || []),
  ].join('|')
}

export function createStudioBatch({ teamId, count = 38, seed = 2026, rolePattern } = {}) {
  const team = getStudioTeam(teamId || STUDIO_TEAMS[0].id)
  const signatures = new Set()
  const recipes = []
  for (let index = 0; index < Math.max(1, Math.min(99, count)); index += 1) {
    const number = index + 1
    const goalkeeper = rolePattern
      ? rolePattern(index) === 'goalkeeper'
      : index < 4
    let attempt = 0
    let recipe
    do {
      recipe = randomizeStudioRecipe(createDefaultStudioRecipe({
        teamId: team.id,
        playerId: `${team.id}_player_${String(number).padStart(2, '0')}`,
        number,
        role: goalkeeper ? 'goalkeeper' : 'outfield',
        kitType: goalkeeper ? (index % 2 ? 'away-goalkeeper' : 'goalkeeper') : 'home',
        seed: seed + index + attempt,
      }))
      attempt += 1
    } while (signatures.has(appearanceSignature(recipe)) && attempt < 24)
    signatures.add(appearanceSignature(recipe))
    recipes.push(recipe)
  }
  return {
    teamId: team.id,
    requested: count,
    recipes,
    uniqueAppearanceCount: signatures.size,
    duplicateCount: recipes.length - signatures.size,
  }
}

function normalizePatchPoint(point) {
  return {
    x: Math.round(Number(point.x) || 0),
    y: Math.round(Number(point.y) || 0),
    color: point.color === null ? null : String(point.color || '#000000').toUpperCase(),
  }
}

export function encodePatchRle(points = [], slotId) {
  const size = STUDIO_SLOT_SIZES[slotId]
  if (!size) throw new Error(`未知像素插槽：${slotId}`)
  const unique = new Map()
  points.map(normalizePatchPoint).forEach((point) => {
    if (point.x < 0 || point.y < 0 || point.x >= size[0] || point.y >= size[1]) return
    unique.set(`${point.x}:${point.y}`, point)
  })
  const sorted = [...unique.values()].sort((a, b) => a.y - b.y || a.x - b.x)
  const runs = []
  for (const point of sorted) {
    const previous = runs[runs.length - 1]
    if (previous && previous[0] === point.y && previous[1] + previous[2] === point.x && previous[3] === point.color) {
      previous[2] += 1
    } else {
      runs.push([point.y, point.x, 1, point.color])
    }
  }
  return { encoding: 'sparse-rle-v1', width: size[0], height: size[1], runs }
}

export function decodePatchRle(patch) {
  if (!patch || patch.encoding !== 'sparse-rle-v1') return []
  const points = []
  for (const [y, startX, length, color] of patch.runs || []) {
    for (let offset = 0; offset < length; offset += 1) {
      points.push({ x: startX + offset, y, color })
    }
  }
  return points
}

export function setRecipePatchPoints(recipe, slotId, points) {
  const patch = encodePatchRle(points, slotId)
  return {
    ...recipe,
    paintPatches: {
      ...(recipe.paintPatches || {}),
      [slotId]: patch,
    },
    metadata: { ...recipe.metadata, updatedAt: new Date().toISOString() },
  }
}

export function getRecipePatchPoints(recipe, slotId) {
  return decodePatchRle(recipe.paintPatches?.[slotId])
}

export function buildStudioRuntimeRecipe(recipe, assetUrls = {}) {
  const team = getStudioTeam(recipe.teamId)
  const playerRoot = assetUrls.playerRoot || `/pixel/player/${STUDIO_PART_SET_ID}/${recipe.playerId}`
  const kitRoot = assetUrls.kitRoot || `/pixel/kits/${team.id}/${recipe.kitType}/${STUDIO_PART_SET_ID}`
  const number = assetUrls.number || `/pixel/numbers/${recipe.kit.numberStyleId}/${recipe.kitType}-${recipe.number}.png`
  return {
    schemaVersion: STUDIO_RUNTIME_SCHEMA,
    partSetId: STUDIO_PART_SET_ID,
    id: recipe.playerId,
    label: `${team.name} · ${recipe.number}`,
    shortLabel: `${team.code} ${recipe.role === 'goalkeeper' ? 'GK ' : ''}${recipe.number}`,
    teamId: team.id,
    role: recipe.role,
    number: recipe.number,
    kitType: recipe.kitType,
    previewOffset: { x: 0, y: recipe.role === 'goalkeeper' ? 1.3 : -1.1 },
    appearance: { ...recipe.appearance },
    palette: getStudioKit(recipe.teamId, recipe.kitType),
    assets: {
      playerRoot,
      kitRoot,
      number,
      headFront: assetUrls.headFront || `${playerRoot}/head_front.png`,
      headBack: assetUrls.headBack || `${playerRoot}/head_back.png`,
      parts: assetUrls.parts || undefined,
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

export function validateStudioRecipe(recipe) {
  const errors = []
  if (recipe?.schemaVersion !== STUDIO_AUTHORING_SCHEMA) errors.push('schemaVersion')
  if (recipe?.partSetId !== STUDIO_PART_SET_ID) errors.push('partSetId')
  if (!getStudioTeam(recipe?.teamId) || !STUDIO_TEAMS.some((team) => team.id === recipe?.teamId)) errors.push('teamId')
  if (!['outfield', 'goalkeeper'].includes(recipe?.role)) errors.push('role')
  if (!Number.isInteger(recipe?.number) || recipe.number < 1 || recipe.number > 99) errors.push('number')
  if (!String(recipe?.playerId || '').trim()) errors.push('playerId')
  if (!getStudioTeam(recipe?.teamId).kits.some((kit) => kit.id === recipe?.kitType)) errors.push('kitType')
  for (const [category, values] of Object.entries(APPEARANCE_CATALOG)) {
    const selected = category === 'accessoryIds'
      ? recipe?.appearance?.accessoryIds?.[0] || 'accessory-none'
      : recipe?.appearance?.[category]
    if (!values.some((item) => item.id === selected)) errors.push(`appearance.${category}`)
  }
  for (const [slotId, patch] of Object.entries(recipe?.paintPatches || {})) {
    const size = STUDIO_SLOT_SIZES[slotId]
    if (!size || patch.width !== size[0] || patch.height !== size[1]) errors.push(`paintPatches.${slotId}`)
  }
  return { valid: errors.length === 0, errors }
}

export function cloneStudioRecipe(recipe) {
  return JSON.parse(JSON.stringify(recipe))
}
