import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import {
  HAPPYSEED_HUMAN_PART_SET_ID,
  HAPPYSEED_SLOT_TEXTURE_SIZES,
  getHappySeedHumanRecipes,
} from '../src/utils/happySeedHumanPlayer.js'

const projectRoot = path.resolve(import.meta.dirname, '..')
const publicRoot = path.join(projectRoot, 'public')

const CRC_TABLE = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1)
  }
  CRC_TABLE[index] = value >>> 0
}

function crc32(buffer) {
  let value = 0xFFFFFFFF
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xFF] ^ (value >>> 8)
  return (value ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, checksum])
}

function parseColor(value) {
  if (Array.isArray(value)) return value
  const normalized = String(value).replace('#', '')
  const rgb = normalized.length === 3
    ? [...normalized].map((digit) => Number.parseInt(digit + digit, 16))
    : [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16))
  return [...rgb, 255]
}

class PixelSurface {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.data = new Uint8Array(width * height * 4)
  }

  pixel(x, y, color) {
    const px = Math.round(x)
    const py = Math.round(y)
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return
    const offset = (py * this.width + px) * 4
    const rgba = parseColor(color)
    this.data[offset] = rgba[0]
    this.data[offset + 1] = rgba[1]
    this.data[offset + 2] = rgba[2]
    this.data[offset + 3] = rgba[3] ?? 255
  }

  rect(x, y, width, height, color) {
    for (let py = Math.round(y); py < Math.round(y + height); py += 1) {
      for (let px = Math.round(x); px < Math.round(x + width); px += 1) this.pixel(px, py, color)
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    const minX = Math.floor(cx - rx)
    const maxX = Math.ceil(cx + rx)
    const minY = Math.floor(cy - ry)
    const maxY = Math.ceil(cy + ry)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if ((dx * dx) + (dy * dy) <= 1) this.pixel(x, y, color)
      }
    }
  }

  polygon(points, color) {
    const minX = Math.floor(Math.min(...points.map(([x]) => x)))
    const maxX = Math.ceil(Math.max(...points.map(([x]) => x)))
    const minY = Math.floor(Math.min(...points.map(([, y]) => y)))
    const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)))
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        let inside = false
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
          const [xi, yi] = points[i]
          const [xj, yj] = points[j]
          const crosses = ((yi > y) !== (yj > y))
            && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1) + xi)
          if (crosses) inside = !inside
        }
        if (inside) this.pixel(x, y, color)
      }
    }
  }

  toPng() {
    const stride = (this.width * 4) + 1
    const scanlines = Buffer.alloc(stride * this.height)
    for (let y = 0; y < this.height; y += 1) {
      const rowOffset = y * stride
      scanlines[rowOffset] = 0
      Buffer.from(this.data.buffer, y * this.width * 4, this.width * 4).copy(scanlines, rowOffset + 1)
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(this.width, 0)
    ihdr.writeUInt32BE(this.height, 4)
    ihdr[8] = 8
    ihdr[9] = 6
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
      pngChunk('IEND'),
    ])
  }
}

function surfaceFor(part) {
  const [width, height] = HAPPYSEED_SLOT_TEXTURE_SIZES[part]
  return new PixelSurface(width, height)
}

function drawHead(appearance, back = false) {
  const image = surfaceFor(back ? 'head_back' : 'head_front')
  const outline = '#171A1E'
  // The v3 production doll keeps the attachment canvas but uses the authored
  // master-sheet proportions: the head is narrower than the torso and leaves
  // breathing room around the original Spine pivot.
  image.polygon([
    [25, 9], [53, 9], [61, 17], [63, 49], [56, 60],
    [50, 65], [31, 65], [24, 60], [17, 50], [18, 20],
  ], outline)
  image.rect(13, 32, 6, 15, outline)
  image.rect(62, 32, 6, 15, outline)
  image.polygon([
    [23, 20], [57, 20], [60, 29], [59, 50], [53, 59],
    [48, 62], [33, 62], [27, 59], [21, 50], [20, 29],
  ], appearance.skin)
  image.rect(15, 35, 6, 10, appearance.skin)
  image.rect(59, 35, 6, 10, appearance.skin)
  image.rect(16, 37, 3, 5, appearance.skinHighlight)
  image.rect(62, 37, 2, 5, appearance.skinShadow)
  image.rect(27, 55, 27, 6, appearance.skinShadow)

  if (back) {
    image.polygon([
      [22, 17], [27, 10], [53, 10], [60, 18], [61, 42],
      [55, 49], [26, 49], [19, 42], [19, 23],
    ], appearance.hair)
    image.rect(20, 45, 40, 9, appearance.hair)
    image.rect(23, 13, 10, 4, appearance.hairHighlight)
    image.rect(37, 10, 15, 4, appearance.hairHighlight)
    image.rect(54, 18, 7, 4, appearance.hairHighlight)
    return image
  }

  image.polygon([
    [21, 17], [26, 10], [35, 10], [37, 6], [45, 10],
    [53, 10], [60, 19], [60, 29], [54, 25], [26, 25],
    [21, 30], [19, 21],
  ], appearance.hair)
  image.rect(24, 18, 34, 9, appearance.hair)
  image.rect(27, 12, 8, 4, appearance.hairHighlight)
  image.rect(38, 9, 11, 4, appearance.hairHighlight)
  image.rect(51, 15, 6, 4, appearance.hairHighlight)
  image.rect(25, 34, 11, 13, '#F8F2E2')
  image.rect(45, 34, 11, 13, '#F8F2E2')
  image.rect(29, 35, 6, 12, '#11151B')
  image.rect(46, 35, 6, 12, '#11151B')
  image.rect(26, 30, 10, 3, appearance.hair)
  image.rect(45, 30, 10, 3, appearance.hair)
  image.rect(38, 45, 5, 8, appearance.skinShadow)
  image.rect(34, 55, 14, 3, '#572C25')
  if (appearance.beard) {
    image.rect(21, 51, 6, 10, appearance.hair)
    image.rect(55, 51, 6, 10, appearance.hair)
    image.rect(27, 60, 28, 6, appearance.hair)
    image.rect(32, 56, 18, 7, appearance.hair)
    image.rect(36, 59, 10, 3, '#8C4D32')
  }
  return image
}

function drawLimb(part, appearance) {
  const image = surfaceFor(part)
  const outline = '#171A1E'
  if (part === 'arm_left') {
    image.polygon([[0, 3], [7, 0], [13, 4], [11, 10], [3, 10]], outline)
    image.polygon([[2, 4], [7, 2], [11, 5], [9, 8], [4, 8]], appearance.skin)
  } else if (part === 'arm_right') {
    image.polygon([[1, 1], [8, 0], [14, 8], [11, 16], [5, 13], [0, 6]], outline)
    image.polygon([[3, 2], [7, 2], [12, 8], [10, 13], [6, 11], [2, 6]], appearance.skin)
  } else if (part === 'hand_left') {
    image.rect(7, 5, 12, 17, outline)
    image.rect(9, 7, 8, 13, appearance.skin)
    image.rect(9, 7, 3, 8, appearance.skinHighlight)
    image.rect(17, 11, 4, 6, outline)
    image.rect(17, 12, 2, 4, appearance.skin)
  } else if (part === 'hand_right') {
    image.rect(6, 9, 11, 19, outline)
    image.rect(8, 11, 7, 15, appearance.skin)
    image.rect(8, 11, 3, 9, appearance.skinHighlight)
    image.rect(15, 16, 5, 7, outline)
    image.rect(15, 17, 3, 5, appearance.skin)
  } else if (part === 'knee') {
    image.rect(0, 1, 8, 8, outline)
    image.rect(2, 2, 5, 6, appearance.skin)
    image.rect(2, 2, 3, 2, appearance.skinHighlight)
  } else if (part === 'neck') {
    image.polygon([[3, 2], [16, 1], [19, 12], [13, 17], [5, 16], [0, 11]], outline)
    image.polygon([[5, 3], [14, 3], [16, 11], [12, 15], [6, 14], [3, 10]], appearance.skin)
    image.rect(5, 4, 3, 7, appearance.skinHighlight)
  }
  return image
}

function drawShirt(part, palette) {
  const image = surfaceFor(part)
  const outline = '#171A1E'
  if (part === 'shirt_front' || part === 'shirt_back') {
    image.polygon([[5, 5], [17, 0], [39, 0], [51, 5], [55, 43], [46, 51], [10, 51], [0, 43]], outline)
    image.polygon([[8, 7], [19, 3], [37, 3], [48, 7], [51, 41], [43, 47], [13, 47], [4, 41]], palette.shirt)
    image.rect(24, 3, 9, 7, outline)
    image.rect(26, 3, 5, 5, '#F8F2E2')
    image.rect(4, 12, 47, 4, palette.accent)
    image.rect(25, 16, 6, 31, palette.accent)
    if (part === 'shirt_back') image.rect(20, 22, 17, 15, palette.shirt)
  } else if (part === 'sleeve_left') {
    image.polygon([[1, 1], [10, 0], [13, 17], [8, 21], [0, 16]], outline)
    image.polygon([[3, 3], [9, 2], [11, 16], [8, 18], [2, 15]], palette.shirt)
    image.rect(2, 11, 9, 4, palette.accent)
  } else if (part === 'sleeve_right') {
    image.polygon([[2, 0], [15, 1], [22, 11], [18, 17], [5, 15], [0, 7]], outline)
    image.polygon([[4, 2], [14, 3], [20, 11], [17, 15], [6, 13], [2, 7]], palette.shirt)
    image.rect(4, 9, 15, 4, palette.accent)
  }
  return image
}

export function drawKitPart(part, palette) {
  if (part.startsWith('shirt') || part.startsWith('sleeve')) return drawShirt(part, palette)
  const image = surfaceFor(part)
  const outline = '#171A1E'
  if (part === 'shorts') {
    image.rect(0, 0, 55, 8, outline)
    image.rect(3, 2, 49, 5, palette.shorts)
    image.rect(25, 2, 5, 6, palette.accent)
  } else if (part === 'shorts_leg') {
    image.polygon([[0, 0], [11, 0], [10, 15], [2, 15]], outline)
    image.polygon([[2, 2], [9, 2], [8, 13], [3, 13]], palette.shorts)
    image.rect(3, 3, 5, 3, palette.accent)
  } else if (part === 'socks') {
    image.polygon([[1, 0], [10, 0], [9, 13], [0, 13]], outline)
    image.polygon([[3, 2], [8, 2], [7, 11], [2, 11]], palette.socks)
    image.rect(2, 4, 6, 3, palette.accent)
  } else if (part === 'shoes') {
    image.polygon([[0, 1], [10, 0], [15, 3], [14, 5], [1, 5]], outline)
    image.rect(3, 2, 9, 2, palette.boots)
    image.rect(9, 1, 3, 1, '#F8F2E2')
  } else if (part === 'glove_left' || part === 'glove_right') {
    image.ellipse(image.width / 2, image.height / 2, (image.width / 2) - 1, (image.height / 2) - 1, outline)
    image.ellipse(image.width / 2, image.height / 2, (image.width / 2) - 4, (image.height / 2) - 4, palette.gloves)
    image.rect(5, 5, 4, image.height - 10, '#CCD6DF')
    image.rect(image.width - 10, 5, 4, image.height - 10, '#CCD6DF')
    image.rect(4, image.height - 7, image.width - 8, 3, palette.accent)
  }
  return image
}

const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
}

export function drawNumber(number, palette) {
  const image = surfaceFor('number')
  const text = String(number)
  const scale = text.length > 1 ? 2 : 3
  const digitWidth = 3 * scale
  const gap = scale
  const totalWidth = (digitWidth * text.length) + (gap * (text.length - 1))
  const startX = Math.floor((image.width - totalWidth) / 2)
  const startY = Math.floor((image.height - (5 * scale)) / 2)
  text.split('').forEach((digit, digitIndex) => {
    DIGITS[digit].forEach((row, rowIndex) => {
      row.split('').forEach((bit, columnIndex) => {
        if (bit !== '1') return
        const x = startX + (digitIndex * (digitWidth + gap)) + (columnIndex * scale)
        const y = startY + (rowIndex * scale)
        image.rect(x - 1, y - 1, scale + 2, scale + 2, palette.numberStroke)
        image.rect(x, y, scale, scale, palette.number)
      })
    })
  })
  return image
}

export async function writePng(relativePath, surface, manifest) {
  const outputPath = path.join(publicRoot, relativePath)
  await mkdir(path.dirname(outputPath), { recursive: true })
  const buffer = surface.toPng()
  await writeFile(outputPath, buffer)
  manifest.push({ path: `/` + relativePath.replaceAll(path.sep, '/'), bytes: buffer.byteLength })
}

async function generateProfile(recipe, manifest) {
  const playerRoot = `pixel/player/${HAPPYSEED_HUMAN_PART_SET_ID}/${recipe.id}`
  await writePng(`${playerRoot}/head_front.png`, drawHead(recipe.appearance, false), manifest)
  await writePng(`${playerRoot}/head_back.png`, drawHead(recipe.appearance, true), manifest)
  for (const part of ['arm_left', 'arm_right', 'hand_left', 'hand_right', 'knee', 'neck']) {
    await writePng(`${playerRoot}/${part}.png`, drawLimb(part, recipe.appearance), manifest)
  }

  const kitRoot = `pixel/kits/${recipe.teamId}/${recipe.kitType}/${HAPPYSEED_HUMAN_PART_SET_ID}`
  for (const part of ['shirt_front', 'shirt_back', 'sleeve_left', 'sleeve_right', 'shorts', 'shorts_leg', 'socks', 'shoes']) {
    await writePng(`${kitRoot}/${part}.png`, drawKitPart(part, recipe.palette), manifest)
  }
  if (recipe.role === 'goalkeeper') {
    await writePng(`${kitRoot}/hand_left.png`, drawKitPart('glove_left', recipe.palette), manifest)
    await writePng(`${kitRoot}/hand_right.png`, drawKitPart('glove_right', recipe.palette), manifest)
  }

  const numberRoot = `pixel/numbers/${HAPPYSEED_HUMAN_PART_SET_ID}`
  await writePng(`${numberRoot}/${recipe.number}.png`, drawNumber(recipe.number, recipe.palette), manifest)

  const recipeOutput = path.join(publicRoot, 'pixel', 'recipes', recipe.teamId, `${recipe.id}.json`)
  await mkdir(path.dirname(recipeOutput), { recursive: true })
  const recipeBuffer = Buffer.from(`${JSON.stringify(recipe, null, 2)}\n`)
  await writeFile(recipeOutput, recipeBuffer)
  manifest.push({
    path: `/pixel/recipes/${recipe.teamId}/${recipe.id}.json`,
    bytes: recipeBuffer.byteLength,
  })
}

export async function generateHumanRuntimeSlice() {
  const manifest = []
  const recipes = getHappySeedHumanRecipes()
  for (const recipe of recipes) await generateProfile(recipe, manifest)

  const uniqueManifest = [...new Map(manifest.map((item) => [item.path, item])).values()]
  const totalBytes = uniqueManifest.reduce((sum, item) => sum + item.bytes, 0)
  const manifestOutput = path.join(publicRoot, 'pixel', 'human-runtime-slice-manifest.json')
  await mkdir(path.dirname(manifestOutput), { recursive: true })
  await writeFile(manifestOutput, `${JSON.stringify({
    schemaVersion: 'happyseed-human-runtime-assets-v1',
    generatedBy: 'scripts/generate-human-runtime-slice.mjs',
    partSetId: HAPPYSEED_HUMAN_PART_SET_ID,
    profileCount: recipes.length,
    fileCount: uniqueManifest.length,
    totalBytes,
    totalKiB: Number((totalBytes / 1024).toFixed(2)),
    files: uniqueManifest,
  }, null, 2)}\n`)

  console.log(`Generated ${uniqueManifest.length} human runtime slice files (${(totalBytes / 1024).toFixed(2)} KiB).`)
  return { files: uniqueManifest, totalBytes }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) await generateHumanRuntimeSlice()
