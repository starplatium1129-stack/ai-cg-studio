import { ref } from 'vue'
import { kvGet, kvSet } from '@/composables/useKVStore'
import { imgList, imgPutRecord, imgDeleteMany } from '@/composables/useImageStore'
import {
  createBackup,
  mergeBackupRecords,
  normalizeBackup,
  summarizeBackup,
  type BackupFile,
  type BackupImage,
  type BackupRecord,
  type BackupSummary,
} from '@/utils/backupCore'
import { inspectStorageHealth, summarizeStorageHealth } from '@/utils/storageHealth'
export type { BackupSummary } from '@/utils/backupCore'

/**
 * 本地数据备份 / 恢复 — 从重构前 tools/prompt-builder/backup.js 迁移。
 * 备份内容：作品历史、项目、出图设置、IndexedDB 图片（base64 内联）。
 */

const HISTORY_KEY = 'aics_pb_history'
const PROJECT_KEY = 'aics_pb_projects'

const SETTINGS_KEYS = [
  'aics_theme',
  // 快速出图的上次参数（PromptBuilderView 写入）——原来这里记的是早已
  // 没有生产者的死键 aics_sd_settings_v1，备份会漏掉真实的出图设置。
  'aics_sd_last_success_v1',
  'aics_pb_last_draft',
  'aics_scene_favorites',
  'aics_tunnel_off',
]

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = String(dataUrl || '').split(',')
  const mime = /data:([^;]+)/.exec(head || '')?.[1] || 'image/png'
  const bin = atob(body || '')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function collectSettings(): Record<string, string> {
  const out: Record<string, string> = {}
  SETTINGS_KEYS.forEach(key => {
    try {
      const value = localStorage.getItem(key)
      if (value != null) out[key] = value
    } catch {}
  })
  return out
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return String(error ?? '').trim() || fallback
}

export function useBackup(onFlash: (msg: string) => void = () => {}) {
  const busy = ref(false)
  const pending = ref<BackupFile | null>(null)
  const pendingName = ref('')

  async function exportBackup(): Promise<void> {
    if (busy.value) return
    busy.value = true
    onFlash('正在整理备份…')
    try {
      const [history, projects, images] = await Promise.all([
        kvGet<BackupRecord[]>(HISTORY_KEY),
        kvGet<BackupRecord[]>(PROJECT_KEY),
        imgList(),
      ])
      const encoded: BackupImage[] = []
      for (const record of images || []) {
        try {
          encoded.push({
            id: record.id,
            name: record.name,
            type: record.type,
            created_at: record.created_at,
            dataUrl: await blobToDataUrl(record.blob),
          })
        } catch (e) { console.warn('skip image', record.id, e) }
      }
      const backup = createBackup({
        appVersion: '1.5.0',
        createdAt: new Date().toISOString(),
        history: Array.isArray(history) ? history : [],
        projects: Array.isArray(projects) ? projects : [],
        settings: collectSettings(),
        images: encoded,
      })
      const json = JSON.stringify(backup)
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
      const a = document.createElement('a')
      a.href = url
      a.download = `aics-backup-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      const info = summarizeBackup(backup)
      onFlash(`备份完成：${info.history} 条记录 · ${info.images} 张图片 · ${Math.max(1, Math.round(json.length / 1024))} KB`)
    } catch (e) {
      console.error('backup export failed', e)
      onFlash('备份失败：' + errorMessage(e, '请检查浏览器存储'))
    } finally {
      busy.value = false
    }
  }

  async function loadFile(file: File): Promise<BackupSummary | null> {
    if (!file) return null
    if (file.size > 512 * 1024 * 1024) {
      onFlash('备份文件超过 512 MB，暂不支持直接恢复')
      return null
    }
    try {
      pending.value = normalizeBackup(JSON.parse(await file.text()))
      pendingName.value = file.name
      return summarizeBackup(pending.value)
    } catch (e) {
      pending.value = null
      pendingName.value = ''
      onFlash('无法读取备份：' + errorMessage(e, '文件已损坏'))
      return null
    }
  }

  function discard() { pending.value = null; pendingName.value = '' }

  async function restore(mode: 'replace' | 'merge'): Promise<boolean> {
    if (!pending.value || busy.value) return false
    const replace = mode === 'replace'
    if (replace && !window.confirm('覆盖恢复会替换当前项目、历史记录和本地图片。建议先导出一份当前备份。确定继续吗？')) {
      return false
    }
    busy.value = true
    onFlash(replace ? '正在覆盖恢复…' : '正在合并恢复…')
    try {
      const imported = pending.value
      const [curHistory, curProjects] = await Promise.all([
        kvGet<BackupRecord[]>(HISTORY_KEY),
        kvGet<BackupRecord[]>(PROJECT_KEY),
      ])
      const history = replace
        ? imported.data.history
        : mergeBackupRecords(curHistory || [], imported.data.history)
      const projects = replace
        ? imported.data.projects
        : mergeBackupRecords(curProjects || [], imported.data.projects)

      if (replace) {
        const existing = await imgList()
        await imgDeleteMany((existing || []).map(r => r.id))
      }
      for (const img of imported.images) {
        try {
          await imgPutRecord({
            id: img.id,
            blob: dataUrlToBlob(img.dataUrl),
            name: img.name,
            type: img.type,
            created_at: img.created_at,
          })
        } catch (e) { console.warn('restore image failed', img.id, e) }
      }

      await Promise.all([kvSet(HISTORY_KEY, history), kvSet(PROJECT_KEY, projects)])

      if (replace) SETTINGS_KEYS.forEach(k => { try { localStorage.removeItem(k) } catch {} })
      Object.entries(imported.data.settings || {}).forEach(([k, v]) => {
        if (SETTINGS_KEYS.includes(k)) { try { localStorage.setItem(k, String(v)) } catch {} }
      })

      pending.value = null
      pendingName.value = ''
      onFlash((replace ? '覆盖' : '合并') + '恢复完成，即将刷新页面…')
      setTimeout(() => window.location.reload(), 700)
      return true
    } catch (e) {
      console.error('backup restore failed', e)
      onFlash('恢复失败：' + errorMessage(e, '备份数据无效'))
      return false
    } finally {
      busy.value = false
    }
  }

  /** 存储体检：历史条数、图片体积、配额占用 */
  async function healthCheck(): Promise<string> {
    try {
      const [history, images] = await Promise.all([kvGet<BackupRecord[]>(HISTORY_KEY), imgList()])
      const bytes = (images || []).reduce((sum, r) => sum + (Number(r.size) || 0), 0)
      const mb = (bytes / 1024 / 1024).toFixed(1)

      let quota: StorageEstimate | null = null
      try {
        quota = await navigator.storage?.estimate?.() || null
      } catch {}

      const report = inspectStorageHealth(history, images, { quota })
      const msg = `存储体检：${summarizeStorageHealth(report)} · 图片 ${mb} MB`
        + (report.ok && !report.orphanImageIds.length ? ' · 正常' : '')
      onFlash(msg)
      return msg
    } catch (e) {
      onFlash('存储体检失败：' + errorMessage(e, '请检查浏览器存储'))
      return ''
    }
  }

  /** 清理未被历史引用的图片 */
  async function cleanOrphanImages(): Promise<number> {
    try {
      const [history, images] = await Promise.all([kvGet<BackupRecord[]>(HISTORY_KEY), imgList()])
      const report = inspectStorageHealth(history, images)
      const orphanIds = new Set(report.orphanImageIds)
      const orphans = (images || []).filter(r => orphanIds.has(String(r.id)))
      if (!orphans.length) { onFlash('没有需要清理的孤儿图片'); return 0 }
      if (!window.confirm(`将删除 ${orphans.length} 张未被作品引用的图片。建议先导出备份。确定继续吗？`)) return 0
      await imgDeleteMany(orphans.map(r => r.id))
      onFlash(`已清理 ${orphans.length} 张孤儿图片`)
      return orphans.length
    } catch (e) {
      onFlash('清理失败：' + errorMessage(e, '请重试'))
      return 0
    }
  }

  return { busy, pending, pendingName, exportBackup, loadFile, discard, restore, healthCheck, cleanOrphanImages }
}
