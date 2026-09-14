/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  hasCompletedSpotlightTour,
  markSpotlightTourComplete,
} from './spotlightTourStorage.js'

describe('spotlightTourStorage', () => {
  beforeEach(() => {
    const values = new Map()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        get length() { return values.size },
        clear: () => values.clear(),
        getItem: (key) => values.has(key) ? values.get(key) : null,
        key: (index) => [...values.keys()][index] || null,
        removeItem: (key) => values.delete(key),
        setItem: (key, value) => values.set(key, String(value)),
      },
    })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('跨页面重载持久记录已完成的引导', () => {
    expect(hasCompletedSpotlightTour('first-open-only')).toBe(false)

    markSpotlightTourComplete('first-open-only')

    expect(hasCompletedSpotlightTour('first-open-only')).toBe(true)
    expect(window.localStorage.length).toBe(1)
    expect(window.localStorage.getItem(window.localStorage.key(0))).toContain('first-open-only')
  })

  it('本地记录损坏时安全回到未完成状态', () => {
    window.localStorage.setItem('targeting-2026:spotlight-tours:v1', '{bad json')

    expect(hasCompletedSpotlightTour('broken-storage')).toBe(false)
  })
})
