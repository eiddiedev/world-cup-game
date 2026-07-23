import { getCatalogItem, getStudioKit, getStudioTeam } from './catalog.js'
import { STUDIO_SLOT_SIZES, getRecipePatchPoints } from './model.js'

const OUTLINE = '#121719'
const DEEP_OUTLINE = '#070A0B'
const WHITE = '#F8F5E9'

const DIGITS = Object.freeze({
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
})

export function createPixelCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  context.imageSmoothingEnabled = false
  return canvas
}

function fill(context, color, x, y, width, height) {
  context.fillStyle = color
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
}

function shade(hex, amount) {
  const normalized = String(hex).replace('#', '')
  const values = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) || 0)
  return `#${values.map((value) => Math.max(0, Math.min(255, Math.round(value * amount))).toString(16).padStart(2, '0')).join('')}`
}

function drawPixelPolygon(context, points, color) {
  context.fillStyle = color
  context.beginPath()
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(Math.round(x), Math.round(y))
    else context.lineTo(Math.round(x), Math.round(y))
  })
  context.closePath()
  context.fill()
}

function drawHeadBase(context, recipe, back) {
  const skin = getCatalogItem('skinToneId', recipe.appearance.skinToneId)
  const face = getCatalogItem('faceId', recipe.appearance.faceId)
  const variant = face?.variant || 0
  const left = 13 + (variant % 3)
  const right = 68 - ((variant >> 1) % 3)
  const top = 8 + (variant % 2)
  const chin = 68 - (variant % 4 === 0 ? 3 : 0)

  drawPixelPolygon(context, [
    [left + 8, top], [right - 8, top], [right, top + 10], [right + 2, chin - 15],
    [right - 7, chin], [48, chin + 5], [32, chin + 5], [left + 7, chin], [left - 2, chin - 15], [left, top + 10],
  ], DEEP_OUTLINE)
  drawPixelPolygon(context, [
    [left + 9, top + 4], [right - 9, top + 4], [right - 3, top + 12], [right - 2, chin - 15],
    [right - 9, chin - 3], [47, chin + 1], [33, chin + 1], [left + 9, chin - 3], [left + 2, chin - 15], [left + 3, top + 12],
  ], skin.base)
  fill(context, skin.highlight, left + 6, top + 16, 5, 31)
  fill(context, skin.highlight, left + 11, top + 9, 24, 4)
  fill(context, skin.shadow, right - 8, top + 15, 5, 34)
  fill(context, skin.shadow, left + 12, chin - 3, right - left - 24, 4)
  fill(context, OUTLINE, left - 6, top + 28, 7, 18)
  fill(context, skin.base, left - 3, top + 31, 6, 12)
  fill(context, OUTLINE, right - 1, top + 28, 7, 18)
  fill(context, skin.base, right - 2, top + 31, 6, 12)
  if (!back) drawFace(context, recipe, { left, right, top, chin, skin })
}

function drawFace(context, recipe, frame) {
  const eyes = getCatalogItem('eyesId', recipe.appearance.eyesId)?.variant || 0
  const brows = getCatalogItem('eyebrowsId', recipe.appearance.eyebrowsId)?.variant || 0
  const nose = getCatalogItem('noseId', recipe.appearance.noseId)?.variant || 0
  const mouth = getCatalogItem('mouthId', recipe.appearance.mouthId)?.variant || 0
  const eyeWidth = 10 + (eyes % 3) * 2
  const eyeHeight = 15 - (Math.floor(eyes / 3) % 3)
  const eyeY = frame.top + 26 + (eyes % 2)
  const eyeGap = 7 + (eyes % 4)
  const center = 40
  for (const direction of [-1, 1]) {
    const x = direction < 0 ? center - eyeGap - eyeWidth : center + eyeGap
    fill(context, OUTLINE, x - 2, eyeY - 2, eyeWidth + 4, eyeHeight + 4)
    fill(context, WHITE, x, eyeY, eyeWidth, eyeHeight)
    const pupilWidth = 3 + (eyes % 2)
    fill(context, '#101416', direction < 0 ? x + eyeWidth - pupilWidth - 1 : x + 1, eyeY + 2, pupilWidth, eyeHeight - 3)
    const browY = eyeY - 7 - (brows % 2)
    fill(context, OUTLINE, x - (brows % 3 === 0 ? 2 : 0), browY, eyeWidth + (brows % 3 === 0 ? 3 : 0), 3)
    if (brows % 4 === 1) fill(context, frame.skin.base, direction < 0 ? x : x + eyeWidth - 2, browY, 2, 2)
  }
  if (nose % 3 === 0) fill(context, frame.skin.shadow, 38, eyeY + eyeHeight + 2, 5, 7)
  if (nose % 3 === 1) {
    fill(context, frame.skin.shadow, 40, eyeY + eyeHeight + 1, 3, 8)
    fill(context, frame.skin.shadow, 37, eyeY + eyeHeight + 7, 6, 3)
  }
  if (nose % 3 === 2) fill(context, frame.skin.shadow, 37, eyeY + eyeHeight + 6, 7, 3)

  const mouthY = frame.chin - 12
  if (mouth % 4 === 0) fill(context, '#6F3A2C', 34, mouthY, 13, 3)
  if (mouth % 4 === 1) {
    fill(context, '#6F3A2C', 33, mouthY, 15, 3)
    fill(context, WHITE, 37, mouthY, 7, 2)
  }
  if (mouth % 4 === 2) {
    fill(context, '#6F3A2C', 34, mouthY + 2, 13, 3)
    fill(context, '#6F3A2C', 36, mouthY, 9, 2)
  }
  if (mouth % 4 === 3) {
    fill(context, '#6F3A2C', 34, mouthY, 4, 3)
    fill(context, '#6F3A2C', 43, mouthY, 4, 3)
  }
}

function drawHair(context, recipe, back) {
  const hair = getCatalogItem('hairId', recipe.appearance.hairId)
  const color = getCatalogItem('hairColorId', recipe.appearance.hairColorId)?.color || '#17130F'
  const variant = hair?.variant || 0
  const dark = shade(color, 0.62)
  const light = shade(color, 1.35)
  const height = 11 + (variant % 6) * 2
  const side = 6 + (Math.floor(variant / 6) % 4) * 2
  fill(context, dark, 14, 5, 53, height + 6)
  fill(context, color, 18, 7, 45, height)
  if (back || variant % 5 === 0) fill(context, color, 13, 17, side, 35 + (variant % 3) * 5)
  if (back || variant % 7 === 0) fill(context, color, 62, 17, side, 32 + (variant % 4) * 4)
  if (variant % 8 === 1) {
    fill(context, dark, 8, 12, 13, 48)
    fill(context, dark, 60, 12, 13, 48)
  }
  if (variant % 8 === 2) {
    for (let x = 15; x < 68; x += 8) fill(context, color, x, 1 + ((x / 8) % 2) * 3, 6, 12)
  }
  if (variant % 8 === 3) {
    fill(context, color, 22, 0, 36, 11)
    fill(context, dark, 18, 3, 8, 12)
  }
  if (variant % 8 === 4) {
    fill(context, color, 34, 0, 22, 15)
    fill(context, dark, 17, 11, 20, 9)
  }
  if (variant % 8 === 5) {
    for (let x = 14; x < 67; x += 7) {
      fill(context, dark, x, 5 + (x % 3), 5, 10)
      fill(context, color, x + 1, 4 + (x % 3), 4, 8)
    }
  }
  if (variant % 8 === 6) {
    fill(context, dark, 11, 8, 60, 15)
    fill(context, color, 16, 6, 50, 14)
  }
  if (variant % 8 === 7) fill(context, color, 18, 17, 45, 8)
  fill(context, light, 22 + (variant % 8), 8, 15 + (variant % 5), 3)
}

function drawBeardAndAccessory(context, recipe) {
  const beard = getCatalogItem('beardId', recipe.appearance.beardId)
  const accessory = getCatalogItem('accessoryIds', recipe.appearance.accessoryIds?.[0] || 'accessory-none')
  const hairColor = getCatalogItem('hairColorId', recipe.appearance.hairColorId)?.color || '#17130F'
  if (beard && beard.variant >= 0) {
    const variant = beard.variant
    const height = 5 + (variant % 4) * 3
    fill(context, shade(hairColor, 0.75), 26, 57, 29, height)
    fill(context, hairColor, 30, 55, 21, height + 2)
    if (variant % 3 === 0) {
      fill(context, hairColor, 20, 48, 8, 15)
      fill(context, hairColor, 53, 48, 8, 15)
    }
    if (variant % 4 === 1) fill(context, hairColor, 32, 50, 17, 4)
  }
  if (accessory && accessory.variant >= 0) {
    const type = accessory.variant % 4
    if (type === 0) {
      fill(context, '#25292E', 14, 32, 54, 4)
      fill(context, '#A4D5E2', 20, 29, 16, 11)
      fill(context, '#A4D5E2', 45, 29, 16, 11)
    }
    if (type === 1) fill(context, '#D8C543', 13, 19, 56, 5)
    if (type === 2) fill(context, '#F4F0E8', 60, 24, 5, 15)
    if (type === 3) fill(context, '#3D89B8', 15, 15, 52, 5)
  }
}

function applyPaintPatch(context, recipe, slotId) {
  for (const point of getRecipePatchPoints(recipe, slotId)) {
    if (point.color === null) context.clearRect(point.x, point.y, 1, 1)
    else fill(context, point.color, point.x, point.y, 1, 1)
  }
}

function drawShirtShape(context, kit, back = false) {
  drawPixelPolygon(context, [[7, 7], [18, 1], [38, 1], [49, 7], [55, 23], [48, 29], [44, 22], [44, 50], [12, 50], [12, 22], [8, 29], [1, 23]], OUTLINE)
  context.save()
  context.beginPath()
  context.moveTo(8, 9)
  context.lineTo(19, 3)
  context.lineTo(37, 3)
  context.lineTo(48, 9)
  context.lineTo(52, 22)
  context.lineTo(47, 25)
  context.lineTo(42, 18)
  context.lineTo(42, 48)
  context.lineTo(14, 48)
  context.lineTo(14, 18)
  context.lineTo(9, 25)
  context.lineTo(4, 22)
  context.closePath()
  context.clip()
  fill(context, kit.shirt, 0, 0, 56, 52)
  drawKitPattern(context, kit, back)
  context.restore()
  fill(context, shade(kit.shirt, 0.67), 14, 43, 28, 5)
  fill(context, shade(kit.shirt, 1.17), 13, 8, 4, 31)
  if (!back) drawMicroMarks(context, kit)
}

function drawKitPattern(context, kit, back) {
  const accent = kit.accent
  switch (kit.pattern) {
    case 'vertical':
      for (let x = 14; x <= 42; x += 10) fill(context, accent, x, 0, 6, 52)
      break
    case 'horizontal':
    case 'chest-band':
      fill(context, accent, 0, kit.pattern === 'chest-band' ? 20 : 15, 56, kit.pattern === 'chest-band' ? 8 : 5)
      if (kit.pattern === 'horizontal') fill(context, accent, 0, 31, 56, 5)
      break
    case 'sash':
      for (let y = -8; y < 55; y += 5) fill(context, accent, back ? 43 - y : y + 2, y, 8, 5)
      break
    case 'split':
      fill(context, accent, back ? 0 : 28, 0, 28, 52)
      break
    case 'tricolor':
      fill(context, '#111111', 0, 6, 56, 4)
      fill(context, '#C72A3D', 0, 10, 56, 4)
      fill(context, '#D2A42B', 0, 14, 56, 4)
      break
    case 'cross':
    case 'flag-cross':
      fill(context, accent, 25, 0, 7, 52)
      fill(context, accent, 0, 19, 56, 7)
      break
    case 'pinstripe':
      for (let x = 15; x < 44; x += 7) fill(context, accent, x, 4, 1, 44)
      break
    case 'shoulder':
      fill(context, accent, 5, 5, 18, 4)
      fill(context, accent, 33, 5, 18, 4)
      break
    case 'wave':
    case 'mist':
      for (let x = -8; x < 64; x += 9) fill(context, accent, x, 22 + ((x / 9) % 2) * 5, 14, 4)
      break
    case 'star-field':
    case 'stars':
    case 'island-stars':
      for (let y = 8; y < 44; y += 9) for (let x = 10 + (y % 2) * 4; x < 48; x += 12) fill(context, accent, x, y, 2, 2)
      break
    case 'geometric':
    case 'origami':
    case 'aztec':
    case 'mosaic':
      for (let y = 7; y < 47; y += 8) for (let x = 8; x < 52; x += 8) if ((x + y) % 3) fill(context, accent, x, y, 4, 3)
      break
    case 'leaf':
    case 'island':
    case 'mountain':
      drawPixelPolygon(context, [[10, 35], [28, 12], [46, 35], [37, 31], [28, 43], [19, 31]], accent)
      break
    case 'gradient-stripe':
      for (let x = 5; x < 56; x += 7) fill(context, accent, x, 0, 3, 52)
      break
    default:
      fill(context, accent, 0, 4, 56, 3)
  }
}

function drawMicroMarks(context, kit) {
  const variant = kit.markVariant || 0
  const markX = 17
  if (variant % 4 === 0) {
    fill(context, WHITE, markX, 8, 5, 1)
    fill(context, WHITE, markX + 1, 9, 4, 1)
    fill(context, WHITE, markX + 3, 10, 3, 1)
  } else if (variant % 4 === 1) {
    fill(context, WHITE, markX, 10, 6, 1)
    fill(context, WHITE, markX + 1, 8, 1, 3)
    fill(context, WHITE, markX + 3, 7, 1, 4)
    fill(context, WHITE, markX + 5, 6, 1, 5)
  } else if (variant % 4 === 2) {
    fill(context, WHITE, markX, 8, 3, 3)
    fill(context, kit.shirt, markX + 1, 9, 2, 1)
    fill(context, WHITE, markX + 3, 10, 3, 1)
  } else {
    fill(context, WHITE, markX, 7, 2, 4)
    fill(context, WHITE, markX + 2, 8, 3, 2)
    fill(context, WHITE, markX + 5, 7, 1, 4)
  }

  const crestX = 35
  fill(context, OUTLINE, crestX, 7, 7, 7)
  fill(context, kit.accent, crestX + 1, 8, 5, 4)
  fill(context, shade(kit.accent, 1.25), crestX + 2 + (variant % 2), 8, 2, 3)
  fill(context, WHITE, crestX + 2, 12, 3, 1)
}

function renderBodyPart(slotId, recipe) {
  const [width, height] = STUDIO_SLOT_SIZES[slotId]
  const canvas = createPixelCanvas(width, height)
  const context = canvas.getContext('2d')
  const skin = getCatalogItem('skinToneId', recipe.appearance.skinToneId)
  const kit = getStudioKit(recipe.teamId, recipe.kitType)
  const boots = getCatalogItem('bootsId', recipe.appearance.bootsId)?.variant || 0
  const gloves = getCatalogItem('glovesId', recipe.appearance.glovesId)?.variant || 0
  const bodySlots = ['arm_left', 'arm_right', 'hand_left', 'hand_right', 'knee', 'neck']
  const kitSlots = ['sleeve_left', 'sleeve_right', 'shorts', 'shorts_leg', 'socks', 'shoes', 'hand_left_glove', 'hand_right_glove']
  if (bodySlots.includes(slotId)) {
    fill(context, OUTLINE, 1, 1, width - 2, height - 2)
    fill(context, skin.base, 2, 2, Math.max(1, width - 4), Math.max(1, height - 4))
    fill(context, skin.highlight, 2, 2, Math.max(1, Math.floor(width / 4)), Math.max(1, height - 5))
  }
  if (kitSlots.includes(slotId)) {
    const base = slotId.includes('short') ? kit.shorts : slotId === 'socks' ? kit.socks : slotId === 'shoes' ? (boots % 3 === 0 ? '#13171A' : shade(kit.accent, 0.7)) : slotId.includes('glove') ? (gloves % 2 ? '#E7C844' : WHITE) : kit.shirt
    fill(context, OUTLINE, 0, 0, width, height)
    fill(context, base, 1, 1, Math.max(1, width - 2), Math.max(1, height - 2))
    if (height > 6) fill(context, shade(base, 1.22), 1, 1, Math.max(1, Math.floor(width / 3)), height - 3)
  }
  applyPaintPatch(context, recipe, slotId)
  return canvas
}

export function renderNumberCanvas(recipe) {
  const canvas = createPixelCanvas(...STUDIO_SLOT_SIZES.number)
  const context = canvas.getContext('2d')
  const kit = getStudioKit(recipe.teamId, recipe.kitType)
  const text = String(recipe.number)
  const scale = text.length > 1 ? 2 : 3
  const gap = scale
  const digitWidth = 3 * scale
  const totalWidth = digitWidth * text.length + gap * (text.length - 1)
  const startX = Math.floor((canvas.width - totalWidth) / 2)
  const startY = Math.floor((canvas.height - 5 * scale) / 2)
  const foreground = Number.parseInt(kit.shirt.replace('#', ''), 16) > 0x999999 ? '#17212B' : WHITE
  const stroke = foreground === WHITE ? '#17212B' : WHITE
  const styleVariant = Math.max(0, getStudioTeam(recipe.teamId).markVariant || 0)
  const family = styleVariant % 4
  const detailVariant = Math.floor(styleVariant / 4)
  text.split('').forEach((digit, digitIndex) => {
    DIGITS[digit].forEach((row, rowIndex) => row.split('').forEach((bit, columnIndex) => {
      if (bit !== '1') return
      const slant = family === 1
        ? Math.floor((4 - rowIndex) / 2)
        : family === 2
          ? -Math.floor((4 - rowIndex) / 2)
          : family === 3 && rowIndex % 2
            ? 1
            : 0
      const x = startX + digitIndex * (digitWidth + gap) + columnIndex * scale + slant
      const y = startY + rowIndex * scale
      fill(context, stroke, x - 1, y - 1, scale + 2, scale + 2)
      fill(context, foreground, x, y, scale, scale)
      if (detailVariant && (rowIndex + columnIndex + digitIndex) % (5 - detailVariant) === 0) {
        fill(context, stroke, x + scale - 1, y, 1, 1)
      }
    }))
  })
  applyPaintPatch(context, recipe, 'number')
  return canvas
}

export function renderStudioSlot(recipe, slotId) {
  if (!STUDIO_SLOT_SIZES[slotId]) throw new Error(`未知插槽：${slotId}`)
  if (slotId === 'head_front' || slotId === 'head_back') {
    const canvas = createPixelCanvas(...STUDIO_SLOT_SIZES[slotId])
    const context = canvas.getContext('2d')
    const back = slotId === 'head_back'
    drawHeadBase(context, recipe, back)
    drawHair(context, recipe, back)
    if (!back) drawBeardAndAccessory(context, recipe)
    applyPaintPatch(context, recipe, slotId)
    return canvas
  }
  if (slotId === 'shirt_front' || slotId === 'shirt_back') {
    const canvas = createPixelCanvas(...STUDIO_SLOT_SIZES[slotId])
    const context = canvas.getContext('2d')
    drawShirtShape(context, getStudioKit(recipe.teamId, recipe.kitType), slotId === 'shirt_back')
    applyPaintPatch(context, recipe, slotId)
    return canvas
  }
  if (slotId === 'number') return renderNumberCanvas(recipe)
  return renderBodyPart(slotId, recipe)
}

export function renderRuntimeAssetCanvases(recipe) {
  const slots = Object.keys(STUDIO_SLOT_SIZES)
  return Object.fromEntries(slots.map((slotId) => [slotId, renderStudioSlot(recipe, slotId)]))
}

function poseFor(action, elapsed) {
  const phase = Math.sin(elapsed * (action === 'sprint' ? 10 : 7))
  const moving = ['run', 'sprint', 'dribble'].includes(action)
  return {
    arm: moving ? phase * 22 : action === 'celebrate' ? -58 : action === 'goalkeeper_save' ? -74 : action === 'pass' || action === 'shoot' ? -18 : 0,
    leg: moving ? phase * 18 : action === 'slide' ? 64 : action === 'shoot' ? 35 : 0,
    bodyY: moving ? Math.round(Math.abs(phase) * 2) : action === 'fall' ? 18 : 0,
    rotate: action === 'fall' ? 82 : action === 'slide' ? 28 : 0,
  }
}

function drawRotated(context, image, x, y, angle, anchorX = 0.5, anchorY = 0) {
  context.save()
  context.translate(Math.round(x + image.width * anchorX), Math.round(y + image.height * anchorY))
  context.rotate((angle * Math.PI) / 180)
  context.drawImage(image, Math.round(-image.width * anchorX), Math.round(-image.height * anchorY))
  context.restore()
}

export function renderPortraitCanvas(recipe, options = {}) {
  const runtime = createPixelCanvas(128, 204)
  const context = runtime.getContext('2d')
  const facing = options.facing === 'back' ? 'back' : 'front'
  const action = options.action || 'idle'
  const pose = poseFor(action, Number(options.elapsed) || 0)
  const head = renderStudioSlot(recipe, `head_${facing}`)
  const shirt = renderStudioSlot(recipe, `shirt_${facing}`)
  const leftArm = renderStudioSlot(recipe, 'arm_left')
  const rightArm = renderStudioSlot(recipe, 'arm_right')
  const leftSleeve = renderStudioSlot(recipe, 'sleeve_left')
  const rightSleeve = renderStudioSlot(recipe, 'sleeve_right')
  const shorts = renderStudioSlot(recipe, 'shorts')
  const sock = renderStudioSlot(recipe, 'socks')
  const shoe = renderStudioSlot(recipe, 'shoes')
  const number = renderStudioSlot(recipe, 'number')
  const bodyY = pose.bodyY
  context.save()
  context.translate(0, bodyY)
  context.translate(64, 112)
  context.rotate((pose.rotate * Math.PI) / 180)
  context.translate(-64, -112)
  drawRotated(context, leftArm, 35, 91, pose.arm)
  drawRotated(context, leftSleeve, 34, 82, pose.arm)
  drawRotated(context, rightArm, 79, 91, -pose.arm)
  drawRotated(context, rightSleeve, 75, 82, -pose.arm)
  drawRotated(context, sock, 48, 159, pose.leg, 0.5, 0)
  drawRotated(context, shoe, 45, 187, pose.leg, 0.5, 0)
  drawRotated(context, sock, 69, 159, -pose.leg, 0.5, 0)
  drawRotated(context, shoe, 67, 187, -pose.leg, 0.5, 0)
  context.drawImage(shorts, 36, 145, 56, 12)
  context.drawImage(shirt, 36, 77)
  context.drawImage(head, 23, 5)
  if (facing === 'back') context.drawImage(number, 48, 95)
  context.restore()
  if (['dribble', 'pass', 'shoot', 'goalkeeper_save'].includes(action)) {
    fill(context, OUTLINE, action === 'goalkeeper_save' ? 102 : 90, action === 'shoot' ? 180 : 185, 12, 12)
    fill(context, WHITE, action === 'goalkeeper_save' ? 104 : 92, action === 'shoot' ? 182 : 187, 8, 8)
    fill(context, '#181B20', action === 'goalkeeper_save' ? 107 : 95, action === 'shoot' ? 182 : 187, 3, 3)
  }

  if (!options.sticker) return runtime
  const sticker = createPixelCanvas(136, 212)
  const stickerContext = sticker.getContext('2d')
  for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) {
    if (Math.abs(x) + Math.abs(y) > 3) continue
    stickerContext.drawImage(runtime, 4 + x, 4 + y)
  }
  stickerContext.globalCompositeOperation = 'source-in'
  fill(stickerContext, WHITE, 0, 0, sticker.width, sticker.height)
  stickerContext.globalCompositeOperation = 'source-over'
  stickerContext.drawImage(runtime, 4, 4)
  return sticker
}

export function isSlotPixelEditable(recipe, slotId, x, y, allowExpansion = false) {
  const size = STUDIO_SLOT_SIZES[slotId]
  if (!size || x < 0 || y < 0 || x >= size[0] || y >= size[1]) return false
  if (allowExpansion) return true
  const canvas = renderStudioSlot({ ...recipe, paintPatches: {} }, slotId)
  return canvas.getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] > 0
}

export function copyCanvasTo(canvas, target, scale = 1) {
  target.width = canvas.width * scale
  target.height = canvas.height * scale
  const context = target.getContext('2d')
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, target.width, target.height)
  context.drawImage(canvas, 0, 0, target.width, target.height)
}

export function canvasToBlob(canvas) {
  try {
    const dataUrl = canvas.toDataURL('image/png')
    const payload = dataUrl.slice(dataUrl.indexOf(',') + 1)
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return Promise.resolve(new Blob([bytes], { type: 'image/png' }))
  } catch (error) {
    return Promise.reject(new Error(`PNG 编译失败：${error.message}`))
  }
}

export function buildRuntimePreviewAssetUrls(recipe) {
  const canvases = renderRuntimeAssetCanvases(recipe)
  const urls = Object.fromEntries(Object.entries(canvases).map(([slotId, canvas]) => [slotId, canvas.toDataURL('image/png')]))
  return {
    playerRoot: '/__pixel-studio/player',
    kitRoot: '/__pixel-studio/kit',
    number: urls.number,
    headFront: urls.head_front,
    headBack: urls.head_back,
    parts: urls,
  }
}

export function getTeamBadgeLabel(teamId) {
  return getStudioTeam(teamId).code
}
