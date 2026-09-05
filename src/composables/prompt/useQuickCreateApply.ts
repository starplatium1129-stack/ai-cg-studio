// 快速出图参数应用（2026-09-05 从 PromptBuilderView.vue 抽出：单体门禁 1393>1390 拆分）。
// 与 usePromptHistoryApply 同款的依赖注入式 composable：纯参数应用逻辑，
// 不持有组件状态，pb / sd / sdSize 由宿主注入。

import type { Ref } from 'vue'
import type { QuickCreateSettings } from '@/utils/quickCreate.ts'

interface QuickCreateApplyDeps {
  pb: {
    markParamTouched: (key: string) => void
    sdModelName: string
    applyModelProfile: (checkpoint: string) => void
    sdParams: {
      sampler: string
      scheduler: string
      cfg: number
      steps: number
      hiresFix: boolean
      hiresUpscaler: string
      hiresScale: number
    }
  }
  sd: {
    models: { value: readonly string[] }
    samplers: { value: readonly string[] }
    schedulers: { value: readonly string[] }
    upscalers: { value: readonly string[] }
  }
  sdSize: Ref<string>
}

export function useQuickCreateApply({ pb, sd, sdSize }: QuickCreateApplyDeps) {
  function applyQuickCreateSettings(settings: QuickCreateSettings | null) {
    if (!settings) return
    // 快速出图参数等同于用户已经确认过的参数。先标记 touched，避免 checkpoint
    // 变更触发的异步 watcher 再用 model profile 覆盖刚恢复的值。
    ;['sampler', 'scheduler', 'cfg', 'steps', 'size', 'hiresFix', 'hiresUpscaler', 'hiresScale']
      .forEach(key => pb.markParamTouched(key))
    if (settings.checkpoint && sd.models.value.includes(settings.checkpoint)) {
      pb.sdModelName = settings.checkpoint
      pb.applyModelProfile(settings.checkpoint)
    }
    if (settings.sampler && sd.samplers.value.includes(settings.sampler)) pb.sdParams.sampler = settings.sampler
    if (!settings.scheduler || sd.schedulers.value.includes(settings.scheduler)) pb.sdParams.scheduler = settings.scheduler
    if (settings.cfg > 0) pb.sdParams.cfg = settings.cfg
    if (settings.steps > 0) pb.sdParams.steps = settings.steps
    if (settings.size) sdSize.value = settings.size.replace('×', 'x')
    pb.sdParams.hiresFix = settings.hiresFix
    if (settings.hiresUpscaler && sd.upscalers.value.includes(settings.hiresUpscaler)) {
      pb.sdParams.hiresUpscaler = settings.hiresUpscaler
    }
    if (settings.hiresScale > 0) pb.sdParams.hiresScale = settings.hiresScale
  }

  return { applyQuickCreateSettings }
}
