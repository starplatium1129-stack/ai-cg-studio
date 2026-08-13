// Curated artist tags verified against the current Danbooru artist records and
// the Illustrious/Anima model tag indexes. WAI consumes canonical Danbooru tags;
// Anima's official prompt contract requires a leading @ and spaces.

export type ArtistStyleEngine = 'sd' | 'anima' | 'krea2'

export interface ArtistStyleOption {
  id: string
  name: string
  waiTag: string
  animaTag: string
  description: string
}

const ARTIST_STYLE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  kantoku:'Kantoku', shirabi:'Shirabi', bunbun:'BUNBUN', morikura_en:'Morikura En',
  anmi:'Anmi', rella:'Rella', mika_pikazo:'Mika Pikazo', nardack:'Nardack',
  fuzichoco:'Fuzichoco', hxxg:'HxxG', swav:'SWAV', 'so-bin':'so-bin',
})

export function normalizeArtistStyleIds(value: unknown, limit = 2): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const raw of value) {
    const id = String(raw || '')
    if (!ARTIST_STYLE_NAMES[id] || result.includes(id)) continue
    result.push(id)
    if (result.length >= limit) break
  }
  return result
}

export function artistTagsForEngine(ids: readonly string[], engine: ArtistStyleEngine): string[] {
  if (engine === 'krea2') return []
  return normalizeArtistStyleIds(ids).map(id => engine === 'anima' ? `@${id.replace(/_/g, ' ')}` : id)
}

export function artistStyleProse(ids: readonly string[]): string {
  const names = normalizeArtistStyleIds(ids).map(id => ARTIST_STYLE_NAMES[id])
  if (!names.length) return ''
  const joined = names.length === 1 ? names[0] : `${names[0]} and ${names[1]}`
  return `with visual styling inspired by ${joined}`
}
