import React, { useMemo, useState } from 'react'
import { getTeamById } from '../data/teams.js'
import {
  AI_SCENE_DEFINITIONS,
  createAiEnhancementRequest,
} from '../data/aiEnhancement.js'
import {
  COMMERCIAL_ENTRY_POINTS,
  COMMERCIAL_FAIRNESS_RULES,
  COMMERCIAL_ITEMS,
} from '../data/commercialization.js'
import {
  getAiEnhancementCapability,
  requestAiEnhancement,
} from '../services/aiEnhancementService.js'

function buildTeamSnapshot(team, fallbackName) {
  if (!team) return { name: fallbackName }
  return {
    id: team.id,
    name: team.name,
    formation: team.defaultFormation,
    styleTags: team.styleTags || [],
    difficulty: team.difficulty,
  }
}

function buildRecentEvents(result) {
  if (!Array.isArray(result?.decisions)) return []
  return result.decisions.slice(-12).map((decision) => ({
    minute: decision.minute,
    text: decision.summary || decision.outcomeText || decision.scenarioTitle || decision.choiceLabel || '临场决策',
    outcome: decision.outcome,
  }))
}

export default function EnhancementHubScreen({ saveData, navigateTo, showToast }) {
  const [activeTab, setActiveTab] = useState('ai')
  const [activeScene, setActiveScene] = useState(AI_SCENE_DEFINITIONS[0].scene)
  const [activeCommercialEntry, setActiveCommercialEntry] = useState(COMMERCIAL_ENTRY_POINTS[0].id)
  const [preview, setPreview] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const capability = getAiEnhancementCapability()
  const currentRun = saveData.currentRun || {}
  const playerTeam = getTeamById(currentRun.teamId)
  const result = currentRun.lastMatchResult
  const selectedScene = AI_SCENE_DEFINITIONS.find(item => item.scene === activeScene) || AI_SCENE_DEFINITIONS[0]
  const selectedCommercial = COMMERCIAL_ENTRY_POINTS.find(item => item.id === activeCommercialEntry) || COMMERCIAL_ENTRY_POINTS[0]
  const wallet = saveData.commercialization?.wallet || {}

  const request = useMemo(() => createAiEnhancementRequest({
    scene: activeScene,
    matchSnapshot: {
      stage: currentRun.stage || 'home',
      formation: currentRun.formation,
      opponentFormation: currentRun.opponentFormation,
      homeScore: result?.homeScore,
      awayScore: result?.awayScore,
      result: result?.result,
      stats: result?.stats || {},
      lowStaminaCount: Object.values(currentRun.playerStatuses || {}).filter(value => Number(value) < 55).length,
    },
    playerTeam: buildTeamSnapshot(playerTeam, '尚未选择球队'),
    opponentTeam: {
      name: currentRun.currentOpponent || result?.opponent || '待定对手',
      formation: currentRun.opponentFormation,
      styleTags: currentRun.opponentStyleTags || [],
    },
    recentEvents: buildRecentEvents(result),
    locale: saveData.settings?.language || 'zh-CN',
  }), [activeScene, currentRun, playerTeam, result, saveData.settings?.language])

  const runLocalPreview = async () => {
    setIsLoading(true)
    const response = await requestAiEnhancement(request)
    setPreview(response)
    setIsLoading(false)
  }

  const selectScene = (scene) => {
    setActiveScene(scene)
    setPreview(null)
  }

  const showPlaceholderNotice = () => {
    showToast?.(`${selectedCommercial.label}为第一阶段入口占位，未接广告或支付。`)
  }

  return (
    <main className="screen enhancement-hub-screen">
      <header className="enhancement-header">
        <button type="button" className="back-button" onClick={() => navigateTo('home')} aria-label="返回首页">←</button>
        <div>
          <span className="enhancement-kicker">产品增强中心</span>
          <h1>AI 与赞助</h1>
        </div>
        <span className="enhancement-phase">PHASE 1</span>
      </header>

      <section className="enhancement-status-band" aria-label="接入状态">
        <div><span>AI 服务</span><strong>火山引擎待接入</strong></div>
        <div><span>当前输出</span><strong className="is-local">本地模板</strong></div>
        <div><span>实时联机</span><strong className="is-off">未启用</strong></div>
        <div><span>核心流程依赖</span><strong className="is-local">无</strong></div>
      </section>

      <div className="enhancement-tabs" role="tablist" aria-label="增强中心分类">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ai'}
          className={activeTab === 'ai' ? 'active' : ''}
          onClick={() => setActiveTab('ai')}
        >
          AI 场景
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'commercial'}
          className={activeTab === 'commercial' ? 'active' : ''}
          onClick={() => setActiveTab('commercial')}
        >
          商业化入口
        </button>
      </div>

      {activeTab === 'ai' ? (
        <section className="enhancement-workspace" aria-label="AI 场景设计">
          <nav className="enhancement-list" aria-label="AI 功能入口">
            {AI_SCENE_DEFINITIONS.map((item, index) => (
              <button
                key={item.scene}
                type="button"
                className={activeScene === item.scene ? 'active' : ''}
                onClick={() => selectScene(item.scene)}
              >
                <span className="enhancement-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="enhancement-list-copy">
                  <strong>{item.shortLabel}</strong>
                  <small>{item.timing} · {item.placement}</small>
                </span>
                <span className="enhancement-availability">本地可用</span>
              </button>
            ))}
          </nav>

          <article className="enhancement-detail">
            <div className="enhancement-detail-heading">
              <div>
                <span>{selectedScene.timing}</span>
                <h2>{selectedScene.label}</h2>
              </div>
              <span className="placeholder-badge">接口占位</span>
            </div>
            <p>{selectedScene.description}</p>

            <dl className="enhancement-contract-grid">
              <div><dt>scene</dt><dd>{request.scene}</dd></div>
              <div><dt>matchSnapshot</dt><dd>{Object.keys(request.matchSnapshot).length} fields</dd></div>
              <div><dt>playerTeam</dt><dd>{request.playerTeam.name}</dd></div>
              <div><dt>opponentTeam</dt><dd>{request.opponentTeam.name}</dd></div>
              <div><dt>recentEvents</dt><dd>{request.recentEvents.length} items</dd></div>
              <div><dt>locale</dt><dd>{request.locale}</dd></div>
            </dl>

            <div className="enhancement-fallback-line">
              <span>Fallback</span>
              <strong>{selectedScene.fallbackStrategy}</strong>
            </div>

            <button type="button" className="enhancement-preview-button" onClick={runLocalPreview} disabled={isLoading}>
              {isLoading ? '生成中' : '运行本地预览'}
            </button>

            {preview && (
              <section className="enhancement-preview" aria-live="polite">
                <div className="enhancement-preview-meta">
                  <span>{preview.source}</span>
                  <span>{preview.fallbackReason}</span>
                </div>
                <h3>{preview.title}</h3>
                <p>{preview.summary}</p>
                <ul>
                  {preview.items.map(item => <li key={item}>{item}</li>)}
                </ul>
              </section>
            )}

            <div className="enhancement-provider-note">
              后续接入点：<code>{capability.phaseTwoAdapter}</code>，通过 HTTPS 请求响应调用，前端不保存密钥。
            </div>
          </article>
        </section>
      ) : (
        <section className="commercial-workspace" aria-label="商业化入口设计">
          <div className="commercial-topline">
            <div><span>球队基金</span><strong>{wallet.teamFunds || 0}</strong></div>
            <div><span>声望</span><strong>{wallet.reputation || 0}</strong></div>
            <div><span>球探券</span><strong>{wallet.scoutTickets || 0}</strong></div>
            <p>展示存档字段，不启用真实支付或广告 SDK。</p>
          </div>

          <div className="commercial-layout">
            <nav className="commercial-entry-list" aria-label="商业化入口">
              {COMMERCIAL_ENTRY_POINTS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={activeCommercialEntry === entry.id ? 'active' : ''}
                  onClick={() => setActiveCommercialEntry(entry.id)}
                >
                  <strong>{entry.label}</strong>
                  <span>{entry.placement}</span>
                  <small>{entry.status}</small>
                </button>
              ))}
            </nav>

            <article className="commercial-detail">
              <div className="enhancement-detail-heading">
                <div>
                  <span>{selectedCommercial.timing}</span>
                  <h2>{selectedCommercial.label}</h2>
                </div>
                <span className="placeholder-badge">占位</span>
              </div>
              <dl>
                <div><dt>未来奖励</dt><dd>{selectedCommercial.futureReward}</dd></div>
                <div><dt>公平边界</dt><dd>{selectedCommercial.guardrail}</dd></div>
              </dl>
              <button type="button" className="enhancement-preview-button" onClick={showPlaceholderNotice}>
                查看占位状态
              </button>
            </article>
          </div>

          <section className="commercial-items-section">
            <div className="commercial-section-heading">
              <h2>道具与装备接口</h2>
              <span>只定义 effectIntent</span>
            </div>
            <div className="commercial-item-table">
              {COMMERCIAL_ITEMS.map((item) => (
                <div key={item.id} className="commercial-item-row">
                  <strong>{item.label}</strong>
                  <span>{item.useTiming}</span>
                  <span>{item.target}</span>
                  <code>{item.effectIntent.type}</code>
                  <small>{item.tradeoff}</small>
                </div>
              ))}
            </div>
          </section>

          <footer className="commercial-fairness-line">
            <strong>公平规则</strong>
            <span>不买进球</span>
            <span>不买胜利</span>
            <span>不改成功率</span>
            <span>不影响裁判</span>
            <span>{COMMERCIAL_FAIRNESS_RULES.realAdSdkEnabled ? '广告已接入' : '广告 SDK 未接入'}</span>
          </footer>
        </section>
      )}
    </main>
  )
}
