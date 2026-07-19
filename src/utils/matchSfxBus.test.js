import { describe, expect, it, vi } from 'vitest'
import { createMatchSfxBus } from './matchSfxBus.js'

describe('MatchSfxBus', () => {
  it('deduplicates fast touches and never plays one event twice', () => {
    let time = 100
    const audio = {
      playSound: vi.fn(() => true),
      playSave: vi.fn(() => true),
      playGoal: vi.fn(() => true),
    }
    const bus = createMatchSfxBus({ audio, now: () => time })
    expect(bus.consume({ id: 'touch.1', type: 'touch' })).toBe(true)
    time += 40
    expect(bus.consume({ id: 'touch.2', type: 'pass' })).toBe(false)
    time += 50
    expect(bus.consume({ id: 'touch.3', type: 'shot' })).toBe(true)
    expect(bus.consume({ id: 'touch.3', type: 'shot' })).toBe(false)
    time += 90
    expect(bus.consume({ id: 'pass.4', type: 'pass' })).toBe(true)
    expect(audio.playSound).toHaveBeenNthCalledWith(1, 'ballTouch')
    expect(audio.playSound).toHaveBeenNthCalledWith(2, 'ballShot')
    expect(audio.playSound).toHaveBeenNthCalledWith(3, 'ballTouch')
  })

  it('plays post, save and goal from their corresponding real event', () => {
    const audio = {
      playSound: vi.fn(() => true),
      playSave: vi.fn(() => true),
      playGoal: vi.fn(() => true),
    }
    const bus = createMatchSfxBus({ audio, now: () => 100 })
    bus.consume({ id: 'post.1', type: 'post-hit' })
    bus.consume({ id: 'bar.1', type: 'crossbar-hit' })
    bus.consume({ id: 'save.1', type: 'save' })
    bus.consume({ id: 'goal.1', type: 'goal' })
    expect(audio.playSound).toHaveBeenCalledTimes(2)
    expect(audio.playSound).toHaveBeenNthCalledWith(1, 'postHit')
    expect(audio.playSound).toHaveBeenNthCalledWith(2, 'postHit')
    expect(audio.playSave).toHaveBeenCalledTimes(1)
    expect(audio.playGoal).toHaveBeenCalledTimes(1)
  })

  it('plays a distinct tackle thud and whistles only for the derived incident id once', () => {
    const audio = {
      playSound: vi.fn(() => true),
      playSave: vi.fn(() => true),
      playGoal: vi.fn(() => true),
    }
    const bus = createMatchSfxBus({ audio, now: () => 100 })
    expect(bus.consume({ id: 'contact.1', type: 'tackle-contact' })).toBe(true)
    expect(bus.consume({ id: 'contact.1.foul', type: 'foul', sourceEventId: 'contact.1' })).toBe(true)
    expect(bus.consume({ id: 'contact.1.foul', type: 'foul', sourceEventId: 'contact.1' })).toBe(false)
    expect(audio.playSound).toHaveBeenNthCalledWith(1, 'ballTouch')
    expect(audio.playSound).toHaveBeenNthCalledWith(2, 'whistle')
  })

  it('plays one long-short whistle pattern at half-time and full-time', () => {
    const audio = {
      playSound: vi.fn(() => true),
      playSave: vi.fn(() => true),
      playGoal: vi.fn(() => true),
    }
    const bus = createMatchSfxBus({ audio, now: () => 100 })
    expect(bus.consume({ id: 'period.added', type: 'period-change', detail: { period: 'stoppage-time' } })).toBe(false)
    expect(bus.consume({ id: 'period.half', type: 'period-change', detail: { period: 'half-time' } })).toBe(true)
    expect(bus.consume({ id: 'period.full', type: 'period-change', detail: { period: 'full-time' } })).toBe(true)
    expect(bus.consume({ id: 'period.full', type: 'period-change', detail: { period: 'full-time' } })).toBe(false)
    expect(audio.playSound).toHaveBeenNthCalledWith(1, 'periodWhistle')
    expect(audio.playSound).toHaveBeenNthCalledWith(2, 'periodWhistle')
  })
})
