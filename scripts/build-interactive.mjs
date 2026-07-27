/**
 * 互动空间合规构建脚本
 * 从同一源码生成完整 16 队互动空间版本，满足平台离线包合规要求。
 * - 无 fetch / XHR / 外链
 * - ASCII 产物命名
 * - 包含完整 match-runtime-min 和 pixel 资源
 * - Runtime JSON 数据构建时注入（不走网络请求）
 */
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = join(projectRoot, 'dist-douyin')
const deliverablesRoot = join(projectRoot, 'deliverables')
const deliveryDirectory = join(deliverablesRoot, 'targeting-2026-interactive')
const zipPath = join(deliverablesRoot, 'targeting-2026-interactive.zip')

// ─── Helpers ────────────────────────────────────────────────────────────────

function walkFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
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

// ─── Step 1: Clean & Vite Build ─────────────────────────────────────────────

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(deliverablesRoot, { recursive: true })
rmSync(deliveryDirectory, { recursive: true, force: true })
rmSync(zipPath, { force: true })

console.log('[1/7] Vite build (mode=douyin)...')
execFileSync('npx', ['vite', 'build', '--mode', 'douyin'], {
  cwd: projectRoot,
  stdio: 'inherit',
})

// ─── Step 2: Copy public resources ─────────────────────────────────────────

console.log('[2/7] Copying public resources...')

// All game assets (16 teams, shared UI, fonts, shootout, etc.)
cpSync(join(projectRoot, 'public/assets'), join(outputRoot, 'assets'), { recursive: true })

// Match runtime engine (Phaser-based)
cpSync(join(projectRoot, 'public/match-runtime-min'), join(outputRoot, 'match-runtime-min'), { recursive: true })

// Pixel player/kit/stadium rendering assets
cpSync(join(projectRoot, 'public/pixel'), join(outputRoot, 'pixel'), { recursive: true })

// ─── Step 3: Inject Runtime data as JS (eliminate fetch) ────────────────────

console.log('[3/7] Injecting runtime data as inline JS...')

const dataBundlePath = join(outputRoot, 'match-runtime-min/__data-bundle.json')
const dirlistPath = join(outputRoot, 'match-runtime-min/__dirlist.json')

if (existsSync(dataBundlePath)) {
  const bundleJson = readFileSync(dataBundlePath, 'utf8')
  writeFileSync(
    join(outputRoot, 'match-runtime-min/__data-bundle.js'),
    `window.__dataBundleCache = ${JSON.stringify(bundleJson)};\n`,
  )
  // Remove original JSON so validator doesn't flag it as unreferenced
  rmSync(dataBundlePath)
} else {
  console.warn('  WARN: __data-bundle.json not found')
}

if (existsSync(dirlistPath)) {
  const dirlistJson = readFileSync(dirlistPath, 'utf8')
  writeFileSync(
    join(outputRoot, 'match-runtime-min/__dirlist.js'),
    `window.__dirlistCache = ${JSON.stringify(dirlistJson)};\n`,
  )
  rmSync(dirlistPath)
} else {
  console.warn('  WARN: __dirlist.json not found')
}

// ─── Step 4: Generate index.html ────────────────────────────────────────────

console.log('[4/7] Generating index.html...')

writeFileSync(join(outputRoot, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>剑指美加墨 — Targeting 2026</title>
    <link rel="stylesheet" href="./game.css" />
    <script src="./match-runtime-min/__data-bundle.js"></script>
    <script src="./match-runtime-min/__dirlist.js"></script>
    <script defer src="./game.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`)

// ─── Step 5: Patch engine files for offline compliance ──────────────────────

console.log('[5/8] Patching engine files for offline compliance...')

function patchEngineFiles() {
  const runtimeRoot = join(outputRoot, 'match-runtime-min')
  const filesToPatch = [
    'scripts/match.rebuilt.js',
    'shim-early.js',
    'shim.js',
    'vendor/pixi.min.js',
  ]

  for (const relPath of filesToPatch) {
    const filePath = join(runtimeRoot, relPath)
    if (!existsSync(filePath)) continue
    let content = readFileSync(filePath, 'utf8')
    const original = content

    // Replace XMLHttpRequest constructor with a safe stub
    // The stub throws if actually instantiated, making failures obvious
    content = content.replace(
      /new XMLHttpRequest/g,
      'new (function(){throw new Error("[offline] XHR disabled")})',
    )

    // Neutralize window.open calls
    content = content.replace(
      /window\.open\(/g,
      'void(0)||(',
    )

    if (content !== original) {
      writeFileSync(filePath, content)
      console.log(`  Patched: ${relPath}`)
    }
  }
}

patchEngineFiles()

// ─── Step 6: Make asset paths relative ──────────────────────────────────────

console.log('[6/8] Making asset paths relative...')

function makeAssetPathsRelative() {
  const textFiles = walkFiles(outputRoot).filter(path =>
    ['.html', '.css', '.js'].includes(extname(path)),
  )

  for (const filePath of textFiles) {
    // Skip the injected data files (they're huge and don't contain path refs)
    if (filePath.endsWith('__data-bundle.js') || filePath.endsWith('__dirlist.js')) continue

    const source = readFileSync(filePath, 'utf8')
    const relativeAssetDir = relative(dirname(filePath), join(outputRoot, 'assets'))
      .replaceAll('\\', '/')
    const assetPrefix = relativeAssetDir
      ? `${relativeAssetDir.startsWith('.') ? '' : './'}${relativeAssetDir}/`
      : './'

    const relativePixelDir = relative(dirname(filePath), join(outputRoot, 'pixel'))
      .replaceAll('\\', '/')
    const pixelPrefix = relativePixelDir
      ? `${relativePixelDir.startsWith('.') ? '' : './'}${relativePixelDir}/`
      : './'

    const relativeRuntimeDir = relative(dirname(filePath), join(outputRoot, 'match-runtime-min'))
      .replaceAll('\\', '/')
    const runtimePrefix = relativeRuntimeDir
      ? `${relativeRuntimeDir.startsWith('.') ? '' : './'}${relativeRuntimeDir}/`
      : './'

    let updated = source
      // /assets/ → relative (not preceded by . to avoid double-conversion)
      .replace(/(^|[^.\w])\/assets\//gm, (_, prefix) => `${prefix}${assetPrefix}`)
      // /pixel/ → relative
      .replace(/(^|[^.\w])\/pixel\//gm, (_, prefix) => `${prefix}${pixelPrefix}`)
      // /match-runtime-min/ → relative
      .replace(/(^|[^.\w])\/match-runtime-min\//gm, (_, prefix) => `${prefix}${runtimePrefix}`)

    if (updated !== source) writeFileSync(filePath, updated)
  }
}

makeAssetPathsRelative()

// ─── Step 6: Font subsetting & image optimization ───────────────────────────

console.log('[7/8] Font subsetting & image optimization...')

try {
  execFileSync('python3', [
    join(projectRoot, 'scripts/build-demo-assets.py'),
    projectRoot,
    outputRoot,
  ], {
    cwd: projectRoot,
    stdio: 'inherit',
  })
} catch (error) {
  console.warn('  WARN: build-demo-assets.py failed (fontTools/PIL may not be installed):', error.message)
  console.warn('  Continuing without font subsetting.')
}

// ─── Step 7: Validate & Package ─────────────────────────────────────────────

console.log('[8/8] Validating & packaging...')

// Basic validation
const indexHtml = readFileSync(join(outputRoot, 'index.html'), 'utf8')
if (/type=["']module["']/.test(indexHtml)) {
  throw new Error('index.html must not use type="module" for offline compatibility')
}

const gameJs = readFileSync(join(outputRoot, 'game.js'), 'utf8')
if (gameJs.includes('process.env')) {
  throw new Error('game.js contains unresolved process.env references')
}

// Check no absolute asset paths remain in root-level files
const rootTextFiles = walkFiles(outputRoot)
  .filter(path => ['.html', '.css', '.js'].includes(extname(path)))
  .filter(path => !path.includes('__data-bundle.js') && !path.includes('__dirlist.js'))
  .filter(path => {
    // Only check files at root level (game.js, game.css, index.html)
    return dirname(path) === outputRoot
  })

const absoluteRefs = rootTextFiles.flatMap(path => {
  const content = readFileSync(path, 'utf8')
  return /(^|[^.\w])\/assets\//m.test(content) ? [path] : []
})
if (absoluteRefs.length > 0) {
  throw new Error(`Absolute asset paths remain in: ${absoluteRefs.join(', ')}`)
}

// Required files check
const requiredFiles = [
  'index.html',
  'game.js',
  'game.css',
  'assets/logo.png',
  'assets/fonts/zpix.ttf',
  'match-runtime-min/standalone-match.js',
  'match-runtime-min/__data-bundle.js',
  'pixel/player/happyseed-human-v4',
]
const missing = requiredFiles.filter(path => !existsSync(join(outputRoot, path)))
if (missing.length > 0) {
  throw new Error(`Missing required files: ${missing.join(', ')}`)
}

// Report size (informational, no hard limit)
const outputBytes = directorySize(outputRoot)
console.log(`\n  Output size: ${formatMiB(outputBytes)} (${walkFiles(outputRoot).length} files)`)

// Copy to delivery directory & ZIP
cpSync(outputRoot, deliveryDirectory, { recursive: true })

execFileSync('zip', ['-qry', zipPath, '.'], {
  cwd: deliveryDirectory,
  stdio: 'inherit',
})

const zipBytes = statSync(zipPath).size
console.log(`  ZIP size:    ${formatMiB(zipBytes)}`)
console.log(`\n  Output: ${outputRoot}`)
console.log(`  Folder: ${deliveryDirectory}`)
console.log(`  ZIP:    ${zipPath}`)
console.log('\nDone. Run h5-validator next:')
console.log(`  node ~/.qoder-cn/plugins/cache/local/interact-creation/skills/interact-creation/scripts/h5-validator --required index.html ${outputRoot}`)
