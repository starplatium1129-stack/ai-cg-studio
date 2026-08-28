import { ref, readonly, onUnmounted, getCurrentInstance } from 'vue'
import {
  buildTxt2ImgRequest,
  type SDGenerateParams,
} from '@/utils/sdRequest'
import {
  parseSDOptionList,
  parseSDStatus,
} from '@/utils/sdStatus'
import { mediaStatusApi } from '@/api/mediaStatusApi'
import { generationApi } from '@/api/generationApi'
import { isLocalStudioHost } from '@/utils/runtimeEnvironment'
export type { SDGenerateParams } from '@/utils/sdRequest'

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useSDGenerate() {
  const online      = ref(false)
  const checkpoint  = ref('')
  const generating  = ref(false)
  const progress    = ref(0)
  const statusText  = ref('')
  const resultUrl   = ref('')
  const resultSeed  = ref<number | null>(null)
  /** 当前结果图实际提交生成时使用的正向提示词（出视频/存历史按图取词，不随面板改动漂移）。 */
  const resultPrompt = ref('')
  const lastLoras = ref<Array<{ id: string; strength: number }>>([])
  const errorMsg    = ref('')
  const samplers    = ref<string[]>([])
  const schedulers  = ref<string[]>([])
  const upscalers   = ref<string[]>([])
  const models      = ref<string[]>([])
  const provider    = ref<'comfy' | 'webui' | ''>('')

  let abortCtrl: AbortController | null = null
  let activeJobId = ''

  async function checkStatus(): Promise<boolean> {
    // 应用生成路由统一走 /api/generation/status（含 Comfy 探测与白名单资源检查）。
    // 网关给出明确结论（含 offline）时直接采用，只有请求失败才落到旧 WebUI 探测。
    const generation = await generationApi.getStatus().catch(() => null)
    if (generation) {
      online.value = generation.online === true
      samplers.value = Array.isArray(generation.samplers) ? generation.samplers : []
      schedulers.value = Array.isArray(generation.schedulers) ? generation.schedulers : []
      upscalers.value = Array.isArray(generation.capabilities?.hiresUpscalers) ? generation.capabilities.hiresUpscalers : []
      models.value = generation.checkpoint ? [generation.checkpoint] : []
      checkpoint.value = generation.checkpoint || ''
      // 应用生成路由只允许 WAI v17；它已响应时不得再用任意 WebUI checkpoint
      // 覆盖状态，否则界面所选底模与实际服务端执行会不一致。
      return online.value
    }
    // Comfy 不可用时保留旧 WebUI 状态探测作为兼容状态。
    try {
      const data = parseSDStatus(await mediaStatusApi.getSDStatus())
        online.value = data.online
        samplers.value = data.samplers
        schedulers.value = data.schedulers
        upscalers.value = data.upscalers
        models.value = data.models
        checkpoint.value = data.checkpoint
        if (online.value) return true
    } catch { /* fall through */ }

    try {
      const [modelsRes, samplersRes, schedulersRes] = await Promise.all([
        fetch('/sdapi/v1/sd-models', { cache: 'no-store' }),
        fetch('/sdapi/v1/samplers', { cache: 'no-store' }).catch(() => null),
        fetch('/sdapi/v1/schedulers', { cache: 'no-store' }).catch(() => null),
      ])
      if (!modelsRes.ok) { online.value = false; return false }
      const modelList: unknown = await modelsRes.json()
      online.value = true
      models.value = parseSDOptionList(modelList, ['title', 'model_name', 'name'])
      if (samplersRes?.ok) {
        const list: unknown = await samplersRes.json()
        samplers.value = parseSDOptionList(list)
      }
      if (schedulersRes?.ok) {
        const list: unknown = await schedulersRes.json()
        schedulers.value = parseSDOptionList(list, ['name', 'label'])
      }
      return true
    } catch {
      online.value = false
      return false
    }
  }

  async function generate(params: SDGenerateParams): Promise<string | null> {
    if (generating.value) return null
    generating.value = true
    progress.value   = 0
    statusText.value = '正在生成…'
    errorMsg.value   = ''
    resultUrl.value  = ''

    abortCtrl = new AbortController()

    try {
      const { payload } = buildTxt2ImgRequest(params)

      statusText.value = 'SD WebUI 生成中…'

      const loraNames = params.lora ? (Array.isArray(params.lora) ? params.lora : String(params.lora).split(',')) : []
      const loras = loraNames.map(raw => {
        const match = String(raw).replace(/^<lora:/i, '').replace(/>$/, '').split(':')
        const name = match[0].trim()
        const id = name === 'ayachi_nene_v18_wd14' ? 'L_NENE_V18_WD14' : name === 'shiki_natsume_v18_wd14' ? 'L_NAT_V18_WD14' : ''
        return id ? { id, strength: Number(match[1]) || params.lora_weight || 0.8 } : null
      }).filter((x): x is { id: string; strength: number } => Boolean(x))
      lastLoras.value = loras
      const modelId = String(params.model || '').includes('waiIllustriousSDXL_v170') ? 'waiIllustriousSDXL_v170' : undefined
      const accepted = await generationApi.createJob({
        prompt: payload.prompt, negative: payload.negative_prompt, profile: '',
        ...(modelId ? { modelId } : {}),
        character: params.char || '', loras, width: payload.width, height: payload.height,
        steps: payload.steps, cfg: payload.cfg_scale, seed: payload.seed,
        sampler: payload.sampler_name, scheduler: String(payload.scheduler || params.scheduler || ''),
        hiresFix: Boolean(params.hr_fix), hiresScale: params.hr_scale, hiresUpscaler: params.hr_upscaler,
        hiresSteps: params.hr_second_pass_steps, denoisingStrength: params.denoising_strength,
        faceDetailer: Boolean(params.alwayson_scripts?.ADetailer),
        ...(isLocalStudioHost() ? { adultEnabled: true } : {}),
      }, { signal: abortCtrl.signal })

      provider.value = accepted.job.provider === 'comfy' ? 'comfy' : 'webui'
      activeJobId = accepted.job.id
      let job = accepted.job
      const deadline = Date.now() + 20 * 60 * 1000
      const startedAt = Date.now()
      while (Date.now() < deadline) {
        if (abortCtrl.signal.aborted) throw new DOMException('aborted', 'AbortError')
        if (job.status === 'failed') throw new Error(job.error || '生成失败')
        if (job.status === 'cancelled') throw new DOMException('cancelled', 'AbortError')
        if (job.status === 'succeeded' && job.resultUrl) break
        await new Promise(resolve => setTimeout(resolve, 700))
        const state = await generationApi.getJob(job.id, { signal: abortCtrl.signal })
        if (!state.job) throw new Error('生成状态无效')
        job = state.job
        // job API 不产出真实进度（Comfy ws 进度未接入 job 通道），progress 只反映
        // 确定状态；进行中的动态反馈用真实等待秒数，不做匀速假增量（审计 P2）。
        progress.value = job.status === 'succeeded' ? 100 : progress.value
        statusText.value = (provider.value === 'comfy' ? 'ComfyUI 生成中' : 'SD WebUI 生成中')
          + ` · 已等待 ${Math.max(0, Math.round((Date.now() - startedAt) / 1000))}s`
      }
      if (job.status !== 'succeeded' || !job.resultUrl) throw new Error('生成超时')
      const resultResponse = await fetch(job.resultUrl, { cache: 'no-store', signal: abortCtrl.signal })
      if (!resultResponse.ok || !String(resultResponse.headers.get('content-type') || '').startsWith('image/')) throw new Error('生成结果不是图片')
      const blob = await resultResponse.blob()
      if (!blob.size) throw new Error('生成结果为空')
      const url = URL.createObjectURL(blob)
      // 覆盖前先释放上一张，否则每出一张图泄漏一个 blob URL
      if (resultUrl.value && resultUrl.value !== url) URL.revokeObjectURL(resultUrl.value)
      resultUrl.value  = url
      resultSeed.value = job.metadata?.seed ?? job.seed ?? null
      resultPrompt.value = payload.prompt
      statusText.value = '生成完成'
      return url
    } catch (e) {
      if (isAbortError(e)) { statusText.value = '已停止'; return null }
      errorMsg.value   = errorMessage(e)
      statusText.value = '生成失败'
      return null
    } finally {
      generating.value = false
      progress.value = 0
      abortCtrl = null
      activeJobId = ''
    }
  }

  function cancel() {
    if (!generating.value) return
    abortCtrl?.abort()
    if (activeJobId) {
      void generationApi.deleteJob(activeJobId).catch(() => {})
    }
    // Cancellation is owned by the application job route. Do not issue a
    // global WebUI interrupt for a Comfy job.
  }

  function clearResult() {
    if (resultUrl.value) { URL.revokeObjectURL(resultUrl.value); resultUrl.value = '' }
    resultSeed.value = null; resultPrompt.value = ''; errorMsg.value = ''; statusText.value = ''; progress.value = 0
  }

  /** 组件卸载时收尾：取消 in-flight 任务并释放 blob，防止出图途中离开页面泄漏。 */
  function dispose() {
    cancel()
    abortCtrl = null
    if (resultUrl.value) { URL.revokeObjectURL(resultUrl.value); resultUrl.value = '' }
  }

  // 在组件上下文里自动挂载；被普通函数调用时（如测试）跳过
  if (getCurrentInstance()) onUnmounted(dispose)

  return {
    online: readonly(online), checkpoint: readonly(checkpoint),
    generating: readonly(generating),
    progress: readonly(progress), statusText: readonly(statusText),
    resultUrl: readonly(resultUrl), resultSeed: readonly(resultSeed), resultPrompt: readonly(resultPrompt),
    errorMsg: readonly(errorMsg), samplers: readonly(samplers),
    schedulers: readonly(schedulers), upscalers: readonly(upscalers),
    models: readonly(models), provider: readonly(provider),
    lastLoras: readonly(lastLoras),
    checkStatus, generate, cancel, clearResult, dispose,
  }
}
