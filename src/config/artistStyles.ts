import type { ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'

// Curated artist tags verified against the current Danbooru artist records and
// the Illustrious/Anima model tag indexes. WAI consumes canonical Danbooru tags;
// Anima's official prompt contract requires a leading @ and spaces.

export type ArtistStyleEngine = 'sd' | 'anima' | 'krea2'
export type ArtistStyleVerification = 'project' | 'curated' | 'tag'
export type ArtistCategory = 'cinematic' | 'pure' | 'trend' | 'grand'

export interface ArtistStyleOption {
  id: string
  name: string
  cnName?: string
  waiTag: string
  animaTag: string
  description: string
  verification: ArtistStyleVerification
  category?: ArtistCategory
  keywords?: string[]
}

export interface ArtistComboPreset {
  id: string
  label: string
  icon?: ArchiveIconName
  artistIds: [string, string] | [string]
  tagline: string
  mood: string
}

export const ARTIST_COMBO_PRESETS: readonly ArtistComboPreset[] = Object.freeze([
  { id: 'cinematic_pure', label: '电影通透感', icon: 'wideshot', artistIds: ['yoneyama_mai', 'kantoku'], tagline: '米山舞 × 监督', mood: '电影级流动光影与清透甜美五官' },
  { id: 'witch_journey', label: '空灵魔女旅行', icon: 'wand', artistIds: ['azuuru', 'rella'], tagline: 'Azure × Rella', mood: '清澈透明感、水润发丝与星夜旅行氛围' },
  { id: 'pure_galgame', label: '极致水灵少女', icon: 'flower', artistIds: ['hiten_(hitenkei)', 'tiv'], tagline: 'Hiten × Tiv', mood: '柔光日系空气感与微风发丝' },
  { id: 'starry_dream', label: '梦幻星夜微光', icon: 'moonlight', artistIds: ['rella', 'anmi'], tagline: 'Rella × Anmi', mood: '夜景星斑与清甜水润粉彩折射' },
  { id: 'noble_lady', label: '清冷贵气千金', icon: 'detail', artistIds: ['ask_(askzy)', 'kantoku'], tagline: 'ASK × 监督', mood: '丝滑上色与克制的高级质感' },
  { id: 'trend_cyber', label: '潮流先锋霓虹', icon: 'lightning', artistIds: ['lam_(ramdayo)', 'mika_pikazo'], tagline: 'LAM × Mika Pikazo', mood: '极高饱和前卫撞色与锐利图形' },
])

export const ARTIST_CATEGORIES: ReadonlyArray<{ id: 'all' | ArtistCategory; label: string; icon: ArchiveIconName }> = [
  { id: 'all', label: '全部', icon: 'palette' },
  { id: 'cinematic', label: '电影光影', icon: 'wideshot' },
  { id: 'pure', label: '清透少女', icon: 'flower' },
  { id: 'trend', label: '潮流先锋', icon: 'lightning' },
  { id: 'grand', label: '华丽厚涂', icon: 'manager' },
] as const

const ARTIST_STYLE_IDS = new Set(
  'kantoku shirabi bunbun morikura_en anmi rella mika_pikazo nardack fuzichoco hxxg swav so-bin muririn kobuichi yoneyama_mai hiten_(hitenkei) lam_(ramdayo) tiv lack ask_(askzy) azuuru paryi hisasi suimya tsunako atdan jazz_jack kousaki_rui xinzoruo nekotomi_chao ponkan8 shirotaka abe_tsukasa fujiwara_cocoa kazutake_hazano fujimoto_tatsuki takeuchi_takashi'.split(' '),
)

const ARTIST_STYLE_ALIASES: Record<string, string> = {
  azure: 'azuuru',
  'azure_(azure_cpt)': 'azuuru',
  azuuru: 'azuuru',
  nekotomi: 'nekotomi_chao',
  nekotomi_chao: 'nekotomi_chao',
}

function artistDisplayName(id: string): string {
  if (id === 'azuuru') return 'Azure'
  return id.replace(/_\(.+$/, '').replace(/_/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase())
}

export function normalizeArtistStyleIds(value: unknown, limit = 2): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const raw of value) {
    let id = String(raw || '').trim()
    if (ARTIST_STYLE_ALIASES[id]) id = ARTIST_STYLE_ALIASES[id]
    if (!ARTIST_STYLE_IDS.has(id) || result.includes(id)) continue
    result.push(id)
    if (result.length >= limit) break
  }
  return result
}

export function artistTagsForEngine(ids: readonly string[], engine: ArtistStyleEngine): string[] {
  if (engine === 'krea2') return []
  return normalizeArtistStyleIds(ids).map(id => engine === 'anima'
    // Anima 官方空格消歧规则：`lam_(ramdayo)` → `@lam (ramdayo)`，保留括号消歧名，
    // 与 Kohaku/Illustrious 生态（`ask (askzy)`）一致；主名 `@lam` 在 Danbooru 是弱 tag。
    ? `@${id.replace(/_/g, ' ')}`
    : id)
}

export function artistStyleProse(ids: readonly string[]): string {
  const names = normalizeArtistStyleIds(ids).map(artistDisplayName)
  if (!names.length) return ''
  const joined = names.length === 1 ? names[0] : `${names[0]} and ${names[1]}`
  return `with visual styling inspired by ${joined}`
}
