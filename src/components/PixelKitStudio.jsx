import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STUDIO_TEAMS } from '../pixelStudio/catalog.js'
import {
  auditKitProject,
  compileRosterSelection,
  downloadKitPixelJson,
  downloadKitPngPack,
  downloadKitSlotPng,
  KIT_SLOT_LABELS,
  KIT_SLOT_ORDER,
  loadKitProject,
} from '../pixelStudio/kitWorkflow.js'
import {
  decodePixelRuns,
  floodFillPixel,
  renderIndexedPixelDocument,
  replacePixel,
} from '../pixelStudio/imageSlicer.js'
import { buildStudioRuntimeRecipe, createDefaultStudioRecipe } from '../pixelStudio/model.js'

const TOOL_LABELS = [
  ['brush', '画笔'], ['eraser', '橡皮'], ['fill', '填充'],
  ['picker', '吸色'], ['line', '直线'], ['rect', '矩形'],
]

const PixelCanvas = memo(function PixelCanvas({ document, scale = 1, className = '', label = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!document || !ref.current) return
    const rendered = renderIndexedPixelDocument(document, scale)
    ref.current.width = rendered.width
    ref.current.height = rendered.height
    const context = ref.current.getContext('2d')
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, rendered.width, rendered.height)
    context.drawImage(rendered, 0, 0)
  }, [document, scale])
  return <canvas ref={ref} className={className} aria-label={label} />
})

function lineCoordinates(start, end) {
  const points = []
  let x = start.x; let y = start.y
  const dx = Math.abs(end.x - start.x); const sx = start.x < end.x ? 1 : -1
  const dy = -Math.abs(end.y - start.y); const sy = start.y < end.y ? 1 : -1
  let error = dx + dy
  while (true) {
    points.push({ x, y })
    if (x === end.x && y === end.y) break
    const doubled = error * 2
    if (doubled >= dy) { error += dy; x += sx }
    if (doubled <= dx) { error += dx; y += sy }
  }
  return points
}

function PixelKitEditor({ document, onCommit, onUndo, onRedo, onReset, canUndo, canRedo }) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const draftRef = useRef(document)
  const [draft, setDraft] = useState(document)
  const [tool, setTool] = useState('brush')
  const [paletteIndex, setPaletteIndex] = useState(1)
  const [brushSize, setBrushSize] = useState(1)
  const [mirror, setMirror] = useState(false)
  const [grid, setGrid] = useState(true)
  const [customColor, setCustomColor] = useState('#2B68C7')

  useEffect(() => {
    draftRef.current = document
    setDraft(document)
    setPaletteIndex((value) => Math.min(value, Math.max(1, document.palette.length - 1)))
  }, [document])

  const scale = Math.max(5, Math.min(11, Math.floor(410 / document.width), Math.floor(355 / document.height)))
  useEffect(() => {
    const rendered = renderIndexedPixelDocument(draft, scale)
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = rendered.width
    canvas.height = rendered.height
    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(rendered, 0, 0)
    if (grid) {
      context.strokeStyle = 'rgba(31, 43, 48, .13)'
      context.lineWidth = 1
      for (let x = 0; x <= canvas.width; x += scale) {
        context.beginPath(); context.moveTo(x + 0.5, 0); context.lineTo(x + 0.5, canvas.height); context.stroke()
      }
      for (let y = 0; y <= canvas.height; y += scale) {
        context.beginPath(); context.moveTo(0, y + 0.5); context.lineTo(canvas.width, y + 0.5); context.stroke()
      }
    }
  }, [draft, grid, scale])

  const coordinate = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(document.width - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * document.width))),
      y: Math.max(0, Math.min(document.height - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * document.height))),
    }
  }

  const paint = (source, point, index = paletteIndex) => replacePixel(source, point.x, point.y, index, brushSize, mirror)

  const handleDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = coordinate(event)
    if (tool === 'picker') {
      const selected = decodePixelRuns(draftRef.current)[point.y * document.width + point.x]
      if (selected) setPaletteIndex(selected)
      return
    }
    if (tool === 'fill') {
      const next = floodFillPixel(draftRef.current, point.x, point.y, paletteIndex)
      draftRef.current = next
      setDraft(next)
      onCommit(next, '填充已记录')
      return
    }
    dragRef.current = { start: point, initial: draftRef.current }
    if (tool === 'brush' || tool === 'eraser') {
      const next = paint(draftRef.current, point, tool === 'eraser' ? 0 : paletteIndex)
      draftRef.current = next
      setDraft(next)
    }
  }

  const handleMove = (event) => {
    if (!dragRef.current || !event.buttons || !['brush', 'eraser'].includes(tool)) return
    const next = paint(draftRef.current, coordinate(event), tool === 'eraser' ? 0 : paletteIndex)
    draftRef.current = next
    setDraft(next)
  }

  const handleUp = (event) => {
    if (!dragRef.current) return
    const end = coordinate(event)
    let next = draftRef.current
    if (tool === 'line') {
      next = dragRef.current.initial
      lineCoordinates(dragRef.current.start, end).forEach((point) => { next = paint(next, point) })
    }
    if (tool === 'rect') {
      next = dragRef.current.initial
      const minX = Math.min(dragRef.current.start.x, end.x); const maxX = Math.max(dragRef.current.start.x, end.x)
      const minY = Math.min(dragRef.current.start.y, end.y); const maxY = Math.max(dragRef.current.start.y, end.y)
      for (let x = minX; x <= maxX; x += 1) { next = paint(next, { x, y: minY }); next = paint(next, { x, y: maxY }) }
      for (let y = minY; y <= maxY; y += 1) { next = paint(next, { x: minX, y }); next = paint(next, { x: maxX, y }) }
    }
    dragRef.current = null
    draftRef.current = next
    setDraft(next)
    onCommit(next, '像素修改已记录')
  }

  const addColor = () => {
    const normalized = customColor.toUpperCase()
    const existing = draft.palette.indexOf(normalized)
    if (existing >= 0) { setPaletteIndex(existing); return }
    if (draft.palette.filter(Boolean).length >= 16) return
    const next = { ...draft, palette: [...draft.palette, normalized] }
    draftRef.current = next
    setDraft(next)
    setPaletteIndex(next.palette.length - 1)
    onCommit(next, '已加入调色板')
  }

  return <div className="kit-pixel-editor">
    <div className="kit-editor-toolbar">
      <div className="kit-tool-grid">
        {TOOL_LABELS.map(([id, label]) => <button type="button" key={id} className={tool === id ? 'is-active' : ''} onClick={() => setTool(id)}>{label}</button>)}
      </div>
      <div className="kit-history-buttons">
        <button type="button" disabled={!canUndo} onClick={onUndo}>撤销</button>
        <button type="button" disabled={!canRedo} onClick={onRedo}>重做</button>
        <button type="button" onClick={onReset}>恢复模板</button>
      </div>
    </div>
    <div className="kit-editor-options">
      <label>笔刷 <select value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))}><option>1</option><option>2</option><option>3</option></select></label>
      <label><input type="checkbox" checked={mirror} onChange={(event) => setMirror(event.target.checked)} /> 镜像</label>
      <label><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} /> 网格</label>
      <span>{document.width}×{document.height}</span>
    </div>
    <div className="kit-palette">
      {draft.palette.map((color, index) => <button
        type="button" key={`${color}-${index}`} className={index === paletteIndex ? 'is-active' : ''}
        style={{ '--swatch': color || 'transparent' }} title={color || '透明'} onClick={() => setPaletteIndex(index)}
      />)}
      <input type="color" value={customColor} onChange={(event) => setCustomColor(event.target.value)} />
      <button type="button" disabled={draft.palette.filter(Boolean).length >= 16} onClick={addColor}>加入</button>
    </div>
    <div className="kit-editor-canvas-shell">
      <canvas ref={canvasRef} onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} />
    </div>
  </div>
}

function buildRuntimePreviewRecipe(project, number) {
  const goalkeeper = project.entry.kitType === 'goalkeeper'
  const recipe = createDefaultStudioRecipe({
    teamId: project.entry.teamId,
    kitType: project.entry.kitType,
    role: goalkeeper ? 'goalkeeper' : 'outfield',
    playerId: `kit-studio-${project.entry.teamId}-${project.entry.kitType}`,
    number,
  })
  const dataUrls = Object.fromEntries(Object.entries(project.slots).map(([slotId, document]) => [slotId, renderIndexedPixelDocument(document).toDataURL('image/png')]))
  const playerRoot = `/pixel/player/happyseed-human-v4/${goalkeeper ? 'france-goalkeeper' : 'france-outfield'}`
  const parts = {
    ...dataUrls,
    chest_shirt: dataUrls.shirt_front,
    arm_left_sleeve: dataUrls.sleeve_left,
    arm_right_sleeve: dataUrls.sleeve_right,
    pelvis_shorts: dataUrls.shorts,
    leg_left_shorts: dataUrls.shorts_leg,
    leg_right_shorts: dataUrls.shorts_leg,
    leg_left_sock: dataUrls.socks,
    leg_right_sock: dataUrls.socks,
    leg_left_shoe: dataUrls.shoes,
    leg_right_shoe: dataUrls.shoes,
    hand_left_glove: dataUrls.hand_left,
    hand_right_glove: dataUrls.hand_right,
  }
  return buildStudioRuntimeRecipe(recipe, {
    playerRoot,
    kitRoot: `studio-kit-pixels://${project.entry.teamId}/${project.entry.kitType}`,
    number: `/pixel/numbers/happyseed-human-v4/${number}.png`,
    headFront: `${playerRoot}/head_front.png`,
    headBack: `${playerRoot}/head_back.png`,
    parts,
  })
}

function captureCenteredRuntimePlayer(view, runtimeWindow) {
  const cropWidth = Math.min(300, view.width)
  const cropHeight = Math.min(240, view.height)
  const playerBounds = runtimeWindow.__matchGame?.stadium?._happySeedHumanRefs?.[0]?.renderer?.getBounds?.()
  const centerX = Number.isFinite(playerBounds?.x) ? playerBounds.x + playerBounds.width / 2 : view.width / 2
  const centerY = Number.isFinite(playerBounds?.y) ? playerBounds.y + playerBounds.height / 2 : view.height / 2
  const sourceX = Math.max(0, Math.min(view.width - cropWidth, Math.floor(centerX - cropWidth / 2)))
  const sourceY = Math.max(0, Math.min(view.height - cropHeight, Math.floor(centerY - cropHeight / 2)))
  const output = document.createElement('canvas')
  output.width = cropWidth
  output.height = cropHeight
  const context = output.getContext('2d')
  context.imageSmoothingEnabled = false
  context.drawImage(view, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
  return output.toDataURL('image/png')
}

const RuntimeKitStill = memo(function RuntimeKitStill({ project, number }) {
  const frameRef = useRef(null)
  const [revision, setRevision] = useState(0)
  const [snapshots, setSnapshots] = useState({ front: '', back: '' })
  const [status, setStatus] = useState('编译真实骨架…')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      sessionStorage.setItem('happyseed-player-studio-preview', JSON.stringify(buildRuntimePreviewRecipe(project, number)))
      setSnapshots({ front: '', back: '' })
      setStatus('正在生成正背面待机图…')
      setRevision((value) => value + 1)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [number, project])

  useEffect(() => {
    if (!revision) return undefined
    let cancelled = false
    let attempts = 0
    const timer = window.setInterval(() => {
      attempts += 1
      const runtimeWindow = frameRef.current?.contentWindow
      const api = runtimeWindow?.__happySeedHumanSlice
      if (api?.setAction) {
        window.clearInterval(timer)
        const capture = async () => {
          try {
            runtimeWindow.__introStart = 0
            runtimeWindow.__matchZoom?.set?.(1.2)
            api.setAutoCycle(false)
            api.setAction('idle')
            // The formal Runtime eases its real camera zoom. Wait for that camera to
            // settle so front/back are captured at the same scale.
            await new Promise((resolve) => window.setTimeout(resolve, 2600))
            const take = async (facing) => {
              api.setFacing(facing)
              await new Promise((resolve) => window.setTimeout(resolve, 640))
              const view = runtimeWindow.__matchGame?.renderer?.view
              if (!view?.toDataURL) throw new Error('Runtime 画布未就绪')
              return captureCenteredRuntimePlayer(view, runtimeWindow)
            }
            const front = await take('front')
            const back = await take('back')
            api.setFacing('front')
            if (!cancelled) { setSnapshots({ front, back }); setStatus('真实 Runtime 已同步') }
          } catch (error) {
            if (!cancelled) setStatus(error.message)
          }
        }
        capture()
      } else if (attempts > 160) {
        window.clearInterval(timer)
        setStatus('Runtime 启动超时')
      }
    }, 100)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [revision])

  return <section className="kit-runtime-still">
    <header><div><span>REAL MATCH RUNTIME</span><strong>真实骨架正背面</strong></div><small>{status}</small></header>
    <div className="kit-runtime-images">
      {['front', 'back'].map((facing) => <figure key={facing}>
        <figcaption>{facing === 'front' ? '正面' : '背面'}</figcaption>
        {snapshots[facing] ? <img src={snapshots[facing]} alt={`真实 Runtime ${facing}`} /> : <div>生成中…</div>}
      </figure>)}
    </div>
    <iframe key={revision} ref={frameRef} className="kit-runtime-capture" title="真实比赛 Runtime 球衣验收" src={`/happyseed-runtime-lab.html?studio=1&solo=1&still=1&revision=${revision}`} />
  </section>
})

export default function PixelKitStudio() {
  const [catalog, setCatalog] = useState([])
  const [teamId, setTeamId] = useState('spain')
  const [kitType, setKitType] = useState('home')
  const [project, setProject] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState('shirt_front')
  const [assetName, setAssetName] = useState('spain-home')
  const [number, setNumber] = useState(10)
  const [status, setStatus] = useState('正在读取32套球衣模板…')
  const [history, setHistory] = useState({ undo: 0, redo: 0 })
  const [rosterImport, setRosterImport] = useState(null)
  const undoRef = useRef([])
  const redoRef = useRef([])
  const importRef = useRef(null)

  useEffect(() => {
    fetch('/pixel/kit-studio/catalog.json')
      .then((response) => { if (!response.ok) throw new Error('球衣目录不存在'); return response.json() })
      .then((payload) => setCatalog(payload.kits || []))
      .catch((error) => setStatus(error.message))
  }, [])

  const selectedEntry = useMemo(() => catalog.find((entry) => entry.teamId === teamId && entry.kitType === kitType), [catalog, kitType, teamId])
  const installEntry = useCallback(async (entry) => {
    if (!entry) return
    setStatus(`正在载入${entry.teamName}${entry.label}…`)
    try {
      const loaded = await loadKitProject(entry)
      setProject(loaded)
      setSelectedSlot('shirt_front')
      setAssetName(`${entry.teamId}-${entry.kitType}`)
      undoRef.current = []; redoRef.current = []; setHistory({ undo: 0, redo: 0 })
      setStatus(`${entry.teamName} · ${entry.label} · 金标通过`)
    } catch (error) {
      setStatus(`载入失败：${error.message}`)
    }
  }, [])

  useEffect(() => { installEntry(selectedEntry) }, [installEntry, selectedEntry])

  const commitProject = useCallback((nextOrUpdater, message) => {
    if (!project) return
    undoRef.current = [...undoRef.current.slice(-99), structuredClone(project)]
    redoRef.current = []
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(structuredClone(project)) : nextOrUpdater
    setProject(next)
    setHistory({ undo: undoRef.current.length, redo: 0 })
    setStatus(message)
  }, [project])

  const undo = () => {
    const previous = undoRef.current.pop()
    if (!previous || !project) return
    redoRef.current.push(structuredClone(project)); setProject(previous)
    setHistory({ undo: undoRef.current.length, redo: redoRef.current.length }); setStatus('已撤销')
  }
  const redo = () => {
    const next = redoRef.current.pop()
    if (!next || !project) return
    undoRef.current.push(structuredClone(project)); setProject(next)
    setHistory({ undo: undoRef.current.length, redo: redoRef.current.length }); setStatus('已重做')
  }

  const resetSlot = () => commitProject((draft) => {
    draft.slots[selectedSlot] = structuredClone(draft.baseSlots[selectedSlot])
    return draft
  }, `${KIT_SLOT_LABELS[selectedSlot]}已恢复模板`)

  const importRoster = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      setRosterImport({ file, image, url })
      setStatus('大名单已载入：请选择第1、2或第3格')
    }
    image.onerror = () => { URL.revokeObjectURL(url); setStatus('无法读取大名单图') }
    image.src = url
    event.target.value = ''
  }

  const applyRosterColumn = (column) => {
    if (!rosterImport || !project) return
    try {
      const next = compileRosterSelection(rosterImport.image, column, project, number)
      next.importedSourceName = rosterImport.file.name
      commitProject(next, `已从第${column + 1}格提取球衣，可继续逐像素修片`)
      setRosterImport(null)
    } catch (error) {
      setStatus(`提取失败：${error.message}`)
    }
  }

  const audit = useMemo(() => project ? auditKitProject(project) : null, [project])
  if (!project) return <main className="pixel-kit-studio is-loading"><div><strong>球衣模板工作流</strong><span>{status}</span></div></main>

  const allowedSlots = project.entry.kitType === 'goalkeeper' ? KIT_SLOT_ORDER : KIT_SLOT_ORDER.slice(0, 8)
  const team = STUDIO_TEAMS.find((item) => item.id === teamId)

  return <main className="pixel-kit-studio">
    <header className="kit-topbar">
      <div className="kit-brand"><span>HAPPYSEED / KIT PIPELINE</span><strong>16×2 球衣工作台</strong></div>
      <div className="kit-top-fields">
        <label>球队<select value={teamId} onChange={(event) => setTeamId(event.target.value)}>{STUDIO_TEAMS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="kit-type-toggle"><button type="button" className={kitType === 'home' ? 'is-active' : ''} onClick={() => setKitType('home')}>普通球员</button><button type="button" className={kitType === 'goalkeeper' ? 'is-active' : ''} onClick={() => setKitType('goalkeeper')}>门将</button></div>
        <label className="kit-name-field">导出名称<input value={assetName} onChange={(event) => setAssetName(event.target.value)} /></label>
        <label className="kit-number-field">号码<input type="number" min="1" max="99" value={number} onChange={(event) => setNumber(Math.max(1, Math.min(99, Number(event.target.value) || 1)))} /></label>
      </div>
      <div className="kit-top-actions">
        <button type="button" disabled={!history.undo} onClick={undo}>撤销</button>
        <button type="button" disabled={!history.redo} onClick={redo}>重做</button>
        <button type="button" onClick={() => downloadKitSlotPng(project, selectedSlot, assetName)}>当前 PNG</button>
        <button type="button" onClick={() => downloadKitPixelJson(project, assetName)}>像素数据</button>
        <button type="button" className="is-primary" onClick={() => downloadKitPngPack(project, assetName)}>导出整套</button>
      </div>
    </header>

    <div className="kit-workspace">
      <aside className="kit-library">
        <div className="kit-panel-heading"><span>01 / 资产清单</span><strong>16队 · 32套</strong><small>新西兰已排除</small></div>
        <div className="kit-team-list">
          {STUDIO_TEAMS.map((item) => {
            const home = catalog.find((entry) => entry.teamId === item.id && entry.kitType === 'home')
            const goalkeeper = catalog.find((entry) => entry.teamId === item.id && entry.kitType === 'goalkeeper')
            return <button type="button" key={item.id} className={teamId === item.id ? 'is-active' : ''} onClick={() => setTeamId(item.id)}>
              <strong>{item.name}</strong><span>{item.code}</span>
              <i className={home?.status === 'gold-pass' ? 'is-pass' : ''}>普通</i><i className={goalkeeper?.status === 'gold-pass' ? 'is-pass' : ''}>门将</i>
            </button>
          })}
        </div>
        <div className="kit-source-block">
          <div><span>当前来源</span><strong>{project.entry.source.kind === 'download-roster' ? '下载目录大名单' : '原9队立绘'}</strong></div>
          <img src={project.sourceReference} alt={`${team?.name}${project.entry.label}来源球员`} />
          <small>{project.entry.source.path}</small>
          <button type="button" onClick={() => importRef.current.click()}>导入新的大名单图</button>
          <input ref={importRef} hidden type="file" accept="image/*" onChange={importRoster} />
        </div>
        {rosterImport && <div className="kit-roster-import">
          <span>选择第一行球员</span><img src={rosterImport.url} alt="待提取大名单" />
          <div><button type="button" onClick={() => applyRosterColumn(0)}>门将 1</button><button type="button" onClick={() => applyRosterColumn(1)}>门将 2</button><button type="button" onClick={() => applyRosterColumn(2)}>普通 3</button></div>
        </div>}
      </aside>

      <section className="kit-stage">
        <div className="kit-stage-heading">
          <div><span>02 / 金标框架</span><h1>{team?.name} · {project.entry.label}</h1><p>直接裁切来源球衣；金标只约束插槽尺寸、可见区与脚底锚点，不重绘原图。</p></div>
          <div className={`kit-audit-badge ${audit?.passed ? 'is-pass' : 'is-review'}`}><strong>{audit?.passed ? 'GOLD PASS' : '需检查'}</strong><span>{allowedSlots.length} 个插槽 · {(audit.totalBytes / 1024).toFixed(1)} KiB</span></div>
        </div>
        <div className="kit-exploded-view">
          <div className="kit-reference-figure"><span>来源立绘</span><img src={project.sourceReference} alt="来源球员" /></div>
          <div className="kit-slot-board">
            {allowedSlots.map((slotId) => <button type="button" key={slotId} className={selectedSlot === slotId ? 'is-active' : ''} onClick={() => setSelectedSlot(slotId)}>
              <span className="kit-checker"><PixelCanvas document={project.slots[slotId]} scale={3} /></span>
              <strong>{KIT_SLOT_LABELS[slotId]}</strong>
              <small>{project.slots[slotId].width}×{project.slots[slotId].height}</small>
            </button>)}
          </div>
        </div>
        <RuntimeKitStill project={project} number={number} />
      </section>

      <aside className="kit-inspector">
        <div className="kit-panel-heading"><span>03 / 像素修片</span><strong>{KIT_SLOT_LABELS[selectedSlot]}</strong><small>最多16色 · 无半透明边</small></div>
        <div className="kit-slot-audit-row">
          <span>{project.slots[selectedSlot].width}×{project.slots[selectedSlot].height}</span>
          <span>{project.slots[selectedSlot].palette.filter(Boolean).length}/16 色</span>
          <span>{audit.files.find((file) => file.slotId === selectedSlot)?.opaquePixels} 像素</span>
        </div>
        <PixelKitEditor
          document={project.slots[selectedSlot]}
          onCommit={(document, message) => commitProject((draft) => { draft.slots[selectedSlot] = document; return draft }, message)}
          onUndo={undo} onRedo={redo} onReset={resetSlot}
          canUndo={Boolean(history.undo)} canRedo={Boolean(history.redo)}
        />
        <div className="kit-export-contract">
          <span>04 / 输出合同</span><strong>{assetName || '请输入名称'}</strong>
          <dl><div><dt>Schema</dt><dd>happyseed-kit-pixels-v1</dd></div><div><dt>Part set</dt><dd>happyseed-human-v4</dd></div><div><dt>锚点</dt><dd>root-footline</dd></div><div><dt>平滑</dt><dd>禁止</dd></div></dl>
        </div>
      </aside>
    </div>
    <footer className="kit-statusbar"><span>{status}</span><span>{team?.code} / {kitType.toUpperCase()} / {selectedSlot}</span></footer>
  </main>
}
