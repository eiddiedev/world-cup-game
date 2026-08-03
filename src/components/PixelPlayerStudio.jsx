import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HAPPYSEED_HUMAN_ACTIONS } from '../utils/happySeedHumanPlayer.js'
import {
  APPEARANCE_CATALOG,
  STUDIO_CATEGORY_LABELS,
  STUDIO_TEAMS,
  getStudioKit,
  getStudioTeam,
} from '../pixelStudio/catalog.js'
import {
  STUDIO_SLOT_SIZES,
  buildStudioRuntimeRecipe,
  cloneStudioRecipe,
  createDefaultStudioRecipe,
  createStudioBatch,
  getRecipePatchPoints,
  randomizeStudioRecipe,
  setRecipePatchPoints,
  validateStudioRecipe,
} from '../pixelStudio/model.js'
import {
  buildRuntimePreviewAssetUrls,
  copyCanvasTo,
  renderPortraitCanvas,
  renderStudioSlot,
} from '../pixelStudio/renderer.js'
import {
  downloadStudioJson,
  downloadStudioPack,
  importStudioFile,
} from '../pixelStudio/exporter.js'
import { loadStudioDraft, saveStudioDraft } from '../pixelStudio/persistence.js'
import PixelPaperDollSlicer from './PixelPaperDollSlicer.jsx'

const EDITABLE_SLOTS = [
  ['head_front', '头部正面'],
  ['head_back', '头部背面'],
  ['shirt_front', '球衣正面'],
  ['shirt_back', '球衣背面'],
  ['shorts', '球裤'],
  ['socks', '球袜'],
  ['shoes', '球鞋'],
  ['number', '号码'],
]

const PALETTE = ['#121719', '#F8F5E9', '#C9152B', '#F2C84B', '#153E9D', '#2C914F', '#6AC7EE', '#C8793D', '#281A12', '#D4A83A']
const TOOLS = [
  ['brush', '画笔'], ['eraser', '橡皮'], ['fill', '填充'], ['eyedropper', '吸色'],
  ['line', '直线'], ['rect', '矩形'],
]

function recipeLabel(recipe) {
  return `${getStudioTeam(recipe.teamId).code} · #${recipe.number}`
}

function PreviewCanvas({ recipe, action = 'idle', facing = 'front', sticker = false, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    let frameId
    const startedAt = performance.now()
    const draw = (now) => {
      const output = renderPortraitCanvas(recipe, {
        action,
        facing,
        sticker,
        elapsed: (now - startedAt) / 1000,
      })
      copyCanvasTo(output, ref.current, 2)
      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameId)
  }, [action, facing, recipe, sticker])
  return <canvas ref={ref} className={className} aria-label={`${recipeLabel(recipe)} 像素预览`} />
}

function SlotEditor({ recipe, slotId, onCommit, referenceUrl }) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const [tool, setTool] = useState('brush')
  const [size, setSize] = useState(1)
  const [color, setColor] = useState('#F8F5E9')
  const [mirror, setMirror] = useState(false)
  const [grid, setGrid] = useState(true)
  const [allowExpansion, setAllowExpansion] = useState(false)
  const [points, setPoints] = useState(() => getRecipePatchPoints(recipe, slotId))
  const dimensions = STUDIO_SLOT_SIZES[slotId]
  const scale = slotId.startsWith('head') ? 5 : slotId.startsWith('shirt') ? 7 : 9
  const editableMask = useMemo(() => {
    const canvas = renderStudioSlot({ ...recipe, paintPatches: {} }, slotId)
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  }, [recipe.appearance, recipe.kitType, recipe.number, recipe.teamId, slotId])

  useEffect(() => setPoints(getRecipePatchPoints(recipe, slotId)), [recipe, slotId])

  const drawEditor = useCallback(() => {
    const output = renderStudioSlot(setRecipePatchPoints(recipe, slotId, points), slotId)
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = dimensions[0] * scale
    canvas.height = dimensions[1] * scale
    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (referenceUrl) {
      const image = new Image()
      image.onload = () => {
        context.save()
        context.globalAlpha = 0.2
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        context.restore()
        context.drawImage(output, 0, 0, canvas.width, canvas.height)
      }
      image.src = referenceUrl
    } else {
      context.drawImage(output, 0, 0, canvas.width, canvas.height)
    }
    if (grid && scale >= 5) {
      context.strokeStyle = 'rgba(180, 224, 214, .13)'
      context.lineWidth = 1
      for (let x = 0; x <= canvas.width; x += scale) {
        context.beginPath(); context.moveTo(x + 0.5, 0); context.lineTo(x + 0.5, canvas.height); context.stroke()
      }
      for (let y = 0; y <= canvas.height; y += scale) {
        context.beginPath(); context.moveTo(0, y + 0.5); context.lineTo(canvas.width, y + 0.5); context.stroke()
      }
    }
  }, [dimensions, grid, points, recipe, referenceUrl, scale, slotId])

  useEffect(drawEditor, [drawEditor])

  const coordinate = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(dimensions[0] - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * dimensions[0]))),
      y: Math.max(0, Math.min(dimensions[1] - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * dimensions[1]))),
    }
  }

  const pointMap = (source = points) => new Map(source.map((point) => [`${point.x}:${point.y}`, point]))
  const canEdit = (x, y) => {
    if (x < 0 || y < 0 || x >= dimensions[0] || y >= dimensions[1]) return false
    if (allowExpansion) return true
    return editableMask[(y * dimensions[0] + x) * 4 + 3] > 0
  }

  const putBrush = (source, center, selectedColor = color) => {
    const map = pointMap(source)
    const radius = Math.floor(size / 2)
    const add = (x, y) => {
      if (!canEdit(x, y)) return
      map.set(`${x}:${y}`, { x, y, color: selectedColor })
    }
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        add(x, y)
        if (mirror) add(dimensions[0] - 1 - x, y)
      }
    }
    return [...map.values()]
  }

  const linePoints = (start, end) => {
    const result = []
    let x = start.x
    let y = start.y
    const dx = Math.abs(end.x - start.x)
    const sx = start.x < end.x ? 1 : -1
    const dy = -Math.abs(end.y - start.y)
    const sy = start.y < end.y ? 1 : -1
    let error = dx + dy
    while (true) {
      result.push({ x, y })
      if (x === end.x && y === end.y) break
      const double = 2 * error
      if (double >= dy) { error += dy; x += sx }
      if (double <= dx) { error += dx; y += sy }
    }
    return result
  }

  const handleDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const position = coordinate(event)
    if (tool === 'eyedropper') {
      const source = renderStudioSlot(setRecipePatchPoints(recipe, slotId, points), slotId)
      const pixel = source.getContext('2d').getImageData(position.x, position.y, 1, 1).data
      if (pixel[3]) setColor(`#${[pixel[0], pixel[1], pixel[2]].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`)
      return
    }
    if (tool === 'fill') {
      const source = renderStudioSlot(setRecipePatchPoints(recipe, slotId, points), slotId)
      const data = source.getContext('2d').getImageData(0, 0, source.width, source.height).data
      const index = (position.y * source.width + position.x) * 4
      const target = [data[index], data[index + 1], data[index + 2], data[index + 3]].join(',')
      const nextMap = pointMap(points)
      const add = (x, y) => {
        if (canEdit(x, y)) nextMap.set(`${x}:${y}`, { x, y, color })
      }
      for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
        const offset = (y * source.width + x) * 4
        if ([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]].join(',') === target) {
          add(x, y)
          if (mirror) add(dimensions[0] - 1 - x, y)
        }
      }
      const next = [...nextMap.values()]
      setPoints(next)
      onCommit(next)
      return
    }
    dragRef.current = { start: position, initial: points }
    if (tool === 'brush' || tool === 'eraser') setPoints(putBrush(points, position, tool === 'eraser' ? null : color))
  }

  const handleMove = (event) => {
    if (!dragRef.current || !event.buttons) return
    if (tool === 'brush' || tool === 'eraser') setPoints((current) => putBrush(current, coordinate(event), tool === 'eraser' ? null : color))
  }

  const handleUp = (event) => {
    if (!dragRef.current) return
    const end = coordinate(event)
    let next = points
    if (tool === 'line') {
      next = dragRef.current.initial
      linePoints(dragRef.current.start, end).forEach((point) => { next = putBrush(next, point) })
      setPoints(next)
    }
    if (tool === 'rect') {
      next = dragRef.current.initial
      const minX = Math.min(dragRef.current.start.x, end.x)
      const maxX = Math.max(dragRef.current.start.x, end.x)
      const minY = Math.min(dragRef.current.start.y, end.y)
      const maxY = Math.max(dragRef.current.start.y, end.y)
      for (let x = minX; x <= maxX; x += 1) {
        next = putBrush(next, { x, y: minY }); next = putBrush(next, { x, y: maxY })
      }
      for (let y = minY; y <= maxY; y += 1) {
        next = putBrush(next, { x: minX, y }); next = putBrush(next, { x: maxX, y })
      }
      setPoints(next)
    }
    dragRef.current = null
    onCommit(next)
  }

  return (
    <div className="studio-pixel-editor">
      <div className="studio-tool-row">
        {TOOLS.map(([id, label]) => <button type="button" key={id} className={tool === id ? 'is-active' : ''} onClick={() => setTool(id)}>{label}</button>)}
      </div>
      <div className="studio-tool-options">
        <label>笔刷 <select value={size} onChange={(event) => setSize(Number(event.target.value))}><option>1</option><option>2</option><option>3</option></select></label>
        <label><input type="checkbox" checked={mirror} onChange={(event) => setMirror(event.target.checked)} /> 镜像</label>
        <label><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} /> 网格</label>
        <label title="允许在原附件轮廓外绘制，但仍不能超出固定画布"><input type="checkbox" checked={allowExpansion} onChange={(event) => setAllowExpansion(event.target.checked)} /> 扩展轮廓</label>
      </div>
      <div className="studio-palette">
        {PALETTE.map((swatch) => <button type="button" key={swatch} className={color === swatch ? 'is-active' : ''} style={{ '--swatch': swatch }} onClick={() => setColor(swatch)} aria-label={swatch} />)}
        <input type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
      </div>
      <div className="studio-editor-canvas-wrap">
        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          aria-label={`${slotId} 像素编辑器`}
        />
      </div>
      <div className="studio-editor-footer"><span>{dimensions[0]}×{dimensions[1]}</span><span>{points.length} 个手绘像素</span></div>
    </div>
  )
}

function AppearanceLibrary({ recipe, category, onSelect, locked, onToggleLock }) {
  const selectedValue = category === 'accessoryIds'
    ? recipe.appearance.accessoryIds?.[0] || 'accessory-none'
    : recipe.appearance[category]
  return (
    <section className="studio-library-section">
      <div className="studio-section-heading">
        <div><span>部件库</span><h2>{STUDIO_CATEGORY_LABELS[category]}</h2></div>
        <button type="button" className={locked ? 'is-active' : ''} onClick={() => onToggleLock(category)}>{locked ? '已锁定' : '锁定'}</button>
      </div>
      <div className="studio-asset-grid">
        {APPEARANCE_CATALOG[category].map((item) => (
          <button type="button" key={item.id} className={selectedValue === item.id ? 'is-active' : ''} onClick={() => onSelect(category, item.id)}>
            <span className="studio-asset-thumb" style={item.color ? { background: item.color } : undefined}>{item.variant >= 0 ? String(item.variant + 1).padStart(2, '0') : '—'}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

export function ProceduralPlayerComposer({ onOpenSlicer }) {
  const [recipe, setRecipe] = useState(() => createDefaultStudioRecipe())
  const [category, setCategory] = useState('hairId')
  const [slotId, setSlotId] = useState('shirt_front')
  const [action, setAction] = useState('idle')
  const [facing, setFacing] = useState('front')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [status, setStatus] = useState('就绪')
  const [progress, setProgress] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [runtimeRevision, setRuntimeRevision] = useState(0)
  const [inspectorTab, setInspectorTab] = useState('paint')
  const undoRef = useRef([])
  const redoRef = useRef([])
  const importRef = useRef(null)
  const referenceRef = useRef(null)
  const autosaveTimer = useRef(null)

  const validation = useMemo(() => validateStudioRecipe(recipe), [recipe])
  const team = getStudioTeam(recipe.teamId)
  const kit = getStudioKit(recipe.teamId, recipe.kitType)

  const commitRecipe = useCallback((nextOrUpdater, message = '已修改') => {
    setRecipe((current) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(cloneStudioRecipe(current)) : nextOrUpdater
      undoRef.current = [...undoRef.current.slice(-99), current]
      redoRef.current = []
      setStatus(message)
      return next
    })
  }, [])

  useEffect(() => {
    loadStudioDraft().then((record) => {
      if (record?.recipe && validateStudioRecipe(record.recipe).valid) {
        setRecipe(record.recipe)
        setStatus(`已恢复 ${new Date(record.savedAt).toLocaleString()} 的草稿`)
      }
    }).catch(() => setStatus('自动恢复不可用'))
  }, [])

  useEffect(() => {
    window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => {
      saveStudioDraft(recipe).then(() => setStatus('草稿已自动保存')).catch(() => setStatus('自动保存失败'))
    }, 700)
    return () => window.clearTimeout(autosaveTimer.current)
  }, [recipe])

  useEffect(() => {
    const frame = document.querySelector('.studio-runtime-frame')
    const api = frame?.contentWindow?.__happySeedHumanSlice
    api?.setAction?.(action)
    api?.setFacing?.(facing)
  }, [action, facing, runtimeRevision])

  const syncRuntimeFrame = useCallback((frame) => {
    const apply = () => {
      const api = frame?.contentWindow?.__happySeedHumanSlice
      api?.setAction?.(action)
      api?.setFacing?.(facing)
    }
    apply()
    window.setTimeout(apply, 400)
    window.setTimeout(apply, 1200)
  }, [action, facing])

  const changeRecipeField = (field, value) => {
    if (field === 'teamId') setCandidates([])
    commitRecipe((draft) => {
      const previousTeamId = draft.teamId
      draft[field] = value
      if (field === 'teamId') {
        const nextTeam = getStudioTeam(value)
        if (draft.playerId.startsWith(`${previousTeamId}_player_`)) {
          draft.playerId = draft.playerId.replace(`${previousTeamId}_player_`, `${value}_player_`)
        }
        draft.kit.numberStyleId = nextTeam.numberStyleId
        draft.kit.kitId = getStudioKit(value, draft.kitType).templateId
      }
      if (field === 'kitType') {
        draft.role = value.includes('goalkeeper') ? 'goalkeeper' : 'outfield'
        draft.kit.kitId = getStudioKit(draft.teamId, value).templateId
      }
      return draft
    })
  }

  const selectAppearance = (key, value) => commitRecipe((draft) => {
    if (key === 'accessoryIds') draft.appearance.accessoryIds = value === 'accessory-none' ? [] : [value]
    else draft.appearance[key] = value
    return draft
  }, `${STUDIO_CATEGORY_LABELS[key]}已更新`)

  const toggleLock = (key) => commitRecipe((draft) => {
    const locked = new Set(draft.lockedParts || [])
    if (locked.has(key)) locked.delete(key)
    else locked.add(key)
    draft.lockedParts = [...locked]
    return draft
  })

  const randomize = (seedDelta = 1) => commitRecipe((current) => randomizeStudioRecipe(current, {
    seed: Number(current.seed) + seedDelta,
    lockedParts: current.lockedParts,
  }), '已生成确定性随机外观')

  const buildCandidates = () => {
    const next = Array.from({ length: 8 }, (_, index) => randomizeStudioRecipe(recipe, {
      seed: Number(recipe.seed) + index + 1,
      lockedParts: recipe.lockedParts,
    }))
    setCandidates(next)
    setStatus('已生成 8 个候选')
  }

  const undo = () => {
    const previous = undoRef.current.pop()
    if (!previous) return
    redoRef.current.push(recipe)
    setRecipe(previous)
    setStatus('已撤销')
  }

  const redo = () => {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(recipe)
    setRecipe(next)
    setStatus('已重做')
  }

  const refreshRuntime = () => {
    try {
      const urls = buildRuntimePreviewAssetUrls(recipe)
      sessionStorage.setItem('happyseed-player-studio-preview', JSON.stringify(buildStudioRuntimeRecipe(recipe, urls)))
      setRuntimeRevision((value) => value + 1)
      setStatus('真实骨架预览已刷新')
    } catch (error) {
      setStatus(error.message)
    }
  }

  const exportPack = async (scope) => {
    try {
      setProgress({ current: 0, total: 1 })
      let recipes = [recipe]
      let filename = `${recipe.playerId}.hspack`
      if (scope === 'team') {
        recipes = createStudioBatch({ teamId: recipe.teamId, count: 38, seed: recipe.seed }).recipes
        filename = `${recipe.teamId}-38-players.hspack`
      }
      if (scope === 'all') {
        recipes = STUDIO_TEAMS.flatMap((item, index) => createStudioBatch({ teamId: item.id, count: 38, seed: recipe.seed + index * 100 }).recipes)
        filename = 'happyseed-16-teams-608-players.hspack'
      }
      const compiled = await downloadStudioPack(recipes, filename, {
        onProgress: setProgress,
        includeAllKits: scope !== 'player',
      })
      setStatus(`导出完成 · ${compiled.audit.playerCount} 人 · ${compiled.audit.totalMiB} MiB`)
    } catch (error) {
      setStatus(`导出失败：${error.message}`)
    } finally {
      setProgress(null)
    }
  }

  const importFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = await importStudioFile(file)
      setRecipe(imported.recipes[0])
      undoRef.current = []
      redoRef.current = []
      setStatus(`已导入 ${imported.recipes.length} 个配方`)
    } catch (error) {
      setStatus(`导入失败：${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  const loadReference = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (referenceUrl) URL.revokeObjectURL(referenceUrl)
    setReferenceUrl(URL.createObjectURL(file))
  }

  return (
    <main className="pixel-player-studio">
      <header className="studio-topbar">
        <div className="studio-brand"><span>HAPPYSEED / ASSET TOOL</span><strong>PIXEL PLAYER STUDIO</strong></div>
        <div className="studio-player-fields">
          <label><span>球队</span><select value={recipe.teamId} onChange={(event) => changeRecipeField('teamId', event.target.value)}>{STUDIO_TEAMS.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>球员 ID</span><input value={recipe.playerId} onChange={(event) => changeRecipeField('playerId', event.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} /></label>
          <label className="studio-number-field"><span>号码</span><input type="number" min="1" max="99" value={recipe.number} onChange={(event) => changeRecipeField('number', Math.max(1, Math.min(99, Number(event.target.value))))} /></label>
          <label><span>球衣</span><select value={recipe.kitType} onChange={(event) => changeRecipeField('kitType', event.target.value)}>{team.kits.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        </div>
        <div className="studio-top-actions">
          <button type="button" onClick={onOpenSlicer}>立绘拆分</button>
          <button type="button" onClick={undo}>撤销</button>
          <button type="button" onClick={redo}>重做</button>
          <button type="button" onClick={() => saveStudioDraft(recipe).then(() => setStatus('草稿已保存'))}>保存</button>
          <button type="button" onClick={() => importRef.current.click()}>导入</button>
          <button type="button" className="studio-primary" onClick={() => exportPack('player')}>导出 HSPack</button>
          <input ref={importRef} hidden type="file" accept=".json,.hspack,application/json" onChange={importFile} />
        </div>
      </header>

      <div className="studio-workspace">
        <aside className="studio-library">
          <nav className="studio-category-nav" aria-label="外观类别">
            {Object.keys(STUDIO_CATEGORY_LABELS).map((key) => (
              <button type="button" key={key} className={category === key ? 'is-active' : ''} onClick={() => setCategory(key)}>{STUDIO_CATEGORY_LABELS[key]}</button>
            ))}
          </nav>
          <AppearanceLibrary recipe={recipe} category={category} onSelect={selectAppearance} locked={recipe.lockedParts?.includes(category)} onToggleLock={toggleLock} />
        </aside>

        <section className="studio-stage">
          <div className="studio-stage-heading">
            <div><span>{team.code} / {kit.label}</span><h1>{recipeLabel(recipe)}</h1></div>
            <div className="studio-stage-actions">
              <button type="button" onClick={() => randomize()}>随机生成</button>
              <button type="button" onClick={buildCandidates}>生成候选</button>
              <button type="button" onClick={() => referenceRef.current.click()}>加载参考图</button>
              <input ref={referenceRef} hidden type="file" accept="image/*" onChange={loadReference} />
            </div>
          </div>
          <div className="studio-preview-plane">
            <div className="studio-preview-copy"><span>PORTRAIT OUTPUT</span><strong>128×204</strong><small>同一配方生成 Runtime 与贴纸肖像</small></div>
            <PreviewCanvas recipe={recipe} action={action} facing={facing} sticker className="studio-main-preview" />
            {referenceUrl && <img className="studio-reference-image" src={referenceUrl} alt="球员参考" />}
            <div className="studio-kit-chip" style={{ '--kit': kit.shirt, '--kit-accent': kit.accent }}><strong>{team.code}</strong><span>{kit.templateId}</span></div>
          </div>
          <div className="studio-motion-controls">
            <div className="studio-facing-toggle"><button type="button" className={facing === 'front' ? 'is-active' : ''} onClick={() => setFacing('front')}>正面</button><button type="button" className={facing === 'back' ? 'is-active' : ''} onClick={() => setFacing('back')}>背面</button></div>
            <div className="studio-action-strip">{HAPPYSEED_HUMAN_ACTIONS.map((item) => <button type="button" key={item.id} className={action === item.id ? 'is-active' : ''} onClick={() => setAction(item.id)}>{item.label}</button>)}</div>
          </div>
          <div className="studio-runtime-preview">
            <div className="studio-runtime-heading"><div><span>SPINE 2.1.27</span><strong>真实骨架动作验收</strong></div><button type="button" onClick={refreshRuntime}>应用当前配方</button></div>
            <iframe key={runtimeRevision} className="studio-runtime-frame" title="真实 Spine 预览" src={`/happyseed-runtime-lab.html?studio=1&time=3&revision=${runtimeRevision}`} onLoad={(event) => syncRuntimeFrame(event.currentTarget)} />
          </div>
        </section>

        <aside className="studio-inspector">
          <nav className="studio-inspector-tabs">
            <button type="button" className={inspectorTab === 'paint' ? 'is-active' : ''} onClick={() => setInspectorTab('paint')}>画笔</button>
            <button type="button" className={inspectorTab === 'recipe' ? 'is-active' : ''} onClick={() => setInspectorTab('recipe')}>配方</button>
            <button type="button" className={inspectorTab === 'audit' ? 'is-active' : ''} onClick={() => setInspectorTab('audit')}>诊断</button>
          </nav>
          {inspectorTab === 'paint' && <>
            <label className="studio-slot-select"><span>编辑插槽</span><select value={slotId} onChange={(event) => setSlotId(event.target.value)}>{EDITABLE_SLOTS.map(([id, label]) => <option value={id} key={id}>{label} · {STUDIO_SLOT_SIZES[id].join('×')}</option>)}</select></label>
            <SlotEditor recipe={recipe} slotId={slotId} referenceUrl={referenceUrl} onCommit={(points) => commitRecipe((current) => setRecipePatchPoints(current, slotId, points), '手绘补丁已保存')} />
          </>}
          {inspectorTab === 'recipe' && <div className="studio-recipe-panel"><button type="button" onClick={() => downloadStudioJson(recipe)}>导出可编辑 JSON</button><pre>{JSON.stringify(recipe, null, 2)}</pre></div>}
          {inspectorTab === 'audit' && <div className="studio-audit-panel">
            <dl>
              <div><dt>Schema</dt><dd>{recipe.schemaVersion}</dd></div>
              <div><dt>Part set</dt><dd>{recipe.partSetId}</dd></div>
              <div><dt>骨架</dt><dd>17 bones / 32 slots</dd></div>
              <div><dt>锚点</dt><dd>root-footline</dd></div>
              <div><dt>球衣来源</dt><dd>2026 国际赛事参考 / 待合规审核</dd></div>
              <div><dt>配方状态</dt><dd className={validation.valid ? 'is-ok' : 'is-error'}>{validation.valid ? '有效' : validation.errors.join(', ')}</dd></div>
            </dl>
            <div className="studio-batch-actions"><button type="button" onClick={() => exportPack('team')}>导出本队 38 人</button><button type="button" onClick={() => exportPack('all')}>导出 16 队 608 人</button></div>
          </div>}
        </aside>
      </div>

      <footer className="studio-candidate-tray">
        <div className="studio-tray-heading"><span>VARIANT FILMSTRIP</span><strong>{candidates.length ? '点击候选替换当前外观' : '生成候选后在这里比较'}</strong></div>
        <div className="studio-candidate-list">
          {candidates.map((candidate) => <button type="button" key={`${candidate.playerId}-${candidate.seed}`} onClick={() => commitRecipe(candidate, `已采用种子 ${candidate.seed}`)}><PreviewCanvas recipe={candidate} /><span>SEED {candidate.seed}</span></button>)}
        </div>
        <div className="studio-status" aria-live="polite">
          {progress ? <><span>编译 {progress.current}/{progress.total}</span><progress value={progress.current} max={progress.total} /></> : <span className={validation.valid ? 'is-ok' : 'is-error'}>{status}</span>}
        </div>
      </footer>
    </main>
  )
}

export default function PixelPlayerStudio() {
  const [mode, setMode] = useState('slicer')
  return mode === 'slicer'
    ? <PixelPaperDollSlicer onOpenComposer={() => setMode('composer')} />
    : <ProceduralPlayerComposer onOpenSlicer={() => setMode('slicer')} />
}
