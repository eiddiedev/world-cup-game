import React, { useMemo, useState } from 'react'
import {
  PIXEL_PLAYER_ACTIONS,
  buildPixelPlayerModel,
  getPixelPlayerProductionRules,
} from '../utils/pixelPlayerRecipe.js'

function PixelLayer({ layer }) {
  if (layer.type === 'text') {
    return (
      <span
        className="pixel-player-number"
        style={{
          left: `${layer.x}px`,
          top: `${layer.y}px`,
          color: layer.color,
          WebkitTextStroke: `0.6px ${layer.stroke}`,
          textShadow: `1px 0 ${layer.stroke}, -1px 0 ${layer.stroke}, 0 1px ${layer.stroke}, 0 -1px ${layer.stroke}`,
        }}
      >
        {layer.text}
      </span>
    )
  }

  return (
    <span
      className={`pixel-player-layer layer-${layer.id}${layer.shape ? ` shape-${layer.shape}` : ''}${layer.part ? ` part-${layer.part}` : ''}`}
      style={{
        left: `${layer.x}px`,
        top: `${layer.y}px`,
        width: `${layer.w}px`,
        height: `${layer.h}px`,
        background: layer.color,
      }}
    />
  )
}

function PixelPlayerSprite({ model, label }) {
  const scale = model.baseFrame.scale

  return (
    <figure className="pixel-player-sprite-card">
      <div
        className={`pixel-player-sprite action-${model.action} role-${model.role}`}
        style={{
          width: `${model.baseFrame.width}px`,
          height: `${model.baseFrame.height}px`,
          transform: `scale(${scale})`,
        }}
        aria-label={label}
      >
        {model.layers.map(layer => <PixelLayer key={layer.id} layer={layer} />)}
        {model.action === 'dribble' && <span className="pixel-ball ball-dribble" />}
        {model.action === 'pass' && <span className="pixel-ball ball-pass" />}
        {model.action === 'shoot' && <span className="pixel-ball ball-shoot" />}
        {model.action === 'save' && <span className="pixel-ball ball-save" />}
      </div>
      <figcaption>
        <strong>{label}</strong>
        <span>{model.role === 'goalkeeper' ? 'GK' : 'OUT'} #{model.numberLayer.text}</span>
      </figcaption>
    </figure>
  )
}

export default function PixelPlayerLab({ navigateTo }) {
  const [action, setAction] = useState('run')
  const rules = useMemo(() => getPixelPlayerProductionRules(), [])
  const samples = useMemo(() => [
    {
      id: 'france-outfield',
      label: 'France 10',
      model: buildPixelPlayerModel({ teamId: 'france', number: 10, role: 'outfield', action }),
    },
    {
      id: 'brazil-outfield',
      label: 'Brazil 9',
      model: buildPixelPlayerModel({ teamId: 'brazil', number: 9, role: 'outfield', action, skinIndex: 2, hairIndex: 1 }),
    },
    {
      id: 'france-keeper',
      label: 'France 1',
      model: buildPixelPlayerModel({ teamId: 'france', number: 1, role: 'goalkeeper', action: action === 'dribble' ? 'idle' : action, hairIndex: 3 }),
    },
  ], [action])

  const runtimeRecipe = samples[0].model.runtimeRecipe

  return (
    <main className="screen pixel-player-lab-screen">
      <header className="pixel-lab-topbar">
        <button type="button" className="PixelButton compact" onClick={() => navigateTo('home')}>
          <span className="button-face" aria-hidden="true"></span>
          <span className="button-label">返回</span>
        </button>
        <div>
          <p>方案B / Paper Doll v0</p>
          <h1>模块化像素小人验证</h1>
        </div>
      </header>

      <section className="pixel-lab-stage" aria-label="像素小人样板">
        <div className="pixel-lab-pitch">
          {samples.map(sample => (
            <PixelPlayerSprite key={sample.id} model={sample.model} label={sample.label} />
          ))}
        </div>

        <aside className="pixel-lab-controls">
          <div className="action-switcher" role="group" aria-label="动作">
            {PIXEL_PLAYER_ACTIONS.map(actionId => (
              <button
                key={actionId}
                type="button"
                className={action === actionId ? 'is-active' : ''}
                onClick={() => setAction(actionId)}
              >
                {actionId}
              </button>
            ))}
          </div>

          <dl className="pixel-lab-spec">
            <div>
              <dt>Frame</dt>
              <dd>{rules.baseFrame.width}x{rules.baseFrame.height}px @ {rules.baseFrame.scale}x</dd>
            </div>
            <div>
              <dt>Parts</dt>
              <dd>head / body / arms / legs / kit / boots / number</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>{runtimeRecipe.partSetId} / {runtimeRecipe.action}</dd>
            </div>
          </dl>

          <pre className="pixel-lab-code">{JSON.stringify(runtimeRecipe, null, 2)}</pre>
        </aside>
      </section>

      <section className="pixel-lab-rules" aria-label="批量生产规则">
        <div>
          <h2>命名规范</h2>
          {Object.entries(rules.naming).map(([key, value]) => (
            <p key={key}><strong>{key}</strong><code>{value}</code></p>
          ))}
        </div>
        <div>
          <h2>后续资源</h2>
          <ul>
            {rules.artList.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>
    </main>
  )
}
