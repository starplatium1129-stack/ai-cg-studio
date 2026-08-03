/**
 * 本地存储键统一登记 —— 备份/恢复与死键清理的唯一白名单来源。
 *
 * 规则：
 * - 新增 localStorage 持久化键必须登记到这里（或使用登记过的前缀）；
 * - 备份只收集 LIVE 键；恢复只写 LIVE 键；DEAD 键在备份导出时清理；
 * - IndexedDB（aics_kv_store / aics_image_store）由 useBackup 直接读取，
 *   不在这里登记。
 */

/** 精确活键：全站仍在读写的 localStorage 键。 */
export const LIVE_LOCAL_KEYS = [
  'aics_theme',
  'aics_interface_sound_v1',
  'aics_sd_last_success_v1',
  'aics_pb_last_draft',
  'aics_pb_director_mode',
  'aics_scene_favorites',
  'aics_recent_scenes',
  'aics_hidden_scenes',
  'aics_scene_usage_v1',
  'aics_show_mature',
  'aics_tunnel_off',
  'aics_chat_v1',
  'aics_chat_model',
  'aics_chat_api_drafts',
  'aics_chat_archive_v1',
  'aics_training_onboarded',
  'aics_guest_guide_dismissed',
] as const

/** 动态前缀活键：训练参数/数据集选择按 job 动态命名。 */
export const LIVE_LOCAL_PREFIXES = [
  'aics_training_params_',
  'aics_training_dataset_',
] as const

/** 死键：已无写入者、内容已迁移或废弃，备份导出时清理。 */
export const DEAD_LOCAL_KEYS = [
  'aics_sd_settings_v1',
  'aics_projects',
  'aics_pending_scene',
] as const

export function isLiveLocalKey(key: string): boolean {
  if ((LIVE_LOCAL_KEYS as readonly string[]).includes(key)) return true
  return (LIVE_LOCAL_PREFIXES as readonly string[]).some(prefix => key.startsWith(prefix))
}

export function isDeadLocalKey(key: string): boolean {
  return (DEAD_LOCAL_KEYS as readonly string[]).includes(key)
}

interface KeyedStorage {
  length: number
  key(index: number): string | null
  getItem(key: string): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

/** 遍历真实存储，只收集活键（含动态前缀）。 */
export function collectLiveLocalSettings(storage: KeyedStorage): Record<string, string> {
  const out: Record<string, string> = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || !isLiveLocalKey(key)) continue
    const value = storage.getItem(key)
    if (value != null) out[key] = value
  }
  return out
}

/** 清理死键；返回实际删除数量。 */
export function cleanDeadLocalKeys(storage: KeyedStorage): number {
  const removed: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && isDeadLocalKey(key)) removed.push(key)
  }
  for (const key of removed) {
    try { storage.removeItem(key) } catch { /* 隐私模式忽略 */ }
  }
  return removed.length
}

/** 备份恢复时只允许写入活键。 */
export function isRestorableLocalKey(key: string): boolean {
  return isLiveLocalKey(key)
}
