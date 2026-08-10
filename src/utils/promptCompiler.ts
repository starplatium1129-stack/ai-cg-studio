import { formatPromptForEngine, tokenize, type ModelProfile } from './promptPolicy.ts'

export type PromptFamily = 'sd' | 'anima' | 'krea2'

export interface PromptPlan {
  quality: string[]; rating: string[]; identity: string[]; exactControls: string[]
  sceneVisualFragments: string[]; emotion: string[]; camera: string[]; lighting: string[]
  composition: string[]; manual: string[]; negative: string[]; visualDescription: string
}

export interface PromptCompilerInput {
  profile?: ModelProfile | null; identity?: string; controls?: string[]; scenePrompt?: string
  emotion?: string[]; camera?: string[]; lighting?: string[]; composition?: string[]
  manual?: string[]; negative?: string; rating?: string; visualDescription?: string
}

const split = (value: string | undefined): string[] => tokenize(value || '').filter(Boolean)
const clean = (value: string): string => value.replace(/<lora:[^>]+>/gi, '').replace(/\bBREAK\b/gi, ', ').replace(/\s+/g, ' ').trim()
const sentence = (value: string): string => { const text = clean(value); return text ? `${text.replace(/[.!?]+$/, '')}.` : '' }
function proseToken(value: string): string {
  const token = value.replace(/^\(+|\)+$/g, '').replace(/<lora:[^>]+>/gi, '').replace(/:\s*-?\d+(?:\.\d+)?\s*$/g, '').trim()
  if (!token || /^(?:score_\d+|best_quality|masterpiece|amazing_quality|very_aesthetic|absurdres|safe|sensitive|nsfw|nene_r18|natsume_r18)$/i.test(token)) return ''
  const readable = token.replace(/^ayachi_nene$/i, 'Nene').replace(/^shiki_natsume$/i, 'Natsume')
    .replace(/^nene_(?:witch_canonical|school_uniform|sailor_uniform|red_cardigan_uniform|blue_pajamas|green_sleepwear|bat_dress|black_dress)$/i, '')
    .replace(/^natsume_(?:cafe_uniform|pink_cafe_uniform|official_qipao|maid_uniform|winter_coat|sleepwear)$/i, '')
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
  }
}

function allTags(plan: PromptPlan): string[] {
  return [ ...plan.quality, ...plan.rating, ...plan.identity, ...plan.exactControls,
    ...plan.sceneVisualFragments, ...plan.emotion, ...plan.camera, ...plan.lighting,
    ...plan.composition, ...plan.manual ].filter(Boolean)
}

function naturalDescription(plan: PromptPlan): string {
  const subject = proseList(plan.identity)
  const details = proseList(plan.sceneVisualFragments.concat(plan.manual))
  const direction = proseList(plan.emotion.concat(plan.camera, plan.lighting, plan.composition))
  const parts = [
    `A visual novel event CG featuring ${subject || 'the main character'}.`,
    `Scene details: ${details || 'a clearly visible environment and readable character action'}.`,
    `Composition and lighting: ${direction || 'a balanced cinematic composition with soft, readable lighting'}.`,
  ]
  if (plan.visualDescription) parts.splice(1, 0, sentence(plan.visualDescription))
  return parts.join(' ')
}

export function renderPromptPlan(plan: PromptPlan, family: PromptFamily, profile?: ModelProfile | null): { prompt: string; negative: string } {
  if (family === 'krea2') return { prompt: naturalDescription(plan), negative: '' }
  const tags = allTags(plan).join(', ')
  if (family === 'anima') {
    const formatted = formatPromptForEngine(tags, 'anima', plan.exactControls.concat(profile?.exact_tokens || []), profile?.exact_prefixes || [])
    return { prompt: [formatted, naturalDescription(plan)].filter(Boolean).join('. '), negative: '' }
  }
  return { prompt: tags, negative: plan.negative.join(', ') }
}
