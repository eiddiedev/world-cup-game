/**
 * 批量更新球员 avatar 字段
 * 规则：
 * 1. 金卡/银卡球员（有专属称号）→ 使用对应称号命名的图片（不重复）
 * 2. 门将（GK位置，无专属图片）→ 使用 gk.png / gk2.png
 * 3. 其他普通球员 → 循环使用 slice_XX.png（可重复）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const assetsDir = path.join(root, 'public', 'assets')
const playersDir = path.join(root, 'src', 'data', 'players')

// teamId → 文件夹名
const teamFolderMap = {
  france: '法国',
  brazil: '巴西',
  argentina: '阿根廷',
  portugal: '葡萄牙',
  germany: '德国',
  japan: '日本',
  norway: '挪威',
  morocco: '摩洛哥',
  newzealand: '新西兰',
  curacao: '库拉索',
  spain: '西班牙',
  england: '英格兰',
  usa: '美国',
  canada: '加拿大',
  mexico: '墨西哥',
  colombia: '哥伦比亚',
  capeverde: '佛得角',
}

// 手动修正映射（球员名 ≠ 图片名 的特殊情况）
const nameOverride = {
  norway: { '北海铁壁': '北非铁壁' },
}

const teamFiles = Object.keys(teamFolderMap)

for (const teamId of teamFiles) {
  const folder = teamFolderMap[teamId]
  const teamAssetDir = path.join(assetsDir, folder)
  const playerFile = path.join(playersDir, `${teamId}.js`)

  if (!fs.existsSync(teamAssetDir)) {
    console.warn(`[SKIP] 素材文件夹不存在: ${teamAssetDir}`)
    continue
  }
  if (!fs.existsSync(playerFile)) {
    console.warn(`[SKIP] 球员文件不存在: ${playerFile}`)
    continue
  }

  // 列出素材文件夹中所有 png
  const allImages = fs.readdirSync(teamAssetDir).filter(f => f.endsWith('.png'))
  const namedImages = allImages.filter(f => !f.startsWith('slice_') && !f.startsWith('gk'))
  const gkImages = allImages.filter(f => f.startsWith('gk')).sort()
  const sliceImages = allImages.filter(f => f.startsWith('slice_')).sort()

  // 建立名称→图片映射
  const namedMap = {}
  for (const img of namedImages) {
    const name = img.replace('.png', '')
    namedMap[name] = `/assets/${folder}/${img}`
  }

  const overrides = nameOverride[teamId] || {}

  let content = fs.readFileSync(playerFile, 'utf-8')
  const lines = content.split('\n')

  let gkIndex = 0
  let sliceIndex = 0
  let updatedCount = 0

  // 逐行扫描，追踪当前球员的 name 和 position
  let currentName = null
  let currentPosition = null

  for (let i = 0; i < lines.length; i++) {
    const nameMatch = lines[i].match(/^\s*name:\s*'([^']+)'/)
    if (nameMatch) {
      currentName = nameMatch[1]
    }
    const posMatch = lines[i].match(/^\s*position:\s*'([^']+)'/)
    if (posMatch) {
      currentPosition = posMatch[1]
    }
    const avatarMatch = lines[i].match(/^(\s*avatar:\s*)'[^']*'(.*)$/)
    if (avatarMatch && currentName) {
      let avatarPath = null
      const lookupName = overrides[currentName] || currentName

      if (namedMap[lookupName]) {
        avatarPath = namedMap[lookupName]
      } else if (currentPosition === 'GK') {
        if (gkImages.length > 0) {
          avatarPath = `/assets/${folder}/${gkImages[gkIndex % gkImages.length]}`
          gkIndex++
        }
      }

      if (!avatarPath && sliceImages.length > 0) {
        avatarPath = `/assets/${folder}/${sliceImages[sliceIndex % sliceImages.length]}`
        sliceIndex++
      }

      if (avatarPath) {
        lines[i] = `${avatarMatch[1]}'${avatarPath}'${avatarMatch[2]}`
        updatedCount++
      }

      // 重置追踪
      currentName = null
      currentPosition = null
    }
  }

  fs.writeFileSync(playerFile, lines.join('\n'), 'utf-8')
  console.log(`[OK] ${teamId} (${folder}): 更新 ${updatedCount} 个球员头像`)
}

console.log('\n全部完成！')
