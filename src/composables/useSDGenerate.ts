import { ref, readonly, onUnmounted, getCurrentInstance } from 'vue'
import {
  buildTxt2ImgRequest,
  parseTxt2ImgResponse,
  type SDGenerateParams,
} from '@/utils/sdRequest'
export type { SDGenerateParams } from '@/utils/sdRequest'

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
  let pollInFlight = false
  let pollFailures = 0
  let progressToken = 0
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
    progressToken += 1
    clearInterval(pollTimer); pollTimer = 0; pollInFlight = false; progress.value = 0
  }

  async function pollProgress(token: number) {
    if (pollInFlight || token !== progressToken || !generating.value) return
    pollInFlight = true
    try {
      const r = await fetch('/sdapi/v1/progress?skip_current_image=true', { cache: 'no-store' })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const data = await r.json()
      if (token !== progressToken || !generating.value) return

      const reported = Number(data.progress)
      const state = data.state || {}
      const stepProgress = Number(state.sampling_steps) > 0
        ? Number(state.sampling_step || 0) / Number(state.sampling_steps)
        : 0
      const ratio = Math.max(
        Number.isFinite(reported) ? reported : 0,
        Number.isFinite(stepProgress) ? stepProgress : 0,
      )
      progress.value = Math.round(Math.min(1, Math.max(0, ratio)) * 100)
      pollFailures = 0

      const eta = Math.max(0, Math.ceil(Number(data.eta_relative) || 0))
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

  function startPolling() {
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
    startPolling()

    try {
      const { payload } = buildTxt2ImgRequest(params)

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

      const result = parseTxt2ImgResponse(await r.json())
      const imgB64 = result.image.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '')

      // Convert base64 to blob URL
      const byteStr = atob(imgB64)
      const ab = new ArrayBuffer(byteStr.length)
      const view = new Uint8Array(ab)
      for (let i = 0; i < byteStr.length; i++) view[i] = byteStr.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([ab], { type: 'image/png' }))
      // 覆盖前先释放上一张，否则每出一张图泄漏一个 blob URL
      if (resultUrl.value && resultUrl.value !== url) URL.revokeObjectURL(resultUrl.value)
      resultUrl.value  = url
      resultSeed.value = result.seed
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
    // 通知 WebUI 中断。故意不查 response.ok：本地 abort 已经生效，
    // 这一发只是让 GPU 早点松手；失败了也没有可做的补救动作。
    fetch('/sdapi/v1/interrupt', { method: 'POST' }).catch(() => {})
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
    stopPolling()
    abortCtrl?.abort()
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
    models: readonly(models),
    checkStatus, generate, cancel, clearResult, dispose,
  }
}
