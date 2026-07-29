/* @vitest-environment jsdom */
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./LegacyPenaltyShootout.jsx', () => ({
  default: ({ homeTeam, awayTeam, onExit }) => (
    <div role="dialog" aria-label="逐帧像素点球大战">
      <span>{homeTeam} 对 {awayTeam}</span>
      <button type="button" onClick={onExit}>返回主页</button>
    </div>
  ),
}))

import PenaltyModeScreen from './PenaltyModeScreen.jsx'

afterEach(cleanup)

describe('independent penalty mode', () => {
  it('keeps the original frame-by-frame pixel shootout separate from the match runtime', () => {
    const navigateTo = vi.fn()
    render(<PenaltyModeScreen navigateTo={navigateTo} showToast={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: '逐帧像素点球大战' })).toHaveTextContent('法国 对 巴西')
    fireEvent.click(screen.getByRole('button', { name: '返回主页' }))
    expect(navigateTo).toHaveBeenCalledWith('home')
  })
})
