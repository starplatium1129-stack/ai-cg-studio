import { ref, readonly } from 'vue'

export interface SDGenerateParams {
  prompt: string
  negative_prompt?: string
  width?: number
  height?: number
  cfg_scale?: number
  steps?: number
  sampler_name?: string
  scheduler?: string
  hr_fix?: boolean
  hr_scale?: number
  hr_upscaler?: string
  hr_second_pass_steps?: number
  denoising_strength?: number
  seed?: number
  model?: string
  alwayson_scripts?: Record<string, unknown>
}

export interface SDStatus {
  online: boolean
  samplers?: string[]
  models?: string[]
  schedulers?: string[]
  upscalers?: string[]
}

export function useSDGenerate() {
  const online      = ref(false)
  const checkpoint  = ref('')
  const generating  = ref(false)
  const progress    = ref(0)
  const statusText  = ref('')
  const resultUrl   = ref('')
  const resultSeed  = ref<number | null>(null)
  const errorMsg    = ref('')
  const samplers    = ref<string[]>([])
  const schedulers  = ref<string[]>([])
  const upscalers   = ref<string[]>([])
  const models      = ref<string[]>([])

  let pollTimer = 0
  let abortCtrl: AbortController | null = null

  async function checkStatus(): Promise<boolean> {
    // 优先走网关聚合接口；失败则直接探测 /sdapi（本机代理）
    try {
      const r = await fetch('/api/sd-status', { cache: 'no-store' })
      if (r.ok) {
        const data = await r.json()
        online.value = Boolean(data.online)
        samplers.value = data.samplers ?? []
        schedulers.value = data.schedulers ?? []
        upscalers.value = data.upscalers ?? []
        models.value = data.models ?? []
        checkpoint.value = data.checkpoint ?? ''
        if (online.value) return true
      }
    } catch { /* fall through */ }

    try {
      const [modelsRes, samplersRes, schedulersRes] = await Promise.all([
        fetch('/sdapi/v1/sd-models', { cache: 'no-store' }),
        fetch('/sdapi/v1/samplers', { cache: 'no-store' }).catch(() => null),
        fetch('/sdapi/v1/schedulers', { cache: 'no-store' }).catch(() => null),
      ])
      if (!modelsRes.ok) { online.value = false; return false }
      const modelList = await modelsRes.json()
      online.value = true
      models.value = Array.isArray(modelList)
        ? modelList.map((m: any) => m.title || m.model_name || m.name || '').filter(Boolean)
        : []
      if (samplersRes?.ok) {
        const list = await samplersRes.json()
        samplers.value = Array.isArray(list) ? list.map((s: any) => s.name || s).filter(Boolean) : []
      }
      if (schedulersRes?.ok) {
        const list = await schedulersRes.json()
        schedulers.value = Array.isArray(list) ? list.map((s: any) => s.name || s.label || s).filter(Boolean) : []
      }
      return true
    } catch {
      online.value = false
      return false
    }
  }

  function stopPolling() {
    clearInterval(pollTimer); pollTimer = 0; progress.value = 0
  }

  function startPolling() {
    stopPolling()
    pollTimer = window.setInterval(async () => {
      try {
        const r = await fetch('/sdapi/v1/progress?skip_current_image=true', { cache: 'no-store' })
        if (!r.ok) return
        const data = await r.json()
        progress.value = Math.round((data.progress ?? 0) * 100)
        if (data.current_image) {
          // intermediate preview - ignored for now
        }
      } catch {}
    }, 1200) as unknown as number
  }

  async function generate(params: SDGenerateParams): Promise<string | null> {
    if (generating.value) return null
    generating.value = true
    progress.value   = 0
    statusText.value = '正在生成…'
    errorMsg.value   = ''
    resultUrl.value  = ''

    abortCtrl = new AbortController()
    startPolling()

    try {
      // Parse size string like "832×1216" into width/height
      const [w, h] = parseSize(params)

      // 与旧 sd-api.js 默认对齐：CFG 5.5、Karras、hires denoise 0.35
      const payload: Record<string, unknown> = {
        prompt:          params.prompt,
        negative_prompt: params.negative_prompt ?? '',
        width:  w,
        height: h,
        cfg_scale:   params.cfg_scale   ?? 5.5,
        steps:       params.steps       ?? 28,
        sampler_name: params.sampler_name ?? 'DPM++ 2M',
        seed:        params.seed        ?? -1,
        batch_size:  1,
        n_iter:      1,
        send_images:  true,
        save_images:  false,
      }
      if (params.scheduler) payload.scheduler = params.scheduler

      if (params.hr_fix) {
        payload.enable_hr = true
        payload.hr_scale = params.hr_scale ?? 1.5
        payload.hr_upscaler = params.hr_upscaler || 'Latent'
        payload.hr_second_pass_steps = params.hr_second_pass_steps ?? Math.max(10, Math.round((params.steps ?? 28) * 0.5))
        payload.denoising_strength = params.denoising_strength ?? 0.35
      }

      if (params.alwayson_scripts) payload.alwayson_scripts = params.alwayson_scripts

      // Override checkpoint if specified
      let overrideSettings: Record<string, unknown> | undefined
      if (params.model) overrideSettings = { sd_model_checkpoint: params.model }
      if (overrideSettings) { payload.override_settings = overrideSettings; payload.override_settings_restore_afterwards = true }

      statusText.value = 'SD WebUI 生成中…'

      const r = await fetch('/sdapi/v1/txt2img', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortCtrl.signal,
      })

      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        throw new Error(`SD 返回错误 ${r.status}: ${txt.slice(0, 120)}`)
      }

      const data = await r.json()
      const imgB64 = data.images?.[0]
      if (!imgB64) throw new Error('SD 未返回图片数据')

      // Convert base64 to blob URL
      const byteStr = atob(imgB64)
      const ab = new ArrayBuffer(byteStr.length)
      const view = new Uint8Array(ab)
      for (let i = 0; i < byteStr.length; i++) view[i] = byteStr.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([ab], { type: 'image/png' }))
      resultUrl.value  = url
      resultSeed.value = data.info ? JSON.parse(data.info)?.seed ?? null : null
      statusText.value = '生成完成'
      return url
    } catch (e) {
      if ((e as any)?.name === 'AbortError') { statusText.value = '已停止'; return null }
      errorMsg.value   = String((e as any)?.message ?? e)
      statusText.value = '生成失败'
      return null
    } finally {
      generating.value = false
      stopPolling()
      abortCtrl = null
    }
  }

  function cancel() {
    if (!generating.value) return
    abortCtrl?.abort()
    // Also interrupt SD WebUI
    fetch('/sdapi/v1/interrupt', { method: 'POST' }).catch(() => {})
  }

  function clearResult() {
    if (resultUrl.value) { URL.revokeObjectURL(resultUrl.value); resultUrl.value = '' }
    resultSeed.value = null; errorMsg.value = ''; statusText.value = ''; progress.value = 0
  }

  return {
    online: readonly(online), checkpoint: readonly(checkpoint),
    generating: readonly(generating),
    progress: readonly(progress), statusText: readonly(statusText),
    resultUrl: readonly(resultUrl), resultSeed: readonly(resultSeed),
    errorMsg: readonly(errorMsg), samplers: readonly(samplers),
    schedulers: readonly(schedulers), upscalers: readonly(upscalers),
    models: readonly(models),
    checkStatus, generate, cancel, clearResult,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function parseSize(params: SDGenerateParams): [number, number] {
  // params may have width/height directly, or encode in a size string
  if (params.width && params.height) return [params.width, params.height]
  return [832, 1216] // fallback
}
