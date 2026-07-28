import { ref } from 'vue'
import { kvGet, kvSet } from '@/composables/useKVStore'
import { imgList, imgPutRecord, imgDeleteMany } from '@/composables/useImageStore'

/**
 * 本地数据备份 / 恢复 — 从重构前 tools/prompt-builder/backup.js 迁移。
 * 备份内容：作品历史、项目、出图设置、IndexedDB 图片（base64 内联）。
 */

const HISTORY_KEY = 'aics_pb_history'
const PROJECT_KEY = 'aics_pb_projects'
const SCHEMA_VERSION = 2

/**
 * 备份兼容旧版本的自由字段，但恢复/合并只依赖 id、timestamp、image_id。
 * `any[]` 会让损坏 JSON 里的任意值一路穿进 IndexedDB；这里保留未知字段以免
 * 降级恢复时丢数据，同时让所有使用点必须先经过对象窄化。
 */
export type BackupRecord = Record<string, unknown> & {
  id?: unknown
  timestamp?: unknown
  image_id?: unknown
}

const SETTINGS_KEYS = [
  'aics_theme',
  'aics_sd_settings_v1',
  'aics_pb_last_draft',
  'aics_scene_favorites',
  'aics_tunnel_off',
]

export interface BackupImage {
  id: string
  name?: string
  type?: string
  created_at?: number
  dataUrl: string
}

export interface BackupFile {
  app: string
  appVersion: string
  schemaVersion: number
  createdAt: string
  data: {
    history: BackupRecord[]
    projects: BackupRecord[]
    settings: Record<string, string>
  }
  images: BackupImage[]
}

export interface BackupSummary {
  history: number
  projects: number
  images: number
  settings: number
}

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

export function summarize(backup: BackupFile): BackupSummary {
  return {
    history: backup.data?.history?.length ?? 0,
    projects: backup.data?.projects?.length ?? 0,
    images: backup.images?.length ?? 0,
    settings: Object.keys(backup.data?.settings ?? {}).length,
  }
}

export function normalize(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object') throw new Error('备份文件格式不正确')
  const source = raw as Record<string, unknown>
  const data = source.data && typeof source.data === 'object' ? source.data as Record<string, unknown> : {}
  const file: BackupFile = {
    app: String(source.app || 'ai-cg-studio'),
    appVersion: String(source.appVersion || ''),
    schemaVersion: Number(source.schemaVersion) || 1,
    createdAt: String(source.createdAt || ''),
    data: {
      history: Array.isArray(data.history) ? data.history.filter(isBackupRecord) : [],
      projects: Array.isArray(data.projects) ? data.projects.filter(isBackupRecord) : [],
      settings: data.settings && typeof data.settings === 'object' ? data.settings as Record<string, string> : {},
    },
    images: Array.isArray(source.images)
      ? source.images.filter(isBackupImage)
      : [],
  }
  if (!file.data.history.length && !file.data.projects.length && !file.images.length) {
    throw new Error('备份文件里没有可恢复的数据')
  }
  return file
}

/** 按 id 合并：同 id 保留较新的（timestamp 大者） */
function isBackupRecord(value: unknown): value is BackupRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isBackupImage(value: unknown): value is BackupImage {
  if (!value || typeof value !== 'object') return false
  const image = value as Partial<BackupImage>
  return Boolean(image.id && typeof image.dataUrl === 'string')
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return String(error ?? '').trim() || fallback
}

export function mergeById(current: BackupRecord[], incoming: BackupRecord[]): BackupRecord[] {
  const map = new Map<string, BackupRecord>()
  ;[...(current || []), ...(incoming || [])].forEach(item => {
    if (!item || typeof item !== 'object') return
    const key = String(item.id ?? item.timestamp ?? Math.random())
    const prev = map.get(key)
    if (!prev || Number(item.timestamp || 0) >= Number(prev.timestamp || 0)) map.set(key, item)
  })
  return [...map.values()].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
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
      const backup: BackupFile = {
        app: 'ai-cg-studio',
        appVersion: '1.5.0',
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        data: {
          history: Array.isArray(history) ? history : [],
          projects: Array.isArray(projects) ? projects : [],
          settings: collectSettings(),
        },
        images: encoded,
      }
      const json = JSON.stringify(backup)
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
      const a = document.createElement('a')
      a.href = url
      a.download = `aics-backup-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      const info = summarize(backup)
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
      pending.value = normalize(JSON.parse(await file.text()))
      pendingName.value = file.name
      return summarize(pending.value)
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
        : mergeById(curHistory || [], imported.data.history)
      const projects = replace
        ? imported.data.projects
        : mergeById(curProjects || [], imported.data.projects)

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
      const historyCount = Array.isArray(history) ? history.length : 0
      const imageCount = images?.length ?? 0
      const bytes = (images || []).reduce((sum, r) => sum + (Number(r.size) || 0), 0)
      const mb = (bytes / 1024 / 1024).toFixed(1)

      let quotaText = ''
      try {
        const est = await navigator.storage?.estimate?.()
        if (est?.usage != null && est?.quota) {
          const pct = Math.round((est.usage / est.quota) * 100)
          quotaText = ` · 浏览器配额已用 ${pct}%`
        }
      } catch {}

      // 孤儿图片：历史里没引用但仍占空间
      const referenced = new Set((history || []).map(h => h.image_id).filter(Boolean).map(String))
      const orphans = (images || []).filter(r => !referenced.has(String(r.id)))

      const msg = `存储体检：${historyCount} 条作品 · ${imageCount} 张图片 · ${mb} MB${quotaText}`
        + (orphans.length ? ` · ${orphans.length} 张孤儿图片可清理` : ' · 正常')
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
      const referenced = new Set((history || []).map(h => h.image_id).filter(Boolean).map(String))
      const orphans = (images || []).filter(r => !referenced.has(String(r.id)))
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
