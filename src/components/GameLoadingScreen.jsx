import React from 'react'
import '../styles/gameLoadingScreen.css'

export default function GameLoadingScreen({
  title = '',
  label = '加载中',
  detail = '',
  progress = null,
  error = '',
}) {
  const numericProgress = Number.isFinite(progress)
    ? Math.max(0, Math.min(100, Math.round(progress)))
    : null

  return (
    <div className="game-loading-screen" role="status" aria-live="polite">
      <div className="game-loading-content">
        {title && <small>{title}</small>}
        <h1>{error || label}</h1>
        <div
          className={`game-loading-track${numericProgress === null ? ' is-indeterminate' : ''}`}
          role="progressbar"
          aria-label={label}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={numericProgress ?? undefined}
        >
          <i style={numericProgress === null ? undefined : { width: `${numericProgress}%` }} />
        </div>
        <div className="game-loading-meta">
          <span>{detail || '请稍候…'}</span>
          <b>{numericProgress === null ? '加载中' : `${numericProgress}%`}</b>
        </div>
      </div>
    </div>
  )
}
