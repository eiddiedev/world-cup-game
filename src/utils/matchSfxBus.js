import { audioManager } from './audioManager.js'

const TOUCH_TYPES = new Set(['touch', 'pass', 'shot'])

export function createMatchSfxBus(options = {}) {
  const audio = options.audio || audioManager
  const now = options.now || (() => performance.now())
  let lastTouchAt = -Infinity
  const playedEventIds = new Set()

  return {
    consume(event) {
      if (!event?.id || playedEventIds.has(event.id)) return false
      if (TOUCH_TYPES.has(event.type)) {
        if (now() - lastTouchAt < 80) return false
        lastTouchAt = now()
        playedEventIds.add(event.id)
        return audio.playSound(event.type === 'shot' ? 'ballShot' : 'ballTouch')
      }
      if (event.type === 'kickoff') {
        playedEventIds.add(event.id)
        // 开球哨声与观众音由引擎 ab-kickoff-played 事件驱动（球真正被开出时刻），此处不处理
        return false
      }
      if (event.type === 'save') {
        playedEventIds.add(event.id)
        return audio.playSave()
      }
      if (event.type === 'tackle-contact') {
        playedEventIds.add(event.id)
        return audio.playSound('ballTouch')
      }
      if (event.type === 'post-hit' || event.type === 'crossbar-hit') {
        playedEventIds.add(event.id)
        return audio.playSound('postHit')
      }
      if (event.type === 'goal') {
        playedEventIds.add(event.id)
        return audio.playGoal()
      }
      if (event.type === 'period-change') {
        if (event.detail?.period === 'stoppage-time') return false
        playedEventIds.add(event.id)
        return audio.playSound('periodWhistle')
      }
      if (['foul', 'offside', 'throw-in-violation', 'penalty'].includes(event.type)) {
        playedEventIds.add(event.id)
        return audio.playSound('whistle')
      }
      if (event.type === 'card') {
        playedEventIds.add(event.id)
        return audio.playSound('cardWhistle')
      }
      return false
    },
    reset() {
      lastTouchAt = -Infinity
      playedEventIds.clear()
    },
    getSnapshot() {
      return { playedCount: playedEventIds.size, lastTouchAt }
    },
  }
}
