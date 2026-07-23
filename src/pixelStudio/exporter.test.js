import { beforeAll, describe, expect, it, vi } from 'vitest'
import { unzipSync } from 'fflate'
import { STUDIO_SLOT_SIZES, createDefaultStudioRecipe } from './model.js'

vi.mock('./renderer.js', () => ({
  renderStudioSlot(recipe, slotId) {
    const [width, height] = STUDIO_SLOT_SIZES[slotId]
    return { width, height, slotId, playerId: recipe.playerId }
  },
  async canvasToBlob(canvas) {
    const identity = canvas.slotId.startsWith('head') ? canvas.playerId : 'shared'
    return new Blob([`${canvas.slotId}:${canvas.width}x${canvas.height}:${identity}`], { type: 'image/png' })
  },
}))

let compileStudioPack
let importStudioFile

beforeAll(async () => {
  ;({ compileStudioPack, importStudioFile } = await import('./exporter.js'))
})

describe('Pixel Player Studio HSPack', () => {
  it('exports the fixed authoring/runtime structure with hashes and dimensions', async () => {
    const recipe = createDefaultStudioRecipe({ teamId: 'france', playerId: 'france_player_10', number: 10 })
    const result = await compileStudioPack(recipe)
    const files = unzipSync(result.bytes)
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']))
    const runtime = JSON.parse(new TextDecoder().decode(files['runtime/recipes/france/france_player_10.json']))

    expect(files['authoring/players/france/france_player_10.json']).toBeTruthy()
    expect(files['runtime/player/happyseed-human-v4/france_player_10/head_front.png']).toBeTruthy()
    expect(files['runtime/kits/france/home/happyseed-human-v4/shirt_front.png']).toBeTruthy()
    expect(files['runtime/numbers/france-2026/home-10.png']).toBeTruthy()
    expect(files['reports/asset-audit.json']).toBeTruthy()
    expect(runtime.schemaVersion).toBe('happyseed-human-runtime-recipe-v1')
    expect(runtime.assets.parts.shoes).toContain('/france_player_10/shoes.png')
    expect(manifest.files.every((file) => file.sha256?.length === 64 && file.bytes > 0)).toBe(true)
    expect(manifest.files.find((file) => file.slotId === 'head_front')).toMatchObject({ width: 81, height: 77 })
  })

  it('includes all four kit types for a team pack and can import its authoring recipe', async () => {
    const recipe = createDefaultStudioRecipe({ teamId: 'japan', playerId: 'japan_player_07', number: 7 })
    const result = await compileStudioPack([recipe], { includeAllKits: true })
    const files = unzipSync(result.bytes)
    for (const kitType of ['home', 'away', 'goalkeeper', 'away-goalkeeper']) {
      expect(files[`runtime/kits/japan/${kitType}/happyseed-human-v4/shirt_front.png`]).toBeTruthy()
    }
    expect(result.audit.kitCount).toBe(4)

    const imported = await importStudioFile({
      name: 'japan.hspack',
      arrayBuffer: async () => result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength),
    })
    expect(imported.recipes).toHaveLength(1)
    expect(imported.recipes[0].playerId).toBe('japan_player_07')
  })

  it('physically de-duplicates identical personal parts and redirects runtime part paths', async () => {
    const first = createDefaultStudioRecipe({ teamId: 'france', playerId: 'france_player_01', number: 1 })
    const second = createDefaultStudioRecipe({ teamId: 'france', playerId: 'france_player_02', number: 2 })
    const result = await compileStudioPack([first, second])
    const files = unzipSync(result.bytes)
    const secondRuntime = JSON.parse(new TextDecoder().decode(files['runtime/recipes/france/france_player_02.json']))

    expect(files['runtime/player/happyseed-human-v4/france_player_01/shoes.png']).toBeTruthy()
    expect(files['runtime/player/happyseed-human-v4/france_player_02/shoes.png']).toBeUndefined()
    expect(secondRuntime.assets.parts.shoes).toContain('/france_player_01/shoes.png')
    expect(result.audit.storedFileCount).toBeLessThan(result.audit.fileCount)
    expect(result.audit.duplicateFileCount).toBeGreaterThan(0)
  })
})
