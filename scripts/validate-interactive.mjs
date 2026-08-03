import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, relative, sep } from 'node:path'
import { unzipSync } from 'fflate'
import { walkFiles } from './lib/variant-build.mjs'

const MAX_BYTES = 8 * 1024 * 1024

function collectEntries(inputPath) {
  if (extname(inputPath).toLowerCase() === '.zip') {
    const zipEntries = unzipSync(new Uint8Array(readFileSync(inputPath)))
    return Object.entries(zipEntries).map(([name, bytes]) => ({ name, bytes: Buffer.from(bytes) }))
  }
  return walkFiles(inputPath).map(path => ({
    name: relative(inputPath, path).split(sep).join('/'),
    bytes: readFileSync(path),
  }))
}

export function validateInteractivePackage(inputPath, { maxBytes = MAX_BYTES } = {}) {
  if (!existsSync(inputPath)) throw new Error(`Interactive package does not exist: ${inputPath}`)
  const packagedBytes = extname(inputPath).toLowerCase() === '.zip'
    ? statSync(inputPath).size
    : walkFiles(inputPath).reduce((sum, path) => sum + statSync(path).size, 0)
  const entries = collectEntries(inputPath)
  const names = entries.map(entry => entry.name)
  const errors = []
  const warnings = []

  if (packagedBytes > maxBytes) errors.push(`Package is ${packagedBytes} bytes; limit is ${maxBytes}`)
  if (!names.includes('index.html')) errors.push('index.html is not at ZIP root')
  if (names.some(name => name.startsWith('__MACOSX/') || name.endsWith('/.DS_Store') || name === '.DS_Store')) {
    errors.push('Package contains macOS metadata')
  }
  const nonAscii = names.filter(name => !/^[\x20-\x7e]+$/.test(name))
  if (nonAscii.length) errors.push(`Non-ASCII paths: ${nonAscii.slice(0, 8).join(', ')}`)

  const textEntries = entries.filter(entry => /\.(?:html|css|js|json)$/i.test(entry.name))
  const indexSource = entries.find(entry => entry.name === 'index.html')?.bytes.toString('utf8') || ''
  const entryBlockers = [
    [/\b(?:src|href)\s*=\s*["'](?:https?:)?\/\//i, 'external entry resource'],
    [/<iframe\b/i, 'iframe'],
    [/target\s*=\s*["']_blank/i, 'external window target'],
  ]
  entryBlockers.forEach(([pattern, label]) => {
    if (pattern.test(indexSource)) errors.push(`index.html contains ${label}`)
  })

  const combined = textEntries.map(entry => entry.bytes.toString('utf8')).join('\n')
  const runtimeBlockers = [
    [/\bfetch\s*\(/, 'fetch'],
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
    [/(?:\bnew\s+)?\bWebSocket\s*\(/, 'WebSocket'],
    [/(?:\bnew\s+)?\bEventSource\s*\(/, 'EventSource'],
    [/\bwindow\.open\s*\(/, 'window.open'],
    [/\bnew\s+Function\s*\(/, 'new Function'],
    [/\beval\s*\(/, 'eval'],
  ]
  runtimeBlockers.forEach(([pattern, label]) => {
    if (pattern.test(combined)) errors.push(`Packaged source contains ${label}`)
  })
  if (/\binnerHTML\s*=/.test(combined)) warnings.push('Legacy innerHTML assignment remains')
  if (/<script\b(?![^>]*\bdefer\b)(?![^>]*type=["']application\/vnd\.core-settings\+json)/gi.test(indexSource)) {
    warnings.push('Entry contains a synchronous script block required by the offline request guard')
  }

  return { inputPath, packagedBytes, files: entries.length, errors, warnings }
}

if (process.argv[1] && process.argv[1].endsWith('validate-interactive.mjs')) {
  const inputPath = process.argv[2]
  if (!inputPath) throw new Error('Usage: node scripts/validate-interactive.mjs <directory-or-zip>')
  const report = validateInteractivePackage(inputPath)
  console.log(JSON.stringify(report, null, 2))
  if (report.errors.length) process.exit(1)
}
