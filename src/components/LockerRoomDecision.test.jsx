/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LockerRoomDecision from './LockerRoomDecision.jsx'
import { LOCKER_ROOM_DECISIONS } from '../data/lockerRoomDecisions.js'

const scenario = LOCKER_ROOM_DECISIONS.find((item) => item.id === 'heating_failure')
const report = {
  scenarioId: scenario.id,
  choiceId: 'warmup',
  label: '小幅加练热身',
  resultText: '一组高强度激活下来，球员身体热开了，微微出了点汗。',
  affected: [
    { runtimeActorId: 'red-05', name: '边路悍将', number: 5, deltas: { morale: 3, form: 4, stamina: 0 } },
  ],
  average: { morale: 3, form: 4, stamina: 0 },
}

describe('LockerRoomDecision overlay', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows the scenario without leaking the effect numbers', () => {
    render(<LockerRoomDecision scenario={scenario} report={null} onChoose={vi.fn()} onContinue={vi.fn()} />)

    expect(screen.getByRole('dialog')).toHaveTextContent('更衣室')
    expect(screen.getByRole('dialog')).toHaveTextContent('更衣室供暖故障')
    expect(screen.getByRole('dialog')).toHaveTextContent('室温只有 12°C')
    // 选项阶段不泄露任何数值
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/士气[+-]/)
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/体能[+-]/)
  })

  it('marks a two-choice scenario so the mobile layout can center both decisions', () => {
    const twoChoiceScenario = {
      ...scenario,
      choices: scenario.choices.slice(0, 2),
    }
    const { container } = render(
      <LockerRoomDecision
        scenario={twoChoiceScenario}
        report={null}
        onChoose={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    const choices = container.querySelector('.locker-room-choices')
    expect(choices).toHaveAttribute('data-choice-count', '2')
    expect(choices.querySelectorAll('.locker-room-choice')).toHaveLength(2)
  })

  it('reveals the verdict color first, then shows only the overall team report', () => {
    const onChoose = vi.fn()
    const onContinue = vi.fn()
    const { rerender } = render(
      <LockerRoomDecision scenario={scenario} report={null} onChoose={onChoose} onContinue={onContinue} queueIndex={0} queueTotal={2} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /小幅加练热身/ }))
    expect(onChoose).toHaveBeenCalledWith('warmup')

    rerender(
      <LockerRoomDecision scenario={scenario} report={report} onChoose={onChoose} onContinue={onContinue} queueIndex={0} queueTotal={2} />,
    )
    // 揭示期：选中的卡先变绿（净值为正），并直接显示数值
    const chosen = screen.getByRole('button', { name: /小幅加练热身/ })
    expect(chosen).toHaveClass('is-positive')
    expect(chosen).toHaveTextContent('士气+3')
    expect(chosen).toHaveTextContent('状态+4')
    expect(chosen).toHaveTextContent('体能+0')
    expect(screen.queryByText(/球员身体热开了/)).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(1200) })
    expect(screen.getByText(/球员身体热开了/)).toBeInTheDocument()
    expect(screen.getByLabelText('全队整体状态：士气+3 · 状态+4 · 体能+0')).toBeInTheDocument()
    expect(screen.queryByText(/#5 边路悍将/)).not.toBeInTheDocument()
    expect(screen.queryByText('即将继续比赛…')).not.toBeInTheDocument()
    const nextButton = screen.getByRole('button', { name: '下一个' })
    fireEvent.click(nextButton)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('marks a net-negative choice red after the reveal window', () => {
    const negativeReport = {
      ...report,
      choiceId: 'ignore',
      resultText: '球员嘴上喊着硬气，上场时腿还是有点僵。',
      affected: [
        { runtimeActorId: 'red-05', name: '边路悍将', number: 5, deltas: { morale: 2, form: -4, stamina: 0 } },
      ],
      average: { morale: 2, form: -4, stamina: 0 },
    }
    render(
      <LockerRoomDecision scenario={scenario} report={negativeReport} onChoose={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /冷着就冷着/ })).toHaveClass('is-negative')
    act(() => { vi.advanceTimersByTime(1200) })
    expect(screen.getByLabelText('全队整体状态：士气+2 · 状态-4 · 体能+0')).toBeInTheDocument()
  })
})
