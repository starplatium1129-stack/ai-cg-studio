import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import type { CompanionDesktopBridge } from '@/types/desktop'
import { controlApi } from '@/api/controlApi'
import { trainingApi } from '@/api/trainingApi'
import { imgCount } from '@/composables/useImageStore'
import { pickCompanionLine } from '@/config/characters'
import { pickEnvironmentGreeting } from '@/utils/environmentContext'
import { createCompanionBehavior, normalizeCompanionConfig, type CompanionReminder } from '@/utils/companionBehavior'
import {
  createCompanionEventDetector,
  EVENT_NOTIFY_TITLE,
  EVENT_ROUTE,
  type CompanionDetectedEvent,
} from '@/utils/companionEvents'
import { COMPANION_BEHAVIOR_KEY } from '@/utils/storageKeys'

export interface CompanionBehaviorRuntimeDeps {
  activeChar: Ref<string>
  desktopBridge?: CompanionDesktopBridge
  /** 桌面悬浮窗当前是否可见（不可见时不问候、不轮询下行）。 */
  desktopWindowVisible: () => boolean
  /** 语音自动收听重算（勿扰/安静时段/时间片变化影响 gating）。 */
  reconcileAutoListen: () => void
}

/**
 * 陪伴页「角色行为运行时」（2026-08-22 自 CompanionView 下沉）。
 *
 * 两只 30s 心跳：behavior.tick 驱动待办提醒与时间片环境问候
 * （同一时间片只问候一次，周日/周末视为不同片）；pollCompanionEvents
 * 聚合 SD/TTS/Ollama/训练任务/图片计数喂给事件检测器，产出事件提醒
 * 并同步任务栏进度环。勿扰/安静时段 gating、提醒入队（noteReturn 族）
 * 与事件路由跳转同归此处；两个定时器与轮询 AbortController 的
 * 生命周期由本 composable 自持。
 */
export function useCompanionBehaviorRuntime(deps: CompanionBehaviorRuntimeDeps) {
  const { activeChar, desktopBridge, desktopWindowVisible, reconcileAutoListen } = deps

  const behavior = createCompanionBehavior(readBehaviorConfig())
  const behaviorEnabled = computed(() => behavior.config().enabled)
  const dnd = ref(behavior.config().dnd)
  const pendingReminders = ref<CompanionReminder[]>([])
  const inQuietHours = ref(behavior.inQuietHours())
  const quietHoursText = computed(() => {
    const { quietStartHour, quietEndHour } = behavior.config()
    return `安静时段 ${quietStartHour}:00 – ${quietEndHour}:00 不主动问候`
  })

  const eventDetector = createCompanionEventDetector()
  let behaviorTimer = 0
  let eventPollTimer = 0
  let reminderLineOffset = 0
  let eventLineOffset = 0
  let eventPolling = false
  let eventPollController: AbortController | null = null
  let lastActivityAt = Date.now()
  let greetedSlotKey = ''
  let alive = true

  function readBehaviorConfig() {
    try {
      return normalizeCompanionConfig(JSON.parse(localStorage.getItem(COMPANION_BEHAVIOR_KEY) || 'null'))
    } catch {
      return normalizeCompanionConfig(null)
    }
  }

  function persistBehaviorConfig() {
    try { localStorage.setItem(COMPANION_BEHAVIOR_KEY, JSON.stringify(behavior.config())) } catch { /* 隐私模式忽略 */ }
  }

  function syncReminders() {
    pendingReminders.value = behavior.pending().slice()
    inQuietHours.value = behavior.inQuietHours()
  }

  function noteActivity() {
    behavior.noteActivity()
    lastActivityAt = Date.now()
  }

  /** 离开时长判定用（窗口重新可见时决定是否给「回来」问候）。 */
  function getLastActivityAt(): number {
    return lastActivityAt
  }

  /** 「回来」问候的离开阈值（分钟，0 = 关闭）。 */
  function getIdleMinutes(): number {
    return behavior.config().idleMinutes
  }

  /** 带台词轮转入队：先轮转 offset 再取词（返回/导入问候路径）。 */
  function noteReturn(pickLine: (offset: number) => string) {
    reminderLineOffset += 1
    const reminder = behavior.noteReturn(pickLine(reminderLineOffset))
    if (reminder) syncReminders()
  }

  /** 不轮转台词序号的入队（剪贴板固定话术路径）。 */
  function noteReturnPlain(line: string) {
    const reminder = behavior.noteReturn(line)
    if (reminder) syncReminders()
  }

  function toggleDnd() {
    const next = !behavior.config().dnd
    behavior.setConfig({ dnd: next })
    dnd.value = next
    persistBehaviorConfig()
    reconcileAutoListen()
  }

  function dismissReminder(id: string) {
    behavior.dismiss(id)
    syncReminders()
  }

  /** 时间片问候：同一时间片只入队一次；周日/周末视为不同片 */
  function currentGreetedSlotKey(): string {
    const now = new Date()
    const greeting = pickEnvironmentGreeting(activeChar.value, now)
    return `${activeChar.value}:${greeting.slot}:${greeting.weekend ? 'w' : 'd'}`
  }

  function maybeGreetByTime(force = false) {
    if (!behaviorEnabled.value) return
    const key = currentGreetedSlotKey()
    if (!force && key === greetedSlotKey) return
    greetedSlotKey = key
    const greeting = pickEnvironmentGreeting(activeChar.value, new Date(), reminderLineOffset)
    reminderLineOffset += 1
    const reminder = behavior.noteReturn(greeting.line)
    if (reminder) syncReminders()
  }

  function runBehaviorTick() {
    syncReminders()
    const reminder = behavior.tick()
    if (reminder) {
      reminderLineOffset += 1
      reminder.line = pickCompanionLine(activeChar.value, 'idle', reminderLineOffset)
      syncReminders()
    }
    // 跨时间片（午→下午、工作日→周末）时给一条环境问候
    if (alive && desktopWindowVisible()) maybeGreetByTime()
    reconcileAutoListen()
  }

  async function pollCompanionEvents() {
    if (eventPolling || !alive) return
    eventPolling = true
    const controller = new AbortController()
    eventPollController = controller
    try {
      const [status, trainingJobs, imageCount] = await Promise.all([
        controlApi.getStatus({ signal: controller.signal }).catch(() => null),
        trainingApi.getJobs({ signal: controller.signal }).then(result => result.jobs).catch(() => null),
        imgCount().catch(() => -1),
      ])
      if (!alive || controller.signal.aborted || !status || status.ok === false) return
      const jobs = (trainingJobs || []).map(job => ({
        id: job.id,
        status: job.status,
        percent: Number.isFinite(job.progress.percent) ? job.progress.percent : 0,
      }))
      // 任务栏进度环：训练中的任务显示 percent；空闲/完成/失败清除
      const activeJob = jobs.find(job => job.status === 'running' || job.status === 'stopping')
      desktopBridge?.setProgress(activeJob ? (activeJob.percent || 0) / 100 : null)
      const events = eventDetector.ingest({
        imageCount: imageCount >= 0 ? imageCount : 0,
        services: {
          sdOnline: status.sdOnline,
          ttsOnline: status.ttsOnline,
          ollamaOnline: status.ollamaOnline,
        },
        jobs,
      })
      for (const event of events) {
        eventLineOffset += 1
        const line = pickCompanionLine(activeChar.value, 'event', eventLineOffset, event)
        const reminder = behavior.noteEvent(event, line)
        if (reminder) {
          syncReminders()
          if (desktopBridge) desktopBridge.notify(EVENT_NOTIFY_TITLE[event], line)
        }
      }
    } catch {
      // 轮询失败静默：下次再试
    } finally {
      if (eventPollController === controller) eventPollController = null
      eventPolling = false
    }
  }

  function openReminderRoute(reminder: CompanionReminder) {
    if (reminder.kind !== 'event' || !reminder.eventKind) return
    const route = EVENT_ROUTE[reminder.eventKind as CompanionDetectedEvent]
    if (!route) return
    if (desktopBridge) {
      dismissReminder(reminder.id)
      desktopBridge.openAtelier(route)
    }
  }

  /** 导入/剪贴板入册后图片计数增加：重置检测器基线避免误报 sd-done。 */
  function resetEventDetector() {
    eventDetector.reset()
  }

  onMounted(() => {
    dnd.value = behavior.config().dnd
    behaviorTimer = window.setInterval(runBehaviorTick, 30_000) as unknown as number
    eventPollTimer = window.setInterval(() => { void pollCompanionEvents() }, 30_000) as unknown as number
    syncReminders()
    maybeGreetByTime()
    void pollCompanionEvents()
  })

  onUnmounted(() => {
    alive = false
    eventPollController?.abort()
    eventPollController = null
    clearInterval(behaviorTimer)
    clearInterval(eventPollTimer)
  })

  return {
    behaviorEnabled,
    dnd,
    pendingReminders,
    inQuietHours,
    quietHoursText,
    noteActivity,
    getLastActivityAt,
    getIdleMinutes,
    noteReturn,
    noteReturnPlain,
    toggleDnd,
    dismissReminder,
    maybeGreetByTime,
    openReminderRoute,
    resetEventDetector,
  }
}
