import { resolveModelProfile, type ModelProfile } from '@/utils/promptPolicy'
import type { SDParams } from '@/utils/promptBuilderPersistence'

/**
 * 纯函数：按 checkpoint 匹配 profile 并把推荐参数填入 sdParams
 * 从 promptBuilderStore 抽离，利于单测与复用（原 store 中 applyModelProfile 闭包）
 */
export function applyModelProfileToParams(
  modelProfiles: ModelProfile[],
  sdModelName: string,
  sdParams: SDParams,
  sdParamsTouched: Set<keyof SDParams>,
  fallbackSizeRef?: { value: string },
  options: { applySize?: boolean } = {},
): ModelProfile | null {
  const profile = resolveModelProfile(modelProfiles, sdModelName)
  if (!profile) return null
  const touched = sdParamsTouched
  const set = <K extends keyof SDParams>(key: K, value: SDParams[K] | null | undefined) => {
    if (value === undefined || value === null || value === '') return
    if (touched.has(key)) return
    sdParams[key] = value
  }
  set('sampler', profile.sampler as SDParams['sampler'])
  if (!touched.has('scheduler') && profile.scheduler !== undefined) sdParams.scheduler = (profile.scheduler as string) || ''
  set('steps', Number(profile.steps) || undefined)
  set('cfg', Number(profile.cfg) || undefined)
  set('hiresFix', profile.hires_fix as SDParams['hiresFix'])
  set('hiresScale', Number(profile.hires_scale) || undefined)
  set('hiresUpscaler', profile.hires_upscaler as SDParams['hiresUpscaler'])
  set('hiresSteps', Number(profile.hires_steps) || undefined)
  set('hiresDenoise', Number(profile.hires_denoising_strength) || undefined)
  if (options.applySize !== false && !touched.has('size') && profile.size && fallbackSizeRef) {
    const m = String(profile.size).match(/(\d+)\s*[×x]\s*(\d+)/)
    if (m) fallbackSizeRef.value = `${m[1]}x${m[2]}`
  }
  return profile
}
