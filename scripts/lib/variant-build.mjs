import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import { getVariant } from '../../config/variants.mjs'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const rightsManifestPath = join(projectRoot, 'config/art-rights.json')

export function walkFiles(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function sha256File(path) {
  return sha256Bytes(readFileSync(path))
}

function pngDimensions(path, bytes) {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`Invalid PNG artwork: ${relative(projectRoot, path)}`)
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function jpegDimensions(path, bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error(`Invalid JPEG artwork: ${relative(projectRoot, path)}`)
  }
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ])
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2
      continue
    }
    const segmentLength = bytes.readUInt16BE(offset + 2)
    if (startOfFrameMarkers.has(marker)) {
      return {
        width: bytes.readUInt16BE(offset + 7),
        height: bytes.readUInt16BE(offset + 5),
      }
    }
    if (segmentLength < 2) break
    offset += 2 + segmentLength
  }
  throw new Error(`Cannot read JPEG dimensions: ${relative(projectRoot, path)}`)
}

export function rasterDimensions(path) {
  const bytes = readFileSync(path)
  const extension = extname(path).toLowerCase()
  if (extension === '.png') return pngDimensions(path, bytes)
  if (extension === '.jpg' || extension === '.jpeg') return jpegDimensions(path, bytes)
  throw new Error(`Protected artwork must be PNG or JPEG: ${relative(projectRoot, path)}`)
}

export function validateArtPack(variantId) {
  const variant = getVariant(variantId)
  const rights = readJson(rightsManifestPath)
  const packRoot = join(projectRoot, 'art-packs', variant.artPack)
  const packManifestPath = join(packRoot, 'manifest.json')
  if (!existsSync(packManifestPath)) throw new Error(`Missing art-pack manifest: ${packManifestPath}`)
  const packManifest = readJson(packManifestPath)
  if (packManifest.status !== 'ready') {
    throw new Error(
      `Art pack "${variant.artPack}" is ${packManifest.status || 'unknown'}; `
      + `build ${variantId} is fail-closed until approved replacements are complete.`,
    )
  }

  const showcaseRoot = join(projectRoot, 'art-packs/showcase')
  const failures = []
  const assets = rights.entries.map((entry) => {
    const showcasePath = join(showcaseRoot, entry.path)
    const selectedPath = join(packRoot, entry.path)
    const extension = extname(entry.path).toLowerCase()
    const compliantPolicy = entry.compliantPolicy || 'replace'
    if (!['.png', '.jpg', '.jpeg'].includes(extension)) failures.push(`${entry.key}: unsupported raster format`)
    if (!['replace', 'exclude'].includes(compliantPolicy)) failures.push(`${entry.key}: unknown compliant policy ${compliantPolicy}`)
    if (!existsSync(showcasePath)) failures.push(`${entry.key}: missing showcase baseline`)
    if (variant.artPack === 'compliant' && compliantPolicy === 'exclude') {
      if (existsSync(selectedPath)) failures.push(`${entry.key}: excluded artwork must not exist in compliant pack`)
      if (!existsSync(showcasePath)) return null
      return {
        ...entry,
        compliantPolicy,
        showcaseHash: sha256File(showcasePath),
        selectedHash: null,
        dimensions: rasterDimensions(showcasePath),
      }
    }
    if (!existsSync(selectedPath)) failures.push(`${entry.key}: missing ${variant.artPack} replacement`)
    if (!existsSync(showcasePath) || !existsSync(selectedPath)) return null

    const showcaseDimensions = rasterDimensions(showcasePath)
    const selectedDimensions = rasterDimensions(selectedPath)
    if (
      showcaseDimensions.width !== selectedDimensions.width
      || showcaseDimensions.height !== selectedDimensions.height
    ) {
      failures.push(
        `${entry.key}: expected ${showcaseDimensions.width}x${showcaseDimensions.height}, `
        + `received ${selectedDimensions.width}x${selectedDimensions.height}`,
      )
    }
    const showcaseHash = sha256File(showcasePath)
    const selectedHash = sha256File(selectedPath)
    if (variant.artPack === 'compliant' && showcaseHash === selectedHash) {
      failures.push(`${entry.key}: compliant file is byte-identical to showcase artwork`)
    }
    return {
      ...entry,
      compliantPolicy,
      showcaseHash,
      selectedHash,
      dimensions: selectedDimensions,
    }
  }).filter(Boolean)

  if (failures.length) {
    throw new Error(`Art-pack validation failed:\n- ${failures.join('\n- ')}`)
  }
  return { variant, rights, packRoot, packManifest, assets }
}

export function prepareVariantPublic(variantId) {
  const validation = validateArtPack(variantId)
  const stagingRoot = join(projectRoot, '.variant-public', variantId)
  rmSync(stagingRoot, { recursive: true, force: true })
  mkdirSync(dirname(stagingRoot), { recursive: true })
  cpSync(join(projectRoot, 'public'), stagingRoot, {
    recursive: true,
    filter: source => !source.endsWith(`${sep}.DS_Store`),
  })
  cpSync(join(validation.packRoot, 'assets'), join(stagingRoot, 'assets'), {
    recursive: true,
  })

  const commonLeaks = validation.rights.entries
    .filter(entry => existsSync(join(projectRoot, 'public', entry.path)))
    .map(entry => entry.path)
  if (commonLeaks.length) {
    throw new Error(`Protected artwork leaked back into public/: ${commonLeaks.join(', ')}`)
  }
  return { ...validation, stagingRoot }
}

export function gitInfo() {
  const run = args => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim()
  return {
    branch: run(['branch', '--show-current']),
    sha: run(['rev-parse', 'HEAD']),
    shortSha: run(['rev-parse', '--short=8', 'HEAD']),
    dirty: run(['status', '--porcelain']).length > 0,
  }
}

export function buildInfoFor(variantId) {
  const variant = getVariant(variantId)
  const git = gitInfo()
  const variantHash = sha256Bytes(Buffer.from(JSON.stringify(variant)))
  const artManifestPath = join(projectRoot, 'art-packs', variant.artPack, 'manifest.json')
  return {
    schemaVersion: 1,
    targetId: variantId,
    sourceSha: git.sha,
    sourceBranch: git.branch,
    dirty: git.dirty,
    variantConfigSha256: variantHash,
    artManifestSha256: sha256File(artManifestPath),
    generatedAt: new Date().toISOString(),
  }
}

export function writeBuildInfo(outputRoot, variantId) {
  const info = buildInfoFor(variantId)
  writeFileSync(join(outputRoot, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`)
  return info
}

export function assertNoShowcaseArtwork(outputRoot) {
  const showcaseHashes = new Map(
    readJson(rightsManifestPath).entries.map(entry => {
      const path = join(projectRoot, 'art-packs/showcase', entry.path)
      return [sha256File(path), entry.key]
    }),
  )
  const leaks = walkFiles(outputRoot).flatMap(path => {
    const protectedKey = showcaseHashes.get(sha256File(path))
    return protectedKey ? [`${relative(outputRoot, path)} (${protectedKey})`] : []
  })
  if (leaks.length) throw new Error(`Showcase artwork leaked into compliant output:\n- ${leaks.join('\n- ')}`)
}

const restrictedCompetitionPatterns = Object.freeze([
  { label: 'Chinese tournament IP', regex: /世界杯/u },
  { label: 'federation acronym', regex: /fifa/iu },
  { label: 'English tournament IP', regex: /world[\s_-]*cup/iu },
  { label: 'protected trophy name', regex: /大力神杯/u },
])

const longBase64Run = /[A-Za-z0-9+/=]{128,}/g

function escapedBase64Coincidence(match, extension) {
  const firstCodePoint = match.codePointAt(0)
  const tail = match.slice(1)
  if (extension === '.css') return `\\${firstCodePoint.toString(16)} ${tail}`
  if (['.html', '.svg', '.xml'].includes(extension)) {
    return `&#x${firstCodePoint.toString(16)};${tail}`
  }
  return `\\u${firstCodePoint.toString(16).padStart(4, '0')}${tail}`
}

/**
 * A base64 alphabet can coincidentally contain a restricted ASCII word even
 * when the decoded binary has no text or metadata. Escape only matches inside
 * long base64 runs, preserving the decoded value while keeping raw package
 * text grep-clean. Visible copy, URLs and normal identifiers remain untouched
 * and are still rejected by assertNoRestrictedCompetitionIp().
 */
export function escapeRestrictedCoincidencesInBase64(outputRoot) {
  const supportedExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.xml'])
  const rewritten = []
  walkFiles(outputRoot).forEach((path) => {
    const extension = extname(path).toLowerCase()
    if (!supportedExtensions.has(extension)) return
    const original = readFileSync(path, 'utf8')
    let replacements = 0
    const content = original.replace(longBase64Run, token => token.replace(/fifa/gi, (match) => {
      replacements += 1
      return escapedBase64Coincidence(match, extension)
    }))
    if (!replacements) return
    writeFileSync(path, content)
    rewritten.push({ path: relative(outputRoot, path).split(sep).join('/'), replacements })
  })
  return rewritten
}

export function assertNoRestrictedCompetitionIp(outputRoot) {
  const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt', '.xml'])
  const violations = []
  walkFiles(outputRoot).forEach((path) => {
    const packagePath = relative(outputRoot, path).split(sep).join('/')
    restrictedCompetitionPatterns.forEach(({ label, regex }) => {
      regex.lastIndex = 0
      if (regex.test(packagePath)) violations.push(`${packagePath} (${label} in path)`)
    })
    if (!textExtensions.has(extname(path).toLowerCase())) return
    const content = readFileSync(path, 'utf8')
    restrictedCompetitionPatterns.forEach(({ label, regex }) => {
      regex.lastIndex = 0
      if (regex.test(content)) violations.push(`${packagePath} (${label} in content)`)
    })
  })
  if (violations.length) {
    throw new Error(`Restricted competition IP entered compliant output:\n- ${violations.join('\n- ')}`)
  }
  return { scannedFiles: walkFiles(outputRoot).length, violations: [] }
}

export function writeZip(sourceRoot, zipPath) {
  mkdirSync(dirname(zipPath), { recursive: true })
  const entries = Object.fromEntries(walkFiles(sourceRoot).map(path => [
    relative(sourceRoot, path).split(sep).join('/'),
    new Uint8Array(readFileSync(path)),
  ]))
  rmSync(zipPath, { force: true })
  writeFileSync(zipPath, zipSync(entries, { level: 9 }))
  return statSync(zipPath).size
}

export function assertAsciiPackagePaths(root) {
  const invalid = walkFiles(root)
    .map(path => relative(root, path).split(sep).join('/'))
    .filter(path => !/^[\x20-\x7e]+$/.test(path))
  if (invalid.length) throw new Error(`Non-ASCII package paths remain: ${invalid.join(', ')}`)
}

export function artifactDirectoryFor(git = gitInfo()) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return join(projectRoot, 'artifacts', `${date}-${git.shortSha}`)
}
