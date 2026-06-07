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
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = join(projectRoot, 'dist-douyin')
const deliverablesRoot = join(projectRoot, 'deliverables')
const zipPath = join(deliverablesRoot, '剑指美加墨-抖音互动空间-Demo.zip')
const maxBytes = 8_000_000

const assetDirectories = [
  '法国',
  '库拉索',
  '属性',
  '比赛事件',
]

const demoFlags = [
  '法国',
  '库拉索',
  '伊拉克',
  '塞内加尔',
  '挪威',
  '德国',
  '厄瓜多尔',
  '科特迪瓦',
  '西班牙',
  '英格兰',
  '荷兰',
  '比利时',
  '克罗地亚',
  '乌拉圭',
  '墨西哥',
  '美国',
  '瑞士',
  '哥伦比亚',
  '奥地利',
  '瑞典',
  '埃及',
  '伊朗',
  '韩国',
  '澳大利亚',
  '土耳其',
  '加拿大',
  '南非',
  '卡塔尔',
  '巴拉圭',
]

const assetFiles = [
  'logo.png',
  '金币.png',
  '锁.png',
  '庆祝.gif',
  '队徽/法国.png',
  '队徽/库拉索.png',
]

function copyAsset(relativePath) {
  const source = join(projectRoot, 'public/assets', relativePath)
  const target = join(outputRoot, 'assets', relativePath)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
}

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

function makeAssetPathsRelative() {
  for (const path of walkFiles(outputRoot)) {
    if (!['.html', '.css', '.js'].includes(extname(path))) continue
    const source = readFileSync(path, 'utf8')
    const relativePrefix = extname(path) === '.css' ? '../assets/' : './assets/'
    const updated = source.replace(
      /(^|[^.])\/assets\//gm,
      (_, prefix) => `${prefix}${relativePrefix}`,
    )
    if (updated !== source) writeFileSync(path, updated)
  }
}

function validateOutput() {
  const textFiles = walkFiles(outputRoot).filter(path =>
    ['.html', '.css', '.js'].includes(extname(path)),
  )
  const absoluteReferences = textFiles.flatMap(path => {
    const content = readFileSync(path, 'utf8')
    return /(^|[^.])\/assets\//m.test(content) ? [path] : []
  })
  if (absoluteReferences.length > 0) {
    throw new Error(`Demo still contains absolute asset paths: ${absoluteReferences.join(', ')}`)
  }

  const requiredFiles = [
    'index.html',
    'assets/logo.png',
    'assets/fonts/zpix.ttf',
    'assets/足球场.png',
    'assets/法国/法国超跑.png',
    'assets/库拉索/蓝浪飞翼.png',
  ]
  const missing = requiredFiles.filter(path => !existsSync(join(outputRoot, path)))
  if (missing.length > 0) {
    throw new Error(`Demo is missing required files: ${missing.join(', ')}`)
  }

  const outputBytes = directorySize(outputRoot)
  if (outputBytes > maxBytes) {
    throw new Error(`Demo is ${formatMiB(outputBytes)}, above the 8 MiB limit`)
  }
  return outputBytes
}

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(deliverablesRoot, { recursive: true })
rmSync(zipPath, { force: true })

execFileSync('npx', ['vite', 'build', '--mode', 'douyin'], {
  cwd: projectRoot,
  stdio: 'inherit',
})

assetDirectories.forEach(copyAsset)
assetFiles.forEach(copyAsset)
demoFlags.forEach(flag => copyAsset(`国旗/${flag}.png`))

execFileSync('python3', [
  join(projectRoot, 'scripts/build-demo-assets.py'),
  projectRoot,
  outputRoot,
], {
  cwd: projectRoot,
  stdio: 'inherit',
})

makeAssetPathsRelative()
const outputBytes = validateOutput()

execFileSync('zip', ['-qry', zipPath, '.'], {
  cwd: outputRoot,
  stdio: 'inherit',
})

const zipBytes = statSync(zipPath).size
if (zipBytes > maxBytes) {
  throw new Error(`Demo ZIP is ${formatMiB(zipBytes)}, above the 8 MiB limit`)
}

console.log(`Douyin Demo directory: ${formatMiB(outputBytes)}`)
console.log(`Douyin Demo ZIP:       ${formatMiB(zipBytes)}`)
console.log(`Output: ${outputRoot}`)
console.log(`ZIP:    ${zipPath}`)
