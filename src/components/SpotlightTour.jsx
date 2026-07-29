import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  hasCompletedSpotlightTour,
  markSpotlightTourComplete,
} from '../utils/spotlightTourStorage.js'
import '../styles/spotlightTour.css'

const TARGET_PADDING = 7
const CALLOUT_WIDTH = 304
const CALLOUT_ESTIMATED_HEIGHT = 190
const SCREEN_MARGIN = 14
const ARROW_GAP = 34

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function paddedRect(rect) {
  return {
    top: Math.max(0, rect.top - TARGET_PADDING),
    left: Math.max(0, rect.left - TARGET_PADDING),
    right: Math.min(window.innerWidth, rect.right + TARGET_PADDING),
    bottom: Math.min(window.innerHeight, rect.bottom + TARGET_PADDING),
    width: Math.min(window.innerWidth, rect.right + TARGET_PADDING) - Math.max(0, rect.left - TARGET_PADDING),
    height: Math.min(window.innerHeight, rect.bottom + TARGET_PADDING) - Math.max(0, rect.top - TARGET_PADDING),
  }
}

function choosePlacement(preferred, rect) {
  const spaces = {
    top: rect.top,
    right: window.innerWidth - rect.right,
    bottom: window.innerHeight - rect.bottom,
    left: rect.left,
  }
  const needed = preferred === 'top' || preferred === 'bottom'
    ? CALLOUT_ESTIMATED_HEIGHT + ARROW_GAP
    : Math.min(CALLOUT_WIDTH, window.innerWidth - 28) + ARROW_GAP
  if (spaces[preferred] >= needed) return preferred
  return Object.entries(spaces).sort((left, right) => right[1] - left[1])[0][0]
}

function calloutPosition(rect, placement) {
  const width = Math.min(CALLOUT_WIDTH, window.innerWidth - (SCREEN_MARGIN * 2))
  const centeredLeft = clamp(
    rect.left + (rect.width / 2) - (width / 2),
    SCREEN_MARGIN,
    window.innerWidth - width - SCREEN_MARGIN,
  )
  const centeredTop = clamp(
    rect.top + (rect.height / 2) - (CALLOUT_ESTIMATED_HEIGHT / 2),
    SCREEN_MARGIN,
    window.innerHeight - CALLOUT_ESTIMATED_HEIGHT - SCREEN_MARGIN,
  )

  if (placement === 'top') {
    return { width, left: centeredLeft, top: Math.max(SCREEN_MARGIN, rect.top - CALLOUT_ESTIMATED_HEIGHT - ARROW_GAP) }
  }
  if (placement === 'bottom') {
    return { width, left: centeredLeft, top: Math.min(window.innerHeight - CALLOUT_ESTIMATED_HEIGHT - SCREEN_MARGIN, rect.bottom + ARROW_GAP) }
  }
  if (placement === 'left') {
    return { width, left: Math.max(SCREEN_MARGIN, rect.left - width - ARROW_GAP), top: centeredTop }
  }
  return { width, left: Math.min(window.innerWidth - width - SCREEN_MARGIN, rect.right + ARROW_GAP), top: centeredTop }
}

export default function SpotlightTour({
  tour,
  startRequest = 0,
  autoStart = false,
  onFinish,
  showHelpButton = true,
  helpButtonClassName = '',
}) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const targetRef = useRef(null)
  const retryTimerRef = useRef(null)
  const step = tour?.steps?.[stepIndex]

  const openTour = useCallback(() => {
    setStepIndex(0)
    setTargetRect(null)
    setActive(true)
  }, [])

  const finishTour = useCallback(() => {
    if (tour?.id) markSpotlightTourComplete(tour.id)
    setActive(false)
    setTargetRect(null)
    onFinish?.()
  }, [onFinish, tour])

  const nextStep = useCallback(() => {
    if (!tour) return
    if (stepIndex >= tour.steps.length - 1) finishTour()
    else setStepIndex((current) => current + 1)
  }, [finishTour, stepIndex, tour])

  useEffect(() => {
    setActive(false)
    setStepIndex(0)
    setTargetRect(null)
    if (!tour) return
    if (startRequest || (autoStart && !hasCompletedSpotlightTour(tour.id))) {
      openTour()
    }
  }, [autoStart, openTour, startRequest, tour])

  useEffect(() => {
    if (!active || !step) return undefined
    let cancelled = false
    let attempts = 0
    let disposeTarget = () => {}

    const locateTarget = () => {
      if (cancelled) return
      const target = document.querySelector(step.target)
      if (!target) {
        attempts += 1
        if (attempts < 12) retryTimerRef.current = window.setTimeout(locateTarget, 100)
        else nextStep()
        return
      }

      targetRef.current = target
      target.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' })
      const updateRect = () => {
        if (!cancelled && target.isConnected) setTargetRect(paddedRect(target.getBoundingClientRect()))
      }
      updateRect()
      retryTimerRef.current = window.setTimeout(updateRect, 260)

      const resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(updateRect)
        : null
      resizeObserver?.observe(target)
      window.addEventListener('resize', updateRect)
      window.addEventListener('scroll', updateRect, true)

      const handleTargetClick = () => {
        if (!step.advanceOnTarget) return
        if (stepIndex >= tour.steps.length - 1) finishTour()
        else window.setTimeout(nextStep, 80)
      }
      target.addEventListener('click', handleTargetClick, true)

      disposeTarget = () => {
        resizeObserver?.disconnect()
        window.removeEventListener('resize', updateRect)
        window.removeEventListener('scroll', updateRect, true)
        target.removeEventListener('click', handleTargetClick, true)
      }
    }

    locateTarget()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') finishTour()
      if (event.key === 'ArrowRight' || event.key === 'Enter') nextStep()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelled = true
      window.clearTimeout(retryTimerRef.current)
      disposeTarget()
      window.removeEventListener('keydown', handleKeyDown)
      targetRef.current = null
    }
  }, [active, finishTour, nextStep, step, stepIndex, tour])

  const placement = useMemo(
    () => targetRect && step ? choosePlacement(step.placement || 'right', targetRect) : 'right',
    [step, targetRect],
  )
  const position = useMemo(
    () => targetRect ? calloutPosition(targetRect, placement) : null,
    [placement, targetRect],
  )

  if (!tour) return null

  if (!active) {
    if (!showHelpButton) return null
    return createPortal(
      <button
        type="button"
        className={`spotlight-tour-help ${helpButtonClassName}`.trim()}
        aria-label={`打开${tour.title}`}
        title="新手指引"
        onClick={openTour}
      >
        <span aria-hidden="true">?</span>
      </button>,
      document.body,
    )
  }

  if (!step || !targetRect || !position) return null

  const blockerStyle = {
    top: { top: 0, left: 0, right: 0, height: targetRect.top },
    bottom: { top: targetRect.bottom, left: 0, right: 0, bottom: 0 },
    left: { top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height },
    right: { top: targetRect.top, left: targetRect.right, right: 0, height: targetRect.height },
  }

  return createPortal(
    <div className="spotlight-tour" aria-live="polite">
      {Object.entries(blockerStyle).map(([side, style]) => (
        <div key={side} className="spotlight-tour-blocker" style={style} onPointerDown={(event) => event.preventDefault()} />
      ))}
      <div className="spotlight-tour-frame" style={targetRect} aria-hidden="true" />
      <section
        className={`spotlight-tour-callout is-${placement}`}
        style={position}
        role="dialog"
        aria-label={`${tour.title} ${stepIndex + 1}/${tour.steps.length}`}
      >
        <span className="spotlight-tour-progress">STEP {String(stepIndex + 1).padStart(2, '0')} / {String(tour.steps.length).padStart(2, '0')}</span>
        <strong>{step.title}</strong>
        <p>{step.body}</p>
        <div className="spotlight-tour-actions">
          <button type="button" className="spotlight-tour-skip" onClick={finishTour}>跳过</button>
          <button type="button" className="spotlight-tour-next" onClick={nextStep}>
            {stepIndex === tour.steps.length - 1 ? '完成' : '下一步'}
          </button>
        </div>
        <span className="spotlight-tour-arrow" aria-hidden="true"><i /></span>
      </section>
    </div>,
    document.body,
  )
}
