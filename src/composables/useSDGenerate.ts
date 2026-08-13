import { ref, readonly, onUnmounted, getCurrentInstance } from 'vue'
import {
  buildTxt2ImgRequest,
  type SDGenerateParams,
} from '@/utils/sdRequest'
import {
  parseSDOptionList,
  parseSDProgress,
  parseSDStatus,
} from '@/utils/sdStatus'
import { mediaStatusApi } from '@/api/mediaStatusApi'
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
  const lastLoras = ref<Array<{ id: string; strength: number }>>([])
  const errorMsg    = ref('')
  const samplers    = ref<string[]>([])
  const schedulers  = ref<string[]>([])
  const upscalers   = ref<string[]>([])
  const models      = ref<string[]>([])
  const provider    = ref<'comfy' | 'webui' | ''>('')

  let pollTimer = 0
  let pollInFlight = false
  let pollFailures = 0
  let progressToken = 0
  let abortCtrl: AbortController | null = null
  let activeJobId = ''

  async function checkStatus(): Promise<boolean> {
    const generation = await fetch('/api/generation/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)
    if (generation?.ok) {
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

  function stopPolling() {
    progressToken += 1
    clearInterval(pollTimer); pollTimer = 0; pollInFlight = false; progress.value = 0
  }

  async function pollProgress(token: number) {
    if (pollInFlight || token !== progressToken || !generating.value) return
    pollInFlight = true
    try {
      const r = await fetch('/sdapi/v1/progress?skip_current_image=true', { cache: 'no-store' })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const data = parseSDProgress(await r.json() as unknown)
      if (token !== progressToken || !generating.value) return

      progress.value = Math.round(data.ratio * 100)
      pollFailures = 0

      const eta = data.etaSeconds
      statusText.value = progress.value > 0
        ? `SD WebUI 生成中 · ${progress.value}%${eta ? ` · 约剩 ${eta} 秒` : ''}`
        : 'SD WebUI 排队或准备中…'
    } catch {
      if (token !== progressToken || !generating.value) return
      pollFailures += 1
      if (pollFailures >= 3) statusText.value = 'SD WebUI 生成中 · 进度读取失败，仍在等待结果…'
    } finally {
      pollInFlight = false
    }
  }

  function _startPolling() {
    stopPolling()
    pollFailures = 0
    const token = ++progressToken
    void pollProgress(token)
    pollTimer = window.setInterval(() => { void pollProgress(token) }, 700) as unknown as number
  }

  async function generate(params: SDGenerateParams): Promise<string | null> {
    if (generating.value) return null
    generating.value = true
    progress.value   = 0
    statusText.value = '正在生成…'
    errorMsg.value   = ''
    resultUrl.value  = ''

    abortCtrl = new AbortController()
    stopPolling()

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
      const r = await fetch('/api/generation/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: payload.prompt, negative: payload.negative_prompt, profile: '',
          ...(modelId ? { modelId } : {}),
          character: params.char || '', loras, width: payload.width, height: payload.height,
          steps: payload.steps, cfg: payload.cfg_scale, seed: payload.seed,
          sampler: payload.sampler_name, scheduler: String(payload.scheduler || params.scheduler || ''),
          hiresFix: Boolean(params.hr_fix), hiresScale: params.hr_scale, hiresUpscaler: params.hr_upscaler,
          hiresSteps: params.hr_second_pass_steps, denoisingStrength: params.denoising_strength,
          faceDetailer: Boolean(params.alwayson_scripts?.ADetailer),
        }),
        signal: abortCtrl.signal,
      })

      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        throw new Error(`SD 返回错误 ${r.status}: ${txt.slice(0, 120)}`)
      }

      const accepted = await r.json() as { ok?: boolean; job?: { id: string; provider?: 'comfy' | 'webui'; status?: string; resultUrl?: string | null; seed?: number; metadata?: { seed?: number }; error?: string }; error?: string }
      if (!accepted.ok || !accepted.job?.id) throw new Error(accepted.error || '生成任务创建失败')
      provider.value = accepted.job.provider === 'comfy' ? 'comfy' : 'webui'
      activeJobId = accepted.job.id
      let job = accepted.job
      const deadline = Date.now() + 20 * 60 * 1000
      while (Date.now() < deadline) {
        if (abortCtrl.signal.aborted) throw new DOMException('aborted', 'AbortError')
        if (job.status === 'failed') throw new Error(job.error || '生成失败')
        if (job.status === 'cancelled') throw new DOMException('cancelled', 'AbortError')
        if (job.status === 'succeeded' && job.resultUrl) break
        await new Promise(resolve => setTimeout(resolve, 700))
        const stateResponse = await fetch(`/api/generation/jobs/${encodeURIComponent(job.id)}`, { cache: 'no-store', signal: abortCtrl.signal })
        if (!stateResponse.ok) throw new Error(`生成状态读取失败 ${stateResponse.status}`)
        const state = await stateResponse.json() as { job?: typeof job }
        if (!state.job) throw new Error('生成状态无效')
        job = state.job
        progress.value = job.status === 'running' ? Math.min(95, progress.value + 2) : (job.status === 'succeeded' ? 100 : progress.value)
        statusText.value = provider.value === 'comfy' ? 'ComfyUI 生成中…' : 'SD WebUI 生成中…'
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
      statusText.value = '生成完成'
      return url
    } catch (e) {
      if (isAbortError(e)) { statusText.value = '已停止'; return null }
      errorMsg.value   = errorMessage(e)
      statusText.value = '生成失败'
      return null
    } finally {
      generating.value = false
      stopPolling()
      abortCtrl = null
      activeJobId = ''
    }
  }

  function cancel() {
    if (!generating.value) return
    abortCtrl?.abort()
    if (activeJobId) {
      fetch(`/api/generation/jobs/${encodeURIComponent(activeJobId)}`, { method: 'DELETE' }).catch(() => {})
    }
    // Cancellation is owned by the application job route. Do not issue a
    // global WebUI interrupt for a Comfy job.
  }

  function clearResult() {
    if (resultUrl.value) { URL.revokeObjectURL(resultUrl.value); resultUrl.value = '' }
    resultSeed.value = null; errorMsg.value = ''; statusText.value = ''; progress.value = 0
  }

  /**
   * 组件卸载时收尾。缺这一段的后果：出图途中离开页面，1.2 秒一次的进度轮询
   * 会一直跑到标签页关闭，in-flight 的 txt2img 也不会被取消。
   */
  function dispose() {
    // 页面离开也要通知 WebUI，否则断开的浏览器请求不一定会释放 GPU 生成。
    cancel()
    stopPolling()
    abortCtrl = null
    if (resultUrl.value) { URL.revokeObjectURL(resultUrl.value); resultUrl.value = '' }
  }

  // 在组件上下文里自动挂载；被普通函数调用时（如测试）跳过
  if (getCurrentInstance()) onUnmounted(dispose)

  return {
    online: readonly(online), checkpoint: readonly(checkpoint),
    generating: readonly(generating),
    progress: readonly(progress), statusText: readonly(statusText),
    resultUrl: readonly(resultUrl), resultSeed: readonly(resultSeed),
    errorMsg: readonly(errorMsg), samplers: readonly(samplers),
    schedulers: readonly(schedulers), upscalers: readonly(upscalers),
    models: readonly(models), provider: readonly(provider),
    lastLoras: readonly(lastLoras),
    checkStatus, generate, cancel, clearResult, dispose,
  }
}
