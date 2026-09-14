import React, { useMemo, useState } from 'react'
import { COMMERCIAL_ITEMS } from '../data/commercialization.js'
import {
  MAX_MATCH_ITEMS,
  applyJourneyLoadout,
  normalizeJourneyInventory,
  validateJourneyLoadout,
} from '../utils/journeyItems.js'
import '../styles/journeyItems.css'

const TARGET_LABELS = {
  'sports-drink': '恢复对象',
  'ice-pack': '轻伤球员',
  'football-boots': '装备球员',
  'goalkeeper-gloves': '装备门将',
  'training-equipment': '训练球员（最多三人）',
}

const CATEGORY_LABELS = {
  recovery: '恢复',
  equipment: '装备',
  tactics: '战术',
  training: '训练',
}

const playerIdOf = (player) => player?.id || player?.playerId || player
const playerNameOf = (player) => player?.name || player?.displayName || playerIdOf(player)

export default function JourneyItemPrepScreen({ saveData, updateSaveData, navigateTo, showToast }) {
  const run = saveData.currentRun || {}
  const roster = run.roster || run.purchasedPlayerIds || []
  const inventory = normalizeJourneyInventory(run.itemInventory)
  const [selections, setSelections] = useState(() => (
    run.matchItemLoadoutLocked ? [...(run.matchItemLoadout || [])] : []
  ))

  const selectedCounts = useMemo(() => selections.reduce((counts, selection) => ({
    ...counts,
    [selection.itemId]: (counts[selection.itemId] || 0) + 1,
  }), {}), [selections])
  const validation = validateJourneyLoadout(run, selections)
  const totalInventory = Object.values(inventory).reduce((total, count) => total + count, 0)

  const eligiblePlayers = (itemId) => roster.filter((player) => {
    if (itemId === 'football-boots') return player.position !== 'GK'
    if (itemId === 'goalkeeper-gloves') return player.position === 'GK'
    if (itemId === 'ice-pack') return Number(run.injuryMatches?.[playerIdOf(player)] || 0) === 1
    return true
  })

  const addItem = (item) => {
    if (selections.length >= MAX_MATCH_ITEMS) return showToast(`每场最多携带 ${MAX_MATCH_ITEMS} 件道具`)
    if ((selectedCounts[item.id] || 0) >= inventory[item.id]) return showToast(`${item.label}库存不足`)
    const firstTarget = eligiblePlayers(item.id)[0]
    const targetPlayerIds = item.id === 'tactical-board' ? [] : (firstTarget ? [playerIdOf(firstTarget)] : [])
    setSelections((current) => [...current, { itemId: item.id, targetPlayerIds }])
  }

  const removeItem = (index) => {
    setSelections((current) => current.filter((_, selectionIndex) => selectionIndex !== index))
  }

  const updateTargets = (index, playerId, multi = false) => {
    setSelections((current) => current.map((selection, selectionIndex) => {
      if (selectionIndex !== index) return selection
      if (!multi) return { ...selection, targetPlayerIds: [playerId] }
      const selected = new Set(selection.targetPlayerIds || [])
      if (selected.has(playerId)) selected.delete(playerId)
      else if (selected.size < 3) selected.add(playerId)
      return { ...selection, targetPlayerIds: [...selected] }
    }))
  }

  const confirm = () => {
    const applied = applyJourneyLoadout(run, selections)
    if (!applied.valid) {
      showToast(applied.errors[0] || '请检查道具配置')
      return
    }
    updateSaveData({ ...saveData, currentRun: applied.run, journeyRun: applied.run })
    navigateTo('match')
  }

  return (
    <main className="screen journey-item-prep-screen">
      <header className="journey-item-header">
        <button className="back-button" onClick={() => navigateTo('lineup')} aria-label="返回排兵布阵">←</button>
        <div className="journey-item-title">
          <small>冠军征程 · 赛前准备</small>
          <h1>比赛道具</h1>
          <p>从库存选择最多三件；确认后本场锁定并立即生效。</p>
        </div>
        <div className="journey-prep-summary" aria-label="道具准备状态">
          <span><small>库存</small><strong>{totalInventory}</strong></span>
          <i aria-hidden="true" />
          <span><small>已携带</small><strong>{selections.length}/{MAX_MATCH_ITEMS}</strong></span>
        </div>
      </header>

      <section className="journey-item-layout">
        <section className="journey-item-inventory" aria-labelledby="journey-inventory-title">
          <div className="journey-section-heading">
            <div>
              <small>赛前库存</small>
              <h2 id="journey-inventory-title">球队补给箱</h2>
            </div>
            <p>点击携带，放入右侧本场栏位</p>
          </div>

          <div className="journey-item-grid">
            {COMMERCIAL_ITEMS.map((item) => {
              const selectedCount = selectedCounts[item.id] || 0
              const remaining = inventory[item.id] - selectedCount
              const disabled = remaining <= 0 || selections.length >= MAX_MATCH_ITEMS
              return (
                <article
                  className={`journey-item-card${selectedCount ? ' is-picked' : ''}${inventory[item.id] <= 0 ? ' is-empty' : ''}`}
                  key={item.id}
                >
                  <div className="journey-item-art">
                    <img src={item.icon} alt={`${item.label}图标`} />
                    <span className="journey-item-category">{CATEGORY_LABELS[item.category]}</span>
                  </div>
                  <div className="journey-item-copy">
                    <header>
                      <strong>{item.label}</strong>
                      <span className="journey-item-stock">库存 ×{inventory[item.id]}</span>
                    </header>
                    <b className="journey-item-effect">{item.effectLabel}</b>
                    <p>{item.target} · {item.tradeoff}</p>
                  </div>
                  <button
                    type="button"
                    className="journey-item-add"
                    aria-label={`携带${item.label}`}
                    disabled={disabled}
                    onClick={() => addItem(item)}
                  >
                    {remaining <= 0 ? (inventory[item.id] <= 0 ? '暂无' : '已选完') : '+ 携带'}
                  </button>
                  {selectedCount > 0 && <span className="journey-picked-count">已带 {selectedCount}</span>}
                </article>
              )
            })}
          </div>
        </section>

        <aside className="journey-loadout" aria-labelledby="journey-loadout-title">
          <div className="journey-section-heading journey-loadout-heading">
            <div>
              <small>最多三件</small>
              <h2 id="journey-loadout-title">本场携带</h2>
            </div>
            <strong>{selections.length}/{MAX_MATCH_ITEMS}</strong>
          </div>

          <div className="journey-loadout-slots">
            {Array.from({ length: MAX_MATCH_ITEMS }, (_, index) => {
              const selection = selections[index]
              if (!selection) {
                return (
                  <div className="journey-loadout-slot is-empty" key={`empty-${index}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>空栏位</p>
                  </div>
                )
              }

              const item = COMMERCIAL_ITEMS.find((candidate) => candidate.id === selection.itemId)
              const players = eligiblePlayers(selection.itemId)
              const multi = selection.itemId === 'training-equipment'
              return (
                <article className="journey-loadout-slot is-filled" key={`${selection.itemId}-${index}`}>
                  <span className="journey-loadout-number">{String(index + 1).padStart(2, '0')}</span>
                  <img src={item?.icon} alt="" />
                  <div className="journey-loadout-copy">
                    <header>
                      <div><strong>{item?.label}</strong><small>{item?.effectLabel}</small></div>
                      <button type="button" onClick={() => removeItem(index)} aria-label={`移除${item?.label}`}>移除</button>
                    </header>
                    {selection.itemId === 'tactical-board' ? (
                      <p className="journey-auto-target">自动作用于首发十一人</p>
                    ) : (
                      <label>
                        <span>{TARGET_LABELS[selection.itemId] || '使用对象'}</span>
                        {multi ? (
                          <div className="journey-target-checks">
                            {players.map((player) => {
                              const playerId = playerIdOf(player)
                              const isSelected = (selection.targetPlayerIds || []).includes(playerId)
                              return (
                                <button
                                  type="button"
                                  key={playerId}
                                  aria-pressed={isSelected}
                                  className={isSelected ? 'is-selected' : ''}
                                  onClick={() => updateTargets(index, playerId, true)}
                                >{playerNameOf(player)}</button>
                              )
                            })}
                          </div>
                        ) : (
                          <select value={selection.targetPlayerIds?.[0] || ''} onChange={(event) => updateTargets(index, event.target.value)}>
                            <option value="">请选择</option>
                            {players.map((player) => {
                              const playerId = playerIdOf(player)
                              return <option key={playerId} value={playerId}>{playerNameOf(player)}</option>
                            })}
                          </select>
                        )}
                      </label>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="journey-loadout-footer">
            {!validation.valid && <p className="journey-loadout-error">{validation.errors[0]}</p>}
            {validation.valid && <p className="journey-loadout-note">未使用的道具会留在库存，不会消耗。</p>}
            <button type="button" className="PixelButton journey-start-match" onClick={confirm} disabled={!validation.valid}>
              <span className="button-face" aria-hidden="true" />
              <span className="button-label">确认配置，进入更衣室</span>
            </button>
          </div>
        </aside>
      </section>
    </main>
  )
}
