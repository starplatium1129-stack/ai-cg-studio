export type ShowcaseCharacter = 'nene' | 'natsume' | 'triad'
export type ShowcaseRating = 'All' | 'R15' | 'R18'

export interface ShowcaseEntry {
  id: string
  title: string
  story: string
  category: string
  char: ShowcaseCharacter
  rating: ShowcaseRating
  attempt: number
}

export interface ShowcaseManifest {
  sceneCount: number
  counts: Record<ShowcaseRating, number>
  entries: ShowcaseEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nonNegativeNumber(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

function parseEntry(value: unknown): ShowcaseEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || !value.id.trim()) return null
  if (typeof value.title !== 'string' || !value.title.trim()) return null
  if (value.char !== 'nene' && value.char !== 'natsume' && value.char !== 'triad') return null
  if (value.rating !== 'All' && value.rating !== 'R15' && value.rating !== 'R18') return null
  return {
    id: value.id.trim(),
    title: value.title.trim(),
    story: typeof value.story === 'string' ? value.story : '',
    category: typeof value.category === 'string' ? value.category : '',
    char: value.char,
    rating: value.rating,
    attempt: Math.max(1, Math.trunc(nonNegativeNumber(value.attempt) ?? 1)),
  }
}

function entryOrder(entry: ShowcaseEntry): number {
  const suffix = Number(entry.id.match(/(\d+)$/)?.[1])
  return Number.isFinite(suffix) ? suffix : Number.MAX_SAFE_INTEGER
}

export function parseShowcaseManifest(value: unknown): ShowcaseManifest {
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    throw new Error('样张 manifest 格式无效')
  }
  const seen = new Set<string>()
  const entries = value.entries
    .map(parseEntry)
    .filter((entry): entry is ShowcaseEntry => entry !== null)
    .filter(entry => {
      if (seen.has(entry.id)) return false
      seen.add(entry.id)
      return true
    })
    .sort((a, b) => entryOrder(a) - entryOrder(b) || a.id.localeCompare(b.id))
  if (!entries.length && value.entries.length) throw new Error('样张 manifest 没有有效条目')

  const actualCounts: Record<ShowcaseRating, number> = {
    All: entries.filter(entry => entry.rating === 'All').length,
    R15: entries.filter(entry => entry.rating === 'R15').length,
    R18: entries.filter(entry => entry.rating === 'R18').length,
  }
  const rawCounts = isRecord(value.counts) ? value.counts : {}
  return {
    sceneCount: nonNegativeNumber(value.sceneCount) ?? entries.length,
    counts: {
      All: nonNegativeNumber(rawCounts.All) ?? actualCounts.All,
      R15: nonNegativeNumber(rawCounts.R15) ?? actualCounts.R15,
      R18: nonNegativeNumber(rawCounts.R18) ?? actualCounts.R18,
    },
    entries,
  }
}
