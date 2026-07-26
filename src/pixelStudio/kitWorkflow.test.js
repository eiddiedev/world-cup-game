import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createIndexedPixelDocument } from './imageSlicer.js'
import { auditKitProject, KIT_SLOT_ORDER } from './kitWorkflow.js'

function pngSize(path) {
  const bytes = readFileSync(path)
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

describe('16-team kit production catalog', () => {
  const catalog = JSON.parse(readFileSync('public/pixel/kit-studio/catalog.json', 'utf8'))
  const audit = JSON.parse(readFileSync('public/pixel/kit-studio/asset-audit.json', 'utf8'))

  it('locks exactly 16 national-team kits with two runtime role asset sets per team', () => {
    expect(catalog.playableTeamCount).toBe(16)
    expect(catalog.kits).toHaveLength(32)
    expect(new Set(catalog.kits.map((entry) => entry.teamId)).size).toBe(16)
    expect(catalog.kits.some((entry) => entry.teamId === 'newzealand')).toBe(false)
    for (const teamId of new Set(catalog.kits.map((entry) => entry.teamId))) {
      expect(catalog.kits.filter((entry) => entry.teamId === teamId).map((entry) => entry.kitType).sort()).toEqual(['goalkeeper', 'home'])
    }
  })

  it('passes the current authored assets and records fixed runtime PNG dimensions', () => {
    expect(audit.nationalTeamKitCount).toBe(16)
    expect(audit.runtimeRoleAssetSetCount).toBe(32)
    expect(audit.passedTeamCount).toBe(16)
    expect(audit.passedRuntimeRoleAssetSetCount).toBe(32)
    expect(audit.rules.artworkSource).toBe('current-authored-assets')
    expect(audit.rules.artworkRegenerated).toBe(false)
    expect(audit.rules.runtimeStickerBorder).toBe(false)
    for (const entry of catalog.kits) {
      expect(entry.status).toBe('gold-pass')
      const expectedSlots = entry.kitType === 'goalkeeper' ? KIT_SLOT_ORDER : KIT_SLOT_ORDER.slice(0, 8)
      expect(entry.files.filter((file) => file.requiredAtRuntime).map((file) => file.slotId).sort()).toEqual([...expectedSlots].sort())
      entry.files.forEach((file) => {
        expect(file.passed).toBe(true)
        expect(file.sha256).toHaveLength(64)
        expect(file.semiTransparentPixels).toBe(0)
        expect(pngSize(`public${file.path}`)).toEqual([file.width, file.height])
      })
    }
  })
})

describe('editable kit project audit', () => {
  it('accepts indexed fixed-size assets and rejects a changed canvas', () => {
    const valid = createIndexedPixelDocument(56, 52, [null, '#121719', '#D02D2D'], Array(56 * 52).fill(2))
    const project = { slots: { shirt_front: valid } }
    expect(auditKitProject(project).passed).toBe(true)
    project.slots.shirt_front = { ...valid, width: 55 }
    expect(auditKitProject(project).passed).toBe(false)
  })
})
