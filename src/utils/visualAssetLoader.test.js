/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { preloadAsset } from './visualAssetLoader.js'

describe('visual asset loader', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not block startup when WebView image.decode never settles', async () => {
    class LoadedImage {
      complete = false
      naturalWidth = 0
      decoding = 'auto'

      decode() {
        return new Promise(() => {})
      }

      set src(value) {
        this.currentSrc = value
        this.complete = true
        this.naturalWidth = 64
      }
    }

    vi.stubGlobal('Image', LoadedImage)

    await expect(preloadAsset('/assets/test-decode-never-settles.png'))
      .resolves.toBe('/assets/test-decode-never-settles.png')
  })
})
