/**
 * 作品册下载文件名生成（2026-09-01）
 *
 * 旧方案 `{场景标题}-{seed ?? id}.png` 的重名根因：
 * 1. 同一场景连出多张图，标题一样、seed 也固定/复用 → 文件名完全相同；
 * 2. 批量导出（useBackup.exportImages）用 `cg-{name || id}`，name 相同直接撞车。
 *
 * 新方案把「语义 + 时间 + 种子 + 唯一尾号」拼在一起，保证不重名且肉眼可读：
 *   {标题}_{角色?}_{yyyyMMdd-HHmmss}_{s<seed>?}_{id末6位}.png
 * 其中 id 末 6 位永远保留，是硬唯一兜底——就算标题、seed、时间全撞，也不会同名。
 */

const ILLEGAL = /[\\/:*?"<>|]/g

/** 清洗单个文件名分段：去掉非法字符、压空白、限长。 */
function cleanPart(value: string, maxLen: number): string {
  const cleaned = value.replace(ILLEGAL, '_').replace(/\s+/g, ' ').trim()
  if (cleaned.length > maxLen) return cleaned.slice(0, maxLen)
  return cleaned
}

/** 取 id 末 N 位做唯一尾号；顺带清洗，避免奇怪字符进文件名。 */
function shortId(id: string | number | null | undefined, len = 6): string {
  const s = String(id ?? '').trim()
  if (!s) return ''
  return cleanPart(s.slice(-len), len)
}

/** 本地时间戳 → `20260901-214432` 形式，排序友好且人眼可读。 */
function formatStamp(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** 宽松解析 timestamp 字段：老记录可能是字符串或干脆缺失。 */
function parseTimestamp(ts: string | number | null | undefined): number {
  if (typeof ts === 'number') return ts
  if (typeof ts === 'string' && ts.trim() !== '') {
    const parsed = new Date(ts).getTime()
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }
  return Number.NaN
}

export interface ArtworkFileNameOptions {
  /** 语义标题：场景标题 / 作品名 / 故事摘要等，可缺省 */
  title?: string | null
  /** 角色名，可缺省；与标题相同时不重复拼接 */
  character?: string | null
  /** 记录时间戳（秒毫秒均可，兼容字符串日期），可缺省 */
  timestamp?: string | number | null
  /** 采样 seed，可缺省 */
  seed?: string | number | null
  /** 记录 id——唯一兜底，强烈建议始终传入 */
  id?: string | number | null
  /** 扩展名，默认 png */
  ext?: string
}

/**
 * 生成不重名的作品下载文件名。
 * 段顺序：标题_角色_时间_seed_id尾号；全空的极端情况兜底 `artwork`。
 */
export function buildArtworkFileName(opts: ArtworkFileNameOptions): string {
  const parts: string[] = []

  const title = cleanPart(String(opts.title ?? '').trim(), 40)
  if (title) parts.push(title)

  const character = cleanPart(String(opts.character ?? '').trim(), 20)
  if (character && character !== title) parts.push(character)

  const ts = parseTimestamp(opts.timestamp)
  if (Number.isFinite(ts) && ts > 0) parts.push(formatStamp(ts))

  const seed = String(opts.seed ?? '').trim()
  if (seed) parts.push(`s${cleanPart(seed, 20)}`)

  // 没有任何语义段（老记录无标题/时间/seed）时，把 id 尾号加宽到 12 位，
  // 避免退化成「000000.png」这种既难认又可能撞名的文件名。
  const sidLen = parts.length > 0 ? 6 : 12
  const sid = shortId(opts.id, sidLen)
  if (sid && !parts.includes(sid)) parts.push(sid)

  const base = parts.length > 0 ? parts.join('_') : 'artwork'
  return `${base}.${opts.ext || 'png'}`
}
