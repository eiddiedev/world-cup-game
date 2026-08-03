import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertNoRestrictedCompetitionIp,
  escapeRestrictedCoincidencesInBase64,
} from '../../scripts/lib/variant-build.mjs'

const temporaryRoots = []

function temporaryOutput() {
  const root = mkdtempSync(join(tmpdir(), 'targeting-compliance-'))
  temporaryRoots.push(root)
  return root
}

afterEach(() => {
  temporaryRoots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }))
})

describe('compliant output competition-IP guard', () => {
  it('accepts neutral competition branding', () => {
    const root = temporaryOutput()
    writeFileSync(join(root, 'index.html'), '<title>国际足球冠军赛</title>')
    expect(assertNoRestrictedCompetitionIp(root)).toMatchObject({ violations: [] })
  })

  it.each([
    ['Chinese tournament wording', '世界杯'],
    ['federation acronym', 'FIFA'],
    ['spaced English wording', 'WORLD CUP'],
    ['compact English wording', 'worldcup'],
    ['protected trophy wording', '大力神杯'],
  ])('rejects %s in file content', (_label, restrictedText) => {
    const root = temporaryOutput()
    writeFileSync(join(root, 'metadata.json'), JSON.stringify({ label: restrictedText }))
    expect(() => assertNoRestrictedCompetitionIp(root)).toThrow(/Restricted competition IP/)
  })

  it('rejects restricted package paths', () => {
    const root = temporaryOutput()
    const nested = join(root, 'assets', 'world-cup')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'report.json'), '{}')
    expect(() => assertNoRestrictedCompetitionIp(root)).toThrow(/in path/)
  })

  it('escapes only incidental matches inside base64 while preserving decoded JSON data', () => {
    const root = temporaryOutput()
    const path = join(root, 'runtime-data.json')
    const encoded = `${'A'.repeat(160)}FIFA${'B'.repeat(160)}`
    writeFileSync(path, JSON.stringify({ encoded, visible: '国际足球冠军赛' }))

    expect(escapeRestrictedCoincidencesInBase64(root)).toEqual([
      { path: 'runtime-data.json', replacements: 1 },
    ])
    expect(readFileSync(path, 'utf8')).not.toMatch(/fifa/iu)
    expect(JSON.parse(readFileSync(path, 'utf8')).encoded).toBe(encoded)
    expect(assertNoRestrictedCompetitionIp(root)).toMatchObject({ violations: [] })
  })

  it('does not disguise visible restricted copy', () => {
    const root = temporaryOutput()
    writeFileSync(join(root, 'index.html'), '<h1>FIFA</h1>')
    expect(escapeRestrictedCoincidencesInBase64(root)).toEqual([])
    expect(() => assertNoRestrictedCompetitionIp(root)).toThrow(/Restricted competition IP/)
  })
})
