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
export const COMPANION_LIVE2D_KEY = 'aics_companion_live2d_v1'
export const COMPANION_BEHAVIOR_KEY = 'aics_companion_behavior_v1'
export const COMPANION_AFFECTION_KEY = 'aics_companion_affection_v1'
/** 角色窗 → 聊天窗的实时状态通道（低频繁写入，storage 事件跨窗下发） */
export const COMPANION_CHAT_LIVE_KEY = 'aics_companion_chat_live_v1'
export const SPEECH_INPUT_KEY = 'aics_speech_input_v1'
/** 绘图页引擎选择；键名保持不变以兼容已保存的 Anima 偏好。 */
export const DRAW_ENGINE_KEY = 'aics_draw_engine'
export const THEME_KEY = 'aics_theme'
export const INTERFACE_SOUND_KEY = 'aics_interface_sound_v1'
/** 成人内容展示开关（灵感场景页/热门场景页共用语义：本机默认开）。 */
export const MATURE_SETTING_KEY = 'aics_show_mature'
export const TUNNEL_OFF_KEY = 'aics_tunnel_off'
export const CHAT_THINKING_KEY = 'aics_chat_thinking_v1'
export const CHAT_USER_PROFILE_KEY = 'aics_user_profile_v1'
export const CHAT_MEMORY_KEY = 'aics_chat_memories_v1'
export const GUEST_GUIDE_DISMISSED_KEY = 'aics_guest_guide_dismissed'

/**
 * 上次成功备份的时间戳（localStorage）——活键但刻意不参与备份导出：
 * 恢复时不应把旧环境的备份时间戳覆盖到新环境。
 */
export const BACKUP_AT_KEY = 'aics_backup_last_at'

// ── IndexedDB / sessionStorage 键登记 ──
// 这两类不参与 localStorage 备份白名单（见文件头规则），但常量化在这里统一出处，
// 杜绝同一键名在多处以字面量重复定义（曾致 aics_pb_history 散落 9 处）。

/** 作品册历史（IndexedDB aics_kv_store 主存储；localStorage 同名键仅作旧数据迁移读取）。 */
export const ARTWORK_HISTORY_KV_KEY = 'aics_pb_history'
/** 历史损坏隔离区（storageHealth 使用，刻意不参与备份导出）。 */
export const ARTWORK_HISTORY_QUARANTINE_KEY = 'aics_pb_history_quarantine'
/** 作品册项目（IndexedDB 主存储；useBackup / 作品册 / 导演台共用）。 */
export const ARTWORK_PROJECTS_KV_KEY = 'aics_pb_projects'
/**
 * 作品册软删回收站（IndexedDB，2026-08-30 UX 审计 P0-8）。软删条目保留
 * 30 天（图片与缩略图在 purge 前不删），期间可整条恢复；超期由作品册
 * 挂载时的懒清理真删。刻意不参与备份导出：回收站属于会话期补救通道。
 */
export const ARTWORK_TRASH_KV_KEY = 'aics_pb_trash'
/** 绘图页 → 视频页单图跨页上下文（sessionStorage，容量敏感故不入 localStorage 备份）。 */
export const VIDEO_CONTEXT_KEY = 'aics_video_ctx'
/** 分镜短片批量带入上下文（sessionStorage）。 */
export const VIDEO_SHOTS_CONTEXT_KEY = 'aics_video_shots_ctx'
/** 剧本模式分幕 → 分镜短片跨页上下文（sessionStorage，2026-08-23 剧本模式激活）。 */
export const VIDEO_SCENARIO_CONTEXT_KEY = 'aics_video_scenario_ctx'

/**
 * SD 出图队列快照（2026-08-30 UX 审计 P0-5）。队列任务在离开绘图页 / 刷新后
 * 经此快照恢复。活键但刻意不参与备份导出：恢复到新环境时的陈旧队列没有
 * 价值（引用的 checkpoint / LoRA 可能不存在），只在本机会话内往返。
 */
export const SD_QUEUE_SNAPSHOT_KEY = 'aics_sd_queue_snapshot_v1'

export const LIVE_LOCAL_KEYS = [
  THEME_KEY,
  INTERFACE_SOUND_KEY,
  'aics_sd_last_success_v1',
  'aics_pb_last_draft',
  'aics_pb_director_mode',
  'aics_scene_favorites',
  'aics_recent_scenes',
  'aics_hidden_scenes',
  'aics_scene_usage_v1',
  MATURE_SETTING_KEY,
  TUNNEL_OFF_KEY,
  'aics_chat_v1',
  'aics_chat_model',
  'aics_chat_api_drafts',
  'aics_chat_archive_v1',
  CHAT_THINKING_KEY,
  CHAT_USER_PROFILE_KEY,
  CHAT_MEMORY_KEY,
  COMPANION_LIVE2D_KEY,
  COMPANION_BEHAVIOR_KEY,
  COMPANION_AFFECTION_KEY,
  SPEECH_INPUT_KEY,
  DRAW_ENGINE_KEY,
  GUEST_GUIDE_DISMISSED_KEY,
] as const

/** 动态前缀活键：训练参数/数据集选择按 job 动态命名。 */
export const LIVE_LOCAL_PREFIXES = [
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
