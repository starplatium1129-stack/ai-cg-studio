import { restoreBackupData } from '@/storage/backupRestore'
import { downloadBlob } from '@/utils/downloadBlob'
import { version as appVersion } from '../../package.json'
import { collectImageReferences, readSessionImageReferences } from '@/utils/storageReferences'
import { ref } from 'vue'
import { kvGet } from '@/composables/useKVStore'
import { imgList, imgGet, imgDeleteMany } from '@/composables/useImageStore'
import {
  createBackup,
  normalizeBackup,
  summarizeBackup,
  type BackupFile,
  type BackupImage,
  type BackupRecord,
  type BackupSummary,
} from '@/utils/backupCore'
import { inspectStorageHealth, summarizeStorageHealth } from '@/utils/storageHealth'
import {
  ARTWORK_HISTORY_KV_KEY,
  ARTWORK_PROJECTS_KV_KEY,
  ARTWORK_TRASH_KV_KEY,
  ARTWORK_HISTORY_QUARANTINE_KEY,
  BACKUP_AT_KEY,
  cleanDeadLocalKeys,
  collectLiveLocalSettings,
} from '@/utils/storageKeys'
import { buildArtworkFileName } from '@/utils/artworkFileName'
export type { BackupSummary } from '@/utils/backupCore'

/**
 * 本地数据备份 / 恢复 — 从重构前 tools/prompt-builder/backup.js 迁移。
 * 备份内容：作品历史、项目、出图设置、IndexedDB 图片（base64 内联）。
 */

// 键名统一出处：src/utils/storageKeys.ts
const HISTORY_KEY = ARTWORK_HISTORY_KV_KEY
const PROJECT_KEY = ARTWORK_PROJECTS_KV_KEY

// 备份时间戳键（BACKUP_AT_KEY）已登记在 storageKeys.ts：
// 活键但刻意不参与备份导出，恢复时不覆盖新环境的时间戳。

export function readLastBackupAt(): number {
  try {
    const value = Number(localStorage.getItem(BACKUP_AT_KEY))
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch { return 0 }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

function collectSettings(): Record<string, string> {
  // 活键统一登记在 src/utils/storageKeys.ts：精确键 + 训练动态前缀。
  return collectLiveLocalSettings(localStorage)
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return String(error ?? '').trim() || fallback
}

export function useBackup(onFlash: (msg: string) => void = () => {}) {
  const busy = ref(false)
  const pending = ref<BackupFile | null>(null)
  const pendingName = ref('')
  const lastBackupAt = ref(readLastBackupAt())
  let fileRequest = 0

  async function exportBackup(): Promise<void> {
    if (busy.value) return
    busy.value = true
    onFlash('正在整理备份…')
    try {
      // 导出前清理已确认无写入者的死键（如 aics_sd_settings_v1），
      // 避免备份文件长期携带废弃内容。
      const removedDead = cleanDeadLocalKeys(localStorage)
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
        } catch { throw new Error(`图片 ${record.id} 无法读取，未生成不完整备份，请重试`) }
      }
      const backup = createBackup({
        appVersion,
        createdAt: new Date().toISOString(),
        history: Array.isArray(history) ? history : [],
        projects: Array.isArray(projects) ? projects : [],
        settings: collectSettings(),
        images: encoded,
      })
      const json = JSON.stringify(backup)
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
      downloadBlob(blob, `aics-backup-${stamp}.json`)
      const info = summarizeBackup(backup)
      lastBackupAt.value = Date.now()
      try { localStorage.setItem(BACKUP_AT_KEY, String(lastBackupAt.value)) } catch {}
      onFlash(`备份完成：${info.history} 条记录 · ${info.images} 张图片 · ${Math.max(1, Math.round(json.length / 1024))} KB`
        + (removedDead ? ` · 已清理 ${removedDead} 个废弃存储键` : ''))
    } catch (e) {
      console.error('backup export failed', e)
      onFlash('备份失败：' + errorMessage(e, '请检查浏览器存储'))
    } finally {
      busy.value = false
    }
  }

  /**
   * 导出作品图片：把 IndexedDB 里的原图逐个下载成文件。
   * 与导出备份（JSON 恢复包）不同，这里导出的是可以直接使用的图片。
   */
  async function exportImages(): Promise<void> {
    if (busy.value) return
    busy.value = true
    onFlash('正在整理作品图片…')
    try {
      const records = (await imgList()) || []
      let saved = 0
      let failed = 0
      for (const record of records) {
        try {
          const blob = record.blob instanceof Blob ? record.blob : (record.id ? await imgGet(record.id) : null)
          if (!blob) { failed++; continue }
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          const ext = (blob.type || 'image/png').split('/')[1] || 'png'
          a.href = url
          // 2026-09-01 文件名去重：name 相同的多张图旧方案直接撞名，
          // 改用统一生成器，带时间戳与 id 尾号保证唯一（见 utils/artworkFileName.ts）。
          a.download = buildArtworkFileName({
            title: record.name,
            timestamp: record.created_at,
            id: record.id,
            ext,
          })
          document.body.appendChild(a)
          a.click()
          a.remove()
          // 大图下载完成后才释放 blob URL，避免下载中断
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
          saved++
        } catch { failed++ }
      }
      onFlash(saved
        ? `已开始下载 ${saved} 张作品图片（浏览器可能询问「允许下载多个文件」）`
        : '没有找到可导出的图片')
      if (failed) onFlash(`已开始下载 ${saved} 张；${failed} 张读取或下载失败，请重试`)
    } catch (e) {
      console.error('export images failed', e)
      onFlash('导出图片失败：' + errorMessage(e, '请检查浏览器存储'))
    } finally {
      busy.value = false
    }
  }

  async function loadFile(file: File): Promise<BackupSummary | null> {
    if (!file || busy.value) return null
    const request = ++fileRequest
    pending.value = null
    pendingName.value = ''
    if (file.size > 512 * 1024 * 1024) {
      onFlash('备份文件超过 512 MB，暂不支持直接恢复')
      return null
    }
    try {
      const normalized = normalizeBackup(JSON.parse(await file.text()))
      if (request !== fileRequest) return null
      pending.value = normalized
      pendingName.value = file.name
      return summarizeBackup(pending.value)
    } catch (e) {
      if (request !== fileRequest) return null
      pending.value = null
      pendingName.value = ''
      onFlash('无法读取备份：' + errorMessage(e, '文件已损坏'))
      return null
    }
  }

  function discard() { if (busy.value) return; fileRequest++; pending.value = null; pendingName.value = '' }

  async function restore(mode: 'replace' | 'merge', confirmed = false): Promise<boolean> {
    if (!pending.value || busy.value) return false
    const replace = mode === 'replace'
    if (replace && !confirmed && !window.confirm('覆盖恢复会替换当前项目与历史记录。原图保留，确认恢复后可通过存储清理释放空间。确定继续吗？')) {
      return false
    }
    busy.value = true
    onFlash(replace ? '正在覆盖恢复…' : '正在合并恢复…')
    try {
      await restoreBackupData(pending.value, replace)

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
    if (busy.value) return 0
    busy.value = true
    try {
      const [history, projects, trash, quarantine, images] = await Promise.all([
        kvGet(HISTORY_KEY), kvGet(PROJECT_KEY), kvGet(ARTWORK_TRASH_KV_KEY), kvGet(ARTWORK_HISTORY_QUARANTINE_KEY), imgList(),
      ])
      const referenced = collectImageReferences([history, projects, trash, quarantine, ...readSessionImageReferences(sessionStorage)])
      const orphans = (images || []).filter(record => !referenced.has(String(record.id)))
      if (!orphans.length) { onFlash('没有需要清理的孤儿图片'); return 0 }
      if (!window.confirm(`将删除 ${orphans.length} 张未被当前作品、回收站或草稿引用的图片。请先关闭其他创作标签页并导出备份。确定继续吗？`)) return 0
      await imgDeleteMany(orphans.map(r => r.id))
      onFlash(`已清理 ${orphans.length} 张孤儿图片`)
      return orphans.length
    } catch (e) {
      onFlash('清理失败：' + errorMessage(e, '请重试'))
      return 0
    } finally {
      busy.value = false
    }
  }

  return { busy, pending, pendingName, lastBackupAt, exportBackup, exportImages, loadFile, discard, restore, healthCheck, cleanOrphanImages }
}
