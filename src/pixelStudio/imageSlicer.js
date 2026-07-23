import { STUDIO_SLOT_SIZES } from './model.js'

export const INDEXED_PIXEL_SCHEMA = 'happyseed-indexed-pixels-v1'
export const PAPER_DOLL_PIXEL_SCHEMA = 'happyseed-paper-doll-pixels-v1'

export const DEFAULT_SOURCE_SEGMENTS = Object.freeze({
  head_front: { x: 0.18, y: 0.00, width: 0.64, height: 0.49 },
  head_back: { x: 0.18, y: 0.00, width: 0.64, height: 0.49 },
  neck: { x: 0.41, y: 0.36, width: 0.18, height: 0.12 },
  shirt_front: { x: 0.20, y: 0.43, width: 0.60, height: 0.27 },
  shirt_back: { x: 0.20, y: 0.43, width: 0.60, height: 0.27 },
  sleeve_left: { x: 0.12, y: 0.44, width: 0.20, height: 0.20 },
  sleeve_right: { x: 0.68, y: 0.44, width: 0.20, height: 0.20 },
  arm_left: { x: 0.12, y: 0.50, width: 0.18, height: 0.22 },
  arm_right: { x: 0.70, y: 0.50, width: 0.18, height: 0.22 },
  hand_left: { x: 0.12, y: 0.61, width: 0.20, height: 0.17 },
  hand_right: { x: 0.68, y: 0.61, width: 0.20, height: 0.17 },
  shorts: { x: 0.28, y: 0.70, width: 0.44, height: 0.10 },
  shorts_leg: { x: 0.29, y: 0.72, width: 0.21, height: 0.15 },
  knee: { x: 0.32, y: 0.78, width: 0.17, height: 0.11 },
  socks: { x: 0.29, y: 0.82, width: 0.21, height: 0.12 },
  shoes: { x: 0.22, y: 0.90, width: 0.31, height: 0.10 },
  hand_left_glove: { x: 0.10, y: 0.56, width: 0.23, height: 0.23 },
  hand_right_glove: { x: 0.67, y: 0.56, width: 0.23, height: 0.23 },
})

export const SOURCE_SLOT_LABELS = Object.freeze({
  head_front: '头部正面', head_back: '头部背面', neck: '颈部',
  shirt_front: '球衣正面', shirt_back: '球衣背面',
  sleeve_left: '左袖', sleeve_right: '右袖', arm_left: '左臂', arm_right: '右臂',
  hand_left: '左手', hand_right: '右手', shorts: '球裤腰', shorts_leg: '裤腿',
  knee: '腿部', socks: '球袜', shoes: '球鞋',
  hand_left_glove: '左手套', hand_right_glove: '右手套',
})

// These are the visible bounds used by the approved paper-doll master. The
// Runtime canvases are deliberately larger because Spine needs stable pivots;
// artwork must never be stretched to fill those canvases.
export const SLOT_FIT_RULES = Object.freeze({
  head_front: { visible: [46, 52], bottom: 5 },
  head_back: { visible: [46, 50], bottom: 6 },
  neck: { visible: [10, 14], bottom: 2 },
  shirt_front: { visible: [56, 46], bottom: 1 },
  shirt_back: { visible: [56, 45], bottom: 1 },
  sleeve_left: { visible: [13, 20], bottom: 1 },
  sleeve_right: { visible: [20, 17], bottom: 1 },
  arm_left: { visible: [10, 10], bottom: 0 },
  arm_right: { visible: [10, 15], bottom: 1 },
  hand_left: { visible: [11, 16], bottom: 5 },
  hand_right: { visible: [11, 17], bottom: 10 },
  shorts: { visible: [52, 8], bottom: 0 },
  shorts_leg: { visible: [11, 15], bottom: 0 },
  knee: { visible: [6, 8], bottom: 0 },
  socks: { visible: [9, 13], bottom: 0 },
  shoes: { visible: [15, 6], bottom: 0 },
  hand_left_glove: { visible: [23, 22], bottom: 1 },
  hand_right_glove: { visible: [23, 23], bottom: 1 },
})

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function hex(red, green, blue) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function rgb(value) {
  const normalized = String(value || '#000000').replace('#', '')
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) || 0)
}

function colorDistance(first, second) {
  return ((first[0] - second[0]) ** 2) + ((first[1] - second[1]) ** 2) + ((first[2] - second[2]) ** 2)
}

export function encodePixelRuns(indices = []) {
  const runs = []
  for (const value of indices) {
    const previous = runs[runs.length - 1]
    if (previous && previous[1] === value) previous[0] += 1
    else runs.push([1, value])
  }
  return runs
}

export function decodePixelRuns(document) {
  const expected = Math.max(0, Number(document?.width) * Number(document?.height))
  const output = []
  for (const [length, value] of document?.runs || []) {
    for (let index = 0; index < length && output.length < expected; index += 1) output.push(value)
  }
  while (output.length < expected) output.push(0)
  return output
}

export function createIndexedPixelDocument(width, height, palette, indices, metadata = {}) {
  return {
    schemaVersion: INDEXED_PIXEL_SCHEMA,
    width,
    height,
    palette: palette.map((color) => color === null ? null : String(color).toUpperCase()),
    runs: encodePixelRuns(indices),
    metadata,
  }
}

export function imageToIndexedPixelDocument(image, options = {}) {
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = image.naturalWidth || image.width
  sourceCanvas.height = image.naturalHeight || image.height
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
  sourceContext.imageSmoothingEnabled = false
  sourceContext.drawImage(image, 0, 0)
  const sourceData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const alphaThreshold = clamp(Number(options.alphaThreshold) || 24, 0, 255)
  let minX = sourceCanvas.width
  let minY = sourceCanvas.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < sourceCanvas.height; y += 1) for (let x = 0; x < sourceCanvas.width; x += 1) {
    if (sourceData.data[(y * sourceCanvas.width + x) * 4 + 3] < alphaThreshold) continue
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  if (maxX < minX || maxY < minY) throw new Error('图片没有可识别的不透明球员像素')

  const cropWidth = maxX - minX + 1
  const cropHeight = maxY - minY + 1
  const width = clamp(Math.round(Number(options.targetWidth) || 92), 32, 160)
  const height = Math.max(1, Math.round((cropHeight / cropWidth) * width))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, width, height)
  context.drawImage(sourceCanvas, minX, minY, cropWidth, cropHeight, 0, 0, width, height)
  const data = context.getImageData(0, 0, width, height).data

  const histogram = new Map()
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < alphaThreshold) continue
    const key = `${data[index] >> 3},${data[index + 1] >> 3},${data[index + 2] >> 3}`
    const entry = histogram.get(key) || { count: 0, red: 0, green: 0, blue: 0 }
    entry.count += 1; entry.red += data[index]; entry.green += data[index + 1]; entry.blue += data[index + 2]
    histogram.set(key, entry)
  }
  const maxColors = clamp(Math.round(Number(options.maxColors) || 16), 4, 32)
  const ranked = [...histogram.values()].sort((a, b) => b.count - a.count).slice(0, maxColors)
  const palette = [null, ...ranked.map((entry) => hex(
    Math.round(entry.red / entry.count),
    Math.round(entry.green / entry.count),
    Math.round(entry.blue / entry.count),
  ))]
  const paletteRgb = palette.map((color) => color ? rgb(color) : null)
  const indices = []
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < alphaThreshold) {
      indices.push(0)
      continue
    }
    const source = [data[index], data[index + 1], data[index + 2]]
    let best = 1
    let distance = Number.POSITIVE_INFINITY
    for (let paletteIndex = 1; paletteIndex < paletteRgb.length; paletteIndex += 1) {
      const candidate = colorDistance(source, paletteRgb[paletteIndex])
      if (candidate < distance) { best = paletteIndex; distance = candidate }
    }
    indices.push(best)
  }
  return createIndexedPixelDocument(width, height, palette, indices, {
    sourceWidth: sourceCanvas.width,
    sourceHeight: sourceCanvas.height,
    crop: [minX, minY, cropWidth, cropHeight],
    alphaThreshold,
  })
}

export function renderIndexedPixelDocument(pixelDocument, scale = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = pixelDocument.width * scale
  canvas.height = pixelDocument.height * scale
  const logical = document.createElement('canvas')
  logical.width = pixelDocument.width
  logical.height = pixelDocument.height
  const context = logical.getContext('2d')
  const imageData = context.createImageData(logical.width, logical.height)
  const indices = decodePixelRuns(pixelDocument)
  const colors = pixelDocument.palette.map((color) => color ? rgb(color) : null)
  indices.forEach((paletteIndex, index) => {
    const offset = index * 4
    const color = colors[paletteIndex]
    if (!color) return
    imageData.data[offset] = color[0]
    imageData.data[offset + 1] = color[1]
    imageData.data[offset + 2] = color[2]
    imageData.data[offset + 3] = 255
  })
  context.putImageData(imageData, 0, 0)
  const output = canvas.getContext('2d')
  output.imageSmoothingEnabled = false
  output.drawImage(logical, 0, 0, canvas.width, canvas.height)
  return canvas
}

export function extractSlotPixelDocument(source, segment, slotId) {
  const size = STUDIO_SLOT_SIZES[slotId]
  if (!size) throw new Error(`未知插槽：${slotId}`)
  const sourceIndices = decodePixelRuns(source)
  const left = clamp(Math.floor(segment.x * source.width), 0, source.width - 1)
  const top = clamp(Math.floor(segment.y * source.height), 0, source.height - 1)
  const cropWidth = clamp(Math.round(segment.width * source.width), 1, source.width - left)
  const cropHeight = clamp(Math.round(segment.height * source.height), 1, source.height - top)
  const crop = []
  let minX = cropWidth
  let minY = cropHeight
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < cropHeight; y += 1) for (let x = 0; x < cropWidth; x += 1) {
    const value = sourceIndices[(top + y) * source.width + left + x] || 0
    crop.push(value)
    if (value) {
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
  }

  const output = Array(size[0] * size[1]).fill(0)
  if (maxX >= minX && maxY >= minY) {
    const artWidth = maxX - minX + 1
    const artHeight = maxY - minY + 1
    const rule = SLOT_FIT_RULES[slotId] || { visible: size, bottom: 0 }
    const scale = Math.min(rule.visible[0] / artWidth, rule.visible[1] / artHeight)
    const drawWidth = Math.max(1, Math.round(artWidth * scale))
    const drawHeight = Math.max(1, Math.round(artHeight * scale))
    const targetX = Math.floor((size[0] - drawWidth) / 2)
    const targetY = Math.max(0, size[1] - rule.bottom - drawHeight)
    for (let y = 0; y < drawHeight; y += 1) for (let x = 0; x < drawWidth; x += 1) {
      const sourceX = minX + clamp(Math.floor(((x + 0.5) / drawWidth) * artWidth), 0, artWidth - 1)
      const sourceY = minY + clamp(Math.floor(((y + 0.5) / drawHeight) * artHeight), 0, artHeight - 1)
      output[(targetY + y) * size[0] + targetX + x] = crop[sourceY * cropWidth + sourceX]
    }
  }
  return createIndexedPixelDocument(size[0], size[1], source.palette, output, {
    slotId,
    segment,
    fitRule: SLOT_FIT_RULES[slotId] || { visible: size, bottom: 0 },
  })
}

function luminance(color) {
  const [red, green, blue] = rgb(color)
  return red * 0.299 + green * 0.587 + blue * 0.114
}

function opaqueBounds(pixelDocument, indices = decodePixelRuns(pixelDocument)) {
  let minX = pixelDocument.width
  let minY = pixelDocument.height
  let maxX = -1
  let maxY = -1
  indices.forEach((value, index) => {
    if (!value) return
    const x = index % pixelDocument.width
    const y = Math.floor(index / pixelDocument.width)
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  })
  return maxX < minX ? null : { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function mostFrequentIndex(pixelDocument, predicate = () => true) {
  const counts = new Map()
  for (const value of decodePixelRuns(pixelDocument)) {
    if (!value || !predicate(pixelDocument.palette[value], value)) continue
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 1
}

function nearestPaletteIndex(palette, target) {
  const targetRgb = rgb(target)
  let best = 1
  let distance = Number.POSITIVE_INFINITY
  for (let index = 1; index < palette.length; index += 1) {
    const candidate = colorDistance(rgb(palette[index]), targetRgb)
    if (candidate < distance) { best = index; distance = candidate }
  }
  return best
}

export function mirrorPixelDocument(pixelDocument, metadata = {}) {
  const source = decodePixelRuns(pixelDocument)
  const output = Array(source.length).fill(0)
  for (let y = 0; y < pixelDocument.height; y += 1) for (let x = 0; x < pixelDocument.width; x += 1) {
    output[y * pixelDocument.width + (pixelDocument.width - 1 - x)] = source[y * pixelDocument.width + x]
  }
  return createIndexedPixelDocument(pixelDocument.width, pixelDocument.height, pixelDocument.palette, output, {
    ...pixelDocument.metadata,
    ...metadata,
  })
}

export function synthesizeHeadBack(frontHead) {
  const mirrored = mirrorPixelDocument(frontHead)
  const indices = decodePixelRuns(mirrored)
  const bounds = opaqueBounds(mirrored, indices)
  if (!bounds) return mirrored
  const skinIndex = mostFrequentIndex(mirrored, (color) => {
    const [red, green, blue] = rgb(color)
    return red > 70 && red > green * 1.08 && red > blue * 1.25
  })
  const hairIndex = mostFrequentIndex(mirrored, (color) => luminance(color) < 105)
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    const offset = y * mirrored.width + x
    if (!indices[offset]) continue
    const relativeX = (x - bounds.minX) / Math.max(1, bounds.width - 1)
    const relativeY = (y - bounds.minY) / Math.max(1, bounds.height - 1)
    const color = mirrored.palette[indices[offset]]
    const light = luminance(color)
    if (relativeY < 0.38 && relativeX > 0.08 && relativeX < 0.92 && light > 110) indices[offset] = hairIndex
    if (relativeY >= 0.38 && relativeY < 0.80 && relativeX > 0.17 && relativeX < 0.83 && (light > 158 || light < 58)) {
      indices[offset] = skinIndex
    }
  }
  return createIndexedPixelDocument(mirrored.width, mirrored.height, mirrored.palette, indices, {
    ...frontHead.metadata,
    slotId: 'head_back',
    generatedBack: true,
    strategy: 'mirror-remove-face',
  })
}

const DIGITS = Object.freeze({
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
})

export function synthesizeShirtBack(frontShirt, number = 10) {
  const mirrored = mirrorPixelDocument(frontShirt)
  const indices = decodePixelRuns(mirrored)
  const bounds = opaqueBounds(mirrored, indices)
  if (!bounds) return mirrored
  const outlineIndex = mostFrequentIndex(mirrored, (color) => luminance(color) < 75)
  const baseIndex = mostFrequentIndex(mirrored, (color, index) => index !== outlineIndex && luminance(color) > 45)
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    const offset = y * mirrored.width + x
    if (!indices[offset]) continue
    const neighbours = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    const boundary = neighbours.some(([nextX, nextY]) => nextX < 0 || nextY < 0 || nextX >= mirrored.width || nextY >= mirrored.height || !indices[nextY * mirrored.width + nextX])
    if (!boundary && indices[offset] !== outlineIndex) indices[offset] = baseIndex
  }

  const numberText = String(clamp(Math.round(Number(number) || 10), 1, 99))
  const scale = 3
  const glyphWidth = 3 * scale
  const gap = scale
  const totalWidth = numberText.length * glyphWidth + (numberText.length - 1) * gap
  const startX = Math.round((mirrored.width - totalWidth) / 2)
  const startY = Math.max(bounds.minY + 7, Math.round(bounds.minY + bounds.height * 0.24))
  const lightIndex = nearestPaletteIndex(mirrored.palette, '#F5F1E8')
  const numberPixels = []
  numberText.split('').forEach((digit, digitIndex) => {
    DIGITS[digit].forEach((row, glyphY) => row.split('').forEach((bit, glyphX) => {
      if (bit !== '1') return
      for (let y = 0; y < scale; y += 1) for (let x = 0; x < scale; x += 1) {
        numberPixels.push([startX + digitIndex * (glyphWidth + gap) + glyphX * scale + x, startY + glyphY * scale + y])
      }
    }))
  })
  const numberSet = new Set(numberPixels.map(([x, y]) => `${x}:${y}`))
  for (const [x, y] of numberPixels) for (let offsetY = -1; offsetY <= 1; offsetY += 1) for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
    const targetX = x + offsetX
    const targetY = y + offsetY
    if (targetX < 0 || targetY < 0 || targetX >= mirrored.width || targetY >= mirrored.height) continue
    if (!numberSet.has(`${targetX}:${targetY}`) && indices[targetY * mirrored.width + targetX]) indices[targetY * mirrored.width + targetX] = outlineIndex
  }
  for (const [x, y] of numberPixels) if (x >= 0 && y >= 0 && x < mirrored.width && y < mirrored.height && indices[y * mirrored.width + x]) {
    indices[y * mirrored.width + x] = lightIndex
  }
  return createIndexedPixelDocument(mirrored.width, mirrored.height, mirrored.palette, indices, {
    ...frontShirt.metadata,
    slotId: 'shirt_back',
    generatedBack: true,
    strategy: 'mirror-clean-front-add-number',
    number: Number(numberText),
  })
}

export function slicePaperDollPixelDocuments(front, back, segments = DEFAULT_SOURCE_SEGMENTS, options = {}) {
  const slots = Object.fromEntries(Object.keys(segments).filter((slotId) => slotId !== 'head_back' && slotId !== 'shirt_back').map((slotId) => (
    [slotId, extractSlotPixelDocument(front, segments[slotId], slotId)]
  )))
  if (back) {
    slots.head_back = extractSlotPixelDocument(back, segments.head_back, 'head_back')
    slots.shirt_back = extractSlotPixelDocument(back, segments.shirt_back, 'shirt_back')
  } else {
    slots.head_back = synthesizeHeadBack(extractSlotPixelDocument(front, segments.head_front, 'head_front'))
    slots.shirt_back = synthesizeShirtBack(extractSlotPixelDocument(front, segments.shirt_front, 'shirt_front'), options.number)
  }
  return slots
}

export function replacePixel(pixelDocument, x, y, paletteIndex, brushSize = 1, mirror = false) {
  const indices = decodePixelRuns(pixelDocument)
  const radius = Math.floor(brushSize / 2)
  const put = (targetX, targetY) => {
    if (targetX < 0 || targetY < 0 || targetX >= pixelDocument.width || targetY >= pixelDocument.height) return
    indices[targetY * pixelDocument.width + targetX] = paletteIndex
  }
  for (let targetY = y - radius; targetY <= y + radius; targetY += 1) for (let targetX = x - radius; targetX <= x + radius; targetX += 1) {
    put(targetX, targetY)
    if (mirror) put(pixelDocument.width - 1 - targetX, targetY)
  }
  return createIndexedPixelDocument(pixelDocument.width, pixelDocument.height, pixelDocument.palette, indices, pixelDocument.metadata)
}

export function floodFillPixel(pixelDocument, x, y, paletteIndex) {
  const indices = decodePixelRuns(pixelDocument)
  const start = y * pixelDocument.width + x
  const target = indices[start]
  if (target === paletteIndex) return pixelDocument
  const queue = [[x, y]]
  const visited = new Uint8Array(indices.length)
  while (queue.length) {
    const [currentX, currentY] = queue.pop()
    if (currentX < 0 || currentY < 0 || currentX >= pixelDocument.width || currentY >= pixelDocument.height) continue
    const index = currentY * pixelDocument.width + currentX
    if (visited[index] || indices[index] !== target) continue
    visited[index] = 1
    indices[index] = paletteIndex
    queue.push([currentX - 1, currentY], [currentX + 1, currentY], [currentX, currentY - 1], [currentX, currentY + 1])
  }
  return createIndexedPixelDocument(pixelDocument.width, pixelDocument.height, pixelDocument.palette, indices, pixelDocument.metadata)
}

export function countOpaquePixels(pixelDocument) {
  return decodePixelRuns(pixelDocument).filter(Boolean).length
}

export function countLightBoundaryPixels(pixelDocument) {
  const indices = decodePixelRuns(pixelDocument)
  const lightPalette = new Set(pixelDocument.palette.flatMap((color, index) => {
    if (!color) return []
    const [red, green, blue] = rgb(color)
    return red > 205 && green > 205 && blue > 195 ? [index] : []
  }))
  let count = 0
  for (let y = 0; y < pixelDocument.height; y += 1) for (let x = 0; x < pixelDocument.width; x += 1) {
    const index = y * pixelDocument.width + x
    if (!lightPalette.has(indices[index])) continue
    const touchesTransparency = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nextX, nextY]) => (
      nextX < 0 || nextY < 0 || nextX >= pixelDocument.width || nextY >= pixelDocument.height
        || !indices[nextY * pixelDocument.width + nextX]
    ))
    if (touchesTransparency) count += 1
  }
  return count
}

export function pixelDocumentBytes(pixelDocument) {
  return new TextEncoder().encode(JSON.stringify(pixelDocument)).byteLength
}
