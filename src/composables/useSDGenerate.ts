import { ref, readonly, onUnmounted, getCurrentInstance } from 'vue'
import {
  buildTxt2ImgRequest,
  parseTxt2ImgResponse,
  type SDGenerateParams,
} from '@/utils/sdRequest'
import {
  parseSDOptionList,
  parseSDProgress,
  parseSDStatus,
} from '@/utils/sdStatus'
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
        const data = parseSDStatus(await r.json() as unknown)
        online.value = data.online
        samplers.value = data.samplers
        schedulers.value = data.schedulers
        upscalers.value = data.upscalers
        models.value = data.models
        checkpoint.value = data.checkpoint
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

      const rawResult: unknown = await r.json()
      const result = parseTxt2ImgResponse(rawResult)
      const dataUrl = /^data:/.test(result.image) ? result.image : `data:image/png;base64,${result.image}`
      // atob + 逐字节循环在主线程同步解码，hi-res 大图会卡住页面数秒；
      // fetch(dataUrl).blob() 走浏览器原生解码（异步），并保留 dataUrl 自带的真实 mime。
      const blob = await fetch(dataUrl).then(x => x.blob())
      const url = URL.createObjectURL(blob)
      // 覆盖前先释放上一张，否则每出一张图泄漏一个 blob URL
      if (resultUrl.value && resultUrl.value !== url) URL.revokeObjectURL(resultUrl.value)
      resultUrl.value  = url
      resultSeed.value = result.seed
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
