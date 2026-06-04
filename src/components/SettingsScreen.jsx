import React from 'react'
import { audioManager } from '../utils/audioManager'

const SETTING_ROWS = [
  { key: 'sound', label: '音效', desc: '按钮、进球、裁判和结算反馈' },
  { key: 'music', label: '音乐', desc: '像素风循环背景音乐' },
  { key: 'vibration', label: '震动', desc: '点击和关键时刻轻微反馈' },
]

const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
  vibration: true,
  language: 'zh-CN',
}

/**
 * 设置页面 — 只保留比赛需要的三项开关，沿用像素菜单风格。
 */
export default function SettingsScreen({ saveData, updateSaveData, navigateTo }) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(saveData.settings || {}),
  }

  const toggleSetting = (key) => {
    const nextSettings = {
      ...settings,
      [key]: !settings[key],
    }
    const nextSaveData = {
      ...saveData,
      settings: nextSettings,
    }

    updateSaveData(nextSaveData)
    audioManager.applySettings(nextSettings)

    if (key === 'vibration' && nextSettings.vibration) {
      audioManager.vibrate(24)
    }
    if (key === 'sound' && nextSettings.sound) {
      audioManager.playSound('confirm')
    }
    if (key === 'music' && nextSettings.music) {
      audioManager.unlock()
    }
  }

  return (
    <main className="screen settings-screen">
      <header className="settings-header">
        <button type="button" className="back-button" onClick={() => navigateTo('home')} aria-label="返回">
          ←
        </button>
        <h1>设置</h1>
      </header>

      <section className="PixelPanel settings-panel" aria-label="游戏设置">
        <div className="settings-list">
          {SETTING_ROWS.map((row) => {
            const enabled = Boolean(settings[row.key])
            return (
              <button
                key={row.key}
                type="button"
                className={`settings-row ${enabled ? 'is-on' : 'is-off'}`}
                onClick={() => toggleSetting(row.key)}
              >
                <span className="settings-copy">
                  <strong>{row.label}</strong>
                  <span>{row.desc}</span>
                </span>
                <span className="settings-toggle" aria-hidden="true">
                  <span className="settings-knob" />
                </span>
                <span className="settings-state">{enabled ? '开' : '关'}</span>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}
