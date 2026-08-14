// 热门角色无 LoRA 创作模式 —— 数据解析、资格门控与结构化输入构建。
// 纯 TS 无 DOM：数据经 sceneStore 单例加载后传入，本模块只做派生与门控。
// 命名遵循 src/utils/ 既有风格（promptPolicy / sceneInference）。

import { createPromptPlan, renderPromptPlan, type PromptPlan } from './promptCompiler.ts'
import {
  assembleNegative,
  profileRatingTag,
  type ModelProfile,
} from './promptPolicy.ts'
import type { ResolvedStyle } from '@/config/kreaStyleRecipes.ts'

export type AdultEligibility = 'adult' | 'unknown' | 'underage'

export interface PopularOutfit {
  id: string
  name: string
  prose: string
  tokens: string[]
  default?: boolean
}

export interface PopularCharacter {
  id: string
  displayName: string
  originalName: string
  franchise: string
  aliases: string[]
  identityProse: string
  identityTokens: string[]
  exactTokens: string[]
  exactPrefixes: string[]
  recommendedEngine: string
  supportedEngines: string[]
  adultEligibility: AdultEligibility
  outfits: PopularOutfit[]
}

export interface SceneBlueprint {
  id: string
  title: string
  category: string
  description: string
  /** 归属角色：角色原型场景蓝图必须携带；通用蓝图可为空。 */
  characterId?: string
  location: string
  action: string
  timeOfDay: string
  lighting: string
  camera: string
  mood: string
  sceneTags: string[]
  promptProse: string
  promptTokens: string[]
  negativeTokens: string[]
  recommendedSize: string
  adult: boolean
  /** 可选：Krea 2 风格配方 id 或自由风格短语（缺省按引擎取默认配方）。 */
  kreaStyleHint?: string
  /** 可选：Anima 风格配方 id 或自由风格短语。 */
  animaStyleHint?: string
  /** 可选：成人蓝图专属 NSFW 内容标签；只在 adult 角色 + adultEnabled 同时放行时注入。 */
  nsfwTokens?: string[]
  /** 可选：成人蓝图专属 NSFW 内容散文（Krea 与 Anima caption 使用）；fail-closed 同标签。 */
  nsfwProse?: string
}

export type DrawSubject =
  | { kind: 'studio' }
  | { kind: 'popular'; characterId: string; outfitId: string; blueprintId: string | null }

export interface PopularBlueprintDecision {
  shot: string | null
  lighting: string | null
  composition: string | null
  colorMood: string | null
  size: string
}

// ── 严格解析 ───────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = stringValue(record[key])
  if (!value) throw new Error(`popular data: ${key} must be a non-empty string`)
  return value
}

function requiredStringList(record: Record<string, unknown>, key: string): string[] {
  const value = stringList(record[key])
  if (!value.length) throw new Error(`popular data: ${key} must be a non-empty string array`)
  return value
}

function parseAdultEligibility(value: unknown): AdultEligibility {
  if (value === 'adult' || value === 'unknown' || value === 'underage') return value
  throw new Error('popular data: adultEligibility must be one of adult/unknown/underage')
}

function parseOutfit(value: unknown): PopularOutfit | null {
  if (!isRecord(value)) return null
  const id = requiredString(value, 'id')
  const tokens = stringList(value.tokens)
  if (!tokens.length) throw new Error(`popular data: outfit ${id} requires tokens`)
  return {
    id,
    name: requiredString(value, 'name'),
    prose: requiredString(value, 'prose'),
    tokens,
    default: value.default === true,
  }
}

export function parsePopularCharacter(value: unknown): PopularCharacter | null {
  if (!isRecord(value)) return null
  const id = requiredString(value, 'id')
  const identityTokens = requiredStringList(value, 'identityTokens')
  const exactTokens = stringList(value.exactTokens)
  const exactPrefixes = stringList(value.exactPrefixes)
  const outfits = (Array.isArray(value.outfits) ? value.outfits : [])
    .map(parseOutfit)
    .filter((outfit): outfit is PopularOutfit => outfit !== null)
  if (!outfits.length) throw new Error(`popular data: ${id} requires at least one outfit`)
  const adultEligibility = parseAdultEligibility(value.adultEligibility)
  return {
    id,
    displayName: requiredString(value, 'displayName'),
    originalName: requiredString(value, 'originalName'),
    franchise: requiredString(value, 'franchise'),
    aliases: stringList(value.aliases),
    identityProse: requiredString(value, 'identityProse'),
    identityTokens,
    exactTokens,
    exactPrefixes,
    recommendedEngine: requiredString(value, 'recommendedEngine'),
    supportedEngines: stringList(value.supportedEngines),
    adultEligibility,
    outfits,
  }
}

export function parsePopularCharacters(value: unknown): PopularCharacter[] {
  const source = isRecord(value) && Array.isArray(value.characters)
    ? value.characters
    : Array.isArray(value) ? value : []
  const list = source.map(parsePopularCharacter).filter((item): item is PopularCharacter => item !== null)
  const seen = new Set<string>()
  for (const character of list) {
    if (seen.has(character.id)) throw new Error(`popular data: duplicated character id ${character.id}`)
    seen.add(character.id)
    const outfitIds = new Set<string>()
    for (const outfit of character.outfits) {
      if (outfitIds.has(outfit.id)) throw new Error(`popular data: ${character.id} has duplicated outfit id ${outfit.id}`)
      outfitIds.add(outfit.id)
    }
  }
  return list
}

export function parseSceneBlueprint(value: unknown): SceneBlueprint | null {
  if (!isRecord(value)) return null
  const id = requiredString(value, 'id')
  return {
    id,
    title: requiredString(value, 'title'),
    category: requiredString(value, 'category'),
    description: requiredString(value, 'description'),
    characterId: stringValue(value.characterId) || undefined,
    location: requiredString(value, 'location'),
    action: requiredString(value, 'action'),
    timeOfDay: requiredString(value, 'timeOfDay'),
    lighting: requiredString(value, 'lighting'),
    camera: requiredString(value, 'camera'),
    mood: requiredString(value, 'mood'),
    sceneTags: stringList(value.sceneTags),
    promptProse: requiredString(value, 'promptProse'),
    promptTokens: requiredStringList(value, 'promptTokens'),
    negativeTokens: stringList(value.negativeTokens),
    recommendedSize: requiredString(value, 'recommendedSize'),
    adult: value.adult === true,
    kreaStyleHint: stringValue(value.kreaStyleHint),
    animaStyleHint: stringValue(value.animaStyleHint),
    nsfwTokens: stringList(value.nsfwTokens),
    nsfwProse: stringValue(value.nsfwProse),
  }
}

export function parseSceneBlueprints(value: unknown): SceneBlueprint[] {
  const source = isRecord(value) && Array.isArray(value.blueprints)
    ? value.blueprints
    : Array.isArray(value) ? value : []
  const list = source.map(parseSceneBlueprint).filter((item): item is SceneBlueprint => item !== null)
  const seen = new Set<string>()
  for (const blueprint of list) {
    if (seen.has(blueprint.id)) throw new Error(`blueprints: duplicated blueprint id ${blueprint.id}`)
    seen.add(blueprint.id)
  }
  return list
}

// ── 查询 ──────────────────────────────────────────────────────────────────

export function findCharacter(characters: PopularCharacter[], id: string): PopularCharacter | null {
  return characters.find(character => character.id === id) ?? null
}

export function findOutfit(character: PopularCharacter, outfitId: string): PopularOutfit | null {
  return character.outfits.find(outfit => outfit.id === outfitId) ?? null
}

export function defaultOutfit(character: PopularCharacter): PopularOutfit {
  return character.outfits.find(outfit => outfit.default) ?? character.outfits[0]
}

export function findBlueprint(blueprints: SceneBlueprint[], id: string): SceneBlueprint | null {
  return blueprints.find(blueprint => blueprint.id === id) ?? null
}

// ── 成人资格门控（fail closed） ────────────────────────────────────────────

/** 蓝图是否对指定角色可见：成人蓝图只能被 adult 角色 + 成熟内容开关同时放行。 */
export function blueprintEligible(
  blueprint: SceneBlueprint,
  character: PopularCharacter | null,
  opts: { adultEnabled?: boolean } = {},
): boolean {
  if (!blueprint.adult) return true
  if (opts.adultEnabled !== true) return false
  return character?.adultEligibility === 'adult'
}

export function eligibleBlueprints(
  blueprints: SceneBlueprint[],
  character: PopularCharacter | null,
  opts: { adultEnabled?: boolean; category?: string } = {},
): SceneBlueprint[] {
  return blueprints.filter(blueprint =>
    blueprintEligible(blueprint, character, opts)
    && (!blueprint.characterId || character == null || blueprint.characterId === character.id)
    && (!opts.category || opts.category === 'all' || blueprint.category === opts.category),
  )
}

export function blueprintCategories(blueprints: SceneBlueprint[]): string[] {
  return [...new Set(blueprints.map(blueprint => blueprint.category))].sort((a, b) => a.localeCompare(b, 'zh'))
}

// ── 确定性轮换 ─────────────────────────────────────────────────────────────

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rotateBlueprints(list: SceneBlueprint[], key: string, cursor: number): SceneBlueprint[] {
  const rng = mulberry32(hashString(`${key}#${cursor}`))
  const shuffled = [...list]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

function sameIds(left: SceneBlueprint[], right: string[] | null): boolean {
  if (!right || !right.length) return false
  if (left.length !== right.length) return false
  return left.every((blueprint, index) => blueprint.id === right[index])
}

/**
 * 「换一批」的确定性轮换：seed = 角色 + 服装 + cursor，连续 cursor 给出不同
 * 排列；当前推荐与前一批相同或数量不足时自动前进，避免立即重复。
 */
export function recommendBlueprints(
  list: SceneBlueprint[],
  key: string,
  cursor: number,
  previousIds: string[] | null,
  count = 3,
  characterId?: string | null,
): SceneBlueprint[] {
  // 角色感知：传入 characterId 时只从该角色的原型场景中轮转；缺省保持全量行为。
  const pool = characterId
    ? list.filter(blueprint => blueprint.characterId === characterId)
    : list
  if (pool.length === 0) return []
  if (pool.length <= count) return pool
  let attempt = cursor
  let picked = rotateBlueprints(pool, key, attempt).slice(0, count)
  while (sameIds(picked, previousIds) && attempt < cursor + 8) {
    attempt += 1
    picked = rotateBlueprints(pool, key, attempt).slice(0, count)
  }
  return picked
}

// ── 蓝图 → 导演决策推断 ────────────────────────────────────────────────────

const CAMERA_TO_SHOT: Record<string, string> = {
  closeup: 'close', 'close-up': 'close', close_up: 'close', close: 'close',
  'medium shot': 'medium', half_body: 'medium', medium: 'medium',
  'wide shot': 'wide', wide_shot: 'wide', full_body: 'wide', wide: 'wide',
  pov: 'pov', 'high angle': 'high', from_above: 'high', 'low angle': 'low',
  from_below: 'low', 'side view': 'side', looking_back: 'turn', 'front view': 'turn',
}
const LIGHTING_TO_ID: Record<string, string> = {
  golden: 'golden', 'golden hour': 'golden', sunset: 'golden', dusk: 'golden',
  window: 'window', 'window light': 'window', backlight: 'back', backlit: 'back',
  'rim light': 'back', moonlight: 'moon', moon: 'moon', night: 'moon',
  lantern: 'lantern', candlelight: 'lantern', candle: 'lantern', lamp: 'lantern', overcast: 'overcast',
}
const MOOD_TO_COLOR: Record<string, string> = {
  warm: 'warmth', cozy: 'warmth', tender: 'warmth',
  calm: 'calm', serene: 'calm', quiet: 'calm', tranquil: 'calm',
  nostalgic: 'calm', wistful: 'calm',
  mystical: 'tension', mysterious: 'tension', melancholic: 'sad', sad: 'sad',
  lively: 'joy', hopeful: 'joy', lighthearted: 'joy',
}

function matchFirst(text: string, table: Record<string, string>): string | null {
  const lower = text.toLowerCase()
  const keys = Object.keys(table).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (lower.includes(key)) return table[key]
  }
  return null
}

export function inferBlueprintDecisions(blueprint: SceneBlueprint | null): PopularBlueprintDecision {
  if (!blueprint) return { shot: null, lighting: null, composition: 'rule3', colorMood: null, size: '832x1216' }
  const hay = [blueprint.camera, blueprint.lighting, blueprint.mood, blueprint.promptProse, blueprint.sceneTags.join(', ')].join(' ').toLowerCase()
  const shot = matchFirst(hay, CAMERA_TO_SHOT)
  const lighting = matchFirst(hay, LIGHTING_TO_ID)
  const colorMood = matchFirst(hay, MOOD_TO_COLOR)
  return {
    shot,
    lighting,
    composition: 'rule3',
    colorMood,
    size: blueprint.recommendedSize || '832x1216',
  }
}

// ── Prompt 组装（唯一渲染层 = createPromptPlan + renderPromptPlan） ─────────

export interface PopularPromptOptions {
  character: PopularCharacter
  outfit: PopularOutfit
  blueprint: SceneBlueprint | null
  engine: 'anima' | 'krea2'
  profile?: ModelProfile | null
  manual?: string[]
  shot?: string | null
  lighting?: string | null
  composition?: string | null
  adultEnabled?: boolean
  /** 用户补充的画面描述；只追加，不得替换角色服装。 */
  visualDescription?: string
  /** Krea 风格配方（已按资格解析）；成人配方在此再 fail-closed 一次。 */
  style?: ResolvedStyle | null
  artistTags?: string[]
  artistProse?: string
}

export interface PopularPromptResult {
  plan: PromptPlan
  prompt: string
  negative: string
  adult: boolean
}

const SHOT_TOKENS: Record<string, string> = {
  close: 'close_up', medium: 'medium_shot', wide: 'wide_shot',
  pov: 'pov', low: 'low_angle', high: 'high_angle', side: 'side_view',
  turn: 'looking_back', over: 'selfie', detail: 'close_up_detail',
}
const LIGHTING_TOKENS: Record<string, string> = {
  golden: 'golden_hour', window: 'window_light', back: 'backlit',
  moon: 'moonlight', lantern: 'lantern_light', overcast: 'overcast',
}
/**
 * 氛围词强化（壁纸级第一）：每种光线决策除主光照 token 外追加一组通透感
 * 标签——逆光/轮廓光/体积光/景深是参考图（sc300 标杆）与平庸平涂的最大分水岭。
 */
const AMBIENCE_TOKENS: Record<string, string[]> = {
  golden: ['golden_hour', 'backlight', 'rim_light', 'volumetric_lighting', 'deep_depth_of_field', 'warm_lighting'],
  back: ['backlit', 'rim_light', 'volumetric_lighting', 'silhouette', 'deep_depth_of_field'],
  window: ['window_light', 'soft_lighting', 'sunlight', 'volumetric_lighting', 'shadows'],
  moon: ['moonlight', 'night', 'cool_lighting', 'stars', 'deep_depth_of_field'],
  lantern: ['lantern_light', 'candlelight', 'warm_lighting', 'volumetric_lighting', 'shadows'],
  overcast: ['overcast', 'soft_diffused_light', 'cloudy', 'hazy'],
}
const COMPOSITION_TOKENS: Record<string, string> = {
  center: 'centered_composition', rule3: 'rule_of_thirds',
  left: 'left_composition', right: 'right_composition',
  foreground: 'foreground_framing', frame: 'framed_composition', bywindow: 'by_window',
}

const NENE_NATSUME_POLLUTION = /(?:ayachi_nene|shiki_natsume|nene_r18|natsume_r18)/i
const NENE_NATSUME_PREFIX = /^(?:nene_|natsume_)[a-z0-9_]+$/i

/** 专家模式手动词条净化：热门角色场景不得出现宁宁/夏目 LoRA 控制词。 */
export function sanitizePopularManual(tags: string[]): string[] {
  return tags.filter(tag => !NENE_NATSUME_POLLUTION.test(tag) && !NENE_NATSUME_PREFIX.test(tag))
}

const STUDIO_NAME_RE = /(?:ayachi_nene|shiki_natsume)/i
const STUDIO_PREFIX_RE = /(?:^|[^a-z0-9_])(?:nene|natsume)_[a-z0-9_]+/i

/** 扫描一段文本是否泄漏宁宁/夏目 LoRA 锚点；返回泄漏描述，无则空数组。 */
export function scanStudioTokenLeaks(text: string): string[] {
  const leaks: string[] = []
  if (STUDIO_NAME_RE.test(text)) leaks.push('studio character name')
  if (STUDIO_PREFIX_RE.test(text)) leaks.push('studio control prefix')
  return leaks
}

/**
 * 角色数据全字段污染扫描：identityTokens/exactTokens/identityProse/aliases/
 * exactPrefixes 以及每个 outfit 的 prose+tokens，统一在此判定，供内容契约
 * 校验与单测共用，避免两处各自维护一套正则漂移。
 */
export function scanCharacterPollution(character: PopularCharacter): string[] {
  const leaks: string[] = []
  const textSources: Array<[string, string]> = [
    ['identityProse', character.identityProse],
    ['aliases', character.aliases.join(', ')],
    ['exactPrefixes', character.exactPrefixes.join(', ')],
    ['identityTokens', character.identityTokens.join(', ')],
    ['exactTokens', character.exactTokens.join(', ')],
  ]
  for (const [field, text] of textSources) {
    scanStudioTokenLeaks(text).forEach(leak => leaks.push(`${character.id}.${field}: ${leak}`))
  }
  character.outfits.forEach(outfit => {
    scanStudioTokenLeaks(`${outfit.prose} ${outfit.tokens.join(' ')}`).forEach(leak => {
      leaks.push(`${character.id}.outfit.${outfit.id}: ${leak}`)
    })
  })
  return leaks
}

function identityWithoutOutfit(prose: string): string {
  // 剥离句尾的服装描述（", wearing X." / ", dressed in X."），供 Krea 自然语言路径使用。
  return prose
    .replace(/,\s*(?:wearing|dressed in)\b[^.]*\.?$/i, '.')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildPopularPromptPlan(options: PopularPromptOptions): PopularPromptResult | null {
  const { character, outfit, blueprint, engine } = options
  const profile = options.profile ?? null
  const adult = Boolean(blueprint?.adult)
  const adultGranted = adult && character.adultEligibility === 'adult' && options.adultEnabled === true
  // 成人蓝图 fail closed：资格不满足直接拒绝构建，不让任何显式词进入 Prompt。
  if (adult && !adultGranted) return null

  const manual = sanitizePopularManual(options.manual || [])
  const shotToken = options.shot ? SHOT_TOKENS[options.shot] : ''
  const lightingKey = options.lighting ?? ''
  const lightingToken = lightingKey ? LIGHTING_TOKENS[lightingKey] : ''
  const lightingTokens = lightingKey
    ? [...new Set([lightingToken, ...(AMBIENCE_TOKENS[lightingKey] || [])])].filter(Boolean)
    : []
  const compositionToken = options.composition ? COMPOSITION_TOKENS[options.composition] : ''
  // 成人配方与成人蓝图同一把 fail-closed 锁：资格不满足绝不进入渲染层。
  const style = options.style
  if (style?.adult && !adultGranted) return null

  // 用户描述是额外画面指令，服装由独立字段稳定保留。
  const userVisual = String(options.visualDescription || '').trim()
  // 成人内容只在 fail-closed 放行时注入：Anima 标签进 controls，散文拼接场景。
  const nsfwTokens = adultGranted ? (blueprint?.nsfwTokens || []) : []
  const nsfwProse = adultGranted ? String(blueprint?.nsfwProse || '').trim() : ''
  const sceneProse = [
    // 成人场景：裸体叙述前置，避免被服装散文压过（Krea 2 自然语言模型对句首描述权重最高）。
    ...(nsfwProse ? [nsfwProse] : []),
    blueprint?.promptProse,
  ].filter(Boolean).join(' ')

  if (engine === 'krea2') {
    // 成人蓝图：outfitProse 置空（Krea 模板会拼成 "subject, wearing {outfitProse}"，
    // 穿衣服描述会压过显式词导致拒绝出裸）；脱衣叙述由 nsfwProse 前置承载。
    const outfitProse = adultGranted ? '' : outfit.prose
    const plan = createPromptPlan({
      subjectProse: identityWithoutOutfit(character.identityProse),
      outfitProse,
      sceneProse,
      emotion: blueprint ? [blueprint.mood] : [],
      camera: blueprint ? [blueprint.camera] : [],
      lighting: blueprint ? [blueprint.lighting] : [],
      composition: compositionToken ? [compositionToken] : [],
      manual,
      negative: '',
      visualDescription: userVisual,
      style: style ? [style.lead] : [],
      medium: style?.medium ?? '',
      artistProse: options.artistProse,
    })
    const rendered = renderPromptPlan(plan, 'krea2', profile)
    return { plan, prompt: rendered.prompt, negative: '', adult }
  }

  const identityTokens = character.identityTokens
  const exactControls = [...new Set([
    ...(adultGranted ? [] : outfit.tokens),
    ...(character.exactTokens || []),
    ...nsfwTokens,
  ])]
  const effectiveArtists = (options.artistTags && options.artistTags.length)
    ? options.artistTags
    : (adultGranted && blueprint?.adultArtistHint ? [blueprint.adultArtistHint] : undefined)
  const rating = profileRatingTag(profile, { rating: adultGranted ? 'R18' : 'ALL' })
  const plan = createPromptPlan({
    profile,
    identity: identityTokens.join(', '),
    controls: exactControls,
    artists: effectiveArtists,
    exactTokens: character.exactTokens,
    scenePrompt: (blueprint?.promptTokens || []).join(', '),
    emotion: [],
    camera: shotToken ? [shotToken] : [],
    lighting: lightingTokens.length ? lightingTokens : [],
    composition: compositionToken ? [compositionToken] : [],
    manual,
    negative: (blueprint?.negativeTokens || []).join(', '),
    rating: rating || (adultGranted ? 'nsfw' : ''),
    visualDescription: userVisual,
    subjectProse: identityWithoutOutfit(character.identityProse),
    outfitProse: outfit.prose,
    sceneProse,
    // Anima 只接收模型原生短标签；Krea 的自然语言 lead 不进入标签流。
    style: style?.sd ? style.sd.split(',').map(token => token.trim()).filter(Boolean) : [],
  })
  const rendered = renderPromptPlan(plan, 'anima', profile)
  // renderPromptPlan 对 anima 恒返回空 negative，但无 LoRA 工作流含负向 encode 节点，
  // 因此负向词由调用方按下发：先按 profile negative_mode 合并 negative_prefix，
  // 再保留 blueprint 的非样板负向词（样板词由 replace 策略替换）。
  const negative = assembleNegative(
    profile,
    {
      negative: (blueprint?.negativeTokens || []).join(', '),
      rating: adultGranted ? 'R18' : 'All',
    },
    'anima',
    { shot: options.shot, character: character.id },
  )
  // 与场景生成器同款多格/重复主体压制；单人场景追加第二人压制（壁纸级第一）。
  const panelSuppress = 'split image, split screen, split panel, two panels, diptych, triptych, comic strip, multiple frames, panel borders, frame borders, double exposure, double image, duplicated subject, duplicated body, multiple girls, second person, two people'
  const finalNegative = negative
    ? `${negative}, ${panelSuppress}`
    : panelSuppress
  return { plan, prompt: rendered.prompt, negative: finalNegative, adult }
}
