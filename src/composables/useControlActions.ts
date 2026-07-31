/**
 * 控制面板 · 操作编排（从 ControlView.vue 拆出）。
 *
 * 所有权：配置保存（/api/config、/api/preference）、服务启停、模式切换、
 * 公网隧道启停与诊断导出。所有 HTTP 都走统一错误信封。
 */

import { ref } from 'vue'
import type { ControlActionResult, ApiFailure } from '@/types/api'
import type { useControlStatus } from '@/composables/useControlStatus'

type StatusApi = ReturnType<typeof useControlStatus>

interface ActionHooks {
  showToast: (msg: string, isError?: boolean) => void
}

export function useControlActions(status: StatusApi, { showToast }: ActionHooks) {
  const tunnelEnabled = ref((() => { try { return localStorage.getItem('aics_tunnel_off') !== '1' } catch { return true } })())

  /** catch 里取消息：替代 `catch (e: any) { e.message }` —— unknown 才是 catch 的真实类型 */
  function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message
    const text = String(error ?? '').trim()
    return text || fallback
  }
  function copy(text: string) {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板')).catch(() => showToast('复制失败', true))
  }

  function toggleTunnel() {
    tunnelEnabled.value = !tunnelEnabled.value
    try { localStorage.setItem('aics_tunnel_off', tunnelEnabled.value ? '' : '1') } catch {}
    status.mainBtnLabel.value = status.tunnelActive.value ? '停止公网分享' : '启动并生成分享链接'
  }

  function buildConfigPayload() {
    const last = status.lastStatus()
    const neneBase = last?.voices?.nene || {}
    const natBase = last?.voices?.natsume || {}
    return {
      sdHost: status.sdHost.value.trim(),
      ttsHost: status.ttsHost.value.trim(),
      voices: {
        nene: { ...neneBase, refAudioPath: status.voiceNeneRef.value.trim(), promptText: status.voiceNenePrompt.value.trim(), promptLang: 'ja', textLang: 'ja' },
        natsume: { ...natBase, refAudioPath: status.voiceNatsumeRef.value.trim(), promptText: status.voiceNatsumePrompt.value.trim(), promptLang: 'ja', textLang: 'ja' },
      },
    }
  }

  async function saveConfig() {
    status.feedbackText.value = '正在保存并重新检测…'
    try {
      const r = await fetch('/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildConfigPayload()),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || '保存失败')
      showToast('生成服务配置已保存')
      status.pollStatus(true)
    } catch (e) { showToast(errorMessage(e, '保存失败'), true); status.pollStatus() }
  }

  async function saveAutoStartVoice() {
    try {
      const r = await fetch('/api/preference', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoStartVoice: status.autoStartVoice.value }),
      })
      // 不查 ok 的话，写盘失败也会弹"已开启" —— 用户下次重启才发现偏好没存上
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.error || `保存失败 (${r.status})`)
      }
      showToast(status.autoStartVoice.value ? '已开启：下次自动启动语音' : '已关闭：语音改为按需启动')
    } catch (e) {
      // 请求失败时把开关拨回去，避免 UI 与落盘状态不一致
      status.autoStartVoice.value = !status.autoStartVoice.value
      showToast(errorMessage(e, '保存失败'), true)
    }
  }

  /**
   * POST 一个控制动作并解出统一信封。
   *
   * 六处调用曾各写一遍 `json() → 查 ok → throw`，其中两处只读 data.msg、
   * 两处只读 data.error —— 后端信封统一后（server/http-envelope.js）
   * 这里也收敛成一份，少写一个候选字段就退化成"操作失败"的问题随之消失。
   */
  async function postControl(path: string, body: unknown, fallback: string): Promise<ControlActionResult> {
    const r = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => null) as ControlActionResult | ApiFailure | null
    if (!data) throw new Error(`${fallback} (HTTP ${r.status})`)
    if (!r.ok || data.ok === false) {
      const failure = data as ApiFailure
      throw new Error([failure.error || fallback, failure.detail].filter(Boolean).join('：'))
    }
    return data as ControlActionResult
  }

  async function serviceAction(service: string, action: string) {
    if (status.opBusy.value) { showToast('有操作正在进行，请稍候', true); return }
    showToast((action === 'start' ? '正在启动' : action === 'stop' ? '正在停止' : '正在处理') + '…')
    try {
      const data = await postControl('/api/service/' + service, { action }, '操作失败')
      if (data.operation) status.operation.value = data.operation
      showToast(data.message || '已提交')
      status.pollStatus(true); status.pollLogs()
    } catch (e) { showToast(errorMessage(e, '操作失败'), true); status.pollStatus(true) }
  }

  async function switchMode(mode: 'draw' | 'chat') {
    if (status.opBusy.value) { showToast('有操作正在进行，请稍候', true); return }
    showToast(mode === 'draw' ? '切换到绘图优先…' : '切换到聊天优先…')
    try {
      const data = await postControl('/api/mode', { mode }, '模式切换失败')
      if (data.operation) status.operation.value = data.operation
      status.modeBusy.value = true
      showToast(data.message || '模式切换已开始')
      status.pollStatus(true); status.pollLogs()
    } catch (e) { showToast(errorMessage(e, '模式切换失败'), true); status.pollStatus(true) }
  }

  async function doStart() {
    if (!status.lastStatus()) { showToast('控制面板仍在读取配置，请稍候再试', true); status.pollStatus(); return }
    status.actionBusy.value = true
    status.mainBtnLabel.value = '正在启用公网分享…'
    try {
      await saveConfig()
      await postControl('/api/start', { enableTunnel: tunnelEnabled.value }, '启动失败')
      showToast('公网分享已启用')
      status.startPolling()
    } catch (e) { showToast('启动失败：' + errorMessage(e, '未知原因'), true) }
    finally { status.actionBusy.value = false; status.pollStatus() }
  }

  async function doStop() {
    status.actionBusy.value = true
    status.mainBtnLabel.value = '正在停止公网分享…'
    try {
      await postControl('/api/stop', { stopManagedServices: false }, '停止失败')
      showToast('公网分享已停止；网站与各生成服务不受影响')
      status.shareLink.value = ''
      status.tunnelStatus.value = 'disabled'
      status.tunnelActive.value = false
    } catch (e) { showToast('停止失败：' + errorMessage(e, '未知原因'), true) }
    finally { status.actionBusy.value = false; status.pollStatus() }
  }

  async function exportDiag() {
    showToast('正在整理诊断包…')
    try {
      const r = await fetch('/api/diagnostics')
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || '诊断包导出失败')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }))
      a.download = 'lingji-diagnostics-' + stamp + '.json'
      a.click()
      URL.revokeObjectURL(a.href)
      showToast('诊断包已导出')
    } catch (e) { showToast(errorMessage(e, '诊断包导出失败'), true) }
  }

  return {
    tunnelEnabled, errorMessage, copy, toggleTunnel, saveConfig, saveAutoStartVoice,
    postControl, serviceAction, switchMode, doStart, doStop, exportDiag,
  }
}
