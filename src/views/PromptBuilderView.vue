<template>
  <article class="pb" :data-character="character" data-director-mode="basic">
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>
    <div class="pb-topline">
      <div class="pb-header">
        <div class="pb-kicker">Nene &amp; Natsume Private Atelier</div>
        <h1 class="pb-title">开始绘制</h1>
        <p class="pb-sub">选一个场景，定下情绪、镜头与光照；参数会自动备好，你只管出图。</p>
      </div>
      <div class="pb-top-actions">
        <button class="focus-mode-btn" id="focusModeBtn" type="button" aria-label="进入专注成片模式" aria-pressed="false" data-action="toggle-focus-mode"><span data-icon="focus"></span><span class="focus-mode-label">专注成片</span></button>
        <div class="api-status"><span id="sd-status-badge" class="badge">正在连接 SD…</span></div>
        <div class="utility-menu" id="utilityMenu">
          <button class="utility-trigger" id="utilityTrigger" type="button" aria-label="打开更多工具" aria-expanded="false" data-action="toggle-utility-menu"><span data-icon="more"></span></button>
          <div class="utility-popover" id="utilityPopover" hidden>
            <div class="utility-label">本地数据</div>
            <div class="utility-actions">
              <button class="btn btn-ghost" id="backupExportBtn" type="button" data-action="export-local-data"><span class="icon-label"><span data-icon="export"></span>导出备份</span></button>
              <button class="btn btn-ghost" type="button" data-action="open-backup-picker"><span class="icon-label"><span data-icon="restore"></span>恢复备份</span></button>
              <button class="btn btn-ghost wide" type="button" data-action="run-storage-health"><span class="icon-label"><span data-icon="sparkle"></span>存储体检</span></button>
              <button class="btn btn-ghost wide" type="button" data-action="discard-quarantined">丢弃隔离记录</button>
              <button class="btn btn-ghost wide" type="button" data-action="replay-first-creation">重新体验快速引导</button>
            </div>
            <input class="sr-only" id="backupFileInput" type="file" accept="application/json,.json" data-action="preview-backup-file">
          </div>
        </div>
      </div>
    </div>

    <div class="setup-strip">
      <div class="guide-bar" id="guideBar">写一个故事，或选一张场景卡</div>
      <div class="project-bar">
        <label>项目</label>
        <select id="projectSelect" data-action="switch-project"><option value="">（无项目）</option></select>
        <button class="btn btn-ghost" id="projectNewBtn" data-action="create-project" aria-label="新建项目">+ 新建</button>
      </div>
    </div>

    <div class="director-workspace">
      <!-- 左栏：剧本 -->
      <div class="director-col col-left">
        <div class="panel step-panel" id="stepStory">
          <div class="panel-title"><span data-icon="story"></span>故事 · Story</div>
          <textarea class="story-input" id="storyInput" placeholder="一句话描述脑海里的画面…"></textarea>
          <div class="scene-context" id="sceneContext" hidden></div>
          <div class="story-prompt-hint" id="storyPromptHint" hidden></div>
          <div class="story-chips">
            <button type="button" class="story-chip" data-action="set-story">放学后在樱花树下等人的宁宁</button>
            <button type="button" class="story-chip" data-action="set-story">第一次在海边看日出的夏目</button>
            <button type="button" class="story-chip" data-action="set-story">夏夜祭典穿浴衣看烟花</button>
            <button type="button" class="story-chip" data-action="set-story">雪天围围巾的温柔一瞬</button>
          </div>
        </div>

        <div class="panel step-panel" id="stepChar">
          <div class="panel-title"><span data-icon="character"></span>角色 · Character</div>
          <div class="char-row">
            <button class="char-btn active" type="button" data-char="nene" aria-pressed="true" data-action="set-char"><span data-icon="flower"></span>宁宁</button>
            <button class="char-btn" type="button" data-char="natsume" aria-pressed="false" data-action="set-char"><span data-icon="leaf"></span>夏目</button>
            <button class="char-btn" type="button" data-char="triad" aria-pressed="false" data-action="set-char"><span data-icon="both"></span>双人</button>
          </div>
          <div class="traits-row" id="traitsRow"></div>
        </div>

        <div class="panel step-panel" id="stepScene">
          <div class="panel-title"><span data-icon="scene"></span>Scene · <span class="scene-count-badge" id="sceneCountBadge"></span></div>
          <label class="sr-only" for="sceneSearch">搜索场景</label>
          <div class="scene-search-wrap">
            <input type="search" class="scene-search" placeholder="试试：安静的夏目雨夜" id="sceneSearch">
            <button class="scene-search-clear" type="button" data-action="clear-scene-search" aria-label="清空">×</button>
          </div>
          <div class="scene-filter-summary">
            <span class="scene-result-count" id="sceneResultCount" role="status" aria-live="polite">正在整理场景…</span>
            <span class="scene-filter-actions">
              <button class="scene-filter-reset" id="sceneLibraryModeBtn" type="button" data-action="toggle-scene-library-mode">探索全部</button>
              <button class="scene-filter-reset" type="button" data-action="reset-scene-filters">重置筛选</button>
            </span>
          </div>
          <div class="scene-filter-label">主题</div>
          <div class="scene-cats" id="sceneCats"></div>
          <div class="scene-filter-more" id="sceneFilterMore">
            <button class="scene-filter-more-toggle" id="sceneFilterMoreToggle" type="button" aria-expanded="false" data-action="toggle-scene-filters"><span>更多筛选</span></button>
            <div class="scene-filter-more-body" id="sceneFilterMoreBody" hidden>
              <div class="scene-filter-grid">
                <label class="scene-filter-field">角色<select id="sceneCharFilter" data-action="render-scenes"><option value="all">全部角色</option><option value="nene">🌸 宁宁</option><option value="natsume">🍂 夏目</option><option value="triad">🌸🍂 双人</option></select></label>
                <label class="scene-filter-field">季节<select id="sceneSeasonFilter" data-action="render-scenes"><option value="all">全部季节</option><option value="春">春</option><option value="夏">夏</option><option value="秋">秋</option><option value="冬">冬</option></select></label>
                <label class="scene-filter-field">系列<select id="sceneSeriesFilter" data-action="render-scenes"><option value="all">全部系列</option><option value="after">After Story</option><option value="fanwork">同人</option></select></label>
                <label class="scene-filter-field">分级<select id="sceneRatingFilter" data-action="render-scenes"><option value="all">全部分级</option><option value="All">全年龄</option><option value="R15">R15</option><option value="R18">R18</option></select></label>
              </div>
              <div class="scene-mature-row"><label><input type="checkbox" id="builderShowMature"> 显示成人内容</label></div>
            </div>
          </div>
          <div class="scene-list" id="sceneGrid"></div>
        </div>
      </div>

      <!-- 中栏：监视器 -->
      <div class="director-col col-center">
        <section class="stage-placeholder" aria-label="成片监看区">
          <div class="stage-chrome"><span>CANVAS</span><span class="stage-ready">READY</span></div>
          <img class="stage-muse nene" src="/assets/characters/nene-official.webp" alt="" aria-hidden="true" decoding="async">
          <img class="stage-muse natsume" src="/assets/characters/natsume-official.webp" alt="" aria-hidden="true" decoding="async">
          <div class="stage-message">
            <div class="stage-placeholder-icon">✦</div>
            <div class="stage-welcome">
              <div class="stage-placeholder-title">先拍第一张，再慢慢认识工作台</div>
              <div class="stage-placeholder-copy">我会替你选一张招牌场景并准备好画面参数，你只需要按一次生成。</div>
              <div class="first-creation-actions">
                <button class="btn btn-primary" id="firstRunExperienceBtn" type="button" data-action="start-first-creation"><span data-icon="sparkle"></span>用精选场景体验一次</button>
                <button class="btn btn-ghost" type="button" data-action="dismiss-first-creation">我自己开始</button>
              </div>
            </div>
            <div class="stage-idle">
              <div class="stage-placeholder-title">成片将在这里出现</div>
              <div class="stage-quick-actions">
                <button class="btn btn-primary" type="button" data-action="load-random-signature-scene"><span data-icon="recommend"></span>随机精选</button>
                <button class="btn btn-ghost" type="button" data-action="focus-scene-search"><span data-icon="scene"></span>自己找场景</button>
              </div>
              <div class="recent-scene-shortcuts" id="recentSceneShortcuts"></div>
            </div>
          </div>
        </section>
        <div class="monitor monitor-preview-collapsed" id="promptMonitor">
          <div class="monitor-corners"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></div>
          <div class="monitor-rec"><span class="dot"></span> SCENE</div>
          <div class="panel-title"><span data-icon="prompt"></span>Prompt 实时预览 <span class="monitor-toggle" id="monitorToggle" data-action="toggle-monitor">展开</span></div>
          <div class="preview-output" id="preview">选择左侧场景或调整右侧画面选项，提示词会在这里实时生成。</div>
          <div class="token-row"><span class="token-counter" id="liveTokCount"><span class="num">0</span> 正向 · <span class="neg-num">0</span> 负向 <span class="bar"><i></i></span><span class="prompt-health">结构均衡</span></span></div>
          <div class="art-warn" id="artWarn" hidden>⚠️ 检测到违反美术规范的标签</div>
          <div class="preview-actions">
            <button class="btn btn-primary" data-action="copy-prompt">复制</button>
            <button class="btn btn-ghost" data-action="export-prompt">TXT</button>
            <button class="btn btn-ghost" data-action="export-png">PNG</button>
            <button class="btn btn-ghost" data-action="save-history">保存</button>
          </div>
        </div>

        <details class="panel generation-settings">
          <summary class="panel-title settings-summary"><span class="settings-caret">▸</span><span data-icon="settings"></span>出图参数</summary>
          <div class="controls-grid">
            <div class="ctrl ctrl-full mb-2"><label>快速预设</label><select id="presetSelect"><option value="">（自定义）</option></select></div>
            <div class="ctrl"><label>CFG</label><select id="cfg"><option>3</option><option>4</option><option>5</option><option selected>5.5</option><option>6</option><option>7</option><option>8</option></select></div>
            <div class="ctrl"><label>Steps</label><select id="steps"><option>20</option><option selected>28</option><option>30</option><option>35</option><option>40</option><option>50</option></select></div>
            <div class="ctrl ctrl-full"><label>SD 模型</label><select id="sdModel"><option value="">使用 WebUI 当前模型</option></select></div>
            <div class="ctrl"><label>Sampler</label><select id="sampler"><option>DPM++ 2M</option><option>DPM++ 2M SDE</option><option>Euler a</option><option>Euler</option></select></div>
            <div class="ctrl"><label>Scheduler</label><select id="scheduler"><option value="">自动</option><option selected>Karras</option><option>Exponential</option></select></div>
            <div class="ctrl toggle-row"><label class="switch"><input type="checkbox" id="quality" checked><span class="slider"></span></label><label for="quality">质量前缀</label></div>
            <div class="ctrl toggle-row"><label class="switch"><input type="checkbox" id="tail" checked><span class="slider"></span></label><label for="tail">镜头收束</label></div>
            <div class="ctrl toggle-row"><label class="switch"><input type="checkbox" id="negative" checked><span class="slider"></span></label><label for="negative">负面</label></div>
          </div>
        </details>

        <div class="result-frame step-panel" id="stepResult">
          <div class="panel-title"><span data-icon="scene"></span>输出 Result</div>
          <div class="first-success-coach" id="firstSuccessCoach">
            <div class="first-success-copy"><strong>第一张图片生成成功！</strong>现在可以保持真实 Seed 微调、排队生成或保存快照。</div>
            <div class="first-success-actions">
              <button class="btn btn-ghost" type="button" data-action="use-last-seed">锁 Seed 微调</button>
              <button class="btn btn-ghost" type="button" data-action="enqueue-sd-generate">加入队列</button>
              <button class="btn btn-primary" type="button" data-action="save-history-and-dismiss-success">保存快照</button>
              <button class="btn btn-ghost" type="button" data-action="dismiss-first-success">×</button>
            </div>
          </div>
          <div class="quick-create-banner" id="quickCreateBanner" hidden><strong>快速创作</strong><span id="quickCreateCopy"></span></div>
          <details class="prompt-details" id="promptDetails">
            <summary class="prompt-summary"><span data-icon="prompt"></span>Prompt 提示词 <span class="prompt-summary-hint">已折叠 · 点击展开</span></summary>
            <div class="preview-output" id="finalPrompt"></div>
          </details>
          <div class="sd-inline-options">
            <label>尺寸<span class="select-wrap"><select id="size">
              <optgroup label="竖图 Portrait"><option value="768×1344">768×1344</option><option value="832×1216" selected>832×1216</option></optgroup>
              <optgroup label="方图 Square"><option value="896×896">896×896</option><option value="1024×1024">1024×1024</option></optgroup>
              <optgroup label="横图 Landscape"><option value="1216×832">1216×832</option><option value="1344×896">1344×896</option></optgroup>
              <optgroup label="16:9 官方 CG"><option value="1280×720">1280×720</option><option value="1344×768">1344×768</option></optgroup>
            </select></span></label>
            <span class="scene-size-hint" id="sceneSizeHint" hidden></span>
            <label class="hires-label"><span class="switch"><input type="checkbox" id="sdHiresFix"><span class="slider"></span></span> hires.fix</label>
            <details class="sd-advanced-options">
              <summary>高级设置</summary>
              <div class="sd-advanced-grid">
                <label>放大<select id="sdHiresScale"><option value="1.5" selected>1.5×</option><option value="2">2×</option></select></label>
                <label>放大器<select id="sdHiresUpscaler"><option>Latent</option><option>R-ESRGAN 4x+ Anime6B</option></select></label>
                <label class="seed-lock-label"><input type="checkbox" id="sdSeedLock"> 固定种子</label>
                <label class="seed-input-wrap">种子<input type="text" id="sdSeedInput" placeholder="留空=随机"></label>
                <span id="sdSeedDisplay"></span>
              </div>
            </details>
            <div class="sd-budget-hint" id="sdBudgetHint" role="status" aria-live="polite"></div>
          </div>
          <div class="preview-actions">
            <button class="btn btn-ghost" data-action="toggle-result">展开 Prompt</button>
            <button class="btn btn-primary" data-action="copy-prompt">复制</button>
            <button class="btn btn-primary" data-action="call-sd-generate" id="sdGenBtn">生成图片</button>
            <button class="btn btn-ghost" data-action="enqueue-sd-generate" id="sdQueueBtn">加入队列</button>
            <button class="btn btn-ghost" data-action="quick-create-current" id="quickCreateBtn">快速重试</button>
            <button class="btn btn-ghost" data-action="cancel-sd-generate" id="sdCancelBtn" hidden>停止生成</button>
            <button class="btn btn-ghost" data-action="open-review">评价</button>
            <button class="btn btn-ghost" data-action="reset-director">再来一次</button>
          </div>
          <div class="sd-queue" id="sdQueue" hidden>
            <div class="sd-queue-head"><span>生成队列</span><span><button class="btn btn-ghost" id="sdQueueResumeBtn" type="button" data-action="resume-sd-queue" hidden>继续</button> <span id="sdQueueCount">0 项</span></span></div>
            <div class="sd-queue-list" id="sdQueueList"></div>
          </div>
          <div class="sd-result-area" id="sdResultArea" hidden>
            <div class="sd-status" id="sdStatus" role="status" aria-live="polite"></div>
            <div id="sdProgress" class="sd-progress" hidden><span id="sdProgressBar"></span></div>
            <div id="sdRecovery" class="sd-recovery" hidden>
              <div class="sd-recovery-title" id="sdRecoveryTitle"></div>
              <div class="sd-recovery-copy" id="sdRecoveryCopy"></div>
              <div class="sd-recovery-actions"><button type="button" class="btn btn-primary" id="sdRecoveryAction" hidden></button></div>
              <details id="sdRecoveryDetails"><summary>技术详情</summary><pre id="sdRecoveryDetail"></pre></details>
            </div>
            <div id="sdImageSlot"></div>
            <div class="sd-save-actions" id="sdSaveActions" hidden>
              <div id="sdFeedback" class="sd-feedback" hidden></div>
              <div class="sd-save-row">
                <button class="btn btn-ghost" type="button" data-action="use-last-seed">锁 Seed 微调</button>
                <button class="btn btn-primary" type="button" data-action="save-history">保存快照</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右栏：风格 -->
      <div class="director-col col-right">
        <div class="panel step-panel" id="stepEmotion">
          <div class="panel-title"><span data-icon="emotion"></span>情绪 · Emotion</div>
          <div class="emotion-list" id="emotionList"></div>
          <input class="emotion-custom" id="emotionCustom" type="text" placeholder="自定义情绪…">
        </div>
        <div class="panel step-panel" id="stepCamera">
          <div class="panel-title"><span data-icon="camera"></span>镜头 · Camera</div>
          <div class="camera-list" id="cameraList"></div>
        </div>
        <div class="panel step-panel" id="stepLighting">
          <div class="panel-title"><span data-icon="lighting"></span>光照 · Lighting</div>
          <div class="lighting-list" id="lightingList"></div>
        </div>
        <div class="panel step-panel" id="stepStyle">
          <div class="panel-title"><span data-icon="style"></span>风格 · Style</div>
          <div id="stylePresets" class="style-presets"></div>
        </div>
        <div class="panel step-panel" id="stepLora">
          <div class="panel-title"><span data-icon="lora"></span>LoRA</div>
          <div id="loraList" class="lora-list"></div>
        </div>
        <div class="panel step-panel" id="stepVoice">
          <div class="panel-title"><span data-icon="voice"></span>语音 · Voice</div>
          <div id="voiceControls" class="voice-controls"></div>
        </div>
      </div>
    </div>

    <!-- 全局弹窗区 -->
    <div id="reviewModal" class="modal" hidden></div>
    <div id="historyPanel" class="history-panel" hidden></div>
    <div id="toastContainer" class="toast-container"></div>
  </article>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const character = ref('nene')

// 动态注入 prompt-builder 子模块（保持原有初始化顺序）
// 顺序严格对齐 prompt-builder.html 原始加载顺序
// index.html 已全局加载：image-store, scene-ux, quick-create, sd-error, storage-health
const PB_SCRIPTS = [
  '/tools/prompt-policy.js',
  '/tools/data-backup.js',
  '/tools/sd-api.js',
  '/tools/icon-system.js',
  '/tools/prompt-builder/state.js',
  '/tools/prompt-builder/composition.js',
  '/tools/prompt-builder/scene-inference.js',
  '/tools/prompt-builder/scene.js',
  '/tools/prompt-builder/prompt.js',
  '/tools/prompt-builder/sd.js',
  '/tools/prompt-builder/queue.js',
  '/tools/prompt-builder/voice.js',
  '/tools/prompt-builder/history.js',
  '/tools/prompt-builder/backup.js',
  '/tools/prompt-builder/ui.js',
  '/tools/prompt-builder/app.js',
]

let injectedScripts: HTMLScriptElement[] = []

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const el = document.createElement('script')
    el.src = src
    el.async = false
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.body.appendChild(el)
    injectedScripts.push(el)
  })
}

async function loadAll() {
  // 透传 URL 参数给脚本（脚本通过 window.location.search 读取）
  for (const src of PB_SCRIPTS) {
    try { await loadScript(src) } catch (e) { console.warn(e) }
  }
}

onMounted(() => {
  // 同步 URL query 到 body dataset（原脚本通过 window.location.search 读取，无需处理）
  loadAll()
})

onUnmounted(() => {
  // 清理注入的脚本标签，避免重复初始化
  injectedScripts.forEach(el => el.remove())
  injectedScripts = []
  // 通知现有脚本页面卸载（如有注册的清理函数）
  try { (window as any).__pbDestroy?.() } catch {}
})
</script>
