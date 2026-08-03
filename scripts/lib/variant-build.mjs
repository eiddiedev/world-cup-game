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

export function pngDimensions(path) {
  const bytes = readFileSync(path)
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`Protected artwork must be PNG: ${relative(projectRoot, path)}`)
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
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
    if (extname(entry.path).toLowerCase() !== '.png') failures.push(`${entry.key}: non-PNG manifest path`)
    if (!existsSync(showcasePath)) failures.push(`${entry.key}: missing showcase baseline`)
    if (!existsSync(selectedPath)) failures.push(`${entry.key}: missing ${variant.artPack} replacement`)
    if (!existsSync(showcasePath) || !existsSync(selectedPath)) return null

    const showcaseDimensions = pngDimensions(showcasePath)
    const selectedDimensions = pngDimensions(selectedPath)
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
