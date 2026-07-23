import { strToU8, zipSync } from 'fflate'
import {
  DEFAULT_SOURCE_SEGMENTS,
  createIndexedPixelDocument,
  decodePixelRuns,
  imageToIndexedPixelDocument,
  mirrorPixelDocument,
  pixelDocumentBytes,
  renderIndexedPixelDocument,
  slicePaperDollPixelDocuments,
} from './imageSlicer.js'
import { STUDIO_PART_SET_ID, STUDIO_SLOT_SIZES } from './model.js'
import { downloadBytes } from './exporter.js'

export const KIT_PIXEL_SCHEMA = 'happyseed-kit-pixels-v1'
export const KIT_SLOT_ORDER = Object.freeze([
  'shirt_front', 'shirt_back', 'sleeve_left', 'sleeve_right',
  'shorts', 'shorts_leg', 'socks', 'shoes', 'hand_left', 'hand_right',
])

export const KIT_SLOT_LABELS = Object.freeze({
  shirt_front: '球衣正面', shirt_back: '球衣背面',
  sleeve_left: '左袖', sleeve_right: '右袖',
  shorts: '球裤腰', shorts_leg: '裤腿', socks: '球袜', shoes: '球鞋',
  hand_left: '左手套', hand_right: '右手套',
})

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`无法读取图像：${url}`))
    image.src = url
  })
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function exactImageToPixelDocument(image, slotId) {
  const [width, height] = STUDIO_SLOT_SIZES[slotId]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  const data = context.getImageData(0, 0, width, height).data
  const palette = [null]
  const paletteIndex = new Map()
  const indices = []
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] < 24) {
      indices.push(0)
      continue
    }
    const color = rgbToHex(data[offset], data[offset + 1], data[offset + 2])
    if (!paletteIndex.has(color)) {
      paletteIndex.set(color, palette.length)
      palette.push(color)
    }
    indices.push(paletteIndex.get(color))
  }
  return createIndexedPixelDocument(width, height, palette, indices, { slotId, source: 'runtime-png' })
}

export async function loadKitProject(entry) {
  const allowedSlots = entry.kitType === 'goalkeeper' ? KIT_SLOT_ORDER : KIT_SLOT_ORDER.slice(0, 8)
  const pairs = await Promise.all(allowedSlots.map(async (slotId) => {
    const image = await loadImage(`${entry.runtimeRoot}/${slotId}.png?kitStudio=${Date.now()}`)
    return [slotId, exactImageToPixelDocument(image, slotId)]
  }))
  const slots = Object.fromEntries(pairs)
  return {
    entry,
    slots,
    baseSlots: structuredClone(slots),
    sourceReference: entry.referencePath,
    importedSourceName: '',
  }
}

export function auditKitProject(project) {
  const files = Object.entries(project.slots).map(([slotId, pixelDocument]) => {
    const expected = STUDIO_SLOT_SIZES[slotId]
    const colors = pixelDocument.palette.filter(Boolean).length
    const opaquePixels = decodePixelRuns(pixelDocument).filter(Boolean).length
    return {
      slotId,
      width: pixelDocument.width,
      height: pixelDocument.height,
      colors,
      opaquePixels,
      bytes: pixelDocumentBytes(pixelDocument),
      passed: pixelDocument.width === expected[0]
        && pixelDocument.height === expected[1]
        && colors <= 16
        && opaquePixels > 0,
    }
  })
  return {
    passed: files.every((file) => file.passed),
    files,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  }
}

function safeFilename(value, fallback = 'happyseed-kit') {
  return String(value || fallback).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-') || fallback
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG 编码失败')), 'image/png'))
}

export function kitProjectPayload(project, name) {
  const audit = auditKitProject(project)
  return {
    schemaVersion: KIT_PIXEL_SCHEMA,
    name,
    generatedAt: new Date().toISOString(),
    teamId: project.entry.teamId,
    kitType: project.entry.kitType,
    partSetId: STUDIO_PART_SET_ID,
    source: project.entry.source,
    runtimeRoot: project.entry.runtimeRoot,
    slots: project.slots,
    audit,
  }
}

export function downloadKitPixelJson(project, name) {
  const filename = safeFilename(name)
  const bytes = new TextEncoder().encode(`${JSON.stringify(kitProjectPayload(project, filename), null, 2)}\n`)
  downloadBytes(bytes, `${filename}.hskit.json`, 'application/json')
}

export async function downloadKitPngPack(project, name) {
  const filename = safeFilename(name)
  const files = {}
  for (const [slotId, pixelDocument] of Object.entries(project.slots)) {
    const blob = await canvasToBlob(renderIndexedPixelDocument(pixelDocument))
    files[`${filename}/${slotId}.png`] = new Uint8Array(await blob.arrayBuffer())
  }
  files[`${filename}/kit.json`] = strToU8(`${JSON.stringify(kitProjectPayload(project, filename), null, 2)}\n`)
  downloadBytes(zipSync(files, { level: 9 }), `${filename}.zip`, 'application/zip')
}

export async function downloadKitSlotPng(project, slotId, name) {
  const blob = await canvasToBlob(renderIndexedPixelDocument(project.slots[slotId]))
  downloadBytes(new Uint8Array(await blob.arrayBuffer()), `${safeFilename(name)}-${slotId}.png`, 'image/png')
}

function keepLargestComponent(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let offset = 0; offset < data.length; offset += 4) {
    if (Math.max(data[offset], data[offset + 1], data[offset + 2]) <= 8) data[offset + 3] = 0
    else data[offset + 3] = 255
  }
  const seen = new Uint8Array(canvas.width * canvas.height)
  let largest = []
  for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
    const start = y * canvas.width + x
    if (seen[start] || data[start * 4 + 3] === 0) continue
    const stack = [[x, y]]
    const component = []
    seen[start] = 1
    while (stack.length) {
      const [currentX, currentY] = stack.pop()
      component.push([currentX, currentY])
      for (const [nextX, nextY] of [[currentX - 1, currentY], [currentX + 1, currentY], [currentX, currentY - 1], [currentX, currentY + 1]]) {
        if (nextX < 0 || nextY < 0 || nextX >= canvas.width || nextY >= canvas.height) continue
        const next = nextY * canvas.width + nextX
        if (seen[next] || data[next * 4 + 3] === 0) continue
        seen[next] = 1
        stack.push([nextX, nextY])
      }
    }
    if (component.length > largest.length) largest = component
  }
  const keep = new Uint8Array(canvas.width * canvas.height)
  largest.forEach(([x, y]) => { keep[y * canvas.width + x] = 1 })
  let minX = canvas.width; let minY = canvas.height; let maxX = -1; let maxY = -1
  for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
    const index = y * canvas.width + x
    if (!keep[index]) data[index * 4 + 3] = 0
    else { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
  }
  context.putImageData(imageData, 0, 0)
  if (maxX < minX) throw new Error('所选格没有识别到球员')
  const output = document.createElement('canvas')
  output.width = maxX - minX + 1
  output.height = maxY - minY + 1
  output.getContext('2d').drawImage(canvas, minX, minY, output.width, output.height, 0, 0, output.width, output.height)
  return output
}

export function extractRosterPlayerCanvas(image, column) {
  const cellWidth = image.naturalWidth / 6
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(cellWidth)
  canvas.height = Math.round(image.naturalHeight * 0.29)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(
    image,
    Math.round(column * cellWidth), 0, Math.round(cellWidth), canvas.height,
    0, 0, canvas.width, canvas.height,
  )
  return keepLargestComponent(canvas)
}

function opaqueBounds(pixelDocument, indices) {
  let minX = pixelDocument.width; let minY = pixelDocument.height; let maxX = -1; let maxY = -1
  indices.forEach((value, index) => {
    if (!value) return
    const x = index % pixelDocument.width
    const y = Math.floor(index / pixelDocument.width)
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  })
  return maxX < minX ? null : { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function cleanBackDocument(front) {
  const mirrored = mirrorPixelDocument(front, { slotId: 'shirt_back', generatedBack: true })
  const indices = decodePixelRuns(mirrored)
  const bounds = opaqueBounds(mirrored, indices)
  if (!bounds) return mirrored
  const counts = new Map()
  indices.forEach((value) => { if (value > 1) counts.set(value, (counts.get(value) || 0) + 1) })
  const base = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 2
  const outside = new Uint8Array(mirrored.width * mirrored.height)
  const stack = []
  for (let x = 0; x < mirrored.width; x += 1) stack.push([x, 0], [x, mirrored.height - 1])
  for (let y = 0; y < mirrored.height; y += 1) stack.push([0, y], [mirrored.width - 1, y])
  for (let y = 0; y < Math.round(mirrored.height * 0.38); y += 1) {
    for (let x = Math.round(mirrored.width * 0.30); x < Math.round(mirrored.width * 0.70); x += 1) {
      if (!indices[y * mirrored.width + x]) stack.push([x, y])
    }
  }
  while (stack.length) {
    const [x, y] = stack.pop()
    if (x < 0 || y < 0 || x >= mirrored.width || y >= mirrored.height) continue
    const offset = y * mirrored.width + x
    if (outside[offset] || indices[offset]) continue
    outside[offset] = 1
    stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1])
  }
  const output = Array(indices.length).fill(0)
  for (let y = 0; y < mirrored.height; y += 1) for (let x = 0; x < mirrored.width; x += 1) {
    const offset = y * mirrored.width + x
    if (outside[offset]) continue
    const boundary = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => (
      nx < 0 || ny < 0 || nx >= mirrored.width || ny >= mirrored.height || outside[ny * mirrored.width + nx]
    ))
    output[offset] = boundary ? 1 : 2
  }
  return createIndexedPixelDocument(
    mirrored.width,
    mirrored.height,
    [null, '#121719', mirrored.palette[base] || '#234F91'],
    output,
    mirrored.metadata,
  )
}

export function compileRosterSelection(image, column, currentProject, number = 10) {
  const playerCanvas = extractRosterPlayerCanvas(image, column)
  const source = imageToIndexedPixelDocument(playerCanvas, { targetWidth: 96, maxColors: 14 })
  const sliced = slicePaperDollPixelDocuments(source, null, DEFAULT_SOURCE_SEGMENTS, { number })
  const slots = {}
  Object.keys(currentProject.slots).forEach((slotId) => {
    if (slotId === 'shirt_back') return
    const sourceId = slotId === 'hand_left' ? 'hand_left_glove' : slotId === 'hand_right' ? 'hand_right_glove' : slotId
    slots[slotId] = {
      ...structuredClone(sliced[sourceId]),
      metadata: { ...sliced[sourceId].metadata, slotId, source: 'direct-roster-crop' },
    }
  })
  slots.shirt_back = cleanBackDocument(slots.shirt_front)
  return {
    ...currentProject,
    slots,
    baseSlots: structuredClone(slots),
    sourceReference: playerCanvas.toDataURL('image/png'),
  }
}
