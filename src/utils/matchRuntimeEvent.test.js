import { describe, expect, it } from 'vitest'
import {
  createDerivedMatchRuntimeEvent,
  createMatchRuntimeEvent,
  decisionReadingSeconds,
  validateMatchRuntimeEventV1,
} from './matchRuntimeEvent.js'

function rawEvent(type = 'tackle-contact') {
  return createMatchRuntimeEvent({
    id: `runtime.42.${type}`,
    type,
    frameId: 2520,
    matchTime: 1680,
    minute: 42,
    side: 'red',
    actorRuntimeIds: ['red-7', 'blue-4'],
    primaryRuntimeActorId: 'red-7',
    secondaryRuntimeActorId: 'blue-4',
    ball: { before: [0.72, 0.48, 0], after: [0.73, 0.48, 0] },
    runtimeStateBefore: 'Match',
    runtimeStateAfter: 'Match',
  })
}

describe('MatchRuntimeEventV1', () => {
  it('keeps frame, minute, actors, ball and before/after state in one event', () => {
    const event = rawEvent()
    expect(validateMatchRuntimeEventV1(event)).toEqual({ valid: true, errors: [] })
    expect(event).toMatchObject({
      frameId: 2520,
      minute: 42,
      actorRuntimeIds: ['red-7', 'blue-4'],
      runtimeStateBefore: 'Match',
      runtimeStateAfter: 'Match',
    })
  })

  it('requires every rule-derived incident to point at a real source event', () => {
    const source = rawEvent()
    const foul = createDerivedMatchRuntimeEvent(source, {
      id: `${source.id}.foul`,
      type: 'foul',
    })
    expect(foul.sourceEventId).toBe(source.id)
    expect(validateMatchRuntimeEventV1(foul)).toEqual({ valid: true, errors: [] })
    expect(validateMatchRuntimeEventV1(createMatchRuntimeEvent({
      ...source,
      id: 'runtime.invalid.foul',
      type: 'foul',
      sourceEventId: null,
    })).errors).toContain('sourceEventId')
  })

  it('derives a 15–25 second reading window from all visible option text', () => {
    const short = { choices: [{ label: '稳住', desc: '保持球权' }] }
    const long = {
      choices: Array.from({ length: 5 }, (_, index) => ({
        label: `方案${index}`,
        desc: '完整说明'.repeat(18),
        risk: '风险信息'.repeat(12),
        reward: '收益信息'.repeat(12),
        successHint: '成功提示'.repeat(8),
      })),
    }
    expect(decisionReadingSeconds(short)).toBe(15)
    expect(decisionReadingSeconds(long)).toBe(25)
  })
})
