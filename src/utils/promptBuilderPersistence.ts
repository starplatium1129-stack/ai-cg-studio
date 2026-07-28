import type { ModelProfile } from './promptPolicy'

export type DraftCharKey = 'nene' | 'natsume' | 'triad'

export interface SDParams {
  cfg: number
  steps: number
  sampler: string
  scheduler: string
  size: string
  hiresFix: boolean
  hiresScale: number
  hiresUpscaler: string
  hiresSteps: number
  hiresDenoise: number
  faceDetailer: boolean
  seedLock: boolean
  seed: number
  quality: boolean
  tail: boolean
  negative: boolean
  negativeCustom: string
}

export interface DraftSelections {
  emotion: string[]
  shot: string | null
  lighting: string | null
  composition: string | null
}

export interface PromptBuilderDraft {
  updatedAt: number
  story?: string
  char?: DraftCharKey
  sceneId?: string | null
  sceneTitle?: string | null
  selections?: Partial<DraftSelections>
  colorMood?: string | null
  manualTags?: string[]
  sceneBaseStory?: string
  directorMode?: 'basic' | 'pro'
  sdParams?: Partial<SDParams>
  projectId?: string
}

export interface ProjectOption {
  id: string
  name: string
}

export interface PromptPreset {
  id: string
  name: string
  label: string
  [key: string]: unknown
}

const SD_PARAM_KEYS = new Set<keyof SDParams>([
  'cfg', 'steps', 'sampler', 'scheduler', 'size', 'hiresFix', 'hiresScale',
  'hiresUpscaler', 'hiresSteps', 'hiresDenoise', 'faceDetailer', 'seedLock',
  'seed', 'quality', 'tail', 'negative', 'negativeCustom',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : stringValue(value)
}

function finiteNumber(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function isSDParamKey(key: string): key is keyof SDParams {
  return SD_PARAM_KEYS.has(key as keyof SDParams)
}

export function parseSDParams(value: unknown): Partial<SDParams> {
  if (!isRecord(value)) return {}
  const result: Partial<SDParams> = {}
  const cfg = finiteNumber(value.cfg)
  const steps = finiteNumber(value.steps)
  const hiresScale = finiteNumber(value.hiresScale)
  const hiresSteps = finiteNumber(value.hiresSteps)
  const hiresDenoise = finiteNumber(value.hiresDenoise)
  const seed = finiteNumber(value.seed)
  if (cfg !== undefined) result.cfg = cfg
  if (steps !== undefined) result.steps = steps
  if (hiresScale !== undefined) result.hiresScale = hiresScale
  if (hiresSteps !== undefined) result.hiresSteps = hiresSteps
  if (hiresDenoise !== undefined) result.hiresDenoise = hiresDenoise
  if (seed !== undefined) result.seed = seed
  for (const key of ['sampler', 'scheduler', 'size', 'hiresUpscaler', 'negativeCustom'] as const) {
    const text = stringValue(value[key])
    if (text !== undefined) result[key] = text
  }
  for (const key of ['hiresFix', 'faceDetailer', 'seedLock', 'quality', 'tail', 'negative'] as const) {
    if (typeof value[key] === 'boolean') result[key] = value[key]
  }
  return result
}

export function parsePromptBuilderDraft(value: unknown): PromptBuilderDraft | null {
  if (!isRecord(value)) return null
  const updatedAt = finiteNumber(value.updatedAt)
  const story = stringValue(value.story)
  const sceneId = nullableString(value.sceneId)
  if (!updatedAt || (!sceneId && !story)) return null

  const rawSelections = isRecord(value.selections) ? value.selections : null
  const selections = rawSelections
    ? {
        emotion: stringList(rawSelections.emotion),
        shot: nullableString(rawSelections.shot) ?? null,
        lighting: nullableString(rawSelections.lighting) ?? null,
        composition: nullableString(rawSelections.composition) ?? null,
      }
    : undefined
  const char = value.char === 'nene' || value.char === 'natsume' || value.char === 'triad'
    ? value.char
    : undefined
  const directorMode = value.directorMode === 'basic' || value.directorMode === 'pro'
    ? value.directorMode
    : undefined

  return {
    updatedAt,
    story,
    char,
    sceneId,
    sceneTitle: nullableString(value.sceneTitle),
    selections,
    colorMood: nullableString(value.colorMood),
    manualTags: stringList(value.manualTags),
    sceneBaseStory: stringValue(value.sceneBaseStory),
    directorMode,
    sdParams: parseSDParams(value.sdParams),
    projectId: stringValue(value.projectId),
  }
}

export function parseProjectOptions(value: unknown): ProjectOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): ProjectOption[] => {
    if (!isRecord(item)) return []
    if (typeof item.id !== 'string' && typeof item.id !== 'number') return []
    const id = String(item.id).trim()
    if (!id) return []
    const label = stringValue(item.name) || stringValue(item.title) || id
    return [{ id, name: label }]
  })
}

function parseModelProfile(value: unknown): ModelProfile | null {
  if (!isRecord(value)) return null
  const negativeMode = value.negative_mode === 'merge' || value.negative_mode === 'replace'
    ? value.negative_mode
    : undefined
  const replaceScope = value.negative_replace_scope === 'boilerplate' || value.negative_replace_scope === 'all'
    ? value.negative_replace_scope
    : undefined
  return {
    ...value,
    id: stringValue(value.id),
    name: stringValue(value.name),
    match: stringList(value.match),
    quality_prefix: stringValue(value.quality_prefix),
    negative_prefix: stringValue(value.negative_prefix),
    negative_mode: negativeMode,
    negative_replace_scope: replaceScope,
    rating_all: stringValue(value.rating_all),
    rating_r15: stringValue(value.rating_r15),
    rating_r18: stringValue(value.rating_r18),
    sampler: stringValue(value.sampler),
    scheduler: stringValue(value.scheduler),
    steps: finiteNumber(value.steps),
    cfg: finiteNumber(value.cfg),
    size: stringValue(value.size),
    hires_steps: finiteNumber(value.hires_steps),
    hires_scale: finiteNumber(value.hires_scale),
    hires_upscaler: stringValue(value.hires_upscaler),
    hires_denoising_strength: finiteNumber(value.hires_denoising_strength),
  }
}

function parsePreset(value: unknown): PromptPreset | null {
  if (!isRecord(value)) return null
  const id = stringValue(value.id)
  if (!id) return null
  const name = stringValue(value.name) || stringValue(value.label) || id
  return { ...value, id, name, label: stringValue(value.label) || name }
}

export function parsePresetCatalog(value: unknown): {
  presets: PromptPreset[]
  modelProfiles: ModelProfile[]
} {
  const presetValues = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.presets)
      ? value.presets
      : []
  const profileValues = isRecord(value) && Array.isArray(value.model_profiles)
    ? value.model_profiles
    : []
  return {
    presets: presetValues.map(parsePreset).filter((item): item is PromptPreset => item !== null),
    modelProfiles: profileValues.map(parseModelProfile).filter((item): item is ModelProfile => item !== null),
  }
}
