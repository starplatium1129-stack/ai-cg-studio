import { formatPromptForEngine, tokenize, type ModelProfile } from './promptPolicy.ts'

export type PromptFamily = 'sd' | 'anima' | 'krea2'

export interface PromptPlan {
  quality: string[]; rating: string[]; identity: string[]; exactControls: string[]
  sceneVisualFragments: string[]; emotion: string[]; camera: string[]; lighting: string[]
  composition: string[]; manual: string[]; negative: string[]; visualDescription: string
  /** Krea 风格配方前置短语（lead），渲染时放最前。 */
  style: string[]
  /** 后置媒介词（medium），渲染时放散文段末尾。 */
  medium: string
  /** 主体散文（Krea 用 identityProse 原样织入，避免逗号切碎）。 */
  subjectProse: string
  /** 环境散文（Krea 用 blueprint.promptProse 原样织入）。 */
  sceneProse: string
}

export interface PromptCompilerInput {
  profile?: ModelProfile | null; identity?: string; controls?: string[]; scenePrompt?: string
  emotion?: string[]; camera?: string[]; lighting?: string[]; composition?: string[]
  manual?: string[]; negative?: string; rating?: string; visualDescription?: string
  style?: string[]; medium?: string; subjectProse?: string; sceneProse?: string
}

const split = (value: string | undefined): string[] => tokenize(value || '').filter(Boolean)
const clean = (value: string): string => value.replace(/<lora:[^>]+>/gi, '').replace(/\bBREAK\b/gi, ', ').replace(/\s+/g, ' ').trim()
const capFirst = (value: string): string => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : ''
const sentence = (value: string): string => { const text = clean(value); return text ? `${capFirst(text.replace(/[.!?]+$/, ''))}.` : '' }
function proseToken(value: string): string {
  const token = value.replace(/^\(+|\)+$/g, '').replace(/<lora:[^>]+>/gi, '').replace(/:\s*-?\d+(?:\.\d+)?\s*$/g, '').trim()
  if (!token || /^(?:score_\d+|best_quality|masterpiece|amazing_quality|very_aesthetic|absurdres|safe|sensitive|nsfw|nene_r18|natsume_r18)$/i.test(token)) return ''
  // 官方服装触发词在 Krea 散文流中映射为自然英文词组（文档:model-prompting-and-parameters-guide 排查点 2），
  // 而非直接擦除——服装细节必须保留进散文。
  const readable = token
    .replace(/^ayachi_nene$/i, 'Nene').replace(/^shiki_natsume$/i, 'Natsume')
    .replace(/^nene_witch_canonical$/i, 'witch costume')
    .replace(/^nene_school_uniform$/i, 'navy school uniform')
    .replace(/^nene_sailor_uniform$/i, 'sailor school uniform')
    .replace(/^nene_red_cardigan_uniform$/i, 'school uniform with a red cardigan')
    .replace(/^nene_blue_pajamas$/i, 'blue pajamas')
    .replace(/^nene_green_sleepwear$/i, 'green sleepwear')
    .replace(/^nene_bat_dress$/i, 'black bat-themed dress')
    .replace(/^nene_black_dress$/i, 'black dress')
    .replace(/^natsume_cafe_uniform$/i, 'cafe maid uniform')
    .replace(/^natsume_pink_cafe_uniform$/i, 'pink cafe maid uniform')
    .replace(/^natsume_official_qipao$/i, 'official qipao')
    .replace(/^natsume_maid_uniform$/i, 'maid uniform')
    .replace(/^natsume_winter_coat$/i, 'winter coat')
    .replace(/^natsume_sleepwear$/i, 'sleepwear')
  if (!readable) return ''
  if (/^(?:nene|natsume)_/i.test(readable)) return ''
  return readable.replace(/_/g, ' ').replace(/\b1girl\b/gi, 'one girl').replace(/\bsolo\b/gi, 'alone')
}
const proseList = (values: string[]): string => [...new Set(values.map(proseToken).filter(Boolean))].join(', ').replace(/(?:,\s*){2,}/g, ', ')

export function createPromptPlan(input: PromptCompilerInput): PromptPlan {
  return {
    quality: split(input.profile?.quality_prefix), rating: input.rating ? [input.rating] : [],
    identity: split(input.identity), exactControls: [...new Set(input.controls || [])],
    sceneVisualFragments: split(input.scenePrompt), emotion: [...(input.emotion || [])],
    camera: [...(input.camera || [])], lighting: [...(input.lighting || [])],
    composition: [...(input.composition || [])], manual: [...(input.manual || [])],
    negative: split(input.negative), visualDescription: String(input.visualDescription || '').trim(),
    style: [...(input.style || [])],
    medium: String(input.medium || '').trim(),
    subjectProse: String(input.subjectProse || '').trim(),
    sceneProse: String(input.sceneProse || '').trim(),
  }
}

function allTags(plan: PromptPlan): string[] {
  return [ ...plan.quality, ...plan.rating, ...plan.identity, ...plan.exactControls,
    ...plan.sceneVisualFragments, ...plan.emotion, ...plan.camera, ...plan.lighting,
    ...plan.composition, ...plan.manual ].filter(Boolean)
}

/** 镜头 / 构图：把结构化字段织成一句自然的取景描述，不做标签堆砌。 */
function proseDirection(camera: string[], composition: string[], manual: string[]): string {
  const framing = proseList(camera)
  const comp = proseList(composition)
  const accents = proseList(manual)
  const pieces: string[] = []
  if (framing) pieces.push(`The scene is framed in a ${framing}`)
  if (comp) pieces.push(`composed with ${comp}`)
  if (accents) pieces.push(`accented with ${accents}`)
  if (!pieces.length) return ''
  return `${capFirst(pieces.join(', '))}.`
}

/** 光照 / 色彩 / 情绪：结构化字段织成自然的氛围句。 */
function proseLightMood(lighting: string[], emotion: string[]): string {
  const light = proseList(lighting)
  const mood = proseList(emotion)
  const pieces: string[] = []
  if (light) pieces.push(`The scene is bathed in ${light}`)
  if (mood) pieces.push(`carrying a ${mood} mood`)
  if (!pieces.length) return ''
  return `${capFirst(pieces.join(', '))}.`
}

/**
 * 官方 Krea 散文段结构（docs.krea.ai Turbo prompting guide）：
 *   风格配方开头 → 主体身份+姿态 → 服装/材质 → 构图/镜头 → 环境背景 →
 *   光照/色彩/情绪 → 后置媒介词（medium）
 * identityProse / outfitProse / blueprint.promptProse 以原样散文织入，
 * 禁止 meta 短语（In this image / The image shows / Scene details: 等）与
 * 逗号标签堆砌；风格语言永远放最前，媒介词收尾。Anima 复用同一段作
 * token 流的散文尾巴（不取 medium）。
 */
function naturalDescription(plan: PromptPlan, includeStyle = true): string {
  const parts: string[] = []
  if (includeStyle) {
    for (const phrase of plan.style) {
      const text = sentence(phrase)
      if (text) parts.push(text)
    }
  }
  const subject = plan.subjectProse || proseList(plan.identity)
  if (subject) parts.push(sentence(subject))
  if (plan.visualDescription) parts.push(sentence(plan.visualDescription))
  const direction = proseDirection(plan.camera, plan.composition, plan.manual)
  if (direction) parts.push(direction)
  const scene = plan.sceneProse || proseList(plan.sceneVisualFragments)
  if (scene) parts.push(sentence(scene))
  const lightMood = proseLightMood(plan.lighting, plan.emotion)
  if (lightMood) parts.push(lightMood)
  if (plan.medium) {
    const medium = sentence(plan.medium)
    if (medium) parts.push(medium)
  }
  return parts.filter(Boolean).join(' ')
}

export function renderPromptPlan(plan: PromptPlan, family: PromptFamily, profile?: ModelProfile | null): { prompt: string; negative: string } {
  if (family === 'krea2') return { prompt: naturalDescription(plan), negative: '' }
  const tags = allTags(plan).join(', ')
  if (family === 'anima') {
    const formatted = formatPromptForEngine(tags, 'anima', plan.exactControls.concat(profile?.exact_tokens || []), profile?.exact_prefixes || [])
    // 风格短语放 token 流最前；散文尾巴不重复风格（includeStyle=false）。
    const styleLead = plan.style
      .map(phrase => sentence(phrase))
      .map(text => text.replace(/\.$/, ''))
      .filter(Boolean)
      .join(' ')
    return { prompt: [styleLead, formatted, naturalDescription(plan, false)].filter(Boolean).join('. '), negative: '' }
  }
  return { prompt: tags, negative: plan.negative.join(', ') }
}
