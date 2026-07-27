<template>
  <div class="control-page">
    <!-- 顶栏 -->
    <nav class="nav">
      <div class="nav-inner nav-local">
        <RouterLink to="/" class="nav-local-brand">
          <img class="nav-logo" src="/assets/logo.svg" alt="绫季绘境" />
          <div><strong>绫季绘境</strong><small>Control Panel</small></div>
        </RouterLink>
        <div class="nav-local-actions">
          <AppThemeToggle />
        </div>
      </div>
    </nav>

    <div class="page" style="--page-max:860px">
      <!-- 主状态 -->
      <div class="status-hero">
        <div class="badge-row">
          <span class="status-badge" :class="running ? 'running' : 'stopped'">
            <span class="dot"></span>
            <span>{{ running ? '运行中' : '未启动' }}</span>
          </span>
          <span class="status-badge" :class="sdOnline ? 'online' : 'offline'">
            <span class="dot"></span><span>SD {{ sdOnline ? '已连接' : '未连接' }}</span>
          </span>
          <span class="status-badge" :class="ttsOnline ? 'online' : 'offline'">
            <span class="dot"></span><span>TTS {{ ttsOnline ? '已连接' : '未连接' }}</span>
          </span>
          <span class="status-badge" :class="ollamaOnline ? 'online' : 'offline'">
            <span class="dot"></span><span>Ollama {{ ollamaOnline ? '已连接' : '未连接' }}</span>
          </span>
        </div>
        <div class="config-feedback" :class="feedbackClass">{{ feedbackText }}</div>
        <p class="action-note">{{ actionNote }}</p>
      </div>

      <!-- 主操作按钮 -->
      <button
        class="btn btn-lg btn-block"
        :class="running ? 'btn-danger' : 'btn-primary'"
        type="button"
        :disabled="actionBusy"
        @click="running ? doStop() : doStart()"
      >{{ mainBtnLabel }}</button>

      <!-- Tunnel 开关 -->
      <div class="tunnel-row">
        <label class="switch-label">
          <button
            class="switch-toggle" type="button" role="switch"
            :aria-checked="tunnelEnabled ? 'true' : 'false'"
            @click="toggleTunnel"
          ><span class="switch-thumb"></span></button>
          开启公网分享通道
        </label>
        <span class="tunnel-hint">{{ tunnelEnabled ? '朋友可通过临时链接访问' : '关闭后仅本机可访问' }}</span>
      </div>

      <!-- 运行中面板 -->
      <div v-if="running" class="running-panel">
        <div class="link-row">
          <span class="link-label">本地地址</span>
          <a class="link-value" :href="localLink" target="_blank">{{ localLink }}</a>
          <button class="btn btn-ghost btn-sm" type="button" @click="copy(localLink)">复制地址</button>
          <a class="btn btn-ghost btn-sm" :href="localLink" target="_blank">打开</a>
        </div>
        <div class="link-row">
          <span class="link-label">分享链接</span>
          <span class="link-value" :class="shareLink ? '' : 'waiting'">{{ shareLink || (tunnelStatus === 'disabled' ? '未生成公网链接' : '等待分享链接…') }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="!shareLink" type="button" @click="copy(shareLink)">复制链接</button>
        </div>
        <div class="uptime-row">{{ uptime }}</div>
      </div>

      <!-- 配置表单 -->
      <details class="config-section" open>
        <summary class="section-title">⚙️ 服务配置</summary>
        <div class="config-grid">
          <label class="config-field">
            SD WebUI 地址
            <input v-model="sdHost" class="input" type="text" placeholder="http://127.0.0.1:7860" :disabled="running" />
          </label>
          <label class="config-field">
            GPT-SoVITS 地址
            <input v-model="ttsHost" class="input" type="text" placeholder="http://127.0.0.1:9880" :disabled="running" />
          </label>
        </div>
        <details class="voice-section">
          <summary>🎙 语音配置</summary>
          <div class="voice-grid">
            <label class="config-field">宁宁参考音频路径<input v-model="voiceNeneRef" class="input" :disabled="running" /></label>
            <label class="config-field">宁宁提示文本<input v-model="voiceNenePrompt" class="input" :disabled="running" /></label>
            <label class="config-field">夏目参考音频路径<input v-model="voiceNatsumeRef" class="input" :disabled="running" /></label>
            <label class="config-field">夏目提示文本<input v-model="voiceNatsumePrompt" class="input" :disabled="running" /></label>
          </div>
        </details>
        <div class="config-actions">
          <label class="switch-label">
            <input type="checkbox" v-model="autoStartVoice" @change="saveAutoStartVoice" :disabled="running" />
            下次启动自动开始语音服务
          </label>
          <button class="btn btn-ghost" type="button" :disabled="running" @click="saveConfig">💾 保存配置</button>
        </div>
      </details>

      <!-- 日志 -->
      <details class="log-section">
        <summary class="section-title">📋 运行日志 <button class="btn btn-ghost btn-sm" type="button" @click.stop="clearLogs">清空</button></summary>
        <div class="log-box" ref="logBoxEl">
          <div v-if="!logs.length" class="log-empty">暂无日志。</div>
          <div v-for="(line, i) in logs" :key="i" :class="lineClass(line)">
            <span class="time">{{ line.slice(0,10) }}</span> {{ line.slice(11) }}
          </div>
        </div>
      </details>

      <!-- 诊断 -->
      <div class="diag-row">
        <button class="btn btn-ghost btn-sm" type="button" @click="pollStatus(true)">🔄 刷新状态</button>
        <button class="btn btn-ghost btn-sm" type="button" @click="exportDiag">⬇️ 导出诊断包</button>
      </div>

      <!-- Toast -->
      <div class="toast" :class="{ show: toast.visible, error: toast.error }">{{ toast.msg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import AppThemeToggle from '@/components/AppThemeToggle.vue'

const running     = ref(false)
const sdOnline    = ref(false)
const ttsOnline   = ref(false)
const ollamaOnline= ref(false)
const sdHost      = ref('http://127.0.0.1:7860')
const ttsHost     = ref('http://127.0.0.1:9880')
const voiceNeneRef     = ref('')
const voiceNenePrompt  = ref('')
const voiceNatsumeRef  = ref('')
const voiceNatsumePrompt = ref('')
const autoStartVoice   = ref(false)
const tunnelEnabled    = ref((() => { try { return localStorage.getItem('aics_tunnel_off') !== '1' } catch { return true } })())
const tunnelStatus     = ref('')
const shareLink        = ref('')
const localLink        = ref('http://127.0.0.1:3000/')
const uptime           = ref('')
const actionBusy       = ref(false)
const mainBtnLabel     = ref('启动并生成分享链接')
const feedbackClass    = ref('config-feedback warn')
const feedbackText     = ref('正在检测服务…')
const actionNote       = ref('')
const logs             = ref<string[]>([])
const logBoxEl         = ref<HTMLElement | null>(null)
const logIndex         = ref(0)
const toast            = ref({ visible: false, msg: '', error: false })
let toastTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastStatus: any = null

function showToast(msg: string, isError = false) {
  toast.value = { visible: true, msg, error: isError }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.visible = false }, 2200)
}

function copy(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板')).catch(() => showToast('复制失败', true))
}

function fmt(seconds: number) {
  const v = Math.max(0, Number(seconds) || 0)
  if (v < 60) return v + ' 秒'
  const m = Math.floor(v / 60)
  return m < 60 ? m + ' 分钟' : Math.floor(m/60) + ' 小时 ' + (m%60) + ' 分钟'
}

function lineClass(line: string) {
  const low = line.toLowerCase()
  if (low.includes('error') || low.includes('failed') || low.includes('not found')) return 'err'
  if (low.includes('started') || low.includes('ready') || low.includes('tunnel')) return 'info'
  return ''
}

function toggleTunnel() {
  tunnelEnabled.value = !tunnelEnabled.value
  try { localStorage.setItem('aics_tunnel_off', tunnelEnabled.value ? '' : '1') } catch {}
  mainBtnLabel.value = tunnelEnabled.value ? '启动并生成分享链接' : '启动（仅本地）'
}

function renderStatus(data: any) {
  lastStatus = data
  running.value = !!data.running
  sdOnline.value = !!data.sdOnline
  ttsOnline.value = !!data.ttsOnline
  ollamaOnline.value = !!data.ollamaOnline
  tunnelStatus.value = data.tunnelStatus || ''
  shareLink.value = data.shareLink || ''
  if (data.localLink) localLink.value = data.localLink
  if (data.uptime != null) uptime.value = '网关已运行 ' + fmt(data.uptime)
  if (document.activeElement?.id !== 'sd-host' && data.sdHost) sdHost.value = data.sdHost
  if (document.activeElement?.id !== 'tts-host' && data.ttsHost) ttsHost.value = data.ttsHost
  const voices = data.voices || {}
  const nene = voices.nene || {}; const natsume = voices.natsume || {}
  if (document.activeElement?.id !== 'v-nene-ref') voiceNeneRef.value = nene.refAudioPath || ''
  if (document.activeElement?.id !== 'v-nene-prompt') voiceNenePrompt.value = nene.promptText || ''
  if (document.activeElement?.id !== 'v-nat-ref') voiceNatsumeRef.value = natsume.refAudioPath || ''
  if (document.activeElement?.id !== 'v-nat-prompt') voiceNatsumePrompt.value = natsume.promptText || ''
  autoStartVoice.value = !!data.autoStartVoice
  actionBusy.value = !!(data.operation && data.operation.status === 'running')
  mainBtnLabel.value = running.value ? '停止网站网关' : (tunnelEnabled.value ? '启动并生成分享链接' : '启动（仅本地）')

  if (data.sdOnline && data.ttsOnline) {
    feedbackClass.value = 'config-feedback ok'; feedbackText.value = '画面与语音服务均已连接，可以生成完整的有声场景。'
    actionNote.value = 'SD WebUI 与 GPT-SoVITS 已就绪，启动后即可本地使用或按需分享。'
  } else if (data.sdOnline) {
    feedbackClass.value = 'config-feedback warn'; feedbackText.value = 'SD WebUI 已连接；GPT-SoVITS 暂不可用，系统声音试听仍可使用。'
    actionNote.value = '现在可以正常出图；需要 AI 角色声线时，再启动并配置 GPT-SoVITS。'
  } else if (data.ttsOnline) {
    feedbackClass.value = 'config-feedback warn'; feedbackText.value = 'GPT-SoVITS 已连接；请启动带有 --api 参数的 SD WebUI 才能直接出图。'
    actionNote.value = '语音已经可用，画面生成仍需连接 SD WebUI。'
  } else {
    feedbackClass.value = 'config-feedback warn'; feedbackText.value = '暂未检测到生成服务；网站浏览和系统声音试听仍可使用。'
    actionNote.value = '可先启动网站浏览场景，出图和 AI 声线会在对应服务连接后启用。'
  }
}

async function pollStatus(force = false) {
  try {
    const r = await fetch('/api/status' + (force ? '?fresh=1' : ''))
    renderStatus(await r.json())
  } catch {}
}

async function pollLogs() {
  try {
    const r = await fetch('/api/logs?since=' + logIndex.value)
    const data = await r.json()
    if (data.logs?.length) {
      logs.value.push(...data.logs)
      logIndex.value += data.logs.length
      await nextTick()
      if (logBoxEl.value) logBoxEl.value.scrollTop = logBoxEl.value.scrollHeight
    }
  } catch {}
}

function clearLogs() { logs.value = [] }

function startPolling() {
  if (pollTimer) return
  pollStatus(); pollLogs()
  pollTimer = setInterval(() => { pollStatus(); pollLogs() }, 3000)
}
function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null }

function buildConfigPayload() {
  return {
    sdHost: sdHost.value.trim(), ttsHost: ttsHost.value.trim(),
    voices: {
      nene: { refAudioPath: voiceNeneRef.value.trim(), promptText: voiceNenePrompt.value.trim(), promptLang:'ja', textLang:'ja', ...(lastStatus?.voices?.nene || {}) },
      natsume: { refAudioPath: voiceNatsumeRef.value.trim(), promptText: voiceNatsumePrompt.value.trim(), promptLang:'ja', textLang:'ja', ...(lastStatus?.voices?.natsume || {}) }
    }
  }
}

async function saveConfig() {
  feedbackText.value = '正在保存并重新检测…'; feedbackClass.value = 'config-feedback'
  try {
    const r = await fetch('/api/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(buildConfigPayload()) })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || '保存失败')
    showToast('生成服务配置已保存'); pollStatus()
  } catch (e: any) { showToast(e.message, true); pollStatus() }
}

async function saveAutoStartVoice() {
  try {
    await fetch('/api/preference', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ autoStartVoice: autoStartVoice.value }) })
    showToast(autoStartVoice.value ? '已开启：下次打开控制面板时自动启动语音' : '已关闭：语音服务改为按需启动')
  } catch { showToast('保存失败', true) }
}

async function doStart() {
  if (!lastStatus) { showToast('控制面板仍在读取配置，请稍候再试', true); pollStatus(); return }
  actionBusy.value = true; mainBtnLabel.value = '正在启动…'
  try {
    await saveConfig()
    const r = await fetch('/api/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ enableTunnel: tunnelEnabled.value }) })
    const data = await r.json()
    if (!data.ok) throw new Error(data.msg || '启动失败')
    showToast('本地网关已启动'); startPolling()
  } catch (e: any) { showToast('启动失败：' + e.message, true) }
  finally { actionBusy.value = false; pollStatus() }
}

async function doStop() {
  actionBusy.value = true; mainBtnLabel.value = '正在停止…'
  try {
    const r = await fetch('/api/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ stopManagedServices: false }) })
    const data = await r.json()
    if (!data.ok) throw new Error(data.msg || '停止失败')
    showToast('网站网关与分享已停止；绘图、语音和聊天服务保持当前状态')
    stopPolling(); running.value = false; shareLink.value = ''; uptime.value = ''
  } catch (e: any) { showToast('停止失败：' + e.message, true) }
  finally { actionBusy.value = false; pollStatus() }
}

async function exportDiag() {
  showToast('正在整理诊断包…')
  try {
    const r = await fetch('/api/diagnostics')
    const data = await r.json()
    if (!r.ok) throw new Error(data?.error || '诊断包导出失败')
    const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,16)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], { type:'application/json;charset=utf-8' }))
    a.download = 'lingji-diagnostics-' + stamp + '.json'
    a.click(); URL.revokeObjectURL(a.href)
    showToast('诊断包已导出')
  } catch (e: any) { showToast(e.message || '诊断包导出失败', true) }
}

onMounted(() => { startPolling() })
onUnmounted(() => { stopPolling() })
</script>

<style scoped>
.control-page { min-height:100vh; }
.nav-local { display:flex; align-items:center; justify-content:space-between; width:min(860px,100%); margin:0 auto; padding:0 var(--s-4); }
.nav-local-brand { display:flex; align-items:center; gap:var(--s-3); color:var(--text-primary); text-decoration:none; }
.nav-local-brand strong { display:block; font:700 var(--fs-body-sm) var(--font-sans); letter-spacing:.02em; }
.nav-local-brand small { display:block; margin-top:1px; color:var(--text-muted); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.1em; text-transform:uppercase; }
.nav-local-actions { display:flex; align-items:center; gap:var(--s-2); }

.status-hero { margin-bottom:var(--s-4); }
.badge-row { display:flex; gap:var(--s-2); flex-wrap:wrap; margin-bottom:var(--s-3); }
.status-badge { display:inline-flex; align-items:center; gap:var(--s-1); padding:4px var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-pill); font:600 var(--fs-label-sm) var(--font-sans); }
.status-badge .dot { width:8px; height:8px; border-radius:50%; background:var(--text-muted); }
.status-badge.running .dot { background:var(--success); box-shadow:0 0 6px var(--success); }
.status-badge.online .dot { background:var(--success); }
.status-badge.offline .dot { background:var(--danger); }
.status-badge.stopped .dot { background:var(--text-muted); }
.config-feedback { padding:var(--s-2) var(--s-3); border-radius:var(--r-md); font-size:var(--fs-body-sm); margin-bottom:var(--s-2); }
.config-feedback.ok { background:color-mix(in srgb,var(--success) 10%,transparent); color:var(--success-text); }
.config-feedback.warn { background:color-mix(in srgb,var(--warning) 10%,transparent); color:var(--warning-text); }
.action-note { color:var(--text-muted); font-size:var(--fs-label-sm); margin:0 0 var(--s-4); }

.tunnel-row { display:flex; align-items:center; gap:var(--s-3); margin:var(--s-3) 0; }
.tunnel-hint { color:var(--text-muted); font-size:var(--fs-label-sm); }
.switch-label { display:flex; align-items:center; gap:var(--s-2); cursor:pointer; font-size:var(--fs-body-sm); }
.switch-toggle { width:40px; height:22px; border-radius:var(--r-pill); background:var(--bg-elevated); border:1px solid var(--border-soft); cursor:pointer; position:relative; transition:background var(--t-fast); }
.switch-toggle[aria-checked="true"] { background:var(--accent); border-color:var(--accent); }
.switch-thumb { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:transform var(--t-fast); }
.switch-toggle[aria-checked="true"] .switch-thumb { transform:translateX(18px); }

.running-panel { padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-surface); margin:var(--s-3) 0; }
.link-row { display:flex; align-items:center; gap:var(--s-2); flex-wrap:wrap; margin-bottom:var(--s-2); }
.link-label { color:var(--text-muted); font-size:var(--fs-label-sm); font-weight:700; min-width:80px; }
.link-value { font:400 var(--fs-mono-sm) var(--font-mono); color:var(--accent); }
.link-value.waiting { color:var(--text-muted); }
.uptime-row { color:var(--text-muted); font-size:var(--fs-label-xs); margin-top:var(--s-2); }

.config-section { margin-top:var(--s-5); }
.section-title { font-size:var(--fs-title-xs); font-weight:700; padding:var(--s-3) 0; cursor:pointer; display:flex; align-items:center; gap:var(--s-2); }
.config-grid { display:grid; grid-template-columns:1fr 1fr; gap:var(--s-3); margin-top:var(--s-3); }
.config-field { display:grid; gap:var(--s-1); font-size:var(--fs-label-sm); color:var(--text-muted); font-weight:600; }
.voice-section { margin-top:var(--s-3); }
.voice-section summary { font-size:var(--fs-label); color:var(--text-secondary); cursor:pointer; padding:var(--s-2) 0; }
.voice-grid { display:grid; grid-template-columns:1fr 1fr; gap:var(--s-3); margin-top:var(--s-2); }
.config-actions { display:flex; align-items:center; gap:var(--s-3); margin-top:var(--s-4); flex-wrap:wrap; }
.input { padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font:var(--fs-body)/1.5 var(--font-mono); outline:none; width:100%; }
.input:focus { border-color:var(--accent); }
.input:disabled { opacity:.5; cursor:not-allowed; }

.log-section { margin-top:var(--s-5); }
.log-box { max-height:320px; overflow-y:auto; padding:var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); font:400 var(--fs-mono-xs)/1.7 var(--font-mono); color:var(--text-muted); }
.log-box .time { color:var(--border-strong); }
.log-box .err { color:var(--danger-text); }
.log-box .info { color:var(--success-text); }
.log-empty { color:var(--text-muted); text-align:center; padding:var(--s-4); }

.diag-row { display:flex; gap:var(--s-2); margin-top:var(--s-4); }
.toast { position:fixed; left:50%; bottom:32px; transform:translateX(-50%); z-index:9999; padding:10px 20px; background:var(--bg-surface); border:1px solid var(--accent); color:var(--text-primary); border-radius:var(--r-lg); font-size:var(--fs-label); box-shadow:var(--shadow-md); opacity:0; pointer-events:none; transition:opacity .2s; white-space:nowrap; }
.toast.show { opacity:1; }
.toast.error { border-color:var(--danger); color:var(--danger-text); }

@media(max-width:640px) { .config-grid,.voice-grid { grid-template-columns:1fr; } }
</style>
