import { strToU8, unzipSync, zipSync } from 'fflate'
import { getStudioKit, getStudioTeam } from './catalog.js'
import {
  STUDIO_PART_SET_ID,
  buildStudioRuntimeRecipe,
  cloneStudioRecipe,
  createDefaultStudioRecipe,
  validateStudioRecipe,
} from './model.js'
import { canvasToBlob, renderStudioSlot } from './renderer.js'

const PLAYER_PART_FILES = Object.freeze({
  head_front: 'head_front.png',
  head_back: 'head_back.png',
  arm_left: 'arm_left.png',
  arm_right: 'arm_right.png',
  hand_left: 'hand_left.png',
  hand_right: 'hand_right.png',
  knee: 'knee.png',
  neck: 'neck.png',
  shoes: 'shoes.png',
  hand_left_glove: 'hand_left_glove.png',
  hand_right_glove: 'hand_right_glove.png',
})

const KIT_PART_FILES = Object.freeze({
  shirt_front: 'shirt_front.png',
  shirt_back: 'shirt_back.png',
  sleeve_left: 'sleeve_left.png',
  sleeve_right: 'sleeve_right.png',
  shorts: 'shorts.png',
  shorts_leg: 'shorts_leg.png',
  socks: 'socks.png',
  shoes: 'shoes.png',
})

function jsonBytes(value) {
  return strToU8(`${JSON.stringify(value, null, 2)}\n`)
}

async function blobBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function addFile(files, records, path, bytes, metadata = {}) {
  const normalized = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  files[path] = normalized
  const record = {
    path,
    bytes: normalized.byteLength,
    storedBytes: normalized.byteLength,
    stored: true,
    sha256: await sha256(normalized),
    ...metadata,
  }
  records.push(record)
  return record
}

async function addCanvas(files, records, path, canvas, slotId) {
  const bytes = await blobBytes(await canvasToBlob(canvas))
  await addFile(files, records, path, bytes, {
    type: 'image/png',
    slotId,
    width: canvas.width,
    height: canvas.height,
  })
}

async function addDeduplicatedCanvas(files, records, path, runtimePath, canvas, slotId, contentIndex) {
  const bytes = await blobBytes(await canvasToBlob(canvas))
  const hash = await sha256(bytes)
  const canonical = contentIndex.get(hash)
  if (canonical) {
    records.push({
      path,
      bytes: bytes.byteLength,
      storedBytes: 0,
      stored: false,
      sha256: hash,
      duplicateOf: canonical.path,
      resolvedRuntimePath: canonical.runtimePath,
      type: 'image/png',
      slotId,
      width: canvas.width,
      height: canvas.height,
    })
    return canonical.runtimePath
  }
  files[path] = bytes
  records.push({
    path,
    bytes: bytes.byteLength,
    storedBytes: bytes.byteLength,
    stored: true,
    sha256: hash,
    type: 'image/png',
    slotId,
    width: canvas.width,
    height: canvas.height,
  })
  contentIndex.set(hash, { path, runtimePath })
  return runtimePath
}

function runtimePaths(recipe) {
  const playerRoot = `/pixel/player/${STUDIO_PART_SET_ID}/${recipe.playerId}`
  const kitRoot = `/pixel/kits/${recipe.teamId}/${recipe.kitType}/${STUDIO_PART_SET_ID}`
  const number = `/pixel/numbers/${recipe.kit.numberStyleId}/${recipe.kitType}-${recipe.number}.png`
  return { playerRoot, kitRoot, number }
}

async function compileRecipe(files, records, recipe, compiledKits, compiledNumbers, playerPartContentIndex) {
  const validation = validateStudioRecipe(recipe)
  if (!validation.valid) throw new Error(`配方 ${recipe.playerId} 无效：${validation.errors.join(', ')}`)
  const paths = runtimePaths(recipe)
  const internalPlayerRoot = `runtime/player/${STUDIO_PART_SET_ID}/${recipe.playerId}`
  const personalPartPaths = {}
  for (const [slotId, filename] of Object.entries(PLAYER_PART_FILES)) {
    if (slotId.includes('glove') && recipe.role !== 'goalkeeper') continue
    const runtimePath = `${paths.playerRoot}/${filename}`
    personalPartPaths[slotId] = await addDeduplicatedCanvas(
      files,
      records,
      `${internalPlayerRoot}/${filename}`,
      runtimePath,
      renderStudioSlot(recipe, slotId),
      slotId,
      playerPartContentIndex,
    )
  }

  const kitKey = `${recipe.teamId}/${recipe.kitType}`
  if (!compiledKits.has(kitKey)) {
    compiledKits.add(kitKey)
    const internalKitRoot = `runtime/kits/${recipe.teamId}/${recipe.kitType}/${STUDIO_PART_SET_ID}`
    for (const [slotId, filename] of Object.entries(KIT_PART_FILES)) {
      await addCanvas(files, records, `${internalKitRoot}/${filename}`, renderStudioSlot(recipe, slotId), slotId)
    }
    if (recipe.role === 'goalkeeper') {
      await addCanvas(files, records, `${internalKitRoot}/hand_left.png`, renderStudioSlot(recipe, 'hand_left_glove'), 'hand_left_glove')
      await addCanvas(files, records, `${internalKitRoot}/hand_right.png`, renderStudioSlot(recipe, 'hand_right_glove'), 'hand_right_glove')
    }
  }

  const numberKey = `${recipe.kit.numberStyleId}/${recipe.number}/${recipe.kitType}`
  if (!compiledNumbers.has(numberKey)) {
    compiledNumbers.add(numberKey)
    await addCanvas(
      files,
      records,
      `runtime/numbers/${recipe.kit.numberStyleId}/${recipe.kitType}-${recipe.number}.png`,
      renderStudioSlot(recipe, 'number'),
      'number',
    )
  }

  const runtimeRecipe = buildStudioRuntimeRecipe(recipe, {
    ...paths,
    headFront: personalPartPaths.head_front,
    headBack: personalPartPaths.head_back,
    parts: personalPartPaths,
  })
  await addFile(
    files,
    records,
    `runtime/recipes/${recipe.teamId}/${recipe.playerId}.json`,
    jsonBytes(runtimeRecipe),
    { type: 'application/json', schemaVersion: runtimeRecipe.schemaVersion },
  )
  await addFile(
    files,
    records,
    `authoring/players/${recipe.teamId}/${recipe.playerId}.json`,
    jsonBytes(recipe),
    { type: 'application/json', schemaVersion: recipe.schemaVersion },
  )
}

export async function compileStudioPack(recipes, options = {}) {
  const startedAt = performance.now()
  const list = Array.isArray(recipes) ? recipes : [recipes]
  const files = {}
  const records = []
  const compiledKits = new Set()
  const compiledNumbers = new Set()
  const playerPartContentIndex = new Map()
  for (let index = 0; index < list.length; index += 1) {
    await compileRecipe(files, records, cloneStudioRecipe(list[index]), compiledKits, compiledNumbers, playerPartContentIndex)
    options.onProgress?.({ current: index + 1, total: list.length, playerId: list[index].playerId })
  }

  if (options.includeAllKits) {
    const includedTeamIds = [...new Set(list.map((recipe) => recipe.teamId))]
    for (const teamId of includedTeamIds) {
      const team = getStudioTeam(teamId)
      for (const kit of team.kits) {
        const kitKey = `${teamId}/${kit.id}`
        if (compiledKits.has(kitKey)) continue
        const templateRecipe = createDefaultStudioRecipe({
          teamId,
          kitType: kit.id,
          role: kit.id.includes('goalkeeper') ? 'goalkeeper' : 'outfield',
          playerId: `${teamId}_kit_template`,
          number: 1,
        })
        const internalKitRoot = `runtime/kits/${teamId}/${kit.id}/${STUDIO_PART_SET_ID}`
        for (const [slotId, filename] of Object.entries(KIT_PART_FILES)) {
          await addCanvas(files, records, `${internalKitRoot}/${filename}`, renderStudioSlot(templateRecipe, slotId), slotId)
        }
        if (templateRecipe.role === 'goalkeeper') {
          await addCanvas(files, records, `${internalKitRoot}/hand_left.png`, renderStudioSlot(templateRecipe, 'hand_left_glove'), 'hand_left_glove')
          await addCanvas(files, records, `${internalKitRoot}/hand_right.png`, renderStudioSlot(templateRecipe, 'hand_right_glove'), 'hand_right_glove')
        }
        compiledKits.add(kitKey)
      }
    }
  }

  const duplicateMap = new Map()
  for (const record of records) {
    if (!duplicateMap.has(record.sha256)) duplicateMap.set(record.sha256, record.path)
    else if (!record.duplicateOf) record.duplicateOf = duplicateMap.get(record.sha256)
  }
  const teams = [...new Set(list.map((recipe) => recipe.teamId))].map((teamId) => {
    const team = getStudioTeam(teamId)
    return {
      id: team.id,
      name: team.name,
      sourceUrls: team.sourceUrls,
      licenseStatus: team.licenseStatus,
      kits: team.kits.map((kit) => ({
        id: kit.id,
        templateId: kit.templateId,
        sourceUrls: team.sourceUrls,
        licenseStatus: team.licenseStatus,
      })),
    }
  })
  const totalBytes = records.reduce((sum, file) => sum + (file.storedBytes ?? file.bytes), 0)
  const audit = {
    schemaVersion: 'happyseed-player-studio-audit-v1',
    valid: records.every((record) => record.bytes > 0 && record.sha256),
    playerCount: list.length,
    teamCount: teams.length,
    kitCount: compiledKits.size,
    numberCount: compiledNumbers.size,
    fileCount: records.length,
    storedFileCount: records.filter((record) => record.stored !== false).length,
    duplicateFileCount: records.filter((record) => record.duplicateOf).length,
    totalBytes,
    totalMiB: Number((totalBytes / 1048576).toFixed(3)),
    runtimeBudgetMiB: 7.5,
    withinBudget: totalBytes <= 7.5 * 1048576,
    compileDurationMs: Math.round(performance.now() - startedAt),
  }
  await addFile(files, records, 'reports/asset-audit.json', jsonBytes(audit), {
    type: 'application/json',
    schemaVersion: audit.schemaVersion,
  })
  const manifest = {
    schemaVersion: 'happyseed-player-studio-pack-v1',
    generatedAt: new Date().toISOString(),
    generatedBy: 'pixel-player-studio.html',
    partSetId: STUDIO_PART_SET_ID,
    playerCount: list.length,
    teams,
    files: records,
    audit,
  }
  files['manifest.json'] = jsonBytes(manifest)
  const bytes = zipSync(files, { level: 9 })
  return { bytes, manifest, audit }
}

export function downloadBytes(bytes, filename, mimeType = 'application/octet-stream') {
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadStudioJson(recipe) {
  downloadBytes(jsonBytes(recipe), `${recipe.playerId}.happyseed-player.json`, 'application/json')
}

export async function downloadStudioPack(recipes, filename, options) {
  const compiled = await compileStudioPack(recipes, options)
  downloadBytes(compiled.bytes, filename || 'happyseed-players.hspack', 'application/x-happyseed-player-pack')
  return compiled
}

export async function importStudioFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (file.name.endsWith('.json')) {
    const recipe = JSON.parse(new TextDecoder().decode(bytes))
    const validation = validateStudioRecipe(recipe)
    if (!validation.valid) throw new Error(`JSON 配方无效：${validation.errors.join(', ')}`)
    return { recipes: [recipe], manifest: null }
  }
  const files = unzipSync(bytes)
  const manifestBytes = files['manifest.json']
  if (!manifestBytes) throw new Error('HSPack 缺少 manifest.json')
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes))
  if (manifest.schemaVersion !== 'happyseed-player-studio-pack-v1') throw new Error('不支持的 HSPack 版本')
  const recipes = Object.entries(files)
    .filter(([path]) => path.startsWith('authoring/players/') && path.endsWith('.json'))
    .map(([, value]) => JSON.parse(new TextDecoder().decode(value)))
  if (!recipes.length) throw new Error('HSPack 没有可编辑球员配方')
  recipes.forEach((recipe) => {
    const validation = validateStudioRecipe(recipe)
    if (!validation.valid) throw new Error(`HSPack 配方无效：${validation.errors.join(', ')}`)
  })
  return { recipes, manifest }
}

export function describeKitSource(recipe) {
  const team = getStudioTeam(recipe.teamId)
  const kit = getStudioKit(recipe.teamId, recipe.kitType)
  return {
    team: team.name,
    templateId: kit.templateId,
    sourceUrls: team.sourceUrls,
    licenseStatus: team.licenseStatus,
  }
}
