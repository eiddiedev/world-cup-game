/* @vitest-environment jsdom */
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PenaltyShootout from './PenaltyShootout.jsx'

const fakeContext = {
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(10 * 10 * 4) })),
  putImageData: vi.fn(),
  setTransform: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  fillRect: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  imageSmoothingEnabled: false,
  globalAlpha: 1,
  fillStyle: '',
}

class LoadedImage {
  constructor() {
    this.width = 10
    this.height = 10
    this.onload = null
    this.onerror = null
  }
  set src(value) {
    this._src = value
    queueMicrotask(() => this.onload?.())
  }
  get src() { return this._src }
}

const lineup = [
  { id: 'gk', position: 'GK', rating: 80, def: 80 },
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `p-${index}`,
    position: 'FW',
    rating: 75 - index,
    tec: 75 - index,
  })),
]

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('Image', LoadedImage)
  vi.stubGlobal('PointerEvent', MouseEvent)
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1280,
    bottom: 720,
    width: 1280,
    height: 720,
    toJSON() {},
  })
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function renderOnlineShootout(seatId, onSubmit) {
  const view = render(
    <PenaltyShootout
      homeTeam="法国"
      awayTeam="巴西"
      awayTeamId="brazil"
      homeLineup={lineup}
      awayLineup={lineup}
      onlineSession={{
        seatId,
        status: 'playing',
        attemptIndex: 0,
        shots: [],
        submitted: {},
        winner: null,
        resolvedAttempt: null,
        onSubmit,
      }}
      onComplete={vi.fn()}
    />,
  )
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  await act(async () => { vi.advanceTimersByTime(1150) })
  return view
}

describe('controlled online penalty input', () => {
  it('makes the host the hidden shooter on the first attempt', async () => {
    const onSubmit = vi.fn(() => true)
    await renderOnlineShootout('host', onSubmit)
    expect(screen.getByText('滑动射门！')).toBeInTheDocument()

    const canvas = screen.getByLabelText('点球大战球场')
    fireEvent.pointerDown(canvas, { clientX: 600, clientY: 500, pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: 500, clientY: 350, pointerId: 1 })
    fireEvent.pointerUp(canvas, { clientX: 500, clientY: 350, pointerId: 1 })

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      attemptIndex: 0,
      role: 'shooter',
      zone: 'left-top',
    }))
    expect(screen.getByText('方向已锁定，等待对方完成操作…')).toBeInTheDocument()
  })

  it('makes the guest the hidden goalkeeper on the first attempt', async () => {
    const onSubmit = vi.fn(() => true)
    await renderOnlineShootout('guest', onSubmit)
    expect(screen.getByText('滑动扑救！')).toBeInTheDocument()

    const canvas = screen.getByLabelText('点球大战球场')
    fireEvent.pointerDown(canvas, { clientX: 600, clientY: 500, pointerId: 2 })
    fireEvent.pointerMove(canvas, { clientX: 700, clientY: 350, pointerId: 2 })
    fireEvent.pointerUp(canvas, { clientX: 700, clientY: 350, pointerId: 2 })

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      attemptIndex: 0,
      role: 'keeper',
      zone: 'right-top',
    }))
  })

  it('plays the authoritative result once and swaps the host to goalkeeper next', async () => {
    const onSubmit = vi.fn(() => true)
    const view = await renderOnlineShootout('host', onSubmit)
    const resolvedAttempt = {
      id: 'match:penalty:0',
      attemptIndex: 0,
      round: 1,
      team: 'home',
      shooterZone: 'left-top',
      keeperZone: 'right-bottom',
      power: 0.7,
      scored: true,
      saved: false,
      missed: false,
    }

    view.rerender(
      <PenaltyShootout
        homeTeam="法国"
        awayTeam="巴西"
        awayTeamId="brazil"
        homeLineup={lineup}
        awayLineup={lineup}
        onlineSession={{
          seatId: 'host',
          status: 'playing',
          attemptIndex: 1,
          shots: [resolvedAttempt],
          submitted: {},
          winner: null,
          resolvedAttempt,
          onSubmit,
        }}
        onComplete={vi.fn()}
      />,
    )
    await act(async () => { vi.advanceTimersByTime(3200) })

    expect(screen.getByText('滑动扑救！')).toBeInTheDocument()
    expect(screen.getByLabelText('扑救倒计时')).toBeInTheDocument()
  })
})
