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
    try {
      const r = await fetch('/api/sd-status', { cache: 'no-store' })
      if (!r.ok) { online.value = false; return false }
      const data = await r.json()
      online.value   = Boolean(data.online)
      samplers.value  = data.samplers  ?? []
      schedulers.value = data.schedulers ?? []
      upscalers.value  = data.upscalers  ?? []
      models.value     = data.models     ?? []
      return online.value
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

      const payload: Record<string, unknown> = {
        prompt:          params.prompt,
        negative_prompt: params.negative_prompt ?? '',
        width:  w,
        height: h,
        cfg_scale:   params.cfg_scale   ?? 7,
        steps:       params.steps       ?? 28,
        sampler_name: params.sampler_name ?? 'DPM++ 2M',
        scheduler:   params.scheduler   ?? 'Karras',
        seed:        params.seed        ?? -1,
        send_images:  true,
        save_images:  false,
      }

      if (params.hr_fix) {
        payload.enable_hr      = true
        payload.hr_scale       = params.hr_scale    ?? 1.5
        payload.hr_upscaler    = params.hr_upscaler ?? 'R-ESRGAN 4x+ Anime6B'
        payload.denoising_strength = 0.55
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
    online: readonly(online), generating: readonly(generating),
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
