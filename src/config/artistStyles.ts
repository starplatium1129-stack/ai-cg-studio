import type { ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'
import { resolveDrawCapabilities } from '../utils/drawCapabilities.ts'

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
  masterpiece?: string
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
  'kantoku shirabi bunbun morikura_en anmi rella mika_pikazo nardack fuzichoco hxxg swav so-bin muririn kobuichi yoneyama_mai hiten_(hitenkei) lam_(ramdayo) tiv lack ask_(askzy) azuuru paryi hisasi suimya tsunako atdan jazz_jack rucarachi kousaki_rui xinzoruo nekotomi_chao momoco_haru ponkan8 shirotaka abe_tsukasa fujiwara_cocoa kazutake_hazano fujimoto_tatsuki takeuchi_takashi gweda eufoniuz solar_(happymonk) alllisso mesilmen'.split(' '),
)

const ARTIST_STYLE_ALIASES: Record<string, string> = {
  azure: 'azuuru',
  'azure_(azure_cpt)': 'azuuru',
  azuuru: 'azuuru',
  nekotomi: 'nekotomi_chao',
  nekotomi_chao: 'nekotomi_chao',
  momoco: 'momoco_haru',
  'momoco_(momopoco)': 'momoco_haru',
  momoco_haru: 'momoco_haru',
  gweda8593: 'gweda',
  eufoniuz1026: 'eufoniuz',
  'SOLar_Bim': 'solar_(happymonk)',
  solar_bim: 'solar_(happymonk)',
  alllisso_: 'alllisso',
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
  const capabilities = resolveDrawCapabilities(engine)
  if (capabilities.promptFormat === 'natural-language') return []
  return normalizeArtistStyleIds(ids).map(id => capabilities.promptFormat === 'anima-tags'
    // Anima 官方空格消歧规则：`lam_(ramdayo)` → `@lam (ramdayo)`，保留括号消歧名，
    // 与 Kohaku/Illustrious 生态（`ask (askzy)`）一致；主名 `@lam` 在 Danbooru 是弱 tag。
    ? `@${id.replace(/_/g, ' ')}`
    : id)
}

/**
 * Krea2 自然语言风格描述表：Danbooru 画师 tag 对 Krea2 无效，
 * 这里把画师风格转成 Krea2 能理解的英文散文风格描述。
 * 未收录的画师会退回 `in the style of {name}`。
 */
const KREA_ARTIST_PROSE: Record<string, string> = {
  yoneyama_mai: 'cinematic anime illustration with flowing dynamic lines, expressive mood lighting, and a film-like color palette',
  rella: 'ethereal anime illustration with dreamy night glow, luminous colors, and cinematic lighting',
  swav: 'high-impact fantasy poster art with magical lighting and strong spatial depth',
  kantoku: 'clear and soft Japanese anime style with gentle sunlight, clean lines, and cute girls',
  momoco_haru: 'light novel illustration with glossy watery eyes, bright fair skin, and lively youthful charm',
  ponkan8: 'clear watercolor cel style with bright youthful spring atmosphere',
  shirotaka: 'delicate fantasy adventure illustration with soft watery highlights and refined detail',
  abe_tsukasa: 'classical cinematic fantasy illustration with dignified composition and quiet atmosphere',
  fujiwara_cocoa: 'gothic cool moe style with clean elegant lines and a touch of mystery',
  kazutake_hazano: 'warm healing illustration with gentle holy soft lines and comforting atmosphere',
  azuuru: 'ethereal watercolor style with translucent hair and a wandering traveler mood',
  'hiten_(hitenkei)': 'soft light Japanese illustration with refined features and clear healing air',
  tiv: 'light novel cover style with delicate ambient light and flowing hair',
  anmi: 'light macaron pastel watercolor style with graceful elegant figures',
  tsunako: 'bright cute anime girl style with vivid colors and energetic charm',
  morikura_en: 'bright commercial character art with natural everyday light and energetic mood',
  paryi: 'popular beautiful girl illustration with silky hair and bright clear eyes',
  muririn: 'Yuzusoft-style bright cel shading with rounded faces and clear transparent skin',
  kobuichi: 'Yuzusoft-style crisp cel art with clean outlines and vivid colors',
  nekotomi_chao: 'Doga Kobo-style lively delicate cel shading with expressive fine lines',
  atdan: 'pure adult-oriented anime style with delicate skin and shy expressions',
  jazz_jack: 'refreshing energetic anime style with clean lines and lively girls',
  hisasi: 'classic adult-oriented soft coloring with sweet shy atmosphere',
  suimya: 'soft erotic atmosphere with moist glossy highlights and lazy intimate mood',
  rucarachi: 'delicate game character fan art with fine linework, soft harmonious coloring, and charming bright-eyed girls',
  'lam_(ramdayo)': 'highly saturated neon trendy illustration with bold eye makeup and graphic composition',
  mika_pikazo: 'vivid pop art anime style with bold geometric color blocking and energetic vibes',
  bunbun: 'dynamic game key visual style with clear costume design and action pose',
  fujimoto_tatsuki: 'raw cinematic manga style with rough textures and intense emotional tension',
  takeuchi_takashi: 'TYPE-MOON style dignified anime illustration with sharp determined eyes and iconic servant designs',
  shirabi: 'bold dramatic anime illustration with strong outlines and theatrical lighting',
  'ask_(askzy)': 'cool noble anime illustration with silky smooth coloring and restrained elegance',
  hxxg: 'dynamic wide-angle perspective with colorful special effects and deep spatial composition',
  nardack: 'jewel-toned fantasy illustration with luxurious costumes and sparkling details',
  fuzichoco: 'ornate Japanese fantasy style with layered watercolor and decorative details',
  lack: 'rich fantasy thick painting with mature heavy colors and epic atmosphere',
  'so-bin': 'dark gothic oil painting style with heavy fabrics and solemn epic mood',
  kousaki_rui: 'refined elegant FGO-style illustration with graceful coloring and majestic atmosphere',
  xinzoruo: 'seductive dark anime style with deep chiaroscuro and dangerous atmosphere',
  gweda: 'delicate Korean-style anime illustration with soft thick-paint shading, glossy glass-like eyes, and refined beautiful girls',
  eufoniuz: 'soft adult-oriented anime fan art with cute rounded girls, smooth skin shading, and intimate sweet atmosphere',
  'solar_(happymonk)': 'glossy adult-oriented game character fan art with bright skin, seductive poses, and vibrant colors',
}

export function artistStyleProse(ids: readonly string[], engine: ArtistStyleEngine = 'sd'): string {
  const normalized = normalizeArtistStyleIds(ids)
  if (!normalized.length) return ''
  if (engine === 'krea2') {
    return normalized.map(id => KREA_ARTIST_PROSE[id] || `in the style of ${artistDisplayName(id)}`).join(', ')
  }
  const names = normalized.map(artistDisplayName)
  const joined = names.length === 1 ? names[0] : `${names[0]} and ${names[1]}`
  return `with visual styling inspired by ${joined}`
}
