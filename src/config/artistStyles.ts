// Curated artist tags verified against the current Danbooru artist records and
// the Illustrious/Anima model tag indexes. WAI consumes canonical Danbooru tags;
// Anima's official prompt contract requires a leading @ and spaces.

export type ArtistStyleEngine = 'sd' | 'anima' | 'krea2'
export type ArtistStyleVerification = 'project' | 'curated' | 'tag'

export interface ArtistStyleOption {
  id: string
  name: string
  waiTag: string
  animaTag: string
  description: string
  verification: ArtistStyleVerification
}

const ARTIST_STYLE_IDS = new Set(
  'kantoku shirabi bunbun morikura_en anmi rella mika_pikazo nardack fuzichoco hxxg swav so-bin muririn kobuichi yoneyama_mai hiten_(hitenkei) lam_(ramdayo) tiv lack ask_(askzy)'.split(' '),
)

function artistDisplayName(id: string): string {
  return id.replace(/_\(.+$/, '').replace(/_/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase())
}

export function normalizeArtistStyleIds(value: unknown, limit = 2): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const raw of value) {
    const id = String(raw || '')
    if (!ARTIST_STYLE_IDS.has(id) || result.includes(id)) continue
    result.push(id)
    if (result.length >= limit) break
  }
  return result
}

export function artistTagsForEngine(ids: readonly string[], engine: ArtistStyleEngine): string[] {
  if (engine === 'krea2') return []
  return normalizeArtistStyleIds(ids).map(id => engine === 'anima'
    ? `@${id.replace(/_\(.+$/, '').replace(/_/g, ' ')}`
    : id)
}

export function artistStyleProse(ids: readonly string[]): string {
  const names = normalizeArtistStyleIds(ids).map(artistDisplayName)
  if (!names.length) return ''
  const joined = names.length === 1 ? names[0] : `${names[0]} and ${names[1]}`
  return `with visual styling inspired by ${joined}`
}
