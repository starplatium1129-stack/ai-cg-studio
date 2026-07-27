/** AICSceneUX 的 TypeScript 替代：纯场景工具函数，无副作用 */

export interface SceneUXConfig {
  signatureSceneIds?: string[]
  reviewSceneIds?: string[]
  curatedSceneIds?: string[]
  searchAliases?: Record<string, string[]>
  recommendationReasons?: Record<string, string>
}

export interface PreferenceProfile {
  entries: number; ratedEntries: number; favorites: number
  scenes: Record<string, SceneStats>
  characters: Record<string, SceneStats>
  generatedAt: number
}

interface SceneStats {
  uses: number; favorites: number; ratingTotal: number
  rated: number; lastUsed: number; averageRating: number
}

const RECENT_KEY = 'aics_recent_scenes'

function list(config: SceneUXConfig | null | undefined, key: keyof SceneUXConfig): string[] {
  const v = config?.[key]
  return Array.isArray(v) ? v as string[] : []
}

export function tier(scene: { id: string }, config: SceneUXConfig | null | undefined): 'signature' | 'review' | 'curated' | 'standard' {
  if (list(config, 'signatureSceneIds').includes(scene.id)) return 'signature'
  if (list(config, 'reviewSceneIds').includes(scene.id)) return 'review'
  if (list(config, 'curatedSceneIds').includes(scene.id)) return 'curated'
  return 'standard'
}

export function priority(scene: { id: string }, config: SceneUXConfig | null | undefined): number {
  const sigs = list(config, 'signatureSceneIds')
  const cur  = list(config, 'curatedSceneIds')
  const si = sigs.indexOf(scene.id), ci = cur.indexOf(scene.id)
  if (si >= 0) return 30000 - si
  if (ci >= 0) return 20000 - ci
  return 10000 - (Number(scene.id.replace(/\D/g, '')) || 0)
}

export function characterLabel(value: string): string {
  if (value === 'nene' || value === 'ayachi_nene') return '宁宁'
  if (value === 'natsume' || value === 'shiki_natsume') return '夏目'
  if (value === 'triad' || value === 'both') return '双人'
  return value || ''
}

function searchText(scene: Record<string, unknown>, extras?: string[]): string {
  return [
    scene.id, scene.title, scene.story, scene.emotion, scene.char,
    characterLabel(String(scene.char ?? '')), scene.rating,
    scene.category, scene.season, scene.time, scene.timeOfDay,
    scene.location, scene.weather, scene.camera, scene.lighting,
    ...(Array.isArray(scene.tags) ? scene.tags : []),
    ...(extras ?? []),
  ].join(' ').toLowerCase()
}

function normalizeQuery(value: string): string {
  return String(value ?? '').toLowerCase()
    .replace(/[，。！？、,.;；:：/\\|()[\]{}"'""'']+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function uniqueTerms(items: string[]): string[] {
  const seen = new Set<string>()
  return items.map(normalizeQuery).filter(t => t && !seen.has(t) && seen.add(t) as unknown as boolean)
}

function detectInside(query: string, term: string): boolean {
  if (!term) return false
  if (/^[\u3400-\u9fff]$/.test(term)) return query === term || query.split(' ').includes(term)
  return query.includes(term)
}

export function analyzeQuery(query: string, config: SceneUXConfig | null | undefined) {
  const normalized = normalizeQuery(query)
  if (!normalized) return { normalized: '', groups: [] as string[][], intents: [] as string[], residualTerms: [] as string[] }
  const aliases = config?.searchAliases ?? {}
  const groups: string[][] = [], intents: string[] = []
  let residual = normalized

  if (aliases[normalized]) {
    groups.push(uniqueTerms([normalized, ...(aliases[normalized] ?? [])]))
    intents.push(normalized); residual = ''
  } else {
    Object.entries(aliases).forEach(([intent, synonyms]) => {
      const terms = uniqueTerms([intent, ...(synonyms ?? [])])
      const hits = terms.filter(t => detectInside(normalized, t))
      if (!hits.length) return
      groups.push(terms); intents.push(intent)
      hits.sort((a, b) => b.length - a.length).forEach(h => { residual = residual.split(h).join(' ') })
    })
  }

  const stopPhrases = ['请帮我找','帮我找','我想画','想画一个','想画','想要一个','想要','给我一个','给我','来一个','来点','比较','有一点','有点','一幅','一张','一些','一个','这种','那种','感觉','风格','画面','场景']
  stopPhrases.sort((a, b) => b.length - a.length).forEach(p => { residual = residual.split(p).join(' ') })
  const stopSingles = new Set(['我','的','地','得','在','把','请','找','画','想','要','个','张','些','点'])
  const residualTerms = normalizeQuery(residual).split(' ').filter(t => t && !stopSingles.has(t))
  residualTerms.forEach(t => groups.push([t]))

  return { normalized, groups, intents, residualTerms }
}

export function matchesSearch(scene: Record<string, unknown>, query: string, config: SceneUXConfig | null | undefined, extras?: string[]): boolean {
  const { groups } = analyzeQuery(query, config)
  if (!groups.length) return true
  const hay = searchText(scene, extras)
  return groups.every(grp => grp.some(t => hay.includes(t.toLowerCase())))
}

export function searchScore(scene: Record<string, unknown>, query: string, config: SceneUXConfig | null | undefined, extras?: string[]): number {
  const { groups, normalized } = analyzeQuery(query, config)
  if (!groups.length) return 0
  const fields = [
    { value: scene.title, w: 36 }, { value: characterLabel(String(scene.char ?? '')), w: 30 },
    { value: scene.emotion, w: 28 }, { value: scene.location, w: 24 },
    { value: scene.weather, w: 22 }, { value: scene.category, w: 20 },
    { value: scene.story, w: 16 },
    { value: Array.isArray(scene.tags) ? scene.tags.join(' ') : '', w: 14 },
    { value: [scene.camera, scene.lighting, scene.season, scene.timeOfDay].join(' '), w: 10 },
    { value: (extras ?? []).join(' '), w: 8 },
  ]
  let score = groups.reduce((sum, grp) => {
    let best = 0
    grp.forEach(term => {
      const t = normalizeQuery(term)
      fields.forEach(f => { if (normalizeQuery(String(f.value ?? '')).includes(t)) best = Math.max(best, f.w + Math.min(t.length, 8)) })
    })
    return sum + best
  }, 0)
  const title = normalizeQuery(String(scene.title ?? ''))
  const story = normalizeQuery(String(scene.story ?? ''))
  if (normalized && title.includes(normalized)) score += 50
  else if (normalized && story.includes(normalized)) score += 24
  return score
}

function ratingAverage(rating: Record<string, number> | null | undefined): number {
  if (!rating) return 0
  const vals = ['face','expression','composition','hands','atmosphere'].map(k => Number(rating[k])).filter(v => v > 0 && v <= 5)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function normalizeChar(v: string): string {
  if (v === 'ayachi_nene') return 'nene'
  if (v === 'shiki_natsume') return 'natsume'
  if (v === 'both') return 'triad'
  return v || ''
}

function ensureStats(container: Record<string, SceneStats>, key: string): SceneStats {
  if (!container[key]) container[key] = { uses: 0, favorites: 0, ratingTotal: 0, rated: 0, lastUsed: 0, averageRating: 0 }
  return container[key]
}

export function buildPreferenceProfile(history: unknown[], now?: number): PreferenceProfile {
  const profile: PreferenceProfile = { entries: 0, ratedEntries: 0, favorites: 0, scenes: {}, characters: {}, generatedAt: now ?? Date.now() }
  ;(Array.isArray(history) ? history : []).forEach((entry: any) => {
    if (!entry || typeof entry !== 'object') return
    profile.entries++
    if (ratingAverage(entry.rating)) profile.ratedEntries++
    if (entry.favorite) profile.favorites++
    const sc = ensureStats(profile.scenes, entry.scene)
    const ch = ensureStats(profile.characters, normalizeChar(entry.character ?? ''))
    ;[sc, ch].forEach(s => {
      s.uses++
      if (entry.favorite) s.favorites++
      const avg = ratingAverage(entry.rating)
      if (avg) { s.ratingTotal += avg; s.rated++ }
      s.lastUsed = Math.max(s.lastUsed, Number(entry.timestamp ?? entry.id) || 0)
    })
  })
  ;[profile.scenes, profile.characters].forEach(map => Object.values(map).forEach(s => { s.averageRating = s.rated ? s.ratingTotal / s.rated : 0 }))
  return profile
}

function statsScore(stats: SceneStats | undefined, now: number): number {
  if (!stats) return 0
  let score = Math.min(stats.uses, 6) * 2 + Math.min(stats.favorites, 3) * 12
  if (stats.rated) score += (stats.averageRating - 3) * 8
  if (stats.lastUsed) {
    const days = Math.max(0, (now - stats.lastUsed) / 86400000)
    score += days <= 7 ? 4 : days <= 30 ? 2 : days <= 90 ? 1 : 0
  }
  return score
}

export function personalScore(scene: { id: string; char?: string }, profile: PreferenceProfile | null | undefined): number {
  if (!scene || !profile) return 0
  const now = profile.generatedAt || Date.now()
  return statsScore(profile.scenes?.[scene.id], now) + statsScore(profile.characters?.[normalizeChar(scene.char ?? '')], now) * 0.3
}

export function personalReason(scene: { id: string; char?: string }, profile: PreferenceProfile | null | undefined): string {
  if (!scene || !profile) return ''
  const ss = profile.scenes?.[scene.id]
  if (ss) {
    if (ss.favorites) return '你收藏过这个场景'
    if (ss.averageRating >= 4) return `你曾给出 ${ss.averageRating.toFixed(1)} 分`
    if (ss.uses >= 2) return `你已经创作过 ${ss.uses} 次`
  }
  const cs = profile.characters?.[normalizeChar(scene.char ?? '')]
  if (cs && cs.uses >= 3 && (cs.averageRating >= 3.8 || cs.favorites)) {
    return `符合你常画的${characterLabel(scene.char ?? '')}偏好`
  }
  return ''
}

export function isPersonalFavorite(scene: { id: string }, profile: PreferenceProfile | null | undefined): boolean {
  return !!(scene && profile?.scenes?.[scene.id]?.favorites)
}

function tagKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/**
 * 判断当前 story 是否仍等同于场景自带故事。
 * 用于「脱离场景」时决定该不该清空文本：场景原文要清，用户自己写的要留。
 */
export function isSceneBoundStory(scene: any, story: unknown, baseStory?: unknown): boolean {
  if (!scene) return false
  const current = String(story ?? '').replace(/\s+/g, ' ').trim()
  const original = String(baseStory || scene.story || '').replace(/\s+/g, ' ').trim()
  return !!current && !!original && current === original
}

/**
 * 从历史记录恢复手动标签。
 * 老记录没有 manual_tags 快照时，用兼容场景的 tags 兜底；
 * 若场景与当前角色不兼容，则剔除该场景的内建标签，只留用户真正手加的。
 */
export function restoreHistoryManualTags(entry: any, scene: any, sceneCompatible: boolean): string[] {
  const hasSnapshot = Array.isArray(entry?.manual_tags)
  const source: unknown[] = hasSnapshot
    ? entry.manual_tags
    : (scene && sceneCompatible && Array.isArray(scene.tags) ? scene.tags : [])
  const staleSceneTags = scene && !sceneCompatible
    ? new Set<string>((scene.tags || []).map(tagKey))
    : null
  const seen = new Set<string>()
  return source.filter((tag): tag is string => {
    if (typeof tag !== 'string' || !tag.trim()) return false
    const key = tagKey(tag)
    if (!key || (staleSceneTags && staleSceneTags.has(key)) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 场景不兼容时，不要把仍绑定该场景的故事文本带回来 */
export function restoreHistoryStory(entry: any, scene: any, sceneCompatible: boolean): string {
  const story = typeof entry?.story === 'string' ? entry.story : ''
  return scene && !sceneCompatible && isSceneBoundStory(scene, story, scene.story) ? '' : story
}

export function readRecent(storage?: Storage): Array<{ id: string; title: string; char: string; usedAt: number }> {
  try {
    const items = JSON.parse((storage ?? localStorage).getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(items) ? items.filter((i: any) => i?.id) : []
  } catch { return [] }
}

export function rememberRecent(scene: { id: string; title?: string; char?: string }, storage?: Storage): Array<{ id: string; title: string; char: string; usedAt: number }> {
  if (!scene?.id) return []
  const target = storage ?? localStorage
  const items = [{ id: scene.id, title: scene.title ?? '', char: scene.char ?? '', usedAt: Date.now() }, ...readRecent(target).filter(i => i.id !== scene.id)].slice(0, 8)
  try { target.setItem(RECENT_KEY, JSON.stringify(items)) } catch {}
  return items
}
