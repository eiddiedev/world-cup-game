const PITCH_ASPECT_RATIO = 3 / 2

export function getFittedLandscapePitchSize(containerWidth, containerHeight) {
  const safeWidth = Math.max(1, Math.floor(containerWidth))
  const safeHeight = Math.max(1, Math.floor(containerHeight))
  const widthFromHeight = Math.floor(safeHeight * PITCH_ASPECT_RATIO)

  if (widthFromHeight <= safeWidth) {
    return { width: widthFromHeight, height: safeHeight }
  }

  return {
    width: safeWidth,
    height: Math.floor(safeWidth / PITCH_ASPECT_RATIO),
  }
}

export function mapPitchPointToLandscape(x, y, width, height) {
  const offsetX = width * 0.03
  const offsetY = height * 0.04
  const fieldWidth = width - offsetX * 2
  const fieldHeight = height - offsetY * 2

  return {
    px: offsetX + (y / 100) * fieldWidth,
    py: offsetY + (x / 100) * fieldHeight,
  }
}

