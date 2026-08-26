import { computed, onMounted, ref, type Ref } from 'vue'
import { ApiClientError } from '@/api/client'
import { maintenanceApi } from '@/api/maintenanceApi'
import type { BackupEntry } from '@/api/maintenanceApi'
import type { SceneDraft, TagRecord, CurationData } from '@/types/api'

export interface SceneMaintenanceDeps {
  scenes: Ref<SceneDraft[]>
  tags: Ref<TagRecord[]>
  curation: Ref<CurationData>
  /** 宿主持有的脏标记（编辑/导入/标签/策展任一改动置位）。 */
  dirty: Ref<boolean>
  /** 宿主持有的维护提示通道（保存进度/备份编号/桌面只读提示共用）。 */
  maintenanceHint: Ref<string>
  /** 保存成功后作废共享缓存（其他页面正拿着写回前的旧副本）。 */
  invalidateSceneCache: () => void
}

const TOOLS: Array<{ id: string; iconName: 'palette' | 'success' | 'filter' | 'gear'; label: string; desc: string }> = [
  { id: 'lint-colors', iconName: 'palette', label: '检查硬编码颜色', desc: '扫描未用 token 的硬编码颜色（建议用 npm run design:lint）' },
  { id: 'validate',    iconName: 'success', label: '完整场景校验',   desc: 'ID 唯一性、字段完整性、评级一致性' },
  { id: 'classify',    iconName: 'filter',  label: '更新场景评级',   desc: '根据标签重新计算 All/R15/R18' },
  { id: 'optimize',    iconName: 'gear',    label: '规范化提示词',   desc: '统一标签命名、补全负面词' },
]

/**
 * 场景管理页「维护任务」簇（2026-08-22 自 SceneManagerView 下沉）。
 *
 * 草稿落盘（saveScenes 分阶段进度文案 + 备份编号回执 + 共享缓存作废）、
 * 四个维护工具（lint/校验/评级/规范化，输出 sc### 高亮）、备份历史读取。
 * 桌面打包模式探测（data 只读、保存与维护任务禁用）在此自持。
 */
export function useSceneMaintenance(deps: SceneMaintenanceDeps) {
  const { scenes, tags, curation, dirty, maintenanceHint } = deps

  const saving = ref(false)
  const savingPhase = ref('')
  const toolRunning = ref(false)
  const toolResult = ref<{ ok: boolean; output: string } | null>(null)
  const toolResultTitle = ref('')
  const backups = ref<BackupEntry[]>([])
  const backupsLoading = ref(false)
  const backupsError = ref('')
  const backupsExpanded = ref(false)
  /** 桌面打包模式：data 在只读应用包内，场景保存与维护任务不可用 */
  const desktopPackaged = ref(false)

  function errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message
    const text = String(error ?? '').trim()
    return text || fallback
  }

  function maintenanceErrorMessage(error: unknown, fallback: string) {
    if (!(error instanceof ApiClientError) || !error.responseBody) return errorMessage(error, fallback)
    const output = typeof error.responseBody.output === 'string' ? error.responseBody.output.trim() : ''
    const recovery = typeof error.responseBody.recovery === 'string' ? error.responseBody.recovery.trim() : ''
    const message = output || errorMessage(error, fallback)
    return recovery && !message.includes(recovery) ? `${message}；${recovery}` : message
  }

  async function saveToProject() {
    if (!dirty.value || saving.value) return
    saving.value = true
    savingPhase.value = '正在写入分片…'
    maintenanceHint.value = '正在保存并检查…'
    let phaseTimers: ReturnType<typeof setTimeout>[] = []
    phaseTimers.push(setTimeout(() => { if (saving.value) savingPhase.value = '正在同步标签与策展…' }, 350))
    phaseTimers.push(setTimeout(() => { if (saving.value) savingPhase.value = '正在校验场景…' }, 750))
    phaseTimers.push(setTimeout(() => { if (saving.value) savingPhase.value = '正在更新版本…' }, 1150))
    try {
      const data = await maintenanceApi.saveScenes({
        scenes: scenes.value,
        tags: tags.value,
        curation: curation.value,
      })
      savingPhase.value = '正在更新版本…'
      dirty.value = false
      maintenanceHint.value = data.count + ' 个场景已同步；备份编号 ' + data.backup
      // 作废共享缓存：其他页面正拿着写回前的旧副本
      deps.invalidateSceneCache()
    } catch (e) {
      maintenanceHint.value = '保存未完成：' + maintenanceErrorMessage(e, '请重试')
    } finally {
      phaseTimers.forEach(clearTimeout)
      saving.value = false
      // 保留最后阶段文案短暂可见后清空
      setTimeout(() => { if (!saving.value) savingPhase.value = '' }, 1200)
    }
  }

  async function runTool(taskId: string) {
    if (toolRunning.value) return
    const tool = TOOLS.find(t => t.id === taskId)
    if (!tool) return
    toolRunning.value = true
    toolResultTitle.value = tool.iconName + ' ' + tool.label
    toolResult.value = { ok: true, output: '...' }
    try {
      const data = await maintenanceApi.run(taskId)
      toolResult.value = { ok: true, output: data.output || '(no output)' }
    } catch (e) {
      toolResult.value = { ok: false, output: maintenanceErrorMessage(e, '请重试') }
    } finally {
      toolRunning.value = false
    }
  }

  async function loadBackups() {
    if (backupsLoading.value) return
    backupsLoading.value = true; backupsError.value = ''
    try {
      const data = await maintenanceApi.listBackups()
      backups.value = (data.entries || []) as BackupEntry[]
      backupsExpanded.value = true
    } catch (e) {
      backupsError.value = maintenanceErrorMessage(e, '读取备份历史失败')
    } finally { backupsLoading.value = false }
  }

  function formatBackupTime(v: string) {
    if (!v) return '—'
    try { const d = new Date(v); if (isNaN(d.getTime())) return v; return d.toLocaleString('zh-CN', { hour12: false }) } catch { return v }
  }

  const highlightedToolOutput = computed(() => {
    const src = toolResult.value?.output || ''
    const safe = String(src || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return safe.replace(/(sc\d{3})/g, '<span class="hl-id">$1</span>')
  })
  // 模板兼容别名
  const highlightedOutput = highlightedToolOutput

  onMounted(() => {
    if (window.companionDesktop) {
      window.companionDesktop.isPackaged().then(packaged => {
        desktopPackaged.value = packaged
        if (packaged) maintenanceHint.value = '桌面应用模式：场景内容位于只读应用包内，保存与维护任务不可用'
      }).catch(() => { /* 查询失败保持可用，服务端仍有 501 兜底 */ })
    }
  })

  return {
    TOOLS,
    saving,
    savingPhase,
    toolRunning,
    toolResult,
    toolResultTitle,
    backups,
    backupsLoading,
    backupsError,
    backupsExpanded,
    desktopPackaged,
    saveToProject,
    runTool,
    loadBackups,
    formatBackupTime,
    highlightedOutput,
  }
}
