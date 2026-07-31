// Prompt policy — 从重构前 tools/prompt-policy.js + prompt-builder/prompt.js 迁移
// 负责：Danbooru 标签规范化、模型 profile 质量/负面前缀、LoRA 权重策略、
//       framing 冲突消解、场景模板净化、结构健康报告

export interface PromptPart {
  cls?: 'q' | 'c' | 't' | 'l' | 'n' | 'p'
  text: string
  [key: string]: unknown
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

export interface PromptScene {
  char?: string
  prompt?: string
  tags?: string[]
  lora?: string
  category?: string
  rating?: string
  mature?: boolean
}

const NEGATIVE_BOILERPLATE = new Set([
  'bad_quality', 'worst_quality', 'low_quality', 'normal_quality', 'worst_detail',
  'lowres', 'blurry', 'jpeg_artifacts', 'text', 'watermark', 'logo', 'signature',
  'username', 'sketch', 'censor', 'old', 'early', 'bad_anatomy', 'bad_hands',
  'mutated_hands', 'extra_fingers', 'missing_fingers', 'fused_fingers', 'extra_arms',
  'extra_legs', 'extra_limbs', 'deformed', 'bad_proportions', 'duplicate', 'cropped',
  'poorly_drawn_face',
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
  return String(text || '')
    .replace(/\s*,?\s*\bBREAK\b\s*,?\s*/gi, '\u0000BREAK\u0000')
    .split('\u0000BREAK\u0000')
    .map(section => section.trim())
}

function dedupeSegment(text: string, seen = new Set<string>()): string {
  return tokenize(text).filter(token => {
    const key = normalizeKey(token)
    if (!key || key === 'break' || seen.has(key)) return false
    seen.add(key)
    return true
  }).join(', ')
}

/** BREAK 是角色作用域边界；不同角色可以重复服装、表情等主体属性。 */
export function dedupeText(text: string, externalSeen?: Set<string>): string {
  const sections = splitBreaks(text)
  if (sections.length === 1) return dedupeSegment(sections[0], externalSeen ?? new Set())
  return sections
    .map(section => dedupeSegment(section, new Set()))
    .filter(Boolean)
    .join(' BREAK ')
}

export function sanitizePrompt(text: string): string {
  return dedupeText(String(text || '').replace(/\s+/g, ' '))
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

/**
 * v18 训练 caption 中实际出现的服装词组。
 *
 * 主控制词负责选择服装身份，后续词负责锁定官方配色、剪裁和腿部细节。
 * 这里故意不使用近义词或自然语言改写，避免网站提示词与训练语汇脱节。
 */
const TRAINED_OUTFIT_BUNDLES = {
  neneWitch: [
    'nene_witch_canonical', 'witch_hat', 'black_cape', 'criss-cross_halter',
    'crop_top', 'strap_between_breasts', 'pink_bow', 'pink_ribbon',
    'black_skirt', 'asymmetrical_legwear', 'striped_thighhighs',
    'single_thighhigh', 'single_sock', 'frilled_socks', 'midriff',
  ],
  neneSchool: [
    'nene_school_uniform', 'school_uniform', 'blazer', 'yellow_bowtie',
    'plaid_skirt', 'pleated_skirt', 'grey_skirt', 'black_thighhighs',
    'zettai_ryouiki',
  ],
  neneSailor: [
    'nene_sailor_uniform', 'school_uniform', 'grey_sailor_collar',
    'black_shirt', 'sailor_shirt', 'serafuku',
  ],
  neneRedCardigan: [
    'nene_red_cardigan_uniform', 'cardigan', 'white_shirt', 'pleated_skirt',
    'black_skirt', 'white_socks',
  ],
  neneBluePajamas: [
    'nene_blue_pajamas', 'pajamas', 'animal_print', 'cat_print',
    'long_sleeves',
  ],
  neneGreenSleepwear: [
    'nene_green_sleepwear', 'sleepwear', 'nightgown', 'polka_dot',
    'short_sleeves', 'twin_braids',
  ],
  neneBatDress: [
    'nene_bat_dress', 'black_dress', 'asymmetrical_clothes',
    'bat_hair_ornament', 'black_thighhighs', 'garter_straps',
  ],
  neneBlackDress: [
    'nene_black_dress', 'black_dress', 'skirt', 'garter_straps',
    'thighhighs',
  ],
  natsumeQipao: [
    'natsume_official_qipao', 'chinese_clothes', 'china_dress', 'red_dress',
    'floral_print', 'side_slit', 'long_sleeves', 'black_thighhighs',
    'hair_bun', 'double_bun', 'hair_flower', 'red_flower',
  ],
  natsumeCafe: [
    'natsume_cafe_uniform', 'white_shirt', 'suspenders', 'suspender_skirt',
    'brown_skirt', 'long_sleeves', 'collared_shirt', 'purple_ribbon',
    'hair_flower',
  ],
  natsumePinkCafe: [
    'natsume_pink_cafe_uniform', 'pink_shirt', 'pink_skirt', 'waist_apron',
    'white_apron', 'frills', 'striped',
  ],
  natsumeMaid: [
    'natsume_maid_uniform', 'maid', 'maid_apron', 'white_apron',
    'maid_headdress', 'long_sleeves', 'frills',
  ],
  natsumeWinter: [
    'natsume_winter_coat', 'coat', 'fur_trim', 'hair_ribbon', 'hair_flower',
  ],
  natsumeSleepwear: [
    'natsume_sleepwear', 'shirt', 'blue_shirt', 'pillow', 'on_bed',
  ],
} as const

function appendOutfitBundle(controls: string[], bundle: readonly string[]): void {
  controls.push(...bundle)
}

/**
 * 新一代统一角色 LoRA 的显式控制词。成人内容、官方服装都必须由场景
 * 明确触发，不能仅依赖训练集中的共现关系；旧模型不会收到未学习的新词。
 */
export function characterControlTokens(
  scene: PromptScene | null | undefined,
  character: string,
  activeLoras: Record<string, string> = {},
): string[] {
  if (!scene) return []
  const source = normalizeKey([scene.prompt || '', ...(scene.tags || [])].join(','))
  const controls: string[] = []
  const includesNene = character === 'nene' || character === 'triad'
  const includesNatsume = character === 'natsume' || character === 'triad'
  const neneSupportsControls = /ayachi_nene_v(?:18|19|[2-9]\d)/i.test(activeLoras.nene || '')
  const natsumeSupportsControls = /shiki_natsume_v(?:17|18|19|[2-9]\d)/i.test(activeLoras.natsume || '')

  if (includesNene && neneSupportsControls) {
    if (sceneRating(scene) === 'R18') controls.push('nene_r18')
    if (/(?:nene_witch_canonical|official(?:_ayachi_nene)?_witch|witch_costume)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.neneWitch)
    } else if (/(?:nene_sailor_uniform|grey_sailor_collar|sailor_shirt|serafuku)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.neneSailor)
    } else if (/(?:nene_red_cardigan_uniform|open_burgundy_cardigan|red_cardigan_uniform)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.neneRedCardigan)
    } else if (/(?:nene_blue_pajamas|sky_blue_patterned_button_up_pajama|cat_print)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.neneBluePajamas)
    } else if (/(?:nene_green_sleepwear|mint_green_polka_dot_pajama)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.neneGreenSleepwear)
    } else if (/(?:nene_bat_dress|bat_hair_ornament)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.neneBatDress)
    } else if (/(?:nene_black_dress)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.neneBlackDress)
    } else if (
      /(?:nene_school_uniform|navy_school_uniform|complete_navy_school_uniform)/.test(source)
      || (/(?:school_uniform|navy_blazer)/.test(source) && !/(?:magenta|red_cardigan)/.test(source))
    ) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.neneSchool)
    }
  }

  if (includesNatsume && natsumeSupportsControls) {
    if (sceneRating(scene) === 'R18') controls.push('natsume_r18')
    if (/(?:natsume_official_qipao|qipao|cheongsam|china_dress)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.natsumeQipao)
    } else if (/(?:natsume_pink_cafe_uniform|pink_cafe_uniform)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.natsumePinkCafe)
    } else if (/(?:natsume_maid_uniform|dark_gray_cafe_maid_dress|maid_uniform)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.natsumeMaid)
    } else if (/(?:natsume_cafe_uniform|cafe_uniform|suspender_skirt|dark_brown_suspender_skirt)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.natsumeCafe)
    } else if (/(?:natsume_winter_coat)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.natsumeWinter)
    } else if (/(?:natsume_sleepwear|pale_blue_pajamas_with_red_piping)/.test(source)) {
      appendOutfitBundle(controls, TRAINED_OUTFIT_BUNDLES.natsumeSleepwear)
    }
  }
  return [...new Set(controls)]
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

const WIDE_TOKENS = new Set(['full_body', 'wide_shot', 'long_shot', 'establishing_shot', 'deep_focus'])
const CLOSE_TOKENS = new Set([
  'close_up', 'extreme_close_up', 'portrait_shot', 'close_up_detail',
  'face_focus', 'upper_face', 'portrait', 'macro',
])
const MID_TOKENS = new Set(['medium_shot', 'upper_body', 'cowboy_shot', 'waist_up', 'half_body', 'bust'])

export function resolveFramingMode(shot?: string | null, manualTags: string[] = []): '' | 'wide' | 'close' | 'mid' {
  if (shot === 'wide') return 'wide'
  if (shot === 'close' || shot === 'detail') return 'close'
  if (shot === 'medium') return 'mid'
  if (shot) return ''
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
  const drop = mode === 'wide'
    ? new Set([...CLOSE_TOKENS, ...MID_TOKENS])
    : mode === 'close'
      ? new Set([...WIDE_TOKENS, ...MID_TOKENS])
      : new Set([...WIDE_TOKENS, ...CLOSE_TOKENS])
  return splitBreaks(text)
    .map(section => tokenize(section).filter(token => !drop.has(normalizeKey(token))).join(', '))
    .filter(Boolean)
    .join(' BREAK ')
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
  const positiveSeen = new Set<string>()
  const negativeSeen = new Set<string>()
  return parts.map(part => {
    if (part.cls === 'l') return part
    const seen = part.cls === 'n' ? negativeSeen : positiveSeen
    const scoped = /\bBREAK\b/i.test(part.text)
    return { ...part, text: dedupeText(part.text, scoped ? undefined : seen) }
  }).filter(part => part.text.trim())
}

// ── 双人构图增强 ──────────────────────────────────────────────────────────

export function enrichDualPrompt(template: string, neneTags: string[], natsumeTags: string[]): string {
  const sections = splitBreaks(template)
  const left = sections[0] || ''
  const right = sections[1] || ''
  const leftStart = left.lastIndexOf('(')
  const global = leftStart >= 0 ? left.slice(0, leftStart).replace(/,\s*$/, '') : left.replace(/,\s*$/, '')
  const leftBlock = leftStart >= 0 ? left.slice(leftStart) : ''
  const leftIsNatsume = /shiki_natsume/i.test(leftBlock)
  const rightIsNene = /ayachi_nene/i.test(right)
  const mergeSubject = (block: string, identityTags: string[]) => {
    let raw = block.trim()
    if (raw.startsWith('(')) raw = raw.slice(1)
    if (raw.endsWith(')')) raw = raw.slice(0, -1)
    return `(${dedupeText([...identityTags, ...tokenize(raw)].join(', '))})`
  }
  const enrichedLeft = mergeSubject(leftBlock, leftIsNatsume ? natsumeTags : neneTags)
  const enrichedRight = mergeSubject(right, rightIsNene ? neneTags : natsumeTags)
  return `${[global, enrichedLeft].filter(Boolean).join(', ')} BREAK ${enrichedRight}`
}

const NATSUME_IDENTITY_TOKENS = new Set([
  '1girl', 'solo', 'shiki_natsume', 'black_hair', 'long_hair', 'very_long_hair',
  'very_long_black_hair', 'yellow_eyes', 'golden_yellow_eyes', 'mole_under_eye',
  'hairclip', 'two_red_hairclips', 'two_red_hairclips_only', 'no_hair_ribbon',
])

const NATSUME_PARTNER_TOKENS = new Set([
  'holding_hands', 'holding_arm', 'interlocked_fingers', 'kissing', 'kiss', 'neck_kiss',
  'leaning_on_shoulder', 'lying_on_chest', 'sitting_on_lap', 'straddling',
  'straddling_viewer', 'trapping_viewer', 'trapped_by_viewer', 'clinging_to_viewer',
  'caught_by_viewer', 'close_face_to_face_distance', 'tense_close_contact',
])

function sanitizeNatsumeSoloTemplate(template: string): string {
  return splitBreaks(template).map(section => tokenize(section)
    .filter(token => {
      const key = normalizeKey(token)
      if (NATSUME_IDENTITY_TOKENS.has(key) || NATSUME_PARTNER_TOKENS.has(key)) return false
      // Keep camera POVs, but remove phrases that require a visible partner.
      return !/(?:^|_)(?:male|man|boy|viewer)(?:_|$)/.test(key) && !/^(?:1boy|1man)$/.test(key)
    })
    .join(', '))
    .filter(Boolean)
    .join(' BREAK ')
}

/** 场景是否支持该角色（避免把宁宁场景套到夏目身上） */
export function sceneSupportsCharacter(scene: PromptScene | null | undefined, char: string): boolean {
  if (!scene) return false
  const sceneChar = String(scene.char || '')
  if (!sceneChar) return true
  if (char === 'triad') return sceneChar === 'triad' || sceneChar === 'both'
  if (sceneChar === 'triad' || sceneChar === 'both') return true
  return sceneChar === char
}

/** 场景模板净化：剥 lora、_BREAK_ 规范化、framing 过滤。
 *
 * scene.tags 是 UI/检索元数据，不会自动进入最终 Prompt。此前把与其同名
 * 的模板 token 删除，会悄悄丢失 low_twintails、hair_ribbon、two_red_hairclips
 * 等身份和服装锚点；手动 tag 的去重由调用方在后续阶段完成。
 */
export function sceneTemplateText(
  scene: PromptScene | null | undefined,
  opts: { char?: string; manualTags?: Set<string>; shot?: string | null } = {},
): string {
  if (!scene?.prompt) return ''
  let template = String(scene.prompt)
    .replace(/<lora:[^>]+>/gi, '')
    .replace(/_BREAK_/gi, ' BREAK ')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .join(', ')

  if (opts.char === 'triad') {
    template = enrichDualPrompt(
      template,
      ['ayachi_nene', 'white_hair', 'very_long_hair', 'low_twintails', 'purple_eyes', 'ahoge', 'hair_ribbon'],
      ['shiki_natsume', 'black_hair', 'long_hair', 'yellow_eyes', 'mole_under_eye', 'hairclip'],
    )
  } else if (opts.char === 'natsume') {
    // The character line supplies the canonical identity; scenes remain solo regardless of old interaction tags.
    template = sanitizeNatsumeSoloTemplate(template)
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
  scene: PromptScene | null | undefined,
  loraMeta: LoraMeta[],
  fallbackByChar: Record<string, string>,
  context: { shot?: string | null; manualTags?: Set<string> } = {},
): LoraSpec[] {
  const raw = scene?.lora ? scene.lora : (fallbackByChar[character] || '')
  const refs = String(raw).split(',').map(value => {
    const clean = value.trim().replace(/^<lora:/i, '').replace(/>$/, '')
    const parts = clean.split(':')
    let name = (parts[0] || '').trim()
    // 场景库存保留历史版本号时，运行时统一迁移到 characters.json 的正式模型。
    if (/^ayachi_nene_v\d+/i.test(name) && fallbackByChar.nene) name = fallbackByChar.nene
    if (/^shiki_natsume_v\d+/i.test(name) && fallbackByChar.natsume) name = fallbackByChar.natsume
    return { name, explicit: Number(parts[1]) }
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
  const positive: string[] = []
  const negative: string[] = []
  let hasBreak = false
  const warnings: string[] = []
  parts.forEach(part => {
    if (/\bBREAK\b/i.test(part.text)) hasBreak = true
    if (part.cls === 'l') return
    const target = part.cls === 'n' ? negative : positive
    splitBreaks(part.text.replace(/^\s*\[NEG\]\s*/i, '')).forEach(section => {
      tokenize(section).forEach(token => {
        if (!/^<lora:/i.test(token)) target.push(normalizeKey(token))
      })
    })
  })
  const framingFamilies = new Set(positive.map(token =>
    WIDE_TOKENS.has(token) ? 'wide' : CLOSE_TOKENS.has(token) ? 'close' : MID_TOKENS.has(token) ? 'mid' : '',
  ).filter(Boolean))
  if (framingFamilies.size > 1) warnings.push('镜头景别相互竞争')
  if (!hasBreak && positive.includes('closed_eyes') && positive.includes('looking_at_viewer')) warnings.push('闭眼与直视镜头冲突')
  if (!hasBreak && ['standing', 'sitting', 'lying', 'kneeling'].filter(pose => positive.includes(pose)).length > 1) {
    warnings.push('主体姿势相互冲突')
  }
  const negativeSet = new Set(negative)
  const overlap = [...new Set(positive.filter(tag => negativeSet.has(tag)))]
  if (overlap.length) warnings.push('正负词冲突：' + overlap.slice(0, 3).join('、'))
  let level: 'ok' | 'warn' | 'over' = 'ok'
  let label = '结构均衡'
  if (positive.length > 90) { level = 'over'; label = '标签过载'; warnings.push('正向标签超过 90 个，模型容易忽略后段。') }
  else if (positive.length > 72) { level = 'warn'; label = '偏长'; warnings.push('正向标签超过 72 个，建议精简。') }
  else if (positive.length < 8) { level = 'warn'; label = '信息偏少'; warnings.push('正向标签过少，画面可能缺少细节。') }
  const violations = checkArtDirection(parts.map(p => p.text).join(', '))
  if (violations.length) warnings.push('违反美术规范：' + violations.join(', '))
  if (warnings.length && level === 'ok') { level = 'warn'; label = warnings[0] }
  if (warnings.length > 2) level = 'over'
  return { positiveCount: positive.length, negativeCount: negative.length, level, label, warnings }
}
