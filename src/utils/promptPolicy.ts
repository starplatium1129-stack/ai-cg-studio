// Prompt policy — 从重构前 tools/prompt-policy.js + prompt-builder/prompt.js 迁移
// 负责：Danbooru 标签规范化、模型 profile 质量/负面前缀、LoRA 权重策略、
//       framing 冲突消解、场景模板净化、结构健康报告

export interface PromptPart {
  cls?: 'q' | 'c' | 't' | 'l' | 'n' | 'p'
  text: string
}

export interface ModelProfile {
  id?: string
  name?: string
  match?: string[]
  quality_prefix?: string
  negative_prefix?: string
  negative_mode?: 'merge' | 'replace'
  negative_replace_scope?: 'boilerplate' | 'all'
  rating_all?: string
  rating_r15?: string
  rating_r18?: string
  sampler?: string
  scheduler?: string
  steps?: number
  cfg?: number
  size?: string
  hires_steps?: number
  hires_scale?: number
  hires_upscaler?: string
  hires_denoising_strength?: number
  [k: string]: unknown
}

export interface LoraMeta {
  name?: string
  strength?: { default?: number; min?: number; max?: number }
  recommended_weight?: { portrait?: number; fullbody?: number; complex_scene?: number }
  [k: string]: unknown
}

const NEGATIVE_BOILERPLATE = new Set([
  'bad_quality', 'worst_quality', 'low_quality', 'normal_quality', 'lowres', 'blurry',
  'jpeg_artifacts', 'text', 'watermark', 'logo', 'signature', 'bad_anatomy', 'bad_hands',
  'mutated_hands', 'extra_fingers', 'missing_fingers', 'extra_arms', 'extra_legs',
  'deformed', 'duplicate', 'cropped', 'poorly_drawn_face',
])

/** 已知多词 Danbooru 标签：空格 → 下划线（长度降序，避免短词先匹配） */
const UNDERSCORE_TAGS = [
  'beautiful detailed eyes', 'chromatic aberration', 'depth of field',
  'volumetric lighting', 'dramatic lighting', 'natural lighting', 'studio lighting',
  'back lighting', 'side lighting', 'rim lighting', 'soft lighting', 'hard lighting',
  'extreme close up', 'dynamic angle', 'portrait shot', 'cowboy shot',
  'upper body', 'full body', 'medium shot', 'long shot', 'close up', 'wide shot',
  'dutch angle', 'pov shot', 'half closed eyes', 'crossed arms',
  'hands on hips', 'hand on chest', 'arms behind back', 'arms up',
  'sparkling eyes', 'glowing eyes', 'detailed eyes', 'narrowed eyes', 'wide eyes',
  'open mouth', 'closed mouth', 'parted lips', 'tongue out',
  'golden hour', 'window light', 'pink tone', 'warm light', 'soft light', 'lantern light',
  'loose hair', 'wet hair', 'short hair', 'long hair',
  'school uniform', 'off shoulder', 'crop top', 'mini skirt', 'pleated skirt',
  'thigh highs', 'hair ribbon', 'hair clip', 'hair ornament',
  'cat ears', 'sailor collar', 'open jacket', 'elbow gloves',
  'puffy sleeves', 'detached sleeves', 'frilled skirt',
  'cherry blossom', 'rule of thirds', 'centered composition', 'framed composition',
  'foreground framing', 'by window', 'cool palette', 'warm color palette',
].sort((a, b) => b.length - a.length)

/** Danbooru 规范化：逗号分段后空格/连字符 → 下划线 */
export function norm(text: string): string {
  return String(text || '')
    .split(',')
    .map(seg => {
      let s = seg.trim()
      if (!s) return ''
      // lora 语法保持原样
      if (/^<lora:/i.test(s)) return s
      if (/^BREAK$/i.test(s)) return 'BREAK'
      const lower = s.toLowerCase()
      for (const tag of UNDERSCORE_TAGS) {
        if (lower === tag) return tag.replace(/\s+/g, '_')
      }
      return s.replace(/[\s-]+/g, '_')
    })
    .filter(Boolean)
    .join(', ')
}

export function normalizeKey(token: string): string {
  return String(token || '')
    .replace(/^\s*\[NEG\]\s*/i, '')
    .replace(/^\s*<lora:|>\s*$/gi, '')
    .replace(/^\s*\(+|\)+\s*$/g, '')
    .replace(/:\s*-?\d+(?:\.\d+)?\s*$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, '_')
}

export function tokenize(text: string): string[] {
  return String(text || '').split(',').map(token => token.trim()).filter(Boolean)
}

export function splitBreaks(text: string): string[] {
  return String(text || '').split(/\bBREAK\b/i).map(s => s.trim()).filter(Boolean)
}

function dedupeSegment(text: string, seen = new Set<string>()): string {
  return tokenize(text).filter(token => {
    const key = normalizeKey(token)
    if (!key || key === 'break' || seen.has(key)) return false
    seen.add(key)
    return true
  }).join(', ')
}

export function sanitizePrompt(text: string): string {
  return dedupeSegment(String(text || '').replace(/\s+/g, ' '), new Set())
}

export function mergeTokenText(...texts: string[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  texts.forEach(text => {
    tokenize(text).forEach(token => {
      const key = normalizeKey(token)
      if (!seen.has(key)) { seen.add(key); out.push(token) }
    })
  })
  return out.join(', ')
}

export function isNegativeBoilerplate(token: string): boolean {
  return NEGATIVE_BOILERPLATE.has(normalizeKey(token))
}

export function mergeNegativePrompt(
  prefix: string,
  base = '',
  mode: 'merge' | 'replace' = 'merge',
  replaceScope: 'boilerplate' | 'all' = 'boilerplate',
): string {
  if (mode !== 'replace') return dedupeSegment([prefix, base].filter(Boolean).join(', '), new Set())
  if (replaceScope === 'all') return dedupeSegment(prefix, new Set())
  const semantic = tokenize(base).filter(token => !isNegativeBoilerplate(token))
  return dedupeSegment([prefix, ...semantic].filter(Boolean).join(', '), new Set())
}

// ── 模型 profile ───────────────────────────────────────────────────────────

function normalizeModelName(name: string): string {
  return String(name || '').toLowerCase().replace(/\.(safetensors|ckpt)$/i, '').replace(/\s*\[[0-9a-f]+\]\s*$/i, '').trim()
}

/** 按当前 checkpoint 名匹配 model_profiles；匹配不到时回退首个 profile（本站 LoRA 基于 WAI/Illustrious） */
export function resolveModelProfile(profiles: ModelProfile[], modelName?: string): ModelProfile | null {
  const list = Array.isArray(profiles) ? profiles : []
  if (!list.length) return null
  const target = normalizeModelName(modelName || '')
  if (target) {
    const hit = list.find(p =>
      (p.match || []).some(m => {
        const key = normalizeModelName(String(m))
        return key && (target.includes(key) || key.includes(target))
      }),
    )
    if (hit) return hit
  }
  return list[0]
}

export function sceneRating(scene: unknown): 'R18' | 'R15' | 'ALL' {
  const s = (scene ?? {}) as { rating?: unknown; mature?: unknown }
  const rating = String(s.rating || '').toUpperCase()
  if (rating === 'R18' || s.mature) return 'R18'
  if (rating === 'R15') return 'R15'
  return 'ALL'
}

function profileRatingTag(profile: ModelProfile | null, scene: unknown): string {
  if (!profile) return ''
  const rating = sceneRating(scene)
  if (rating === 'R18') return String(profile.rating_r18 || '')
  if (rating === 'R15') return String(profile.rating_r15 || '')
  return String(profile.rating_all || '')
}

/** 质量前缀：模型 profile 优先，并按分级追加 rating 标签 */
export function qualityPrefix(profile: ModelProfile | null, scene?: unknown): string {
  const prefix = profile?.quality_prefix || 'masterpiece, best quality, very aesthetic, absurdres'
  const rating = profileRatingTag(profile, scene)
  return norm(rating ? mergeTokenText(prefix, rating) : prefix)
}

/** 负面前缀：按 profile 的 merge/replace 策略与场景负面合并 */
export function modelNegativePrompt(profile: ModelProfile | null, baseNegative: string): string {
  const prefix = profile?.negative_prefix || ''
  if (!prefix) return baseNegative || ''
  return mergeNegativePrompt(
    prefix,
    baseNegative || '',
    (profile?.negative_mode as 'merge' | 'replace') || 'merge',
    (profile?.negative_replace_scope as 'boilerplate' | 'all') || 'boilerplate',
  )
}

export function adaptNegative(
  text: string,
  scene?: unknown,
  context: { shot?: string | null; character?: string | null } = {},
): string {
  const rating = sceneRating(scene)
  const remove = new Set<string>()
  if (rating === 'R18') ['nsfw', 'nude', 'naked', 'explicit'].forEach(tag => remove.add(tag))
  if (rating === 'R15') remove.add('nsfw')
  if (context.shot === 'close' || context.shot === 'detail') remove.add('cropped')
  if (context.character === 'triad') remove.add('duplicate')

  const tokens = tokenize(text).filter(token => !remove.has(normalizeKey(token)))
  const required = rating === 'R18'
    ? ['child', 'loli', 'underage']
    : rating === 'R15' ? ['nude', 'explicit'] : ['nsfw', 'nude', 'explicit']
  required.forEach(tag => tokens.push(tag))
  return dedupeSegment(tokens.join(', '), new Set())
}

// ── Framing（镜头冲突消解） ────────────────────────────────────────────────

const WIDE_TOKENS = new Set(['full_body', 'wide_shot', 'long_shot', 'deep_focus'])
const CLOSE_TOKENS = new Set(['close_up', 'extreme_close_up', 'portrait_shot', 'close_up_detail', 'macro'])
const MID_TOKENS = new Set(['medium_shot', 'upper_body', 'cowboy_shot', 'half_body', 'bust'])

export function resolveFramingMode(shot?: string | null, manualTags: string[] = []): '' | 'wide' | 'close' | 'mid' {
  if (shot === 'wide') return 'wide'
  if (shot === 'close' || shot === 'detail') return 'close'
  if (shot === 'medium') return 'mid'
  const keys = manualTags.map(normalizeKey)
  if (keys.some(k => WIDE_TOKENS.has(k))) return 'wide'
  if (keys.some(k => CLOSE_TOKENS.has(k))) return 'close'
  if (keys.some(k => MID_TOKENS.has(k))) return 'mid'
  return ''
}

/** 同一 prompt 里不能既 close_up 又 full_body：保留当前镜头，剔除冲突项 */
export function filterFraming(text: string, shot?: string | null): string {
  const mode = resolveFramingMode(shot)
  if (!mode) return text
  const drop = mode === 'wide' ? CLOSE_TOKENS : mode === 'close' ? WIDE_TOKENS : new Set([...WIDE_TOKENS, ...CLOSE_TOKENS])
  return tokenize(text).filter(token => !drop.has(normalizeKey(token))).join(', ')
}

export function applyFraming(parts: PromptPart[], shot?: string | null): PromptPart[] {
  const mode = resolveFramingMode(shot)
  if (!mode) return parts
  return parts.map(part => {
    if (part.cls === 'n' || part.cls === 'l') return part
    return { ...part, text: filterFraming(part.text, shot) }
  }).filter(part => part.text.trim())
}

export function dedupeParts(parts: PromptPart[]): PromptPart[] {
  const seen = new Set<string>()
  return parts.map(part => {
    if (part.cls === 'n' || part.cls === 'l') return part
    return { ...part, text: dedupeSegment(part.text, seen) }
  }).filter(part => part.text.trim())
}

// ── 双人构图增强 ──────────────────────────────────────────────────────────

export function enrichDualPrompt(template: string, neneTags: string[], natsumeTags: string[]): string {
  const base = String(template || '').trim()
  const nene = norm(neneTags.join(', '))
  const natsume = norm(natsumeTags.join(', '))
  const dual = `2girls, ${nene} BREAK ${natsume}`
  return base ? `${base} BREAK ${dual}` : dual
}

/** 场景是否支持该角色（避免把宁宁场景套到夏目身上） */
export function sceneSupportsCharacter(scene: any, char: string): boolean {
  if (!scene) return false
  const sceneChar = String(scene.char || '')
  if (!sceneChar) return true
  if (char === 'triad') return sceneChar === 'triad' || sceneChar === 'both'
  if (sceneChar === 'triad' || sceneChar === 'both') return true
  return sceneChar === char
}

/** 场景模板净化：剥 lora、_BREAK_ 规范化、去掉与 scene.tags 重复项、framing 过滤 */
export function sceneTemplateText(
  scene: any,
  opts: { char?: string; manualTags?: Set<string>; shot?: string | null } = {},
): string {
  if (!scene?.prompt) return ''
  const manual = opts.manualTags ?? new Set<string>()
  const sceneTags = new Set((scene.tags || []).map((t: string) => normalizeKey(t)))
  let template = String(scene.prompt)
    .replace(/<lora:[^>]+>/gi, '')
    .replace(/_BREAK_/gi, ' BREAK ')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .filter(token => {
      const key = normalizeKey(token)
      if (key === 'break') return true
      return !sceneTags.has(key) || manual.has(key)
    })
    .join(', ')

  if (opts.char === 'triad') {
    template = enrichDualPrompt(
      template,
      ['ayachi_nene', 'white_hair', 'very_long_hair', 'low_twintails', 'purple_eyes', 'ahoge', 'hair_ribbon'],
      ['shiki_natsume', 'black_hair', 'long_hair', 'yellow_eyes', 'mole_under_eye', 'hairclip'],
    )
  }
  return filterFraming(norm(template), opts.shot)
}

// ── LoRA 权重策略 ─────────────────────────────────────────────────────────

export interface LoraSpec { name: string; weight: number }

/**
 * LoRA 权重按镜头动态解析（重构前的关键质量逻辑）：
 * 场景显式权重 > 双人 0.62 > 复杂场景 complex_scene > 全身 fullbody > 特写 portrait > strength.default
 */
export function resolveLoraSpecs(
  character: string,
  scene: any,
  loraMeta: LoraMeta[],
  fallbackByChar: Record<string, string>,
  context: { shot?: string | null; manualTags?: Set<string> } = {},
): LoraSpec[] {
  const raw = scene?.lora ? scene.lora : (fallbackByChar[character] || '')
  const refs = String(raw).split(',').map(value => {
    const clean = value.trim().replace(/^<lora:/i, '').replace(/>$/, '')
    const parts = clean.split(':')
    return { name: (parts[0] || '').trim(), explicit: Number(parts[1]) }
  }).filter(item => item.name)
  if (!refs.length) return []

  const dual = character === 'triad' || refs.length > 1
  const complex = scene && (scene.category === '战斗' || scene.category === 'Active_Sync_Scenes')
  const mode = resolveFramingMode(context.shot, [...(context.manualTags ?? new Set<string>())])
  const wide = mode === 'wide'
  const portrait = mode === 'close'

  return refs.map(ref => {
    const meta = loraMeta.find(m => m?.name === ref.name) || null
    const recommended = meta?.recommended_weight || {}
    let base = Number(meta?.strength?.default)
    if (!Number.isFinite(base)) base = 0.8
    const weight = Number.isFinite(ref.explicit)
      ? ref.explicit
      : dual ? 0.62
      : complex ? (Number(recommended.complex_scene) || 0.7)
      : wide ? (Number(recommended.fullbody) || 0.75)
      : portrait ? (Number(recommended.portrait) || 0.85)
      : base
    return { name: ref.name, weight: Number(Number(weight).toFixed(2)) }
  })
}

export function loraSpecText(spec: LoraSpec): string {
  return `${spec.name}:${spec.weight}`
}

// ── 结构健康报告 ──────────────────────────────────────────────────────────

export const BANNED_TAGS = [
  'neon', 'glowing', 'oversaturated', 'vivid colors', 'vivid', 'rainbow',
  'high contrast', 'harsh lighting', 'extremely detailed', 'ultra detailed',
]

export function checkArtDirection(text: string): string[] {
  const lower = String(text || '').toLowerCase()
  return BANNED_TAGS.filter(t =>
    lower.includes(t.toLowerCase()) || lower.includes(t.toLowerCase().replace(/\s/g, '_')),
  )
}

export interface PromptReport {
  positiveCount: number
  negativeCount: number
  level: 'ok' | 'warn' | 'over'
  label: string
  warnings: string[]
}

/** 逗号标签数统计（不冒充具体模型 tokenizer） */
export function analyzeParts(parts: PromptPart[]): PromptReport {
  let positiveCount = 0
  let negativeCount = 0
  const warnings: string[] = []
  parts.forEach(part => {
    const count = tokenize(part.text.replace(/^\s*\[NEG\]\s*/i, '')).length
    if (part.cls === 'n') negativeCount += count
    else if (part.cls !== 'l') positiveCount += count
  })
  let level: 'ok' | 'warn' | 'over' = 'ok'
  let label = '结构均衡'
  if (positiveCount > 90) { level = 'over'; label = '标签过载'; warnings.push('正向标签超过 90 个，模型容易忽略后段。') }
  else if (positiveCount > 72) { level = 'warn'; label = '偏长'; warnings.push('正向标签超过 72 个，建议精简。') }
  else if (positiveCount < 8) { level = 'warn'; label = '信息偏少'; warnings.push('正向标签过少，画面可能缺少细节。') }
  const violations = checkArtDirection(parts.map(p => p.text).join(', '))
  if (violations.length) warnings.push('违反美术规范：' + violations.join(', '))
  return { positiveCount, negativeCount, level, label, warnings }
}

export function splitPromptBlocks(text: string): { positive: string; negative: string } {
  const [positive, negative = ''] = String(text || '').split(/\n?\s*\[NEG\]\s*\n?/i)
  return { positive: positive.trim(), negative: negative.trim() }
}
