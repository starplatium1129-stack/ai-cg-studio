/**
 * 控制面板 · 状态轮询与渲染（从 ControlView.vue 拆出）。
 *
 * 所有权：状态、日志与分享链接的轮询生命周期，
 * 上游在线状态、操作进度、日志缓冲与展示文案。
 */

import { ref, computed, nextTick } from 'vue'
import { ApiClientError } from '../api/client.ts'
import { controlApi, type ControlApi } from '../api/controlApi.ts'
import type {
  ControlStatus, ControlLogs, ControlOperationView,
} from '@/types/api'

interface StatusHooks {
  showToast: (msg: string, isError?: boolean) => void
  api?: ControlApi
}

export function useControlStatus({ showToast, api = controlApi }: StatusHooks) {
  const tunnelActive = ref(false)
  const sdOnline = ref(false)
  const comfyOnline = ref(false)
  const ttsOnline = ref(false)
  const ollamaOnline = ref(false)
  const webuiManaged = ref(false)
  const comfyManaged = ref(false)
  const ollamaModels = ref<string[]>([])
  const ollamaVram = ref(0)
  const modeBusy = ref(false)
  const operation = ref<ControlOperationView | null>(null)
  const selfHealing = ref<ControlStatus['selfHealing'] | null>(null)
  const serviceChecking = ref(false)
  const scripts = ref({ voiceStart: true, voiceStop: true, webui: true, comfy: true })

  // renderStatus 会按焦点状态回填的配置回显（不主动覆盖正在输入的字段）
  const sdHost = ref('http://127.0.0.1:7860')
  const comfyHost = ref('http://127.0.0.1:8188')
  const ttsHost = ref('http://127.0.0.1:9880')
  const voiceNeneRef = ref('')
  const voiceNenePrompt = ref('')
  const voiceNatsumeRef = ref('')
  const voiceNatsumePrompt = ref('')
  const autoStartVoice = ref(false)

  const tunnelStatus = ref('')
  const shareLink = ref('')
  const localLink = ref('http://127.0.0.1:3000/')
  const uptime = ref('')
  /** 前端构建信息：公网分享伺服 dist/，源码过期时提示重建 */
  const webBuild = ref<{ distReady: boolean; builtAt: string | null; stale: boolean } | null>(null)
  const actionBusy = ref(false)
  const mainBtnLabel = ref('启动并生成分享链接')
  const feedbackClass = ref('config-feedback warn')
  const feedbackText = ref('正在检测本地服务…')
  const actionNote = ref('')
  const logs = ref<string[]>([])
  const logBoxEl = ref<HTMLElement | null>(null)
  const logIndex = ref(0)
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let lastStatus: ControlStatus | null = null
  let statusRequest: AbortController | null = null
  let logsRequest: AbortController | null = null
  let shareRequest: AbortController | null = null

  const opBusy = computed(() => !!(operation.value && operation.value.status === 'running') || modeBusy.value)
  const opStatusLabel = computed(() => {
    const s = operation.value?.status
    return s === 'running' ? '进行中' : s === 'completed' ? '完成' : s === 'failed' ? '失败' : ''
  })
  const opProgress = computed(() => {
    const op = operation.value
    if (!op?.stages?.length) return op?.status === 'completed' ? 100 : op?.status === 'running' ? 35 : 0
    if (op.status === 'completed') return 100
    if (op.status === 'failed') return Math.min(100, ((op.stageIndex + 1) / op.stages.length) * 100)
    return Math.min(95, ((op.stageIndex + 0.35) / op.stages.length) * 100)
  })
  const ollamaBadgeText = computed(() => {
    if (!ollamaOnline.value) return '未连接'
    if (!ollamaModels.value.length) return '在线 · 模型未加载'
    const v = fmtVram(ollamaVram.value)
    return '已加载 ' + ollamaModels.value.length + ' 个' + (v ? ' · ' + v : '')
  })
  const ollamaMeta = computed(() => {
    if (!ollamaOnline.value) return '未连接'
    if (!ollamaModels.value.length) return '在线 · 无加载模型'
    const v = fmtVram(ollamaVram.value)
    return '占用 ' + (v || (ollamaModels.value.length + ' 模型'))
  })
  const voiceConfiguredCount = computed(() => {
    let n = 0
    if (voiceNeneRef.value.trim() && voiceNenePrompt.value.trim()) n += 1
    if (voiceNatsumeRef.value.trim() && voiceNatsumePrompt.value.trim()) n += 1
    return n
  })
  const shareState = computed(() => tunnelActive.value ? 'on' : (tunnelStatus.value === 'disabled' ? 'off' : 'warn'))
  const shareLabel = computed(() => tunnelActive.value ? '通道已开' : (tunnelStatus.value === 'disabled' ? '仅本机' : '待启用'))
  const readyState = computed(() => {
    if (sdOnline.value && ttsOnline.value) return 'on'
    if (sdOnline.value || ttsOnline.value) return 'warn'
    return 'off'
  })
  const readyLabel = computed(() => {
    const n = [sdOnline.value, ttsOnline.value, ollamaOnline.value].filter(Boolean).length
    return n + ' / 3 服务在线'
  })

  function fmt(seconds: number) {
    const v = Math.max(0, Number(seconds) || 0)
    if (v < 60) return v + ' 秒'
    const m = Math.floor(v / 60)
    return m < 60 ? m + ' 分钟' : Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分钟'
  }
  function fmtVram(bytes: number) {
    const n = Number(bytes) || 0
    if (n <= 0) return ''
    if (n < 1024 ** 3) return (n / 1024 ** 2).toFixed(0) + ' MB'
    return (n / 1024 ** 3).toFixed(1) + ' GB'
  }
  function lineClass(line: string) {
    const low = line.toLowerCase()
    if (low.includes('error') || low.includes('failed') || low.includes('失败')) return 'err'
    if (low.includes('started') || low.includes('ready') || low.includes('已启') || low.includes('就绪')) return 'info'
    return ''
  }

  function renderStatus(data: ControlStatus) {
    lastStatus = data
    tunnelActive.value = !!(data.tunnelStatus === 'active' || data.shareLinkAvailable)
    sdOnline.value = !!data.sdOnline
    comfyOnline.value = !!data.comfyOnline
    ttsOnline.value = !!data.ttsOnline
    ollamaOnline.value = !!data.ollamaOnline
    webuiManaged.value = !!data.webuiManaged
    comfyManaged.value = !!data.comfyManaged
    ollamaModels.value = Array.isArray(data.ollamaModels) ? data.ollamaModels : []
    ollamaVram.value = Number(data.ollamaVram) || 0
    modeBusy.value = !!data.modeBusy
    operation.value = data.operation || (operation.value?.status === 'running' ? operation.value : null)
    selfHealing.value = data.selfHealing && typeof data.selfHealing === 'object' ? data.selfHealing : null
    tunnelStatus.value = data.tunnelStatus || ''
    // 分享链接含原始 token，已从 /api/status 拆到仅本机可读的 /api/share-link
    if (data.shareLinkAvailable) void loadShareLink()
    else {
      shareRequest?.abort()
      shareRequest = null
      shareLink.value = ''
    }
    if (data.localLink) localLink.value = data.localLink
    if (data.uptime != null) uptime.value = '网站已运行 ' + fmt(data.uptime)
    if (data.scripts) scripts.value = { ...scripts.value, ...data.scripts }
    if (data.webBuild) webBuild.value = {
      distReady:!!data.webBuild.distReady,
      builtAt:data.webBuild.builtAt || null,
      stale:!!data.webBuild.stale,
    }

    const ae = document.activeElement as HTMLElement | null
    const aeId = ae?.id || ''
    if (aeId !== 'sd-host' && data.sdHost) sdHost.value = data.sdHost
    if (aeId !== 'comfy-host' && data.comfyHost) comfyHost.value = data.comfyHost
    if (aeId !== 'tts-host' && data.ttsHost) ttsHost.value = data.ttsHost
    const voices = data.voices || {}
    const nene = voices.nene || {}
    const natsume = voices.natsume || {}
    if (aeId !== 'v-nene-ref') voiceNeneRef.value = nene.refAudioPath || voiceNeneRef.value
    if (aeId !== 'v-nene-prompt') voiceNenePrompt.value = nene.promptText || voiceNenePrompt.value
    if (aeId !== 'v-nat-ref') voiceNatsumeRef.value = natsume.refAudioPath || voiceNatsumeRef.value
    if (aeId !== 'v-nat-prompt') voiceNatsumePrompt.value = natsume.promptText || voiceNatsumePrompt.value
    if (ae?.tagName !== 'INPUT' || (ae as HTMLInputElement).type !== 'checkbox') {
      autoStartVoice.value = !!data.autoStartVoice
    }

    actionBusy.value = !!(data.operation && data.operation.status === 'running')
    mainBtnLabel.value = tunnelActive.value ? '停止公网分享' : '启动并生成分享链接'

    if (data.sdOnline && data.ttsOnline && data.ollamaOnline) {
      feedbackClass.value = 'config-feedback ok'
      feedbackText.value = '画面、语音与聊天均已就绪'
      actionNote.value = '可以完整使用绘制台、角色房间与配音。'
    } else if (data.sdOnline && data.ttsOnline) {
      feedbackClass.value = 'config-feedback ok'
      feedbackText.value = '画面与语音就绪'
      actionNote.value = '出图与 AI 声线可用；需要聊天时启动 Ollama。'
    } else if (data.sdOnline) {
      feedbackClass.value = 'config-feedback warn'
      feedbackText.value = '画面创作就绪'
      actionNote.value = '可正常出图。需要声线时启动 GPT-SoVITS。'
    } else if (data.ttsOnline) {
      feedbackClass.value = 'config-feedback warn'
      feedbackText.value = '语音已连接 · 等待 SD'
      actionNote.value = '点「启动」SD WebUI，或切换到绘图优先。'
    } else {
      feedbackClass.value = 'config-feedback warn'
      feedbackText.value = '浏览可用 · 等待生成服务'
      actionNote.value = '网站本身正常。用下方服务行启动 SD / 语音，或本机开好后再检测。'
    }
    serviceChecking.value = false
  }

  async function loadShareLink() {
    shareRequest?.abort()
    const controller = new AbortController()
    shareRequest = controller
    try {
      const data = await api.getShareLink({ signal: controller.signal })
      if (shareRequest !== controller || controller.signal.aborted) return
      shareLink.value = data.shareLink
    } catch {
      if (shareRequest === controller) shareLink.value = ''
    } finally {
      if (shareRequest === controller) shareRequest = null
    }
  }

  async function pollStatus(force = false) {
    if (force) serviceChecking.value = true
    statusRequest?.abort()
    const controller = new AbortController()
    statusRequest = controller
    try {
      const data = await api.getStatus({ fresh: force, signal: controller.signal })
      if (statusRequest !== controller || controller.signal.aborted) return
      renderStatus(data)
      // 探测失败现在是 200 + ok:false + degraded（与三个同族 *-status 一致）。
      // 之前后端回 500，这里的 `if (!r.ok) return` 会把状态墙冻在上一次的值上，
      // 用户看到的是"点了没反应"而不是"探测失败"。
      if (data.ok === false && data.error) showToast('服务探测失败：' + data.error, true)
    } catch {
      if (statusRequest === controller) serviceChecking.value = false
    } finally {
      if (statusRequest === controller) statusRequest = null
    }
  }

  async function pollLogs() {
    logsRequest?.abort()
    const controller = new AbortController()
    logsRequest = controller
    try {
      const data: ControlLogs = await api.getLogs(logIndex.value, { signal: controller.signal })
      if (logsRequest !== controller || controller.signal.aborted) return
      if (data.operation) operation.value = data.operation
      if (data.logs.length) {
        const fresh = data.logs.filter((l: string) => !logs.value.includes(l))
        if (fresh.length) {
          logs.value.push(...fresh)
          if (logs.value.length > 300) logs.value = logs.value.slice(-200)
          await nextTick()
          if (logBoxEl.value) logBoxEl.value.scrollTop = logBoxEl.value.scrollHeight
        }
      }
      // 2026-08-16 审计：游标改为服务端权威 controlLogs 总长（total），而不是按本批
      // logs.length 自增——本批混入每文件 ≤30 行文件尾行，旧实现把游标逐轮推过头，
      // 新 controlLogs 从此永不上屏（逐条吞日志）。服务端保证 total 不含尾行。
      logIndex.value = data.total
    } catch (error) {
      if (logsRequest === controller && error instanceof ApiClientError && (error.status === 403 || error.status === 421)) {
        clearLogs()
      }
    } finally {
      if (logsRequest === controller) logsRequest = null
    }
  }

  function clearLogs() { logs.value = []; logIndex.value = 0 }
  function startPolling() {
    if (pollTimer) return
    pollStatus(); pollLogs()
    pollTimer = setInterval(() => { pollStatus(); pollLogs() }, 3000)
  }
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    statusRequest?.abort()
    logsRequest?.abort()
    shareRequest?.abort()
    statusRequest = null
    logsRequest = null
    shareRequest = null
    serviceChecking.value = false
  }

  return {
    tunnelActive, sdOnline, comfyOnline, ttsOnline, ollamaOnline, webuiManaged, comfyManaged, ollamaModels, ollamaVram, selfHealing,
    modeBusy, operation, serviceChecking, scripts,
    sdHost, comfyHost, ttsHost, voiceNeneRef, voiceNenePrompt, voiceNatsumeRef, voiceNatsumePrompt, autoStartVoice,
    tunnelStatus, shareLink, localLink, uptime, actionBusy, mainBtnLabel, webBuild,
    feedbackClass, feedbackText, actionNote, logs, logBoxEl, logIndex,
    opBusy, opStatusLabel, opProgress, ollamaBadgeText, ollamaMeta, voiceConfiguredCount,
    shareState, shareLabel, readyState, readyLabel,
    lastStatus: () => lastStatus,
    renderStatus, loadShareLink, pollStatus, pollLogs, clearLogs, startPolling, stopPolling,
    fmtVram, lineClass,
  }
}
