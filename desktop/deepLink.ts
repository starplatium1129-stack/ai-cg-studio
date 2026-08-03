/**
 * aics:// 深链解析（纯函数，无 Electron 依赖，可直接单测）。
 *
 * 支持的形态：
 *   aics://gallery      → /gallery
 *   aics://training     → /training
 *   aics://chat         → /chat
 *   aics://control      → /control
 *   aics:///prompt      → /prompt
 *   aics://unknown      → ''（拒绝）
 *   aics://             → ''（拒绝）
 */

export function normalizeAtelierPath(value: unknown): string {
  return typeof value === 'string' && /^\/(?:[a-z0-9-]+)?$/i.test(value) ? value : '/'
}

export function parseDeepLink(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'aics:') return ''
    // 只接受 aics://target 或 aics:///target 两种形态；带额外路径/参数拒绝
    if (parsed.hostname && parsed.pathname !== '/' && parsed.pathname !== '') return ''
    if (parsed.search || parsed.hash) return ''
    const target = (parsed.hostname || parsed.pathname.replace(/^\/+/, ''))
      .toLowerCase()
      .replace(/\/$/, '')
    if (!target) return ''
    const normalized = normalizeAtelierPath(`/${target}`)
    // 非法字符（!、?、# 等）会让 normalize 兜底到 '/'；深链必须显式拒绝
    return normalized === '/' ? '' : normalized
  } catch {
    return ''
  }
}
