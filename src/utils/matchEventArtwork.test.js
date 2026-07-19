import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getMatchEventArtwork } from './matchEventArtwork.js'

describe('Match event artwork', () => {
  it.each([
    ['save', null, '扑出.png', '关键扑救'],
    ['corner', null, '角球.png', '角球'],
    ['goal', null, '进球.png', '进球'],
    ['var-review', null, 'VAR.png', '检查 VAR 中'],
    ['card', 'yellow', '黄牌.png', '黄牌'],
    ['card', 'red', '红牌.png', '红牌'],
  ])('maps %s to the retained authored asset', (type, color, fileName, label) => {
    expect(getMatchEventArtwork({
      id: `runtime.${type}.${color || 'event'}`,
      type,
      minute: 32,
      detail: color ? { color } : {},
    })).toEqual(expect.objectContaining({
      src: expect.stringContaining(fileName),
      label,
      headline: expect.any(String),
      minute: 32,
    }))
  })

  it('does not invent artwork for ordinary touches', () => {
    expect(getMatchEventArtwork({ id: 'touch.1', type: 'touch' })).toBeNull()
  })

  it.each([
    ['valid', 'VAR-GOAL.png', 'GOAL'],
    ['disallowed', 'VAR-NO-GOAL.png', 'NO GOAL'],
  ])('maps a %s VAR ruling to the authored result screen', (outcome, fileName, label) => {
    expect(getMatchEventArtwork({
      id: `runtime.var-result.${outcome}`,
      type: 'var-result',
      minute: 67,
      detail: { outcome },
    })).toEqual(expect.objectContaining({
      src: expect.stringContaining(fileName),
      label,
      holdMs: 3000,
    }))
  })

  it('retains the authored 1200×800 goalkeeper-save artwork in the public pack', () => {
    const buffer = readFileSync(path.resolve(
      import.meta.dirname,
      '../../public/assets/比赛事件/扑出.png',
    ))
    expect(buffer.readUInt32BE(16)).toBe(1200)
    expect(buffer.readUInt32BE(20)).toBe(800)
  })

  it.each([
    ['VAR.png', 507, 376],
    ['VAR-GOAL.png', 695, 410],
    ['VAR-NO-GOAL.png', 485, 347],
  ])('retains the authored %s screen without resampling', (fileName, width, height) => {
    const buffer = readFileSync(path.resolve(
      import.meta.dirname,
      `../../public/assets/比赛事件/${fileName}`,
    ))
    expect(buffer.readUInt32BE(16)).toBe(width)
    expect(buffer.readUInt32BE(20)).toBe(height)
  })

  it('audits the user-provided VAR artwork manifest byte-for-byte', () => {
    const assetRoot = path.resolve(import.meta.dirname, '../../public/assets/比赛事件')
    const manifest = JSON.parse(readFileSync(
      path.join(assetRoot, 'var-assets-manifest.json'),
      'utf8',
    ))
    let totalBytes = 0
    manifest.files.forEach((file) => {
      const buffer = readFileSync(path.join(
        assetRoot,
        file.path.split('/').at(-1),
      ))
      totalBytes += buffer.length
      expect(buffer.length).toBe(file.bytes)
      expect(createHash('sha256').update(buffer).digest('hex')).toBe(file.sha256)
    })
    expect(totalBytes).toBe(manifest.totalBytes)
  })
})
