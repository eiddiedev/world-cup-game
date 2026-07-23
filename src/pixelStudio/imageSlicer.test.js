import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOURCE_SEGMENTS,
  PAPER_DOLL_PIXEL_SCHEMA,
  createIndexedPixelDocument,
  countLightBoundaryPixels,
  decodePixelRuns,
  encodePixelRuns,
  extractSlotPixelDocument,
  floodFillPixel,
  replacePixel,
  slicePaperDollPixelDocuments,
  synthesizeHeadBack,
  synthesizeShirtBack,
} from './imageSlicer.js'

function boundsOf(pixelDocument) {
  const indices = decodePixelRuns(pixelDocument)
  const points = indices.flatMap((value, index) => value ? [[index % pixelDocument.width, Math.floor(index / pixelDocument.width)]] : [])
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...ys) - Math.min(...ys) + 1,
  }
}

describe('image-to-paper-doll pixel workflow', () => {
  it('stores indexed pixels as compact row-major runs', () => {
    const indices = [0, 0, 1, 1, 1, 0, 2, 2]
    expect(encodePixelRuns(indices)).toEqual([[2, 0], [3, 1], [1, 0], [2, 2]])
    const document = createIndexedPixelDocument(4, 2, [null, '#111111', '#FFFFFF'], indices)
    expect(decodePixelRuns(document)).toEqual(indices)
  })

  it('extracts every configured source region into the locked Runtime slot size', () => {
    const source = createIndexedPixelDocument(10, 20, [null, '#111111'], Array(200).fill(1))
    const slots = slicePaperDollPixelDocuments(source, null)
    expect(slots.head_front).toMatchObject({ width: 81, height: 77 })
    expect(slots.shirt_front).toMatchObject({ width: 56, height: 52 })
    expect(slots.knee).toMatchObject({ width: 8, height: 9 })
    expect(slots.socks).toMatchObject({ width: 11, height: 14 })
    expect(slots.shoes).toMatchObject({ width: 16, height: 6 })
    expect(decodePixelRuns(extractSlotPixelDocument(source, DEFAULT_SOURCE_SEGMENTS.shorts_leg, 'shorts_leg'))).toHaveLength(12 * 16)
    const headBounds = boundsOf(slots.head_front)
    expect(headBounds).toMatchObject({ height: 52, maxY: 71 })
    expect(headBounds.width).toBeLessThanOrEqual(46)
    expect(Math.abs(headBounds.minX - (81 - headBounds.maxX - 1))).toBeLessThanOrEqual(1)
    expect(boundsOf(slots.shirt_front).height).toBeLessThanOrEqual(46)
  })

  it('creates a mirrored faceless back head and a clean numbered back shirt', () => {
    const headPixels = Array(81 * 77).fill(0)
    for (let y = 20; y < 72; y += 1) for (let x = 17; x < 63; x += 1) headPixels[y * 81 + x] = y < 38 ? 2 : 1
    for (let y = 46; y < 51; y += 1) for (let x = 25; x < 31; x += 1) headPixels[y * 81 + x] = 3
    for (let y = 46; y < 51; y += 1) for (let x = 49; x < 55; x += 1) headPixels[y * 81 + x] = 3
    const head = createIndexedPixelDocument(81, 77, [null, '#B86F45', '#231B19', '#FFFFFF'], headPixels)
    const backHead = synthesizeHeadBack(head)
    expect(backHead.metadata).toMatchObject({ generatedBack: true, strategy: 'mirror-remove-face' })
    expect(decodePixelRuns(backHead).filter((value) => value === 3).length).toBeLessThan(decodePixelRuns(head).filter((value) => value === 3).length)

    const shirtPixels = Array(56 * 52).fill(0)
    for (let y = 6; y < 51; y += 1) for (let x = 3; x < 53; x += 1) shirtPixels[y * 56 + x] = 1
    for (let y = 10; y < 43; y += 1) shirtPixels[y * 56 + 18] = 3
    const shirt = createIndexedPixelDocument(56, 52, [null, '#1749A3', '#161B24', '#F7F3E9'], shirtPixels)
    const numberTen = synthesizeShirtBack(shirt, 10)
    const numberSeven = synthesizeShirtBack(shirt, 7)
    expect(numberTen.metadata).toMatchObject({ generatedBack: true, number: 10 })
    expect(decodePixelRuns(numberTen)).not.toEqual(decodePixelRuns(numberSeven))
    expect(decodePixelRuns(numberTen).filter((value) => value === 3).length).toBeGreaterThan(10)
  })

  it('uses synthesized back slots when no explicit back reference is supplied', () => {
    const source = createIndexedPixelDocument(20, 40, [null, '#B86F45', '#161B24', '#FFFFFF'], Array(800).fill(1))
    const slots = slicePaperDollPixelDocuments(source, null, DEFAULT_SOURCE_SEGMENTS, { number: 23 })
    expect(slots.head_back.metadata).toMatchObject({ generatedBack: true })
    expect(slots.shirt_back.metadata).toMatchObject({ generatedBack: true, number: 23 })
  })

  it('supports brush, mirrored painting, eraser and flood fill without raster images', () => {
    const source = createIndexedPixelDocument(5, 3, [null, '#111111', '#FF0000'], [
      1, 1, 0, 1, 1,
      1, 1, 0, 1, 1,
      0, 0, 0, 0, 0,
    ])
    const painted = replacePixel(source, 0, 2, 2, 1, true)
    expect(decodePixelRuns(painted).slice(10)).toEqual([2, 0, 0, 0, 2])
    const erased = replacePixel(painted, 0, 2, 0)
    expect(decodePixelRuns(erased)[10]).toBe(0)
    const filled = floodFillPixel(source, 0, 0, 2)
    expect(decodePixelRuns(filled).filter((value) => value === 2)).toHaveLength(4)
  })

  it('locks the non-image export schema name', () => {
    expect(PAPER_DOLL_PIXEL_SCHEMA).toBe('happyseed-paper-doll-pixels-v1')
  })

  it('detects light pixels that touch the transparent silhouette edge', () => {
    const source = createIndexedPixelDocument(4, 3, [null, '#F8F5E5', '#17212B'], [
      0, 1, 0, 0,
      1, 2, 2, 0,
      0, 2, 0, 0,
    ])
    expect(countLightBoundaryPixels(source)).toBe(2)
  })
})
