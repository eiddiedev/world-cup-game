import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getAppointmentLetter } from '../data/appointmentLetters'
import { audioManager } from '../utils/audioManager'
import { COMPETITION_BRAND } from '@competition-brand'
import '../styles/appointmentLetter.css'

const APPOINTMENT_CARD_WIDTH = 420
const APPOINTMENT_CARD_HEIGHT = 560
const APPOINTMENT_STAGE_WIDTH = 650
const APPOINTMENT_CARD_OFFSET_X = APPOINTMENT_STAGE_WIDTH - APPOINTMENT_CARD_WIDTH
const APPOINTMENT_VIEWPORT_WIDTH = APPOINTMENT_CARD_WIDTH + (APPOINTMENT_CARD_OFFSET_X * 2)

function getAppointmentScale() {
  if (typeof window === 'undefined') return 1
  const viewport = window.visualViewport
  const width = viewport?.width || window.innerWidth
  const height = viewport?.height || window.innerHeight
  return Math.min(
    1,
    Math.max(0.4, (width - 16) / APPOINTMENT_VIEWPORT_WIDTH),
    Math.max(0.45, (height - 16) / APPOINTMENT_CARD_HEIGHT),
  )
}

/**
 * 聘书签署组件
 * 状态机：appearing → signing → stamping → done
 */
export default function AppointmentLetter({ team, onConfirm, onCancel }) {
  const [phase, setPhase] = useState('appearing')
  const [hasSigned, setHasSigned] = useState(false)
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const strokeCountRef = useRef(0)
  const lastPointRef = useRef(null)
  const [cardScale, setCardScale] = useState(getAppointmentScale)

  const letter = getAppointmentLetter(team.id)

  // The letter is a fixed design canvas. Scale the whole canvas together so
  // the signature line and stamp target never drift at mobile breakpoints.
  useEffect(() => {
    const updateScale = () => setCardScale(getAppointmentScale())
    const viewport = window.visualViewport
    window.addEventListener('resize', updateScale)
    viewport?.addEventListener('resize', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      viewport?.removeEventListener('resize', updateScale)
    }
  }, [])

  // 聘书出现时播放纸张音效
  useEffect(() => {
    audioManager.playSound('paperUnfold')
    const timer = setTimeout(() => setPhase('signing'), 350)
    return () => clearTimeout(timer)
  }, [])

  // Canvas 签名逻辑
  const getCanvasPoint = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const handlePointerDown = useCallback((e) => {
    if (phase !== 'signing') return
    e.preventDefault()
    isDrawingRef.current = true
    const point = getCanvasPoint(e)
    lastPointRef.current = point
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }, [phase, getCanvasPoint])

  const handlePointerMove = useCallback((e) => {
    if (!isDrawingRef.current || phase !== 'signing') return
    e.preventDefault()
    const point = getCanvasPoint(e)
    const canvas = canvasRef.current
    if (!canvas || !lastPointRef.current) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
    strokeCountRef.current += 1
    if (strokeCountRef.current > 10 && !hasSigned) {
      setHasSigned(true)
    }
  }, [phase, getCanvasPoint, hasSigned])

  const handlePointerUp = useCallback(() => {
    isDrawingRef.current = false
    lastPointRef.current = null
  }, [])

  // 确认执教 → 盖章
  const handleConfirm = useCallback(() => {
    if (!hasSigned || phase !== 'signing') return
    setPhase('stamping')
    audioManager.playSound('stampHit')
    // 盖章动画完成后自动跳转
    setTimeout(() => {
      setPhase('done')
      setTimeout(() => onConfirm(), 600)
    }, 400)
  }, [hasSigned, phase, onConfirm])

  return (
    <div className="appointment-overlay" role="dialog" aria-label={`${team.name}聘书`}>
      <div
        className="appointment-card-scale"
        style={{
          width: `${APPOINTMENT_CARD_WIDTH * cardScale}px`,
          height: `${APPOINTMENT_CARD_HEIGHT * cardScale}px`,
        }}
      >
        <div
          className="appointment-card-transform"
          style={{ transform: `scale(${cardScale}) translateX(-${APPOINTMENT_CARD_OFFSET_X}px)` }}
        >
          {phase === 'signing' && !hasSigned && (
            <div className="appointment-sign-hint-external" aria-hidden="true">
              <strong>在此签名</strong>
              <span className="appointment-sign-arrow"><i /></span>
            </div>
          )}

          <div
            className={`appointment-card ${phase === 'appearing' ? 'is-appearing' : ''}`}
            style={{ left: `${APPOINTMENT_CARD_OFFSET_X}px` }}
          >
        {/* 聘书背景 */}
        <div className="appointment-bg" />

        {/* 文案区域 */}
        <div className="appointment-text">
          {letter.lines.map((line, i) => (
            line === ''
              ? <div key={i} className="appointment-line-spacer" />
              : <p key={i} className="appointment-line">{line}</p>
          ))}
        </div>

        {/* 落款 */}
        <div className="appointment-footer-text">
          <span className="appointment-org">{letter.org}</span>
          <span className="appointment-year">{letter.year}</span>
        </div>

        {/* 签名区域 Canvas */}
        <canvas
          ref={canvasRef}
          className="appointment-signature-canvas"
          width={600}
          height={120}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* 印章 */}
        {COMPETITION_BRAND.compliant ? (
          <span
            role="img"
            aria-label={COMPETITION_BRAND.appointmentStampAlt}
            className={`appointment-stamp appointment-stamp-generic ${phase === 'stamping' || phase === 'done' ? 'is-stamped' : ''}`}
          >
            <b>赛事组委会</b>
            <i aria-hidden="true">★</i>
            <small>2026</small>
          </span>
        ) : (
          <img
            src="/assets/branding/appointment-stamp.png"
            alt={COMPETITION_BRAND.appointmentStampAlt}
            className={`appointment-stamp ${phase === 'stamping' || phase === 'done' ? 'is-stamped' : ''}`}
          />
        )}

        {/* 操作栏 */}
        <div className="appointment-actions">
          {phase === 'signing' && (
            <>
              <button
                type="button"
                className="appointment-btn-cancel"
                onClick={onCancel}
              >
                返回
              </button>
              <button
                type="button"
                className="appointment-btn-confirm"
                disabled={!hasSigned}
                onClick={handleConfirm}
              >
                确认执教
              </button>
            </>
          )}
          {phase === 'stamping' && (
            <span className="appointment-stamping-text">盖章中...</span>
          )}
        </div>
        </div>
        </div>
      </div>
    </div>
  )
}
