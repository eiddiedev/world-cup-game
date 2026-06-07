const PHASER_REFERENCE_SIZE = {
  width: 780,
  height: 480,
}

export function createPitchBounds(width, height) {
  const scaleX = width / PHASER_REFERENCE_SIZE.width
  const scaleY = height / PHASER_REFERENCE_SIZE.height
  return {
    x: Math.round(40 * scaleX),
    y: Math.round(60 * scaleY),
    width: Math.round(700 * scaleX),
    height: Math.round(360 * scaleY),
  }
}

export function tacticalToPhaserPoint(x, y, pitch) {
  return {
    x: pitch.x + (y / 100) * pitch.width,
    y: pitch.y + (x / 100) * pitch.height,
  }
}
