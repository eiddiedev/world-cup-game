/* @vitest-environment jsdom */
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'

import SpotlightTour from './SpotlightTour.jsx'
import { hasCompletedSpotlightTour } from '../utils/spotlightTourStorage.js'

const TEST_TOUR = {
  id: 'test-highlight',
  title: '测试指引',
  steps: [
    { target: '[data-guide="first"]', title: '第一步', body: '查看第一个目标。', placement: 'right' },
    { target: '[data-guide="second"]', title: '第二步', body: '查看第二个目标。', placement: 'bottom' },
  ],
}

describe('SpotlightTour', () => {
  afterEach(() => {
    cleanup()
  })

  it('依次高亮目标，并在本次页面打开期间记住状态', async () => {
    render(
      <>
        <button
          data-guide="first"
          ref={(node) => {
            if (node) node.getBoundingClientRect = () => ({ top: 80, left: 80, right: 180, bottom: 120, width: 100, height: 40 })
          }}
        >第一个目标</button>
        <button
          data-guide="second"
          ref={(node) => {
            if (node) node.getBoundingClientRect = () => ({ top: 180, left: 220, right: 340, bottom: 230, width: 120, height: 50 })
          }}
        >第二个目标</button>
        <SpotlightTour tour={TEST_TOUR} startRequest={1} />
      </>,
    )

    expect(await screen.findByRole('dialog', { name: '测试指引 1/2' })).toHaveTextContent('第一步')
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(await screen.findByRole('dialog', { name: '测试指引 2/2' })).toHaveTextContent('第二步')

    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(hasCompletedSpotlightTour(TEST_TOUR.id)).toBe(true)
  })

  it('完成后仍可通过问号重新打开', async () => {
    render(
      <>
        <button
          data-guide="first"
          ref={(node) => {
            if (node) node.getBoundingClientRect = () => ({ top: 80, left: 80, right: 180, bottom: 120, width: 100, height: 40 })
          }}
        >第一个目标</button>
        <SpotlightTour tour={{ ...TEST_TOUR, steps: TEST_TOUR.steps.slice(0, 1) }} />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开测试指引' }))
    expect(await screen.findByRole('dialog', { name: '测试指引 1/1' })).toHaveTextContent('第一步')
  })
})
