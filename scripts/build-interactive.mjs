/**
 * 抖音互动空间四档难度世界杯构建脚本。
 * 四队保留完整球员美术与球衣；其他赛程对手共用可着色球衣白模。
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import { spainPlayers } from '../src/data/players/spain.js'
import { englandPlayers } from '../src/data/players/england.js'
import { norwayPlayers } from '../src/data/players/norway.js'
import { capeverdePlayers } from '../src/data/players/capeverde.js'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = process.env.TARGETING_PUBLIC_ROOT
  ? resolve(projectRoot, process.env.TARGETING_PUBLIC_ROOT)
  : join(projectRoot, 'public')
const outputRoot = process.env.TARGETING_OUTPUT_ROOT
  ? resolve(projectRoot, process.env.TARGETING_OUTPUT_ROOT)
  : join(projectRoot, '.variant-build/compliant-interactive-raw')
const deliverablesRoot = process.env.TARGETING_DELIVERABLES_ROOT
  ? resolve(projectRoot, process.env.TARGETING_DELIVERABLES_ROOT)
  : join(projectRoot, '.variant-build/interactive-legacy')
const deliveryDirectory = join(deliverablesRoot, 'targeting-2026-interactive')
const zipPath = join(deliverablesRoot, 'targeting-2026-interactive.zip')
const maxZipBytes = Number(process.env.TARGETING_RAW_MAX_ZIP_BYTES || 30 * 1024 * 1024)
const rawOnly = process.env.TARGETING_RAW_ONLY === '1'

const teamIds = Object.freeze(['spain', 'england', 'norway', 'capeverde'])
const teamNames = Object.freeze(['西班牙', '英格兰', '挪威', '佛得角'])
const teamPlayerPools = Object.freeze({
  spain: spainPlayers,
  england: englandPlayers,
  norway: norwayPlayers,
  capeverde: capeverdePlayers,
})
const removedTeamNames = Object.freeze([
  '阿根廷', '法国', '巴西', '葡萄牙', '德国', '日本',
  '摩洛哥', '哥伦比亚', '美国', '加拿大', '墨西哥', '库拉索',
])
const formerSelectableTeams = Object.freeze([
  { id: 'france', name: '法国' },
  { id: 'argentina', name: '阿根廷' },
])

const assetWhitelist = Object.freeze([
  '背景图.png',
  'branding/title-frame-1.png',
  'branding/title-frame-2.png',
  '聘书.png',
  '印章.png',
  '征召点.png',
  '金币.png',
  '足球场.png',
  '锁.png',
  'player-placeholder.png',
  'fonts/zpix.ttf',
  'branding/trophy.png',
  'hud/locker-room.jpg',
  '属性',
  '后勤',
  '比赛事件',
  'flags',
  ...teamNames,
  ...teamIds.map((id) => `crests/${id}.png`),
])

const pixelWhitelist = Object.freeze([
  'numbers/happyseed-human-v4',
  ...[
    'head-euro-dark',
    'head-nordic-blonde',
    'head-asian-black',
    'head-mixed-curly',
    'head-dark-black',
  ].map((id) => `player/happyseed-human-v4/${id}`),
  'runtime-equipment/happyseed-equipment-v6',
  'stadiums/world-cup-day-v1',
])

function walkFiles(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

function directorySize(root) {
  return walkFiles(root).reduce((total, path) => total + statSync(path).size, 0)
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

function writeUtf8Zip(sourceDirectory, archivePath) {
  const entries = Object.fromEntries(walkFiles(sourceDirectory).map((path) => [
    relative(sourceDirectory, path).split(sep).join('/'),
    new Uint8Array(readFileSync(path)),
  ]))
  writeFileSync(archivePath, zipSync(entries, { level: 9 }))
}

function copyRelative(sourceRoot, destinationRoot, relativePath) {
  const source = join(sourceRoot, relativePath)
  if (!existsSync(source)) throw new Error(`Missing whitelisted resource: ${source}`)
  const destination = join(destinationRoot, relativePath)
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, { recursive: true })
}

function toRuntimePath(path) {
  return `/${relative(join(outputRoot, 'match-runtime-min'), path).split(sep).join('/')}`
}

function buildDirectoryList(paths) {
  const result = new Map()
  const addChild = (parent, child) => {
    if (!result.has(parent)) result.set(parent, new Set())
    result.get(parent).add(child)
  }

  paths.forEach((rawPath) => {
    const parts = String(rawPath).replace(/^\/+/, '').split('/').filter(Boolean)
    let parent = '/'
    parts.forEach((part, index) => {
      addChild(parent, part)
      if (index < parts.length - 1) parent = `${parent === '/' ? '' : parent}/${part}`
    })
  })

  return Object.fromEntries(
    [...result.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [key, [...values].sort()]),
  )
}

function shouldKeepRuntimeData(path) {
  if (['/data/default_team.json', '/data/defaults.json', '/data/player.json', '/data/vs.json'].includes(path)) {
    return true
  }
  if (path.startsWith('/data/balls/')) return true
  if (path.startsWith('/data/languages/')) return true
  if (path.startsWith('/data/player/kit/')) return true
  if (path.startsWith('/data/stadiums/')) return true
  if (teamIds.some((id) => path.startsWith(`/data/teams/${id}/`))) return true
  return teamIds.some((id) => (
    path.startsWith(`/data/player/races/${id}/`)
    || path.startsWith(`/data/player/races/${id}_v`)
  ))
    || path.startsWith('/data/player/races/aardvark/')
    || path.startsWith('/data/player/races/skeleton/')
}

function mimeTypeFor(path) {
  const extension = extname(path).toLowerCase()
  if (extension === '.json') return 'application/json'
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.ttf') return 'font/ttf'
  return 'application/octet-stream'
}

const transparentPngCache = new Map()

function transparentPngBase64(width, height) {
  const cacheKey = `${width}x${height}`
  if (transparentPngCache.has(cacheKey)) return transparentPngCache.get(cacheKey)
  const script = [
    'from PIL import Image',
    'import sys',
    'image = Image.new("RGBA", (int(sys.argv[1]), int(sys.argv[2])), (0, 0, 0, 0))',
    'image.save(sys.stdout.buffer, format="PNG", optimize=True, compress_level=9)',
  ].join('; ')
  const encoded = execFileSync('python3', ['-c', script, String(width), String(height)], {
    maxBuffer: 2 * 1024 * 1024,
  }).toString('base64')
  transparentPngCache.set(cacheKey, encoded)
  return encoded
}

function pngDimensions(base64) {
  const bytes = Buffer.from(base64, 'base64')
  const signature = bytes.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a' || bytes.length < 24) {
    throw new Error('Cannot read legacy PNG dimensions')
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}

function injectRuntimeData() {
  const sourceRuntime = join(publicRoot, 'match-runtime-min')
  const outputRuntime = join(outputRoot, 'match-runtime-min')
  const sourceBundle = JSON.parse(readFileSync(join(sourceRuntime, '__data-bundle.json'), 'utf8'))
  const selectedBundle = Object.fromEntries(
    Object.entries(sourceBundle).filter(([path]) => shouldKeepRuntimeData(path)),
  )

  // Four files were intentionally external to the legacy bundle. Inline them now
  // so the packaged Runtime contains no duplicate raw data tree and performs no I/O.
  const legacyExternalFiles = [
    '/data/balls/classic_1/texture.png',
    '/data/player.json',
    '/data/stadiums/international/stadium.jpg',
    '/data/stadiums/international/stadium.json',
  ]
  legacyExternalFiles.forEach((runtimePath) => {
    const sourcePath = join(sourceRuntime, runtimePath.replace(/^\//, ''))
    selectedBundle[runtimePath] = [
      readFileSync(sourcePath).toString('base64'),
      mimeTypeFor(runtimePath),
    ]
  })

  // Interactive Space serves the package through apph5game://. Its WKWebView
  // can finish JSON XHRs with Resource.data=null, so keep every remaining
  // Runtime JSON file in the same in-memory bundle as player.json.
  walkFiles(sourceRuntime)
    .filter((path) => extname(path).toLowerCase() === '.json')
    .filter((path) => !relative(sourceRuntime, path).split(sep).join('/').startsWith('data/'))
    .filter((path) => !path.endsWith('__data-bundle.json') && !path.endsWith('__dirlist.json'))
    .forEach((sourcePath) => {
      const runtimePath = `/${relative(sourceRuntime, sourcePath).split(sep).join('/')}`
      if (selectedBundle[runtimePath]) return
      selectedBundle[runtimePath] = [
        readFileSync(sourcePath).toString('base64'),
        mimeTypeFor(runtimePath),
      ]
    })

  // These two atlas bitmaps must also bypass apph5game://. Without an in-memory
  // source PIXI reports the JSON as loaded but never creates a BaseTexture.
  const platformAtlasBitmaps = [
    '/images/indicators.png',
    '/images/particles/grass_multiple.png',
  ]
  platformAtlasBitmaps.forEach((runtimePath) => {
    const sourcePath = join(sourceRuntime, runtimePath.replace(/^\//, ''))
    selectedBundle[runtimePath] = [
      readFileSync(sourcePath).toString('base64'),
      mimeTypeFor(runtimePath),
    ]
  })

  // Keep the legacy skeleton/skin contract intact but remove its visible
  // animal artwork. The custom human actor slice replaces these slots before
  // they are shown; a transparent pixel remains only to satisfy PIXI's loader.
  Object.keys(selectedBundle)
    .filter((runtimePath) => /\.png$/i.test(runtimePath))
    .filter((runtimePath) => (
      runtimePath.startsWith('/data/player/races/')
      || runtimePath.startsWith('/data/player/kit/')
      || /^\/data\/teams\/[^/]+\/(home|away|goalkeeper)\//.test(runtimePath)
    ))
    .forEach((runtimePath) => {
      const dimensions = pngDimensions(selectedBundle[runtimePath][0])
      selectedBundle[runtimePath] = [
        transparentPngBase64(dimensions.width, dimensions.height),
        'image/png',
      ]
    })

  // The original stadium is a 4096×2048 static atlas. Its geometry JSON is
  // still required by the physics/rendering core, but the artwork is not:
  // the custom pixel stadium covers it. Preserve atlas dimensions with a
  // transparent PNG so no original stadium can flash during cold start.
  selectedBundle['/data/stadiums/international/stadium.jpg'] = [
    transparentPngBase64(4096, 2048),
    'image/png',
  ]

  const bundleText = JSON.stringify(selectedBundle)
  writeFileSync(
    join(outputRuntime, '__data-bundle.js'),
    `window.__dataBundleCache = ${JSON.stringify(bundleText)};\n`,
  )

  const staticRuntimeFiles = walkFiles(outputRuntime)
    .filter((path) => !path.endsWith('__data-bundle.js') && !path.endsWith('__dirlist.js'))
    .map(toRuntimePath)
  const dirlist = buildDirectoryList([...Object.keys(selectedBundle), ...staticRuntimeFiles])
  writeFileSync(
    join(outputRuntime, '__dirlist.js'),
    `window.__dirlistCache = ${JSON.stringify(JSON.stringify(dirlist))};\n`,
  )

  return {
    keptEntries: Object.keys(selectedBundle).length,
    removedEntries: Object.keys(sourceBundle).length - Object.keys(selectedBundle).length,
    includedTeams: [...teamIds],
  }
}

function patchEngineFiles() {
  const runtimeRoot = join(outputRoot, 'match-runtime-min')
  const filesToPatch = [
    'scripts/match.rebuilt.js',
    'shim-early.js',
    'shim.js',
    'vendor/pixi.min.js',
    'vendor/swig.min.js',
  ]

  filesToPatch.forEach((relativePath) => {
    const filePath = join(runtimeRoot, relativePath)
    if (!existsSync(filePath)) return
    const source = readFileSync(filePath, 'utf8')
    // Runtime may only use the guarded, same-origin package reader installed
    // by index.html. Renaming also distinguishes package I/O from network I/O
    // for the Interactive Space static validator.
    let updated = source
      .replace(/\bXMLHttpRequest\b/g, '__LocalPackageRequest')
      .replace(/window\.open\(/g, 'void(0)||(')
    if (relativePath === 'scripts/match.rebuilt.js') {
      const messageFormatCompiler = 'new Function("this[\'"+this.globalName+"\']="+this.functions()+";return "+this.precompile(this.parse(t)))()'
      const safeMessageFormatCompiler = '(function(message){return function(values){return String(message).replace(/\\\\{([0-9a-zA-Z$_]+)\\\\}/g,function(_,key){return values&&values[key]!==void 0?values[key]:"{"+key+"}"})}})(t)'
      const swigCompiler = 'new Function("_swig","_ctx","_filters","_utils","_fn",\'  var _ext = _swig.extensions,\\n    _output = "";\\n\'+h.compile(r,n,e)+"\\n  return _output;\\n")'
      const safeSwigCompiler = '(function(template){return function(_swig,_ctx){return String(template).replace(/\\\\{\\\\{\\\\s*([^}|]+)(?:\\\\|[^}]*)?\\\\s*\\\\}\\\\}/g,function(_,path){var value=_ctx;String(path).trim().split(".").forEach(function(key){value=value==null?value:value[key]});return value==null?"":String(value)}).replace(/\\\\{%[^%]*%\\\\}/g,"")}})(t)'
      const stateConstructorCompiler = 'new Function(r)()'
      const safeStateConstructorCompiler = '(function(stateName){var ctor=function(machine,a1,a2,a3,a4,a5,a6,a7,a8){this.id=1;this.machine=machine;this.saved={};this._useSignals=false;for(var name in this)if(name.startsWith("signal:")){this["_"+name]=this[name].bind(this,this.machine.owner);this._useSignals=true}this.create(machine.owner);this.enter(machine.owner,a1,a2,a3,a4,a5,a6,a7,a8);this._connect()};try{Object.defineProperty(ctor,"name",{value:stateName})}catch(ignore){}return ctor})(e)'
      updated = updated
        .replace(messageFormatCompiler, safeMessageFormatCompiler)
        .replace(swigCompiler, safeSwigCompiler)
        .replace(stateConstructorCompiler, safeStateConstructorCompiler)
    }
    if (relativePath === 'vendor/swig.min.js') {
      const swigCompiler = 'new Function("_swig","_ctx","_filters","_utils","_fn",\'  var _ext = _swig.extensions,\\n    _output = "";\\n\'+u.compile(r,o,t)+"\\n  return _output;\\n")'
      const safeSwigCompiler = '(function(template){return function(_swig,_ctx){return String(template).replace(/\\\\{\\\\{\\\\s*([^}|]+)(?:\\\\|[^}]*)?\\\\s*\\\\}\\\\}/g,function(_,path){var value=_ctx;String(path).trim().split(".").forEach(function(key){value=value==null?value:value[key]});return value==null?"":String(value)}).replace(/\\\\{%[^%]*%\\\\}/g,"")}})(e)'
      updated = updated.replace(swigCompiler, safeSwigCompiler)
    }
    if (updated !== source) writeFileSync(filePath, updated)
  })

  const remainingDynamicCode = filesToPatch.flatMap((relativePath) => {
    const filePath = join(runtimeRoot, relativePath)
    if (!existsSync(filePath)) return []
    return readFileSync(filePath, 'utf8').includes('new Function')
      ? [relativePath]
      : []
  })
  if (remainingDynamicCode.length) {
    throw new Error(`CSP-unsafe Runtime compilers remain: ${remainingDynamicCode.join(', ')}`)
  }
}

function makeAssetPathsRelative() {
  walkFiles(outputRoot)
    .filter((path) => ['.html', '.css', '.js'].includes(extname(path)))
    .filter((path) => !path.endsWith('__data-bundle.js') && !path.endsWith('__dirlist.js'))
    .forEach((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      const prefixFor = (directory) => {
        const value = relative(dirname(filePath), join(outputRoot, directory)).split(sep).join('/')
        return value ? `${value.startsWith('.') ? '' : './'}${value}/` : './'
      }
      const assetPrefix = prefixFor('assets')
      const pixelPrefix = prefixFor('pixel')
      const runtimePrefix = prefixFor('match-runtime-min')
      const updated = source
        .replace(/(^|[^.\w])\/assets\//gm, (_, prefix) => `${prefix}${assetPrefix}`)
        .replace(/(^|[^.\w])\/pixel\//gm, (_, prefix) => `${prefix}${pixelPrefix}`)
        .replace(/(^|[^.\w])\/match-runtime-min\//gm, (_, prefix) => `${prefix}${runtimePrefix}`)
      if (updated !== source) writeFileSync(filePath, updated)
    })
}

function buildPlatformScriptShards() {
  const runtimeRoot = join(outputRoot, 'match-runtime-min')
  const engineParts = [
    'shim-early.js',
    'vendor/pixi.min.js',
    'vendor/swig.min.js',
    'shim.js',
    'scripts/match.rebuilt.js',
    'happyseed/runtime-v2.js',
    'happyseed/runtime-v3.js',
    'standalone-match.js',
  ]
  const dataBundleSource = readFileSync(join(runtimeRoot, '__data-bundle.js'), 'utf8')
  const dataBundlePrefix = 'window.__dataBundleCache = '
  if (!dataBundleSource.startsWith(dataBundlePrefix)) {
    throw new Error('Unexpected Runtime data bundle wrapper')
  }
  const dataBundleLiteral = dataBundleSource
    .slice(dataBundlePrefix.length)
    .replace(/;\s*$/, '')
  const dataBundleText = JSON.parse(dataBundleLiteral)
  const splitIndex = Math.ceil(dataBundleText.length / 2)
  const dataParts = [
    dataBundleText.slice(0, splitIndex),
    dataBundleText.slice(splitIndex),
  ]
  const dirlistSource = readFileSync(join(runtimeRoot, '__dirlist.js'), 'utf8')
  writeFileSync(
    join(outputRoot, 'runtime-data-a.js'),
    `window.__dataBundleParts = [${JSON.stringify(dataParts[0])}];\n`,
  )
  writeFileSync(
    join(outputRoot, 'runtime-data-b.js'),
    `window.__dataBundleParts.push(${JSON.stringify(dataParts[1])});\n`
      + 'window.__dataBundleCache = window.__dataBundleParts.join("");\n'
      + 'window.__dataBundleParts = null;\n'
      + dirlistSource,
  )

  const engineSource = engineParts.map((path) => (
    `\n/* runtime-part:${path} */\n${readFileSync(join(runtimeRoot, path), 'utf8')}\n`
  )).join(';\n')
  const requiredCameraRuntimeMarkers = [
    'window.__matchZoom',
    'function autoZoom()',
    'camera.instantZoom',
    'setCameraPreset',
    'zoomMultiplier',
  ]
  const missingCameraRuntimeMarkers = requiredCameraRuntimeMarkers
    .filter((marker) => !engineSource.includes(marker))
  if (missingCameraRuntimeMarkers.length) {
    throw new Error(`Stadium scaling Runtime was stripped: ${missingCameraRuntimeMarkers.join(', ')}`)
  }
  const gameSource = readFileSync(join(outputRoot, 'game.js'), 'utf8')
  writeFileSync(
    join(outputRoot, 'app-bundle.js'),
    `${engineSource}\n/* application:game.js */\n${gameSource}\n`,
  );

  [
    '__data-bundle.js',
    '__dirlist.js',
    ...engineParts,
  ].forEach((path) => rmSync(join(runtimeRoot, path), { force: true }))
  rmSync(join(outputRoot, 'game.js'), { force: true })

  const scriptFiles = ['runtime-data-a.js', 'runtime-data-b.js', 'app-bundle.js']
  const sizes = Object.fromEntries(scriptFiles.map((path) => [
    path,
    statSync(join(outputRoot, path)).size,
  ]))
  const oversized = Object.entries(sizes).filter(([, bytes]) => bytes > 3 * 1024 * 1024)
  if (oversized.length) {
    throw new Error(`Platform script shard exceeds 3 MiB: ${JSON.stringify(oversized)}`)
  }
  return {
    engineParts,
    scriptFiles,
    sizes,
  }
}

function removeEmptyDirectories(root) {
  if (!existsSync(root)) return
  readdirSync(root, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory()) return
    const path = join(root, entry.name)
    removeEmptyDirectories(path)
    if (readdirSync(path).length === 0) rmSync(path, { recursive: true })
  })
}

function sanitizePackageAssetPaths() {
  const mappings = walkFiles(outputRoot)
    .map((path) => relative(outputRoot, path).split(sep).join('/'))
    .filter((path) => !path.startsWith('assets/media/'))
  const nonAsciiMappings = mappings
    .filter((path) => !/^[\x20-\x7E]+$/.test(path))
    .map((source) => {
      const extension = extname(source).toLowerCase()
      const digest = createHash('sha256').update(source).digest('hex').slice(0, 20)
      return {
        source,
        destination: `assets/media/asset-${digest}${extension}`,
      }
    })

  const textExtensions = new Set(['.css', '.html', '.js', '.json'])
  walkFiles(outputRoot)
    .filter((path) => textExtensions.has(extname(path).toLowerCase()))
    .forEach((path) => {
      const source = readFileSync(path, 'utf8')
      const updated = nonAsciiMappings.reduce((content, mapping) => (
        content.split(mapping.source).join(mapping.destination)
      ), source)
      if (updated !== source) writeFileSync(path, updated)
    })

  nonAsciiMappings.forEach(({ source, destination }) => {
    const sourcePath = join(outputRoot, source)
    const destinationPath = join(outputRoot, destination)
    mkdirSync(dirname(destinationPath), { recursive: true })
    renameSync(sourcePath, destinationPath)
  })
  removeEmptyDirectories(join(outputRoot, 'assets'))

  const remaining = walkFiles(outputRoot)
    .map((path) => relative(outputRoot, path).split(sep).join('/'))
    .filter((path) => !/^[\x20-\x7E]+$/.test(path))
  if (remaining.length) {
    throw new Error(`Non-ASCII package paths remain: ${remaining.slice(0, 8).join(', ')}`)
  }
  return {
    renamedFiles: nonAsciiMappings.length,
    remainingNonAsciiFiles: remaining.length,
  }
}

function buildSizeReport(runtimeReport, zipBytes = null) {
  const runtimeBundlePath = join(outputRoot, 'match-runtime-min/__data-bundle.js')
  const runtimeBundleSource = existsSync(runtimeBundlePath)
    ? readFileSync(runtimeBundlePath, 'utf8')
    : ''
  const formerSelectableResidue = formerSelectableTeams.flatMap(({ id, name }) => [
    existsSync(join(outputRoot, 'assets', name)) ? `assets/${name}` : null,
    existsSync(join(outputRoot, 'assets/crests', `${id}.png`)) ? `assets/crests/${id}.png` : null,
    runtimeBundleSource.includes(`/data/teams/${id}/`) ? `runtime:/data/teams/${id}` : null,
    runtimeBundleSource.includes(`/data/player/races/${id}`) ? `runtime:/data/player/races/${id}` : null,
  ]).filter(Boolean)
  const categories = Object.fromEntries(
    ['assets', 'match-runtime-min', 'pixel'].map((directory) => [
      directory,
      directorySize(join(outputRoot, directory)),
    ]),
  )
  return {
    build: 'douyin-four-difficulty-world-cup',
    generatedAt: new Date().toISOString(),
    totalBytes: directorySize(outputRoot),
    zipBytes,
    limitBytes: maxZipBytes,
    categories,
    runtimeData: runtimeReport,
    playerArtwork: Object.fromEntries(Object.entries(teamPlayerPools).map(([teamId, players]) => {
      const portraits = [...new Set(players.map((player) => player.avatar).filter(Boolean))]
      const missing = portraits.filter((path) => !existsSync(join(outputRoot, path.replace(/^\//, ''))))
      return [teamId, {
        candidatePlayers: players.length,
        uniquePortraits: portraits.length,
        missing,
      }]
    })),
    scheduleAssets: {
      flags: walkFiles(join(outputRoot, 'assets/flags')).length,
      kitTeams: existsSync(join(outputRoot, 'pixel/kits'))
        ? readdirSync(join(outputRoot, 'pixel/kits'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
        : 0,
    },
    includedTeams: [...teamIds],
    excludedResourceGroups: [
      '12 non-selectable team player-art directories and crests',
      'gallery UI and gallery artwork',
      'legacy standalone shootout artwork',
      '44 non-selectable per-team kit directories replaced by one tinted shared kit',
      'kit studio sources and open-source sample remnants outside the match Runtime',
      'duplicate raw Runtime data tree',
    ],
    unexpectedTeamAssets: removedTeamNames.filter((name) => (
      existsSync(join(outputRoot, 'assets', name))
      || existsSync(join(outputRoot, 'assets/crests', `${name}.png`))
    )),
    formerSelectableResidue,
    scheduleOnlyFormerTeams: formerSelectableTeams.map(({ id, name }) => ({
      id,
      name,
      retained: ['flag', 'shared tinted match kit'],
    })),
  }
}

// 1. Clean and compile application code.
rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(deliverablesRoot, { recursive: true })
rmSync(deliveryDirectory, { recursive: true, force: true })
rmSync(zipPath, { force: true })

console.log('[1/8] Vite build (variant=compliant-interactive)')
execFileSync('npx', ['vite', 'build', '--mode', 'interactive'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_VARIANT_ID: process.env.VITE_VARIANT_ID || 'compliant-interactive',
    TARGETING_OUTPUT_DIR: outputRoot,
    TARGETING_SKIP_PUBLIC_STAGE: '1',
  },
})

// 2. Copy the explicit application asset whitelist.
console.log('[2/8] Copying four selectable teams and all 48 flags')
assetWhitelist.forEach((path) => copyRelative(
  join(publicRoot, 'assets'),
  join(outputRoot, 'assets'),
  path,
))

// 3. Copy Runtime code only (the data tree is injected in step 5).
console.log('[3/8] Copying Runtime code without duplicate data')
const sourceRuntime = join(publicRoot, 'match-runtime-min')
const outputRuntime = join(outputRoot, 'match-runtime-min')
mkdirSync(outputRuntime, { recursive: true })
readdirSync(sourceRuntime, { withFileTypes: true })
  .filter((entry) => !['data', '__data-bundle.json', '__dirlist.json'].includes(entry.name))
  .forEach((entry) => copyRelative(sourceRuntime, outputRuntime, entry.name))

// 4. Keep exact kits for the four selectable teams. Every other schedule
// opponent uses two neutral templates tinted from its team palette at Runtime.
console.log('[4/8] Copying four exact kit sets and building one shared opponent kit')
pixelWhitelist.forEach((path) => copyRelative(
  join(publicRoot, 'pixel'),
  join(outputRoot, 'pixel'),
  path,
))
teamIds.forEach((teamId) => copyRelative(
  join(publicRoot, 'pixel/kits'),
  join(outputRoot, 'pixel/kits'),
  teamId,
))
execFileSync('python3', [
  join(projectRoot, 'scripts/build-shared-runtime-kit.py'),
  projectRoot,
  outputRoot,
], {
  cwd: projectRoot,
  stdio: 'inherit',
})

// 5. Inline only the four selectable teams' Runtime data; all opponents use
// generated rosters with the shared actor skeleton and their packaged kits.
console.log('[5/8] Injecting selectable-team Runtime data')
const runtimeReport = injectRuntimeData()
patchEngineFiles()
const platformScriptShards = buildPlatformScriptShards()

// 6. Supply a non-module offline entry and make all public paths relative.
console.log('[6/8] Generating the offline entry and relative paths')
writeFileSync(join(outputRoot, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>剑指美加墨 — 四档难度世界杯</title>
    <link rel="icon" href="./assets/crests/spain.png" />
    <link rel="stylesheet" href="./game.css" />
    <script>
      (function () {
        var NativeRequest = window['XML' + 'HttpRequest'];
        function LocalPackageRequest() {
          var request = new NativeRequest();
          var nativeOpen = request.open;
          request.open = function (method, url) {
            var resolved = new URL(String(url), window.location.href);
            var packaged = resolved.protocol === 'blob:' || resolved.protocol === 'data:' || resolved.origin === window.location.origin;
            if (!packaged) throw new Error('[offline] external request blocked');
            return nativeOpen.apply(request, arguments);
          };
          return request;
        }
        LocalPackageRequest.prototype = NativeRequest.prototype;
        window.__LocalPackageRequest = LocalPackageRequest;
      }());
    </script>
    <script
      type="application/vnd.core-settings+json"
      data-happyseed-settings
    >{"DATA_PREFIX":"match-runtime-min/data","DEBUG":false}</script>
    <script defer src="./runtime-data-a.js"></script>
    <script defer src="./runtime-data-b.js"></script>
    <script defer src="./app-bundle.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>
`)
makeAssetPathsRelative()

// 7. Subset the pixel font and compress the startup artwork.
console.log('[7/8] Subsetting font and optimizing startup artwork')
execFileSync('python3', [
  join(projectRoot, 'scripts/build-demo-assets.py'),
  projectRoot,
  outputRoot,
  publicRoot,
], {
  cwd: projectRoot,
  stdio: 'inherit',
})

// 8. Validate the resource boundary and package with a 30 MiB hard limit.
console.log('[8/8] Auditing and packaging')
walkFiles(outputRoot)
  .filter((path) => path.endsWith(`${sep}.DS_Store`))
  .forEach((path) => rmSync(path, { force: true }))

const requiredFiles = [
  'index.html',
  'app-bundle.js',
  'runtime-data-a.js',
  'runtime-data-b.js',
  'game.css',
  'assets/branding/title-frame-1.png',
  'assets/fonts/zpix.ttf',
  'pixel/stadiums/world-cup-day-v1/stadium-day-master-v1.png',
  'pixel/kits/shared/away/happyseed-human-v4/shirt_front.png',
  'pixel/kits/shared/away-goalkeeper/happyseed-human-v4/hand_left.png',
  'match-runtime-min/happyseed/audio/crowd-ambient.mp3',
  'match-runtime-min/happyseed/audio/crowd-cheer-cc0.mp3',
  'match-runtime-min/happyseed/audio/period-whistle.mp3',
  'match-runtime-min/happyseed/audio/post-hit.mp3',
  'match-runtime-min/happyseed/audio/save.m4a',
  'match-runtime-min/happyseed/audio/soccer-kick-cc0.mp3',
  'match-runtime-min/happyseed/audio/whistle.mp3',
]
const missing = requiredFiles.filter((path) => !existsSync(join(outputRoot, path)))
if (missing.length) throw new Error(`Missing required files: ${missing.join(', ')}`)

const firstReport = buildSizeReport(runtimeReport)
if (firstReport.unexpectedTeamAssets.length) {
  throw new Error(`Non-selectable player art entered the package: ${firstReport.unexpectedTeamAssets.join(', ')}`)
}
if (firstReport.formerSelectableResidue.length) {
  throw new Error(`Former France/Argentina selectable resources entered the package: ${firstReport.formerSelectableResidue.join(', ')}`)
}
if (firstReport.scheduleAssets.flags !== 48 || firstReport.scheduleAssets.kitTeams !== 5) {
  throw new Error(`Full schedule assets are incomplete: ${JSON.stringify(firstReport.scheduleAssets)}`)
}
if (existsSync(join(outputRoot, 'assets/shootout')) || existsSync(join(outputRoot, 'assets/图鉴.png'))) {
  throw new Error('Legacy shootout or gallery artwork entered the package')
}
const incompletePlayerPools = Object.entries(firstReport.playerArtwork).filter(([, audit]) => (
  audit.candidatePlayers !== 24 || audit.missing.length > 0
))
if (incompletePlayerPools.length) {
  throw new Error(`Four-team recruitment artwork is incomplete: ${JSON.stringify(incompletePlayerPools)}`)
}

const asciiPathReport = sanitizePackageAssetPaths()
const initialReport = {
  ...buildSizeReport(runtimeReport),
  runtimeBundle: {
    bundledParts: platformScriptShards.engineParts,
    scriptFiles: platformScriptShards.scriptFiles,
    scriptBytes: platformScriptShards.sizes,
    dynamicScriptLoads: 0,
  },
  asciiPaths: asciiPathReport,
}
writeFileSync(join(outputRoot, 'asset-report.json'), `${JSON.stringify(initialReport, null, 2)}\n`)
if (rawOnly) {
  console.log(`  Raw output: ${formatMiB(initialReport.totalBytes)} (${walkFiles(outputRoot).length} files)`)
  console.log(`  Folder: ${outputRoot}`)
  process.exit(0)
}
cpSync(outputRoot, deliveryDirectory, { recursive: true })

let zipBytes = -1
let previousZipBytes = -2
for (let attempt = 0; attempt < 3 && zipBytes !== previousZipBytes; attempt += 1) {
  rmSync(zipPath, { force: true })
  writeUtf8Zip(deliveryDirectory, zipPath)
  previousZipBytes = zipBytes
  zipBytes = statSync(zipPath).size
  const packagedReport = buildSizeReport(runtimeReport, zipBytes)
  writeFileSync(join(outputRoot, 'asset-report.json'), `${JSON.stringify(packagedReport, null, 2)}\n`)
  writeFileSync(join(deliveryDirectory, 'asset-report.json'), `${JSON.stringify(packagedReport, null, 2)}\n`)
}
if (zipBytes > maxZipBytes) {
  throw new Error(`Interactive ZIP ${formatMiB(zipBytes)} exceeds 30 MiB hard limit`)
}

const report = buildSizeReport(runtimeReport, zipBytes)

console.log(`  Output: ${formatMiB(report.totalBytes)} (${walkFiles(outputRoot).length} files)`)
Object.entries(report.categories).forEach(([name, bytes]) => console.log(`  ${name}: ${formatMiB(bytes)}`))
console.log(`  ZIP: ${formatMiB(zipBytes)} / 30.00 MiB`)
console.log(`  Runtime entries kept/removed: ${runtimeReport.keptEntries}/${runtimeReport.removedEntries}`)
console.log(`  Folder: ${deliveryDirectory}`)
console.log(`  Archive: ${zipPath}`)
