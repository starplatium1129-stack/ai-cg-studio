<template>
  <div class="control-page">
    <RouteAtmosphere />
    <!-- /control 挂在 AppLayout 之外，所以跳转链接与 main 地标要在这里自备 -->
    <a class="skip-link" href="#control-main">跳到主要内容</a>
    <nav class="nav control-mobile-nav">
      <div class="nav-inner nav-local">
        <RouterLink to="/" class="nav-local-brand">
          <img class="nav-logo" src="/assets/logo.svg" alt="" aria-hidden="true" />
          <span><strong>本机控制室</strong><small>Local control room</small></span>
        </RouterLink>
        <div class="nav-local-actions">
          <RouterLink class="nav-local-home" to="/">← 回绘境</RouterLink>
          <AppSoundToggle />
          <AppThemeToggle />
        </div>
      </div>
    </nav>

    <div class="control-layout">
      <aside class="control-rail" aria-label="控制室导航">
        <RouterLink to="/" class="control-rail-brand">
          <img class="nav-logo" src="/assets/logo.svg" alt="" aria-hidden="true" />
          <span><strong>本机控制室</strong><small>Local control room</small></span>
        </RouterLink>
        <nav class="control-rail-nav" aria-label="控制区">
          <a class="control-rail-link" href="#control-overview"><span aria-hidden="true">◌</span>概览状态</a>
          <a class="control-rail-link" href="#control-resources"><span aria-hidden="true">◒</span>显存调度</a>
          <a class="control-rail-link" href="#control-services"><span aria-hidden="true">◫</span>本机服务</a>
          <a class="control-rail-link" href="#control-share"><span aria-hidden="true">↗</span>公网分享</a>
          <a class="control-rail-link" href="#control-logs"><span aria-hidden="true">≡</span>运行日志</a>
        </nav>
        <div class="control-rail-foot">
          <RouterLink class="nav-local-home" to="/">← 回绘境</RouterLink>
          <AppSoundToggle />
          <AppThemeToggle />
        </div>
      </aside>

      <div class="control-content">
    <main id="control-main" class="control-shell" tabindex="-1">
      <WorkspaceArchiveBar
        chapter="13"
        title="LOCAL CONTROL"
        subtitle="GATEWAY · SD · VOICE · CHAT"
        :status="serviceChecking || opBusy ? 'CHECKING SERVICES' : feedbackText.toUpperCase()"
        :state="serviceChecking || opBusy ? 'active' : (readyState === 'on' ? 'success' : 'warning')"
        shape="spark"
      />
      <header class="control-intro">
        <div>
          <div class="gallery-kicker">Local control room</div>
          <h1 class="control-title">把本机服务接上</h1>
          <p class="control-subtitle">绘图、语音与聊天都在这台电脑里。先看状态，再决定启动哪一项。</p>
        </div>
        <div class="control-count">{{ readyLabel }}</div>
      </header>

      <!-- 状态墙：像作品册的安静卡片，而不是一排噪声徽章 -->
      <section id="control-overview" class="status-wall" aria-label="连接状态">
        <article class="status-tile" :data-state="gatewayState">
          <small>本地网关</small>
          <strong>{{ gatewayLabel }}</strong>
        </article>
        <article class="status-tile" :data-state="sdOnline ? 'on' : 'off'">
          <small>SD WebUI</small>
          <strong>{{ sdOnline ? (webuiManaged ? '已连接 · 受控' : '已连接 · 手动') : '未连接' }}</strong>
        </article>
        <article class="status-tile" :data-state="ttsOnline ? 'on' : 'off'">
          <small>GPT-SoVITS</small>
          <strong>{{ ttsOnline ? '已连接' : '未连接' }}</strong>
        </article>
        <article class="status-tile" :data-state="ollamaOnline ? 'on' : 'off'">
          <small>Ollama 聊天</small>
          <strong>{{ ollamaBadgeText }}</strong>
        </article>
        <article class="status-tile" :data-state="voiceConfiguredCount === 2 ? 'on' : (voiceConfiguredCount ? 'warn' : 'off')">
          <small>角色声线</small>
          <strong>{{ voiceConfiguredCount === 2 ? '宁宁与夏目已配置' : (voiceConfiguredCount ? voiceConfiguredCount + ' / 2 已配置' : '尚未配置') }}</strong>
        </article>
        <article class="status-tile" :data-state="shareState">
          <small>公网分享</small>
          <strong>{{ shareLabel }}</strong>
        </article>
        <article class="status-tile primary" :data-state="readyState">
          <small>创作状态</small>
          <strong>{{ feedbackText }}</strong>
          <p class="status-note">{{ actionNote }}</p>
        </article>
      </section>

      <div class="control-toolbar sticky-toolbar">
        <button class="gallery-filter" type="button" :disabled="serviceChecking || opBusy" @click="pollStatus(true)">
          <span :class="{ spin: serviceChecking }">⟳</span> 检测所有服务
        </button>
        <span class="toolbar-note">操作只影响本机进程；网站网关始终在运行</span>
      </div>

      <!-- 操作进度 -->
      <div v-if="operation" class="panel-card operation-panel" :class="operation.status">
        <div class="operation-head">
          <div>
            <div class="panel-kicker">In progress</div>
            <strong class="panel-heading">{{ operation.label }}</strong>
          </div>
          <span class="op-state">{{ opStatusLabel }}</span>
        </div>
        <div class="meter"><span class="meter-fill" :style="{ '--fill': opProgress + '%' }"></span></div>
        <p class="operation-msg">{{ operation.message }}</p>
        <div v-if="operation.stages?.length" class="operation-stages">
          <span
            v-for="(stage, i) in operation.stages" :key="stage"
            class="op-stage"
            :class="{ done: i < operation.stageIndex, current: i === operation.stageIndex && operation.status === 'running' }"
          >{{ stage }}</span>
        </div>
      </div>

      <div class="control-work-grid">
      <!-- 显存调度 -->
      <section id="control-resources" class="panel-card resource-panel">
        <div class="panel-kicker">Resource</div>
        <h2 class="panel-heading">显存资源调度</h2>
        <p class="panel-desc">绘图、语音、聊天同时加载容易占满显存。按需切换：先释放，再加载。</p>
        <div class="mode-grid">
          <button class="mode-card" type="button" :disabled="opBusy || modeBusy" @click="switchMode('draw')">
            <span class="mode-title">◉ 绘图优先</span>
            <span class="mode-desc">停止语音、卸载 Ollama，把显存让给 WebUI 出图。</span>
          </button>
          <button class="mode-card" type="button" :disabled="opBusy || modeBusy" @click="switchMode('chat')">
            <span class="mode-title">☕ 聊天优先</span>            <span class="mode-desc">停止受管 WebUI，启动语音，专注角色房间。</span>
          </button>
        </div>

        <div class="service-rows">
          <div class="service-row">
            <span class="service-row-name">
              <span class="dot" :class="{ on: sdOnline }"></span>
              SD WebUI 绘图
              <span class="service-row-meta">{{ sdOnline ? (webuiManaged ? '受控' : '手动') : '未运行' }}</span>
            </span>
            <span class="service-row-actions">
              <button class="btn btn-ghost btn-sm" type="button" :disabled="opBusy" @click="serviceAction('webui','start')">启动</button>
              <button class="btn btn-danger btn-sm" type="button" :disabled="opBusy" @click="serviceAction('webui','stop')">停止</button>
            </span>
          </div>
          <div class="service-row">
            <span class="service-row-name">
              <span class="dot" :class="{ on: ttsOnline }"></span>
              GPT-SoVITS 语音
              <span class="service-row-meta">{{ ttsOnline ? '在线' : '未运行' }}</span>
            </span>
            <span class="service-row-actions">
              <button class="btn btn-ghost btn-sm" type="button" :disabled="opBusy" @click="serviceAction('voice','start')">启动</button>
              <button class="btn btn-danger btn-sm" type="button" :disabled="opBusy" @click="serviceAction('voice','stop')">停止</button>
            </span>
          </div>
          <div class="service-row">
            <span class="service-row-name">
              <span class="dot" :class="{ on: ollamaOnline }"></span>
              Ollama 聊天模型
              <span class="service-row-meta">{{ ollamaMeta }}</span>
            </span>
            <span class="service-row-actions">
              <button class="btn btn-danger btn-sm" type="button" :disabled="opBusy || !ollamaModels.length" @click="serviceAction('ollama','unload')">卸载模型释放显存</button>
            </span>
          </div>
        </div>

        <label class="autostart-row">
          <input type="checkbox" v-model="autoStartVoice" @change="saveAutoStartVoice" />
          打开控制面板时自动启动语音（显存紧张时不建议开启）
        </label>
        <p class="panel-foot">Ollama 闲置约 10 分钟会自动卸载；系统声音试听不依赖 GPT-SoVITS。</p>
        <p v-if="!scripts.webui || !scripts.voiceStart" class="script-hint">
          部分脚本未找到：
          <span v-if="!scripts.webui">managed-webui.ps1 </span>
          <span v-if="!scripts.voiceStart">Start-Voice.ps1 </span>
          <span v-if="!scripts.voiceStop">Stop-Voice.ps1 </span>
        </p>
      </section>

      <!-- 本机生成服务配置 -->
      <section id="control-services" class="panel-card service-config-panel">
        <div class="panel-kicker">01 · Services</div>
        <h2 class="panel-heading">确认本机生成服务</h2>
        <p class="panel-desc">SD WebUI 负责画面，GPT-SoVITS 负责角色语音。未装语音时，网站仍可用系统声音试听。</p>

        <label class="field-label" for="sd-host">Stability Matrix / SD WebUI 地址</label>
        <input id="sd-host" v-model="sdHost" class="input input-mono" type="text" placeholder="http://127.0.0.1:7860" spellcheck="false" />
        <p class="field-help">端口以启动日志为准；推荐参数：<code>--api --port 7860</code></p>

        <label class="field-label" for="tts-host">GPT-SoVITS API 地址</label>
        <div class="field-row">
          <input id="tts-host" v-model="ttsHost" class="input input-mono" type="text" placeholder="http://127.0.0.1:9880" spellcheck="false" />
          <button class="btn btn-ghost" type="button" @click="saveConfig">保存全部并检测</button>
        </div>
        <p class="field-help">默认按需启动；默认端口为 <code>9880</code>。</p>

        <details class="voice-config">
          <summary>◈ 角色声线配置 · 参考音频必须是 GPT-SoVITS 能读取的本机路径</summary>
          <div class="voice-grid">
            <div class="voice-card">
              <div class="voice-card-title">宁宁</div>
              <label class="sr-only" for="v-nene-ref">宁宁参考音频路径</label>
            <input id="v-nene-ref" v-model="voiceNeneRef" class="input" placeholder="参考音频路径" />
              <label class="sr-only" for="v-nene-prompt">宁宁提示文本（日文）</label>
            <input id="v-nene-prompt" v-model="voiceNenePrompt" class="input" placeholder="提示文本（日文）" />
            </div>
            <div class="voice-card">
              <div class="voice-card-title">夏目</div>
              <label class="sr-only" for="v-nat-ref">夏目参考音频路径</label>
            <input id="v-nat-ref" v-model="voiceNatsumeRef" class="input" placeholder="参考音频路径" />
              <label class="sr-only" for="v-nat-prompt">夏目提示文本（日文）</label>
            <input id="v-nat-prompt" v-model="voiceNatsumePrompt" class="input" placeholder="提示文本（日文）" />
            </div>
          </div>
        </details>
      </section>

      </div>

      <!-- 公网分享 -->
      <section id="control-share" class="panel-card share-panel">
        <div class="panel-kicker">02 · Share</div>
        <h2 class="panel-heading">公网分享通道</h2>
        <p class="panel-desc">本机访问不需要 Token；公网分享会使用临时 Token。</p>

        <div class="tunnel-toggle-row">
          <div class="tunnel-toggle-label">
            <span id="tunnel-switch-label" class="tunnel-toggle-text">开启公网分享通道</span>
            <span class="tunnel-toggle-hint">{{ tunnelEnabled ? '朋友可通过临时链接访问' : '关闭后仅本机可访问' }}</span>
          </div>
          <button
            class="tunnel-switch" type="button" role="switch"
            :aria-checked="tunnelEnabled ? 'true' : 'false'"
        aria-labelledby="tunnel-switch-label"
            @click="toggleTunnel"
          ><span class="tunnel-switch-knob"></span></button>
        </div>

        <button
          class="btn btn-lg btn-primary btn-block"
          type="button"
          :disabled="actionBusy || opBusy"
          @click="tunnelActive ? doStop() : doStart()"
        >{{ mainBtnLabel }}</button>
        <p class="action-note">{{ tunnelActive ? '分享通道运行中；停止只关公网，不影响本机绘图与聊天。' : '启动后生成本地与分享入口。' }}</p>

        <div class="access-grid">
          <div class="access-card">
            <div class="access-kicker">Local</div>
            <div class="access-title">本机地址</div>
            <div class="link-value">{{ localLink }}</div>
            <div class="inline-actions">
              <button class="btn btn-ghost btn-sm" type="button" @click="copy(localLink)">复制</button>
              <a class="btn btn-ghost btn-sm" :href="localLink" target="_blank" rel="noreferrer">打开</a>
            </div>
          </div>
          <div class="access-card">
            <div class="access-kicker">Share</div>
            <div class="access-title">分享链接</div>
            <div class="link-value" :class="{ waiting: !shareLink }">{{ shareLink || (tunnelStatus === 'disabled' ? '未生成公网链接' : '等待分享链接…') }}</div>
            <div class="inline-actions">
              <button class="btn btn-ghost btn-sm" type="button" :disabled="!shareLink" @click="copy(shareLink)">复制</button>
            </div>
          </div>
        </div>
        <div class="uptime">{{ uptime }}</div>
        <p class="security-note">分享链接可以调用你电脑上的 SD WebUI，请只发给信任的人。</p>
      </section>

      <!-- 日志 -->
      <details id="control-logs" class="log-panel">
        <summary>
          <span>▤ 运行日志</span>
          <span class="summary-side">
            <button class="btn btn-ghost btn-sm" type="button" @click.stop="exportDiag">导出诊断包</button>
            <button class="btn btn-ghost btn-sm" type="button" @click.stop="clearLogs">清空显示</button>
            <span class="chevron">›</span>
          </span>
        </summary>
        <div class="log-wrap">
          <div class="log-box" ref="logBoxEl">
            <div v-if="!logs.length" class="log-empty">暂无日志。</div>
            <div v-for="(line, i) in logs" :key="i" :class="lineClass(line)">
              <span class="time">{{ line.slice(0, 10) }}</span> {{ line.slice(11) }}
            </div>
          </div>
        </div>
      </details>
    </main>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppSoundToggle from '@/components/AppSoundToggle.vue'
import AppThemeToggle from '@/components/AppThemeToggle.vue'
import RouteAtmosphere from '@/components/visual/RouteAtmosphere.vue'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import { useToast } from '@/composables/useToast'
// /api/status 与 /api/logs 的契约类型。原先整体当 any —— 字段拼错、后端改名
// 都要等运行时才炸，而这个视图正好在破坏性路径上（改上游 host、启停服务、
// 开关公网隧道）。
import { useControlStatus } from '@/composables/useControlStatus'
import { useControlActions } from '@/composables/useControlActions'

/**
 * 全站唯一那套 toast（App.vue 里的 AppToast + useToast）。
 * 这里原先自建了第四套：一个 .toast div + 自管计时器，
 * 既没有 live region 也没有可聚焦的关闭动作。
 */
const toastApi = useToast()
function showToast(msg: string, isError = false) {
  if (isError) toastApi.error(msg)
  else toastApi.info(msg)
}

const status = useControlStatus({ showToast })
const actions = useControlActions(status, { showToast })

// 模板引用解构：状态域
const {
  tunnelActive, sdOnline, ttsOnline, ollamaOnline, webuiManaged, ollamaModels, ollamaVram,
  modeBusy, operation, serviceChecking, scripts,
  sdHost, ttsHost, voiceNeneRef, voiceNenePrompt, voiceNatsumeRef, voiceNatsumePrompt, autoStartVoice,
  tunnelStatus, shareLink, localLink, uptime, actionBusy, mainBtnLabel,
  feedbackClass, feedbackText, actionNote, logs, logBoxEl,
  opBusy, opStatusLabel, opProgress, ollamaBadgeText, ollamaMeta, voiceConfiguredCount,
  shareState, shareLabel, readyState, readyLabel,
  pollStatus, clearLogs,
} = status

// 模板引用解构：操作域
const {
  tunnelEnabled, copy, toggleTunnel, saveConfig, saveAutoStartVoice,
  serviceAction, switchMode, doStart, doStop, exportDiag,
} = actions

function lineClass(line: string) { return status.lineClass(line) }

// 网关是恒在线的（本页就是网关自身），保持模板可读的稳定标签
const gatewayState = 'on'
const gatewayLabel = '运行中'

onMounted(() => { status.startPolling() })
onUnmounted(() => { status.stopPolling() })
</script>

<style scoped>
/* 常驻控制轨道 + 克制的玻璃分层；移动端回退为熟悉的顶部导航。 */
.control-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 88% 4%, color-mix(in srgb, var(--accent-soft) 62%, transparent), transparent 30rem),
    var(--bg-base);
}
.control-mobile-nav { display: none; }
.control-layout {
  display: grid; grid-template-columns: minmax(208px, 244px) minmax(0, 1fr);
  width: min(1560px, 100%); min-height: 100vh; margin: 0 auto;
  padding: 0 clamp(12px, 2vw, 28px);
}
.control-rail {
  position: sticky; top: 0; display: flex; flex-direction: column; align-self: start;
  height: 100vh; padding: clamp(20px, 3vw, 34px) 14px 18px;
  border-right: 1px solid color-mix(in srgb, var(--border-soft) 80%, transparent);
  background: color-mix(in srgb, var(--bg-surface) 68%, transparent);
  box-shadow: inset -1px 0 color-mix(in srgb, var(--on-art-primary) 7%, transparent);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
}
.control-rail-brand {
  display: flex; align-items: center; gap: var(--s-3); padding: 0 var(--s-3) var(--s-5);
  color: var(--text-primary); text-decoration: none;
}
.control-rail-brand strong { display: block; font: 750 var(--fs-body-sm) var(--font-sans); letter-spacing: .02em; }
.control-rail-brand small {
  display: block; margin-top: 2px; color: var(--text-muted);
  font: 650 var(--fs-mono-xs) var(--font-mono); letter-spacing: .1em; text-transform: uppercase;
}
.control-rail-nav { display: grid; gap: 5px; }
.control-rail-link {
  display: flex; align-items: center; gap: 11px; min-height: 42px; padding: 0 13px;
  border: 1px solid transparent; border-radius: var(--r-lg); color: var(--text-secondary);
  font: 650 var(--fs-label-sm) var(--font-sans); text-decoration: none;
  transition: color var(--t-fast), background var(--t-fast), border-color var(--t-fast), transform var(--t-fast);
}
.control-rail-link span { width: 13px; color: var(--accent); font: 700 var(--fs-body-sm) var(--font-mono); }
.control-rail-link:hover, .control-rail-link:focus-visible {
  color: var(--text-primary); border-color: color-mix(in srgb, var(--accent) 22%, var(--border-soft));
  background: color-mix(in srgb, var(--accent-soft) 54%, transparent); transform: translateX(2px);
}
.control-rail-foot {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-2);
  margin-top: auto; padding: var(--s-3) 2px 0; border-top: 1px solid var(--border-soft);
}
.control-content { min-width: 0; }
.nav-local {
  display: flex; align-items: center; justify-content: space-between;
  width: min(1100px, 100%); margin: 0 auto; padding: 0 var(--s-5);
}
.nav-local-brand {
  display: flex; align-items: center; gap: var(--s-3);
  color: var(--text-primary); text-decoration: none;
}
.nav-local-brand strong { display: block; font: 700 var(--fs-body-sm) var(--font-sans); letter-spacing: .02em; }
.nav-local-brand small {
  display: block; margin-top: 1px; color: var(--text-muted);
  font: 650 var(--fs-mono-xs) var(--font-mono); letter-spacing: .1em; text-transform: uppercase;
}
/* 字标只能按高度缩放，不能裁成方块 */
.nav-logo { height: 30px; width: auto; max-width: 180px; display: block; }
.nav-local-actions { display: flex; align-items: center; gap: var(--s-3); }
.nav-local-home {
  color: var(--text-secondary); font: 650 var(--fs-label-sm) var(--font-sans);
  text-decoration: none; padding: 6px 10px; border-radius: var(--r-pill);
}
.nav-local-home:hover { color: var(--accent); background: var(--accent-soft); }

.control-shell {
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: clamp(28px, 4vw, 58px) clamp(20px, 4vw, 58px) var(--s-8);
}
.control-intro {
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end;
  gap: var(--s-5); margin-bottom: clamp(22px, 3vw, 32px); padding: clamp(20px, 3vw, 30px);
  border: 1px solid color-mix(in srgb, var(--archive-cyan) 18%, var(--border-soft)); border-radius: var(--r-dossier);
  background: color-mix(in srgb, var(--bg-surface) 76%, transparent); box-shadow: var(--shadow-sm);
}
.control-intro::before { content: ''; position: absolute; top: -1px; left: var(--s-4); width: 42px; height: var(--line-hairline); background: var(--archive-cyan); }
.control-title {
  margin: 0; color: var(--text-primary); font-family: var(--font-display);
  font-size: clamp(1.85rem, 3.2vw, 3rem); font-weight: 760; letter-spacing: -.03em; line-height: 1.1;
}
.control-subtitle {
  max-width: 640px; margin: var(--s-3) 0 0; color: var(--text-secondary);
  font-size: var(--fs-body); line-height: 1.75;
}
.control-count {
  padding: 9px 12px; border: 1px solid var(--border-soft); border-radius: var(--r-terminal);
  color: var(--text-muted); background: var(--bg-deep); font: 650 var(--fs-label-xs) var(--font-mono);
  letter-spacing: .08em; white-space: nowrap;
}

.status-wall {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s-3);
  margin-bottom: var(--s-4);
}
.status-tile {
  position: relative; min-width: 0; padding: var(--s-4);
  border: 1px solid color-mix(in srgb, var(--border-soft) 88%, transparent);
  border-radius: var(--r-dossier);
  background: color-mix(in srgb, var(--bg-surface) 78%, transparent);
  box-shadow: var(--shadow-sm); backdrop-filter: blur(12px);
}
.status-tile::before { content: ''; position: absolute; top: -1px; left: var(--s-3); width: 24px; height: var(--line-hairline); background: var(--archive-cyan); opacity: .8; }
.status-tile.primary { grid-column: 1 / -1; }
.status-tile small {
  display: block; color: var(--text-muted);
  font: 650 var(--fs-mono-xs) var(--font-mono); letter-spacing: .1em; text-transform: uppercase;
}
.status-tile strong {
  display: block; margin-top: 8px; color: var(--text-primary);
  font-size: var(--fs-body-sm); font-weight: 700; line-height: 1.45;
}
.status-tile[data-state="on"] strong { color: var(--success-text); }
.status-tile[data-state="warn"] strong { color: var(--warning-text); }
.status-tile[data-state="off"] strong { color: var(--text-muted); }
.status-note {
  margin: 8px 0 0; color: var(--text-secondary);
  font-size: var(--fs-label-sm); line-height: 1.65; font-weight: 400;
}

.control-toolbar {
  position: sticky; top: 12px; z-index: var(--z-raised); display: flex; align-items: center; gap: var(--s-3);
  margin-bottom: var(--s-5); padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--border-soft) 82%, transparent);
  border-radius: var(--r-dossier); background: color-mix(in srgb, var(--bg-surface) 78%, transparent);
  box-shadow: var(--shadow-sm); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
}
.gallery-filter {
  min-height: 36px; padding: 0 15px; border: 1px solid transparent; border-radius: var(--r-terminal);
  background: transparent; color: var(--text-secondary);
  font: 650 var(--fs-label-sm) var(--font-sans); cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px;
  transition: border-color var(--t-fast), background var(--t-fast), color var(--t-fast);
}
.gallery-filter:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border-soft));
  background: var(--accent-soft); color: var(--accent);
}
.gallery-filter:disabled { opacity: .5; cursor: not-allowed; }
.toolbar-note { margin-left: auto; color: var(--text-muted); font-size: var(--fs-mono-sm); white-space: nowrap; }
.spin { display: inline-block; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.panel-card {
  position: relative; margin-bottom: var(--s-4); padding: clamp(18px, 2.5vw, 28px);
  border: 1px solid color-mix(in srgb, var(--border-soft) 86%, transparent);
  border-radius: var(--r-dossier);
  background: color-mix(in srgb, var(--bg-surface) 84%, transparent);
  box-shadow: var(--shadow-sm); backdrop-filter: blur(12px);
}
.panel-card::before { content: ''; position: absolute; top: -1px; left: var(--s-4); width: 34px; height: var(--line-hairline); background: var(--archive-cyan); opacity: .76; }
.control-work-grid {
  display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(340px, .88fr);
  align-items: start; gap: var(--s-4); margin-bottom: var(--s-4);
}
.control-work-grid .panel-card { margin-bottom: 0; }
.resource-panel .mode-grid { grid-template-columns: 1fr; }
.service-config-panel .voice-grid { grid-template-columns: 1fr; }
.share-panel { position: relative; overflow: hidden; }
.share-panel::before {
  content: ''; position: absolute; inset: 0 auto 0 0; width: 3px;
  background: linear-gradient(var(--accent), color-mix(in srgb, var(--accent) 10%, transparent));
}
.panel-kicker {
  margin-bottom: 6px; color: var(--text-muted);
  font: 650 var(--fs-mono-xs) var(--font-mono); letter-spacing: .12em; text-transform: uppercase;
}
.panel-heading {
  margin: 0 0 8px; color: var(--text-primary);
  font-size: var(--fs-title-xs); font-weight: 750; letter-spacing: -.01em;
}
.panel-desc, .panel-foot {
  margin: 0 0 var(--s-4); color: var(--text-secondary);
  font-size: var(--fs-label-sm); line-height: 1.7;
}
.panel-foot { margin: var(--s-3) 0 0; color: var(--text-muted); font-size: var(--fs-mono-sm); }

.mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); margin-bottom: var(--s-4); }
.mode-card {
  display: grid; gap: 8px; text-align: left; padding: var(--s-4);
  border: 1px solid var(--border-soft); border-radius: var(--r-terminal);
  background: var(--bg-deep); color: var(--text-primary); cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast), transform var(--t-fast);
}
.mode-card:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-soft));
  background: color-mix(in srgb, var(--accent-soft) 55%, var(--bg-deep));
  transform: translateY(-2px);
}
.mode-card:disabled { opacity: .45; cursor: not-allowed; transform: none; }
.mode-title { font-size: var(--fs-body-sm); font-weight: 750; }
.mode-desc { color: var(--text-muted); font-size: var(--fs-label-xs); line-height: 1.6; }

.service-rows { display: grid; gap: var(--s-2); }
.service-row {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
  padding: 12px 14px; border: 1px solid var(--border-soft); border-radius: var(--r-terminal);
  background: var(--bg-deep); flex-wrap: wrap;
}
.service-row-name {
  display: inline-flex; align-items: center; gap: 8px;
  font: 650 var(--fs-label-sm) var(--font-sans); color: var(--text-primary);
}
.service-row-name .dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0;
}
.service-row-name .dot.on {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 14%, transparent);
}
.service-row-meta { color: var(--text-muted); font: 500 var(--fs-mono-xs) var(--font-mono); }
.service-row-actions { display: flex; gap: var(--s-2); flex-wrap: wrap; }

.autostart-row {
  display: flex; align-items: flex-start; gap: var(--s-2);
  margin-top: var(--s-3); padding: var(--s-3);
  border: 1px dashed var(--border-soft); border-radius: var(--r-lg);
  color: var(--text-muted); font-size: var(--fs-label-xs); line-height: 1.55; cursor: pointer;
}
.autostart-row input { accent-color: var(--accent); margin-top: 2px; }
.script-hint { margin-top: var(--s-2); color: var(--warning-text); font-size: var(--fs-label-xs); line-height: 1.5; }

.field-label {
  display: block; margin: var(--s-4) 0 var(--s-1);
  color: var(--text-secondary); font: 650 var(--fs-label-sm) var(--font-sans);
}
.field-label:first-of-type { margin-top: 0; }
.field-help {
  margin: 6px 0 0; color: var(--text-muted);
  font-size: var(--fs-label-xs); line-height: 1.55;
}
.field-help code { color: var(--accent); font-family: var(--font-mono); }
.field-row { display: flex; gap: var(--s-2); flex-wrap: wrap; }
.field-row .input { flex: 1; min-width: 180px; }
.input {
  width: 100%; min-height: 42px; padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-soft); border-radius: var(--r-terminal);
  background: var(--bg-deep); color: var(--text-primary);
  font: 400 var(--fs-body) / 1.5 var(--font-sans); outline: none;
}
.input-mono { font-family: var(--font-mono); font-size: var(--fs-label); }
.input:focus { border-color: var(--accent); box-shadow: var(--ring); }

.voice-config {
  margin-top: var(--s-4); border: 1px solid var(--border-soft);
  border-radius: var(--r-lg); background: var(--bg-deep); overflow: hidden;
}
.voice-config summary {
  cursor: pointer; list-style: none; padding: var(--s-3) var(--s-4);
  color: var(--text-secondary); font: 650 var(--fs-label-sm) var(--font-sans);
}
.voice-config summary::-webkit-details-marker { display: none; }
.voice-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3);
  padding: 0 var(--s-4) var(--s-4);
}
.voice-card {
  padding: var(--s-3); border: 1px solid var(--border-soft);
  border-radius: var(--r-md); background: var(--bg-surface);
  display: grid; gap: var(--s-2);
}
.voice-card-title { color: var(--accent); font: 700 var(--fs-label-sm) var(--font-sans); }
.voice-card .input { min-height: 36px; font-size: var(--fs-label-xs); }

.tunnel-toggle-row {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
  margin-bottom: var(--s-4); padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border-soft); border-radius: var(--r-lg); background: var(--bg-deep);
}
.tunnel-toggle-text { display: block; font: 650 var(--fs-label) var(--font-sans); color: var(--text-primary); }
.tunnel-toggle-hint { display: block; margin-top: 3px; color: var(--text-muted); font-size: var(--fs-mono-sm); }
.tunnel-switch {
  position: relative; width: 44px; height: 24px; flex-shrink: 0;
  border: 1px solid var(--border-strong); border-radius: var(--r-pill);
  background: var(--border-strong); cursor: pointer; padding: 0;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.tunnel-switch[aria-checked="true"] { background: var(--success); border-color: var(--success-text); }
.tunnel-switch-knob {
  position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--on-art-primary); box-shadow: 0 1px 3px var(--art-scrim-soft);
  transition: left var(--t-fast);
}
.tunnel-switch[aria-checked="true"] .tunnel-switch-knob { left: 22px; }
.btn-block { width: 100%; justify-content: center; }
.action-note {
  margin: var(--s-2) 0 var(--s-4); color: var(--text-muted);
  font-size: var(--fs-label-xs); line-height: 1.55; text-align: center;
}

.access-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); }
.access-card {
  padding: var(--s-4); border: 1px solid var(--border-soft);
  border-radius: var(--r-lg); background: var(--bg-deep);
}
.access-kicker {
  color: var(--text-muted); font: 650 var(--fs-mono-xs) var(--font-mono);
  letter-spacing: .1em; text-transform: uppercase;
}
.access-title { margin-top: 4px; font: 700 var(--fs-body-sm) var(--font-sans); color: var(--text-primary); }
.link-value {
  margin: var(--s-3) 0 var(--s-2); min-height: 42px; padding: var(--s-2) var(--s-3);
  display: flex; align-items: center;
  color: var(--info-text); background: var(--bg-surface);
  border: 1px solid var(--border-soft); border-radius: var(--r-sm);
  font: var(--fs-mono-sm) var(--font-mono); word-break: break-all;
}
.link-value.waiting { color: var(--text-muted); font-family: var(--font-sans); }
.inline-actions { display: flex; gap: var(--s-2); flex-wrap: wrap; }
.uptime { margin-top: var(--s-3); color: var(--text-muted); font-size: var(--fs-mono-sm); text-align: right; }
.security-note {
  margin-top: var(--s-3); padding: var(--s-3);
  border-radius: var(--r-md); color: var(--text-secondary);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 16%, transparent);
  font-size: var(--fs-label-xs); line-height: 1.55;
}

.operation-panel.running { border-color: color-mix(in srgb, var(--warning) 42%, var(--border-soft)); }
.operation-panel.completed { border-color: color-mix(in srgb, var(--success) 42%, var(--border-soft)); }
.operation-panel.failed { border-color: color-mix(in srgb, var(--danger) 42%, var(--border-soft)); }
.operation-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-3); margin-bottom: var(--s-3); }
.op-state {
  color: var(--text-muted); font: 650 var(--fs-mono-xs) var(--font-mono);
  letter-spacing: .08em; text-transform: uppercase; white-space: nowrap;
}
.operation-msg { margin: var(--s-2) 0 0; color: var(--text-secondary); font-size: var(--fs-label-sm); line-height: 1.55; }
.operation-stages { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--s-3); }
.op-stage {
  padding: 3px 9px; border-radius: var(--r-pill); background: var(--bg-deep);
  color: var(--text-muted); font-size: var(--fs-mono-xs);
}
.op-stage.done { color: var(--success-text); background: color-mix(in srgb, var(--success) 12%, transparent); }
.op-stage.current { color: var(--warning-text); background: color-mix(in srgb, var(--warning) 14%, transparent); font-weight: 700; }
.operation-panel.failed .meter-fill { background: var(--danger); }
.operation-panel.completed .meter-fill { background: var(--success); }

.log-panel {
  margin-top: var(--s-2); border: 1px solid var(--border-soft);
  border-radius: var(--r-2xl); background: color-mix(in srgb, var(--bg-surface) 94%, transparent);
  overflow: hidden; box-shadow: var(--shadow-sm);
}
.log-panel summary {
  list-style: none; display: flex; align-items: center; justify-content: space-between;
  gap: var(--s-3); padding: var(--s-4); cursor: pointer;
  color: var(--text-secondary); font: 650 var(--fs-label) var(--font-sans); user-select: none;
}
.log-panel summary::-webkit-details-marker { display: none; }
.summary-side { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; }
.chevron { color: var(--text-muted); transition: transform var(--t-fast); }
details[open] .chevron { transform: rotate(90deg); }
.log-wrap { padding: 0 var(--s-4) var(--s-4); }
.log-box {
  min-height: 58px; max-height: 240px; overflow: auto; padding: var(--s-3);
  border-radius: var(--r-md); background: var(--bg-deep);
  font: var(--fs-mono-sm) / 1.65 var(--font-mono); color: var(--text-secondary);
}
.log-box .time { color: var(--text-muted); }
.log-box .info { color: var(--info-text); }
.log-box .err { color: var(--danger-text); }
.log-empty { color: var(--text-muted); font-family: var(--font-sans); text-align: center; padding: var(--s-4); }

@media (max-width: 900px) {
  .control-mobile-nav { display: block; }
  .control-layout { display: block; padding: 0; }
  .control-rail { display: none; }
  .control-intro { grid-template-columns: 1fr; }
  .control-count { display: none; }
  .status-wall { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .control-work-grid { grid-template-columns: 1fr; }
  .resource-panel .mode-grid, .service-config-panel .voice-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .nav-local { padding: 0 var(--s-3); }
  .control-shell { padding: var(--s-5) var(--s-3) var(--s-8); }
  .status-wall, .mode-grid, .access-grid, .voice-grid, .resource-panel .mode-grid, .service-config-panel .voice-grid { grid-template-columns: 1fr; }
  .status-tile.primary { grid-column: auto; }
  .field-row, .service-row, .tunnel-toggle-row { flex-direction: column; align-items: stretch; }
  .service-row-actions .btn { flex: 1; }
  .toolbar-note { display: none; }
  .control-toolbar { border-radius: var(--r-xl); }
}
</style>
