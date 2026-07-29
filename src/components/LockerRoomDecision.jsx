import React, { useEffect, useMemo, useState } from 'react'
import { getLockerRoomSituation } from '../utils/lockerRoomDecisions.js'
import '../styles/happySeedLockerRoom.css'

const PHASE_LABELS = {
  prematch: '赛 前',
  halftime: '中场休息',
  extratime: '加时中场',
  shootout: '点球大战前',
}
const FIELD_LABELS = { morale: '士气', form: '状态', stamina: '体能' }
const REVEAL_MS = 1100

function deltaText(value) {
  const numeric = Number(value) || 0
  return `${numeric >= 0 ? '+' : ''}${Math.round(numeric * 10) / 10}`
}

// 红绿由选择的设计效果净值按语义判定：净值为正则绿、为负则红，
// 不掺随机浮动，好选项永远好、陷阱选项永远红
function reportSentiment(report) {
  const net = (report.average.morale || 0)
    + (report.average.form || 0) * 1.2
    + (report.average.stamina || 0) * 1.5
  return net >= 0 ? 'positive' : 'negative'
}

function averageSummary(report) {
  return Object.entries(FIELD_LABELS)
    .map(([field, label]) => `${label}${deltaText(report.average[field])}`)
    .join(' · ')
}

export default function LockerRoomDecision({ scenario, report, onChoose, onContinue, queueIndex = 0, queueTotal = 1, phase = 'prematch' }) {
  const [revealing, setRevealing] = useState(false)
  const sentiment = useMemo(() => (report ? reportSentiment(report) : null), [report])

  useEffect(() => {
    if (!report) {
      setRevealing(false)
      return undefined
    }
    setRevealing(true)
    const timer = window.setTimeout(() => setRevealing(false), REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [report])

  if (!scenario) return null
  const showChoices = !report || revealing

  return (
    <div className="locker-room" role="dialog" aria-label={`更衣室决策：${scenario.title}`}>
      <div className="locker-room-backdrop" aria-hidden="true" />
      <div className="locker-room-stage">
        <header className="locker-room-masthead">
          <h1><span>更</span><span>衣</span><span>室</span></h1>
          <small>
            {PHASE_LABELS[phase] || '队 内'}
            {queueTotal > 1 ? ` · ${queueIndex + 1}/${queueTotal}` : ''}
          </small>
        </header>

        <section className="locker-room-panel">
          <h2>{scenario.title}</h2>
          <p className="locker-room-situation">{getLockerRoomSituation(scenario, phase)}</p>

          {showChoices && (
            <div
              className="locker-room-choices"
              data-choice-count={scenario.choices.length}
              aria-label="更衣室选择"
            >
              {scenario.choices.map((choice) => {
                const chosen = report?.choiceId === choice.id
                const classes = [
                  'locker-room-choice',
                  chosen ? `is-${sentiment}` : '',
                  report && !chosen ? 'is-dimmed' : '',
                ].filter(Boolean).join(' ')
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={classes}
                    disabled={Boolean(report)}
                    onClick={() => onChoose(choice.id)}
                  >
                    <strong>{choice.label}</strong>
                    <span>{choice.desc}</span>
                    {chosen && revealing && (
                      <em className="locker-room-verdict">
                        {averageSummary(report)}
                      </em>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {report && !revealing && (
            <div className={`locker-room-report is-${sentiment}`} aria-live="polite">
              <strong className="locker-room-verdict-tag" aria-label={`全队整体状态：${averageSummary(report)}`}>
                <span>全队状态</span>
                {Object.entries(FIELD_LABELS).map(([field, label]) => {
                  const value = report.average[field]
                  return (
                    <em key={field} className={value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-flat'}>
                      {label}{deltaText(value)}
                    </em>
                  )
                })}
              </strong>
              <p className="locker-room-result">{report.resultText}</p>
              <button type="button" className="locker-room-continue" onClick={onContinue}>
                {queueIndex + 1 < queueTotal
                  ? '下一个'
                  : phase === 'prematch' ? '开始比赛' : '继续比赛'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
