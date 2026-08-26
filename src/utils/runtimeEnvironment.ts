/**
 * 运行环境判定 —— 本机直连语义的唯一来源。
 *
 * 「本机」= localhost / 127.0.0.1 / [::1] 直连（非隧道分享链接）。
 * 消费方：成人内容传输层授权（useChatConversation → /api/desktop-tools）、
 * 访客引导、场景页成人内容默认值。此前该判断以内联正则/数组形式散落 4 处，
 * 现统一到这里。
 */

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'] as const

export function isLocalStudioHost(hostname: string = window.location.hostname): boolean {
  if ((LOCAL_HOSTNAMES as readonly string[]).includes(hostname)) return true
  // Tauri 桌面端 WebView 的 hostname 为 tauri.localhost / __tauri__ 协议，仍属本机
  if (hostname.includes('tauri')) return true
  try {
    const w = window as unknown as { companionDesktop?: { isDesktop?: boolean }; __TAURI__?: unknown }
    if (w.companionDesktop?.isDesktop) return true
    if (w.__TAURI__) return true
    if (window.location.protocol === 'tauri:' || window.location.protocol === 'https:' && hostname === 'tauri.localhost') return true
  } catch {}
  return false
}
