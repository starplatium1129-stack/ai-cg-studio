import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const read = (path: string) => readFileSync(path)
const digest = (path: string) => createHash('sha256').update(read(path)).digest('hex')
const selected = JSON.parse(read('assets/characters/portrait-selections.json').toString()) as { entries: Record<string, { entryId: string; rating: string; portraitSha256: string }> }
const catalog = JSON.parse(read('data/popular-characters.json').toString()) as { characters: { id: string }[] }

describe('character portrait identity', () => {
  it('does not reuse one portrait file for distinct character identities', () => {
    const seen = new Map<string, string>()
    for (const { id } of catalog.characters) {
      const hash = digest('assets/characters/popular-' + id + '.png')
      expect(seen.get(hash), id + ' must not reuse another character portrait').toBeUndefined()
      seen.set(hash, id)
    }
  })
  it.each(Object.entries(selected.entries))('keeps the selected sample and rebuilt thumbnail for %s', (id, source) => {
    expect(source.entryId.startsWith('pc_' + id + '_')).toBe(true)
    expect(source.rating).toBe('All')
    expect(digest('assets/characters/popular-' + id + '.png')).toBe(source.portraitSha256)
    expect(digest('assets/characters/thumbs/popular-' + id + '.webp')).not.toBe(digest('assets/characters/thumbs/popular-kasumigaoka_utaha.webp'))
  })
})
