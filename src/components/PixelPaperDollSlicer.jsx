import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STUDIO_TEAMS, getStudioTeam } from '../pixelStudio/catalog.js'
import {
  DEFAULT_SOURCE_SEGMENTS,
  PAPER_DOLL_PIXEL_SCHEMA,
  SOURCE_SLOT_LABELS,
  countLightBoundaryPixels,
  countOpaquePixels,
  floodFillPixel,
  imageToIndexedPixelDocument,
  pixelDocumentBytes,
  renderIndexedPixelDocument,
  replacePixel,
  slicePaperDollPixelDocuments,
  synthesizeShirtBack,
} from '../pixelStudio/imageSlicer.js'
import {
  STUDIO_SLOT_SIZES,
  buildStudioRuntimeRecipe,
  createDefaultStudioRecipe,
} from '../pixelStudio/model.js'
import { downloadBytes } from '../pixelStudio/exporter.js'
import { renderStudioSlot } from '../pixelStudio/renderer.js'

const DEFAULT_REFERENCE = '/assets/法国/法国超跑.png'
const SLOT_ORDER = [
  'head_front', 'shirt_front', 'sleeve_left', 'sleeve_right', 'arm_left', 'arm_right',
  'hand_left', 'hand_right', 'shorts', 'shorts_leg', 'knee', 'socks', 'shoes',
  'head_back', 'shirt_back', 'hand_left_glove', 'hand_right_glove', 'neck',
]

const RUNTIME_GOLD_PARTS = Object.freeze([
  ['head_front', '头部正面', '/pixel/player/happyseed-human-v4/france-outfield/head_front.png'],
  ['head_back', '头部背面', '/pixel/player/happyseed-human-v4/france-outfield/head_back.png'],
  ['arm_left', '左臂', '/pixel/player/happyseed-human-v4/france-outfield/arm_left.png'],
  ['arm_right', '右臂', '/pixel/player/happyseed-human-v4/france-outfield/arm_right.png'],
  ['hand_left', '左手', '/pixel/player/happyseed-human-v4/france-outfield/hand_left.png'],
  ['hand_right', '右手', '/pixel/player/happyseed-human-v4/france-outfield/hand_right.png'],
  ['knee', '腿部', '/pixel/player/happyseed-human-v4/france-outfield/knee.png'],
  ['neck', '颈部', '/pixel/player/happyseed-human-v4/france-outfield/neck.png'],
  ['shirt_front', '球衣正面', '/pixel/kits/france/home/happyseed-human-v4/shirt_front.png'],
  ['shirt_back', '球衣背面', '/pixel/kits/france/home/happyseed-human-v4/shirt_back.png'],
  ['sleeve_left', '左袖', '/pixel/kits/france/home/happyseed-human-v4/sleeve_left.png'],
  ['sleeve_right', '右袖', '/pixel/kits/france/home/happyseed-human-v4/sleeve_right.png'],
  ['shorts', '球裤腰', '/pixel/kits/france/home/happyseed-human-v4/shorts.png'],
  ['shorts_leg', '裤腿', '/pixel/kits/france/home/happyseed-human-v4/shorts_leg.png'],
  ['socks', '球袜', '/pixel/kits/france/home/happyseed-human-v4/socks.png'],
  ['shoes', '球鞋', '/pixel/kits/france/home/happyseed-human-v4/shoes.png'],
  ['number', '号码 10', '/pixel/numbers/happyseed-human-v4/10.png'],
])

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法读取立绘图片'))
    image.src = url
  })
}

function buildProject(front, back = null, segments = DEFAULT_SOURCE_SEGMENTS, number = 10) {
  const normalizedSegments = Object.fromEntries(Object.entries(segments).map(([key, value]) => [key, { ...value }]))
  const slots = slicePaperDollPixelDocuments(front, back, normalizedSegments, { number })
  return { front, back, segments: normalizedSegments, slots, baseSlots: slots }
}

const PixelDocumentCanvas = memo(function PixelDocumentCanvas({ pixelDocument, className = '', scale = 1, label = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!pixelDocument || !ref.current) return
    const rendered = renderIndexedPixelDocument(pixelDocument, scale)
    ref.current.width = rendered.width
    ref.current.height = rendered.height
    const context = ref.current.getContext('2d')
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, rendered.width, rendered.height)
    context.drawImage(rendered, 0, 0)
  }, [pixelDocument, scale])
  return <canvas ref={ref} className={className} aria-label={label} />
})

const RuntimeGoldReference = memo(function RuntimeGoldReference({ boundaryWhitePixels, onSelect }) {
  return <section className="doll-runtime-gold" aria-label="当前比赛球员金标拆分示范">
    <div className="doll-runtime-gold-heading">
      <div><span>HAPPYSEED-HUMAN-V4 / READ ONLY</span><strong>当前比赛球员 · 金标拆分示范</strong></div>
      <div className="doll-white-edge-audit">
        <strong>{boundaryWhitePixels}</strong>
        <span>源图外缘白色像素</span>
      </div>
    </div>
    <div className="doll-white-edge-explainer">
      <span>白边来源：上传立绘与旧金标母版中的真实像素</span>
      <span>Runtime 描边滤镜：无</span>
      <span>草地高对比 + 最近邻放大后更明显</span>
    </div>
    <div className="doll-runtime-gold-grid">
      {RUNTIME_GOLD_PARTS.map(([slotId, label, path]) => {
        const size = STUDIO_SLOT_SIZES[slotId]
        return <button type="button" key={slotId} className={slotId === 'number' ? 'is-static' : ''} onClick={() => slotId !== 'number' && onSelect(slotId)}>
          <span className="doll-gold-checker"><img src={path} alt={`${label}金标部件`} /></span>
          <strong>{label}</strong>
          <small>{size?.join('×') || '33×18'} · Runtime</small>
        </button>
      })}
    </div>
    <p>点击任一金标部件，会跳到右侧同名插槽进行逐像素对照。示范资源来自比赛当前加载路径，不参与当前球员导出。</p>
  </section>
})

function compileRuntimePreview(project, recipe) {
  const sourceParts = Object.fromEntries(Object.entries(project.slots).map(([slotId, document]) => (
    [slotId, renderIndexedPixelDocument(document).toDataURL('image/png')]
  )))
  const parts = {
    ...sourceParts,
    chest_shirt: sourceParts.shirt_front,
    arm_left_sleeve: sourceParts.sleeve_left,
    arm_right_sleeve: sourceParts.sleeve_right,
    pelvis_shorts: sourceParts.shorts,
    leg_left_shorts: sourceParts.shorts_leg,
    leg_right_shorts: sourceParts.shorts_leg,
    leg_left_knee: sourceParts.knee,
    leg_right_knee: sourceParts.knee,
    leg_left_sock: sourceParts.socks,
    leg_right_sock: sourceParts.socks,
    leg_left_shoe: sourceParts.shoes,
    leg_right_shoe: sourceParts.shoes,
  }
  const number = renderStudioSlot(recipe, 'number').toDataURL('image/png')
  parts.number = number
  return buildStudioRuntimeRecipe(recipe, {
    playerRoot: 'studio-indexed-pixels://player',
    kitRoot: 'studio-indexed-pixels://kit',
    number,
    headFront: sourceParts.head_front,
    headBack: sourceParts.head_back,
    parts,
  })
}

const TrueMatchRuntimePreview = memo(function TrueMatchRuntimePreview({ project, recipe }) {
  const iframeRef = useRef(null)
  const [revision, setRevision] = useState(0)
  const [snapshots, setSnapshots] = useState({ front: '', back: '' })
  const [runtimeStatus, setRuntimeStatus] = useState('正在编译当前插槽…')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const runtimeRecipe = compileRuntimePreview(project, recipe)
      sessionStorage.setItem('happyseed-player-studio-preview', JSON.stringify(runtimeRecipe))
      setSnapshots({ front: '', back: '' })
      setRuntimeStatus('正在用真实比赛 Runtime 生成正背面图片…')
      setRevision((value) => value + 1)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [project, recipe])

  useEffect(() => {
    if (!revision) return undefined
    let cancelled = false
    let attempts = 0
    const timer = window.setInterval(() => {
      attempts += 1
      const runtimeWindow = iframeRef.current?.contentWindow
      const api = runtimeWindow?.__happySeedHumanSlice
      if (api?.setAction) {
        window.clearInterval(timer)
        const capture = async () => {
          try {
            runtimeWindow.__introStart = 0
            runtimeWindow.__matchZoom?.set?.(1.2)
            api.setAutoCycle(false)
            api.setAction('idle')
            const takeSnapshot = async (facing) => {
              api.setFacing(facing)
              await new Promise((resolve) => window.setTimeout(resolve, 650))
              const view = runtimeWindow.__matchGame?.renderer?.view
              if (!view?.toDataURL) throw new Error('比赛画布尚未就绪')
              return view.toDataURL('image/png')
            }
            const front = await takeSnapshot('front')
            const back = await takeSnapshot('back')
            api.setFacing('front')
            if (!cancelled) {
              setSnapshots({ front, back })
              setRuntimeStatus('已从真实比赛球场生成待机正面与背面')
            }
          } catch (error) {
            if (!cancelled) setRuntimeStatus(error.message || '比赛图片生成失败')
          }
        }
        capture()
      } else if (attempts > 160) {
        setRuntimeStatus('真实 Runtime 启动超时，请重新载入图片')
        window.clearInterval(timer)
      }
    }, 100)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [revision])

  return <div className="doll-solo-preview">
    <div className="doll-solo-toolbar">
      <div><span>真实比赛 Runtime · 静态验收图</span><strong>{runtimeStatus}</strong></div>
      <small>只检查待机纸娃娃；动作继续使用现有 Spine</small>
    </div>
    <div className="doll-runtime-still-grid">
      {['front', 'back'].map((facing) => <figure key={facing}>
        <figcaption><strong>{facing === 'front' ? '正面' : '背面'}</strong><span>比赛球场 · 待机</span></figcaption>
        {snapshots[facing]
          ? <img src={snapshots[facing]} alt={`真实比赛球场中的球员${facing === 'front' ? '正面' : '背面'}待机图`} />
          : <div className="doll-runtime-still-loading">正在生成…</div>}
      </figure>)}
    </div>
    {revision > 0 && <iframe
      key={revision}
      ref={iframeRef}
      className="doll-runtime-capture-frame"
      title="真实比赛 Runtime 静态图片生成器"
      src={`/happyseed-runtime-lab.html?studio=1&solo=1&still=1&revision=${revision}`}
      aria-hidden="true"
      tabIndex="-1"
    />}
  </div>
})

function PixelSlotEditor({ pixelDocument, onCommit, onUndo, onRedo, onReset, canUndo, canRedo }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const draftRef = useRef(pixelDocument)
  const [draft, setDraft] = useState(pixelDocument)
  const [tool, setTool] = useState('brush')
  const [paletteIndex, setPaletteIndex] = useState(1)
  const [brushSize, setBrushSize] = useState(1)
  const [mirror, setMirror] = useState(false)

  useEffect(() => {
    draftRef.current = pixelDocument
    setDraft(pixelDocument)
    setPaletteIndex((current) => Math.min(current, Math.max(1, pixelDocument.palette.length - 1)))
  }, [pixelDocument])

  const scale = Math.max(4, Math.min(10, Math.floor(430 / pixelDocument.width), Math.floor(370 / pixelDocument.height)))
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
    context.strokeStyle = 'rgba(20, 25, 29, .12)'
    context.lineWidth = 1
    for (let x = 0; x <= canvas.width; x += scale) {
      context.beginPath(); context.moveTo(x + 0.5, 0); context.lineTo(x + 0.5, canvas.height); context.stroke()
    }
    for (let y = 0; y <= canvas.height; y += scale) {
      context.beginPath(); context.moveTo(0, y + 0.5); context.lineTo(canvas.width, y + 0.5); context.stroke()
    }
  }, [draft, scale])

  const coordinate = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(pixelDocument.width - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * pixelDocument.width))),
      y: Math.max(0, Math.min(pixelDocument.height - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * pixelDocument.height))),
    }
  }

  const paint = (position) => {
    const next = replacePixel(
      draftRef.current,
      position.x,
      position.y,
      tool === 'eraser' ? 0 : paletteIndex,
      brushSize,
      mirror,
    )
    draftRef.current = next
    setDraft(next)
  }

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const position = coordinate(event)
    if (tool === 'fill') {
      const next = floodFillPixel(draftRef.current, position.x, position.y, paletteIndex)
      draftRef.current = next
      setDraft(next)
      onCommit(next, '填充已记录，可撤销')
      return
    }
    drawingRef.current = true
    paint(position)
  }

  const handlePointerMove = (event) => {
    if (drawingRef.current && event.buttons) paint(coordinate(event))
  }

  const handlePointerUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    onCommit(draftRef.current, '画笔修改已记录，可撤销')
  }

  return <div className="doll-pixel-editor">
    <div className="doll-editor-actions">
      <div className="doll-segmented-control">
        <button type="button" className={tool === 'brush' ? 'is-active' : ''} onClick={() => setTool('brush')}>画笔</button>
        <button type="button" className={tool === 'eraser' ? 'is-active' : ''} onClick={() => setTool('eraser')}>橡皮</button>
        <button type="button" className={tool === 'fill' ? 'is-active' : ''} onClick={() => setTool('fill')}>填充</button>
      </div>
      <div className="doll-history-actions">
        <button type="button" disabled={!canUndo} onClick={onUndo}>撤销</button>
        <button type="button" disabled={!canRedo} onClick={onRedo}>重做</button>
        <button type="button" onClick={onReset}>恢复源切片</button>
      </div>
    </div>
    <div className="doll-editor-options">
      <label>笔刷 <select value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))}><option>1</option><option>2</option><option>3</option></select></label>
      <label><input type="checkbox" checked={mirror} onChange={(event) => setMirror(event.target.checked)} /> 左右镜像</label>
      <span>{pixelDocument.width}×{pixelDocument.height}</span>
    </div>
    <div className="doll-palette">
      {pixelDocument.palette.map((color, index) => <button
        type="button"
        key={`${color}-${index}`}
        className={paletteIndex === index ? 'is-active' : ''}
        style={{ '--pixel-color': color || 'transparent' }}
        aria-label={index === 0 ? '透明' : color}
        onClick={() => setPaletteIndex(index)}
      />)}
    </div>
    <div className="doll-editor-canvas-shell">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="插槽像素编辑器"
      />
    </div>
  </div>
}

export default function PixelPaperDollSlicer({ onOpenComposer }) {
  const [recipe, setRecipe] = useState(() => createDefaultStudioRecipe())
  const [project, setProject] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState('head_front')
  const [targetWidth, setTargetWidth] = useState(64)
  const [maxColors, setMaxColors] = useState(16)
  const [sourceName, setSourceName] = useState('法国超跑.png')
  const [status, setStatus] = useState('正在载入现有法国立绘…')
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 })
  const frontImageRef = useRef(null)
  const backImageRef = useRef(null)
  const frontInputRef = useRef(null)
  const backInputRef = useRef(null)
  const sourceWrapRef = useRef(null)
  const dragRef = useRef(null)
  const undoRef = useRef([])
  const redoRef = useRef([])

  const installImages = useCallback((frontImage, backImage = backImageRef.current, name = 'player.png') => {
    const front = imageToIndexedPixelDocument(frontImage, { targetWidth, maxColors })
    const back = backImage ? imageToIndexedPixelDocument(backImage, { targetWidth, maxColors }) : null
    frontImageRef.current = frontImage
    backImageRef.current = backImage
    setProject(buildProject(front, back, DEFAULT_SOURCE_SEGMENTS, recipe.number))
    undoRef.current = []
    redoRef.current = []
    setHistoryCounts({ undo: 0, redo: 0 })
    setSourceName(name)
    setStatus(`已降维为 ${front.width}×${front.height} 像素点 · ${front.palette.length - 1} 色`)
  }, [maxColors, recipe.number, targetWidth])

  useEffect(() => {
    let cancelled = false
    loadImage(DEFAULT_REFERENCE).then((image) => {
      if (cancelled) return
      const front = imageToIndexedPixelDocument(image, { targetWidth: 64, maxColors: 16 })
      frontImageRef.current = image
      setProject(buildProject(front, null, DEFAULT_SOURCE_SEGMENTS, 10))
      setStatus(`已降维为 ${front.width}×${front.height} 像素点 · ${front.palette.length - 1} 色`)
    }).catch((error) => setStatus(error.message))
    return () => { cancelled = true }
  }, [])

  const commitProject = useCallback((updater, message) => {
    if (!project) return
    undoRef.current = [...undoRef.current.slice(-99), project]
    redoRef.current = []
    setHistoryCounts({ undo: undoRef.current.length, redo: 0 })
    setProject(typeof updater === 'function' ? updater(project) : updater)
    setStatus(message)
  }, [project])

  const undo = () => {
    const previous = undoRef.current.pop()
    if (!previous || !project) return
    redoRef.current.push(project)
    setProject(previous)
    setHistoryCounts({ undo: undoRef.current.length, redo: redoRef.current.length })
    setStatus('已撤销')
  }

  const redo = () => {
    const next = redoRef.current.pop()
    if (!next || !project) return
    undoRef.current.push(project)
    setProject(next)
    setHistoryCounts({ undo: undoRef.current.length, redo: redoRef.current.length })
    setStatus('已重做')
  }

  const importImage = async (event, facing) => {
    const file = event.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    try {
      const image = await loadImage(url)
      if (facing === 'front') installImages(image, backImageRef.current, file.name)
      else {
        backImageRef.current = image
        const back = imageToIndexedPixelDocument(image, { targetWidth, maxColors })
        commitProject((current) => buildProject(current.front, back, current.segments, recipe.number), '背面立绘已载入，自动背面已替换为精修背面')
      }
    } catch (error) {
      setStatus(error.message)
    } finally {
      URL.revokeObjectURL(url)
      event.target.value = ''
    }
  }

  const updateSegment = (slotId, field, value) => commitProject((current) => {
    const segment = { ...current.segments[slotId], [field]: Number(value) }
    const segments = { ...current.segments, [slotId]: segment }
    const slots = slicePaperDollPixelDocuments(current.front, current.back, segments, { number: recipe.number })
    return { ...current, segments, slots, baseSlots: slots }
  }, `${SOURCE_SLOT_LABELS[slotId]}切片框已更新`)

  const handleSegmentPointerDown = (event, slotId) => {
    if (!project || !sourceWrapRef.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    undoRef.current = [...undoRef.current.slice(-99), project]
    redoRef.current = []
    setHistoryCounts({ undo: undoRef.current.length, redo: 0 })
    dragRef.current = {
      slotId,
      startX: event.clientX,
      startY: event.clientY,
      segment: project.segments[slotId],
      bounds: sourceWrapRef.current.getBoundingClientRect(),
    }
    setSelectedSlot(slotId)
  }

  const handleSegmentPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag || !event.buttons) return
    const x = Math.max(0, Math.min(1 - drag.segment.width, drag.segment.x + (event.clientX - drag.startX) / drag.bounds.width))
    const y = Math.max(0, Math.min(1 - drag.segment.height, drag.segment.y + (event.clientY - drag.startY) / drag.bounds.height))
    setProject((current) => {
      const segments = { ...current.segments, [drag.slotId]: { ...drag.segment, x, y } }
      const slots = slicePaperDollPixelDocuments(current.front, current.back, segments, { number: recipe.number })
      return { ...current, segments, slots, baseSlots: slots }
    })
  }

  const handleSegmentPointerUp = () => {
    if (!dragRef.current) return
    dragRef.current = null
    setStatus(`${SOURCE_SLOT_LABELS[selectedSlot]}切片框已移动，可撤销`)
  }

  const resetSelectedSlot = () => commitProject((current) => ({
    ...current,
    slots: { ...current.slots, [selectedSlot]: current.baseSlots[selectedSlot] },
  }), `${SOURCE_SLOT_LABELS[selectedSlot]}已恢复为自动切片`)

  const resetAllSegments = () => commitProject((current) => buildProject(current.front, current.back, DEFAULT_SOURCE_SEGMENTS, recipe.number), '全部切片框和手绘修改已重置')

  const updateNumber = (value) => {
    const number = Math.max(1, Math.min(99, Number(value) || 1))
    setRecipe((current) => ({ ...current, number }))
    if (!project?.back) {
      setProject((current) => {
        const shirtBack = synthesizeShirtBack(current.baseSlots.shirt_front, number)
        return {
          ...current,
          slots: { ...current.slots, shirt_back: shirtBack },
          baseSlots: { ...current.baseSlots, shirt_back: shirtBack },
        }
      })
      setStatus(`背面号码已更新为 ${number}`)
    }
  }

  const exportPixelData = () => {
    const team = getStudioTeam(recipe.teamId)
    const payload = {
      schemaVersion: PAPER_DOLL_PIXEL_SCHEMA,
      generatedAt: new Date().toISOString(),
      playerId: recipe.playerId,
      teamId: recipe.teamId,
      partSetId: recipe.partSetId,
      sourceName,
      source: { front: project.front, back: project.back },
      segments: project.segments,
      slots: project.slots,
      runtime: {
        schemaVersion: 'happyseed-human-runtime-recipe-v1',
        skeleton: '/match-runtime-min/data/player.json',
        anchor: 'root-footline',
        slotSizes: STUDIO_SLOT_SIZES,
      },
      audit: {
        hasFront: true,
        hasBack: Boolean(project.back),
        hasExplicitBack: Boolean(project.back),
        backStrategy: project.back ? 'explicit-reference' : 'synthesized-from-front',
        pixelBytes: Object.values(project.slots).reduce((sum, document) => sum + pixelDocumentBytes(document), 0),
      },
    }
    downloadBytes(new TextEncoder().encode(`${JSON.stringify(payload, null, 2)}\n`), `${team.id}-${recipe.playerId}.hspixels.json`, 'application/json')
    setStatus('已导出像素矩阵 JSON；文件中不保存球员整张 PNG')
  }

  const selectedSegment = project?.segments[selectedSlot]
  const pixelStorage = useMemo(() => project
    ? Object.values(project.slots).reduce((sum, document) => sum + pixelDocumentBytes(document), 0)
    : 0, [project])
  const boundaryWhitePixels = useMemo(() => project ? countLightBoundaryPixels(project.front) : 0, [project])

  if (!project) return <main className="paper-doll-slicer is-loading"><div><strong>正在读取现有球员立绘</strong><span>{status}</span></div></main>

  return <main className="paper-doll-slicer">
    <header className="doll-topbar">
      <div className="doll-brand"><span>HAPPYSEED / PLAYER ASSET</span><strong>立绘拆分工作台</strong></div>
      <nav className="doll-mode-switch" aria-label="工作流模式">
        <button type="button" className="is-active">立绘拆分</button>
        <button type="button" onClick={onOpenComposer}>部件组合（旧）</button>
      </nav>
      <div className="doll-identity-fields">
        <label>球队<select value={recipe.teamId} onChange={(event) => setRecipe((current) => ({ ...current, teamId: event.target.value }))}>{STUDIO_TEAMS.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <label>球员 ID<input value={recipe.playerId} onChange={(event) => setRecipe((current) => ({ ...current, playerId: event.target.value }))} /></label>
        <label className="doll-number-field">号码<input type="number" min="1" max="99" value={recipe.number} onChange={(event) => updateNumber(event.target.value)} /></label>
      </div>
      <div className="doll-top-actions">
        <button type="button" disabled={!historyCounts.undo} onClick={undo}>撤销</button>
        <button type="button" disabled={!historyCounts.redo} onClick={redo}>重做</button>
        <button type="button" className="is-primary" onClick={exportPixelData}>导出像素数据</button>
      </div>
    </header>

    <div className="doll-workspace">
      <aside className="doll-source-panel">
        <div className="doll-step-heading"><span>01</span><div><strong>导入现有立绘</strong><small>原图是唯一视觉金标</small></div></div>
        <div className="doll-import-actions">
          <button type="button" onClick={() => frontInputRef.current.click()}>更换正面立绘</button>
          <button type="button" onClick={() => backInputRef.current.click()}>替换自动背面</button>
          <input ref={frontInputRef} hidden type="file" accept="image/*" onChange={(event) => importImage(event, 'front')} />
          <input ref={backInputRef} hidden type="file" accept="image/*" onChange={(event) => importImage(event, 'back')} />
        </div>
        <div className="doll-source-file"><span>{sourceName}</span><strong>{project.front.metadata.sourceWidth}×{project.front.metadata.sourceHeight}</strong></div>

        <div className="doll-step-heading"><span>02</span><div><strong>降维成像素点</strong><small>调色板索引 + RLE，不存整图</small></div></div>
        <label className="doll-range">逻辑宽度 <strong>{targetWidth}px</strong><input type="range" min="40" max="112" step="4" value={targetWidth} onChange={(event) => setTargetWidth(Number(event.target.value))} /></label>
        <label className="doll-range">最大颜色 <strong>{maxColors}</strong><input type="range" min="8" max="24" step="1" value={maxColors} onChange={(event) => setMaxColors(Number(event.target.value))} /></label>
        <button type="button" className="doll-reprocess" onClick={() => installImages(frontImageRef.current, backImageRef.current, sourceName)}>按当前参数重新降维</button>
        <dl className="doll-source-stats">
          <div><dt>像素矩阵</dt><dd>{project.front.width}×{project.front.height}</dd></div>
          <div><dt>调色板</dt><dd>{project.front.palette.length - 1} 色</dd></div>
          <div><dt>插槽数据</dt><dd>{(pixelStorage / 1024).toFixed(1)} KiB</dd></div>
          <div><dt>背面来源</dt><dd className="is-ok">{project.back ? '精修图覆盖' : `自动翻转 · #${recipe.number}`}</dd></div>
        </dl>

        <div className="doll-step-heading"><span>03</span><div><strong>选择切片</strong><small>腿、袜子和鞋均为独立插槽</small></div></div>
        <div className="doll-slot-list">
          {SLOT_ORDER.map((slotId) => <button type="button" key={slotId} className={selectedSlot === slotId ? 'is-active' : ''} onClick={() => setSelectedSlot(slotId)}>
            <PixelDocumentCanvas pixelDocument={project.slots[slotId]} scale={2} />
            <span>{SOURCE_SLOT_LABELS[slotId]}</span>
            <small>{STUDIO_SLOT_SIZES[slotId].join('×')}</small>
          </button>)}
        </div>
      </aside>

      <section className="doll-source-stage">
        <div className="doll-stage-heading">
          <div><span>降维后源立绘</span><h1>从这张图直接拆，不再重新画人</h1></div>
          <div className="doll-stage-badges"><span>{project.front.width}×{project.front.height} POINTS</span><span>{project.front.palette.length - 1} COLORS</span></div>
        </div>
        <div className="doll-source-canvas" ref={sourceWrapRef}>
          <PixelDocumentCanvas pixelDocument={project.front} scale={4} label="降维后的完整球员立绘" />
          <div className="doll-footline">ROOT / FOOTLINE</div>
          {Object.entries(project.segments).map(([slotId, segment]) => <button
            type="button"
            key={slotId}
            className={`doll-slice-box${selectedSlot === slotId ? ' is-active' : ''}`}
            style={{ left: `${segment.x * 100}%`, top: `${segment.y * 100}%`, width: `${segment.width * 100}%`, height: `${segment.height * 100}%` }}
            onPointerDown={(event) => handleSegmentPointerDown(event, slotId)}
            onPointerMove={handleSegmentPointerMove}
            onPointerUp={handleSegmentPointerUp}
            onPointerCancel={handleSegmentPointerUp}
            onClick={() => setSelectedSlot(slotId)}
          ><span>{SOURCE_SLOT_LABELS[slotId]}</span></button>)}
        </div>
        <div className="doll-stage-note"><span>拖动框校准位置</span><span>右侧数值调整宽高</span><span>完整腿部保留在源立绘中</span></div>

        <RuntimeGoldReference boundaryWhitePixels={boundaryWhitePixels} onSelect={setSelectedSlot} />
        <TrueMatchRuntimePreview project={project} recipe={recipe} />
      </section>

      <aside className="doll-inspector">
        <div className="doll-step-heading"><span>04</span><div><strong>{SOURCE_SLOT_LABELS[selectedSlot]}</strong><small>切片框与像素修片</small></div></div>
        <div className="doll-segment-fields">
          {['x', 'y', 'width', 'height'].map((field) => <label key={field}>{field.toUpperCase()}<input type="number" min="0" max="1" step="0.01" value={selectedSegment[field].toFixed(2)} onChange={(event) => updateSegment(selectedSlot, field, event.target.value)} /></label>)}
        </div>
        <div className="doll-slot-audit">
          <span>固定画布 {STUDIO_SLOT_SIZES[selectedSlot].join('×')}</span>
          <span>{countOpaquePixels(project.slots[selectedSlot])} 个非透明像素</span>
        </div>
        <PixelSlotEditor
          pixelDocument={project.slots[selectedSlot]}
          onCommit={(document, message) => commitProject((current) => ({ ...current, slots: { ...current.slots, [selectedSlot]: document } }), message)}
          onUndo={undo}
          onRedo={redo}
          onReset={resetSelectedSlot}
          canUndo={Boolean(historyCounts.undo)}
          canRedo={Boolean(historyCounts.redo)}
        />
        <button type="button" className="doll-reset-all" onClick={resetAllSegments}>重置全部切片框与手绘</button>
        <div className="doll-export-explainer">
          <span>05 / 输出</span>
          <strong>保存的是像素点，不是球员整图</strong>
          <p>导出的 `.hspixels.json` 包含调色板、RLE 像素索引、固定插槽尺寸和锚点。运行时需要时才临时编译成小纹理。</p>
        </div>
      </aside>
    </div>
    <footer className="doll-statusbar"><span>{status}</span><button type="button" onClick={resetAllSegments}>全部重置</button></footer>
  </main>
}
